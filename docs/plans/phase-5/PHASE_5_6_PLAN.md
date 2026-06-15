# Phase 5.6 — Touch Targets & Tap Feedback

**Goal:** Every interactive control meets the 44 px touch floor on coarse pointers, and every tap produces immediate visual feedback (touch has no hover).

**This is audit-and-fill, not blanket application.** `DESIGN_SYSTEM.md §8` already defines the two strategies (A: `pointer-coarse:min-h-11` on a PT root; B: invisible `size-11` tap-expander span). Several surfaces are **already migrated** — confirm and skip:
- `seed-batch-card` footer icon buttons — already carry Strategy-B spans.
- `substrate-mix-wizard` pot chips + info button — already carry Strategy-B spans.

**No DB migration. `/visualizer` · Sonnet · mid.** Note: carousel arrows and the slider handle are handled in 5.10 / 5.2 respectively — don't double up.

---

- [ ] **Block A — Tap-target audit + fill** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Walk interactive controls and apply Strategy A or B per `§8.6` where the 44 px area isn't already covered by surrounding padding. Known gaps to fix:
    - `plant-alert-card.html` — the Edit (`px-3 py-3`) and Delete icon buttons: confirm ≥44 px; the card row is tall but the icon buttons are narrow — add a Strategy-B span or widen.
    - `library.html` pagination buttons (`w-8 h-8` = 32 px) — Strategy B span (`size-11`), parent already has room.
    - `journal-entry-card` / `journal.html` and `zone-detail` footer text buttons — verify the `px-2 py-1` ghost buttons reach 44 px on coarse pointer; bump with `pointer-coarse:min-h-11` if not (note 5.8 restructures the zone-detail footer — coordinate).
  - Do **not** change desktop sizing — every fix is `pointer-coarse:`-scoped or an invisible `pointer-fine:hidden` span.

- [ ] **Block B — Active tap feedback** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - Add `active:opacity-70 transition-opacity` to the tappable card surfaces: `plant-alert-card`, `zone-card`, `journal-entry-card`, and the dashboard "today's check" task chips (`dashboard.html` `<a>` chips).
  - Any `hover:`-only feedback class on these cards gains a paired `active:` so touch users see the same state change.

- [ ] **Block C — Kill the tap delay** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - Add `touch-action: manipulation` (Tailwind `touch-manipulation`) to the interactive card list `<ul>`s (tasks lists, journal day lists, seeds list, zone-detail plant list, library results list) to remove the 300 ms double-tap delay without a JS shim.

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Touch targets & feedback
────────────────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → iPhone 12, Touch enabled

1. /tasks → a plant alert card's Edit and Delete icons: tap each — comfortably hittable
   (no fat-finger misses); DevTools inspect shows a ≥44 px hit box.
2. /library → run a search → pagination arrows/numbers are easily tappable.
3. Tap-and-hold a plant alert card / zone card / journal card / dashboard task chip →
   it visibly dims (active state) on press.
4. Double-tap a card quickly → it reacts immediately (no ~300 ms delay).
5. Desktop with a mouse → control sizes look identical to before (no visual growth);
   hover states unchanged.
6. Spot-check seed-batch-card + substrate wizard chips are UNCHANGED (already migrated).
7. Console → zero red errors.
```
