import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BotanicalThumbnailService } from './botanical-thumbnail.service';
import { LibraryService } from '../../features/library/library.service';
import type { CachedBotanicalRecord } from '../../features/library/library.service';

function makeRecord(scientificName: string, thumbnailUrl: string | null): CachedBotanicalRecord {
  return {
    scientific_name: scientificName,
    thumbnail_url: thumbnailUrl,
    regular_url: null,
    common_name: scientificName,

    watering: null,
    sunlight: null,
    cycle: null,
    plant_type: null,
    is_ai_enriched: false,
    thumbnail_fetched: true,
    ideal_min_ph: null,
    ideal_max_ph: null,
    is_toxic_to_pets: null,
    toxicity_notes: null,
    propagation_methods: null,
    check_depth_description: null,
    ideal_humidity_min: null,
    ideal_humidity_max: null,
    care_difficulty: null,
    description: null,
    placement: null,
    preferred_soil_type: null,
    maintenance_level: null,
    is_tropical: null,
    is_air_purifying: null,
    is_toxic_to_humans: null,
    native_region: null,
    growth_rate: null,
    max_height_cm: null,
    flowering_season: null,
    dormancy_season: null,
    inat_taxon_id: null,
    inat_species_id: null,
    inat_rank: null,
    created_at: '',
    updated_at: '',
  } as unknown as CachedBotanicalRecord;
}

describe('BotanicalThumbnailService', () => {
  let service: BotanicalThumbnailService;
  let refetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    refetchSpy = vi.fn().mockResolvedValue([]);

    await TestBed.configureTestingModule({
      providers: [
        BotanicalThumbnailService,
        {
          provide: LibraryService,
          useValue: { refetchByScientificNames: refetchSpy },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(BotanicalThumbnailService);
  });

  describe('thumbnailFor()', () => {
    it('returns null for null input', () => {
      expect(service.thumbnailFor(null)).toBeNull();
    });

    it('returns null when the name is not in the map', () => {
      expect(service.thumbnailFor('Unknown species')).toBeNull();
    });

    it('returns the thumbnail_url for a known record', async () => {
      refetchSpy.mockResolvedValue([
        makeRecord('Monstera deliciosa', 'https://cdn.example/img.jpg'),
      ]);
      await service.loadFor([{ scientific_name: 'Monstera deliciosa' }]);
      expect(service.thumbnailFor('Monstera deliciosa')).toBe('https://cdn.example/img.jpg');
    });

    it('returns null when the record has a null thumbnail_url', async () => {
      refetchSpy.mockResolvedValue([makeRecord('Bare plant', null)]);
      await service.loadFor([{ scientific_name: 'Bare plant' }]);
      expect(service.thumbnailFor('Bare plant')).toBeNull();
    });
  });

  describe('loadFor()', () => {
    it('does not call the API when the plant list is empty', async () => {
      await service.loadFor([]);
      expect(refetchSpy).not.toHaveBeenCalled();
    });

    it('does not call the API when all names are already cached', async () => {
      refetchSpy.mockResolvedValue([makeRecord('Monstera deliciosa', 'https://cdn.example/a.jpg')]);
      await service.loadFor([{ scientific_name: 'Monstera deliciosa' }]);
      expect(refetchSpy).toHaveBeenCalledTimes(1);

      // Second call with the same name — should NOT fetch again
      await service.loadFor([{ scientific_name: 'Monstera deliciosa' }]);
      expect(refetchSpy).toHaveBeenCalledTimes(1);
    });

    it('deduplicates duplicate names before fetching', async () => {
      await service.loadFor([
        { scientific_name: 'Monstera deliciosa' },
        { scientific_name: 'Monstera deliciosa' },
      ]);
      expect(refetchSpy).toHaveBeenCalledWith(['Monstera deliciosa']);
    });

    it('ignores null scientific_name entries', async () => {
      await service.loadFor([{ scientific_name: null }, { scientific_name: null }]);
      expect(refetchSpy).not.toHaveBeenCalled();
    });

    it('only fetches names not yet in the cache', async () => {
      refetchSpy.mockResolvedValueOnce([makeRecord('Ficus lyrata', 'https://cdn.example/f.jpg')]);
      await service.loadFor([{ scientific_name: 'Ficus lyrata' }]);

      refetchSpy.mockResolvedValueOnce([makeRecord('Pothos aureum', 'https://cdn.example/p.jpg')]);
      await service.loadFor([
        { scientific_name: 'Ficus lyrata' },
        { scientific_name: 'Pothos aureum' },
      ]);

      // Second call should only fetch 'Pothos aureum', not 'Ficus lyrata'
      expect(refetchSpy).toHaveBeenNthCalledWith(2, ['Pothos aureum']);
    });

    it('stores fetched records in the map so thumbnailFor() resolves them', async () => {
      refetchSpy.mockResolvedValue([makeRecord('Dracaena marginata', 'https://cdn.example/d.jpg')]);
      await service.loadFor([{ scientific_name: 'Dracaena marginata' }]);
      expect(service.thumbnailFor('Dracaena marginata')).toBe('https://cdn.example/d.jpg');
    });
  });
});
