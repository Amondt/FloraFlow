# Phase 2.2 Polish — Autocomplete Dual-Name Dropdown

**Scope:** UX refinement to the Add Plant dialog autocomplete. No DB migration, no Edge Function changes, no service changes.

**Root cause:** The `<p-autocomplete>` in `plant-form-dialog.html` uses `optionLabel="common_name"` with no item template. Each suggestion row shows only `common_name` — the raw Perenual internal string. The `scientific_name` that explains why a result matched is invisible. The field label also gives no hint that scientific names are valid search input.

**What the data layer already provides:**
- Edge Function already queries both `common_name` and `scientific_name` via `.or('common_name.ilike.%q%,scientific_name.ilike.%q%')`
- `BotanicalSuggestion` already exposes `{ scientific_name, common_name, perenual_id }`
- `onCommonNameChange()` already writes both fields to the form on selection

Only the template rendering needs to change.

---

## - [x] **Block A — Dual-name item template in Add Plant autocomplete** | Agent: `/visualizer`

File: `src/app/features/scheduler/plant-form-dialog/plant-form-dialog.html`

- Add `<ng-template #item let-s>` inside `<p-autocomplete>` that renders a two-line row:
  - Line 1 (primary): `s.common_name` — sentence-case display name
  - Line 2 (secondary): `s.scientific_name` — italic, `text-xs text-neutral-400`, only rendered when present
- Update the "Plant name" label helper text from `(required)` to include a hint: "search by common or scientific name"
- Update the `placeholder` on both the autocomplete and the locked `pInputText` to reflect dual-name search
- Keep `optionLabel="common_name"` on `<p-autocomplete>` — it controls what fills the input box after selection; the template is for the dropdown overlay only

---

## Verification

```powershell
bun run format
bun run lint
```

**Manual Browser Check — Add Plant autocomplete**
```
App running at: http://localhost:4200/scheduler

1. Open Add Plant dialog → focus "Plant name" field → label hint reads "Search by common or scientific name"
2. Type "monstera" → dropdown suggestions show two lines per row: common name on top, italic scientific name below
3. Type "deliciosa" (scientific name fragment) → matching results appear; scientific name in each row confirms why it matched
4. Select a suggestion → common name fills the input; lock badge shows the scientific name; "Change species" link appears
5. Open DevTools Console → zero red errors
```
