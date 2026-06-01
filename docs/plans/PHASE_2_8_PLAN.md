# Phase 2.8 — Plant Browser & Botanical Wiki

Agents: `/plumber` → `/visualizer` → `/visualizer` → `/visualizer`

Browse-over-cache, filter-first design. No new Edge Function and no new migration — `cached_botanical_records` and `botanical-search` already exist. The library builds on them.

---

## Overview

```
Library page
  ├── Filter bar (watering, sunlight, toxicity, lifecycle)
  ├── Optional name search (≥ 2 chars)
  │     └── calls botanical-search EF → populates cache → returns scientific names
  ├── Results grid
  │     └── queries cached_botanical_records with active filters
  ├── Species detail panel (right-side expansion)
  │     └── shows pH range, propagation_methods, toxicity, watering, sunlight, cycle
  └── "Add to my greenhouse" button
        └── opens PlantFormDialogComponent pre-filled with common_name, scientific_name, perenual_id
```

**Filter → DB mapping:**

| Filter control      | Column                          | Query operator                 |
| ------------------- | ------------------------------- | ------------------------------ |
| Watering frequency  | `watering` (TEXT)               | `.eq()`                        |
| Sunlight            | `sunlight` (TEXT[])             | `.contains()` (array contains) |
| Pet toxicity toggle | `is_toxic_to_pets` (BOOL\|null) | `.is()` / `.eq()`              |
| Lifecycle type      | `cycle` (TEXT)                  | `.eq()`                        |

Default (no search, no filters): returns all `cached_botanical_records` where `is_perenual_enriched = true`, ordered by `cached_at DESC`, limit 50.

Name search path: `BotanicalSearchService.search()` → `botanical-search` EF handles cache miss → Perenual + AI Scribe chain. After the call resolves, the library re-queries `cached_botanical_records` for the returned scientific names + applies active filters.

---

## Blocks

- [x] **Block A — LibraryService** | Agent: `/plumber`
  - New file: `src/app/features/library/library.service.ts`
  - `providedIn: 'root'`
  - `LibraryFilters` interface: `{ watering?: string; sunlight?: string; is_toxic_to_pets?: boolean | null; cycle?: string }`
  - Exported option-list constants (used by both service and template):
    - `WATERING_OPTIONS`: `['Frequent', 'Average', 'Minimum', 'None']`
    - `SUNLIGHT_OPTIONS`: `['full sun', 'part shade', 'full shade']`
    - `CYCLE_OPTIONS`: `['Perennial', 'Annual', 'Biennial', 'Biannual']`
  - `browse(filters: LibraryFilters): Promise<CachedBotanicalRecord[]>`
    - Queries `cached_botanical_records` where `is_perenual_enriched = true`
    - Applies each non-null filter in sequence (skip if the filter value is null/undefined)
    - Orders by `cached_at DESC`, limit 50
    - Returns the row array (empty array on no results — never throws)
  - `search(query: string, filters: LibraryFilters): Promise<CachedBotanicalRecord[]>`
    - Calls `BotanicalSearchService.search(query)` — returns `BotanicalSuggestion[]`
    - Extracts `scientific_name` list from suggestions
    - If list is empty, returns `[]`
    - Queries `cached_botanical_records` where `scientific_name IN (list)` + same filter logic as `browse()`
    - Returns filtered full records
  - `CachedBotanicalRecord` = `Database['public']['Tables']['cached_botanical_records']['Row']` (re-exported for templates)

- [x] **Block B — Library Page** | Agent: `/visualizer`
  - Replace stub in `src/app/features/library/library.ts`
  - Imports: `LibraryService`, `BotanicalSearchService`, `LibraryFilters`, option-list constants, PT objects, `FormsModule`, `SkeletonModule`
  - Signals:
    - `filters = signal<LibraryFilters>({})`
    - `searchQuery = signal('')`
    - `results = signal<CachedBotanicalRecord[]>([])`
    - `isLoading = signal(false)`
    - `selectedRecord = signal<CachedBotanicalRecord | null>(null)`
    - `showAddDialog = signal(false)`
    - `prefillRecord = signal<{ common_name: string; scientific_name: string | null; perenual_id: number | null } | null>(null)`
  - `effect()` that reacts to `filters` + `searchQuery`:
    - Debounce: uses `afterNextRender()` pattern — not needed here; use a plain `effect()` with a 300 ms `setTimeout` guard stored in a local ref (reset on each fire)
    - If `searchQuery()` has ≥ 2 chars: calls `libraryService.search(searchQuery(), filters())`
    - Otherwise: calls `libraryService.browse(filters())`
    - Sets `isLoading(true)` before, `isLoading(false)` after (always, via `finally`)
  - Template structure:
    - Eyebrow header: "Botanical Registry" / "Plant Browser" (standard header pattern — management page)
    - Filter bar: four PrimeNG `<p-select>` controls (watering, sunlight, lifecycle) + one `<p-toggleswitch>` or checkbox for toxicity + plain `<input pInputText>` for name search
    - Clearing a filter resets its signal key to `undefined`
    - Results: `@if (isLoading())` → 6 skeleton cards; `@else if (!results().length)` → empty state; `@else` → grid of `<app-botanical-record-card>`
    - Grid layout: `grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4` (feature overview grid pattern)
    - Card click → `selectedRecord.set(record)` → detail panel opens
    - Species detail panel rendered inline below the grid (not a dialog) — `@if (selectedRecord())` block
    - "Add to my greenhouse" button inside detail panel: sets `prefillRecord` + `showAddDialog.set(true)`
    - `<app-plant-form-dialog [(visible)]="showAddDialog" [botanicalPrefill]="prefillRecord()" />`
  - On init: call `libraryService.browse({})` to pre-populate with cached records

- [x] **Block C — AI Scribe: Filter Field Enrichment** | Agent: `/plumber`
  - Extend `EnrichmentSchema` in `supabase/functions/claude-enrichment/index.ts`:
    - `watering`: `z.enum(['Frequent', 'Average', 'Minimum', 'None']).nullable()`
    - `sunlight`: `z.array(z.enum(['full_sun', 'part_shade', 'full_shade', 'filtered_indirect'])).nullable()`
    - `cycle`: `z.enum(['Perennial', 'Annual', 'Biennial', 'Biannual']).nullable()`
  - Extend the system prompt to instruct Claude to use only the exact enum values above; return `null` if the species is unknown or ambiguous.
  - Update the upsert: write `watering`, `sunlight`, `cycle` **conditionally** — only set each field when the existing DB row has it as `null` (preserves any Perenual data already present).
  - Update the re-enrichment guard: change `if (cached?.is_ai_enriched) return json(cached)` to also require `cached?.watering && cached?.cycle` — so records enriched before this block ship will get a second pass.
  - Correct the `SUNLIGHT_OPTIONS` constant in `src/app/features/library/library.service.ts` to match the canonical snake_case format: `['full_sun', 'part_shade', 'full_shade', 'filtered_indirect']` (aligns with what Perenual writes; no Perenual ingest change needed).
  - Update `AI_PROMPT_MANIFEST.md` §1.2 to include `watering`, `sunlight`, `cycle` in the JSON schema definition.

- [x] **Block D — Botanical Record Card** | Agent: `/visualizer` ✅
  - New file: `src/app/features/library/botanical-record-card/botanical-record-card.ts`
  - `record = input.required<CachedBotanicalRecord>()`
  - `selected = input<boolean>(false)`
  - `select = output<void>()`
  - Template (`<article role="button" [attr.aria-selected]="selected()" tabindex="0">`):
    - Common name (bold), scientific name (italic, muted)
    - Badge row: watering badge, toxicity badge (`is_toxic_to_pets === true` → "Toxic" danger; `false` → "Pet-safe" success; `null` → omit)
    - Keyboard: `(keydown.enter)="select.emit()"` + `(keydown.space)="select.emit()"`
    - Click: `(click)="select.emit()"`
    - Selected ring: `[class.ring-2]="selected()"` using `ring-primary-500`
  - Species detail panel lives in the parent (`library.ts`) — not inside the card — to avoid duplication across the grid

- [x] **Block E — Add to Greenhouse Integration** | Agent: `/visualizer`
  - Modify `src/app/features/scheduler/plant-form-dialog/plant-form-dialog.ts`:
    - Add `botanicalPrefill = input<{ common_name: string; scientific_name: string | null; perenual_id: number | null } | null>(null)`
    - In the existing `effect()`: when `justOpened && !p && this.botanicalPrefill()`, apply prefill:
      - `this.commonNameQuery = prefill.common_name`
      - `this.selectedPerenualId.set(prefill.perenual_id)`
      - `this.form.patchValue({ common_name: prefill.common_name, scientific_name: prefill.scientific_name })`
    - Only runs on dialog open; does not interfere with the edit-plant path
  - Library template: pass `[botanicalPrefill]="prefillRecord()"` to `<app-plant-form-dialog>`
  - `PlantFormDialogComponent` must be imported into `library.ts` imports array

---

## Verification

After Block A:

```powershell
bun run format
bun run lint
```

Confirm `LibraryService` compiles with zero type errors.

After Block B (Manual Browser Check):

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Library Page
─────────────────────────────────────────────
App running at: http://localhost:4200/library

1. Navigate to /library → confirm skeleton cards show briefly, then results grid (or empty state if cache is empty).
2. Select a watering filter → confirm results update.
3. Type ≥ 2 chars in the name search field → confirm results update (may be slower — hits botanical-search EF).
4. Clear search → confirm browse() is called again (results reset to unfiltered cache).
5. Click a result card → confirm detail panel appears below the grid.
6. Open DevTools Console → confirm zero red errors.
```

After Block C:

```powershell
bun run format
bun run lint
```

DB verification — query the cache after searching for any plant in the Library:
```sql
SELECT scientific_name, watering, sunlight, cycle, is_ai_enriched
FROM cached_botanical_records
WHERE watering IS NOT NULL
LIMIT 5;
```
Confirm at least some rows have non-null watering and cycle values.

After Block D (Manual Browser Check):

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Botanical Record Card
─────────────────────────────────────────────
App running at: http://localhost:4200/library

1. Hover a card → confirm it is visually distinct (hover state).
2. Tab to a card and press Enter → confirm detail panel opens (keyboard accessible).
3. A card with is_toxic_to_pets = true → confirm "Toxic" danger badge.
4. A card with is_toxic_to_pets = false → confirm "Pet-safe" success badge.
5. A card with is_toxic_to_pets = null → confirm no toxicity badge shown.
```

After Block E (Manual Browser Check):

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Add to Greenhouse
─────────────────────────────────────────────
App running at: http://localhost:4200/library

1. Click a botanical record card → detail panel opens.
2. Click "Add to my greenhouse" → Add Plant dialog opens.
3. Confirm common_name and scientific_name fields are pre-filled from the selected species.
4. Confirm the form is valid (no red error borders on the pre-filled fields).
5. Submit the form → confirm plant is saved and appears in the Scheduler.
6. Open DevTools Console → confirm zero red errors.
```
