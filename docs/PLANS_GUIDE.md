# Plans Guide

Phase plan files live in `plans/` and are ephemeral — they track active work and may be archived or deleted when a phase is complete.

## Checkbox convention

The checkbox goes on the **block title line** itself. Implementation details live as a plain bullet list inside the block — no checkboxes on sub-points:

```markdown
- [ ] **Block A — Descriptive title** | Agent: `/plumber`
  - Sub-point one
  - Sub-point two
  - Sub-point three
```

Use `- [x]` (lowercase x, no spaces inside brackets) to mark a block done. Do **not** reword it — check the box in place.

## When to mark done

A block's box may be checked only when **all three** conditions are true:

1. The code passes `bun run lint` with zero errors.
2. The user has confirmed the relevant verification (Manual Browser Check, `bunx supabase db test`, or equivalent).
3. The changes are committed to git.

## Agent responsibility

The agent that completes a block checks its box before reporting done.

## Pointing an agent at a plan

Include the plan file as an `@` reference when invoking an agent:

```
/visualizer @plans/PHASE_1_7_PLAN.md  Continue Block B
```

The agent receives the full file and reads this guide (triggered by the `plans/` path in the Source-of-Truth table).
