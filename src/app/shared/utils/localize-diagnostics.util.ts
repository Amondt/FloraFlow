const TRANSLATABLE_STRING_FIELDS = ['primary_condition', 'identified_plant'] as const;
const TRANSLATABLE_ARRAY_FIELDS = ['immediate_remedial_actions'] as const;

type TranslatableStringField = (typeof TRANSLATABLE_STRING_FIELDS)[number];
type TranslatableArrayField = (typeof TRANSLATABLE_ARRAY_FIELDS)[number];

interface DiagnosticsI18nData {
  primary_condition?: string;
  identified_plant?: string;
  immediate_remedial_actions?: string[];
}

function extractLocaleData(diagnosticsI18n: unknown, locale: string): DiagnosticsI18nData | null {
  if (!diagnosticsI18n || typeof diagnosticsI18n !== 'object' || Array.isArray(diagnosticsI18n))
    return null;
  const map = diagnosticsI18n as Record<string, unknown>;
  if (!(locale in map)) return null;
  const entry = map[locale];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry as DiagnosticsI18nData;
}

export function hasDiagnosticsTranslation(diagnosticsI18n: unknown, locale: string): boolean {
  if (locale === 'en') return true;
  return extractLocaleData(diagnosticsI18n, locale) !== null;
}

export function localizeDiagnostics<T extends object>(
  diagnostics: T | null,
  diagnosticsI18n: unknown,
  locale: string,
): T | null {
  if (!diagnostics) return null;
  if (locale === 'en') return diagnostics;
  const localeData = extractLocaleData(diagnosticsI18n, locale);
  if (!localeData) return diagnostics;

  const overlay: Partial<Record<TranslatableStringField | TranslatableArrayField, unknown>> = {};

  for (const field of TRANSLATABLE_STRING_FIELDS) {
    const translated = localeData[field];
    if (typeof translated === 'string' && translated.length > 0) {
      overlay[field] = translated;
    }
  }

  for (const field of TRANSLATABLE_ARRAY_FIELDS) {
    const translated = localeData[field];
    if (Array.isArray(translated) && translated.length > 0) {
      overlay[field] = translated;
    }
  }

  return { ...(diagnostics as object), ...overlay } as T;
}
