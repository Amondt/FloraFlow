-- Enable pg_net so Postgres can make outbound HTTP requests (used by pg_cron below)
CREATE EXTENSION IF NOT EXISTS pg_net
WITH
  SCHEMA extensions;

-- Enable pg_cron for scheduled SQL jobs; creates the cron schema and functions
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the Monday morning digest (every Monday at 07:00 UTC).
-- pg_cron fires the SQL block; extensions.http_post() sends the HTTP request to
-- the digest-email Edge Function running on the local Docker stack.
-- host.docker.internal is Docker Desktop's hostname for reaching the host
-- machine from inside a container (works on both macOS and Windows).
-- The service role key below is the well-known local dev value (same for every
-- developer's machine). For production, re-run this cron.unschedule / cron.schedule
-- pair via the Supabase dashboard SQL editor using the production key.
SELECT
  cron.schedule (
    'monday-morning-digest',
    '0 7 * * 1',
    $$
    SELECT extensions.http_post(
      url     := 'http://host.docker.internal:54321/functions/v1/digest-email',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SB38'
      ),
      body    := '{}'::jsonb
    );
    $$
  );
