import { createClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';

// Open-Meteo response shape — only the fields we consume
type OpenMeteoResponse = {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
  };
  hourly: {
    time: string[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    temperature_2m_min: number[];
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Reject unauthenticated callers before doing any work
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // Parse and validate query params
    const params = new URL(req.url).searchParams;
    const latRaw = params.get('lat');
    const lonRaw = params.get('lon');

    if (latRaw === null || lonRaw === null) {
      return json({ error: 'Missing required query params: lat, lon' }, 400);
    }

    const latNum = Number(latRaw);
    const lonNum = Number(lonRaw);

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
      return json({ error: 'lat and lon must be valid numbers' }, 400);
    }
    if (latNum < -90 || latNum > 90) {
      return json({ error: 'lat must be between -90 and 90' }, 400);
    }
    if (lonNum < -180 || lonNum > 180) {
      return json({ error: 'lon must be between -180 and 180' }, 400);
    }

    // Round to 2 dp — matches the UNIQUE(latitude, longitude) constraint's granularity
    const lat = Math.round(latNum * 100) / 100;
    const lon = Math.round(lonNum * 100) / 100;

    // Cache check — return immediately if a fresh row exists (within 30 min)
    const { data: cached } = await supabase
      .from('weather_cache')
      .select(
        'latitude, longitude, temperature_celsius, relative_humidity_percent, precipitation_probability_percent, min_temp_next_24h, fetched_at',
      )
      .eq('latitude', lat)
      .eq('longitude', lon)
      .gte('fetched_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .not('min_temp_next_24h', 'is', null)
      .maybeSingle();

    if (cached) return json(cached);

    // Cache miss — call Open-Meteo (no API key required)
    try {
      const meteoUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,relative_humidity_2m` +
        `&hourly=precipitation_probability` +
        `&daily=temperature_2m_min` +
        `&forecast_days=2&timezone=UTC`;

      const resp = await fetch(meteoUrl);
      if (!resp.ok) throw new Error(`Open-Meteo responded ${resp.status}`);

      const meteo = (await resp.json()) as OpenMeteoResponse;

      // Find the current UTC hour index in hourly.time
      // Open-Meteo formats hourly times as "YYYY-MM-DDTHH:MM" (no seconds)
      const currentHourStr = new Date().toISOString().slice(0, 13) + ':00';
      const hourIndex = meteo.hourly.time.indexOf(currentHourStr);

      const precipProbability =
        hourIndex >= 0 ? (meteo.hourly.precipitation_probability[hourIndex] ?? null) : null;

      const min0 = meteo.daily.temperature_2m_min[0] ?? Infinity;
      const min1 = meteo.daily.temperature_2m_min[1] ?? Infinity;
      const rawMin = Math.min(min0, min1);

      const record = {
        latitude: lat,
        longitude: lon,
        temperature_celsius: meteo.current.temperature_2m,
        relative_humidity_percent: meteo.current.relative_humidity_2m,
        precipitation_probability_percent: precipProbability,
        min_temp_next_24h: Number.isFinite(rawMin) ? rawMin : null,
        fetched_at: new Date().toISOString(),
      };

      await supabase.from('weather_cache').upsert(record, { onConflict: 'latitude,longitude' });

      return json(record);
    } catch (meteoErr) {
      console.error('Open-Meteo fetch failed — degrading gracefully:', meteoErr);
      return json({ weather: null }, 503);
    }
  } catch (err) {
    console.error('[weather-proxy] fatal error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
