# Plans Guide

Phase plan files live in `docs/plans/` and are ephemeral — they track active work and may be archived or deleted when a phase is complete.

## Block format

The checkbox goes on the **block title line**. Implementation details are a plain bullet list inside — no checkboxes on sub-points:

```markdown
- [ ] **Block A — Descriptive title** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Sub-point one
  - Sub-point two
```

Use `- [x]` (lowercase x, no spaces inside the brackets) to mark a block done — never reword the title, just check it in place.

## Model & effort tag

After the `|`, every block names three things: the **agent**, the **model** (`Sonnet` / `Opus`), and the **effort** (`low` / `mid` / `high` / `max`). `/mind` assigns these per block — the cheapest setting that still produces production-ready work. Full policy: `docs/AGENT_MODEL_STRATEGY.md`.

## When and who marks a block done

The **implementing agent that built the block** marks it `[x]` — never `/gatekeeper`, which owns only the **phase-level** checkbox in `docs/PHASES_PLAN.md`. A block may be checked only when everything in `docs/DEFINITION_OF_DONE.md` is satisfied: lint clean, the **user has confirmed** the block's verification, and the change is committed. Format + lint passing alone is never enough.

## Pointing an agent at a plan

Include the plan file as an `@` reference when invoking an agent:

```
/visualizer @docs/plans/phase-1/PHASE_1_7_PLAN.md  Continue Block B
```

The agent receives the full file and reads this guide (triggered by the `docs/plans/` path in the source-of-truth table).
