# Phase 3.16 — iNaturalist Migration & Botanical Cache Hardening

## Why this phase exists

Perenual's free tier is hard-capped at species IDs 1–3,000 (~37 results for any search). The iNaturalist taxa API is free, requires no API key, covers 10M+ species, and returns `preferred_common_name` + `default_photo` inline — eliminating the separate thumbnail-fetch pass that enrichment currently performs.

**What stays the same:**

- `cached_botanical_records` is still the plant encyclopedia; PK is `scientific_name`
- `cache-enrichment-worker` pg_cron job (every 10 min) is unchanged
- Once `is_ai_enriched = true`, the AI Scribe never runs for that record again
- All search paths hit the local cache first; the external call fires only on cache miss
- `claude-vision` (AI Leaf Doctor) — **no changes needed**. It receives an image, calls Claude, and returns health diagnostics. It has zero interaction with `cached_botanical_records`, `perenual_id`, or `inat_taxon_id`. Completely isolated from the botanical cache.

**What changes:**

- `botanical-search` Edge Function: single iNat call replaces the 5-page Perenual loop
- `_shared/enrich-record.ts`: skips iNat thumbnail fetch when already populated from search; populates `inat_taxon_id` from all enrichment paths
- `claude-plant-id`: returns `inat_taxon_id`; inserts a stub record for newly identified species so the cron picks them up
- Angular layer: `inat_taxon_id` threaded through every model, service, and form dialog that touches `perenual_id`
- Library: enrichment triggers only for the currently visible page, not the full 1,000-record result set
- **Perenual fully removed at the end** (Blocks M + N): the cache's `perenual_id` + `is_perenual_enriched` and the `plants.perenual_id` column are all dropped. `inat_taxon_id` becomes the sole species link on `plants`; `inat_species_id` is the cache grouping key. Test data is regenerated from the iNat-canonical cache (no production data exists — only the developer's test garden)

---

## iNaturalist Taxa API — field mapping reference

```
GET https://api.inaturalist.org/v1/taxa?q={q}&taxon_id=47126&is_active=true&per_page={n}&locale=en
```

`taxon_id=47126` = Plantae kingdom. `is_active=true` excludes deprecated/merged taxa (cleaner matches). `locale=en` forces English `preferred_common_name`. **No `rank=species` filter** — dropping it admits hybrids (`hybrid` / `genushybrid` rank, rank_level 10) and infraspecific taxa (`subspecies` / `variety` / `form`, rank_level 5) that gardeners legitimately grow. No API key required. Endpoint `/taxa` is chosen over `/taxa/autocomplete` because only `/taxa` accepts a high `per_page` (max 200) for cache-warming — both return identical `ancestor_ids` / `rank_level` fields.

| iNat field                                 | Our column        | Notes                                                                            |
| ------------------------------------------ | ----------------- | -------------------------------------------------------------------------------- |
| `results[n].id`                            | `inat_taxon_id`   | exact leaf taxon — identity + dedup key                                          |
| species-rank ancestor (rule below)         | `inat_species_id` | grouping key                                                                     |
| `results[n].rank`                          | `inat_rank`       | `species` / `hybrid` / `subspecies` / `variety` / `form` — drives the rank badge |
| `results[n].name`                          | `scientific_name` | binomial, already cased                                                          |
| `results[n].preferred_common_name ?? name` | `common_name`     | apply `toSentenceCase`; falls back to `name` for obscure taxa                    |
| `results[n].default_photo.url`             | `thumbnail_url`   |                                                                                  |
| `results[n].default_photo.medium_url`      | `regular_url`     |                                                                                  |

**Two-tier identity model.** `inat_taxon_id` is the exact leaf taxon (species, subspecies, variety, or hybrid) — used for identity, photos, and as the dedup key. `inat_species_id` is the species-rank ancestor — used as the grouping key so real iNat varieties/subspecies collapse under their parent species (e.g. _Brassica oleracea_ var. _italica_ + var. _capitata_ → one "Brassica oleracea" card). iNaturalist has **no concept of cultivars**, so the old cultivar-string grouping is replaced by this botanically authoritative hierarchy.

**Species-ancestor rule** — computes `inat_species_id` with no extra API call (`rank_level` and `parent_id` are in the same taxon object):

- `rank_level === 10` (species or hybrid) → `inat_species_id = id` (itself)
- `rank_level < 10` (subspecies / variety / form) → `inat_species_id = parent_id`
- `rank_level > 10` (genus or coarser match) → `inat_species_id = null` (not a species — grouping falls back to `inat_taxon_id`, then `common_name`)

---

## Blocks

- [x] **Block A — DB migration: `inat_taxon_id` column** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - New migration file: add `inat_taxon_id INTEGER NULL` to `cached_botanical_records`
  - New migration file: add `inat_taxon_id INTEGER NULL` to `plants`
  - Index both: `CREATE INDEX IF NOT EXISTS idx_cbr_inat_taxon_id ON cached_botanical_records(inat_taxon_id)` and `CREATE INDEX IF NOT EXISTS idx_plants_inat_taxon_id ON plants(inat_taxon_id)`
  - Update `docs/DB_SCHEMA_MATRIX.md` — add `inat_taxon_id INTEGER NULL` to the `cached_botanical_records` and `plants` table definitions
  - Run `bunx supabase migration up`, then `bun run types`, then `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`
  - Verify in Studio SQL (`http://127.0.0.1:54323/`): `SELECT column_name FROM information_schema.columns WHERE table_name = 'cached_botanical_records' AND column_name = 'inat_taxon_id';` — must return one row

- [x] **Block B — Rewrite `botanical-search/index.ts`** | Agent: `/plumber` · Model: Sonnet · Effort: high
  - Remove `MAX_PAGES` constant, `PERENUAL_API_KEY` env read, the `while (page <= MAX_PAGES)` pagination loop, and `pageRecords` accumulator
  - Rename `BotanicalResult.perenual_id` → `inat_taxon_id: number | null`
  - Cache query: replace `perenual_id` with `inat_taxon_id`; keep `thumbnail_url` in the select (already there)
  - New iNat call (wraps the existing `fresh: BotanicalResult[]` block):
    ```ts
    const resp = await fetch(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&taxon_id=47126&rank=species&per_page=${MAX_RESULTS}&locale=en`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) throw new Error(`iNaturalist responded ${resp.status}`);
    const body = (await resp.json()) as { results?: Record<string, unknown>[] };
    ```
  - For each result: extract `id` (inat_taxon_id), `name` (scientific_name), `preferred_common_name ?? name` → `toSentenceCase` (common_name), `default_photo?.url` (thumbnail_url), `default_photo?.medium_url` (regular_url)
  - Skip results where `scientific_name` is falsy
  - Upsert batch: include `inat_taxon_id`, `thumbnail_url`, `regular_url`, `thumbnail_fetched: true` — photos are inline; no separate fetch pass needed
  - `fresh` array: include `inat_taxon_id` and `thumbnail_url` per entry (so merged result also has thumbnails)
  - Update the error log: "Perenual fetch failed" → "iNaturalist fetch failed"
  - Run `bun run format && bun run lint`
  - Verify with PowerShell (local functions must be running via `bunx supabase functions serve --no-verify-jwt --env-file supabase/functions/.env`):
    ```powershell
    Invoke-RestMethod -Uri "http://127.0.0.1:54321/functions/v1/botanical-search?q=ros" -Headers @{ Authorization = "Bearer <anon-key>" }
    ```
    Expect ≥30 results with `inat_taxon_id` populated and `thumbnail_url` present on most entries

- [x] **Block C — Update `_shared/enrich-record.ts`** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - `queryINat()` return type: add `taxon_id: number` — extract from `data.results[0].id`
  - `fetchINatThumbnail()` return type: add `taxon_id: number | null`
  - In `enrichRecord()` full path: check `cached?.thumbnail_url && cached?.thumbnail_fetched` before calling `fetchINatThumbnail`. If already set, skip the iNat HTTP request and use existing values:
    ```ts
    const inat =
      cached?.thumbnail_url && cached?.thumbnail_fetched
        ? {
            taxon_id: cached?.inat_taxon_id ?? null,
            thumbnail_url: cached.thumbnail_url,
            regular_url: cached.regular_url ?? null,
          }
        : await fetchINatThumbnail(scientificName, commonName);
    ```
  - Full path upsert: add `inat_taxon_id: inat.taxon_id ?? cached?.inat_taxon_id ?? null`; keep `thumbnail_url: inat.thumbnail_url`, `regular_url: inat.regular_url`, `thumbnail_fetched: true` — unchanged
  - Thumbnail-only path (AI-enriched, thumbnail missing): add `inat_taxon_id: inat.taxon_id ?? null` to the `.update()` call
  - **`thumbnail_fetched` is kept** — it is still the infinite-retry guard for species absent from iNaturalist's photo database. Without it, any species where `default_photo` is null would re-trigger `fetchINatThumbnail` on every enrichment call. After Phase 3.16, Block B sets `thumbnail_fetched = true` at search time for all iNat-returned species; the cron's thumbnail-only path sets it for old Perenual records when they are eventually enriched. Update the column comment in the migration file to reflect these new semantics.
  - Run `bun run format && bun run lint`
  - Verify: trigger `cache-enrichment-worker` manually in Studio. Confirm the updated record has `inat_taxon_id` populated.

- [x] **Block D — Update `claude-plant-id/index.ts` & `AI_PROMPT_MANIFEST.md §2.3`** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Cache lookup: change `.select('perenual_id')` → `.select('perenual_id, inat_taxon_id')`
  - When `!cachedRecord` (species unknown): insert a minimal stub **before** triggering background enrichment, so the cron will pick it up even when `EdgeRuntime.waitUntil` is absent:
    ```ts
    await supabase
      .from('cached_botanical_records')
      .upsert({ scientific_name, common_name }, { onConflict: 'scientific_name' })
      .select()
      .single();
    ```
  - Response: add `inat_taxon_id: cachedRecord?.inat_taxon_id ?? null` alongside existing `perenual_id`
  - `docs/AI_PROMPT_MANIFEST.md §2.3`: add `inat_taxon_id: number | null` to `PlantIdResponse`; update the explanatory paragraph below the interface to mention that `inat_taxon_id` is the primary identifier for new records; note that `perenual_id` is kept for backward compat and will be `null` for all species not previously fetched from Perenual
  - Run `bun run format && bun run lint`
  - Verify: run the Plant Identifier on a photo of a known common plant. Response JSON must include both `perenual_id` (may be null) and `inat_taxon_id`.

### Canonicalization addendum (decision 2026-06-08)

The first backfill pass exposed two problems the original Block G did not anticipate: (1) early runs matched `results[0]` from a `rank=species` query with **no verification**, so some `inat_taxon_id` values may point at the wrong species while the AI-enriched care data describes a different one; (2) iNaturalist has no cultivars, so grouping by `inat_taxon_id` leaves real botanical varieties as separate cards instead of collapsing them under their species. **User decision: "Canonical iNat"** — re-verify every match with a genus+epithet guard, delete iNat-absent rows, deduplicate to one row per iNat taxon, and group by the species-rank ancestor (`inat_species_id`). Blocks G–K below replace the original Block G.

- [x] **Block G — Migration: `inat_species_id` + `inat_rank` columns** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - New migration file (one file, both columns):
    - `ALTER TABLE public.cached_botanical_records ADD COLUMN IF NOT EXISTS inat_species_id INTEGER NULL;`
    - `ALTER TABLE public.cached_botanical_records ADD COLUMN IF NOT EXISTS inat_rank TEXT NULL;`
    - `CREATE INDEX IF NOT EXISTS idx_cbr_inat_species_id ON public.cached_botanical_records (inat_species_id);`
  - `inat_rank` holds the leaf taxon's iNat rank (`species` / `hybrid` / `subspecies` / `variety` / `form`) — drives the rank badge (Block L). No index (display-only, never filtered server-side)
  - Update `docs/DB_SCHEMA_MATRIX.md §2.4` — add `inat_species_id INTEGER NULL` and `inat_rank TEXT NULL` after `inat_taxon_id`; add the `inat_species_id` index to §3
  - `bunx supabase migration up` → `bun run types` → `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`
  - Verify in Studio SQL: both columns exist on `cached_botanical_records`

- [x] **Block H — iNat query hardening (`botanical-search` + `_shared/enrich-record.ts`)** | Agent: `/plumber` · Model: Sonnet · Effort: high
  - Shared helper `deriveSpeciesId(taxon)` in `_shared/` implementing the species-ancestor rule (rank_level 10 → self id; <10 → parent_id; >10 → null)
  - Both functions: drop `rank=species`; keep `taxon_id=47126`; add `is_active=true`
  - `botanical-search`: fetch `per_page=100` (constant `MAX_UPSERT`) to warm the cache widely; upsert all 100 with `inat_species_id` **and** `inat_rank` (from `taxon.rank`) populated; **return only the top 30** (`MAX_RESULTS`) to the caller so the autocomplete dropdown stays usable — this solves "too few results" for the library without flooding the dropdown
  - `enrich-record.ts` (`queryINat` / `fetchINatThumbnail`): capture and return `species_id` + `rank`; full + thumbnail-only upsert paths write `inat_species_id` and `inat_rank`
  - Run `bun run format && bun run lint`
  - Verify (PowerShell, authed JWT): search "ros" → ≥30 returned, and Studio SQL shows ≥30 newly-cached "ros%" rows carrying `inat_taxon_id`, `inat_species_id`, and `inat_rank`; search a hybrid ("× freemanii") returns a match with `inat_rank = 'hybrid'`

- [x] **Block I — `inat-backfill` v2: canonicalize, verify, species_id** | Agent: `/plumber` · Model: Sonnet · Effort: high
  - `canonicalizeScientificName()`: strip cultivar quotes → authority parens → infraspecific markers (`var.` `f.` `subsp.` `ssp.`) → trailing ALL-CAPS trademark words (already drafted)
  - `isSameSpecies(candidate, inatName)`: genus AND species epithet must match after normalising hybrid markers — rejects wrong-species matches that would mislink enrichment (already drafted)
  - Drop `rank=species`; `taxon_id=47126`; `is_active=true`; `x`-stripping retry for hybrids
  - Populate `inat_species_id` via the shared `deriveSpeciesId` helper and `inat_rank` from `taxon.rank` on every match
  - No-match (incl. genus-only after canonicalize) → `inat_taxon_id = -1` sentinel (excluded from future batches; grouping/cleanup treat `> 0` as a real id)
  - Return `{ processed, remaining, absent }`
  - Run `bun run format && bun run lint`

- [x] **Block J — Reset, re-verify & cleanup (operational)** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - **Reset for trustworthy re-match** (Studio SQL): `UPDATE cached_botanical_records SET inat_taxon_id = NULL, inat_species_id = NULL;` — discards unverified early-pass matches
  - Re-run the Block I backfill loop to `remaining = 0` (every row now matched with the genus+epithet guard, or marked `-1`)
  - **Delete iNat-absent rows:** `DELETE FROM cached_botanical_records WHERE inat_taxon_id = -1;`
  - **Deduplicate** rows sharing an `inat_taxon_id`, keeping the richest enrichment (`is_ai_enriched`, then non-null `description`, then non-null `thumbnail_url`). Provide a dry-run `SELECT` of the delete set **first**; never link one species' enrichment to another (user constraint)
  - Verify: `SELECT COUNT(*) FROM cached_botanical_records WHERE inat_taxon_id IS NULL OR inat_taxon_id = -1;` → 0; and no `inat_taxon_id` appears more than once

- [x] **Block K — Grouping refactor (`group-botanical-records.util.ts`)** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Grouping key: `record.inat_species_id ?? (record.inat_taxon_id && record.inat_taxon_id > 0 ? record.inat_taxon_id : null) ?? record.common_name.toLowerCase().trim()`
  - Add `inatSpeciesId: number | null` to `SpeciesGroup`, set from `representative.inat_species_id`
  - Real iNat varieties/subspecies of one species collapse into one card; standalone species show one card, no variety badge (honest — cultivar chips are gone by design)
  - Run `bun run format && bun run lint && bun run test`
  - Manual Browser Check — Block K
    ────────────────────────────────
    App running at: http://localhost:4200/library
    1. Search a species with iNat varieties (e.g. "brassica oleracea") → varieties collapse into **one** card with a variety badge
    2. Click the card → detail dialog lists the varieties
    3. Search a plain species (e.g. "monstera deliciosa") → one card, no variety badge
    4. Open DevTools Console → zero red errors

- [x] **Block L — Rank badge (`botanical-record-card` + botanical detail dialog)** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - Reads `inat_rank` directly off the record — `CachedBotanicalRecord` carries it automatically after Block G's `bun run types`; **no grouping-util or model change needed**
  - Library card: render a rank badge **only when** `inat_rank` is present and not `'species'` (Hybrid / Subspecies / Variety / Form) — reuse the existing `placement` / `care_difficulty` badge pattern already in `botanical-record-card`; **no new PT object**
  - Detail dialog variety chips: label each non-species variety with its rank (the chip text already shows the trinomial; the badge adds the rank word)
  - Human-readable label map (`subspecies → "Subspecies"`, `variety → "Variety"`, `form → "Form"`, `hybrid`/`genushybrid → "Hybrid"`) — never surface the raw ENUM-style value (UX-First rule)
  - Run `bun run format && bun run lint && bun run test`
  - Manual Browser Check — Block L
    ────────────────────────────────
    App running at: http://localhost:4200/library
    1. Search a hybrid (e.g. "× freemanii") or variety → card shows the correct rank badge
    2. Search a plain species (e.g. "monstera deliciosa") → **no** rank badge
    3. Open DevTools Console → zero red errors

- [x] **Block E — Angular models & services** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `src/app/core/services/botanical-search.service.ts` — `BotanicalSuggestion`: add `inat_taxon_id: number | null`
  - `src/app/core/services/plant-identifier.service.ts` — `PlantIdResult`: add `inat_taxon_id: number | null` (the Edge Function now returns it; the dialog's `emittableInatTaxonId` computed reads `this.identResult()?.inat_taxon_id` — TypeScript won't compile without this field declared here)
  - `src/app/core/services/offline-queue.service.ts` — `QueuedAction`: add `inat_taxon_id?: number | null` (plant.service.ts will enqueue this field in the create path; without it the enqueue call fails to compile)
  - `src/app/features/tasks/plant.model.ts` — `Plant` and `PlantFormData`: add `inat_taxon_id: number | null`
  - `src/app/shared/components/plant-identifier/plant-identifier-dialog.ts` — `PlantIdentifiedEvent`: add `inat_taxon_id: number | null`; add `emittableInatTaxonId = computed(() => this.isPrimaryMatch() ? (this.identResult()?.inat_taxon_id ?? null) : null)`; update both `viewProfile()` and `addToMyPlants()` to emit `inat_taxon_id: this.emittableInatTaxonId()`
  - `src/app/features/tasks/plant.service.ts`:
    - Add `inat_taxon_id` to every `.select()` string that lists columns for the `plants` table
    - Offline-optimistic plant in `createPlant()`: add `inat_taxon_id: null`
    - Offline queue enqueue: add `inat_taxon_id: data.inat_taxon_id`
  - Spec files — add `inat_taxon_id: null` to every mock plant object in:
    - `src/app/features/tasks/tasks.spec.ts`
    - `src/app/features/dashboard/zone-detail/zone-detail.spec.ts`
    - `src/app/features/tasks/soil-check-dialog/soil-check-dialog.spec.ts`
    - `src/app/shared/components/care-recommendations-panel/care-recommendations-panel.spec.ts`
    - `src/app/features/tasks/plant-form-dialog/plant-form-dialog.spec.ts`
    - `src/app/core/services/botanical-thumbnail.service.spec.ts` — `makeRecord()` helper: add `inat_taxon_id: null` (cleanup; the `as unknown` cast means it won't fail, but the stub should reflect the real shape)
  - Run `bun run format && bun run lint && bun run test`
  - Manual Browser Check — Block E
    ────────────────────────────────
    App running at: http://localhost:4200
    1. Add a new plant using the species autocomplete → confirm plant is saved without errors
    2. Open DevTools Console → confirm zero red errors
    3. Open DevTools Network tab → confirm the POST to `plants` includes `inat_taxon_id` in the request body

- [x] **Block F — Form dialogs & Library per-page enrichment** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `src/app/features/tasks/plant-form-dialog/plant-form-dialog.ts`:
    - Add `selectedInatTaxonId = signal<number | null>(null)`
    - Input type for `botanicalPrefill`: add `inat_taxon_id: number | null`
    - "Species locked" guard: `selectedPerenualId() !== null || selectedInatTaxonId() !== null`
    - `onSuggestionSelect()`: also `this.selectedInatTaxonId.set(suggestion.inat_taxon_id)`
    - "Change species" / clear action: also `this.selectedInatTaxonId.set(null)`
    - `effect` or `ngOnChanges` for `botanicalPrefill`: also set `selectedInatTaxonId` from prefill value
    - `buildSubmitPayload()` or equivalent: include `inat_taxon_id: this.selectedInatTaxonId()`
  - `src/app/features/dashboard/dashboard.ts`:
    - `prefillRecord` signal type: add `inat_taxon_id: number | null`
    - Both places where `prefillRecord` is set: include `inat_taxon_id` (from identified event and from openAddDialog)
  - `src/app/features/library/library.ts`:
    - `prefillRecord` signal type: add `inat_taxon_id: number | null`
    - `openAddDialog()`: pass `inat_taxon_id: record.inat_taxon_id`
    - Extract `_enrichCurrentPage()` private method: reads `this.paged()`, flattens all variants from every group on the current page to a flat record array, filters for `!r.is_ai_enriched || r.description == null || !r.thumbnail_fetched`, calls `this._poll.start(names, ...)` and `void this.libraryService.triggerEnrichment(needsEnrichment, this._poll.controller?.signal)` — matching the same logic currently inlined in `_load()`
    - `_load()`: replace the inline needsEnrichment block with `this._enrichCurrentPage()` (called after pagination is ready)
    - `goToPage(page)`: after `this._page.set(page)` and `this._poll.stop()`, call `this._enrichCurrentPage()` — so navigating pages triggers enrichment for the new page's species
  - `src/app/features/seeds/seed-batch-form-dialog/seed-batch-form-dialog.ts`:
    - Rename `selectedPerenualId` → `selectedSpeciesId` throughout (signal name only; no DB field changes needed — `seed_batches` has no `perenual_id` column)
    - On suggestion select: `this.selectedSpeciesId.set(suggestion.inat_taxon_id ?? suggestion.perenual_id ?? null)`
  - `src/app/features/seeds/seeds.ts` — `graduatePrefill` signal type (lines 71–75): add `inat_taxon_id: number | null` to the inline type; in `onGraduateRequested()` include `inat_taxon_id: null` in the `.set()` call (seeds always graduate without an iNat ID — the species lookup happens inside the plant form if the user searches again)
  - Run `bun run format && bun run lint && bun run test`
  - Manual Browser Check — Block F
    ────────────────────────────────
    App running at: http://localhost:4200/library
    1. Search "ros" in the library → spinner appears → ≥30 results appear with thumbnails already populated (no separate thumbnail loading)
    2. Confirm the bottom of page 1 shows enrichment progress only for page 1 species, not all 30+
    3. Click page 2 → enrichment progress message updates to page 2 species
    4. Navigate to Add Plant → search "monstera" → select a result → species chip appears → save the plant → no console errors
    5. Navigate to Seeds → search "sunflower" in the seed batch form → select a result → species locked → no console errors
    6. Navigate to Dashboard → use AI Plant Identifier → identify a plant → "Add to My Plants" pre-fills the form → confirm `inat_taxon_id` is wired (plant saves without error)
    7. Open DevTools Console → confirm zero red errors across all steps

### Perenual removal addendum (decision 2026-06-08)

With `inat_taxon_id` fully threaded (Blocks E + F) and the cache iNat-canonical (Block J), Perenual is removed entirely. The cache's `perenual_id` + `is_perenual_enriched` are dropped; `plants.perenual_id` is dropped and replaced as the species link by `inat_taxon_id` (the column already exists on `plants` from Block A's migration). `is_perenual_enriched` already has **zero functional readers** — it survives only in the generated types. No production data exists — only the developer's test garden — so test data is regenerated fresh from the iNat-canonical cache rather than migrated. **Ordering constraint:** the frontend must stop _selecting_ `plants.perenual_id` (Block M) **before** the column is dropped (Block N), or every plant query returns 400.

- [x] **Block M — Frontend Perenual removal** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - **Gated behind E + F** — `inat_taxon_id` must already be the wired species link before `perenual_id` is torn out, so each file ends iNat-only and compiling
  - Remove the `perenual_id` field from every model/type: `BotanicalSuggestion` (`botanical-search.service.ts`), `PlantIdResult` (`plant-identifier.service.ts`), `QueuedAction` (`offline-queue.service.ts`), `Plant` + `PlantFormData` (`plant.model.ts`), `PlantIdentifiedEvent` (`plant-identifier-dialog.ts`)
  - `plant.service.ts`: drop `perenual_id` from both `.select()` column strings (keep `inat_taxon_id`); remove it from the offline-queue item, the offline-optimistic plant, and the enqueue payload
  - `plant-form-dialog.ts`: delete the `selectedPerenualId` signal and every reference; the lock guard, prefill `effect`, `onSuggestionSelect`, clear action, and `buildSubmitPayload` all use `selectedInatTaxonId` only (added in F); remove `perenual_id` from the `botanicalPrefill` input type
  - `plant-identifier-dialog.ts`: delete `emittablePerenualId`; `viewProfile()` + `addToMyPlants()` emit `inat_taxon_id` only (via `emittableInatTaxonId` from E)
  - `dashboard.ts` + `library.ts`: remove `perenual_id` from the `prefillRecord` signal type and both `.set()` / `openAddDialog()` call sites (keep `inat_taxon_id` from F)
  - `seeds.ts`: remove `perenual_id` from the `graduatePrefill` inline type and `onGraduateRequested()`
  - `seed-batch-form-dialog.ts`: simplify the F fallback `suggestion.inat_taxon_id ?? suggestion.perenual_id ?? null` → `suggestion.inat_taxon_id ?? null` (`BotanicalSuggestion` no longer carries `perenual_id`)
  - Spec files: remove every `perenual_id` and `is_perenual_enriched` key from mock objects in `tasks.spec.ts`, `zone-detail.spec.ts`, `soil-check-dialog.spec.ts`, `care-recommendations-panel.spec.ts`, `plant-form-dialog.spec.ts`, `plant-identifier-dialog.spec.ts`, `plant-identifier.service.spec.ts`, `botanical-thumbnail.service.spec.ts`
  - Verify zero functional references remain: `Grep "perenual" src/app` returns nothing outside comments
  - Run `bun run format && bun run lint && bun run test`
  - Manual Browser Check — Block M
    ────────────────────────────────
    App running at: http://localhost:4200
    1. Add a plant via species autocomplete → saves without error (now iNat-only)
    2. AI Plant Identifier → "Add to My Plants" → form pre-fills and saves
    3. Open DevTools Console → zero red errors

- [x] **Block N — Drop Perenual columns + regenerate test data** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - **Gated behind M + J** — frontend no longer references `plants.perenual_id`; cache is iNat-canonical
  - `claude-plant-id/index.ts`: drop `perenual_id` from the cache `.select()`, the `cacheMap` value type, and the response (returns `inat_taxon_id` only). Update `docs/AI_PROMPT_MANIFEST.md §2.3` — remove `perenual_id` from `PlantIdResponse` and its explanatory note
  - New migration file `20260608000003_phase_3_16_drop_perenual.sql` (one file):
    - `ALTER TABLE public.cached_botanical_records DROP COLUMN IF EXISTS perenual_id;`
    - `ALTER TABLE public.cached_botanical_records DROP COLUMN IF EXISTS is_perenual_enriched;`
    - `DROP INDEX IF EXISTS public.idx_botanical_cache_id;` (was on cache `perenual_id`)
    - `ALTER TABLE public.plants DROP COLUMN IF EXISTS perenual_id;`
  - Update `docs/DB_SCHEMA_MATRIX.md`: remove `perenual_id` from §2.3 `plants`; remove `perenual_id` + `is_perenual_enriched` from §2.4 `cached_botanical_records`; remove `idx_botanical_cache_id` from §3
  - Regenerate test-data snippets so plants link via `inat_taxon_id` (real IDs from the canonical cache), with **no** `perenual_id` anywhere — covering all test cases: indoor + outdoor zones, plants across growth stages and check-due states, seed batches across stages, journals across categories incl. Leaf Doctor diagnostics. Reconcile both the reset snippets (`supabase/snippets/reset_*.sql`) and the populate scripts (`supabase/dev/seed_dev_user.sql`, `supabase/dev/populate_journal.sql`); delete the junk `supabase/snippets/Untitled query 908.sql`. Run them to rebuild the test garden
  - `bunx supabase migration up` → `bun run types` → `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`
  - **Refresh `supabase/seed.sql`** after the drop — it still carries `perenual_id` INSERT columns; a stale replay during `bun run db-reset-safe` would fail against the new schema. Re-run the cache export (`supabase/scripts/export-botanical-seed.ts`) so `seed.sql` matches the post-drop columns
  - Verify in Studio SQL: `perenual_id` / `is_perenual_enriched` absent from both tables; `SELECT COUNT(*) FROM plants WHERE inat_taxon_id IS NOT NULL` matches the regenerated plant count

---

## Verification summary (per block)

| Block | Verification                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A     | Studio SQL column check on both tables                                                                                                                 |
| B     | PowerShell Invoke-RestMethod — ≥30 results, `inat_taxon_id` + `thumbnail_url` + English `preferred_common_name` present                                |
| C     | Manual cron trigger in Studio → DB record has `inat_taxon_id`                                                                                          |
| D     | Plant Identifier photo test → response JSON has both `perenual_id` and `inat_taxon_id`                                                                 |
| E     | `bun run test` passes; Network tab shows `inat_taxon_id` in plant create payload; `PlantIdResult` and `QueuedAction` both compile with `inat_taxon_id` |
| F     | Manual Browser Check — all 7 steps pass                                                                                                                |
| G     | Studio SQL — `inat_species_id` + `inat_rank` columns present on `cached_botanical_records`                                                             |
| H     | Search warms ≥30 cached rows carrying `inat_taxon_id` + `inat_species_id` + `inat_rank`; hybrid query returns `inat_rank = 'hybrid'`                   |
| I     | `bun run lint`; function returns `{ processed, remaining, absent }`                                                                                    |
| J     | Backfill loop to `remaining = 0`; `COUNT(*) WHERE inat_taxon_id IS NULL OR = -1` → 0; no duplicate `inat_taxon_id`                                     |
| K     | Library browser check — iNat varieties collapse into one card; `bun run test` passes                                                                   |
| L     | Library browser check — hybrid/variety shows correct rank badge, plain species shows none; `bun run test` passes                                       |
| M     | `Grep "perenual" src/app` returns zero functional hits; `bun run test` passes; Manual Browser Check — plant add + identifier both save iNat-only        |
| N     | Studio SQL — `perenual_id` / `is_perenual_enriched` gone from both tables; regenerated test garden loads; `plants.inat_taxon_id` populated             |
