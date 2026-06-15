# Phase 5.4 — Responsive Page Headers

**Goal:** Stop the page headers from colliding on a phone. Every feature page uses the same `header` shape — a title block on the left and an action cluster on the right (`flex items-start justify-between gap-4`). At 375 px the `text-3xl` title and the right-hand buttons fight for space; journal is the worst case (plant filter + Diagnose + New entry next to the title).

**Corrects the original plan:** old 5.5 fixed only the dashboard header. This block generalises the fix to all six headers.

**No DB migration. `/visualizer` · Sonnet · mid.**

---

- [ ] **Block A — Header layout pattern** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Apply a consistent responsive treatment to each header so the action cluster drops below the title on narrow screens instead of squeezing beside it. Two acceptable approaches (pick per page, keep consistent):
    - **Stack:** header becomes `flex-col items-start gap-3 md:flex-row md:items-start md:justify-between`; the action cluster sits under the title on `<md`.
    - **Wrap:** keep the row but let the cluster `flex-wrap` and align left on `<md`.
  - Keep the §6.7 ghost-button style; do not convert to `<p-button>`. Labels may shorten to icon-only on `<md` **only if** an `aria-label` already carries the full text (it does on these buttons) — but prefer keeping short text labels where they fit.

- [ ] **Block B — Per-page application** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `dashboard.html` — title + (Identify plant · Add plant). The disabled "Add plant" hint is absolutely positioned (`absolute top-full`) — re-verify it doesn't overlap once the cluster moves.
  - `tasks.html` — title + Add plant (single button; light touch).
  - `journal.html` — **worst case**: title + `app-plant-select` (ghost) + Diagnose + New entry. The `app-plant-select` has a min width; on `<md` let the three controls sit on their own full-width row under the title.
  - `library.html` — title + (Identify · Mix substrate).
  - `seeds.html` — title + Add batch (single).
  - `zone-detail.html` — the zone `<h1>` + Edit button, and the "Plants" section header + New plant.
  - Each page keeps its eyebrow/subtitle and live-count line intact.

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Page headers
────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → 375 px wide

For EACH route — /dashboard, /tasks, /journal, /library, /seeds, and a /dashboard/zones/:id :
1. The heading is fully readable (not truncated by buttons crowding it).
2. The action buttons are all visible and tappable, wrapped/stacked below the title
   where needed — none clipped or pushed off-screen.
3. /journal specifically: plant filter + Diagnose + New entry all reachable; opening
   the plant filter dropdown still works.
4. No horizontal scrollbar appears on any header.
5. Resize to ≥768 px → headers return to the single-row title-left / actions-right layout.
6. Console → zero red errors; dark mode check.
```
