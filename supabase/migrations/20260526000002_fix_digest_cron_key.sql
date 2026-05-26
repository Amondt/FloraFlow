-- Fix the cron schedule to use the CLI v2 service role key.
-- The previous migration used the CLI v1 JWT signature; the CLI v2 signs with a
-- different secret. Key is embedded directly — ALTER DATABASE SET was removed
-- because it requires superuser privileges not available to the migration runner.
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
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    ),
    body    := '{}'::jsonb
  );
  $$
  );
