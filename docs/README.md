# FloraFlow — Developer Workspace Manual

FloraFlow is a full-stack, free-tier smart gardening app built with Angular 21+ and developed through a multi-agent Claude Code workflow. This is the **human-facing operating manual**: environment setup, secret routing, and exactly how to drive the AI agents day to day.

Agent behavioural rules live in `../CLAUDE.md`; engineering principles in `CODE_RULES.md`; the done-ritual and QA gates in `DEFINITION_OF_DONE.md`.

---

## 1. ⚙️ Local setup

Prerequisites:

- **Node.js** v22.x LTS or higher (Angular 21 compatibility)
- **Bun** — package manager and script runner
- **Supabase CLI** — always invoked via `bunx supabase` (never bare `supabase`)
- **Docker Desktop** — runs the local Supabase container suite

Bootstrap and run:

    bun install
    bunx supabase init     # only if supabase/ is not yet initialised
    bun run dev            # Angular serve + Tailwind watch → http://localhost:4200

---

## 2. 🔐 Environment variables

Never commit credentials. Client-safe values reach the browser; everything else stays in Edge Function secrets (Deno), invisible to the client bundle. Create a `.env` in the project root:

    # Client-safe — shipped to the browser
    SUPABASE_URL=your_supabase_endpoint_url
    SUPABASE_ANON_KEY=your_public_anon_key

    # Edge Function secrets — never in the frontend bundle
    ANTHROPIC_API_KEY=your_anthropic_api_key    # Claude: enrichment, vision, plant-ID
    RESEND_API_KEY=your_resend_api_key          # Monday-morning digest email
    # PERENUAL_API_KEY=...                       # legacy — Perenual retired in Phase 3.16; kept only for old data

Botanical search now uses the keyless **iNaturalist** taxa API (Phase 3.16), so no botanical-registry key is required.

---

## 3. 🤖 The multi-agent workflow

Each agent is a Claude Code slash command — a markdown prompt file in `.claude/commands/` that Claude Code loads as its working context when you invoke it. No external runtime, package, or `skills.sh`; just prompt files.

### 3.1 Your session loop

```
0. Start on Sonnet (/model). Run the app:  bun run dev
1. Fuzzy idea?       → /align <idea>        → one-paragraph brief        (skip if already clear)
2. Plan it           → /mind <brief>        → numbered block plan saved to docs/plans/
                                              Opus + "ultrathink" ONLY for a brand-new phase plan
                                              review & approve before any code
3. Build one block   → /visualizer <block>  (UI)   or   /plumber <block>  (data / RLS / Edge)
                        default Sonnet · "think" (mid)
4. Verify each block → agent runs format+lint, hands you a Manual Browser Check or db-test / SQL
                        YOU run it → on pass: block checked, git commit
5. Security-sensitive → /gatekeeper [SECURITY] on that block NOW
   block?                (touches RLS / secrets / a migration / an AI→DB write)
6. Stuck?            → /diagnose <symptom>       Unfamiliar code? → /zoom-out <area>
7. Phase's last      → /gatekeeper (full)        → it marks the PHASES_PLAN.md checkbox
   block done                                    → git commit && git push
8. Context filling   → /handoff → paste the brief into a fresh session
```

**You are the verifier.** Agents never self-certify — nothing is "done" until you confirm the Manual Browser Check or `bunx supabase db test`. Full rules: `DEFINITION_OF_DONE.md`.

### 3.2 The agents

| Command       | Role                                     | Reads before acting                                       |
| ------------- | ---------------------------------------- | --------------------------------------------------------- |
| `/mind`       | Architecture & planning                  | `APP_SPEC`, `DB_SCHEMA_MATRIX`, `PHASES_PLAN`, `PLANS_GUIDE` |
| `/visualizer` | Angular components & UI                  | `DESIGN_SYSTEM`, `APP_SPEC`, `ANGULAR_PATTERNS`, `CODE_RULES` |
| `/plumber`    | Supabase, migrations, Edge Functions     | `DB_SCHEMA_MATRIX`, `BACKEND_PATTERNS`, `AI_PROMPT_MANIFEST`, `CODE_RULES` |
| `/gatekeeper` | QA, tests, security                      | `PHASES_PLAN`, `DEFINITION_OF_DONE`, `CODE_RULES`         |
| `/align`      | Pre-feature interview → brief            | run before `/mind` when the feature is fuzzy              |
| `/diagnose`   | Disciplined bug-investigation loop       | —                                                         |
| `/zoom-out`   | Map an unfamiliar area before touching   | —                                                         |
| `/handoff`    | Compact a long session into a brief      | —                                                         |

Which **model + effort** to run each agent at: `AGENT_MODEL_STRATEGY.md`.

### 3.3 Editing agents

All agent definitions live in `.claude/commands/*.md` — edit them directly to adjust any agent's behaviour.

---

## 4. 🎛️ Local verification

- `bun run check` — Prettier + ESLint (run after every code block)
- `bun run test` — Vitest unit and component tests
- `bunx supabase db test` — RLS + schema integrity (pgTAP)
- `/gatekeeper [SECURITY]` — security audit of RLS isolation and client-bundle key leakage

---

## 📁 Directory map

    flora-flow-root/
    ├── src/                      # Angular 21 application
    │   └── app/                  # logic, routing, Signals
    ├── public/
    │   └── i18n/                 # Transloco EN / FR / NL translation files
    ├── supabase/
    │   ├── functions/            # Deno Edge Functions (Claude AI & webhooks)
    │   │   └── _shared/          # shared Edge logic + generated DB types
    │   ├── migrations/           # incremental DDL SQL
    │   └── tests/                # pgTAP RLS tests
    ├── docs/                     # source-of-truth suite (index in CLAUDE.md)
    └── package.json
