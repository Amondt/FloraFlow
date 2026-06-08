import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantIdentifierDialogComponent } from './plant-identifier-dialog';
import { PlantIdentifierService } from '../../../core/services/plant-identifier.service';
import type { BotanicalCacheRow } from '../../../core/services/plant-identifier.service';
import { LibraryService } from '../../../features/library/library.service';

const mockIdentifierService = {
  identify: vi.fn(),
  fetchCandidateRecords: vi.fn().mockResolvedValue(new Map()),
};

const mockLibraryService = {
  refetchByScientificNames: vi.fn().mockResolvedValue([]),
  triggerEnrichment: vi.fn().mockResolvedValue(undefined),
};

function setup() {
  TestBed.configureTestingModule({
    imports: [PlantIdentifierDialogComponent],
    providers: [
      { provide: PlantIdentifierService, useValue: mockIdentifierService },
      { provide: LibraryService, useValue: mockLibraryService },
    ],
  }).overrideTemplate(PlantIdentifierDialogComponent, '');

  const fixture = TestBed.createComponent(PlantIdentifierDialogComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return component;
}

const PRIMARY: import('../../../core/services/plant-identifier.service').PlantIdCandidate = {
  common_name: 'Monstera',
  scientific_name: 'Monstera deliciosa',
  confidence_score: 0.9,
};

const ALTERNATIVE: import('../../../core/services/plant-identifier.service').PlantIdCandidate = {
  common_name: 'Pothos',
  scientific_name: 'Epipremnum aureum',
  confidence_score: 0.6,
};

const MOCK_RESULT: import('../../../core/services/plant-identifier.service').PlantIdResult = {
  is_plant_image: true,
  species_match: PRIMARY,
  alternative_candidates: [ALTERNATIVE],
  inat_taxon_id: 42,
};

describe('PlantIdentifierDialogComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── allCandidates ──────────────────────────────────────────────────────────

  describe('allCandidates', () => {
    it('returns empty array when no result is loaded', () => {
      const comp = setup();
      expect(comp['allCandidates']()).toEqual([]);
    });

    it('returns [species_match, ...alternatives] in order', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      expect(comp['allCandidates']()).toEqual([PRIMARY, ALTERNATIVE]);
    });
  });

  // ── isPrimaryMatch ─────────────────────────────────────────────────────────

  describe('isPrimaryMatch', () => {
    it('returns true when the active match is the primary species', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(PRIMARY);
      expect(comp['isPrimaryMatch']()).toBe(true);
    });

    it('returns false when an alternative is selected', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(ALTERNATIVE);
      expect(comp['isPrimaryMatch']()).toBe(false);
    });
  });

  // ── emittableInatTaxonId ──────────────────────────────────────────────────

  describe('emittableInatTaxonId', () => {
    it('returns the inat_taxon_id from the result when the primary match is active and not cached', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(PRIMARY);
      // candidateRecords is empty — falls back to identResult.inat_taxon_id
      expect(comp['emittableInatTaxonId']()).toBe(42);
    });

    it('returns null when an alternative is active and not in the botanical cache', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(ALTERNATIVE);
      // identResult.inat_taxon_id only covers the primary; no cache entry for ALTERNATIVE
      expect(comp['emittableInatTaxonId']()).toBeNull();
    });

    it('returns inat_taxon_id from candidateRecords for an alternative when cached', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(ALTERNATIVE);
      // Simulate the enrichment poll populating the botanical cache for the alternative
      comp.candidateRecords.set(
        new Map([
          [ALTERNATIVE.scientific_name, { inat_taxon_id: 99 } as unknown as BotanicalCacheRow],
        ]),
      );
      expect(comp['emittableInatTaxonId']()).toBe(99);
    });

    it('returns null when result has no inat_taxon_id and plant is not cached', () => {
      const comp = setup();
      comp.identResult.set({ ...MOCK_RESULT, inat_taxon_id: null });
      comp.activeMatch.set(PRIMARY);
      expect(comp['emittableInatTaxonId']()).toBeNull();
    });
  });

  // ── confidenceBadgeClass ───────────────────────────────────────────────────

  describe('confidenceBadgeClass', () => {
    it('returns green class when score > 0.75', () => {
      const comp = setup();
      comp.activeMatch.set({ ...PRIMARY, confidence_score: 0.9 });
      expect(comp['confidenceBadgeClass']()).toContain('bg-green-100');
    });

    it('returns neutral class when score is 0.5–0.75', () => {
      const comp = setup();
      comp.activeMatch.set({ ...PRIMARY, confidence_score: 0.65 });
      expect(comp['confidenceBadgeClass']()).toContain('bg-neutral-100');
    });

    it('returns amber class when score < 0.5', () => {
      const comp = setup();
      comp.activeMatch.set({ ...PRIMARY, confidence_score: 0.3 });
      expect(comp['confidenceBadgeClass']()).toContain('bg-yellow-100');
    });

    it('defaults to amber when no active match', () => {
      const comp = setup();
      expect(comp['confidenceBadgeClass']()).toContain('bg-yellow-100');
    });
  });

  // ── confidenceBadgeLabel ───────────────────────────────────────────────────

  describe('confidenceBadgeLabel', () => {
    it('includes "confident" for score > 0.75', () => {
      const comp = setup();
      comp.activeMatch.set({ ...PRIMARY, confidence_score: 0.9 });
      expect(comp['confidenceBadgeLabel']()).toMatch(/confident/);
    });

    it('includes "low confidence" for score 0.5–0.75', () => {
      const comp = setup();
      comp.activeMatch.set({ ...PRIMARY, confidence_score: 0.65 });
      expect(comp['confidenceBadgeLabel']()).toMatch(/low confidence/);
    });

    it('includes "uncertain" for score < 0.5', () => {
      const comp = setup();
      comp.activeMatch.set({ ...PRIMARY, confidence_score: 0.3 });
      expect(comp['confidenceBadgeLabel']()).toMatch(/uncertain/);
    });
  });

  // ── candidateChipBadgeClass ────────────────────────────────────────────────

  describe('candidateChipBadgeClass', () => {
    it('delegates to the same thresholds as confidenceBadgeClass', () => {
      const comp = setup();
      expect(comp['candidateChipBadgeClass'](0.9)).toContain('bg-green-100');
      expect(comp['candidateChipBadgeClass'](0.65)).toContain('bg-neutral-100');
      expect(comp['candidateChipBadgeClass'](0.3)).toContain('bg-yellow-100');
    });
  });

  // ── candidateChipBadgeLabel ────────────────────────────────────────────────

  describe('candidateChipBadgeLabel', () => {
    it('returns compact percentage string', () => {
      const comp = setup();
      expect(comp['candidateChipBadgeLabel'](0.72)).toBe('72%');
      expect(comp['candidateChipBadgeLabel'](0.9)).toBe('90%');
    });
  });
});
