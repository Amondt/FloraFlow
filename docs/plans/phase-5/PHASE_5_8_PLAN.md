# Phase 5.8 — Zone-Detail Card Footer Restructure

**Goal:** Fix the worst mobile-overflow surface in the app. Each plant card in zone-detail has a footer that packs **seven actions in a single non-wrapping flex row** — Edit, Delete, Care tips, Mix substrate, Journal, Diagnose, Check soil (`zone-detail.html`, the `<footer class="... flex items-center gap-1 ...">`). At 375 px they overflow horizontally or get clipped. This block is net-new — the original Phase 5 plan never addressed it.

**No DB migration. `/visualizer` · Sonnet · mid.** Benefits from 5.6 (tap targets) — coordinate the footer-button sizing so the two blocks don't fight.

---

- [x] **Block A — Footer layout for `<md`** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Restructure the footer so it works on a phone while leaving the desktop row intact. Recommended approach (implementer may refine):
    - Make the footer `flex-wrap` on `<md` so actions flow onto multiple lines instead of overflowing, OR
    - Group: keep the primary **Check soil** action prominent (it already has the emphasised outlined style) and let the secondary actions (Edit, Delete, Care tips, Mix, Journal, Diagnose) wrap beneath, full row width.
  - Keep desktop (`md+`) as the current single row — only add the mobile-first wrapping/grouping.
  - The `<div class="flex-1">` spacer currently pushes Check soil to the right; on a wrapped layout that spacer should collapse (`max-md:hidden`) so wrapped rows align left.

- [x] **Block B — Preserve layering + a11y** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - The card has an absolute full-card "open species" cover button at `z-10`; the footer sits at `z-20` so its actions stay clickable. Any restructure must keep the footer (and the care-tips accordion + journal link) at `z-20 relative` so taps don't fall through to the cover.
  - Preserve every action's existing `aria-label` and the `aria-expanded` care-tips toggle. Confirm tap targets meet 44 px on coarse pointer (ties into 5.6).

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Zone-detail card footer
────────────────────────────────────────────────
App: open a zone with ≥1 plant that has a scientific name (so all actions show)
DevTools device toolbar → iPhone 12 (375×812)

1. The plant card footer shows ALL actions (Edit, Delete, Care tips, Mix substrate,
   Journal, Diagnose, Check soil) with NO horizontal overflow and nothing clipped —
   they wrap onto multiple lines / group cleanly.
2. "Check soil" is still clearly the primary action (emphasised style).
3. Tap each action → correct dialog/navigation opens (Edit dialog, Delete confirm,
   Care tips accordion expands, Mix wizard, Journal route, Diagnose dialog, Soil check).
4. Tap the card body (not a footer button) → the species detail dialog still opens
   (the z-layering didn't break).
5. A plant WITHOUT a scientific name → only the always-on actions show, still no overflow.
6. Resize ≥768 px → footer returns to the original single-row desktop layout.
7. Console → zero red errors; dark mode check.
```
