-- Previous migration used extensions.http_post which does not exist in this
-- Supabase version. pg_net lives in the net schema. Calling cron.schedule with
-- the same job name replaces the stored command in place.
SELECT
  cron.schedule (
    'daily-push-alerts',
    '0 8 * * *',
    $$
    SELECT net.http_post(
      url     := 'http://host.docker.internal:54321/functions/v1/push-plant-alerts',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'x-cron-secret', 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
      ),
      body    := '{}'::jsonb
    );
    $$
  );
