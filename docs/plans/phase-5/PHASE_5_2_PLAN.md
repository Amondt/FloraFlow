# Phase 5.2 — Shared Dialog PT + Slider Mobile Pass

**Goal:** Make every dialog feel native on a phone — full-width, anchored to the bottom (the thumb-reachable edge), with footer buttons that stack full-width instead of cramming 2–3 across a 375 px row — and make the library pH slider handle grabbable with a finger. Done in the **PT layer** so every dialog and slider inherits it at once; no per-template edits.

**Why this is early:** 5.6 (touch), 5.7 (filter sheet uses a sheet, but dialogs everywhere), 5.8, 5.9, 5.10 all open dialogs. Fixing the four PT objects once means downstream blocks render correctly for free.

**Corrects the original plan:** the old 5.6 listed only `FloraDialogPT`, `FloraConfirmDialogPT`, `FloraDetailDialogPT`. It **missed `FloraFormDialogPT`** — the PT used by the soil-check, plant-form, journal-entry, plant-identifier, and leaf-doctor dialogs (i.e. most of them). All four are updated here.

**No DB migration. `/visualizer` · Sonnet · mid.** Depends on 5.1 (safe-area utilities).

---

- [x] **Block A — Bottom-anchored, full-width dialogs (`<md`)** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - File: `src/app/shared/ui/pt/dialog.pt.ts`. Update the `root` slot of **all four** objects: `FloraDialogPT`, `FloraFormDialogPT`, `FloraDetailDialogPT`, `FloraConfirmDialogPT`.
  - Pattern (keep each object's existing `md:max-w-*` — only add the mobile-first overrides):
    ```
    max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:w-full max-md:max-w-none
    max-md:rounded-b-none max-md:rounded-t-garden-lg max-md:max-h-[92vh]
    md:rounded-garden-lg md:max-w-md   /* ← per-object existing max-w: md / lg / 2xl / sm */
    ```
  - The mask (`max-md:items-end`) so PrimeNG aligns the panel to the bottom edge — verify against the PrimeNG dialog position model via context7 before finalising the mask/position approach (unstyled mode positions via the mask flex container).
  - `content` slot already has `overflow-y-auto` + `min-h-0` — keep it; that is what lets the body scroll when the iOS keyboard shrinks the viewport.

- [x] **Block B — Footer button stacking + safe area** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Same file, `footer` slot of all four objects. Today it is `flex justify-end gap-3` → 3 buttons (e.g. botanical detail: Mix · Track seeds · Add) overflow at 375 px.
  - Make the footer stack and stretch on mobile, plus clear the home indicator:
    ```
    flex gap-3 border-t ...  max-md:flex-col max-md:items-stretch  pb-safe md:pb-4
    ```
    `items-stretch` makes child `<p-button>`s fill the width with no per-button `w-full` needed. `<p-button>`s in the back-link/footer that use `mr-auto` (botanical detail, substrate wizard) should drop to a plain stacked order on mobile — verify those two footers visually.
  - Header/`pcCloseButton` slots unchanged.

- [x] **Block C — Slider touch handle** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - File: `src/app/shared/ui/pt/slider.pt.ts`. The `handle` / `startHandler` / `endHandler` are `w-4 h-4` (16 px) — far below the 44 px floor. Enlarge the **hit area** on coarse pointers without changing desktop:
    ```
    w-4 h-4 pointer-coarse:w-6 pointer-coarse:h-6
    ```
    (24 px visual + the slider's own padding gives a comfortable thumb target; if a larger target is wanted without enlarging the dot, use a `::before` pseudo-expander instead — implementer's call, document which.)

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Dialogs + slider on mobile
──────────────────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → iPhone 12 (375×812)

1. Open a FORM dialog (Tasks → Add plant) → panel is full-width, glued to the bottom
   edge, top corners rounded, bottom flush. Footer "Cancel"/"Save" are stacked and
   full-width.
2. Open the DETAIL dialog (Library → tap a species) → same anchoring; the THREE footer
   buttons (Mix substrate · Track seeds · Add to my plants) stack full-width, none clipped.
3. Open a CONFIRM dialog (delete any plant) → bottom-anchored, buttons stacked.
4. In any dialog with a long body (plant form), focus a field so the virtual keyboard
   shows (or shrink the viewport) → the body scrolls; the footer stays reachable.
5. Library → open Soil pH filter → drag a pH handle with touch emulation (Sensors →
   Touch) → easy to grab, moves smoothly, no accidental release.
6. Desktop (device toolbar off) → all dialogs centered exactly as before; slider dot
   unchanged.
7. Console → zero red errors; toggle dark mode → dialog chrome correct in both themes.
```
