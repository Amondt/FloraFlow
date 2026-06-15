# Phase 5.7 — Library Filter Bottom Sheet

**Goal:** The library's lateral filter sidebar (`<aside class="w-52">`, nine `<details>` sections) is unusable on a phone — it would eat half the width. On `<md`, hide it and surface a "Filters" pill that opens a full-width bottom sheet containing the same controls. Desktop sidebar is untouched.

**This is the largest single block (Opus · mid).** It is the one block with genuine layout novelty (no sheet pattern exists yet) **and** a reuse-extraction decision — which is why it escalates off the Sonnet default per `AGENT_MODEL_STRATEGY.md`. (Sonnet · `high` is an acceptable cheaper alternative if preferred.)

**No DB migration. `/visualizer`.** Depends on 5.1 (`.pb-safe`) and benefits from 5.2 (dialog/sheet patterns).

---

- [ ] **Block A — Extract `library-filters` presentational component** | Agent: `/visualizer` · Model: Opus · Effort: mid
  - The nine `<details>` filter sections currently live inline in `library.html` (~470 lines). To render them in **both** the desktop `<aside>` and the mobile sheet without duplicating markup, extract them into a dumb presentational component `src/app/features/library/library-filters/library-filters.{ts,html}` (`CODE_RULES.md` DRY + Single Responsibility — the markup is repeated across two containers, well past the 3-line threshold).
  - Inputs/outputs mirror what `library.ts` already exposes: the `filters()` value + option lists + label maps in; toggle/clear events out. **No service calls in this component** — `library.ts` remains the smart container owning `filters()`, `clearFilters()`, and all query logic. This is purely lifting the template + its `@Input`/`@Output` surface.
  - The pH slider tooltip behaviour is touched in 5.10 — keep the markup intact here; 5.10 rebases onto the extracted component.

- [ ] **Block B — Desktop sidebar uses the component** | Agent: `/visualizer` · Model: Opus · Effort: mid
  - In `library.html`, replace the inline `<details>` block inside `<aside>` with `<app-library-filters ... />`. The `<aside class="w-52 ... max-md:hidden">` wrapper stays; add `max-md:hidden` so it disappears on phones. Confirm desktop filtering is byte-for-byte unchanged.

- [ ] **Block C — Filters pill + active count (`<md`)** | Agent: `/visualizer` · Model: Opus · Effort: mid
  - Above the results `<section>`, add a `md:hidden` "Filters" pill button. Show a badge with the active-filter count; hide the badge when zero. Reuse the existing `hasActiveFilters()` plus a small `activeFilterCount()` computed (count the set dimensions) in `library.ts`.

- [ ] **Block D — Bottom sheet** | Agent: `/visualizer` · Model: Opus · Effort: mid
  - A `md:hidden` overlay: a backdrop (`fixed inset-0 bg-neutral-900/50`) + a bottom panel (`fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto pb-safe rounded-t-garden-lg`) holding `<app-library-filters />` plus a sticky "Done" button. Slide-in via CSS `transform`/`transition` driven by an `isFilterSheetOpen` signal.
  - Dismiss on: backdrop tap, "Done" tap, and `Escape`. Trap nothing fancy — but move focus into the sheet on open and restore on close (`afterNextRender` focus, per `DESIGN_SYSTEM §7.1`).
  - `clearFilters()` and every toggle continue to drive the same `filters()` signal — results update live behind the sheet.

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Library filters (mobile sheet)
──────────────────────────────────────────────────────
App: http://localhost:4200/library  ·  DevTools device toolbar → iPhone 12 (375×812)

1. Sidebar is gone; a "Filters" pill sits above the results. Results render one column,
   full width, no sidebar gap, no horizontal scroll.
2. Set 2–3 filters → the pill shows a count badge (e.g. "3"); clearing all hides the badge.
3. Tap the pill → a bottom sheet slides up with all nine filter sections; the results
   update live as you toggle (peek behind / after closing).
4. Close via the backdrop, the "Done" button, AND the Esc key — all dismiss it.
5. "Clear all" inside the sheet resets filters and the badge.
6. Resize to ≥768 px → the desktop sidebar returns and filters exactly as before the
   refactor (spot-check each control: placement, sunlight, watering, traits toggles,
   difficulty, maintenance, lifecycle, pH slider).
7. Keyboard: open sheet → focus lands inside it; Esc closes and returns focus to the pill.
8. Console → zero red errors; dark mode → sheet + backdrop correct.
```
