# Phase 5.3 — Bottom Tab Bar + Mobile Utility Bar

**Goal:** Move the five primary routes to a thumb-reachable bottom tab bar on phones, while keeping the language / theme / sign-out controls reachable. On desktop nothing changes.

**The decision this block encodes (UX research):** the chosen pattern is **Material 3 "top app bar + navigation bar"** — bottom bar carries the 3–5 primary destinations; a slim top bar keeps the secondary/utility actions. This is what Spotify et al. do, and it beats a "More" tab (which buries destinations and crowds the bar) and an overflow `⋯` (an unnecessary extra tap for only 3 low-frequency controls). Sources: [Material 3 Navigation bar](https://m3.material.io/components/navigation-bar/guidelines), [Material 3 Top app bar](https://m3.material.io/components/app-bars/guidelines), [Smashing — Golden Rules of Mobile Navigation](https://www.smashingmagazine.com/2016/11/the-golden-rules-of-mobile-navigation-design/).
> Future note: sign-out is rare + destructive — a fine candidate to move behind an overflow or into an account screen later. Out of scope here; 3 visible icons is correct now.

**No DB migration. `/visualizer` · Sonnet · mid.** Depends on 5.1 (`.h-bottom-nav`, `.pb-safe`).

---

- [x] **Block A — Top nav: keep utilities, hide route links on `<md`** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - File: `src/app/shared/components/nav/nav.html`. The scrollable links container (the `<div>` wrapping the 5 `<a routerLink>`) gets `max-md:hidden`. The utility cluster `<div>` (language / theme / sign-out) stays visible. Result on `<md`: a slim bar with just the utilities right-aligned. On `md+`: unchanged.
  - The cluster currently has no left-hand element on mobile — add a small wordmark/brand text on the left (`md:hidden` is not needed; it can show on all sizes or `max-md:` only) so the slim bar isn't an orphaned right-aligned cluster. Keep it text-only (no new asset).

- [x] **Block B — Bottom tab bar component** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - New presentational component `src/app/shared/components/bottom-nav/bottom-nav.{ts,html}` (selector `app-bottom-nav`). Pure links — no service calls (SRP).
  - Container: `<nav class="md:hidden fixed inset-x-0 bottom-0 z-40 h-bottom-nav pb-safe flex border-t bg-white dark:bg-neutral-800 ...">` with `aria-label` via Transloco.
  - Five `<a>` tabs, each `flex-1 relative flex flex-col items-center justify-center gap-0.5`, an icon (`pi pi-*`) above a short `text-[0.6875rem]` label, `routerLink` + `routerLinkActive="text-primary-600 dark:text-primary-400"`, `ariaCurrentWhenActive="page"`.
  - Each tab gets a Strategy-B tap-expander (`<span aria-hidden ... absolute ... size-12 ... pointer-fine:hidden>`) per `DESIGN_SYSTEM.md §8.5` (bottom-nav uses `size-12`).
  - Suggested icons: dashboard `pi-home`, tasks `pi-check-square`, journal `pi-book`, library `pi-search`/`pi-th-large`, seeds `pi-inbox` — confirm final picks against the PrimeIcons set via context7.
  - Reuse the existing route list; do not duplicate route strings if a shared array can be lifted from `nav` (DRY — optional, only if clean).

- [x] **Block C — Mount it + content clearance** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `src/app/shared/components/shell/shell.html`: render `<app-bottom-nav />` after `<router-outlet />` (sibling, so `fixed` is relative to viewport); import it in `shell.ts`.
  - Every feature `<main>` (dashboard, tasks, journal, library, seeds, zone-detail) gains `pb-20 md:pb-0` so the last content row clears the bar. (Coordinate with 5.5, which touches the same `<main>` class lists — land them together or in adjacent commits.)

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Mobile navigation
─────────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → iPhone 12 (375×812)

1. A fixed bottom bar shows all 5 tabs (icon + label) with no horizontal scroll; the
   current route's tab is highlighted (primary colour) + aria-current="page".
2. Tap each tab → navigates; highlight follows. Tap targets feel ≥48 px.
3. Top of screen: a slim bar still shows language / theme / sign-out (and a small
   wordmark). The 5 text route-links are gone on mobile.
4. Scroll any page to the bottom → last row/card is fully visible above the tab bar
   (not hidden behind it); on a notched device the bar clears the home indicator.
5. Resize to ≥768 px → bottom bar disappears, the full top nav (5 links + utilities)
   returns exactly as before.
6. Keyboard: Tab through the bottom bar → focus ring visible on each tab; Enter navigates.
7. Console → zero red errors; dark mode → bar chrome correct.
```
