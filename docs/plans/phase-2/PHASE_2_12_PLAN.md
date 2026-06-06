# Phase 2.12 — Species Grouping in Library

## Goal

Group library search and filter results by common name. Multi-cultivar species collapse into one card. The botanical detail dialog gains a cultivar picker that updates all content in-place; "Add to my greenhouse" and "Track seeds" always act on the currently selected cultivar.

## No DB migration — pure client-side transformation

All grouping is a `computed()` over the existing `results()` signal. The DB query and enrichment pipeline are unchanged.

## Files touched

| File                                                                             | Change                                                                                                                                                    |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEW `src/app/shared/utils/group-botanical-records.util.ts`                       | `SpeciesGroup` type + pure `groupBotanicalRecords()` function                                                                                             |
| `src/app/features/library/library.ts`                                            | `groupedResults`, `selectedGroupKey`, `dialogRecords` signals; remove `selectedRecord`; remove explicit dialog update from poll callback                  |
| `src/app/features/library/library.html`                                          | Iterate `groupedResults()`, pass `varietyCount`, bind `[records]="dialogRecords()"`                                                                       |
| `src/app/features/library/botanical-record-card/botanical-record-card.ts`        | Add `varietyCount: input<number>(1)`; update `ariaLabel`                                                                                                  |
| `src/app/features/library/botanical-record-card/botanical-record-card.html`      | Variety count badge                                                                                                                                       |
| `src/app/shared/components/botanical-detail-dialog/botanical-detail-dialog.ts`   | Rename `record` → `records: input<CachedBotanicalRecord[]>([])`, add `selectedVarietyIndex` + `activeRecord`; update all computeds; cultivar picker logic |
| `src/app/shared/components/botanical-detail-dialog/botanical-detail-dialog.html` | Cultivar picker section in identity strip                                                                                                                 |
| `src/app/features/dashboard/zone-detail/zone-detail.ts`                          | Wrap `activeSpeciesRecord()` in single-element array                                                                                                      |
| `src/app/features/dashboard/zone-detail/zone-detail.html`                        | `[record]` → `[records]` binding                                                                                                                          |

---

## Blocks

- [x] **Block A — `SpeciesGroup` type + `groupBotanicalRecords()` utility** | Agent: `/visualizer`
  - Create `src/app/shared/utils/group-botanical-records.util.ts`
  - Export `SpeciesGroup` interface: `{ commonName: string; baseScientificName: string; representative: CachedBotanicalRecord; varieties: CachedBotanicalRecord[] }`
  - `baseScientificName`: everything before the first `'` in `representative.scientific_name`, trimmed (e.g. `"Physocarpus opulifolius 'Donna May'"` → `"Physocarpus opulifolius"`)
  - Grouping key: `record.common_name.toLowerCase().trim()` — each unique value is one group
  - `representative` selection: prefer the record whose `scientific_name` contains no `'` (base species); if all records in a group are cultivars, prefer the record with the most filled fields (`description != null` and `thumbnail_url != null`)
  - Varieties sort: base species (no `'`) first, then remaining cultivars sorted alphabetically by `scientific_name`
  - Groups sort: by `commonName` ascending (stable, predictable order for the user)
  - Pure function — no side effects, no Angular dependencies

- [x] **Block B — LibraryComponent: groupedResults + reactive dialog binding** | Agent: `/visualizer`
  - Add `readonly groupedResults = computed(() => groupBotanicalRecords(this.results()))` — derived from the existing `results()` signal, so enrichment poll updates flow through automatically
  - Replace `selectedRecord: signal<CachedBotanicalRecord | null>` with `selectedGroupKey: signal<string[] | null>(null)` — stores the `scientific_name` array of the selected group's varieties (serves as a stable key that survives enrichment refreshes)
  - Add `readonly dialogRecords = computed((): CachedBotanicalRecord[] => { const keys = this.selectedGroupKey(); if (!keys) return []; const keySet = new Set(keys); return this.results().filter(r => keySet.has(r.scientific_name)); })` — the dialog's record list is live-derived from `results()`, so enrichment updates automatically reach the open dialog without any explicit push
  - Replace `detailVisible = computed(() => this.selectedRecord() !== null)` with `detailVisible = computed(() => this.selectedGroupKey() !== null)`
  - Add `protected openGroup(group: SpeciesGroup): void` — sets `selectedGroupKey` to `group.varieties.map(v => v.scientific_name)`
  - Update `onDetailClose` to call `this.selectedGroupKey.set(null)`
  - Remove the explicit `selectedRecord.set(refreshedRec)` block from the `_load()` poll callback — `dialogRecords` is now reactive and no longer needs a manual push
  - Update `openAddDialog` — it currently takes a single `CachedBotanicalRecord` (called from the dialog's `addRequested` event); no change needed here since the event already carries the correct cultivar record
  - Update `onSeedsRequested` similarly — event carries the selected cultivar record
  - **Results count label** — replace `{{ totalCount() }} species found` with `{{ groupedResults().length }} species`: showing the raw DB record count (which includes all cultivar variants) alongside the grouped card view creates a mismatch the user cannot reconcile. `groupedResults().length` always equals the number of cards on screen. The pagination widget independently communicates that more pages exist — the count label does not need to carry that burden.

- [x] **Block C — BotanicalRecordCardComponent: variety count badge** | Agent: `/visualizer`
  - Add `readonly varietyCount = input<number>(1)` to the component
  - Update `ariaLabel` computed: when `varietyCount() > 1`, append `", ${varietyCount()} varieties"` to the aria label
  - Template: add a small badge in the top-right corner of the card — shown only when `varietyCount() > 1`
  - Badge style: `text-xs font-semibold font-display px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 border border-primary-200 dark:border-primary-700` — label: `"N varieties"`
  - In `library.html`: iterate `groupedResults()` instead of `results()`, pass `[record]="group.representative"` and `[varietyCount]="group.varieties.length"` and `[isEnriching]` derived from whether any variety in the group is in `enrichingNames()`

- [x] **Block D — BotanicalDetailDialogComponent: records input + cultivar picker** | Agent: `/visualizer`
  - Rename input `record` → `records: input<CachedBotanicalRecord[]>([])` (breaking change — all consumers updated in this block)
  - Add `readonly selectedVarietyIndex = signal<number>(0)`
  - Add `readonly activeRecord = computed(() => this.records()[this.selectedVarietyIndex()] ?? null)` — replaces all references to `this.record()` in existing computeds (`difficultyClass`, `maintenanceLevelClass`, `placementClass`, `growthRateClass`, `sunlightLabels`, `wateringLabel`, `preferredSoilTypes`, `lightboxUrl`)
  - Add `protected readonly hasVarieties = computed(() => this.records().length > 1)`
  - Add `protected readonly cultivarChips = computed(() => this.records().map((r, i) => ({ index: i, label: extractCultivarLabel(r.scientific_name), title: r.scientific_name ?? '' })))` — `extractCultivarLabel()` is a module-level pure function: if the name contains `'`, return the text between the first `'...'` pair (the cultivar epithet); otherwise return the species epithet (the last word before any `'`)
  - Add `protected readonly showChipStrip = computed(() => this.hasVarieties() && this.records().length <= 5)`
  - Add `protected readonly showDropdown = computed(() => this.hasVarieties() && this.records().length > 5)`
  - Tab reset logic: existing `_lastScientificName` tracking — change to track the first record's `scientific_name`; when it changes, reset `selectedVarietyIndex` to `0` and close lightbox
  - Template: insert a cultivar picker section between the identity strip (image + name) and the content tab row — shown only when `hasVarieties()`; chip strip when `showChipStrip()`, `<select>` dropdown when `showDropdown()`; active chip styled with `tabClass(true)` equivalent
  - `onAdd()` and `onSaveToSeeds()` emit `this.activeRecord()` — emit only when non-null
  - **zone-detail consumer**: change `[record]="activeSpeciesRecord()"` → `[records]="activeSpeciesRecord() ? [activeSpeciesRecord()!] : []"`; the dialog shows no cultivar picker (length = 1), behaviour unchanged for zone-detail users

---

## Verification

```powershell
bun run format
bun run lint
```

Manual Browser Check — Library Species Grouping
────────────────────────────────────────────────
App running at: http://localhost:4200/library

1. Search "phys" → results show grouped cards; multiple Ninebark cultivars collapse into one "Ninebark" card with an "N varieties" badge
2. Click the Ninebark card → dialog opens; cultivar picker strip appears below the image/scientific name row; no extra tab is added to Overview/Care/Growth/Safety
3. Click a cultivar chip → scientific name in the header updates; Overview tab content updates to reflect the selected cultivar
4. Click "Add to my greenhouse" → plant form pre-fills with the currently selected cultivar's scientific name
5. Click "Track seeds" → navigates to `/seeds` with the correct cultivar name in the query params
6. Search a species that has only one result → card shows no badge; dialog opens with no cultivar picker (identical to current behaviour)
7. Apply a filter (e.g. "Beginner" care difficulty) that reduces the number of Ninebark cultivars → card badge count updates to reflect only the filtered subset; dialog shows only those cultivars
8. Navigate to Dashboard → open a Zone → click "Species info" on a plant → dialog opens normally with no cultivar picker (zone-detail always passes a single record)
9. Open DevTools Console → confirm zero red errors
