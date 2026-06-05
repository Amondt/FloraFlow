import { createClient } from 'npm:@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';
import { z } from 'npm:zod/v4';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { toSentenceCase } from '../_shared/text.ts';

const SYSTEM_PROMPT = `You are the FloraFlow AI Scribe, an elite botanical taxonomist and agricultural data scientist. Your absolute directive is to provide highly precise, empirically grounded plant care metrics. You never hallucinate, invent unverified horticultural parameters, or generate prose.

When provided with a target species common name and scientific name, you must extract specific care parameters based exclusively on known botanical benchmarks for that genus and species. If a specific metric is completely undocumented or highly speculative, you must return a null field value — never substitute a plausible-sounding number.

CRITICAL ACCURACY RULES:
1. check_depth_description must reflect the species' actual watering requirements — not a generic formula. Aroids typically: "Allow top 2–3 cm to dry". Succulents typically: "Let soil dry completely between waterings". Ferns: "Keep consistently moist, check at the surface." Use null if the species is unknown to you.
2. ideal_humidity_min and ideal_humidity_max must be species-specific, not category averages. A Pothos and a Calathea are both tropicals but have different humidity tolerances. Use null if the species-specific range is undocumented.
3. Never invent numbers. A null is always more accurate than a fabricated value.
4. watering must be exactly one of: 'Frequent', 'Average', 'Minimum', 'None'. Return null if the species' watering needs are ambiguous or unknown.
5. sunlight must be an array using only these exact values: 'full_sun', 'part_shade', 'full_shade', 'filtered_indirect'. Return null if the species' light requirements are unknown.
6. cycle must be exactly one of: 'Perennial', 'Annual', 'Biennial', 'Biannual'. Return null if the species lifecycle is unclear.
7. propagation_methods must only contain values from this exact list: 'Stem Cuttings', 'Leaf Cuttings', 'Division', 'Seeds', 'Air Layering', 'Offset Separation'. Return an empty array [] if none apply or if the species' methods are unknown. Never invent a variant.
8. description: 1–2 sentences describing the plant's character and key traits in plain English. Include its visual signature and notable use. Example: "A fast-growing tropical aroid with large fenestrated leaves, prized for dramatic foliage and air-purifying qualities." Return null only for highly obscure species.
9. placement must be exactly one of: 'Indoor', 'Outdoor', 'Both'. 'Indoor' for tender plants unable to survive outdoors in temperate climates. 'Outdoor' for plants requiring direct sun, rain, or frost hardiness. 'Both' for adaptable species. Return null if genuinely unclear.
10. is_tropical: true for species native to tropical or subtropical regions (typically requiring RH > 50%, minimum temperature > 10°C). false for temperate species. Default to false if uncertain — never null.
11. is_toxic_to_humans: true if any part of the plant is known to cause harm when ingested or on skin contact. false if known safe or no data. Default to false if uncertain — never null.
12. human_toxicity_notes: populated only when is_toxic_to_humans is true. Brief clinical note, e.g. "Berries cause severe gastric upset if ingested. Sap may irritate skin and eyes." Return an empty string when is_toxic_to_humans is false.
13. produces_fruit: true if the species produces fruit (including berries, drupes, pods, hips) in typical cultivation. Default to false if uncertain — never null.
14. fruit_season: populated only when produces_fruit is true. Use natural language season ranges, e.g. "Late Summer", "Autumn – Winter", "Spring – Summer". Return an empty string when produces_fruit is false.
15. produces_flowers: true if the species produces flowers in typical cultivation. Default to false if uncertain — never null.
16. flowering_season: populated only when produces_flowers is true. Same format as fruit_season. Return an empty string when produces_flowers is false.
17. growth_rate must be exactly one of: 'Slow', 'Moderate', 'Fast'. Based on typical cultivation rate. Return null if genuinely variable or unknown.
18. maintenance_level must be exactly one of: 'Low', 'Medium', 'High'. 'Low' = tolerates neglect, infrequent watering. 'Medium' = regular watering and occasional attention. 'High' = frequent watering, misting, or precision care required. Return null if unclear.
19. preferred_soil_type: array of applicable descriptors from this exact list only: 'Well-draining', 'Sandy', 'Loamy', 'Clay', 'Peaty', 'Chalky', 'Rich', 'Poor', 'Moisture-retaining'. Return [] if unknown. Never invent descriptors outside this list.
20. native_region: plain-text geographic origin, e.g. "Tropical West Africa", "Mediterranean Basin", "Central and South America". Return null if origin is unclear or highly hybridised.
21. max_height_cm: mature height in centimetres in typical indoor or garden cultivation — not extreme wild specimens. Integer only. Return null if highly variable or unknown.
22. max_spread_cm: mature lateral spread in centimetres. Integer only. Return null if highly variable or unknown.
23. air_purifying: true if the plant is documented to filter indoor VOCs (formaldehyde, benzene, trichloroethylene) per NASA Clean Air Study or peer-reviewed equivalent. false otherwise — never null.`;

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
  description: z.string().nullable(),
  placement: z.enum(['Indoor', 'Outdoor', 'Both']).nullable(),
  is_tropical: z.boolean().catch(false),
  is_toxic_to_humans: z.boolean().catch(false),
  human_toxicity_notes: z.string().catch(''),
  produces_fruit: z.boolean().catch(false),
  fruit_season: z.string().catch(''),
  produces_flowers: z.boolean().catch(false),
  flowering_season: z.string().catch(''),
  growth_rate: z.enum(['Slow', 'Moderate', 'Fast']).nullable(),
  maintenance_level: z.enum(['Low', 'Medium', 'High']).nullable(),
  preferred_soil_type: z
    .array(
      z.enum([
        'Well-draining',
        'Sandy',
        'Loamy',
        'Clay',
        'Peaty',
        'Chalky',
        'Rich',
        'Poor',
        'Moisture-retaining',
      ]),
    )
    .catch([]),
  native_region: z.string().nullable(),
  max_height_cm: z.int().nullable().catch(null),
  max_spread_cm: z.int().nullable().catch(null),
  air_purifying: z.boolean().catch(false),
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

    // Re-enrich existing records that pre-date Phase 3.10 (description is null).
    if (
      cached?.is_ai_enriched &&
      cached?.watering &&
      cached?.cycle &&
      cached?.description != null
    ) {
      return json(cached);
    }

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
          common_name: toSentenceCase(commonName),
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
          description: parsed.description,
          placement: parsed.placement,
          is_tropical: parsed.is_tropical,
          is_toxic_to_humans: parsed.is_toxic_to_humans,
          human_toxicity_notes: parsed.human_toxicity_notes || null,
          produces_fruit: parsed.produces_fruit,
          fruit_season: parsed.fruit_season || null,
          produces_flowers: parsed.produces_flowers,
          flowering_season: parsed.flowering_season || null,
          growth_rate: parsed.growth_rate,
          maintenance_level: parsed.maintenance_level,
          preferred_soil_type: parsed.preferred_soil_type,
          native_region: parsed.native_region,
          max_height_cm: parsed.max_height_cm,
          max_spread_cm: parsed.max_spread_cm,
          air_purifying: parsed.air_purifying,
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
