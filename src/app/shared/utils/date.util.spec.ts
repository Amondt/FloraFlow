import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { daysSince } from './date.util';

// Fixed reference: June 15 2024 at 14:00 UTC
const FIXED_NOW = new Date('2024-06-15T14:00:00.000Z').getTime();

describe('daysSince', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 for a timestamp equal to now', () => {
    expect(daysSince(new Date(FIXED_NOW).toISOString())).toBe(0);
  });

  it('returns 1 for a timestamp exactly 1 day ago', () => {
    const ts = new Date(FIXED_NOW - 86_400_000).toISOString();
    expect(daysSince(ts)).toBe(1);
  });

  it('returns 7 for a timestamp exactly 7 days ago', () => {
    const ts = new Date(FIXED_NOW - 7 * 86_400_000).toISOString();
    expect(daysSince(ts)).toBe(7);
  });

  it('rounds a fractional gap up when >= .5 days', () => {
    // 1.5 days ago → Math.round(1.5) = 2
    const ts = new Date(FIXED_NOW - 1.5 * 86_400_000).toISOString();
    expect(daysSince(ts)).toBe(2);
  });

  it('rounds a fractional gap down when < .5 days', () => {
    // 1.4 days ago → Math.round(1.4) = 1
    const ts = new Date(FIXED_NOW - 1.4 * 86_400_000).toISOString();
    expect(daysSince(ts)).toBe(1);
  });
});
