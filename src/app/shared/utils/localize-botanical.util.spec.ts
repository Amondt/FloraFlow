import { describe, it, expect } from 'vitest';
import { localizeBotanical, hasLocaleTranslation } from './localize-botanical.util';

type BotanicalRecord = Parameters<typeof localizeBotanical>[0];

function makeRecord(overrides: Partial<Record<string, unknown>> = {}): BotanicalRecord {
  return {
    scientific_name: 'Monstera deliciosa',
    common_name: 'Swiss Cheese Plant',
    description: 'A tropical plant with split leaves.',
    check_depth_description: 'Check 5 cm deep before watering.',
    toxicity_notes: 'Mildly toxic to pets.',
    human_toxicity_notes: 'Can cause irritation.',
    native_region: 'Central America',
    fruit_season: 'Summer',
    flowering_season: 'Spring',
    translations: null,
    ...overrides,
  } as unknown as BotanicalRecord;
}

describe('hasLocaleTranslation', () => {
  it('returns true for locale "en" regardless of translations value', () => {
    expect(hasLocaleTranslation(makeRecord(), 'en')).toBe(true);
    expect(hasLocaleTranslation(makeRecord({ translations: null }), 'en')).toBe(true);
  });

  it('returns false when translations is null', () => {
    expect(hasLocaleTranslation(makeRecord({ translations: null }), 'fr')).toBe(false);
  });

  it('returns false when the locale key is absent from translations', () => {
    expect(
      hasLocaleTranslation(makeRecord({ translations: { nl: { description: 'Dutch' } } }), 'fr'),
    ).toBe(false);
  });

  it('returns true when the locale key exists in translations', () => {
    expect(
      hasLocaleTranslation(
        makeRecord({ translations: { fr: { description: 'Plante tropicale' } } }),
        'fr',
      ),
    ).toBe(true);
  });

  it('returns true even when the locale sub-object is empty', () => {
    expect(hasLocaleTranslation(makeRecord({ translations: { fr: {} } }), 'fr')).toBe(true);
  });

  it('returns false when translations is a non-object value', () => {
    expect(hasLocaleTranslation(makeRecord({ translations: 'bad' }), 'fr')).toBe(false);
  });
});

describe('localizeBotanical', () => {
  it('returns the same record reference for locale "en"', () => {
    const record = makeRecord();
    expect(localizeBotanical(record, 'en')).toBe(record);
  });

  it('returns the same record reference when translations is null', () => {
    const record = makeRecord({ translations: null });
    expect(localizeBotanical(record, 'fr')).toBe(record);
  });

  it('returns the same record reference when the locale sub-object is absent', () => {
    const record = makeRecord({ translations: { nl: { description: 'Dutch' } } });
    expect(localizeBotanical(record, 'fr')).toBe(record);
  });

  it('overlays all 7 free-text fields from translations[locale]', () => {
    const record = makeRecord({
      translations: {
        fr: {
          description: 'Plante tropicale',
          check_depth_description: 'Vérifier à 5 cm',
          toxicity_notes: 'Légèrement toxique',
          human_toxicity_notes: 'Peut causer une irritation',
          native_region: 'Amérique centrale',
          fruit_season: 'Été',
          flowering_season: 'Printemps',
        },
      },
    });
    const result = localizeBotanical(record, 'fr');
    expect(result.description).toBe('Plante tropicale');
    expect(result.check_depth_description).toBe('Vérifier à 5 cm');
    expect(result.toxicity_notes).toBe('Légèrement toxique');
    expect(result.human_toxicity_notes).toBe('Peut causer une irritation');
    expect(result.native_region).toBe('Amérique centrale');
    expect(result.fruit_season).toBe('Été');
    expect(result.flowering_season).toBe('Printemps');
  });

  it('falls back to the base field value when a translation field is absent', () => {
    const record = makeRecord({
      translations: {
        fr: {
          description: 'Plante tropicale',
        },
      },
    });
    const result = localizeBotanical(record, 'fr');
    expect(result.description).toBe('Plante tropicale');
    expect(result.native_region).toBe('Central America');
    expect(result.fruit_season).toBe('Summer');
  });

  it('falls back to the base field value when a translation field is an empty string', () => {
    const record = makeRecord({
      translations: {
        fr: {
          description: '',
          native_region: 'Amérique centrale',
        },
      },
    });
    const result = localizeBotanical(record, 'fr');
    expect(result.description).toBe('A tropical plant with split leaves.');
    expect(result.native_region).toBe('Amérique centrale');
  });

  it('does not mutate the original record', () => {
    const record = makeRecord({
      translations: {
        fr: { description: 'Plante tropicale' },
      },
    });
    const result = localizeBotanical(record, 'fr');
    expect(result).not.toBe(record);
    expect(record.description).toBe('A tropical plant with split leaves.');
  });

  it('does not modify non-free-text fields', () => {
    const record = makeRecord({
      translations: {
        fr: { description: 'Plante tropicale' },
      },
    });
    const result = localizeBotanical(record, 'fr');
    expect(result.scientific_name).toBe(record.scientific_name);
    expect(result.common_name).toBe(record.common_name);
    expect(result.translations).toBe(record.translations);
  });
});
