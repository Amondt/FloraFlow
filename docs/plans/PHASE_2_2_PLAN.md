# Phase 2.2 Plan — Botanical Name Autocomplete in Add Plant Form

## Context

Phase 2.1 delivered the `botanical-search` Edge Function and the `cached_botanical_records` table. Phase 2.2 wires the user-facing side: when a user types a plant name in the Add/Edit Plant dialog, suggestions from the botanical cache appear. Selecting one auto-populates both `common_name` and `scientific_name` and captures `perenual_id` for future AI enrichment. Free typing still works — autocomplete is non-blocking.

---

## Scope

**One component touched:** `plant-form-dialog`  
**One new service:** `botanical-search.service.ts`  
**One new PT object:** `autocomplete.pt.ts`  
**Two model changes:** `PlantFormData` + `PlantService` calls

---

## Blocks

- [x] **Block A — FloraAutoCompletePT object** | Agent: `/visualizer`
  - Use context7 to verify PrimeNG v21 `AutoCompletePassThroughOptions` slots (`root`, `input`, `panel`, `list`, `option`, `loadingIcon`)
  - Create `src/app/shared/ui/pt/autocomplete.pt.ts` — export `FloraAutoCompletePT` using the same token + state-constant patterns as `input.pt.ts` and `select.pt.ts`
  - Add the export to `src/app/shared/ui/pt/index.ts` barrel
  - Run `bun run lint`

- [x] **Block B — BotanicalSearchService** | Agent: `/plumber`
  - Use context7 to verify `supabase.functions.invoke` query-param support in `@supabase/supabase-js` v2
  - Define `BotanicalSuggestion` interface in `src/app/core/services/botanical-search.service.ts`:
    `{ scientific_name: string; common_name: string; perenual_id: number | null }`
  - `search(q: string): Promise<BotanicalSuggestion[]>` — guard `q.length < 2` → return `[]`
  - Call the Edge Function: GET `/functions/v1/botanical-search?q=<encoded>` with `Authorization: Bearer <access_token>` from `SupabaseService.session()`
  - Return `[]` on any error (never throw — autocomplete failure must not break the form)
  - `providedIn: 'root'`; `inject(SupabaseService)`
  - Run `bun run lint`

- [x] **Block C — Extend PlantFormData and PlantService** | Agent: `/plumber`
  - `src/app/features/scheduler/plant.model.ts`: add `perenual_id: number | null` to `PlantFormData`
  - `src/app/features/scheduler/plant.service.ts`: update `createPlant()` and `updatePlant()` to pass `perenual_id` in the Supabase insert/update payload (column already exists in `database.types.ts`)
  - Cross-check column name in `src/types/database.types.ts` before writing
  - Run `bun run lint`

- [x] **Block D — Wire autocomplete into PlantFormDialog** | Agent: `/visualizer`
  - Use context7 to verify PrimeNG v21 `AutoCompleteModule` events: `completeMethod`, `onSelect`, `onClear`
  - In `plant-form-dialog.ts`:
    - `inject(BotanicalSearchService)`
    - Add `protected suggestions = signal<BotanicalSuggestion[]>([])`
    - Add `protected selectedPerenualId = signal<number | null>(null)` — reset to `null` in the `effect()` form-reset branch
    - Add `protected commonNameQuery = ''` (plain string, `ngModel` target for the autocomplete)
    - `onQuerySearch(event: AutoCompleteCompleteEvent)`: call `botanicalSearch.search(event.query)`, update `suggestions`; use PrimeNG's built-in `[delay]="300"` for debounce — no RxJS needed
    - `onSuggestionSelect(event: AutoCompleteSelectEvent)`: cast `event.value as BotanicalSuggestion`; `form.controls.common_name.setValue(item.common_name)`; `form.controls.scientific_name.setValue(item.scientific_name)`; `selectedPerenualId.set(item.perenual_id)`
    - `onAutocompleteInput(value: string)`: `form.controls.common_name.setValue(value)` — keeps reactive form in sync when user types freely
    - Update `onSubmit()` to include `perenual_id: this.selectedPerenualId()`
    - Import `AutoCompleteModule`, `FloraAutoCompletePT`, `BotanicalSuggestion`
    - `NgModel` binding requires `FormsModule` — add to `imports` array
  - In `plant-form-dialog.html`:
    - Replace the `<input pInputText>` block for `common_name` with `<p-autocomplete>`
    - Bind: `[(ngModel)]="commonNameQuery"`, `[ngModelOptions]="{standalone: true}"`, `[suggestions]="suggestions()"`, `optionLabel="common_name"`, `(completeMethod)="onQuerySearch($event)"`, `(onSelect)="onSuggestionSelect($event)"`, `(onClear)="selectedPerenualId.set(null)"`, `[delay]="300"`, `[minLength]="2"`, `[pt]="FloraAutoCompletePT"`
    - Preserve ARIA: `[id]="commonNameId"`, `aria-required="true"`, `[attr.aria-invalid]`, `[attr.aria-describedby]`, error `<small>` block unchanged
    - `scientific_name` field stays as plain `input pInputText` (no second autocomplete)
  - Run `bun run lint`
  - Provide Manual Browser Check

---

## Files Modified

| File | Change |
|---|---|
| `src/app/shared/ui/pt/autocomplete.pt.ts` | **New** — `FloraAutoCompletePT` |
| `src/app/shared/ui/pt/index.ts` | Add export |
| `src/app/core/services/botanical-search.service.ts` | **New** — `BotanicalSearchService` |
| `src/app/features/scheduler/plant.model.ts` | Add `perenual_id` to `PlantFormData` |
| `src/app/features/scheduler/plant.service.ts` | Pass `perenual_id` in create/update |
| `src/app/features/scheduler/plant-form-dialog/plant-form-dialog.ts` | Autocomplete logic |
| `src/app/features/scheduler/plant-form-dialog/plant-form-dialog.html` | Replace input with `p-autocomplete` |

---

## Key Constraints

- `PlantFormData.perenual_id` is optional (`null` when user types freely — never block save)
- Autocomplete errors are silently swallowed — `search()` always returns `[]` on failure
- Free-text entry always works; suggestion selection is a convenience, not a requirement
- `scientific_name` is auto-filled on selection but remains editable by the user
- No new migration needed — `perenual_id` column already exists in `plants` table

---

## Verification

**Block B:** Temporarily log `BotanicalSearchService.search('monstera')` in the component to confirm the Edge Function returns an array.

**Block D — Manual Browser Check:**
1. Navigate to `http://localhost:4200/scheduler`
2. Open Add Plant dialog
3. Type "mo" → suggestions appear (2-char minimum triggers search)
4. Type "monst" → dropdown with botanical suggestions within ~300ms
5. Select a suggestion → Plant name and Scientific name both fill in automatically
6. Clear the field and type a free-text name (no match) → Save works, `scientific_name` stays blank
7. Open Edit Plant for an existing plant → form pre-fills correctly, no autocomplete side-effects
8. DevTools Console → zero red errors
