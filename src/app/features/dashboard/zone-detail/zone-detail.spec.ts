import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ZoneDetailComponent } from './zone-detail';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { ZoneService } from '../zone.service';
import { PlantService } from '../../tasks/plant.service';
import { LibraryService, CachedBotanicalRecord } from '../../library/library.service';
import { JournalService } from '../../journal/journal.service';
import type { Zone } from '../zone.model';
import type { Plant } from '../../tasks/plant.model';

const ZONE_ID = 'zone-1';
const PLANT_ID = 'plant-1';

function makeZone(overrides: Partial<Zone> = {}): Zone {
  return {
    id: ZONE_ID,
    user_id: 'user-1',
    name: 'Test Zone',
    icon: 'ri-plant-line',
    zone_type: 'indoor',
    window_orientation: 'None',
    has_active_ventilation: false,
    has_grow_lights: false,
    humidity_baseline: 50,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: PLANT_ID,
    user_id: 'user-1',
    zone_id: ZONE_ID,
    common_name: 'Test Plant',
    scientific_name: 'Testus botanicus',
    inat_taxon_id: null,
    container_vector: 'Plastic',
    substrate_factor: 'Standard Potting',
    growth_stage: 'Mature',
    last_checked_at: null,
    next_check_due_at: new Date(Date.now() + 86_400_000).toISOString(),
    current_snooze_interval_days: 7,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRecord(overrides: Partial<CachedBotanicalRecord> = {}): CachedBotanicalRecord {
  return {
    scientific_name: 'Testus botanicus',
    common_name: 'Test Plant',
    cached_at: '2024-01-01T00:00:00Z',
    is_ai_enriched: true,
    placement: null,
    is_tropical: null,
    sunlight: null,
    watering: null,
    cycle: null,
    plant_type: null,
    care_difficulty: null,
    check_depth_description: null,
    description: null,
    ideal_humidity_min: null,
    ideal_humidity_max: null,
    ideal_min_ph: null,
    ideal_max_ph: null,
    is_toxic_to_pets: null,
    is_toxic_to_humans: null,
    toxicity_notes: null,
    human_toxicity_notes: null,
    propagation_methods: null,
    raw_api_payload: null,
    produces_fruit: null,
    fruit_season: null,
    produces_flowers: null,
    flowering_season: null,
    growth_rate: null,
    maintenance_level: null,
    preferred_soil_type: null,
    native_region: null,
    max_height_cm: null,
    max_spread_cm: null,
    air_purifying: null,
    thumbnail_url: null,
    regular_url: null,
    thumbnail_fetched: false,
    inat_taxon_id: null,
    inat_species_id: null,
    inat_rank: null,
    gallery_urls: null,
    ...overrides,
  };
}

describe('ZoneDetailComponent – incompatibilities', () => {
  const zonesSignal = signal<Zone[]>([]);
  const plantsSignal = signal<Plant[]>([]);

  beforeEach(async () => {
    zonesSignal.set([]);
    plantsSignal.set([]);

    await TestBed.configureTestingModule({
      imports: [ZoneDetailComponent],
      providers: [
        provideRouter([]),
        provideTranslocoTesting(),
        {
          provide: ZoneService,
          useValue: {
            zones: zonesSignal,
            loading: signal(false),
            error: signal(null),
            loadZones: vi.fn().mockResolvedValue(undefined),
            updateZone: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: PlantService,
          useValue: {
            plants: plantsSignal,
            loading: signal(false),
            error: signal(null),
            loadPlants: vi.fn().mockResolvedValue(undefined),
            deletePlant: vi.fn().mockResolvedValue(undefined),
            confirmCheck: vi.fn().mockResolvedValue(undefined),
            snoozeCheck: vi.fn().mockResolvedValue(undefined),
            createPlant: vi.fn().mockResolvedValue(null),
            updatePlant: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LibraryService,
          useValue: {
            refetchByScientificNames: vi.fn().mockResolvedValue([]),
            triggerEnrichment: vi.fn().mockResolvedValue(undefined),
            fetchByScientificName: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: JournalService,
          useValue: { logWatering: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    })
      .overrideTemplate(ZoneDetailComponent, '')
      .compileComponents();
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function create(zone: Zone, plant: Plant, record: CachedBotanicalRecord): any {
    zonesSignal.set([zone]);
    plantsSignal.set([plant]);
    const fixture = TestBed.createComponent(ZoneDetailComponent);
    fixture.componentRef.setInput('id', ZONE_ID);
    fixture.componentInstance.botanicalMap.set(new Map([[record.scientific_name, record]]));
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return fixture.componentInstance as any;
  }

  // ── No record → no warnings ────────────────────────────────────────────────

  it('produces no warnings when no botanical record is linked', () => {
    const zone = makeZone({ zone_type: 'outdoor' });
    const plant = makePlant({ scientific_name: null });
    zonesSignal.set([zone]);
    plantsSignal.set([plant]);
    const fixture = TestBed.createComponent(ZoneDetailComponent);
    fixture.componentRef.setInput('id', ZONE_ID);
    fixture.detectChanges();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((fixture.componentInstance as any).incompatibilities().size).toBe(0);
  });

  // ── Placement mismatch ─────────────────────────────────────────────────────

  it('warns when an Indoor plant is placed in an outdoor zone', () => {
    const c = create(
      makeZone({ zone_type: 'outdoor' }),
      makePlant(),
      makeRecord({ placement: 'Indoor' }),
    );
    expect(c.incompatibilities().get(PLANT_ID)).toContain('Prefers indoor conditions');
  });

  it('warns when an Outdoor plant is placed in an indoor zone', () => {
    const c = create(
      makeZone({ zone_type: 'indoor' }),
      makePlant(),
      makeRecord({ placement: 'Outdoor' }),
    );
    expect(c.incompatibilities().get(PLANT_ID)).toContain('Prefers outdoor conditions');
  });

  it('produces no placement warning when plant is Both', () => {
    const c = create(
      makeZone({ zone_type: 'outdoor' }),
      makePlant(),
      makeRecord({ placement: 'Both' }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('conditions'))).toBe(false);
  });

  // ── Humidity ───────────────────────────────────────────────────────────────

  it('warns when zone humidity is below the plant ideal minimum', () => {
    const c = create(
      makeZone({ humidity_baseline: 40 }),
      makePlant(),
      makeRecord({ ideal_humidity_min: 60 }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('40%') && w.includes('60%'))).toBe(true);
  });

  it('produces no humidity warning when zone equals the minimum', () => {
    const c = create(
      makeZone({ humidity_baseline: 60 }),
      makePlant(),
      makeRecord({ ideal_humidity_min: 60 }),
    );
    expect(c.incompatibilities().get(PLANT_ID) ?? []).toHaveLength(0);
  });

  it('produces no humidity warning when ideal_humidity_min is null', () => {
    const c = create(
      makeZone({ humidity_baseline: 20 }),
      makePlant(),
      makeRecord({ ideal_humidity_min: null }),
    );
    expect(c.incompatibilities().get(PLANT_ID) ?? []).toHaveLength(0);
  });

  // ── Light / window orientation ─────────────────────────────────────────────

  it('warns about no light when orientation is None and grow lights are off', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'None', has_grow_lights: false }),
      makePlant(),
      makeRecord({ sunlight: ['full_sun'] }),
    );
    expect(c.incompatibilities().get(PLANT_ID)).toContain(
      'No natural light source — grow lights recommended',
    );
  });

  it('no "no light" warning when grow lights are on', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'None', has_grow_lights: true }),
      makePlant(),
      makeRecord({ sunlight: ['full_sun'] }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('No natural light'))).toBe(false);
  });

  it('warns about low light for full-sun plant in North zone without grow lights', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'North', has_grow_lights: false }),
      makePlant(),
      makeRecord({ sunlight: ['full_sun'] }),
    );
    expect(c.incompatibilities().get(PLANT_ID)).toContain(
      'Needs direct sunlight — north-facing zones provide little',
    );
  });

  it('suppresses low-light warning when grow lights compensate', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'North', has_grow_lights: true }),
      makePlant(),
      makeRecord({ sunlight: ['full_sun'] }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('north-facing'))).toBe(false);
  });

  it('suppresses low-light warning when plant also tolerates shade', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'Northeast', has_grow_lights: false }),
      makePlant(),
      makeRecord({ sunlight: ['full_sun', 'full_shade'] }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('north-facing'))).toBe(false);
  });

  it('warns about too much light for shade-only plant in South zone', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'South', has_grow_lights: false }),
      makePlant(),
      makeRecord({ sunlight: ['full_shade'] }),
    );
    expect(c.incompatibilities().get(PLANT_ID)).toContain(
      'Prefers indirect light — direct sun may cause leaf scorch',
    );
  });

  it('suppresses high-light warning when plant also tolerates part_shade', () => {
    const c = create(
      makeZone({ zone_type: 'indoor', window_orientation: 'Southwest', has_grow_lights: false }),
      makePlant(),
      makeRecord({ sunlight: ['full_shade', 'part_shade'] }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('leaf scorch'))).toBe(false);
  });

  it('skips light checks for outdoor zones', () => {
    const c = create(
      makeZone({ zone_type: 'outdoor', window_orientation: 'North', has_grow_lights: false }),
      makePlant(),
      makeRecord({ sunlight: ['full_sun'] }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.some((w) => w.includes('north-facing'))).toBe(false);
  });

  it('accumulates multiple warnings on a single plant', () => {
    const c = create(
      makeZone({
        zone_type: 'indoor',
        window_orientation: 'North',
        has_grow_lights: false,
        humidity_baseline: 20,
      }),
      makePlant(),
      makeRecord({
        placement: 'Outdoor',
        sunlight: ['full_sun'],
        ideal_humidity_min: 60,
      }),
    );
    const warnings: string[] = c.incompatibilities().get(PLANT_ID) ?? [];
    expect(warnings.length).toBeGreaterThanOrEqual(3);
  });
});
