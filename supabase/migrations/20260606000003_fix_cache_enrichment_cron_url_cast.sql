-- Replaces the job registered by the previous migration which failed because
-- PostgreSQL infers an unqualified string literal as type `unknown` in
-- named-parameter call syntax. The ::text cast resolves the correct
-- extensions.http_post overload and matches the declared parameter type.
SELECT
  cron.schedule (
    'cache-enrichment-worker',
    '*/10 * * * *',
    $$
  SELECT extensions.http_post(
    url     := 'http://host.docker.internal:54321/functions/v1/cache-enrichment-worker'::text,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
    ),
    body    := '{}'::jsonb
  );
  $$
  );
