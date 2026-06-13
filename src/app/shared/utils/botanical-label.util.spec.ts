import { describe, it, expect } from 'vitest';
import { getSunlightLabels, getWateringLabel, getSoilTypeLabels } from './botanical-label.util';

describe('getSunlightLabels', () => {
  it('maps underscore-format sunlight keys to i18n keys', () => {
    expect(getSunlightLabels(['full_sun'])).toEqual(['botanical.care.sunlightLabels.fullSun']);
    expect(getSunlightLabels(['part_shade'])).toEqual(['botanical.care.sunlightLabels.partShade']);
    expect(getSunlightLabels(['full_shade'])).toEqual(['botanical.care.sunlightLabels.fullShade']);
    expect(getSunlightLabels(['filtered_indirect'])).toEqual([
      'botanical.care.sunlightLabels.filteredIndirect',
    ]);
  });

  it('maps space-format sunlight values (DB variant) to i18n keys', () => {
    expect(getSunlightLabels(['full sun'])).toEqual(['botanical.care.sunlightLabels.fullSun']);
    expect(getSunlightLabels(['part shade'])).toEqual(['botanical.care.sunlightLabels.partShade']);
    expect(getSunlightLabels(['full shade'])).toEqual(['botanical.care.sunlightLabels.fullShade']);
  });

  it('maps multiple keys in one call', () => {
    expect(getSunlightLabels(['full_sun', 'part_shade'])).toEqual([
      'botanical.care.sunlightLabels.fullSun',
      'botanical.care.sunlightLabels.partShade',
    ]);
  });

  it('passes through an unknown value unchanged', () => {
    expect(getSunlightLabels(['unknown_value'])).toEqual(['unknown_value']);
  });

  it('returns an empty array for null', () => {
    expect(getSunlightLabels(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(getSunlightLabels(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    expect(getSunlightLabels([])).toEqual([]);
  });
});

describe('getWateringLabel', () => {
  it('maps every known watering key to its i18n key', () => {
    expect(getWateringLabel('Frequent')).toBe('botanical.care.wateringLabels.frequent');
    expect(getWateringLabel('Average')).toBe('botanical.care.wateringLabels.average');
    expect(getWateringLabel('Minimum')).toBe('botanical.care.wateringLabels.minimum');
    expect(getWateringLabel('None')).toBe('botanical.care.wateringLabels.none');
  });

  it('passes through an unknown key unchanged', () => {
    expect(getWateringLabel('Weekly')).toBe('Weekly');
  });

  it('returns null for null', () => {
    expect(getWateringLabel(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getWateringLabel(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(getWateringLabel('')).toBeNull();
  });
});

describe('getSoilTypeLabels', () => {
  it('maps every canonical soil type to its i18n key', () => {
    expect(getSoilTypeLabels(['Well-draining'])).toEqual([
      'botanical.care.soilTypeLabels.wellDraining',
    ]);
    expect(getSoilTypeLabels(['Sandy'])).toEqual(['botanical.care.soilTypeLabels.sandy']);
    expect(getSoilTypeLabels(['Loamy'])).toEqual(['botanical.care.soilTypeLabels.loamy']);
    expect(getSoilTypeLabels(['Clay'])).toEqual(['botanical.care.soilTypeLabels.clay']);
    expect(getSoilTypeLabels(['Peaty'])).toEqual(['botanical.care.soilTypeLabels.peaty']);
    expect(getSoilTypeLabels(['Chalky'])).toEqual(['botanical.care.soilTypeLabels.chalky']);
    expect(getSoilTypeLabels(['Rich'])).toEqual(['botanical.care.soilTypeLabels.rich']);
    expect(getSoilTypeLabels(['Poor'])).toEqual(['botanical.care.soilTypeLabels.poor']);
    expect(getSoilTypeLabels(['Moisture-retaining'])).toEqual([
      'botanical.care.soilTypeLabels.moistureRetaining',
    ]);
  });

  it('maps multiple soil types in one call', () => {
    expect(getSoilTypeLabels(['Well-draining', 'Sandy'])).toEqual([
      'botanical.care.soilTypeLabels.wellDraining',
      'botanical.care.soilTypeLabels.sandy',
    ]);
  });

  it('passes through an unknown value unchanged', () => {
    expect(getSoilTypeLabels(['Chunky'])).toEqual(['Chunky']);
  });

  it('returns an empty array for null', () => {
    expect(getSoilTypeLabels(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(getSoilTypeLabels(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    expect(getSoilTypeLabels([])).toEqual([]);
  });
});
