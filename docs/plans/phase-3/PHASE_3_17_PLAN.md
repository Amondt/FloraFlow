# Phase 3.17 — Species Photo Gallery (iNaturalist Carousel)

## Why this phase exists

The Botanical Detail dialog currently shows one species photo with a click-to-zoom lightbox. iNaturalist's `/v1/taxa/{id}` endpoint returns `taxon_photos[]` — typically 6–12 photos per species, curated by the iNaturalist community. Showing multiple photos gives users a richer visual reference (different growth stages, angles, cultivar differences) without any additional API cost or key.

**Depends on:** Phase 3.16 fully complete — `inat_taxon_id` must be populated on `cached_botanical_records` before the gallery fetch can run.

---

## iNaturalist gallery endpoint

```
GET https://api.inaturalist.org/v1/taxa/{inat_taxon_id}
```

Returns `taxon_photos[]`. Each element has `photo.medium_url` (~640 px wide). No API key required. Fair-use limit: 100 req/min — well within the 5-records/run enrichment worker cadence.

---

## What changes, what stays

**Changes:**
- DB: `gallery_urls TEXT[]` added to `cached_botanical_records`
- `_shared/enrich-record.ts`: new `fetchINatGallery()` helper + gallery step in `enrichRecord()`
- `inat-backfill` (from 3.16): extended to populate `gallery_urls` in the same pass as `inat_taxon_id`
- `botanical-detail-dialog`: lightbox removed, replaced by `SpeciesPhotoCarouselComponent`

**Stays the same:**
- `thumbnail_url` / `regular_url` — kept; library cards and zone detail cards keep their single image
- `cache-enrichment-worker` cron cadence — unchanged
- All other Edge Functions — no changes

---

## Blocks

- [ ] **Block A — DB migration + gallery fetch** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Migration: `gallery_urls TEXT[] NULL` on `cached_botanical_records`; comment: `-- Up to 6 medium-sized photo URLs from iNat taxon_photos[]; NULL = not yet fetched, {} = fetched but none available`
  - New helper in `_shared/enrich-record.ts`:
    ```ts
    async function fetchINatGallery(
      inatTaxonId: number,
      signal: AbortSignal,
    ): Promise<string[]> {
      const res = await fetch(
        `https://api.inaturalist.org/v1/taxa/${inatTaxonId}`,
        { signal },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        results?: Array<{
          taxon_photos?: Array<{
            photo?: { medium_url?: string; url?: string };
          }>;
        }>;
      };
      const photos = data?.results?.[0]?.taxon_photos ?? [];
      return photos
        .map((tp) => tp.photo?.medium_url ?? tp.photo?.url ?? '')
        .filter(Boolean)
        .slice(0, 6);
    }
    ```
  - `enrichRecord()` updated: after the existing Claude + thumbnail logic, when `inat_taxon_id` is known and `gallery_urls` is null, call `fetchINatGallery`; include `gallery_urls` in the upsert. Skip when `gallery_urls` is already non-null (any value, including `{}`) to avoid re-fetching.
  - `fetchINatThumbnail()` is unchanged — the gallery fetch is a separate step, not a replacement.
  - Extend `inat-backfill/index.ts` (Phase 3.16): after updating `inat_taxon_id`, call `fetchINatGallery(taxon.id, controller.signal)` and include `gallery_urls` in the same `UPDATE`. The existing 200ms delay is sufficient rate limiting.
  - Update `docs/DB_SCHEMA_MATRIX.md` — add `gallery_urls TEXT[] NULL` to the `cached_botanical_records` definition with the same comment as above.
  - Run `bunx supabase migration up`, then `bun run types`, then copy types to `_shared`
  - Run `bun run format && bun run lint`
  - Verify in Studio SQL: `SELECT gallery_urls FROM cached_botanical_records WHERE inat_taxon_id IS NOT NULL LIMIT 5;` — after triggering one enrichment cycle, at least one row should have a non-null `gallery_urls` array

- [ ] **Block B — Angular carousel** | Agent: `/visualizer` · Model: Sonnet · Effort: mid

  **Layout:** The identity strip changes from side-by-side (image + text) to **full-width stacked**: carousel on top, scientific name + description below it. This gives the photo room to breathe and matches the visual hierarchy of every botanical app (iNaturalist, PlantNet, RHS). The tabs and footer are unchanged.

  ```
  ┌────────────────────────────────────────┐  dialog header
  ├────────────────────────────────────────┤
  │ ◀  [  species photo — full width  ] ▶  │  h-48 (192px), relative container
  │           ●  ○  ○  ○  ○  ○   1 / 6    │  dots + counter below image
  ├────────────────────────────────────────┤
  │ Scientific name (italic, sm)           │
  │ Description text (sm, neutral-600)     │
  ├────────────────────────────────────────┤
  │ [tabs] Overview / Care / Growth / ...  │
  └────────────────────────────────────────┘
  ```

  - When **one photo**: static image, no arrows, no dots — identical to today, no regression.
  - When **zero photos**: leaf-icon block fills the `h-48` slot — same fallback, bigger slot.
  - Both `/library` and `/dashboard/zones/:id` get the carousel automatically — `BotanicalDetailDialogComponent` is already mounted in both routes; no routing work needed.

  **`CachedBotanicalRecord`** in `src/app/features/library/library.service.ts`: add `gallery_urls: string[] | null`

  **New component** `src/app/shared/components/species-photo-carousel/species-photo-carousel.ts`:
  - Inputs: `photos = input<string[]>([])`, `altText = input<string>('')`
  - `activeIndex = signal(0)` — resets to 0 when `photos` length changes (via `effect`)
  - `hasMultiple = computed(() => photos().length > 1)`
  - `hasPrev = computed(() => activeIndex() > 0)`
  - `hasNext = computed(() => activeIndex() < photos().length - 1)`
  - `prev()` / `next()` — clamp to array bounds
  - Template:
    - Outer wrapper: `relative w-full h-48 rounded-garden-md overflow-hidden bg-neutral-100 dark:bg-neutral-800`
    - `<img>` fills the wrapper: `absolute inset-0 w-full h-full object-cover`; `loading="lazy"`; `[src]="photos()[activeIndex()]"` when photos non-empty
    - Leaf-icon fallback: `@if (photos().length === 0)` — centred inside wrapper
    - Prev/next buttons: `@if (hasMultiple())` — overlaid on left/right sides; `absolute top-1/2 -translate-y-1/2`; `cursor-pointer`; semi-transparent bg (`bg-neutral-900/40`); `[disabled]` at boundary; `aria-label`
    - Dot indicators + counter: `@if (hasMultiple())` — below image in a `flex items-center justify-center gap-1` row; dots are `w-1.5 h-1.5 rounded-full`; active dot `bg-white`, inactive `bg-white/40`; counter `text-xs text-white/70 ml-2` showing `activeIndex() + 1 / photos().length`
    - All interactive elements: `cursor-pointer`, `outline-none focus-visible:ring-2 focus-visible:ring-primary-500`
  - Imports: `LeafIconComponent`

  **`botanical-detail-dialog.ts`:**
  - Remove: `showLightbox` signal, `lightboxUrl` computed, `lightboxEl` viewChild, both lightbox-related `effect()` calls, `ElementRef` import
  - Add: `galleryPhotos = computed(() => { const rec = this.activeRecord(); if (!rec) return []; const urls = new Set<string>(); if (rec.regular_url) urls.add(rec.regular_url); for (const u of rec.gallery_urls ?? []) if (u) urls.add(u); return [...urls]; })`
  - Import `SpeciesPhotoCarouselComponent`

  **`botanical-detail-dialog.html`** — identity strip rewrite:
  - Replace the `flex items-start gap-4` block (image button + text side-by-side) with stacked layout:
    - `<app-species-photo-carousel [photos]="galleryPhotos()" [altText]="rec.common_name" />` — full width, `mb-3`
    - Below the carousel: scientific name `<p>` and description `<p>` — same content, now stacked instead of beside the image
  - Remove the `@else` leaf-icon block — the carousel handles the empty-photos case internally
  - Remove the lightbox `@if (showLightbox()…)` block at the bottom of the `@if (activeRecord())` section

  Run `bun run format && bun run lint`

  Manual Browser Check — Block B
  ────────────────────────────────
  App running at: http://localhost:4200/library
  1. Open any species with a `regular_url` — full-width photo fills the top of the dialog; scientific name and description appear below; no zoom button visible
  2. After populating `gallery_urls` for a species via Studio SQL (`UPDATE cached_botanical_records SET gallery_urls = ARRAY['url1','url2','url3'] WHERE scientific_name = 'Monstera deliciosa'`), reopen the dialog — prev/next arrows appear overlaid on the photo; dots show below with a `1 / 3` counter
  3. Click ▶ — photo changes; active dot updates; counter advances; ▶ disables at last photo
  4. Click ◀ — photo steps back; ◀ disables at first photo
  5. Open a species with no photos — `h-48` leaf-icon block appears; no arrows or dots
  6. Navigate to `/dashboard/zones/:id` → click "Species info" on a plant that has a botanical record — same carousel appears in the zone-detail dialog with no code change
  7. Open DevTools Console → zero red errors on both routes

---

## Verification summary

| Block | Verification |
|---|---|
| A | Studio SQL: `gallery_urls` column exists; after one enrichment run, at least one non-null `gallery_urls` array |
| B | Manual Browser Check — all 5 items pass |
