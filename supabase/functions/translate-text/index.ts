import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import {
  SUPPORTED_TRANSLATION_LOCALES,
  TranslationError,
  translateFields,
} from '../_shared/translate.ts';

const MAX_FIELDS_SERIALIZED_LENGTH = 4000;

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

    const body = (await req.json()) as { fields?: unknown; locale?: unknown };

    if (!body.locale || typeof body.locale !== 'string') {
      return json({ error: 'Missing or invalid field: locale is required' }, 400);
    }
    if (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)) {
      return json({ error: 'Missing or invalid field: fields must be an object' }, 400);
    }

    const locale = body.locale;
    const rawFields = body.fields as Record<string, unknown>;

    if (!(SUPPORTED_TRANSLATION_LOCALES as readonly string[]).includes(locale)) {
      return json(
        {
          error: `Unsupported locale: ${locale}. Supported: ${SUPPORTED_TRANSLATION_LOCALES.join(', ')}`,
        },
        400,
      );
    }

    // Validate and narrow field values to string | string[].
    const typedFields: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(rawFields)) {
      if (typeof value === 'string') {
        typedFields[key] = value;
      } else if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        typedFields[key] = value as string[];
      } else {
        return json({ error: `Invalid field: fields.${key} must be a string or string[]` }, 400);
      }
    }

    if (JSON.stringify(typedFields).length > MAX_FIELDS_SERIALIZED_LENGTH) {
      return json({ error: 'Input too large: serialized fields exceed 4 000 characters' }, 400);
    }

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    let translations: Record<string, string | string[]>;
    try {
      translations = await translateFields(anthropic, typedFields, locale);
    } catch (err) {
      if (err instanceof TranslationError) {
        return json({ error: err.message }, err.status);
      }
      throw err;
    }

    return json({ translations });
  } catch (err) {
    console.error('[translate-text] fatal error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
