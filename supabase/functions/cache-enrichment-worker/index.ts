import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import type { Database } from '../_shared/database.types.ts';
import { json } from '../_shared/response.ts';
import { verifyCronSecret } from '../_shared/cron-auth.ts';
import { enrichRecord } from '../_shared/enrich-record.ts';

// Maximum records to enrich per invocation. Each record calls Claude + iNaturalist
// in parallel (~5–10 s each), so 5 records = ~30 s max — well inside the 55 s limit.
const BATCH_SIZE = 5;

Deno.serve(async (req: Request) => {
  // 1. Preflight
  if (req.method === 'OPTIONS') return new Response('ok');

  // 2. Auth — server-to-server only; no user JWT accepted
  if (!verifyCronSecret(req)) return json({ error: 'Unauthorized' }, 401);

  // 3. Guard — Claude API key must be present before any DB or AI work begins.
  //    Return 503 (upstream unavailable) rather than 500 (internal error).
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!anthropicKey) {
    console.error('cache-enrichment-worker: ANTHROPIC_API_KEY not configured');
    return json({ error: 'Enrichment service not configured' }, 503);
  }

  try {
    // 4. Init clients — supabase uses service role for unrestricted cache writes;
    //    anthropic uses the guarded key from step 3.
    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    // 5. Fetch the next batch of unenriched records — most recently cached first
    //    so species users just searched appear in the library enriched soonest.
    const { data: pendingRecords, error: queryError } = await supabase
      .from('cached_botanical_records')
      .select('scientific_name, common_name')
      .eq('is_ai_enriched', false)
      .order('cached_at', { ascending: false })
      .limit(BATCH_SIZE);

    if (queryError) throw queryError;
    if (!pendingRecords || pendingRecords.length === 0) {
      return json({ processed: 0, errors: 0 });
    }

    // 6. Enrich each record individually — errors are isolated so one failure
    //    does not abort the remaining records in the batch.
    let processed = 0;
    let errors = 0;

    for (const record of pendingRecords) {
      if (!record.scientific_name) {
        console.error('cache-enrichment-worker: skipping record with null scientific_name');
        continue;
      }

      try {
        await enrichRecord(
          supabase,
          anthropic,
          record.scientific_name,
          // common_name falls back to scientific_name when absent — mirrors the
          // same fallback botanical-search applies when first caching the record.
          record.common_name ?? record.scientific_name,
        );
        processed++;
      } catch (enrichErr) {
        console.error(
          `cache-enrichment-worker: enrichment failed for "${record.scientific_name}":`,
          enrichErr,
        );
        errors++;
      }
    }

    return json({ processed, errors });
  } catch (err) {
    console.error('cache-enrichment-worker: fatal error:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
