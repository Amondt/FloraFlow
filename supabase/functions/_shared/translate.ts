import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';

// ─── Locale constants ─────────────────────────────────────────────────────────

export const SUPPORTED_TRANSLATION_LOCALES = ['fr', 'nl'] as const;
export type SupportedTranslationLocale = (typeof SUPPORTED_TRANSLATION_LOCALES)[number];

export const LOCALE_LANGUAGE_NAME: Record<SupportedTranslationLocale, string> = {
  fr: 'French',
  nl: 'Dutch',
};

// ─── Error class ──────────────────────────────────────────────────────────────

// Thrown by translateFields() when the upstream AI call fails.
// status=503 signals a transient external failure so callers can return the correct HTTP code.
export class TranslationError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
    this.name = 'TranslationError';
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

// {language} is replaced at call time with the human-readable language name.
export const TRANSLATION_SYSTEM_PROMPT =
  `You are a botanical translation engine. Translate all JSON string values into {language}.\n` +
  `Rules:\n` +
  `1. Keep all JSON keys exactly as-is — keys are never translated.\n` +
  `2. Strings become translated strings; arrays of strings become arrays with the same item count.\n` +
  `3. Leave scientific or Latin names, numbers, and units (cm, %, °C, pH) unchanged.\n` +
  `4. Translate botanical and clinical terms accurately using correct {language} equivalents.\n` +
  `5. Add nothing and omit nothing — every field in the input must appear in the output.\n` +
  `6. Return only valid JSON — no prose, no markdown fences, no explanation.`;

// ─── Core translation function ────────────────────────────────────────────────

// Translates free-text fields into the given locale using Claude Haiku.
// - Validates the locale against the allow-list.
// - Drops empty strings and empty arrays (nothing to translate).
// - Builds a Zod schema dynamically from surviving keys so the response shape is validated.
// - Returns {} when all fields are empty.
// - Throws TranslationError (status 503) on upstream AI failure.
export async function translateFields(
  anthropic: Anthropic,
  fields: Record<string, string | string[]>,
  locale: string,
): Promise<Record<string, string | string[]>> {
  if (!(SUPPORTED_TRANSLATION_LOCALES as readonly string[]).includes(locale)) {
    throw new TranslationError(`Unsupported locale: ${locale}`);
  }

  // Drop empty values — empty strings and empty arrays carry no translatable content.
  const translatable: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && value.trim().length > 0) {
      translatable[key] = value;
    } else if (Array.isArray(value) && value.length > 0) {
      translatable[key] = value;
    }
  }

  if (Object.keys(translatable).length === 0) return {};

  // Build a Zod object schema from the surviving fields.
  // string fields → z.string(), array fields → z.array(z.string())
  const schemaShape: Record<string, z.ZodString | z.ZodArray<z.ZodString>> = {};
  for (const [key, value] of Object.entries(translatable)) {
    schemaShape[key] = Array.isArray(value) ? z.array(z.string()) : z.string();
  }
  const TranslationSchema = z.object(schemaShape as { [k: string]: z.ZodType });

  const language = LOCALE_LANGUAGE_NAME[locale as SupportedTranslationLocale];
  const systemPrompt = TRANSLATION_SYSTEM_PROMPT.replace(/\{language\}/g, language);

  try {
    const msg = await anthropic.messages.parse({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(translatable) }],
      output_config: { format: zodOutputFormat(TranslationSchema) },
    });

    if (!msg.parsed_output) {
      throw new TranslationError('AI returned invalid translation shape');
    }
    return msg.parsed_output as Record<string, string | string[]>;
  } catch (err) {
    if (err instanceof TranslationError) throw err;
    console.error('Claude translation call failed:', err);
    throw new TranslationError('Translation service unavailable');
  }
}
