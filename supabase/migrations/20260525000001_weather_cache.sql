-- Phase 2.5: weather_cache table
-- Stores short-lived Open-Meteo responses (TTL: 30 min).
-- Written by service_role via weather-proxy Edge Function only.
CREATE TABLE public.weather_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude NUMERIC(8, 5) NOT NULL,
  longitude NUMERIC(8, 5) NOT NULL,
  temperature_celsius NUMERIC(5, 2),
  relative_humidity_percent INT,
  precipitation_probability_percent INT,
  fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (latitude, longitude)
);

-- The UNIQUE constraint above already creates a B-tree index on (latitude, longitude).
-- A separate CREATE INDEX on the same columns would be redundant, so it is omitted.
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can read weather cache" ON public.weather_cache FOR
SELECT
  USING (auth.role () = 'authenticated');

-- Blocks all client writes. The Edge Function uses service_role, which bypasses RLS.
CREATE POLICY "Client writes to weather cache are blocked" ON public.weather_cache FOR ALL USING (FALSE)
WITH
  CHECK (FALSE);
