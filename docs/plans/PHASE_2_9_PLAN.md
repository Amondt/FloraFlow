# Phase 2.9 — Journal Feed Plan

**Objective:** Build the journal feed at `/journal` — list all `plant_journals` entries for the authenticated user, grouped by plant and ordered by `logged_at DESC`, filterable by `log_category_type`, with photo thumbnails.

**Agent:** `/visualizer` (all blocks)

**No migration needed.** The `plant_journals` table is live. This is purely a frontend data-fetch + display task.

---

## Pre-build context

| Item | Location |
|---|---|
| Route | `src/app/app.routes.ts` — already registered |
| Shell component | `src/app/features/journal/journal.ts` — shell only, no feed yet |
| Entry form | `src/app/features/journal/journal-entry-form/` — creates entries, needs an `(entrySaved)` output added |
| Data service | `src/app/features/journal/journal.service.ts` — has `createEntry()` + `uploadImage()`; missing `loadEntries()` + URL helper |
| DB types | `src/types/database.types.ts` — `plant_journals` Row confirmed; all columns present |
| PT objects | `src/app/shared/ui/pt/index.ts` — `FloraSelectPT`, `FloraSkeletonPT`, `FloraTagPT`, `FloraMessagePT` available |

---

## Blocks

- [x] **Block A — Extend JournalService with a read layer** | Agent: `/visualizer`
  - Add `JournalEntryWithPlant` type: `plant_journals` Row extended with `plants: { common_name: string }`.
  - Add signals: `entries` (`JournalEntryWithPlant[]`), `loadingEntries` (`boolean`), `entriesError` (`string | null`).
  - Add `loadEntries()`: queries `plant_journals` with `.select('*, plants(common_name)')`, ordered by `logged_at DESC`; sets `entries` signal.
  - Add `getPublicUrl(path: string): string`: calls `supabase.client.storage.from('plant-journal-images').getPublicUrl(path).data.publicUrl` and returns it.
  - Verification: `bun run format && bun run lint`

- [x] **Block B — JournalEntryCardComponent** | Agent: `/visualizer`
  - New files: `src/app/features/journal/journal-entry-card/journal-entry-card.ts` + `.html`
  - Inputs: `entry` (`JournalEntryWithPlant`), `imageUrl` (`string | null`).
  - Template structure (`<article>`):
    - Category badge (`<span>` using token colors per category).
    - Plant name as a `routerLink="/scheduler"` link (no deep plant route exists yet).
    - `logged_at` formatted as a human-readable date string (no pipe — use `toLocaleDateString()`).
    - Notes paragraph (shown only if `entry.notes` is non-null).
    - `<img [src]="imageUrl" [alt]="…">` thumbnail (shown only if `imageUrl` is non-null).
  - Full ARIA: `aria-label` on the article, `alt` on every `<img>`.
  - Category color map (client-side constant): Observation → neutral, Watering → primary, Pruning → warning, Repotting → success, Fertilization → success, PestTreatment → danger.
  - Verification: `bun run format && bun run lint` + Manual Browser Check

- [x] **Block C — Wire up JournalComponent feed** | Agent: `/visualizer`
  - Add `(entrySaved)` output to `JournalEntryFormComponent`; emit after a successful `createEntry()` call.
  - In `JournalComponent`:
    - Call `journalService.loadEntries()` on init (alongside the existing `plantService.loadPlants()`).
    - Add `selectedCategory` signal (`log_category_type | null`, default `null`).
    - Add `filteredEntries` computed: filter `journalService.entries()` by `selectedCategory` (null = show all).
    - Add `entriesByPlant` computed: group `filteredEntries` by `plant_id`; each group is `{ plantName, entries[] }` sorted by the most recent `logged_at` in the group (newest group first).
    - Add `resolvedEntries` computed: map over `filteredEntries` to add `imageUrl` via `journalService.getPublicUrl()` when `image_storage_path` is non-null.
    - Listen for `(entrySaved)` from `JournalEntryFormComponent` and call `journalService.loadEntries()`.
  - Update `journal.html`:
    - Category filter `<p-select>` (FloraSelectPT) — options: All + each `log_category_type` label; two-way bound to `selectedCategory`.
    - Loading: 3× `<p-skeleton>` placeholders (FloraSkeletonPT) while `loadingEntries()` is true.
    - Error: `<p-message severity="error">` (FloraMessagePT) when `entriesError()` is non-null.
    - Empty state (no entries + no filter active): "No care events logged yet — click Log Care Event to record your first."
    - Empty state (filter active, no matches): "No [Category] entries found. Clear the filter to see all events."
    - Feed: `@for` over `entriesByPlant()`, each group rendered as a `<section>` with a plant-name heading and a `<ul>` of `<app-journal-entry-card>` items.
  - Verification: `bun run format && bun run lint` + Manual Browser Check

---

## Verification checklist (all blocks complete)

```powershell
bun run format
bun run lint
```

Manual Browser Check — Journal Feed
```
App running at: http://localhost:4200/journal

1. Navigate to /journal → page loads with "Care Journal" heading.
2. If no entries exist → empty state message is visible (no "Log Care Event" button crash).
3. Click "Log Care Event" → dialog opens, fill all fields, submit → entry appears in the feed without page reload.
4. Entry card shows: category badge, plant name, date, notes (if any).
5. Entry with a photo shows a thumbnail image; entry without a photo shows no image element.
6. Plant name link navigates to /scheduler.
7. Category filter → select "Watering" → only Watering entries shown; select "All" → all entries return.
8. Filter with no matches → filtered empty state message is shown.
9. Open DevTools Console → zero red errors.
```
