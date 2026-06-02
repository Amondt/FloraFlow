-- Migrate monday-morning-digest cron to use x-cron-secret authentication.
--
-- digest-email previously checked the caller against SUPABASE_SERVICE_ROLE_KEY
-- via Authorization: Bearer. BACKEND_PATTERNS.md forbids this pattern: Kong
-- strips the Authorization header before the Deno function receives it, so the
-- old cron job would always return 401 in the production stack.
--
-- push-plant-alerts already uses x-cron-secret correctly. This migration aligns
-- digest-email with that pattern: the custom header passes through Kong untouched.
SELECT
  cron.unschedule ('monday-morning-digest');

SELECT
  cron.schedule (
    'monday-morning-digest',
    '0 7 * * 1',
    $$
    SELECT extensions.http_post(
      url     := 'http://host.docker.internal:54321/functions/v1/digest-email',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
      ),
      body    := '{}'::jsonb
    );
    $$
  );
