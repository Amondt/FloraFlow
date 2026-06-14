import type { CachedBotanicalRecord } from '../../features/library/library.service';

const FREE_TEXT_FIELDS = [
  'description',
  'check_depth_description',
  'toxicity_notes',
  'human_toxicity_notes',
  'native_region',
  'fruit_season',
  'flowering_season',
] as const;

type FreeTextField = (typeof FREE_TEXT_FIELDS)[number];

function extractLocaleData(
  translations: unknown,
  locale: string,
): Partial<Record<FreeTextField, string>> | null {
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) return null;
  const map = translations as Record<string, unknown>;
  if (!(locale in map)) return null;
  const entry = map[locale];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  return entry as Partial<Record<FreeTextField, string>>;
}

export function hasLocaleTranslation(record: CachedBotanicalRecord, locale: string): boolean {
  if (locale === 'en') return true;
  return extractLocaleData(record.translations, locale) !== null;
}

export function localizeBotanical(
  record: CachedBotanicalRecord,
  locale: string,
): CachedBotanicalRecord {
  if (locale === 'en') return record;
  const localeData = extractLocaleData(record.translations, locale);
  if (!localeData) return record;

  const overlay: Partial<Pick<CachedBotanicalRecord, FreeTextField>> = {};
  for (const field of FREE_TEXT_FIELDS) {
    const translated = localeData[field];
    if (typeof translated === 'string' && translated.length > 0) {
      overlay[field] = translated;
    }
  }

  return { ...record, ...overlay };
}
