import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import { enrichRecord } from '../_shared/enrich-record.ts';

// Supabase Edge Runtime exposes this global to extend the function's lifetime
// so background enrichment work can complete after the response has been sent.
declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const SYSTEM_PROMPT = `You are the FloraFlow AI Plant Identifier, a specialist botanical taxonomist trained in visual species recognition across vascular plants, succulents, ferns, mosses, and cultivated crops.

CRITICAL GUARDRAILS:
1. If the uploaded image does not clearly show a plant, leaf structure, stem, flower, or root system, set is_plant_image to false and populate error_message. Do not attempt identification.
2. Never hallucinate a species. If visual evidence is insufficient for confident identification, lower the confidence_score accordingly and populate alternative_candidates with plausible matches.
3. Return exclusively a valid, parseable JSON structure. No prose, no greetings, no markdown.`;

const SpeciesSchema = z.object({
  common_name: z.string(),
  scientific_name: z.string(),
  confidence_score: z.number().min(0).max(1),
});

const PlantIdSchema = z.object({
  is_plant_image: z.boolean(),
  error_message: z.string().nullable(),
  species_match: SpeciesSchema.nullable(),
  alternative_candidates: z.array(SpeciesSchema).max(3),
});

const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type ImageMediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(mt: string): mt is ImageMediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(mt);
}

Deno.serve(async (req: Request) => {
  // 1. Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // 2. Auth — user-facing function; requires a valid user JWT
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

    // 3. Input validation
    const body = (await req.json()) as { imageBase64?: string; imageMediaType?: string };
    const { imageBase64, imageMediaType } = body;

    if (!imageBase64 || !imageMediaType) {
      return json({ error: 'Missing fields: imageBase64 and imageMediaType are required' }, 400);
    }

    if (!isValidMediaType(imageMediaType)) {
      return json(
        { error: 'Invalid imageMediaType. Must be image/jpeg, image/png, or image/webp' },
        400,
      );
    }

    // Strip the data URI prefix if the client accidentally included it
    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    // 4. Claude vision call — identify the species
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    let parsed: z.infer<typeof PlantIdSchema>;
    try {
      const msg = await anthropic.messages.parse({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: imageMediaType,
                  data: rawBase64,
                },
              },
              {
                type: 'text',
                text: 'Analyze this image and return a JSON response matching the schema.',
              },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(PlantIdSchema) },
      });

      if (!msg.parsed_output) {
        console.error('claude-plant-id: Claude returned null parsed_output');
        return json({ error: 'Plant Identifier unavailable', error_code: 'API_ERROR' }, 503);
      }
      parsed = msg.parsed_output;
    } catch (err) {
      console.error('claude-plant-id: Anthropic call failed:', err);
      return json({ error: 'Plant Identifier unavailable', error_code: 'API_ERROR' }, 503);
    }

    // 5. Non-plant image — return error before any DB work
    if (!parsed.is_plant_image) {
      return json(
        {
          error: parsed.error_message ?? 'Image does not appear to show a plant',
          error_code: 'INVALID_IMAGE',
        },
        400,
      );
    }

    // species_match is guaranteed non-null when is_plant_image is true
    const { common_name, scientific_name, confidence_score } = parsed.species_match!;

    // 6. Cache lookup — resolve perenual_id for the identified species
    const { data: cachedRecord } = await supabase
      .from('cached_botanical_records')
      .select('perenual_id')
      .eq('scientific_name', scientific_name)
      .maybeSingle();

    // 7. Background enrichment — fires only when the species is not yet in cache
    if (!cachedRecord) {
      const enrichmentWork = enrichRecord(supabase, anthropic, scientific_name, common_name).catch(
        (err) => console.error('claude-plant-id: background enrichment failed:', err),
      );
      EdgeRuntime?.waitUntil(enrichmentWork);
    }

    // 8. Respond — perenual_id is null when enrichment is still pending
    return json({
      is_plant_image: true,
      species_match: { common_name, scientific_name, confidence_score },
      alternative_candidates: parsed.alternative_candidates,
      perenual_id: cachedRecord?.perenual_id ?? null,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
