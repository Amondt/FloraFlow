# Definition of Done

When a unit of work is complete, and who certifies it. Single source — `CLAUDE.md`, every `/command`, and `PLANS_GUIDE.md` link here instead of restating it.

## After every block — the implementing agent runs

In this exact order, fixing all errors before proceeding:

1. `bun run format` — Prettier (TS, HTML, CSS, SQL)
2. `bun run lint` — ESLint + `@angular-eslint`, zero errors

(`bun run check` runs both.)

Then hand the user the block's verification:

- **Frontend** → a **Manual Browser Check** (format below)
- **Migration / RPC** → the verification SQL + `bunx supabase db test`; plus `bun run types` if the schema changed
- **Edge Function** → the `bun run functions:serve` + `Invoke-RestMethod` call to exercise it

## Manual Browser Check format

No agent opens Playwright. The user runs every UI check in the already-running dev server.

```
Manual Browser Check — [Component Name]
────────────────────────────────────────
App running at: http://localhost:4200/<route>

1. <action> → <expected result>
2. <action> → <expected result>
...
N. Open DevTools Console → confirm zero red errors
```

## Who marks the checkbox

- **Block** (`docs/plans/*.md`) — the **implementing agent** (`/mind`, `/plumber`, `/visualizer`) marks it `[x]`, but **only after the user confirms** the verification above passed. Format + lint passing alone is never enough. Never self-certify.
- **Phase** (`docs/PHASES_PLAN.md`) — **only `/gatekeeper`** marks it, after every block in the plan file is `[x]` **and** every `🔒 QA Criteria` item has passed with user confirmation.

Implementing agents never tell the user to call `/gatekeeper` after an individual block — just stop. The one exception is after the **last block of a phase**: _"All blocks done — call `/gatekeeper` to close out the phase."_

## Three QA gates

1. **Block gate** — the per-block verification above. Every block, by the implementing agent + user.
2. **Risk gate** — the moment a block touches **RLS, a new migration, an Edge Function handling secrets, or an AI-JSON → DB write**, run a focused `/gatekeeper [SECURITY]` on that surface immediately. Do not wait for phase end.
3. **Phase gate** — full `/gatekeeper` against every `🔒 QA Criteria` + regression sweep, as the release gate for the phase.

## Git commit — after every block

After the user confirms verification, output a ready-to-paste command listing the exact files changed:

```
git add <file1> <file2> ... -and git commit -m "type(scope): description" && git push
```

Use conventional commit types: `feat`, `fix`, `refactor`, `style`, `test`, `chore`. No `Co-Authored-By`, no Claude/AI reference.

## A block is done when ALL are true

- [ ] `bun run format` applied
- [ ] `bun run lint` passes, zero errors
- [ ] Schema change → `bun run types` run, `database.types.ts` confirmed updated
- [ ] User confirmed the block's verification (Browser Check / `db test` / SQL)
- [ ] Risk gate cleared if the block touched RLS / secrets / migration / AI write
- [ ] Block `[x]` set by the implementing agent (after all the above)
- [ ] User given a ready-to-paste git command (see format below)
