# Phase 3.16 — iNaturalist Migration & Botanical Cache Hardening

## Why this phase exists

Perenual's free tier is hard-capped at species IDs 1–3,000 (~37 results for any search). The iNaturalist taxa API is free, requires no API key, covers 10M+ species, and returns `preferred_common_name` + `default_photo` inline — eliminating the separate thumbnail-fetch pass that enrichment currently performs.

**What stays the same:**
- `cached_botanical_records` is still the plant encyclopedia; PK is `scientific_name`
- `cache-enrichment-worker` pg_cron job (every 10 min) is unchanged
- Once `is_ai_enriched = true`, the AI Scribe never runs for that record again
- All search paths hit the local cache first; the external call fires only on cache miss
- `perenual_id` and `is_perenual_enriched` columns are kept — they hold valid data for records enriched before this migration
- `claude-vision` (AI Leaf Doctor) — **no changes needed**. It receives an image, calls Claude, and returns health diagnostics. It has zero interaction with `cached_botanical_records`, `perenual_id`, or `inat_taxon_id`. Completely isolated from the botanical cache.

**What changes:**
- `botanical-search` Edge Function: single iNat call replaces the 5-page Perenual loop
- `_shared/enrich-record.ts`: skips iNat thumbnail fetch when already populated from search; populates `inat_taxon_id` from all enrichment paths
- `claude-plant-id`: returns `inat_taxon_id`; inserts a stub record for newly identified species so the cron picks them up
- Angular layer: `inat_taxon_id` threaded through every model, service, and form dialog that touches `perenual_id`
- Library: enrichment triggers only for the currently visible page, not the full 1,000-record result set

---

## iNaturalist Taxa API — field mapping reference

```
GET https://api.inaturalist.org/v1/taxa?q={q}&taxon_id=47126&rank=species&per_page=30&locale=en
```

`taxon_id=47126` = Plantae kingdom. `locale=en` forces English `preferred_common_name` regardless of server locale — confirmed via live API call. No API key required.

| iNat field | Our column |
|---|---|
| `results[n].id` | `inat_taxon_id` |
| `results[n].name` | `scientific_name` |
| `results[n].preferred_common_name ?? results[n].name` | `common_name` (apply `toSentenceCase`) |
| `results[n].default_photo.url` | `thumbnail_url` |
| `results[n].default_photo.medium_url` | `regular_url` |

`preferred_common_name` is absent for some obscure taxa — fall back to `name` (the scientific name).

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
    const inat = (cached?.thumbnail_url && cached?.thumbnail_fetched)
      ? { taxon_id: cached?.inat_taxon_id ?? null, thumbnail_url: cached.thumbnail_url, regular_url: cached.regular_url ?? null }
      : await fetchINatThumbnail(scientificName, commonName);
    ```
  - Full path upsert: add `inat_taxon_id: inat.taxon_id ?? cached?.inat_taxon_id ?? null`; keep `thumbnail_url: inat.thumbnail_url`, `regular_url: inat.regular_url`, `thumbnail_fetched: true` — unchanged
  - Thumbnail-only path (AI-enriched, thumbnail missing): add `inat_taxon_id: inat.taxon_id ?? null` to the `.update()` call
  - **`thumbnail_fetched` is kept** — it is still the infinite-retry guard for species absent from iNaturalist's photo database. Without it, any species where `default_photo` is null would re-trigger `fetchINatThumbnail` on every enrichment call. After Phase 3.16, Block B sets `thumbnail_fetched = true` at search time for all iNat-returned species; the cron's thumbnail-only path sets it for old Perenual records when they are eventually enriched. Update the column comment in the migration file to reflect these new semantics.
  - Run `bun run format && bun run lint`
  - Verify: trigger `cache-enrichment-worker` manually in Studio. Confirm the updated record has `inat_taxon_id` populated.

- [ ] **Block D — Update `claude-plant-id/index.ts` & `AI_PROMPT_MANIFEST.md §2.3`** | Agent: `/plumber` · Model: Sonnet · Effort: mid
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

- [ ] **Block G — iNat species backfill & library grouping refactor** | Agent: `/plumber` + `/visualizer` · Model: Sonnet · Effort: high

  **Why this block exists:** the 924 existing records were stored by Perenual with inconsistent scientific names — cultivar suffixes (`'Marble Queen'`, `'Variegata'`) are included as part of `scientific_name`. The current grouping util works around this by grouping by `common_name`, which Perenual also made inconsistent. iNaturalist uses canonical species-level binomials. Grouping by `inat_taxon_id` is authoritative: two records with the same taxon ID are definitively the same species, regardless of what Perenual named them.

  **Plumber — one-shot backfill Edge Function (`supabase/functions/inat-backfill/index.ts`):**
  - Auth: standard user JWT (user-facing, runs once)
  - Query: `SELECT scientific_name, common_name, thumbnail_url, regular_url FROM cached_botanical_records WHERE inat_taxon_id IS NULL LIMIT 50`
  - For each record:
    - Strip cultivar suffix: `const baseName = scientificName.split("'")[0].trim()`
    - Call `GET https://api.inaturalist.org/v1/taxa?q={baseName}&rank=species&per_page=1&locale=en`
    - If result found: `UPDATE cached_botanical_records SET inat_taxon_id = taxon.id, thumbnail_url = COALESCE(existing_url, taxon.default_photo?.url), regular_url = COALESCE(existing_url, taxon.default_photo?.medium_url), thumbnail_fetched = true WHERE scientific_name = record.scientific_name`
    - If not found: leave record unchanged (grouping falls back to `common_name`)
  - Rate limit: `await delay(200)` between calls to respect iNat fair-use (~5 req/sec)
  - Return `{ processed: N, remaining: M }` — user calls the function repeatedly until `remaining = 0`
  - At 50 records/call × 200ms throttle: each invocation takes ~10s; ~924 records / 50 = ~19 calls to complete
  - Run `bun run format && bun run lint`
  - Trigger via PowerShell until done:
    ```powershell
    do {
      $r = Invoke-RestMethod -Uri "http://127.0.0.1:54321/functions/v1/inat-backfill" `
        -Method POST -Headers @{ Authorization = "Bearer <anon-key>" }
      Write-Host "processed $($r.processed), remaining $($r.remaining)"
    } while ($r.remaining -gt 0)
    ```
  - Verify in Studio SQL: `SELECT COUNT(*) FROM cached_botanical_records WHERE inat_taxon_id IS NULL;` — should be 0 or very close (only truly iNat-absent species remain)

  **Visualizer — grouping util refactor (`src/app/shared/utils/group-botanical-records.util.ts`):**
  - Change grouping key from `common_name.toLowerCase()` → `record.inat_taxon_id ?? record.common_name.toLowerCase().trim()`
    - Records with the same `inat_taxon_id` collapse into one `SpeciesGroup` — cultivar cards correctly merged
    - Records without `inat_taxon_id` fall back to `common_name` grouping (backward compat during partial backfill)
  - Add `inatTaxonId: number | null` to `SpeciesGroup` interface — set from `representative.inat_taxon_id`
  - Run `bun run format && bun run lint && bun run test`
  - Manual Browser Check — Block G
    ────────────────────────────────
    App running at: http://localhost:4200/library
    1. Search "pothos" — "Epipremnum aureum" and all its cultivars ("Marble Queen", "Golden Pothos" etc.) must appear as **one card** with a variety count badge, not separate cards
    2. Click the card → detail dialog shows all cultivars in the varieties section
    3. Search a single-cultivar species (e.g. "monstera") → shows one card, no variety badge
    4. Open DevTools Console → zero red errors

- [ ] **Block E — Angular models & services** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
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

- [ ] **Block F — Form dialogs & Library per-page enrichment** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
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

---

## Verification summary (per block)

| Block | Verification |
|---|---|
| A | Studio SQL column check on both tables |
| B | PowerShell Invoke-RestMethod — ≥30 results, `inat_taxon_id` + `thumbnail_url` + English `preferred_common_name` present |
| C | Manual cron trigger in Studio → DB record has `inat_taxon_id` |
| D | Plant Identifier photo test → response JSON has both `perenual_id` and `inat_taxon_id` |
| G (plumber) | Backfill loop runs to `remaining = 0`; Studio SQL `COUNT(*) WHERE inat_taxon_id IS NULL` ≈ 0 |
| G (visualizer) | Library browser check — cultivars collapse into one card; `bun run test` passes |
| E | `bun run test` passes; Network tab shows `inat_taxon_id` in plant create payload; `PlantIdResult` and `QueuedAction` both compile with `inat_taxon_id` |
| F | Manual Browser Check — all 7 steps pass |
