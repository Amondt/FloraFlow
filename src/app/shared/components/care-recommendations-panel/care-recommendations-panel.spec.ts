import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { CareRecommendationsPanelComponent } from './care-recommendations-panel';
import type { CachedBotanicalRecord } from '../../../features/library/library.service';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';

function makeRecord(overrides: Partial<CachedBotanicalRecord> = {}): CachedBotanicalRecord {
  return {
    air_purifying: null,
    cached_at: '2024-01-01T00:00:00Z',
    care_difficulty: null,
    check_depth_description: null,
    common_name: 'Monstera',
    cycle: null,
    description: null,
    flowering_season: null,
    fruit_season: null,
    growth_rate: null,
    human_toxicity_notes: null,
    ideal_humidity_max: null,
    ideal_humidity_min: null,
    ideal_max_ph: null,
    ideal_min_ph: null,
    is_ai_enriched: false,
    is_toxic_to_humans: null,
    is_toxic_to_pets: null,
    is_tropical: null,
    maintenance_level: null,
    max_height_cm: null,
    max_spread_cm: null,
    native_region: null,

    placement: null,
    plant_type: null,
    preferred_soil_type: null,
    produces_flowers: null,
    produces_fruit: null,
    propagation_methods: null,
    raw_api_payload: null,
    scientific_name: 'Monstera deliciosa',
    sunlight: null,
    thumbnail_url: null,
    regular_url: null,
    thumbnail_fetched: false,
    toxicity_notes: null,
    watering: null,
    inat_taxon_id: null,
    inat_species_id: null,
    inat_rank: null,
    gallery_urls: null,
    ...overrides,
  };
}

describe('CareRecommendationsPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CareRecommendationsPanelComponent],
      providers: [...provideTranslocoTesting()],
    })
      .overrideTemplate(CareRecommendationsPanelComponent, '')
      .compileComponents();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function create(record: CachedBotanicalRecord, zoneHumidity?: number | null): any {
    const fixture = TestBed.createComponent(CareRecommendationsPanelComponent);
    fixture.componentRef.setInput('record', record);
    if (zoneHumidity !== undefined) {
      fixture.componentRef.setInput('zoneHumidity', zoneHumidity);
    }
    return fixture.componentInstance;
  }

  // ── difficultyClass ────────────────────────────────────────────────────────

  describe('difficultyClass()', () => {
    it('returns green classes for Beginner', () => {
      const c = create(makeRecord({ care_difficulty: 'Beginner' }));
      expect(c.difficultyClass()).toContain('bg-green-100');
      expect(c.difficultyClass()).toContain('text-green-700');
    });

    it('returns yellow classes for Intermediate', () => {
      const c = create(makeRecord({ care_difficulty: 'Intermediate' }));
      expect(c.difficultyClass()).toContain('bg-yellow-100');
      expect(c.difficultyClass()).toContain('text-yellow-700');
    });

    it('returns red classes for Advanced', () => {
      const c = create(makeRecord({ care_difficulty: 'Advanced' }));
      expect(c.difficultyClass()).toContain('bg-red-100');
      expect(c.difficultyClass()).toContain('text-red-700');
    });

    it('returns neutral classes when care_difficulty is null', () => {
      const c = create(makeRecord({ care_difficulty: null }));
      expect(c.difficultyClass()).toContain('bg-neutral-100');
      expect(c.difficultyClass()).toContain('text-neutral-600');
    });
  });

  // ── humidityStatus ─────────────────────────────────────────────────────────

  describe('humidityStatus()', () => {
    it('returns null when zoneHumidity input is not provided', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }));
      expect(c.humidityStatus()).toBeNull();
    });

    it('returns null when both humidity bounds on the record are null', () => {
      const c = create(makeRecord(), 50);
      expect(c.humidityStatus()).toBeNull();
    });

    it('returns "compatible" when zone is within the min–max range', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 70);
      expect(c.humidityStatus()).toBe('compatible');
    });

    it('returns "compatible" when zone equals the min boundary', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 60);
      expect(c.humidityStatus()).toBe('compatible');
    });

    it('returns "compatible" when zone equals the max boundary', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 80);
      expect(c.humidityStatus()).toBe('compatible');
    });

    it('returns "low" when zone is below the minimum', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 45);
      expect(c.humidityStatus()).toBe('low');
    });

    it('returns "high" when zone is above the maximum', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 90);
      expect(c.humidityStatus()).toBe('high');
    });

    it('returns "low" when only ideal_humidity_min is set and zone is below it', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: null }), 50);
      expect(c.humidityStatus()).toBe('low');
    });

    it('returns "high" when only ideal_humidity_max is set and zone is above it', () => {
      const c = create(makeRecord({ ideal_humidity_min: null, ideal_humidity_max: 80 }), 90);
      expect(c.humidityStatus()).toBe('high');
    });
  });

  // ── humidityWarningText ────────────────────────────────────────────────────

  describe('humidityWarningText()', () => {
    it('returns empty string when no zone humidity is provided', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }));
      expect(c.humidityWarningText()).toBe('');
    });

    it('returns empty string when humidity is compatible', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 70);
      expect(c.humidityWarningText()).toBe('');
    });

    it('includes "below" and both the zone value and the range when status is low', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 45);
      const text: string = c.humidityWarningText();
      expect(text).toContain('45%');
      expect(text).toContain('below');
      expect(text).toContain('60–80%');
    });

    it('includes "above" and both the zone value and the range when status is high', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: 80 }), 90);
      const text: string = c.humidityWarningText();
      expect(text).toContain('90%');
      expect(text).toContain('above');
      expect(text).toContain('60–80%');
    });

    it('formats the range as ≥min% when only min is provided', () => {
      const c = create(makeRecord({ ideal_humidity_min: 60, ideal_humidity_max: null }), 40);
      expect(c.humidityWarningText()).toContain('≥60%');
    });

    it('formats the range as ≤max% when only max is provided', () => {
      const c = create(makeRecord({ ideal_humidity_min: null, ideal_humidity_max: 80 }), 90);
      expect(c.humidityWarningText()).toContain('≤80%');
    });
  });
});
