# Phase 1.6 — Plant Form Dialog UX Redesign

**Goal:** Separate species selection from plant naming in the Add/Edit Plant dialog.
**Agent:** `/visualizer`
**No migration required** — the existing `common_name` / `scientific_name` / `perenual_id` schema already supports the intended semantics.

---

## Problem

The current form collapses two distinct actions into a single "Plant name" field:

1. **Species lookup** — autocomplete search against botanical records
2. **Plant identity** — the user's personal label for their specific plant

After a species locks, the field becomes a free-text rename input, but nothing signals this transition. The hint text still reads "(common or scientific name)", implying it's still a botanical search. Users have no clear moment to consciously name their plant.

---

## Solution: Two separate sections

### Section 1 — Species (optional)

| State | What the user sees |
|---|---|
| Nothing selected | Autocomplete search input: "Search by common or scientific name…" |
| Species selected | Read-only chip: 🌿 Common Name · *Scientific name* + "Change" button |

### Section 2 — My plant's name (required)

- Always-visible plain text input
- Pre-fills from species common name on selection (user can freely edit)
- Helper: "How you'll identify this plant in your garden"
- Placeholder: e.g. "Bathroom pothos, Big window fern…"

The scientific name field is **removed** from the visible form. It is already meaningless to users (auto-filled, uneditable) and is exposed contextually in the botanical detail dialog.

---

## Blocks

- [ ] **Block A — Template restructure** | Agent: `/visualizer`
  - Replace the `@if (selectedPerenualId()) { input } @else { autocomplete }` toggle with two dedicated form sections
  - Section 1: species picker — autocomplete when unlocked, locked chip (`<article role="status">`) when locked
  - Locked chip: plant icon + `lockedSpeciesCommonName() · lockedScientificName()` + "Change" button
  - Section 2: nickname field — `pInputText` with `formControlName="common_name"`, always rendered
  - Remove the standalone `scientific_name` input block from the template (data stays wired)
  - Update all `aria-label`, `aria-describedby`, and `role="note"` copy to match new layout

- [ ] **Block B — TypeScript wiring** | Agent: `/visualizer`
  - Rename `commonNameQuery` → `speciesSearchQuery` (drives autocomplete only)
  - Add `lockedSpeciesCommonName = signal<string | null>(null)` for the chip display
  - Update `onCommonNameChange`: when species selected → pre-fill `form.controls.common_name` with species common name (only if nickname is currently empty)
  - Update `clearLockedSpecies`: clears species state; does **not** clear the nickname (user may have renamed)
  - Update `onHide` / effect resets to use new signal names
  - `PlantFormData` emission and `saved` output remain unchanged

---

## Verification

```powershell
bun run format
bun run lint
```

**Manual Browser Check — Plant Form Dialog UX**
```
Manual Browser Check — Plant Form Dialog (UX Redesign)
──────────────────────────────────────────────────────
App running at: http://localhost:4200/tasks

1. Click "Add plant" → dialog opens → confirm two distinct sections:
   "Species (optional)" above, "My plant's name *" below.
2. Type 2+ chars in species search → dropdown suggestions appear with common + scientific name.
3. Select a suggestion → species search replaced by locked chip (🌿 Name · Scientific) + "Change" button.
4. Confirm "My plant's name" field is pre-filled with the species common name.
5. Edit the nickname field → value changes freely; chip remains locked.
6. Click "Change" on the chip → chip disappears, species autocomplete reappears, nickname field retains edited value.
7. Submit with only a nickname (no species) → plant saves successfully (species is optional).
8. Submit with no nickname → validation error shown on "My plant's name" field.
9. Open "Edit plant" on an existing plant with a locked species → chip shows correctly, nickname shows plant's saved common_name.
10. Open "Edit plant" on a manually-named plant (no perenual_id) → no chip, species search empty, nickname shows saved name.
11. Open DevTools Console → confirm zero red errors.
```
