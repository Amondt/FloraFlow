import { describe, it, expect } from 'vitest';
import { plantAddedDetail } from './plant-message.util';

describe('plantAddedDetail', () => {
  it('wraps the common name in double quotes at the start', () => {
    const result = plantAddedDetail('Monstera', '2024-06-20T00:00:00.000Z');
    expect(result).toMatch(/^"Monstera" added\./);
  });

  it('includes "First check on" before the formatted date', () => {
    const result = plantAddedDetail('Peace Lily', '2024-07-01T00:00:00.000Z');
    expect(result).toContain('First check on');
  });

  it('matches the full expected message structure', () => {
    const result = plantAddedDetail('Ficus', '2024-12-25T00:00:00.000Z');
    // "Ficus" added. First check on <date>.
    expect(result).toMatch(/^"Ficus" added\. First check on .+\.$/);
  });

  it('handles a name containing special characters', () => {
    const result = plantAddedDetail("Bird's Nest Fern", '2024-08-10T00:00:00.000Z');
    expect(result).toMatch(/^"Bird's Nest Fern" added\./);
  });
});
