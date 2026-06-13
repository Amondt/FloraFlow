# FloraFlow — Project Instructions

> **Agent behavioral contract.** Cross-cutting code rules live in `docs/CODE_RULES.md`; the done-ritual + QA gates in `docs/DEFINITION_OF_DONE.md`; model/effort in `docs/AGENT_MODEL_STRATEGY.md`. This file points to those — it never restates them.

## Project Context

FloraFlow is a smart gardening app built as a **training project**. Every step is a learning moment — the journey matters as much as the result.

## User Knowledge Profile

| Domain                   | Level       | Implication                                                                                                                          |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Angular                  | Comfortable | Skip basics. Explain _why_ Angular 21 patterns differ from older Angular (`input()` vs `@Input()`, `@if` vs `*ngIf`). Use Angular vocabulary freely. |
| TypeScript               | Comfortable | No need to explain types, interfaces, or generics from scratch.                                                                      |
| Backend / SQL / Supabase | Beginner    | Explain everything: migrations, RLS, Edge Functions, foreign keys. Use Angular analogies.                                           |
| Deno / Edge Functions    | Beginner    | New territory — explain the runtime model, why it differs from Node, what `Deno.serve()` does.                                       |
| AI / Anthropic API       | Beginner    | Explain tokens, system prompts, JSON mode, model selection from first principles.                                                   |

## Teaching-First (Non-Negotiable)

- One small, self-contained block at a time — one function, one component, one SQL statement.
- After each block, explain what it does and why **in the chat response** — concept first, then the code in broad strokes if it is sizeable.
- Use Angular analogies for backend / Deno / AI concepts (see knowledge profile).
- Reference the relevant doc when entering a new domain.

## Tech Stack

| Layer           | Technology                                                           |
| --------------- | -------------------------------------------------------------------- |
| Framework       | Angular 21+ — standalone, Signals-first, zoneless                    |
| Language        | TypeScript strict — no `any`, no `@ts-ignore`                        |
| UI              | PrimeNG v21 PassThrough (unstyled) + Tailwind CSS v4                 |
| Backend         | Supabase — PostgreSQL, Auth, Deno Edge Functions                     |
| AI              | Anthropic Claude (`claude-haiku-4-5-20251001` / `claude-sonnet-4-6`) |
| Testing         | Vitest                                                               |
| Package manager | Bun                                                                  |

## Source-of-Truth Documents

Read **only** the docs a task actually needs — the "Read before…" column is the trigger, not a preload list.

| Doc                            | Read before…                                       |
| ------------------------------ | -------------------------------------------------- |
| `docs/PRD.md`                  | Any feature discussion                             |
| `docs/APP_SPEC.md`             | Creating any Angular file                          |
| `docs/DB_SCHEMA_MATRIX.md`     | Any migration or Supabase query                    |
| `docs/DESIGN_SYSTEM.md`        | Any component styling                              |
| `docs/AI_PROMPT_MANIFEST.md`   | Any Edge Function touching Claude                  |
| `docs/PHASES_PLAN.md`          | Starting any implementation                        |
| `docs/ANGULAR_PATTERNS.md`     | Writing any Angular code                           |
| `docs/BACKEND_PATTERNS.md`     | Writing any Edge Function or migration             |
| `docs/CODE_RULES.md`           | Writing any code (cross-cutting principles)        |
| `docs/DEFINITION_OF_DONE.md`   | Closing any block — verification + QA gates        |
| `docs/PLANS_GUIDE.md`          | Working on any file inside `docs/plans/`           |
| `docs/AGENT_MODEL_STRATEGY.md` | Choosing the model + effort for any agent task     |

### Conflict resolution — priority order

When two sources disagree, the higher-ranked source wins:

1. `CLAUDE.md` — overrides everything for process and behavior rules
2. `src/types/database.types.ts` — ground truth for column names and types (auto-generated; never edit by hand)
3. Migration files in `supabase/migrations/` — ground truth for what is in the DB
4. `docs/DB_SCHEMA_MATRIX.md` — reference spec; migrations may differ if a fix was applied
5. Other `docs/` files — design intent, not runtime truth

**Column verification rule:** before writing any Supabase query or service method, verify the column name exists in `src/types/database.types.ts`. Never invent column names from `DB_SCHEMA_MATRIX.md` without cross-checking the generated types.

### When to stop and ask

Do not fill gaps with assumptions. Stop and ask if:

- The task needs a decision no doc covers (which zone to default to, what error copy to show).
- Two docs conflict and neither is clearly the authority.
- The requested task appears to be in a future phase.

## Live Docs — always use context7

Before using any library API, call context7 — never rely on training memory alone: `resolve-library-id` → `query-docs`. Applies to Angular, PrimeNG, Tailwind v4, Supabase JS, Anthropic SDK, Vitest, Deno std.

## Agents

| Command       | Role                                                        |
| ------------- | ----------------------------------------------------------- |
| `/mind`       | Architecture — structure, doc alignment, task decomposition |
| `/visualizer` | Frontend — Angular components, ARIA, Tailwind styling       |
| `/plumber`    | Data — migrations, RLS, Edge Functions, API proxies         |
| `/gatekeeper` | QA — Vitest, security audits, RLS verification              |
| `/align`      | Pre-feature interview — turns a fuzzy idea into a brief      |
| `/diagnose`   | Disciplined bug-investigation loop                          |
| `/zoom-out`   | Map an unfamiliar area before touching it                   |
| `/handoff`    | Compact a long session into a brief for the next            |

Model & effort per agent: `docs/AGENT_MODEL_STRATEGY.md` (single source — default Sonnet, escalate only for the cases it lists).

### Agent coordination

| Task type                                            | Agent         |
| ---------------------------------------------------- | ------------- |
| New Angular component, template, or PT styling       | `/visualizer` |
| New migration, RLS policy, RPC, or Edge Function     | `/plumber`    |
| Architecture review, phase alignment, file placement | `/mind`       |
| Test coverage, security audit, RLS verification      | `/gatekeeper` |

**New feature end-to-end:** `/mind` (plan) → `/plumber` (schema + RPC) → `/visualizer` (UI) → `/gatekeeper` (tests + audit). Each agent reads only the docs its task requires.

## Code & process rules — single sources

- **Engineering principles** (DRY, Single Responsibility, Separation of Concerns, descriptive names, provenance) → `docs/CODE_RULES.md`
- **Angular 21 non-negotiable patterns** → `docs/ANGULAR_PATTERNS.md`
- **Backend** (migration / RLS / Edge / Deno) → `docs/BACKEND_PATTERNS.md`
- **Definition of Done** (format+lint ritual, Manual Browser Check, checkbox ownership, the 3 QA gates) → `docs/DEFINITION_OF_DONE.md`

## Project commands (real scripts only)

- `bun run dev` — Angular serve + Tailwind watch
- `bun run check` — `format` then `lint`
- `bun run test` — Vitest
- `bun run types` — regenerate DB types (also copies them to `supabase/functions/_shared/`)
- `bunx supabase db test` — RLS + schema integrity (pgTAP)
- `bun run functions:serve` — run Edge Functions locally
- Security audit → `/gatekeeper [SECURITY]` (there is no `bun run code-review` script)

## Supabase CLI on Windows (PowerShell)

Always invoke via **`bunx supabase`** — never bare `supabase` (not in PATH) or `bun run supabase` (no script). For local dev use `bunx supabase migration up`, not `db push` (which needs a remote ref). PowerShell shows CLI progress as red stderr — cosmetic noise; check `$LASTEXITCODE -ne 0` for real failure. Full command list in `docs/BACKEND_PATTERNS.md`.

## Git commits

No `Co-Authored-By` or any Claude/AI reference — write messages as if authored by the developer alone. After completing any sub-task, remind the user to `git commit` and `git push` before moving on.

## Phase discipline

Check `docs/PHASES_PLAN.md` before every implementation — active phase only, never jump ahead. Checkbox ownership and the three QA gates live in `docs/DEFINITION_OF_DONE.md`.

## UX-First Planning (Non-Negotiable)

FloraFlow is used by a gardener, not a developer. Start from the user's mental model, not the data model.

- Ask "what does the user _know_ and _care about_?" — design around that.
- Never expose internal primitives in the UI: no raw coordinates, UUIDs, ENUM strings, or DB IDs. Treat any technical input in a spec (e.g. "user enters lat/lon") as an implementation detail and find the user-friendly equivalent (browser geolocation + city search; a human label + icon instead of a raw ENUM).
- When `/mind` plans a phase: describe each block from the user's perspective first (what they see, tap, change), then derive the data layer. If completing a task requires understanding a backend concept, the UX is wrong — redesign it.
