import { describe, it, expect } from 'vitest';
import { buildGalleryPhotos } from './botanical-photo.util';
import type { CachedBotanicalRecord } from '../../features/library/library.service';

function makeRecord(overrides: Partial<CachedBotanicalRecord> = {}): CachedBotanicalRecord {
  return {
    air_purifying: null,
    cached_at: '2024-01-01T00:00:00Z',
    care_difficulty: null,
    check_depth_description: null,
    common_name: 'Test Plant',
    cycle: null,
    description: null,
    flowering_season: null,
    fruit_season: null,
    gallery_urls: null,
    growth_rate: null,
    human_toxicity_notes: null,
    ideal_humidity_max: null,
    ideal_humidity_min: null,
    ideal_max_ph: null,
    ideal_min_ph: null,
    inat_rank: null,
    inat_species_id: null,
    inat_taxon_id: null,
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
    regular_url: null,
    scientific_name: 'Test species',
    sunlight: null,
    thumbnail_fetched: false,
    thumbnail_url: null,
    toxicity_notes: null,
    watering: null,
    ...overrides,
  };
}

describe('buildGalleryPhotos', () => {
  it('returns an empty array for null', () => {
    expect(buildGalleryPhotos(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(buildGalleryPhotos(undefined)).toEqual([]);
  });

  it('returns an empty array when both regular_url and gallery_urls are null', () => {
    expect(buildGalleryPhotos(makeRecord())).toEqual([]);
  });

  it('returns regular_url alone when gallery_urls is null', () => {
    const result = buildGalleryPhotos(makeRecord({ regular_url: 'https://a.com/1.jpg' }));
    expect(result).toEqual(['https://a.com/1.jpg']);
  });

  it('returns gallery_urls entries when regular_url is null', () => {
    const result = buildGalleryPhotos(
      makeRecord({ gallery_urls: ['https://a.com/1.jpg', 'https://a.com/2.jpg'] }),
    );
    expect(result).toEqual(['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  });

  it('deduplicates when regular_url is already present in gallery_urls', () => {
    const result = buildGalleryPhotos(
      makeRecord({
        regular_url: 'https://a.com/1.jpg',
        gallery_urls: ['https://a.com/1.jpg', 'https://a.com/2.jpg'],
      }),
    );
    expect(result).toEqual(['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  });

  it('filters empty strings from gallery_urls', () => {
    const result = buildGalleryPhotos(
      makeRecord({ gallery_urls: ['https://a.com/1.jpg', '', 'https://a.com/2.jpg'] }),
    );
    expect(result).toEqual(['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  });

  it('puts regular_url first when it is not in gallery_urls', () => {
    const result = buildGalleryPhotos(
      makeRecord({
        regular_url: 'https://a.com/0.jpg',
        gallery_urls: ['https://a.com/1.jpg', 'https://a.com/2.jpg'],
      }),
    );
    expect(result[0]).toBe('https://a.com/0.jpg');
    expect(result).toHaveLength(3);
  });
});
