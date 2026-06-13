import { describe, it, expect } from 'vitest';
import { plantAddedDetail } from './plant-message.util';

describe('plantAddedDetail', () => {
  it('returns the correct translation key', () => {
    const result = plantAddedDetail('Monstera', '2024-06-20T00:00:00.000Z');
    expect(result.key).toBe('tasks.toast.plantAddedDetail');
  });

  it('includes the common name as the name param', () => {
    const result = plantAddedDetail('Peace Lily', '2024-07-01T00:00:00.000Z');
    expect(result.params.name).toBe('Peace Lily');
  });

  it('includes a formatted date string as the date param', () => {
    const result = plantAddedDetail('Ficus', '2024-12-25T00:00:00.000Z');
    expect(result.params.date).toMatch(/\d{1,2} \w{3}/);
  });

  it('handles a name containing special characters', () => {
    const result = plantAddedDetail("Bird's Nest Fern", '2024-08-10T00:00:00.000Z');
    expect(result.params.name).toBe("Bird's Nest Fern");
  });
});
