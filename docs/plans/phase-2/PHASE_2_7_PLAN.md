# Phase 2.7 — Web Push Notification Architecture

Agents: `/plumber` → `/visualizer`

Backend-first: DB column, VAPID keys, Edge Function, cron schedule. Then one Angular service that subscribes the browser and persists the endpoint.

---

## Overview

```
profiles.push_subscription (JSONB, nullable)
  └── written by PushNotificationService (Angular) on first login

push-plant-alerts (new Edge Function)
  ├── verify service role key
  ├── query users with push_subscription IS NOT NULL
  ├── for each user: query plants with next_check_due_at <= NOW()
  ├── skip users with zero overdue/due plants
  └── send Web Push payload per user via npm:web-push

pg_cron → net.http_post() → push-plant-alerts (daily 08:00 UTC)
```

VAPID public key is intentionally public — lives in `environment.ts`. Private key stays in Edge Function secrets only.

---

## Blocks

- [x] **Block A — DB Migration: push_subscription column** | Agent: `/plumber`
  - New migration: `ALTER TABLE public.profiles ADD COLUMN push_subscription JSONB;`
  - No new RLS policy needed — existing `"Gardeners can manage their own profile"` FOR ALL already covers the new column
  - Apply with `bunx supabase db reset`
  - Run `bun run types` to regenerate `database.types.ts`

- [x] **Block B — VAPID Key Generation + Secrets** | Agent: `/plumber`
  - One-time key generation: `npx web-push generate-vapid-keys`
  - Add to `supabase/functions/.env`:
    - `VAPID_PUBLIC_KEY=<generated-public-key>`
    - `VAPID_PRIVATE_KEY=<generated-private-key>`
    - `VAPID_SUBJECT=mailto:mondt.alexandre@gmail.com`
  - Add `vapidPublicKey` field to `src/environments/environment.ts` with the public key value (safe to expose — designed to be public)
  - No migration needed

- [x] **Block C — PushNotificationService** | Agent: `/visualizer`
  - New file: `src/app/core/services/push-notification.service.ts`
  - `providedIn: 'root'` singleton
  - `initializePush()` — entry point called from `ShellComponent` constructor
    - Guards: exits silently if `!('serviceWorker' in navigator)` or `!('PushManager' in window)`
    - Checks existing `profiles.push_subscription` — if already stored, skips re-subscription
    - Calls `Notification.requestPermission()` — exits silently on `'denied'`
    - Subscribes via `navigator.serviceWorker.ready` → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(environment.vapidPublicKey) })`
    - Persists the serialized subscription JSON to `profiles.push_subscription` via `SupabaseService`
  - `urlBase64ToUint8Array()` pure helper extracted to `src/app/shared/utils/vapid.util.ts`
  - Wire `inject(PushNotificationService).initializePush()` into `ShellComponent` constructor

- [x] **Block D — push-plant-alerts Edge Function** | Agent: `/plumber`
  - New file: `supabase/functions/push-plant-alerts/index.ts`
  - Auth: same service-role key check as `digest-email` — reject with 401 if header doesn't match `SUPABASE_SERVICE_ROLE_KEY`
  - **Data fetch:**
    1. Init service_role Supabase client
    2. Query `profiles` where `push_subscription IS NOT NULL` — get `id`, `push_subscription`
    3. For each profile: query `plants` where `user_id = profile.id AND next_check_due_at <= NOW()` — count only
    4. Skip profiles with zero due plants
  - **Push payload** — must use Angular ngsw envelope so the built-in SW handler shows the notification automatically (no custom push listener needed):
    ```json
    {
      "notification": {
        "title": "FloraFlow",
        "body": "{N} plant(s) need attention today",
        "data": {
          "onActionClick": {
            "default": { "operation": "navigateLastFocusedOrOpen", "url": "/scheduler" }
          }
        }
      }
    }
    ```
  - **Send:** `webPush.sendNotification(subscription, JSON.stringify(payload))` using `npm:web-push`
    - Pass VAPID details: `{ subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }`
    - Per-user errors caught and logged — never abort the loop
  - **Response:** `{ sent: N, skipped: N, errors: N }` always HTTP 200

- [x] **Block E — Cron Schedule** | Agent: `/plumber`
  - New migration: `supabase/migrations/<timestamp>_push_alerts_cron.sql`
  - `SELECT cron.schedule(...)` calling `net.http_post()` to `push-plant-alerts` at `0 8 * * *` (daily 08:00 UTC)
  - Same `host.docker.internal:54321` pattern as `digest-email` cron
  - Apply with `bunx supabase db reset`
  - Manual test: invoke `push-plant-alerts` from Supabase Studio with service-role Authorization header — confirm `{ sent, skipped, errors }` response and browser push receipt

---

## Verification

After Block A:
```powershell
bunx supabase db reset
bun run types
```
Confirm `push_subscription` column appears in `database.types.ts` under `profiles`.

After Block C (Manual Browser Check):
1. Log in → open DevTools → Application → Notifications — confirm permission prompt fired
2. Confirm `profiles.push_subscription` row is populated in Supabase Studio Table Editor
3. Refresh page → confirm no second permission prompt (already subscribed guard)

After Block D + E:
1. Start local stack with at least one plant with `next_check_due_at <= today`
2. Invoke `push-plant-alerts` from Supabase Studio with `Authorization: Bearer <service-role-key>`
3. Confirm browser receives push notification
4. Confirm `{ sent: 1, skipped: 0, errors: 0 }` (or matching seed data)
5. Invoke with bad Authorization → confirm 401
