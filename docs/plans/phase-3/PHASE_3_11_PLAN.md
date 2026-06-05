# Phase 3.11 Plan — Plant Species Thumbnails (iNaturalist)

Depends on: Phase 3.10 Block C (identity strip image slot already built in the botanical detail dialog).

---

## Source decision

Perenual's free tier returns a paywall placeholder (`upgrade_access.jpg`) for every image URL. Images are fetched from **iNaturalist** instead — free, no API key, excellent plant coverage, stable S3-hosted CDN URLs.

iNaturalist endpoint used during AI Scribe enrichment:
```
GET https://api.inaturalist.org/v1/taxa?q={scientific_name}&rank=species&per_page=1
```

Response fields stored:
- `results[0].default_photo.url` → `thumbnail_url` (75 × 75 px square crop)
- `results[0].default_photo.medium_url` → `regular_url` (~500 px, used in the detail dialog)

Both fields stay `null` when iNaturalist returns no match — never crashes enrichment.

---

## Re-enrichment

The iNaturalist fetch runs in the existing AI Scribe (`claude-enrichment`) enrichment pass. The cache sentinel and the client-side filter are each extended with `thumbnail_url != null`, so:
- All previously enriched records (Phase 3.1 / 3.10) that lack a thumbnail automatically re-queue.
- No separate backfill script needed — the re-enrichment logic from Phase 3.10 carries over.

---

## Surfaces covered

| Surface | Field | Data source in Angular |
|---|---|---|
| Botanical detail dialog — identity strip | `regular_url` | `record()` input |
| Library search card | `thumbnail_url` | `record` input |
| Zone detail plant card | `thumbnail_url` | `enrichedRecordFor(scientific_name)` via existing `botanicalMap` |

Scheduler card and dashboard chip thumbnails are not in scope — those surfaces don't currently load botanical records and would require a separate data-layer block.

---

## Blocks

- [ ] **Block A — DB Migration: Image URL Columns** | Agent: `/plumber`
  - New migration: `ADD COLUMN IF NOT EXISTS thumbnail_url TEXT` and `ADD COLUMN IF NOT EXISTS regular_url TEXT` on `cached_botanical_records`.
  - Run `bunx supabase migration up` then `bun run types`.
  - Copy types: `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`.
  - Verification: `SELECT column_name FROM information_schema.columns WHERE table_name = 'cached_botanical_records' AND column_name IN ('thumbnail_url', 'regular_url');` — confirm both rows present.

- [ ] **Block B — AI Scribe: Parallel iNaturalist Fetch** | Agent: `/plumber`
  - In `supabase/functions/claude-enrichment/index.ts`, run the Claude call and the iNaturalist fetch in parallel with `Promise.all`.
  - iNaturalist response: `results[0]?.default_photo?.url` → `thumbnail_url`, `results[0]?.default_photo?.medium_url` → `regular_url`. Both nullable — on any error or empty result, store `null`.
  - Add both fields to the upsert payload.
  - Extend the cache sentinel: add `&& cached?.thumbnail_url != null` to the early-return guard.
  - Update client-side re-enrichment filter in `src/app/features/library/library.ts`: add `|| r.thumbnail_url == null` to the `needsEnrichment` predicate and the poll's "still pending" check.
  - Verification: invoke enrichment locally against `Monstera deliciosa` (or a plant not yet in the DB) — confirm `thumbnail_url` and `regular_url` are real CDN URLs (not null and not the Perenual upgrade_access placeholder).

- [ ] **Block C — UI: Wire Images Across Surfaces** | Agent: `/visualizer`
  - **Botanical detail dialog** (`botanical-detail-dialog.html`): in the identity strip, replace the leaf icon container with `@if (rec.regular_url)` showing `<img>` + `@else` showing the leaf icon. `<img>` attrs: `[src]="rec.regular_url"`, `[alt]="rec.common_name"`, `loading="lazy"`, `class="w-20 h-20 rounded-garden-md object-cover"`.
  - **Library card** (`botanical-record-card.html`): add a square thumbnail in the top-right of the card (or alongside the name) using `thumbnail_url` with the same leaf icon fallback.
  - **Zone detail plant card** (`zone-detail.html`): add a small thumbnail using `enrichedRecordFor(ep.plant.scientific_name)?.thumbnail_url` with leaf icon fallback.
  - All `<img>` elements: `loading="lazy"`, descriptive `[alt]`, `object-cover` on the card thumbnails.
  - Manual Browser Check: open Library after a new enrichment — confirm image appears in the card and in the identity strip. Confirm leaf icon shows for plants without `regular_url`/`thumbnail_url`. Open DevTools Network — images load lazily (not in initial request). Zero console errors.
