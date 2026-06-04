import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';

type BotanicalResult = {
  scientific_name: string;
  common_name: string;
  perenual_id: number | null;
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

    // Require at least 2 characters — avoids full-table scans and useless API calls
    const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
    if (q.length < 2) return json({ error: 'Query must be at least 2 characters' }, 400);

    // Strip PostgREST or-filter structural characters from the query before interpolation.
    // Commas separate conditions; parentheses open/close groupings. If left in, a value
    // like "rose,watering.eq.Frequent" would inject an extra condition into the filter.
    const safeQ = q.replace(/[,)(]/g, '');
    if (safeQ.length < 2) return json([]);

    // Cache check — include enrichment flags so we can identify stale records
    const { data: cached } = await supabase
      .from('cached_botanical_records')
      .select(
        'scientific_name, common_name, perenual_id, is_perenual_enriched, is_ai_enriched, watering, cycle',
      )
      .or(`common_name.ilike.%${safeQ}%,scientific_name.ilike.%${safeQ}%`)
      .limit(8);

    // 5+ hits means the cache is warm enough — skip the Perenual round-trip entirely
    if ((cached?.length ?? 0) >= 5) return json(cached);

    // Cache miss — fetch from Perenual; degrade silently if it fails
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

        const commonName = (plant['common_name'] as string | null) ?? scientificName;
        const perenualId = plant['id'] as number;

        // Persist only the basic search fields + raw payload now.
        // Enriched care fields (pH, toxicity notes, etc.) are populated by claude-enrichment after insertion.
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

      // Second pass: fetch species/details for each result to populate care fields.
      // Done separately because the species-list endpoint only returns taxonomy, not care data.
      // Runs in parallel with Promise.all — each async job handles its own errors so one
      // 404 or timeout never aborts the others. Skip plants already Perenual-enriched — the
      // flag is true regardless of what the details endpoint returned, which correctly handles
      // plants where Perenual legitimately has null care fields.
      const perenualEnriched = new Set(
        (cached ?? []).filter((r) => r.is_perenual_enriched).map((r) => r.scientific_name),
      );
      const detailJobs = fresh.filter(
        (r) => r.perenual_id && !perenualEnriched.has(r.scientific_name),
      );
      await Promise.all(
        detailJobs.map(async (record) => {
          try {
            const detailsResp = await fetch(
              `https://perenual.com/api/v2/species/details/${record.perenual_id}?key=${apiKey}`,
              { signal: AbortSignal.timeout(8000) },
            );
            if (!detailsResp.ok)
              throw new Error(`Perenual details responded ${detailsResp.status}`);

            const details = (await detailsResp.json()) as {
              poisonous_to_pets?: boolean | null;
              watering?: string | null;
              sunlight?: string[] | null;
              cycle?: string | null;
              type?: string | null;
            };

            await supabase.from('cached_botanical_records').upsert(
              {
                scientific_name: record.scientific_name,
                is_toxic_to_pets: details.poisonous_to_pets ?? null,
                watering: details.watering ?? null,
                sunlight: details.sunlight ?? null,
                cycle: details.cycle ?? null,
                plant_type: details.type ?? null,
                is_perenual_enriched: true,
              },
              { onConflict: 'scientific_name' },
            );
          } catch (detailsErr) {
            console.error(
              `Perenual details fetch failed for perenual_id ${record.perenual_id}:`,
              detailsErr,
            );
          }
        }),
      );
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
