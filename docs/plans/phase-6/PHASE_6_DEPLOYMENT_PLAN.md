# Phase 6 — Production Deployment

Take FloraFlow live: the Angular SPA/PWA on **Vercel** (free), the whole backend on **hosted Supabase free tier** (Postgres + Auth + Storage + Edge Functions + pg_cron). No feature or schema change — this phase stands up the remote, re-points what is currently localhost-bound, and threads the production origin through CORS + Auth.

**Locked decisions (user, 2026-07-01):**

- **Frontend origin — Vercel default `*.vercel.app`.** No custom domain / DNS block now; a custom domain is an opt-in follow-up. OAuth + CORS are configured once against the Vercel origin.
- **Botanical cache — seed from local export + throttle the worker to hourly.** Import the ~924 already-enriched `cached_botanical_records` so the Library is full on day one; drop `cache-enrichment-worker` from every-10-min to hourly so new species users search still get enriched at near-zero idle cost.
- **Auth email — Google OAuth only, email confirmation stays off.** No custom SMTP block. Email/password signup still works unconfirmed (the app's primary path is "Continue with Google"). Flagged as a minor hardening item, not a blocker.

---

## Why this isn't "just push it" — the three localhost landmines

A naïve `db push` + `vercel deploy` breaks in three places. The whole phase exists to close these.

| # | Landmine | Where | Fix |
| - | -------- | ----- | --- |
| 1 | `environment.prod.ts` is still `your-project-ref` / `your-prod-anon-key` placeholders | `src/environments/environment.prod.ts` | Block F fills real URL + anon key |
| 2 | All three pg_cron jobs POST to `http://host.docker.internal:54321` with a **committed** `x-cron-secret`; digest still calls the unavailable `extensions.http_post` | `supabase/migrations/2026060600000{4,5}…`, `20260602000002_fix_digest_cron_auth.sql` | Block E: re-point migration → production URL, all on `net.http_post`, secret from Vault |
| 3 | CORS origin + Auth Site URL + OAuth redirect are localhost-bound | `_shared/response.ts` (`SITE_URL`), `config.toml` (`site_url`, redirect allow-list) | Block C sets `SITE_URL`; Block G wires Auth + Google OAuth to the Vercel origin |

> **`db push` vs `migration up`:** the project rule "never `db push`" is a **local-dev** rule (push needs a remote ref). For production it is exactly the right command — it applies local migrations *up to the linked remote*. `migration up` only touches the local Docker DB.

---

## Function secrets reference (Block C)

Set on the hosted project via `bunx supabase secrets set`. `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ANON_KEY` are **auto-injected by the platform — never set them.**

| Secret | Consumed by | Value |
| ------ | ----------- | ----- |
| `ANTHROPIC_API_KEY` | claude-vision, claude-plant-id, claude-enrichment, cache-enrichment-worker, translate-text, translate-botanical-record | your Anthropic key |
| `RESEND_API_KEY` | digest-email | your Resend key |
| `SITE_URL` | `_shared/response.ts` (CORS, **all** functions) + digest-email (email links) | the Vercel origin — **finalized in Block G** |
| `VAPID_SUBJECT` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | push-plant-alerts | reuse the existing keypair (public key already in `environment.*.ts`) |
| `CRON_SECRET` | `_shared/cron-auth.ts` (digest-email, push-plant-alerts, cache-enrichment-worker) | **rotated** fresh value (old one is burned in git) — also stored in Vault for Block E |

Google OAuth (`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET`) is **not** a function secret — it is Auth-provider config, set in the Dashboard in Block G.

---

## Blocks

### `[ ]` Block A — Provision + link the hosted project | Agent: `/plumber` · Model: Sonnet · Effort: low

- Create a free-tier Supabase project in an **EU region** (Frankfurt — closest to BE/LU users). Record the project ref, anon (publishable) key, and service_role key.
- `bunx supabase link --project-ref <ref>` (from repo root).
- Confirm `pg_cron`, `pg_net`, and `vault` are enabled on the remote (all available on free tier — Dashboard → Database → Extensions).
- No code. Output: ref + keys feed Blocks C, E, F.

### `[ ]` Block B — Push schema + import botanical seed | Agent: `/plumber` · Model: Sonnet · Effort: low

- `bunx supabase db push` — applies all 40 migrations to the remote. Verify the `plant-journal-images` bucket + its RLS policies landed (Storage tab).
- **Seed import (locked decision):** import the local `cached_botanical_records` (~924 rows) into the remote via `bun run export-seed` output run in the remote SQL editor, so the Library is populated on launch. `db push` does **not** run seeds — this is a deliberate one-shot.
- ⚠️ This step also creates the three cron jobs pointing at `host.docker.internal` — harmless (they just fail to resolve) until Block E replaces them.

### `[ ]` Block C — Set Edge Function secrets | Agent: `/plumber` · Model: Sonnet · Effort: low

- `bunx supabase secrets set` for every row in the table above **except** `SITE_URL` (deferred to Block G once the Vercel origin exists — set it to `*` temporarily or leave unset so CORS is permissive during bring-up).
- Generate a fresh `CRON_SECRET`; also insert it (and the project base URL) into **Vault** for Block E, so the rotated secret never re-enters git.
- Never add `.env` / secret files to `git add`.

### `[ ]` Block D — Deploy Edge Functions | Agent: `/plumber` · Model: Sonnet · Effort: low

- `bunx supabase functions deploy` — all 11 functions. The CLI reads `config.toml`, so the `verify_jwt = false` overrides for the three cron functions ship automatically.
- Smoke-test a user function (`weather-proxy` via `Invoke-RestMethod`) and one cron function (POST with the `x-cron-secret` header → expect 200; without it → expect 401).

### `[ ]` Block E — Production cron re-point migration | Agent: `/plumber` · Model: Sonnet · Effort: mid

- New migration: `cron.unschedule` all three jobs, then `cron.schedule` them against `https://<ref>.supabase.co/functions/v1/…` using **`net.http_post`** for all three (fixes the digest job's unavailable `extensions.http_post` in passing).
- Read the URL base + `x-cron-secret` from **Vault** in the cron body (`vault.decrypted_secrets`) — hardcode neither the secret nor a literal into the committed SQL.
- Schedules: `cache-enrichment-worker` → **`0 * * * *`** (hourly, per locked decision); `monday-morning-digest` → `0 7 * * 1`; `daily-push-alerts` → `0 8 * * *`.
- `bunx supabase db push`. Verify in `cron.job` that the three commands now show the production URL. This is the only code this phase produces.

### `[ ]` Block F — Frontend production config + `vercel.json` | Agent: `/visualizer` · Model: Sonnet · Effort: low

- Fill `src/environments/environment.prod.ts` with the real `supabaseUrl` + anon key (safe to commit — it is a *publishable* key that ships in the bundle regardless; RLS is the real boundary, not the key's secrecy). Keep the existing `vapidPublicKey`.
- Add `vercel.json`: build command `bun run build`, output directory `dist/flora-flow/browser`, SPA rewrite (`/(.*)` → `/index.html`; real files and `ngsw-worker.js` / `ngsw.json` are served by filesystem-match first, so client routes fall through correctly).
- Verify `bun run build` succeeds within the 1 MB initial budget locally.

### `[ ]` Block G — Deploy to Vercel + wire Auth & OAuth URLs | Agent: `/visualizer` → `/plumber` · Model: Sonnet · Effort: mid

- Import the repo to Vercel (or `vercel` CLI); set output `dist/flora-flow/browser`; deploy; capture the `*.vercel.app` origin.
- **Supabase Auth (Dashboard → Authentication → URL Configuration):** Site URL = Vercel origin; Redirect URLs += `https://<origin>/**`.
- **Google Cloud Console** OAuth client: Authorized redirect URIs += `https://<ref>.supabase.co/auth/v1/callback`; Authorized JS origins += the Vercel origin.
- Set the `SITE_URL` secret (Block C) to the Vercel origin and **redeploy functions** (re-run Block D) so CORS locks to the real origin.

### `[ ]` Block H — Production QA smoke gate | Agent: `/gatekeeper` · Model: Sonnet · Effort: mid

- End-to-end on the live URL: Google login → onboarding → create zone + plant → soil check → Library search (proves function reachability + CORS) → Leaf Doctor (proves Claude + `ANTHROPIC_API_KEY`) → journal image upload (proves Storage + RLS) → weather/frost banner.
- Confirm a cron actually fired (Dashboard → Database → Cron, or `cron.job_run_details`).
- Confirm no `service_role` / API secrets in the client bundle; RLS still blocks cross-user reads; `bun run check`.
- Gatekeeper **diagnoses and routes** failures (→ `/plumber` for backend/secrets/cron, `/visualizer` for frontend config) — it does not fix.

---

## Free-tier & cost notes

- **Pausing:** free projects pause after 7 days of *inactivity*; the hourly cron + live traffic keep it warm — not a real risk here.
- **Anthropic spend:** now driven by the hourly worker (near-zero when the cache is full) + user-triggered vision/ID/translate calls. Watch the Anthropic dashboard after launch; throttle the worker further if idle cost is nonzero.
- **Limits:** 500 MB DB, 1 GB storage, 500k function invocations/mo — all comfortable at this scale.
- **Hardening backlog (non-blocking):** rotate the burned cron secret (done via Vault in Block E); consider disabling unconfirmed email/password signup if spam accounts appear (Google OAuth is the intended path).

---

## Sequencing & Definition of Done

- **Order:** A → B → C → D → E form the backend track; F → G the frontend track. The one cross-dependency is `SITE_URL` (Block C value comes from Block G's origin → redeploy functions). Finish with H.
- Each block follows `docs/DEFINITION_OF_DONE.md`: format + lint, **user confirms** verification, commit — only then the implementing agent marks the block `[x]`. Never mark `[x]` on lint alone.
- This plan file is ephemeral (`docs/plans/`); archive once the app is live and stable.
