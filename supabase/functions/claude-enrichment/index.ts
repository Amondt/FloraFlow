import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { EnrichmentError, enrichRecord } from '../_shared/enrich-record.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    // Input validation
    const body = (await req.json()) as { scientificName?: string; commonName?: string };
    const { scientificName, commonName } = body;
    if (!scientificName || !commonName) return json({ error: 'Missing fields' }, 400);

    // Clients
    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    // Enrich — throws EnrichmentError (503) on AI/iNat failure, plain Error (500) on DB errors
    const upserted = await enrichRecord(supabase, anthropic, scientificName, commonName);
    return json(upserted);
  } catch (err) {
    // Preserve the 503 / 500 distinction from EnrichmentError so the Angular client
    // receives the correct status for transient vs. permanent failures.
    const status = err instanceof EnrichmentError ? err.status : 500;
    return json({ error: (err as Error).message }, status);
  }
});
