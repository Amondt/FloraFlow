import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;

const SYSTEM_PROMPT = `You are the FloraFlow AI Leaf Doctor, an advanced computer vision diagnostic engine specializing in agricultural pathology, plant physiology, and soil sciences.

CRITICAL GUARDRAILS:
1. If the uploaded image does not primarily focus on a plant asset, leaf structure, or cultivation soil layer, set is_botanical_image to false and populate error_message. Do not attempt identification.
2. Do not include casual pleasantries, greetings, or loose text explanations. You must communicate exclusively using a valid, parseable JSON data structure.
3. Identify first. Begin by identifying the plant in the image and populate identified_plant with what you actually see, e.g. "Snake Plant (Sansevieria trifasciata)". Never leave it null when the image shows a plant.
4. Healthy is a valid outcome. If there is no clear sign of disease, pest, deficiency, or distress, set is_healthy to true and diagnostics to null. Never fabricate a condition to fill the schema.
5. Evidence-gated diagnosis. Populate diagnostics only when there is visible evidence of a specific problem. When evidence is weak, prefer is_healthy = true or a low confidence_score over a guessed condition.
6. Species cross-check. When the user message names an expected species, compare it to what you see: if consistent set species_matches_context to true; if clearly a different species set species_matches_context to false and still diagnose what is actually shown. If no expected species is mentioned, set species_matches_context to null.`;

const DiagnosticsSchema = z.object({
  primary_condition: z.string(),
  confidence_score: z.number().min(0).max(1),
  immediate_remedial_actions: z.array(z.string()),
  systemic_risk_assessment: z.enum(['Isolated', 'ZoneContagious', 'FatalThreat']),
});

const LeafDoctorSchema = z.object({
  is_botanical_image: z.boolean(),
  error_message: z.string().nullable(),
  is_healthy: z.boolean(),
  identified_plant: z.string().nullable(),
  species_matches_context: z.boolean().nullable(),
  diagnostics: DiagnosticsSchema.nullable(),
});

const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type ImageMediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(mt: string): mt is ImageMediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(mt);
}

interface ImageInput {
  imageBase64: string;
  imageMediaType: string;
}

interface PlantContext {
  commonName: string;
  scientificName?: string | null;
}

/**
 * Builds the user text block sent to Claude.
 * Composes two independent dimensions:
 *   - image-count: single image vs. multi-image same-plant instruction
 *   - species: when plantContext is provided, names the species for targeted diagnosis
 * Both dimensions compose — neither overwrites the other.
 */
function buildUserText(imageCount: number, plantContext?: PlantContext): string {
  const speciesDesc = plantContext
    ? `${plantContext.commonName}${plantContext.scientificName ? ` (${plantContext.scientificName})` : ''}`
    : null;

  if (imageCount > 1) {
    const plantClause = speciesDesc ? ` of this ${speciesDesc}` : '';
    const speciesFocus = speciesDesc
      ? ' If it shows problems, weigh conditions known to affect this species.'
      : '';
    return (
      `These ${imageCount} photos show the same plant${plantClause} from different angles. ` +
      `Provide one combined diagnosis. Return a JSON response matching the schema.${speciesFocus}`
    );
  }

  if (speciesDesc) {
    return (
      `Analyze this image of a ${speciesDesc} and return a JSON response matching the schema. ` +
      `If it shows problems, weigh conditions known to affect this species.`
    );
  }

  return 'Analyze this image and return a JSON response matching the schema.';
}

function extractPlantContext(raw: unknown): PlantContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj['commonName'] !== 'string' || !obj['commonName']) return undefined;
  return {
    commonName: obj['commonName'],
    scientificName: typeof obj['scientificName'] === 'string' ? obj['scientificName'] : null,
  };
}

function validateImageItems(
  images: unknown[],
): { valid: true; items: ImageInput[] } | { valid: false; error: string } {
  const items: ImageInput[] = [];
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    if (item === null || typeof item !== 'object') {
      return { valid: false, error: `images[${i}] must be an object` };
    }
    const { imageBase64, imageMediaType } = item as Record<string, unknown>;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return { valid: false, error: `images[${i}].imageBase64 is required` };
    }
    if (!imageMediaType || typeof imageMediaType !== 'string') {
      return { valid: false, error: `images[${i}].imageMediaType is required` };
    }
    if (!isValidMediaType(imageMediaType)) {
      return {
        valid: false,
        error: `images[${i}].imageMediaType must be image/jpeg, image/png, or image/webp`,
      };
    }
    items.push({ imageBase64, imageMediaType });
  }
  return { valid: true, items };
}

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

    const body = (await req.json()) as { images?: unknown; plantContext?: unknown };

    if (!body.images) {
      return json({ error: 'Missing field: images is required' }, 400);
    }
    if (!Array.isArray(body.images)) {
      return json({ error: 'Invalid field: images must be an array' }, 400);
    }
    if (body.images.length === 0) {
      return json({ error: 'Invalid field: images must contain at least 1 item' }, 400);
    }
    if (body.images.length > 3) {
      return json({ error: 'Invalid field: images must contain at most 3 items' }, 400);
    }

    const validation = validateImageItems(body.images);
    if (!validation.valid) {
      return json({ error: `Invalid field: ${validation.error}` }, 400);
    }
    const images = validation.items;

    const plantContext = extractPlantContext(body.plantContext);

    // Fire-and-forget: queue the species for botanical enrichment if not yet cached.
    // The 10-min cron picks up the stub and fills enriched fields on the next pass.
    if (plantContext?.scientificName) {
      const stubWork = supabase
        .from('cached_botanical_records')
        .upsert(
          {
            scientific_name: plantContext.scientificName,
            common_name: plantContext.commonName,
          },
          { onConflict: 'scientific_name' },
        )
        .then(() => undefined)
        .catch((err: unknown) => console.error('claude-vision: cache stub failed:', err));
      EdgeRuntime?.waitUntil(stubWork);
    }

    const imageBlocks = images.map((img) => {
      const rawBase64 = img.imageBase64.includes(',')
        ? img.imageBase64.split(',')[1]
        : img.imageBase64;
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: img.imageMediaType as ImageMediaType,
          data: rawBase64,
        },
      };
    });

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    let parsed: z.infer<typeof LeafDoctorSchema>;
    try {
      const msg = await anthropic.messages.parse({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              ...imageBlocks,
              {
                type: 'text',
                text: buildUserText(images.length, plantContext),
              },
            ],
          },
        ],
        output_config: { format: zodOutputFormat(LeafDoctorSchema) },
      });

      if (!msg.parsed_output) {
        console.error('Leaf Doctor: Claude returned null parsed_output');
        return json({ error: 'Leaf Doctor unavailable', error_code: 'API_ERROR' }, 503);
      }
      parsed = msg.parsed_output;
    } catch (err) {
      console.error('Leaf Doctor: Anthropic call failed:', err);
      return json({ error: 'Leaf Doctor unavailable', error_code: 'API_ERROR' }, 503);
    }

    if (!parsed.is_botanical_image) {
      return json({
        is_botanical_image: false,
        error_message: parsed.error_message,
        diagnostics: null,
      });
    }

    return json(parsed);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
