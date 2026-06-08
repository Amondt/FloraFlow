import { createClient } from '@supabase/supabase-js';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { toSentenceCase } from '../_shared/text.ts';
import { deriveSpeciesId } from '../_shared/inat.ts';

type BotanicalResult = {
  scientific_name: string;
  common_name: string;
  inat_taxon_id: number | null;
  thumbnail_url: string | null;
};

// How many results to return to the autocomplete caller.
const MAX_RESULTS = 30;

// How many records to fetch from iNaturalist for cache warming.
// Larger than MAX_RESULTS so the cache fills deeply on first search;
// subsequent queries for similar terms hit the warm cache immediately.
const MAX_UPSERT = 100;

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

    // Cache miss or partial cache — fetch from iNaturalist.
    // No rank=species so hybrids are included; taxon_id=47126 restricts to Plantae;
    // is_active=true excludes deprecated/merged taxa; locale=en forces English common names.
    // Fetch MAX_UPSERT records to warm the cache widely; return only MAX_RESULTS to caller.
    const fresh: BotanicalResult[] = [];

    try {
      const resp = await fetch(
        `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(q)}&taxon_id=47126&is_active=true&per_page=${MAX_UPSERT}&locale=en`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!resp.ok) throw new Error(`iNaturalist responded ${resp.status}`);

      const body = (await resp.json()) as { results?: Record<string, unknown>[] };

      const upsertBatch: {
        scientific_name: string;
        common_name: string;
        inat_taxon_id: number;
        inat_species_id: number | null;
        inat_rank: string | null;
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
        const rankLevel = taxon['rank_level'] as number | undefined;
        const parentId = taxon['parent_id'] as number | undefined;
        const rank = (taxon['rank'] as string | undefined) ?? null;

        const speciesId =
          rankLevel != null
            ? deriveSpeciesId({ id: inatTaxonId, rank_level: rankLevel, parent_id: parentId })
            : null;

        const defaultPhoto = taxon['default_photo'] as Record<string, unknown> | null | undefined;
        const thumbnailUrl = (defaultPhoto?.['url'] as string | undefined) ?? null;
        const regularUrl = (defaultPhoto?.['medium_url'] as string | undefined) ?? null;

        upsertBatch.push({
          scientific_name: scientificName,
          common_name: commonName,
          inat_taxon_id: inatTaxonId,
          inat_species_id: speciesId,
          inat_rank: rank,
          thumbnail_url: thumbnailUrl,
          regular_url: regularUrl,
          // Photos arrive inline — mark as fetched so the enrichment cron skips the
          // iNat thumbnail call for these records.
          thumbnail_fetched: true,
        });

        // Only the first MAX_RESULTS entries go back to the caller.
        // The rest are cache-warming only — they never reach the autocomplete dropdown.
        if (fresh.length < MAX_RESULTS) {
          fresh.push({
            scientific_name: scientificName,
            common_name: commonName,
            inat_taxon_id: inatTaxonId,
            thumbnail_url: thumbnailUrl,
          });
        }
      }

      // Deduplicate by scientific_name before upserting. iNaturalist can return the
      // same binomial twice (e.g. a hybrid and its cultivar share a name). Postgres
      // raises "ON CONFLICT DO UPDATE command cannot affect row a second time" when
      // the same primary key appears more than once in a single batch, aborting the
      // entire upsert and leaving the cache empty.
      const seenNames = new Set<string>();
      const dedupedBatch = upsertBatch.filter(({ scientific_name }) => {
        if (seenNames.has(scientific_name)) return false;
        seenNames.add(scientific_name);
        return true;
      });

      // Persist all records in one batch. Care fields (watering, pH, toxicity) are written
      // later by the background cache-enrichment-worker — never during search.
      if (dedupedBatch.length > 0) {
        const { error: upsertError } = await supabase
          .from('cached_botanical_records')
          .upsert(dedupedBatch, { onConflict: 'scientific_name' });
        if (upsertError) {
          console.error(
            '[botanical-search] cache upsert failed:',
            upsertError.message,
            upsertError.details,
          );
        }
      }
    } catch (err) {
      console.error('iNaturalist fetch failed — returning cached results only:', err);
    }

    // Merge cached hits with newly fetched results; deduplicate by scientific_name.
    // Slice to MAX_RESULTS so the response is always bounded even when cache + fresh overlap.
    const seen = new Set((cached ?? []).map((r) => r.scientific_name));
    const merged = [...(cached ?? []), ...fresh.filter((r) => !seen.has(r.scientific_name))];

    return json(merged.slice(0, MAX_RESULTS));
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
