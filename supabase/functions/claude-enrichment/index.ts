import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';
import { z } from 'npm:zod/v4';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';

const SYSTEM_PROMPT = `You are the FloraFlow AI Scribe, an elite botanical taxonomist and agricultural data scientist. Your absolute directive is to provide highly precise, empirically grounded plant care metrics. You never hallucinate, invent unverified horticultural parameters, or generate prose.

When provided with a target species common name and scientific name, you must extract specific care parameters based exclusively on known botanical benchmarks for that genus and species. If a specific metric is completely undocumented or highly speculative, you must return a null field value — never substitute a plausible-sounding number.

CRITICAL ACCURACY RULES:
1. check_depth_description must reflect the species' actual watering requirements — not a generic formula. Aroids typically: "Allow top 2–3 cm to dry". Succulents typically: "Let soil dry completely between waterings". Ferns: "Keep consistently moist, check at the surface." Use null if the species is unknown to you.
2. ideal_humidity_min and ideal_humidity_max must be species-specific, not category averages. A Pothos and a Calathea are both tropicals but have different humidity tolerances. Use null if the species-specific range is undocumented.
3. Never invent numbers. A null is always more accurate than a fabricated value.
4. watering must be exactly one of: 'Frequent', 'Average', 'Minimum', 'None'. Return null if the species' watering needs are ambiguous or unknown.
5. sunlight must be an array using only these exact values: 'full_sun', 'part_shade', 'full_shade', 'filtered_indirect'. Return null if the species' light requirements are unknown.
6. cycle must be exactly one of: 'Perennial', 'Annual', 'Biennial', 'Biannual'. Return null if the species lifecycle is unclear.
7. propagation_methods must only contain values from this exact list: 'Stem Cuttings', 'Leaf Cuttings', 'Division', 'Seeds', 'Air Layering', 'Offset Separation'. Return an empty array [] if none of those methods apply or if the species' propagation methods are unknown. Never invent a variant.`;

const EnrichmentSchema = z.object({
  scientific_name: z.string(),
  common_name: z.string(),
  ideal_min_ph: z.number(),
  ideal_max_ph: z.number(),
  is_toxic_to_pets: z.boolean(),
  toxicity_notes: z.string().nullable(),
  propagation_methods: z
    .array(
      z.enum([
        'Stem Cuttings',
        'Leaf Cuttings',
        'Division',
        'Seeds',
        'Air Layering',
        'Offset Separation',
      ]),
    )
    .catch([]),
  check_depth_description: z.string().nullable(),
  ideal_humidity_min: z.number().nullable(),
  ideal_humidity_max: z.number().nullable(),
  care_difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).nullable(),
  watering: z.enum(['Frequent', 'Average', 'Minimum', 'None']).nullable(),
  sunlight: z
    .array(z.enum(['full_sun', 'part_shade', 'full_shade', 'filtered_indirect']))
    .nullable(),
  cycle: z.enum(['Perennial', 'Annual', 'Biennial', 'Biannual']).nullable(),
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

    if (cached?.is_ai_enriched && cached?.watering && cached?.cycle) return json(cached);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    let parsed: z.infer<typeof EnrichmentSchema>;
    try {
      const msg = await anthropic.messages.parse({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
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

    const conditionalFields: {
      watering?: string;
      sunlight?: string[];
      cycle?: string;
    } = {};
    if (parsed.watering != null && (cached == null || cached.watering == null)) {
      conditionalFields.watering = parsed.watering;
    }
    if (parsed.sunlight != null && (cached == null || cached.sunlight == null)) {
      conditionalFields.sunlight = parsed.sunlight;
    }
    if (parsed.cycle != null && (cached == null || cached.cycle == null)) {
      conditionalFields.cycle = parsed.cycle;
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
          check_depth_description: parsed.check_depth_description,
          ideal_humidity_min: parsed.ideal_humidity_min,
          ideal_humidity_max: parsed.ideal_humidity_max,
          care_difficulty: parsed.care_difficulty,
          is_ai_enriched: true,
          ...conditionalFields,
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
