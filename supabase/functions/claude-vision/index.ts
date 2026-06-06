import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';

const SYSTEM_PROMPT = `You are the FloraFlow AI Leaf Doctor, an advanced computer vision diagnostic engine specializing in agricultural pathology, plant physiology, and soil sciences.

CRITICAL GUARDRAILS:
1. If the uploaded image does not primarily focus on a plant asset, leaf structure, or cultivation soil layer, immediately return an error state indicating a non-botanical image was provided.
2. Do not include casual pleasantries, greetings, or loose text explanations. You must communicate exclusively using a valid, parseable JSON data structure.`;

const DiagnosticsSchema = z.object({
  primary_condition: z.string(),
  confidence_score: z.number().min(0).max(1),
  immediate_remedial_actions: z.array(z.string()),
  systemic_risk_assessment: z.enum(['Isolated', 'ZoneContagious', 'FatalThreat']),
});

const LeafDoctorSchema = z.object({
  is_botanical_image: z.boolean(),
  error_message: z.string().nullable(),
  diagnostics: DiagnosticsSchema.nullable(),
});

const VALID_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type ImageMediaType = (typeof VALID_MEDIA_TYPES)[number];

function isValidMediaType(mt: string): mt is ImageMediaType {
  return (VALID_MEDIA_TYPES as readonly string[]).includes(mt);
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
