import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';
import { z } from 'npm:zod/v4';
import type { Database } from '../_shared/database.types.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

const SYSTEM_PROMPT = `You are the FloraFlow AI Scribe, an elite botanical taxonomist and agricultural data scientist. Your absolute directive is to provide highly precise, empirically grounded plant care metrics. You never hallucinate, invent unverified horticultural parameters, or generate prose.

When provided with a target species common name and scientific name, you must extract specific care parameters based exclusively on known botanical benchmarks for that genus and species. If a specific metric is completely undocumented or highly speculative, you must return a null field value — never substitute a plausible-sounding number.

CRITICAL ACCURACY RULES:
1. check_depth_description must reflect the species' actual watering requirements — not a generic formula. Aroids typically: "Allow top 2–3 cm to dry". Succulents typically: "Let soil dry completely between waterings". Ferns: "Keep consistently moist, check at the surface." Use null if the species is unknown to you.
2. ideal_humidity_min and ideal_humidity_max must be species-specific, not category averages. A Pothos and a Calathea are both tropicals but have different humidity tolerances. Use null if the species-specific range is undocumented.
3. Never invent numbers. A null is always more accurate than a fabricated value.`;

const EnrichmentSchema = z.object({
  scientific_name: z.string(),
  common_name: z.string(),
  ideal_min_ph: z.number(),
  ideal_max_ph: z.number(),
  is_toxic_to_pets: z.boolean(),
  toxicity_notes: z.string().nullable(),
  propagation_methods: z.array(
    z.enum([
      'Stem Cuttings',
      'Leaf Cuttings',
      'Division',
      'Seeds',
      'Air Layering',
      'Offset Separation',
    ]),
  ),
  check_depth_description: z.string().nullable(),
  ideal_humidity_min: z.number().nullable(),
  ideal_humidity_max: z.number().nullable(),
  care_difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).nullable(),
  is_ai_enriched: z.literal(true),
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as { scientificName?: string; commonName?: string };
    const { scientificName, commonName } = body;
    if (!scientificName || !commonName) return json({ error: 'Missing fields' }, 400);

    const supabase = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cached } = await supabase
      .from('cached_botanical_records')
      .select('*')
      .eq('scientific_name', scientificName)
      .maybeSingle();

    if (cached?.is_ai_enriched) return json(cached);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    let parsed: z.infer<typeof EnrichmentSchema>;
    try {
      const msg = await anthropic.messages.parse({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `${scientificName} / ${commonName}` }],
        output_config: { format: zodOutputFormat(EnrichmentSchema) },
      });

      if (!msg.parsed_output) {
        console.error('Claude returned invalid shape for:', scientificName);
        return json({ error: 'AI returned invalid shape' }, 503);
      }
      parsed = msg.parsed_output;
    } catch (err) {
      console.error('Claude enrichment call failed:', err);
      return json({ error: 'Enrichment service unavailable' }, 503);
    }

    const { data: upserted, error: upsertError } = await supabase
      .from('cached_botanical_records')
      .upsert(
        {
          scientific_name: scientificName,
          common_name: commonName,
          ideal_min_ph: parsed.ideal_min_ph,
          ideal_max_ph: parsed.ideal_max_ph,
          is_toxic_to_pets: parsed.is_toxic_to_pets,
          toxicity_notes: parsed.toxicity_notes,
          propagation_methods: parsed.propagation_methods,
          is_ai_enriched: true,
        },
        { onConflict: 'scientific_name' },
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    return json(upserted);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
