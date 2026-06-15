# Phase 5.5 — Page Padding & Overflow Sweep

**Goal:** Reclaim horizontal space on phones (the `p-6` gutter is too wide at 375 px) and guarantee zero horizontal overflow on every route.

**Already done — do NOT redo:** the journal category tabs and the seeds stage tabs already scroll horizontally via the shared `app-scroll-tabs` component (arrows + edge fades). The original 5.5's "add overflow-x-auto to the journal tab bar" is therefore already satisfied — skip it.

**No DB migration. `/visualizer` · Sonnet · low.** Coordinate the `<main>` edits with 5.3 Block C (same class lists).

---

- [ ] **Block A — Mobile side padding** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - On every feature `<main>`, change `p-6` → `px-4 py-6 md:p-6`:
    - `dashboard.html`, `tasks.html`, `journal.html`, `library.html`, `seeds.html`, `zone-detail/zone-detail.html`.
  - If 5.3 added `pb-20 md:pb-0` to these same elements, fold both into the one class list.

- [ ] **Block B — Scheduler section-header italics** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `tasks.html`: the per-section italic hint `<p>` ("Address first…", "Monitor but no action needed yet", etc.) crowds the heading + count badge on narrow screens. Add `max-md:hidden` to each of those hint paragraphs (overdue / due-today / due-this-week / upcoming).

- [ ] **Block C — Overflow audit at 375 px** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - Walk every route at 375 px and confirm nothing forces a horizontal scrollbar. Likely suspects to spot-check (most are handled in their own blocks, listed here for the sweep): long species names in cards (already `truncate`/`min-w-0`), the substrate-wizard recipe `<table>`, badge rows (`flex-wrap` already), the dashboard frost alert.
  - Fix any stray overflow with `min-w-0` on the flex child or `flex-wrap` on the row — do not introduce horizontal scroll on page-level containers.

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Padding & overflow
──────────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → 375 px wide

1. Each route (/dashboard, /tasks, /journal, /library, /seeds, /dashboard/zones/:id):
   content has a comfortable narrow gutter (not the wide desktop p-6).
2. Drag the DevTools width to 375 px and check the document does NOT scroll sideways
   on any route (the page-level scrollbar is vertical only).
3. /tasks: section hints ("Address first…", etc.) are hidden; heading + count badge
   have room.
4. /journal and /seeds: the filter tab strips still scroll horizontally and the arrows
   appear when needed (unchanged from before).
5. Resize to ≥768 px → desktop p-6 gutter and the section hints return.
6. Console → zero red errors.
```
