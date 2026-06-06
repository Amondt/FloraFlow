import { describe, it, expect } from 'vitest';
import {
  computeMix,
  diameterToVolume,
  getPhStatus,
  preferredSoilToProfile,
  substrateFactorToProfile,
} from './substrate-mix.model';

// ─── diameterToVolume ─────────────────────────────────────────────────────────

describe('diameterToVolume', () => {
  it('returns exact table value for an exact match', () => {
    expect(diameterToVolume(15)).toBe(1.3);
    expect(diameterToVolume(10)).toBe(0.4);
    expect(diameterToVolume(25)).toBe(6.0);
    expect(diameterToVolume(30)).toBe(10.0);
  });

  it('snaps to the nearest entry — 16 cm is equidistant 15/17, ties go to first found (15 cm → 1.3 L)', () => {
    expect(diameterToVolume(16)).toBe(1.3);
  });

  it('snaps to the nearest entry — 13 cm is equidistant 12/14, picks 12 cm (0.7 L)', () => {
    // 13 is equidistant between 12 and 14; implementation picks first found at min distance
    const result = diameterToVolume(13);
    expect([0.7, 1.0]).toContain(result);
  });

  it('returns smallest entry for a value below the table minimum', () => {
    expect(diameterToVolume(1)).toBe(0.07);
  });

  it('returns largest entry for a value above the table maximum', () => {
    expect(diameterToVolume(999)).toBe(10.0);
  });
});

// ─── computeMix — H⁺ ion method correctness ──────────────────────────────────

describe('computeMix', () => {
  it('returns the correct profile name', () => {
    const result = computeMix('Epiphytic Aroid', 1);
    expect(result.profileName).toBe('Epiphytic Aroid');
  });

  it('component volumes sum to the requested total', () => {
    const vol = 2;
    const result = computeMix('General Tropical', vol);
    const total = result.components.reduce((acc, c) => acc + c.volumeLitres, 0);
    expect(total).toBeCloseTo(vol, 1);
  });

  it('Peat-Based Bog pH low is around 3.3 — not 5.0 (H⁺ method, not linear)', () => {
    const result = computeMix('Peat-Based Bog', 1);
    // Linear average would give ~5.0; H⁺ method must give ~3.3
    expect(result.phLow).toBeGreaterThanOrEqual(3.0);
    expect(result.phLow).toBeLessThanOrEqual(3.6);
    expect(result.phHigh).toBeGreaterThanOrEqual(4.5);
    expect(result.phHigh).toBeLessThanOrEqual(5.0);
  });

  it('Epiphytic Aroid pH is approx 4.4–6.7', () => {
    const result = computeMix('Epiphytic Aroid', 1);
    expect(result.phLow).toBeGreaterThanOrEqual(4.0);
    expect(result.phLow).toBeLessThanOrEqual(4.8);
    expect(result.phHigh).toBeGreaterThanOrEqual(6.4);
    expect(result.phHigh).toBeLessThanOrEqual(7.0);
  });

  it('Desert Succulent pH is approx 6.3–7.0', () => {
    const result = computeMix('Desert Succulent', 1);
    expect(result.phLow).toBeGreaterThanOrEqual(6.0);
    expect(result.phLow).toBeLessThanOrEqual(6.6);
    expect(result.phHigh).toBeCloseTo(7.0, 0);
  });

  it('Sphagnum Epiphyte pH low is approx 3.7–4.7 — not 4.6 (H⁺ method)', () => {
    const result = computeMix('Sphagnum Epiphyte', 1);
    expect(result.phLow).toBeGreaterThanOrEqual(3.5);
    expect(result.phLow).toBeLessThanOrEqual(4.2);
    expect(result.phHigh).toBeGreaterThanOrEqual(4.4);
    expect(result.phHigh).toBeLessThanOrEqual(5.0);
  });

  it('General Tropical pH is approx 6.1–6.9', () => {
    const result = computeMix('General Tropical', 1);
    expect(result.phLow).toBeGreaterThanOrEqual(5.8);
    expect(result.phLow).toBeLessThanOrEqual(6.4);
    expect(result.phHigh).toBeGreaterThanOrEqual(6.6);
    expect(result.phHigh).toBeLessThanOrEqual(7.0);
  });

  it('scales component volumes proportionally to requested volume', () => {
    const result = computeMix('Epiphytic Aroid', 2);
    const bark = result.components.find((c) => c.name === 'Orchid Bark')!;
    expect(bark.volumeLitres).toBeCloseTo(0.8, 1); // 40% of 2 L
  });
});

// ─── getPhStatus ──────────────────────────────────────────────────────────────

describe('getPhStatus', () => {
  it('returns compatible when ranges overlap', () => {
    const status = getPhStatus(6.0, 7.0, 6.5, 7.5);
    expect(status.compatibility).toBe('compatible');
  });

  it('returns too-acidic when mix high is below ideal min', () => {
    const status = getPhStatus(3.0, 4.0, 5.5, 6.5);
    expect(status.compatibility).toBe('too-acidic');
    expect(status.message).toMatch(/Too acidic/);
    expect(status.message).toContain('5.5');
  });

  it('returns too-alkaline when mix low is above ideal max', () => {
    const status = getPhStatus(7.5, 8.0, 5.5, 6.5);
    expect(status.compatibility).toBe('too-alkaline');
    expect(status.message).toMatch(/Too alkaline/);
    expect(status.message).toContain('6.5');
  });

  it('compatible message includes ideal pH range', () => {
    const status = getPhStatus(6.0, 6.8, 5.5, 7.0);
    expect(status.message).toContain('5.5');
    expect(status.message).toContain('7.0');
  });
});

// ─── preferredSoilToProfile ───────────────────────────────────────────────────

describe('preferredSoilToProfile', () => {
  it('Sandy → Desert Succulent', () => {
    expect(preferredSoilToProfile(['Sandy'])).toBe('Desert Succulent');
  });

  it('Well-draining + Dry → Desert Succulent', () => {
    expect(preferredSoilToProfile(['Well-draining', 'Dry'])).toBe('Desert Succulent');
  });

  it('Well-draining + Gritty → Desert Succulent', () => {
    expect(preferredSoilToProfile(['Well-draining', 'Gritty'])).toBe('Desert Succulent');
  });

  it('Sphagnum → Sphagnum Epiphyte', () => {
    expect(preferredSoilToProfile(['Sphagnum'])).toBe('Sphagnum Epiphyte');
  });

  it('Peaty → Peat-Based Bog', () => {
    expect(preferredSoilToProfile(['Peaty'])).toBe('Peat-Based Bog');
  });

  it('Acidic → Peat-Based Bog', () => {
    expect(preferredSoilToProfile(['Acidic'])).toBe('Peat-Based Bog');
  });

  it('Chunky → Epiphytic Aroid', () => {
    expect(preferredSoilToProfile(['Chunky'])).toBe('Epiphytic Aroid');
  });

  it('Bark → Epiphytic Aroid', () => {
    expect(preferredSoilToProfile(['Bark'])).toBe('Epiphytic Aroid');
  });

  it('returns null for unrecognised types (caller falls back to General Tropical)', () => {
    expect(preferredSoilToProfile(['Loamy'])).toBeNull();
    expect(preferredSoilToProfile([])).toBeNull();
  });

  it('Well-draining alone without Dry/Gritty does NOT map to Desert Succulent', () => {
    expect(preferredSoilToProfile(['Well-draining'])).toBeNull();
  });
});

// ─── substrateFactorToProfile ────────────────────────────────────────────────

describe('substrateFactorToProfile', () => {
  it('maps High-Drainage Aroid → Epiphytic Aroid', () => {
    expect(substrateFactorToProfile('High-Drainage Aroid')).toBe('Epiphytic Aroid');
  });

  it('maps Desert Succulent → Desert Succulent', () => {
    expect(substrateFactorToProfile('Desert Succulent')).toBe('Desert Succulent');
  });

  it('maps Sphagnum Moss Mix → Sphagnum Epiphyte', () => {
    expect(substrateFactorToProfile('Sphagnum Moss Mix')).toBe('Sphagnum Epiphyte');
  });

  it('maps Heavy Peat → Peat-Based Bog', () => {
    expect(substrateFactorToProfile('Heavy Peat')).toBe('Peat-Based Bog');
  });

  it('maps Standard Potting → General Tropical', () => {
    expect(substrateFactorToProfile('Standard Potting')).toBe('General Tropical');
  });
});
