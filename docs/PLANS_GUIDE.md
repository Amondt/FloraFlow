# Plans Guide

Phase plan files live in `docs/plans/` and are ephemeral — they track active work and may be archived or deleted when a phase is complete.

## Checkbox convention

The checkbox goes on the **block title line** itself. Implementation details live as a plain bullet list inside the block — no checkboxes on sub-points:

```markdown
- [ ] **Block A — Descriptive title** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Sub-point one
  - Sub-point two
  - Sub-point three
```

Use `- [x]` (lowercase x, no spaces inside brackets) to mark a block done. Do **not** reword it — check the box in place.

## Model & effort tag

After the `|` separator, every block title names three things: the **agent**, the **model** (`Sonnet` or `Opus`), and the **effort** (`low` / `mid` / `high` / `max`). `/mind` assigns these per block — default to Sonnet at `low`/`mid` and escalate only where `docs/AGENT_MODEL_STRATEGY.md` says it pays off. The target is the cheapest setting that still produces production-ready work.

## When to mark done

A block's box may be checked only when **all three** conditions are true:

1. The code passes `bun run lint` with zero errors.
2. The user has confirmed the relevant verification (Manual Browser Check, `bunx supabase db test`, or equivalent).
3. The changes are committed to git.

## Agent responsibility

Only `/gatekeeper` marks block checkboxes — after lint, user-confirmed verification, and commit are all done. No implementing agent (`/plumber`, `/visualizer`, `/mind`) may mark a block done, even if it built it.

## Pointing an agent at a plan

Include the plan file as an `@` reference when invoking an agent:

```
/visualizer @docs/plans/phase-1/PHASE_1_7_PLAN.md  Continue Block B
```

The agent receives the full file and reads this guide (triggered by the `docs/plans/` path in the Source-of-Truth table).
