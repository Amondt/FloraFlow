import { createClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { toSentenceCase } from '../_shared/text.ts';

type BotanicalResult = {
  scientific_name: string;
  common_name: string;
  inat_taxon_id: number | null;
  thumbnail_url: string | null;
};

// How many results to request from iNaturalist and how many cached results to serve.
const MAX_RESULTS = 30;

// Only skip the iNaturalist round-trip when the cache holds at least a full page's
// worth of results. If the cache has fewer, it may be a partial result set and the
// live call must run again to fill it.
const CACHE_THRESHOLD = MAX_RESULTS;

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

    // Only the fields Angular's BotanicalSuggestion interface consumes.
    const { data: cached } = await supabase
      .from('cached_botanical_records')
      .select('scientific_name, common_name, inat_taxon_id, thumbnail_url')
      .or(`common_name.ilike.%${safeQ}%,scientific_name.ilike.%${safeQ}%`)
      .limit(MAX_RESULTS);

    // Cache is warm enough — serve immediately and skip the iNaturalist round-trip
    if ((cached?.length ?? 0) >= CACHE_THRESHOLD) return json(cached);

    // Cache miss or partial cache — fetch from iNaturalist (Plantae kingdom, species rank,
    // English common names). Photos are returned inline so no separate thumbnail pass is needed.
    const fresh: BotanicalResult[] = [];

    try {
      const resp = await fetch(
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&taxon_id=47126&rank=species&per_page=${MAX_RESULTS}&locale=en`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!resp.ok) throw new Error(`iNaturalist responded ${resp.status}`);

      const body = (await resp.json()) as { results?: Record<string, unknown>[] };

      const upsertBatch: {
        scientific_name: string;
        common_name: string;
        inat_taxon_id: number;
        thumbnail_url: string | null;
        regular_url: string | null;
        thumbnail_fetched: boolean;
      }[] = [];

      for (const taxon of body.results ?? []) {
        const scientificName = taxon['name'] as string | undefined;
        if (!scientificName) continue;

        const preferredCommonName = taxon['preferred_common_name'] as string | undefined;
        const commonName = toSentenceCase(preferredCommonName ?? scientificName);
        const inatTaxonId = taxon['id'] as number;

        const defaultPhoto = taxon['default_photo'] as Record<string, unknown> | null | undefined;
        const thumbnailUrl = (defaultPhoto?.['url'] as string | undefined) ?? null;
        const regularUrl = (defaultPhoto?.['medium_url'] as string | undefined) ?? null;

        upsertBatch.push({
          scientific_name: scientificName,
          common_name: commonName,
          inat_taxon_id: inatTaxonId,
          thumbnail_url: thumbnailUrl,
          regular_url: regularUrl,
          // Photos arrive inline — mark as fetched so the enrichment cron skips the
          // iNat thumbnail call for these records.
          thumbnail_fetched: true,
        });

        fresh.push({
          scientific_name: scientificName,
          common_name: commonName,
          inat_taxon_id: inatTaxonId,
          thumbnail_url: thumbnailUrl,
        });
      }

      // Persist all records in one batch. Care fields (watering, pH, toxicity) are written
      // later by the background cache-enrichment-worker — never during search.
      if (upsertBatch.length > 0) {
        await supabase
          .from('cached_botanical_records')
          .upsert(upsertBatch, { onConflict: 'scientific_name' });
      }
    } catch (err) {
      console.error('iNaturalist fetch failed — returning cached results only:', err);
    }

    // Merge cached hits with newly fetched results; deduplicate by scientific_name
    const seen = new Set((cached ?? []).map((r) => r.scientific_name));
    const merged = [...(cached ?? []), ...fresh.filter((r) => !seen.has(r.scientific_name))];

    return json(merged);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
