import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WeatherService } from './weather.service';
import { SupabaseService } from './supabase.service';

const mockSupabase = {
  getAuthToken: vi.fn().mockResolvedValue('test-token'),
};

function makeWeatherPayload(minTemp: number | null, maxTemp: number | null = null) {
  return {
    temperature_celsius: 10,
    relative_humidity_percent: 80,
    precipitation_probability_percent: null,
    min_temp_next_24h: minTemp,
    max_temp_next_24h: maxTemp,
    latitude: 50.85,
    longitude: 4.35,
    fetched_at: new Date().toISOString(),
  };
}

describe('WeatherService', () => {
  let service: WeatherService;

  beforeEach(async () => {
    vi.spyOn(globalThis, 'fetch');

    await TestBed.configureTestingModule({
      providers: [WeatherService, { provide: SupabaseService, useValue: mockSupabase }],
    }).compileComponents();

    service = TestBed.inject(WeatherService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    service.weather.set(null);
  });

  // ── hasFrostRisk ───────────────────────────────────────────────────────────

  describe('hasFrostRisk', () => {
    it('returns false when weather is null', () => {
      service.weather.set(null);
      expect(service.hasFrostRisk()).toBe(false);
    });

    it('returns true when min_temp_next_24h is exactly at threshold (4°C)', () => {
      service.weather.set({
        temperature_celsius: 10,
        relative_humidity_percent: 80,
        precipitation_probability_percent: null,
        min_temp_next_24h: 4,
        max_temp_next_24h: null,
      });
      expect(service.hasFrostRisk()).toBe(true);
    });

    it('returns true when min_temp_next_24h is below threshold', () => {
      service.weather.set({
        temperature_celsius: 8,
        relative_humidity_percent: 90,
        precipitation_probability_percent: null,
        min_temp_next_24h: -2,
        max_temp_next_24h: null,
      });
      expect(service.hasFrostRisk()).toBe(true);
    });

    it('returns false when min_temp_next_24h is above threshold', () => {
      service.weather.set({
        temperature_celsius: 20,
        relative_humidity_percent: 60,
        precipitation_probability_percent: null,
        min_temp_next_24h: 12,
        max_temp_next_24h: null,
      });
      expect(service.hasFrostRisk()).toBe(false);
    });

    it('returns false when min_temp_next_24h is null (stale cache row — unknown forecast)', () => {
      service.weather.set({
        temperature_celsius: 3,
        relative_humidity_percent: 95,
        precipitation_probability_percent: null,
        min_temp_next_24h: null,
        max_temp_next_24h: null,
      });
      expect(service.hasFrostRisk()).toBe(false);
    });
  });

  // ── hasHeatRisk ───────────────────────────────────────────────────────────

  describe('hasHeatRisk', () => {
    it('returns false when weather is null', () => {
      service.weather.set(null);
      expect(service.hasHeatRisk()).toBe(false);
    });

    it('returns true when max_temp_next_24h is exactly at threshold (30°C)', () => {
      service.weather.set({
        temperature_celsius: 25,
        relative_humidity_percent: 40,
        precipitation_probability_percent: null,
        min_temp_next_24h: 18,
        max_temp_next_24h: 30,
      });
      expect(service.hasHeatRisk()).toBe(true);
    });

    it('returns true when max_temp_next_24h is above threshold', () => {
      service.weather.set({
        temperature_celsius: 28,
        relative_humidity_percent: 35,
        precipitation_probability_percent: null,
        min_temp_next_24h: 20,
        max_temp_next_24h: 36,
      });
      expect(service.hasHeatRisk()).toBe(true);
    });

    it('returns false when max_temp_next_24h is below threshold', () => {
      service.weather.set({
        temperature_celsius: 18,
        relative_humidity_percent: 60,
        precipitation_probability_percent: null,
        min_temp_next_24h: 10,
        max_temp_next_24h: 22,
      });
      expect(service.hasHeatRisk()).toBe(false);
    });

    it('returns false when max_temp_next_24h is null', () => {
      service.weather.set({
        temperature_celsius: 20,
        relative_humidity_percent: 55,
        precipitation_probability_percent: null,
        min_temp_next_24h: 12,
        max_temp_next_24h: null,
      });
      expect(service.hasHeatRisk()).toBe(false);
    });
  });

  // ── loadWeather ────────────────────────────────────────────────────────────

  describe('loadWeather()', () => {
    it('sets weatherLoading to true while the request is in flight', async () => {
      let resolveJson!: (v: unknown) => void;
      const jsonPromise = new Promise((r) => (resolveJson = r));

      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => jsonPromise,
      } as Response);

      const loadPromise = service.loadWeather(50.85, 4.35);
      expect(service.weatherLoading()).toBe(true);

      resolveJson(makeWeatherPayload(3));
      await loadPromise;
      expect(service.weatherLoading()).toBe(false);
    });

    it('populates the weather signal on a successful response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => makeWeatherPayload(3),
      } as Response);

      await service.loadWeather(50.85, 4.35);

      expect(service.weather()?.min_temp_next_24h).toBe(3);
      expect(service.weather()?.temperature_celsius).toBe(10);
      expect(service.weatherError()).toBeNull();
    });

    it('sets weatherError and leaves weather null on network failure', async () => {
      vi.mocked(globalThis.fetch).mockRejectedValue(new Error('network down'));

      await service.loadWeather(50.85, 4.35);

      expect(service.weather()).toBeNull();
      expect(service.weatherError()).toBe(
        'Could not load weather data — frost alerts may be unavailable.',
      );
      expect(service.weatherLoading()).toBe(false);
    });

    it('sets weatherError when the proxy returns a 503 degraded response', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ weather: null }),
      } as Response);

      await service.loadWeather(50.85, 4.35);

      expect(service.weatherError()).toBe(
        'Could not load weather data — frost alerts may be unavailable.',
      );
    });
  });
});
