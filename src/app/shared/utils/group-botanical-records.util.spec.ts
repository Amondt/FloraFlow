import { describe, it, expect } from 'vitest';
import { groupBotanicalRecords } from './group-botanical-records.util';
import type { CachedBotanicalRecord } from '../../features/library/library.service';

function rec(
  scientific_name: string,
  common_name: string,
  description: string | null = null,
  thumbnail_url: string | null = null,
): CachedBotanicalRecord {
  return {
    scientific_name,
    common_name,
    description,
    thumbnail_url,
  } as unknown as CachedBotanicalRecord;
}

describe('groupBotanicalRecords', () => {
  it('returns an empty array for no input', () => {
    expect(groupBotanicalRecords([])).toEqual([]);
  });

  it('creates one group per unique common_name', () => {
    const result = groupBotanicalRecords([
      rec('Rosa canina', 'Dog Rose'),
      rec("Physocarpus opulifolius 'Dart's Gold'", 'Ninebark'),
      rec("Physocarpus opulifolius 'Center Glow'", 'Ninebark'),
    ]);
    expect(result).toHaveLength(2);
  });

  it('groups case-insensitively by common_name', () => {
    const result = groupBotanicalRecords([
      rec('Rosa canina', 'Dog rose'),
      rec('Rosa canina subsp. x', 'DOG ROSE'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].varieties).toHaveLength(2);
  });

  it('sorts groups alphabetically by commonName', () => {
    const result = groupBotanicalRecords([
      rec('Zea mays', 'Corn'),
      rec('Acer palmatum', 'Japanese maple'),
      rec('Rosa canina', 'Dog rose'),
    ]);
    expect(result.map((g) => g.commonName)).toEqual(['Corn', 'Dog rose', 'Japanese maple']);
  });

  describe('representative selection', () => {
    it('prefers the base species (no apostrophe) as representative', () => {
      const base = rec('Physocarpus opulifolius', 'Ninebark');
      const cultivar = rec("Physocarpus opulifolius 'Dart's Gold'", 'Ninebark');
      const result = groupBotanicalRecords([cultivar, base]);
      expect(result[0].representative.scientific_name).toBe('Physocarpus opulifolius');
    });

    it('falls back to most-enriched cultivar when no base species exists', () => {
      const noFields = rec("Rosa 'Plain'", 'Test rose');
      const withDesc = rec("Rosa 'Rich'", 'Test rose', 'A description', null);
      const withBoth = rec("Rosa 'Best'", 'Test rose', 'A description', 'http://img.jpg');
      const result = groupBotanicalRecords([noFields, withDesc, withBoth]);
      expect(result[0].representative.scientific_name).toBe("Rosa 'Best'");
    });

    it('uses alphabetical tiebreak when enrichment scores are equal', () => {
      const a = rec("Acer 'B'", 'Maple');
      const b = rec("Acer 'A'", 'Maple');
      const result = groupBotanicalRecords([a, b]);
      expect(result[0].representative.scientific_name).toBe("Acer 'A'");
    });
  });

  describe('varieties sort order', () => {
    it('places the base species first', () => {
      const base = rec('Physocarpus opulifolius', 'Ninebark');
      const cultivarZ = rec("Physocarpus opulifolius 'Zorro'", 'Ninebark');
      const cultivarA = rec("Physocarpus opulifolius 'Alpha'", 'Ninebark');
      const result = groupBotanicalRecords([cultivarZ, cultivarA, base]);
      expect(result[0].varieties[0].scientific_name).toBe('Physocarpus opulifolius');
    });

    it('sorts remaining cultivars alphabetically after the base species', () => {
      const base = rec('Physocarpus opulifolius', 'Ninebark');
      const cultivarZ = rec("Physocarpus opulifolius 'Zorro'", 'Ninebark');
      const cultivarA = rec("Physocarpus opulifolius 'Alpha'", 'Ninebark');
      const result = groupBotanicalRecords([cultivarZ, base, cultivarA]);
      const names = result[0].varieties.map((v) => v.scientific_name);
      expect(names).toEqual([
        'Physocarpus opulifolius',
        "Physocarpus opulifolius 'Alpha'",
        "Physocarpus opulifolius 'Zorro'",
      ]);
    });

    it('sorts all cultivars alphabetically when no base species exists', () => {
      const result = groupBotanicalRecords([
        rec("Rosa 'Zephyr'", 'Test rose'),
        rec("Rosa 'Amber'", 'Test rose'),
      ]);
      const names = result[0].varieties.map((v) => v.scientific_name);
      expect(names).toEqual(["Rosa 'Amber'", "Rosa 'Zephyr'"]);
    });
  });

  describe('baseScientificName extraction', () => {
    it('strips everything from the first apostrophe', () => {
      const result = groupBotanicalRecords([
        rec("Physocarpus opulifolius 'Dart's Gold'", 'Ninebark'),
      ]);
      expect(result[0].baseScientificName).toBe('Physocarpus opulifolius');
    });

    it('returns the full name when no apostrophe is present', () => {
      const result = groupBotanicalRecords([rec('Rosa canina', 'Dog rose')]);
      expect(result[0].baseScientificName).toBe('Rosa canina');
    });

    it('handles multi-word species bases (hybrid notation)', () => {
      const result = groupBotanicalRecords([
        rec("Juniperus x media 'Daub's Frosted (tree form)'", "Daub's frosted juniper"),
      ]);
      expect(result[0].baseScientificName).toBe('Juniperus x media');
    });

    it('handles group notation in the base name', () => {
      const result = groupBotanicalRecords([
        rec("Beta vulgaris (Garden Beet Group) 'Bull's Blood'", 'Beet'),
      ]);
      expect(result[0].baseScientificName).toBe('Beta vulgaris (Garden Beet Group)');
    });

    it('handles genus-only entries', () => {
      const result = groupBotanicalRecords([
        rec("Cornus 'Eddie's White Wonder'", "Eddie's white wonder flowering dogwood"),
      ]);
      expect(result[0].baseScientificName).toBe('Cornus');
    });
  });

  describe('multiple apostrophes in cultivar names', () => {
    it("preserves Dart's Gold as a single variety", () => {
      const result = groupBotanicalRecords([
        rec("Physocarpus opulifolius 'Dart's Gold'", 'Ninebark'),
      ]);
      expect(result[0].varieties).toHaveLength(1);
      expect(result[0].varieties[0].scientific_name).toBe("Physocarpus opulifolius 'Dart's Gold'");
    });

    it("preserves Naylor's Blue as a single variety", () => {
      const result = groupBotanicalRecords([
        rec("Cupressocyparis x leylandii 'Naylor's Blue'", "Naylor's blue leyland cypress"),
      ]);
      expect(result[0].varieties[0].scientific_name).toBe(
        "Cupressocyparis x leylandii 'Naylor's Blue'",
      );
    });

    it("handles Jeanne d'Arc (French apostrophe in cultivar)", () => {
      const result = groupBotanicalRecords([rec("Crocus vernus 'Jeanne d'Arc'", 'Spring crocus')]);
      expect(result[0].varieties[0].scientific_name).toBe("Crocus vernus 'Jeanne d'Arc'");
    });
  });
});
