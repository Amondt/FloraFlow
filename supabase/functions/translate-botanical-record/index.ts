import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import type { Database } from '../_shared/database.types.ts';
import { cors, json } from '../_shared/response.ts';
import {
  SUPPORTED_TRANSLATION_LOCALES,
  TranslationError,
  translateFields,
} from '../_shared/translate.ts';

// Free-text prose fields eligible for translation.
// Controlled-vocabulary columns (watering, cycle, care_difficulty, etc.) are excluded —
// those are handled by i18n keys in Phase 4.2 and must not be touched here.
const BOTANICAL_TEXT_FIELDS = [
  'description',
  'check_depth_description',
  'toxicity_notes',
  'human_toxicity_notes',
  'native_region',
  'fruit_season',
  'flowering_season',
] as const;

type CbrRow = Database['public']['Tables']['cached_botanical_records']['Row'];

function extractTextFields(row: CbrRow): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const key of BOTANICAL_TEXT_FIELDS) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      fields[key] = value;
    }
  }
  return fields;
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

    const body = (await req.json()) as { scientificName?: unknown; locale?: unknown };

    if (!body.scientificName || typeof body.scientificName !== 'string') {
      return json({ error: 'Missing or invalid field: scientificName is required' }, 400);
    }
    if (!body.locale || typeof body.locale !== 'string') {
      return json({ error: 'Missing or invalid field: locale is required' }, 400);
    }

    const scientificName = body.scientificName;
    const locale = body.locale;

    if (!(SUPPORTED_TRANSLATION_LOCALES as readonly string[]).includes(locale)) {
      return json(
        {
          error: `Unsupported locale: ${locale}. Supported: ${SUPPORTED_TRANSLATION_LOCALES.join(', ')}`,
        },
        400,
      );
    }

    const { data: row, error: fetchError } = await supabase
      .from('cached_botanical_records')
      .select('*')
      .eq('scientific_name', scientificName)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!row) return json({ error: 'Species not found in cache' }, 404);

    // Cache-first: if this locale is already translated, return the row without an AI call.
    const existingTranslations = (row.translations ?? {}) as Record<string, unknown>;
    if (existingTranslations[locale]) return json(row);

    const textFields = extractTextFields(row);

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    let translated: Record<string, string | string[]>;
    try {
      translated = await translateFields(anthropic, textFields, locale);
    } catch (err) {
      if (err instanceof TranslationError) {
        return json({ error: err.message }, err.status);
      }
      throw err;
    }

    // Merge into existing translations — preserve all other locales, never touch base columns.
    const updatedTranslations = { ...existingTranslations, [locale]: translated };

    const { data: updatedRow, error: updateError } = await supabase
      .from('cached_botanical_records')
      .update({ translations: updatedTranslations })
      .eq('scientific_name', scientificName)
      .select()
      .single();

    if (updateError) throw updateError;

    return json(updatedRow);
  } catch (err) {
    console.error('[translate-botanical-record] fatal error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
