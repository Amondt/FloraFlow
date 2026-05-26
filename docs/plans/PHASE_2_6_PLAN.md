# Phase 2.6 — Monday Morning Email Digest

Agent: `/plumber`

Pure backend. No Angular changes. New `digest-email` Edge Function + pg_cron schedule.

---

## Overview

```
digest-email (new)
  ├── verify service role key (cron caller only — no user JWT)
  ├── query all plants where next_check_due_at <= end of today
  ├── fetch user emails via admin API → group plants by user → by zone
  ├── skip users with zero due plants
  └── send HTML email per user via Resend → log result per user

pg_cron → net.http_post() → digest-email (every Monday 07:00 UTC)
```

No Angular UI. `RESEND_API_KEY` in Edge Function secrets only.

---

## Blocks

- [x] **Block A — extensions + cron schedule migration** | Agent: `/plumber`
  - New migration file: `supabase/migrations/<timestamp>_digest_cron.sql`
  - Enable `pg_net` extension: `CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;`
  - `pg_cron` is pre-enabled in all Supabase instances — no extension DDL needed
  - Store local service role key as a Postgres setting so the cron SQL can reference it at runtime:
    `ALTER DATABASE postgres SET app.settings.service_role_key = '<local-well-known-key>';`
    — The local Supabase service role key is the same for every developer's local instance; this value is safe to commit. Production value is set via the Supabase dashboard SQL editor after deploy.
  - Create named cron schedule:
    ```sql
    SELECT cron.schedule(
      'monday-morning-digest',
      '0 7 * * 1',
      $$
      SELECT net.http_post(
        url     := 'http://host.docker.internal:54321/functions/v1/digest-email',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body    := '{}'::jsonb
      );
      $$
    );
    ```
  - `host.docker.internal` is Docker Desktop's hostname for reaching the host machine (works on macOS and Windows); the local Edge Function runtime listens on port 54321
  - Run `bunx supabase db reset` to apply

- [ ] **Block B — `digest-email` Edge Function** | Agent: `/plumber`
  - New file: `supabase/functions/digest-email/index.ts`
  - **Auth:** This function is server-to-server only (not called by a browser). Verify the caller by comparing the `Authorization` header against `SUPABASE_SERVICE_ROLE_KEY` — reject with 401 if it doesn't match. No user JWT is involved.
  - **Data fetch:**
    1. Init service_role Supabase client
    2. Query `plants` joined to `zones` and `profiles` for all rows where `next_check_due_at <= end of today (UTC)` — select `plant.id`, `common_name`, `scientific_name`, `next_check_due_at`, `zone.name`, `user_id`, `profile.display_name`
    3. Fetch all user emails via `supabase.auth.admin.listUsers()` → build a `Map<userId, email>`
  - **Grouping:** Group plants by `user_id`, then by `zone_name` within each user. Classify each plant as `Overdue` (before today's midnight UTC) or `Due today`.
  - **HTML email template** (inline styles only — email clients strip `<style>` tags):
    - Subject: `Your FloraFlow plant digest — {N} plants need attention`
    - Body: greeting with `display_name`, one `<section>` per zone listing plants with overdue/due badge, CTA link to `http://localhost:4200/scheduler`
    - Plain structure — no external images or fonts
  - **Resend API call** per user:
    - `POST https://api.resend.com/emails` with `Authorization: Bearer <RESEND_API_KEY>`
    - `from`: `FloraFlow <onboarding@resend.dev>` for local/test; swap for a verified domain in production
    - `to`: `[userEmail]`
    - Per-user errors are caught and logged via `console.error` — never abort the loop; continue to the next user
  - **Response:** `{ sent: N, skipped: N, errors: N }` — always HTTP 200 (the cron caller ignores the body; returning 200 prevents pg_cron from treating it as a failure)
  - Add `RESEND_API_KEY=<your-key>` to `supabase/functions/.env`

---

## Verification

After Block A:

```powershell
bunx supabase db test```

Then in Supabase Studio → Table Editor → `cron.job` — confirm one row named `monday-morning-digest` with schedule `0 7 * * 1`.

After Block B — end-to-end test (local):

1. Start local Supabase stack and ensure at least one plant with `next_check_due_at <= today`
2. In Supabase Studio → Edge Functions → `digest-email` → invoke with body `{}` and Authorization header `Bearer <local-service-role-key>`
3. Confirm response: `{ sent: 1, skipped: 0, errors: 0 }` (or matching your seed data)
4. Check inbox (or Resend dashboard → Emails) for the digest email
5. Confirm DevTools / Edge Function logs show zero thrown errors
6. Invoke again with a bad Authorization header → confirm 401
