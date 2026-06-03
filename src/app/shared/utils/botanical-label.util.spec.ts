import { describe, it, expect } from 'vitest';
import { getSunlightLabels, getWateringLabel } from './botanical-label.util';

describe('getSunlightLabels', () => {
  it('maps every known sunlight key to its label', () => {
    expect(getSunlightLabels(['full_sun'])).toEqual(['Full sun']);
    expect(getSunlightLabels(['part_shade'])).toEqual(['Part shade']);
    expect(getSunlightLabels(['full_shade'])).toEqual(['Shade']);
    expect(getSunlightLabels(['filtered_indirect'])).toEqual(['Indirect']);
  });

  it('maps multiple keys in one call', () => {
    expect(getSunlightLabels(['full_sun', 'part_shade'])).toEqual(['Full sun', 'Part shade']);
  });

  it('passes through an unknown key unchanged', () => {
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
  it('maps every known watering key to its label', () => {
    expect(getWateringLabel('Frequent')).toBe('Every 1–2 days');
    expect(getWateringLabel('Average')).toBe('Every 3–7 days');
    expect(getWateringLabel('Minimum')).toBe('Every 7–14 days');
    expect(getWateringLabel('None')).toBe('Drought-tolerant');
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
