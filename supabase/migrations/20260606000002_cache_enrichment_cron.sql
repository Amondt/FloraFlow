SELECT
  cron.schedule (
    'cache-enrichment-worker',
    '*/10 * * * *',
    $$
  SELECT extensions.http_post(
    url     := 'http://host.docker.internal:54321/functions/v1/cache-enrichment-worker',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
    ),
    body    := '{}'::jsonb
  );
  $$
  );
