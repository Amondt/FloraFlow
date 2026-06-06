import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { toSentenceCase } from '../_shared/text.ts';

type BotanicalResult = {
  scientific_name: string;
  common_name: string;
  perenual_id: number | null;
};

// How many results to return from cache and to cap the Perenual page at.
// Perenual's free tier returns one page at a time; one page is ~30 results.
const MAX_RESULTS = 30;

// Only skip the Perenual round-trip when the cache already holds a comprehensive
// result set for this query. A threshold as low as 5 causes the cache to lock in
// after the first few results and never surface more — users see the same small
// list forever. 25 ensures we re-fetch until the cache is truly saturated.
const CACHE_THRESHOLD = 25;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
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

    // Require at least 2 characters — avoids full-table scans and useless API calls
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return json({ error: 'Query must be at least 2 characters' }, 400);

    // Strip PostgREST or-filter structural characters from the query before interpolation.
    // Commas separate conditions; parentheses open/close groupings. If left in, a value
    // like "rose,watering.eq.Frequent" would inject an extra condition into the filter.
    const safeQ = q.replace(/[,)(]/g, '');
    if (safeQ.length < 2) return json([]);

    const { data: cached } = await supabase
      .from('cached_botanical_records')
      .select(
        'scientific_name, common_name, perenual_id, is_perenual_enriched, is_ai_enriched, watering, cycle',
      )
      .or(`common_name.ilike.%${safeQ}%,scientific_name.ilike.%${safeQ}%`)
      .limit(MAX_RESULTS);

    // Cache is warm enough — serve immediately and skip the Perenual round-trip
    if ((cached?.length ?? 0) >= CACHE_THRESHOLD) return json(cached);

    // Cache miss or partial cache — fetch from Perenual; degrade silently if it fails
    const fresh: BotanicalResult[] = [];

    try {
      const apiKey = Deno.env.get('PERENUAL_API_KEY') ?? '';
      const resp = await fetch(
        `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!resp.ok) throw new Error(`Perenual responded ${resp.status}`);

      const body = (await resp.json()) as { data?: Record<string, unknown>[] };

      for (const plant of body.data ?? []) {
        // Perenual returns scientific_name as an array — take the first entry
        const names = plant['scientific_name'] as string[] | undefined;
        const scientificName = names?.[0];
        if (!scientificName) continue;

        const commonName = toSentenceCase(
          (plant['common_name'] as string | null) ?? scientificName,
        );
        const perenualId = plant['id'] as number;

        // Persist basic search fields now. Care fields (watering, pH, toxicity) are
        // populated later by claude-enrichment when the plant is actually saved —
        // not during search, where the user may never select this result.
        await supabase.from('cached_botanical_records').upsert(
          {
            scientific_name: scientificName,
            common_name: commonName,
            perenual_id: perenualId,
            raw_api_payload: plant,
          },
          { onConflict: 'scientific_name' },
        );

        fresh.push({
          scientific_name: scientificName,
          common_name: commonName,
          perenual_id: perenualId,
        });
      }
    } catch (err) {
      console.error('Perenual fetch failed — returning cached results only:', err);
    }

    // Merge cached hits with newly fetched results; deduplicate by scientific_name
    const seen = new Set((cached ?? []).map((r) => r.scientific_name));
    const merged = [...(cached ?? []), ...fresh.filter((r) => !seen.has(r.scientific_name))];

    return json(merged);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
