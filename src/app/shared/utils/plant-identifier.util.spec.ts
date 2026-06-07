import { describe, it, expect } from 'vitest';
import { getConfidenceBadgeClass, getConfidenceBadgeLabel } from './plant-identifier.util';

describe('getConfidenceBadgeClass', () => {
  it('score > 0.75 → green badge', () => {
    expect(getConfidenceBadgeClass(0.9)).toBe(
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    );
  });

  it('score exactly 0.76 → green badge', () => {
    expect(getConfidenceBadgeClass(0.76)).toBe(
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    );
  });

  it('score = 0.75 → neutral badge (boundary: not > 0.75)', () => {
    expect(getConfidenceBadgeClass(0.75)).toBe(
      'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
    );
  });

  it('score = 0.5 → neutral badge', () => {
    expect(getConfidenceBadgeClass(0.5)).toBe(
      'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300',
    );
  });

  it('score < 0.5 → amber badge', () => {
    expect(getConfidenceBadgeClass(0.3)).toBe(
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    );
  });

  it('score = 0 → amber badge', () => {
    expect(getConfidenceBadgeClass(0)).toBe(
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    );
  });
});

describe('getConfidenceBadgeLabel', () => {
  describe('verbose mode (default)', () => {
    it('score > 0.75 → "N% confident"', () => {
      expect(getConfidenceBadgeLabel(0.9)).toBe('90% confident');
    });

    it('score 0.5–0.75 → "N% — low confidence"', () => {
      expect(getConfidenceBadgeLabel(0.65)).toBe('65% — low confidence');
    });

    it('score < 0.5 → "N% — uncertain"', () => {
      expect(getConfidenceBadgeLabel(0.3)).toBe('30% — uncertain');
    });

    it('rounds to nearest integer', () => {
      expect(getConfidenceBadgeLabel(0.876)).toBe('88% confident');
    });
  });

  describe('compact mode (verbose = false)', () => {
    it('returns percentage only — no label text', () => {
      expect(getConfidenceBadgeLabel(0.72, false)).toBe('72%');
    });

    it('compact mode ignores threshold logic', () => {
      expect(getConfidenceBadgeLabel(0.3, false)).toBe('30%');
      expect(getConfidenceBadgeLabel(0.9, false)).toBe('90%');
    });
  });
});
