import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantIdentifierDialogComponent } from './plant-identifier-dialog';
import { PlantIdentifierService } from '../../../core/services/plant-identifier.service';

const mockIdentifierService = {
  identify: vi.fn(),
  fetchCandidateRecords: vi.fn().mockResolvedValue(new Map()),
};

function setup() {
  TestBed.configureTestingModule({
    imports: [PlantIdentifierDialogComponent],
    providers: [{ provide: PlantIdentifierService, useValue: mockIdentifierService }],
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
  perenual_id: 42,
  inat_taxon_id: null,
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

  // ── emittablePerenualId ────────────────────────────────────────────────────

  describe('emittablePerenualId', () => {
    it('returns the perenual_id from the result when the primary match is active', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(PRIMARY);
      expect(comp['emittablePerenualId']()).toBe(42);
    });

    it('returns null when an alternative is active (perenual_id is for primary only)', () => {
      const comp = setup();
      comp.identResult.set(MOCK_RESULT);
      comp.activeMatch.set(ALTERNATIVE);
      expect(comp['emittablePerenualId']()).toBeNull();
    });

    it('returns null when result has no perenual_id', () => {
      const comp = setup();
      comp.identResult.set({ ...MOCK_RESULT, perenual_id: null });
      comp.activeMatch.set(PRIMARY);
      expect(comp['emittablePerenualId']()).toBeNull();
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
