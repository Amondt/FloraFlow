# FloraFlow — Project Instructions

## Project Context

FloraFlow is a smart gardening app built as a **training project**. Every step is a learning moment — the journey matters as much as the result.

## User Knowledge Profile

| Domain                   | Level       | Implication                                                                                                                                                                                                 |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Angular                  | Comfortable | Skip basic Angular concepts. Focus explanations on _why_ Angular 21 patterns differ from older Angular (e.g. why `input()` replaces `@Input()`, why `@if` replaces `*ngIf`). Use Angular vocabulary freely. |
| TypeScript               | Comfortable | No need to explain types, interfaces, or generics from scratch.                                                                                                                                             |
| Backend / SQL / Supabase | Beginner    | Explain everything: what a migration is, what RLS means, why Edge Functions exist, what a foreign key does. Use Angular analogies where helpful.                                                            |
| Deno / Edge Functions    | Beginner    | Treat as new territory — explain the runtime model, why it differs from Node, what `Deno.serve()` does.                                                                                                     |
| AI / Anthropic API       | Beginner    | Explain tokens, system prompts, JSON mode, model selection from first principles.                                                                                                                           |

## Teaching-First (Non-Negotiable)

- One small, self-contained block at a time — one function, one component, one SQL statement
- After each block, explain what it does and why **in the chat response**
- Always explain the concept before the code, use Angular analogies where they help
- After explaining the concept, explain to me the added code and how it works, in the big lines if added code is consequent
- Reference the relevant doc when entering a new domain

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

| Doc                          | Read before…                             |
| ---------------------------- | ---------------------------------------- |
| `docs/PRD.md`                | Any feature discussion                   |
| `docs/APP_SPEC.md`           | Creating any Angular file                |
| `docs/DB_SCHEMA_MATRIX.md`   | Any migration or Supabase query          |
| `docs/DESIGN_SYSTEM.md`      | Any component styling                    |
| `docs/AI_PROMPT_MANIFEST.md` | Any Edge Function touching Claude        |
| `docs/PHASES_PLAN.md`        | Starting any implementation              |
| `docs/ANGULAR_PATTERNS.md`   | Writing any Angular code                 |
| `docs/BACKEND_PATTERNS.md`   | Writing any Edge Function or migration   |
| `docs/PLANS_GUIDE.md`        | Working on any file inside `docs/plans/` |
| `docs/AGENT_MODEL_STRATEGY.md` | Choosing the model + effort for any agent task or plan |

### Conflict resolution — priority order

When two sources disagree, the higher-ranked source wins:

1. `CLAUDE.md` — overrides everything for process and behavior rules
2. `src/types/database.types.ts` — ground truth for column names and types (auto-generated from live schema; never edit by hand)
3. Actual migration files in `supabase/migrations/` — ground truth for what is in the DB
4. `docs/DB_SCHEMA_MATRIX.md` — reference spec; migrations may differ if a fix was applied
5. Other `docs/` files — design intent, not runtime truth

**Column verification rule:** Before writing any Supabase query or service method, verify the column name exists in `src/types/database.types.ts`. Never invent column names from `DB_SCHEMA_MATRIX.md` without cross-checking the generated types.

### When to stop and ask

Do not fill gaps with assumptions. Stop and ask the user if:

- The task requires a decision not covered by any doc (e.g., which zone to default to, what error copy to show)
- Two docs conflict and neither is clearly the authority
- The requested task appears to be in a future phase

## Live Docs — Always use context7

Before using any library API, call context7 — never rely on training memory alone:

1. `mcp__context7__resolve-library-id` → get library ID
2. `mcp__context7__query-docs` → fetch the specific topic

Applies to: Angular, PrimeNG, Tailwind v4, Supabase JS, Anthropic SDK, Vitest, Deno std.

## Agents

| Command       | Role                                                        |
| ------------- | ----------------------------------------------------------- |
| `/mind`       | Architecture — structure, doc alignment, task decomposition |
| `/visualizer` | Frontend — Angular components, ARIA, Tailwind styling       |
| `/plumber`    | Data — migrations, RLS, Edge Functions, API proxies         |
| `/gatekeeper` | QA — Vitest, security audits, RLS verification              |

**Model & effort per agent:** default to Sonnet at low/mid effort; escalate to Opus (and `high`/`max` effort) only for new phase plans, multi-role RLS, complex Edge Functions, and security audits. Full table: `docs/AGENT_MODEL_STRATEGY.md`.

## Agent Coordination

### Single-agent tasks

| Task type                                            | Agent         |
| ---------------------------------------------------- | ------------- |
| New Angular component, template, or PT styling       | `/visualizer` |
| New migration, RLS policy, RPC, or Edge Function     | `/plumber`    |
| Architecture review, phase alignment, file placement | `/mind`       |
| Test coverage, security audit, RLS verification      | `/gatekeeper` |

### Multi-agent chains

- **New feature end-to-end:** `/mind` (plan + structure) → `/plumber` (schema + RPC) → `/visualizer` (UI) → `/gatekeeper` (tests + audit)
- **RPC bug:** `/plumber` (migration fix) → `/gatekeeper` (`bunx supabase db test`)
- **New UI component with data:** `/visualizer` (component) → `/plumber` (query/service) → `/gatekeeper` (lint + test)

### Doc loading rule

Each agent reads **only the docs required for its specific task**. The "Read before…" column in the Source-of-Truth table is the trigger — not a preload list. An agent building a migration does not need to load `DESIGN_SYSTEM.md`; an agent styling a component does not need `DB_SCHEMA_MATRIX.md`.

## Code Rules

- No inline CSS — Tailwind tokens from `docs/DESIGN_SYSTEM.md` only
- Semantic HTML — `<article>`, `<section>`, `<nav>`, `<main>` — no bare `<div>` layouts
- ARIA — `aria-label`, `role`, `aria-describedby` on every interactive element
- Standalone Angular components only — no NgModules
- Signals over RxJS — use RxJS only when Signals cannot do the job
- Secrets in Edge Functions only — never in client bundles
- No fabricated API fields — verify everything via context7 or official docs
- No block labels in source comments — comments may reference a phase (e.g. "Phase 2.5") but never a specific block (e.g. "Block A", "Block B"). Block labels are temporary planning artifacts in `docs/plans/` and rot as plans evolve. Describe _what_ the code does and _why_, not how it was organised in a plan.
- `cursor-pointer` on every interactive native `<button>` — browsers apply `cursor: default` to buttons by default. Any `<button>` styled as a link, chip, or inline action must have `cursor-pointer` in its class list. PrimeNG `<p-button>` handles this automatically; native `<button>` does not.
- DRY (Don't Repeat Yourself) — never duplicate logic across files. Extract shared pure functions to `src/app/shared/utils/`, shared presentational components to `src/app/shared/components/`, and global singletons to `src/app/core/services/`. Three identical lines is the threshold — at that point, extract.
- **Single Responsibility** — each component, service, and Edge Function does exactly one job. A component that fetches data AND renders UI must split: smart container (data, loading, error) + dumb presentational component (template only, no service calls).
- **Separation of Concerns** — presentation in templates, business logic in services, data access in Supabase queries or Edge Functions. Never mix layers. An Edge Function that handles auth, AI, and DB writes does so in clearly separated steps — never interleaved.
- **Descriptive names** — names must communicate intent without needing a comment. `getUserPlantsByZone()` not `getData()`. Booleans use `is`, `has`, `can`, `should` prefixes: `isLoading`, `hasError`, `canSubmit`. No single-letter variables outside loop indices (`i`, `j`).

## Angular 21 — Non-Negotiable Patterns

Full patterns with examples: `docs/ANGULAR_PATTERNS.md`. Required summary: `inject()` DI; `input()`/`output()`/`model()` signals; `@if`/`@for (track id)`/`@switch` control flow; `signal()`/`computed()`/`effect()`/`linkedSignal()` state; `@let` template vars; `@defer` lazy content; `httpResource()` async data; `afterNextRender()` DOM access; `loadComponent` routes; `provideZonelessChangeDetection()` + `provideHttpClient(withFetch())` app config.

## Manual Browser Verification (Non-Negotiable)

No agent may open the Playwright MCP browser. After every UI block, the agent must output a **Manual Browser Check** — a numbered checklist the user performs in the already-running dev server (`http://localhost:4200`). Format:

```
Manual Browser Check — [Component Name]
────────────────────────────────────────
App running at: http://localhost:4200/<route>

1. <action> → <expected result>
2. <action> → <expected result>
...
N. Open DevTools Console → confirm zero red errors
```

The block is not complete until the user confirms all items pass. Agents must wait for that confirmation before marking anything done.

## Formatting + Linting (Non-Negotiable)

Run both after every code block, in this order:

1. `bun run format` — Prettier formats TS, HTML, CSS, and SQL files (no columnar alignment, consistent style)
2. `bun run lint` — ESLint + `@angular-eslint`; fix all errors before reporting done

Every plan's verification section must include both commands explicitly, in this order, before any Manual Browser Check or DB verification step:

```powershell
bun run format
bun run lint
```

## Testing

- `bun run test` — Vitest unit and component tests
- `bun run e2e` — Playwright end-to-end flows
- `bunx supabase db test` — RLS and schema integrity
- `bun run code-review --mode=SECURITY` — security audit

## Supabase CLI on Windows (PowerShell)

**Always invoke via `bunx supabase` — never `supabase` bare (not in PATH) or `bun run supabase` (no script).**

PowerShell 5.1 shows Supabase CLI progress as red stderr output — this is cosmetic noise, not real errors. Ignore red output; check `$LASTEXITCODE -ne 0` to detect actual failure. Full command list in `docs/BACKEND_PATTERNS.md`.

## Git Commits

No `Co-Authored-By` or any Claude/AI reference in commit messages. Write commit messages as if authored by the developer alone.

After completing any sub-task, remind the user to `git commit` and `git push` before moving on.

## Task Done Checklist

A sub-task is only complete when **all** of the following are true:

- [ ] `bun run format` applied (Prettier — TS, HTML, CSS, SQL)
- [ ] `bun run lint` passes with zero errors
- [ ] For Angular code: user has confirmed the Manual Browser Check (all items pass)
- [ ] For migrations/RPCs: agent provides the push command and verification query; user runs both and pastes the result back
- [ ] For RLS/schema tests: agent provides `bunx supabase db test`; user runs it and confirms output
- [ ] For schema changes: agent provides `bun run types`; user runs it and confirms `database.types.ts` was updated
- [ ] Block checkbox in `docs/plans/*.md` marked `[x]` by the implementing agent **only after the user confirms** the verification step passes — format + lint alone are not sufficient
- [ ] Phase checkbox in `docs/PHASES_PLAN.md` marked `[x]` by `/gatekeeper` after full QA
- [ ] User reminded to `git commit` before moving on

## Phase Discipline

Check `docs/PHASES_PLAN.md` before every implementation. Active phase only — never jump ahead.

**Checkpoint responsibilities — two levels:**

- **Block level** (`docs/plans/*.md`) — implementing agents (`/plumber`, `/visualizer`, `/mind`) mark the block `[x]` as soon as format, lint, and the block's own verification pass. No waiting for `/gatekeeper`.
- **Phase level** (`docs/PHASES_PLAN.md`) — only `/gatekeeper` marks the phase sub-task `[x]`, after (1) every block in the plan file is `[x]` and (2) every QA acceptance criterion in the phase's `🔒 QA Criteria` section has passed and the user has confirmed it.

**Implementing agents (`/plumber`, `/visualizer`, `/mind`) must never tell the user to call `/gatekeeper` after each individual block.** Just stop after completing a block — the user decides when to QA. The only exception: after the **last block of a phase**, the correct closing line is: "All blocks done — call `/gatekeeper` to close out the phase."

## UX-First Planning (Non-Negotiable)

FloraFlow is used by a gardener, not a developer. Every planning decision must start from the user's mental model, not the data model.

**Before designing any user-facing input or interaction:**

1. Ask: "What does the user _know_ and _care about_?" — then design around that.
2. Never expose internal technical primitives in the UI: no raw coordinates, no UUID fields, no ENUM string values, no database IDs.
3. If a spec describes a technical input (e.g. "user enters lat/lon"), treat it as an implementation detail, not a UX requirement. Find the user-friendly equivalent (e.g. city autocomplete + browser geolocation) and use that instead.

**Examples of the anti-pattern to avoid:**

- Asking a user to enter latitude/longitude → use browser geolocation + city search
- Showing a raw `growth_stage_type` ENUM value → show a human label with an icon
- Asking a user to pick a `perenual_id` → hide it; populate it from the autocomplete result

**When `/mind` plans a phase:**

- Describe each user-facing block from the user's perspective first: what they see, what they tap, what changes.
- Derive the data layer from the interaction — not the other way around.
- If the plan requires a user to understand any backend concept to complete a task, the UX is wrong. Redesign it.
