# Agent Model & Effort Strategy

Which Claude model and how much thinking budget to spend on each agent task — tuned for clean, production-ready output at the lowest token cost.

## The two levers

Two independent dials control cost and quality. Set both _before_ invoking an agent:

1. **Model** — `Sonnet` (fast, cheap, excellent at well-specified work) or `Opus` (deeper reasoning, higher cost). Switch with `/model`.
2. **Effort** — the extended-thinking budget, set by a keyword in the prompt you give the agent. More thinking = more tokens = deeper reasoning.

| Effort | Prompt keyword | Spend it on                                                       |
| ------ | -------------- | ---------------------------------------------------------------- |
| `low`  | _(none)_       | Mechanical, fully-specified work — the doc already says what to build |
| `mid`  | `think`        | A standard block with minor judgment calls                       |
| `high` | `think hard`   | Multi-file logic, RLS policies, anything security-sensitive      |
| `max`  | `ultrathink`   | New phase plans and full security audits                         |

> `/code-review` has its **own** built-in scale (`low / medium / high / max / ultra`) passed as an argument. That is unrelated to the effort keyword above — don't confuse the two.

## Why Sonnet is the default here

FloraFlow's source-of-truth docs (`ANGULAR_PATTERNS.md`, `DESIGN_SYSTEM.md`, `APP_SPEC.md`, `DB_SCHEMA_MATRIX.md`) remove most of the ambiguity Opus would otherwise resolve. When the right answer is written down and the block is small, Sonnet closes ~90–95% of the gap at a fraction of the cost. Reserve Opus for the few tasks that need reasoning the docs can't supply.

## Per-agent defaults

| Agent         | Default          | Escalate to Opus when…                                                                         |
| ------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| `/mind`       | Sonnet · `mid`   | **Writing a new phase plan from scratch** (multi-block, cross-doc) → Opus · `max`              |
| `/visualizer` | Sonnet · `mid`   | A novel interaction or layout with no documented pattern → Opus · `mid`                         |
| `/plumber`    | Sonnet · `mid`   | **Multi-role RLS, a security-sensitive migration, or a complex Edge Function** → Opus · `high` |
| `/gatekeeper` | Sonnet · `mid`   | **A security audit or RLS verification** → Opus · `high`–`max`                                  |

## Session workflow

1. **Start every session on Sonnet.**
2. Escalate to Opus only for: a new phase plan, multi-role RLS, a complex Edge Function, or a security audit.
3. Drop back to Sonnet for the next mechanical block.

This keeps Opus on the handful of tasks where it pays for itself and off everything else — cutting Opus usage ~60–70% with minimal quality loss.

## How plans encode this

`/mind` names all three on every block title line, using the table above:

```markdown
- [ ] **Block A — DB migration + gallery fetch** | Agent: `/plumber` · Model: Sonnet · Effort: mid
```

See `docs/PLANS_GUIDE.md` for the full block format.
