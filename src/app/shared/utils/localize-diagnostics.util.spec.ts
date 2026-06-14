import { describe, it, expect } from 'vitest';
import { localizeDiagnostics, hasDiagnosticsTranslation } from './localize-diagnostics.util';

type SickDiag = {
  primary_condition: string;
  confidence_score: number;
  immediate_remedial_actions: string[];
  systemic_risk_assessment: string;
};

type HealthyDiag = {
  is_healthy: true;
  identified_plant: string | null;
};

function makeSick(overrides: Partial<SickDiag> = {}): SickDiag {
  return {
    primary_condition: 'Root rot',
    confidence_score: 0.9,
    immediate_remedial_actions: ['Remove affected roots', 'Repot in fresh soil'],
    systemic_risk_assessment: 'Isolated',
    ...overrides,
  };
}

function makeHealthy(overrides: Partial<HealthyDiag> = {}): HealthyDiag {
  return {
    is_healthy: true,
    identified_plant: 'Monstera deliciosa',
    ...overrides,
  };
}

describe('hasDiagnosticsTranslation', () => {
  it('returns true for locale "en" regardless of diagnostics_i18n value', () => {
    expect(hasDiagnosticsTranslation(null, 'en')).toBe(true);
    expect(hasDiagnosticsTranslation({ fr: {} }, 'en')).toBe(true);
  });

  it('returns false when diagnostics_i18n is null', () => {
    expect(hasDiagnosticsTranslation(null, 'fr')).toBe(false);
  });

  it('returns false when the locale key is absent', () => {
    expect(hasDiagnosticsTranslation({ nl: { primary_condition: 'Wortelrot' } }, 'fr')).toBe(false);
  });

  it('returns true when the locale key exists', () => {
    expect(hasDiagnosticsTranslation({ fr: { primary_condition: 'Pourriture' } }, 'fr')).toBe(true);
  });

  it('returns true even when the locale sub-object is empty', () => {
    expect(hasDiagnosticsTranslation({ fr: {} }, 'fr')).toBe(true);
  });

  it('returns false when diagnostics_i18n is a non-object value', () => {
    expect(hasDiagnosticsTranslation('bad', 'fr')).toBe(false);
  });

  it('returns false when diagnostics_i18n is an array', () => {
    expect(hasDiagnosticsTranslation([], 'fr')).toBe(false);
  });
});

describe('localizeDiagnostics', () => {
  it('returns null when diagnostics is null', () => {
    expect(localizeDiagnostics(null, { fr: { primary_condition: 'Pourriture' } }, 'fr')).toBeNull();
  });

  it('returns the same reference for locale "en"', () => {
    const diag = makeSick();
    expect(localizeDiagnostics(diag, { fr: { primary_condition: 'Pourriture' } }, 'en')).toBe(diag);
  });

  it('returns the same reference when diagnostics_i18n is null', () => {
    const diag = makeSick();
    expect(localizeDiagnostics(diag, null, 'fr')).toBe(diag);
  });

  it('returns the same reference when the locale key is absent', () => {
    const diag = makeSick();
    expect(localizeDiagnostics(diag, { nl: { primary_condition: 'Wortelrot' } }, 'fr')).toBe(diag);
  });

  it('overlays primary_condition from translations[locale]', () => {
    const diag = makeSick();
    const result = localizeDiagnostics(
      diag,
      { fr: { primary_condition: 'Pourriture racinaire' } },
      'fr',
    ) as SickDiag;
    expect(result.primary_condition).toBe('Pourriture racinaire');
  });

  it('overlays immediate_remedial_actions from translations[locale]', () => {
    const diag = makeSick();
    const translated = ['Retirer les racines', 'Rempoter'];
    const result = localizeDiagnostics(
      diag,
      { fr: { immediate_remedial_actions: translated } },
      'fr',
    ) as SickDiag;
    expect(result.immediate_remedial_actions).toEqual(translated);
  });

  it('overlays identified_plant on a healthy diagnosis', () => {
    const diag = makeHealthy();
    const result = localizeDiagnostics(
      diag,
      { fr: { identified_plant: 'Monstera délicieuse' } },
      'fr',
    ) as HealthyDiag;
    expect(result.identified_plant).toBe('Monstera délicieuse');
  });

  it('falls back to the base field when a translation field is absent', () => {
    const diag = makeSick();
    const result = localizeDiagnostics(
      diag,
      { fr: { primary_condition: 'Pourriture' } },
      'fr',
    ) as SickDiag;
    expect(result.immediate_remedial_actions).toEqual(diag.immediate_remedial_actions);
    expect(result.confidence_score).toBe(0.9);
    expect(result.systemic_risk_assessment).toBe('Isolated');
  });

  it('falls back to the base field when a translation string is empty', () => {
    const diag = makeSick();
    const result = localizeDiagnostics(
      diag,
      { fr: { primary_condition: '', immediate_remedial_actions: ['Retirer les racines'] } },
      'fr',
    ) as SickDiag;
    expect(result.primary_condition).toBe('Root rot');
    expect(result.immediate_remedial_actions).toEqual(['Retirer les racines']);
  });

  it('falls back to the base field when immediate_remedial_actions translation is an empty array', () => {
    const diag = makeSick();
    const result = localizeDiagnostics(
      diag,
      { fr: { immediate_remedial_actions: [] } },
      'fr',
    ) as SickDiag;
    expect(result.immediate_remedial_actions).toEqual(diag.immediate_remedial_actions);
  });

  it('does not mutate the original diagnostics object', () => {
    const diag = makeSick();
    const originalCondition = diag.primary_condition;
    const result = localizeDiagnostics(diag, { fr: { primary_condition: 'Pourriture' } }, 'fr');
    expect(result).not.toBe(diag);
    expect(diag.primary_condition).toBe(originalCondition);
  });

  it('does not modify non-translatable fields', () => {
    const diag = makeSick();
    const result = localizeDiagnostics(
      diag,
      { fr: { primary_condition: 'Pourriture' } },
      'fr',
    ) as SickDiag;
    expect(result.confidence_score).toBe(diag.confidence_score);
    expect(result.systemic_risk_assessment).toBe(diag.systemic_risk_assessment);
  });
});
