import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantIdentifierService } from './plant-identifier.service';
import { SupabaseService } from './supabase.service';
import { ImageCompressorService } from './image-compressor.service';
import type { BotanicalCacheRow } from './plant-identifier.service';

// Minimal cache row fixture — only fields needed to identify records by scientific_name
function makeRow(scientificName: string): BotanicalCacheRow {
  return {
    id: crypto.randomUUID(),
    scientific_name: scientificName,
    common_name: scientificName,

    watering: 'Average',
    sunlight: null,
    cycle: null,
    plant_type: null,
    ideal_min_ph: null,
    ideal_max_ph: null,
    is_toxic_to_pets: false,
    toxicity_notes: null,
    propagation_methods: null,
    check_depth_description: null,
    ideal_humidity_min: null,
    ideal_humidity_max: null,
    care_difficulty: null,
    is_ai_enriched: false,
    cached_at: new Date().toISOString(),
    description: null,
    placement: null,
    is_tropical: false,
    is_toxic_to_humans: false,
    human_toxicity_notes: null,
    produces_fruit: false,
    fruit_season: null,
    produces_flowers: false,
    flowering_season: null,
    growth_rate: null,
    maintenance_level: null,
    preferred_soil_type: null,
    native_region: null,
    max_height_cm: null,
    max_spread_cm: null,
    air_purifying: false,
    thumbnail_url: null,
    regular_url: null,
    thumbnail_fetched: false,
    inat_taxon_id: null,
    inat_species_id: null,
    inat_rank: null,
  } as unknown as BotanicalCacheRow;
}

function makeSupabaseMock(resolvedData: BotanicalCacheRow[] | null) {
  const mockIn = vi.fn().mockResolvedValue({ data: resolvedData, error: null });
  const mockSelect = vi.fn().mockReturnValue({ in: mockIn });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
  return { client: { from: mockFrom }, getAuthToken: vi.fn().mockResolvedValue('tok') };
}

function setup(resolvedData: BotanicalCacheRow[] | null) {
  const supabaseMock = makeSupabaseMock(resolvedData);
  TestBed.configureTestingModule({
    providers: [
      PlantIdentifierService,
      { provide: SupabaseService, useValue: supabaseMock },
      { provide: HttpClient, useValue: {} },
      { provide: ImageCompressorService, useValue: {} },
    ],
  });
  return TestBed.inject(PlantIdentifierService);
}

describe('PlantIdentifierService.fetchCandidateRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seeds every requested name with null before overwriting from DB', async () => {
    const names = ['Rosa canina', 'Ficus lyrata', 'Dracaena marginata'];
    // DB only has the first two
    const service = setup([makeRow('Rosa canina'), makeRow('Ficus lyrata')]);

    const result = await service.fetchCandidateRecords(names);

    expect(result.has('Rosa canina')).toBe(true);
    expect(result.has('Ficus lyrata')).toBe(true);
    expect(result.has('Dracaena marginata')).toBe(true);
  });

  it('overwrites seed with actual DB row when the species is cached', async () => {
    const names = ['Monstera deliciosa'];
    const row = makeRow('Monstera deliciosa');
    const service = setup([row]);

    const result = await service.fetchCandidateRecords(names);

    expect(result.get('Monstera deliciosa')).toEqual(row);
  });

  it('species absent from DB stays null — not undefined, not missing', async () => {
    const names = ['Unknown species'];
    const service = setup([]); // DB returns empty array — species not cached

    const result = await service.fetchCandidateRecords(names);

    expect(result.has('Unknown species')).toBe(true);
    expect(result.get('Unknown species')).toBeNull();
  });

  it('empty input returns empty map', async () => {
    const service = setup([]);

    const result = await service.fetchCandidateRecords([]);

    expect(result.size).toBe(0);
  });

  it('DB returning null data — all names remain null (no crash)', async () => {
    const names = ['Rosa canina'];
    const service = setup(null); // DB error path: data is null

    const result = await service.fetchCandidateRecords(names);

    expect(result.get('Rosa canina')).toBeNull();
  });
});
