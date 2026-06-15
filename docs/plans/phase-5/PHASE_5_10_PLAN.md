# Phase 5.10 — Pointer/Hover Fixes + Carousel Swipe

**Goal:** Close the touch-only interaction gaps — drag, tap-to-reveal, and swipe — that hover/mouse-centric code leaves broken on a phone.

**Corrects the original plan:** old 5.8 said the library tooltips use `group-hover:visible`. They don't — they use `(mouseenter)="showTooltip()"` / `(mouseleave)="hideTooltip()"` with a fixed-position popup (`library.html`). The conversion target is therefore the mouseenter/leave handlers, not a `group-hover` class. Also adds carousel swipe, which the original plan omitted.

**No DB migration. `/visualizer` · Sonnet · mid.** Sequence **after 5.7** (the tooltips live inside the extracted `library-filters` component once 5.7 lands).

---

- [ ] **Block A — pH slider pointer events** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `library.html`: the slider wrapper uses `(mousedown)="onPhSliderMouseDown($event)"` to track which handle is active. Change to `(pointerdown)` so it fires for touch + pen + mouse. Update the handler name/signature in `library.ts` accordingly (`PointerEvent`). Verify no other `mousedown`/`mousemove` assumptions remain in that tracker.

- [ ] **Block B — Tap-toggle filter info tooltips** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - The seven filter-section info icons (`pi-info-circle`, each `(mouseenter)/(mouseleave)` + `cursor-help`) are invisible on touch. Convert to a tap-toggle: a per-tooltip `signal<boolean>` (or one signal holding the open tooltip id), toggled on `(click)`. Keep hover-open on `pointer-fine` devices if cheap, but tap must work everywhere.
  - Only one tooltip open at a time; close on a `(document:click)` outside listener and on `Escape`. (Lives in `library-filters` after 5.7.)
  - Keep the existing fixed-position popup rendering (`tooltipPos()` / `tooltipText()`), just drive it from tap.

- [ ] **Block C — Carousel swipe + bigger arrows** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `species-photo-carousel.{ts,html}`: add touch swipe (left/right) to move between photos, using pointer events (`pointerdown`/`pointerup` with an X-delta threshold) — confirm the approach against current Angular event-binding guidance via context7 if unsure. Don't pull in a carousel library.
  - Bump the prev/next arrow buttons from `w-10 h-10` (40 px) to ≥44 px on coarse pointer (`pointer-coarse:w-11 pointer-coarse:h-11`), keeping 40 px on desktop. The dot row stays display-only.

- [ ] **Block D — App-wide hover-reveal audit** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - Grep for `hover:` classes that **reveal information** (not merely change colour/opacity) and give each a `focus-visible:` (and, where it's content, a touch-reachable) twin so keyboard + touch users see the same thing. Colour/opacity-only hovers are out of scope (those are covered by 5.6's `active:` pairing).

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Touch interactions
──────────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → iPhone 12, Sensors → Touch

1. /library → Soil pH filter → drag each handle with touch → tracks correctly, no
   unintended release, range updates.
2. /library → tap a filter section's ⓘ info icon → its tooltip appears; tap another →
   the first closes; tap outside (or Esc) → closes. Works with no mouse.
3. /library → open a species → in the photo carousel, SWIPE left/right → photo changes;
   the prev/next arrows are comfortably tappable; dots track the active photo.
4. Keyboard pass: Tab to the info icons → tooltip shows on focus; Tab to carousel arrows
   → focus ring + Enter advances.
5. Desktop with mouse → hover tooltips + 40 px arrows behave as before; slider unchanged.
6. Console → zero red errors; dark mode check.
```
