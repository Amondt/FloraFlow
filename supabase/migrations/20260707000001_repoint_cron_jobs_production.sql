-- Phase 6 Block E — re-point the three pg_cron jobs from the local
-- Docker host to the hosted production Edge Functions URL.
--
-- The `x-cron-secret` value is never written into this file: each job body
-- looks it up from Vault (`vault.decrypted_secrets`, secret name
-- `cron_secret`) at execution time, so the committed migration only ever
-- contains a reference to the secret's name, not its value. This also fixes
-- the digest job, which was still calling the unavailable
-- `extensions.http_post` — all three jobs now use `net.http_post`.
SELECT
  cron.unschedule ('cache-enrichment-worker');

SELECT
  cron.unschedule ('monday-morning-digest');

SELECT
  cron.unschedule ('daily-push-alerts');

SELECT
  cron.schedule (
    'cache-enrichment-worker',
    '0 * * * *',
    $$
    SELECT net.http_post(
      url     := 'https://uqezfdmtkcoailbuxmsp.supabase.co/functions/v1/cache-enrichment-worker',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
    $$
  );

SELECT
  cron.schedule (
    'monday-morning-digest',
    '0 7 * * 1',
    $$
    SELECT net.http_post(
      url     := 'https://uqezfdmtkcoailbuxmsp.supabase.co/functions/v1/digest-email',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
    $$
  );

SELECT
  cron.schedule (
    'daily-push-alerts',
    '0 8 * * *',
    $$
    SELECT net.http_post(
      url     := 'https://uqezfdmtkcoailbuxmsp.supabase.co/functions/v1/push-plant-alerts',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body    := '{}'::jsonb
    );
    $$
  );
