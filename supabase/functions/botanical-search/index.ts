import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { toSentenceCase } from '../_shared/text.ts';

type BotanicalResult = {
  scientific_name: string;
  common_name: string;
  perenual_id: number | null;
};

// How many cached results to read back when the cache is warm.
const MAX_RESULTS = 30;

// Only skip the Perenual round-trip when the cache holds at least a full page's
// worth of results. One Perenual page returns up to 30 items — if cache has fewer,
// pagination has not completed for this query and must run again. Setting this equal
// to MAX_RESULTS means the early-return fires if and only if the DB is already
// saturated (≥ 30 matching records), preventing partial caches from locking in.
const CACHE_THRESHOLD = MAX_RESULTS;

// Maximum number of Perenual pages to fetch per search. Each page returns ~30
// results. 5 pages = up to 150 species — sufficient for any query while keeping
// total wall-clock time well inside Supabase's 55s edge-function limit.
const MAX_PAGES = 5;

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

    // Only the three fields Angular's BotanicalSuggestion interface consumes.
    // Enrichment fields (is_ai_enriched, watering, cycle, etc.) are written by
    // claude-enrichment and cache-enrichment-worker — never read during search.
    const { data: cached } = await supabase
      .from('cached_botanical_records')
      .select('scientific_name, common_name, perenual_id')
      .or(`common_name.ilike.%${safeQ}%,scientific_name.ilike.%${safeQ}%`)
      .limit(MAX_RESULTS);

    // Cache is warm enough — serve immediately and skip the Perenual round-trip
    if ((cached?.length ?? 0) >= CACHE_THRESHOLD) return json(cached);

    // Cache miss or partial cache — page through Perenual until results are exhausted
    // or the safety cap is reached. Degrade silently on any network failure so the
    // user still receives whatever was already cached.
    const fresh: BotanicalResult[] = [];

    try {
      const apiKey = Deno.env.get('PERENUAL_API_KEY') ?? '';
      let page = 1;

      while (page <= MAX_PAGES) {
        const resp = await fetch(
          `https://perenual.com/api/v2/species-list?key=${apiKey}&q=${encodeURIComponent(q)}&page=${page}`,
          { signal: AbortSignal.timeout(8000) },
        );
        if (!resp.ok) throw new Error(`Perenual responded ${resp.status}`);

        const body = (await resp.json()) as { data?: Record<string, unknown>[] };

        // Empty page signals no more results — stop fetching
        if (!body.data || body.data.length === 0) break;

        // Build the batch for this page before writing — one DB round-trip per page
        // instead of one per plant (30× fewer upserts for a full page).
        const pageRecords: {
          scientific_name: string;
          common_name: string;
          perenual_id: number;
          raw_api_payload: Record<string, unknown>;
        }[] = [];

        for (const plant of body.data) {
          // Perenual returns scientific_name as an array — take the first entry
          const names = plant['scientific_name'] as string[] | undefined;
          const scientificName = names?.[0];
          if (!scientificName) continue;

          const commonName = toSentenceCase(
            (plant['common_name'] as string | null) ?? scientificName,
          );
          const perenualId = plant['id'] as number;

          pageRecords.push({
            scientific_name: scientificName,
            common_name: commonName,
            perenual_id: perenualId,
            raw_api_payload: plant,
          });

          fresh.push({
            scientific_name: scientificName,
            common_name: commonName,
            perenual_id: perenualId,
          });
        }

        // Persist all records from this page in one batch. Care fields (watering, pH,
        // toxicity) are written later by the background cache-enrichment-worker — never
        // during search, where the user may never select most of these results.
        if (pageRecords.length > 0) {
          await supabase
            .from('cached_botanical_records')
            .upsert(pageRecords, { onConflict: 'scientific_name' });
        }

        page++;
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
