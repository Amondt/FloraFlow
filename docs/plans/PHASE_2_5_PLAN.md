# Phase 2.5 — Open-Meteo Meteorological Proxy

Agent: `/plumber`

Pure backend. No Angular changes. New `weather-proxy` Edge Function + `weather_cache` table.

> **Schema note:** `PHASES_PLAN.md §2.5` references `frost_date_cache` as the cache store. That table is reserved for Phase 3.6 frost date data (`last_spring_frost`, `first_fall_frost`, `hardiness_zone`). Caching live weather fields there would create a column conflict. Per `CLAUDE.md` conflict rules (`DB_SCHEMA_MATRIX.md` > `PHASES_PLAN.md`), Phase 2.5 uses a dedicated `weather_cache` table instead.

---

## Overview

```
weather-proxy (new)
  ├── validate lat/lon params
  ├── cache hit (fetched_at within 30 min) → return immediately
  └── cache miss → call Open-Meteo → upsert weather_cache → return fresh
```

No Angular UI. Consumed by Phase 3.6 frost alerts via `supabase.functions.invoke('weather-proxy')`.

---

## Blocks

- [x] **Block A — `weather_cache` migration** | Agent: `/plumber`
  - New migration file: `supabase/migrations/<timestamp>_weather_cache.sql`
  - Table: `weather_cache` with columns: `id UUID PK`, `latitude NUMERIC(8,5)`, `longitude NUMERIC(8,5)`, `temperature_celsius NUMERIC(5,2)`, `relative_humidity_percent INT`, `precipitation_probability_percent INT`, `fetched_at TIMESTAMPTZ DEFAULT NOW()`
  - `UNIQUE (latitude, longitude)` — enables upsert conflict target; values stored rounded to 2 dp
  - Index: `CREATE INDEX idx_weather_cache_location ON public.weather_cache (latitude, longitude)`
  - RLS: `ENABLE ROW LEVEL SECURITY`
  - SELECT policy: authenticated users can read (same pattern as `cached_botanical_records`)
  - Write policy: `FOR ALL USING (false) WITH CHECK (false)` — service_role only via Edge Function
  - Run `bunx supabase db reset 2>$null` then `bunx supabase gen types typescript --local 2>$null` and copy to `_shared/`

- [ ] **Block B — `weather-proxy` Edge Function** | Agent: `/plumber`
  - New file: `supabase/functions/weather-proxy/index.ts`
  - Auth: require `Authorization` header; verify user JWT via `supabase.auth.getUser()` (same pattern as `botanical-search`)
  - Input: `?lat=&lon=` query params — validate both present, both parseable as numbers, lat in `[-90, 90]`, lon in `[-180, 180]`; return 400 on any failure
  - Round lat/lon to 2 decimal places before all DB operations (`Math.round(val * 100) / 100`)
  - Cache check: query `weather_cache` where `latitude = roundedLat AND longitude = roundedLon AND fetched_at > NOW() - INTERVAL '30 minutes'`; on hit return immediately
  - Open-Meteo call (no API key): `https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m&hourly=precipitation_probability&forecast_days=1&timezone=UTC`
    - Map `current.temperature_2m` → `temperature_celsius`
    - Map `current.relative_humidity_2m` → `relative_humidity_percent`
    - Find current UTC hour index in `hourly.time`; map `hourly.precipitation_probability[index]` → `precipitation_probability_percent`
  - Upsert to `weather_cache` with `onConflict: 'latitude,longitude'`
  - Silent degradation: if Open-Meteo call fails, log to `console.error` and return `{ weather: null }` with HTTP 503
  - Return shape: `{ latitude, longitude, temperature_celsius, relative_humidity_percent, precipitation_probability_percent, fetched_at }`

---

## Verification

After Block A:
```powershell
bunx supabase db test 2>$null
```

After Block B — end-to-end test (local):
1. Start the local Supabase stack
2. Call the function from Supabase Studio Edge Functions → weather-proxy → `?lat=50.85&lon=4.35` (Brussels)
3. Confirm response includes `temperature_celsius`, `relative_humidity_percent`, `precipitation_probability_percent`
4. Query `weather_cache` in Studio — confirm one row with `fetched_at` populated
5. Call again immediately — confirm `fetched_at` is unchanged (cache hit, no outbound call)
6. Confirm client cannot write to `weather_cache` directly (SELECT allowed, INSERT/UPDATE blocked)
