import { Injectable, computed, inject, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';

export interface WeatherData {
  temperature_celsius: number;
  relative_humidity_percent: number;
  precipitation_probability_percent: number | null;
}

type WeatherProxySuccess = WeatherData & {
  latitude: number;
  longitude: number;
  fetched_at: string;
};
type WeatherProxyResult = WeatherProxySuccess | { weather: null };

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly supabase = inject(SupabaseService);

  readonly FROST_THRESHOLD_CELSIUS = 4;

  readonly weather = signal<WeatherData | null>(null);
  readonly weatherLoading = signal(false);
  readonly weatherError = signal<string | null>(null);

  readonly hasFrostRisk = computed(
    () => (this.weather()?.temperature_celsius ?? Infinity) <= this.FROST_THRESHOLD_CELSIUS,
  );

  async loadWeather(lat: number, lon: number): Promise<void> {
    this.weatherLoading.set(true);
    this.weatherError.set(null);

    try {
      const token = await this.supabase.getAuthToken();
      const url = `${environment.supabaseUrl}/functions/v1/weather-proxy?lat=${lat}&lon=${lon}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });

      if (!response.ok && response.status !== 503) {
        throw new Error(`Weather proxy responded ${response.status}`);
      }

      const result = (await response.json()) as WeatherProxyResult;

      if ('weather' in result) {
        this.weatherError.set('Could not load weather data — frost alerts may be unavailable.');
        return;
      }

      this.weather.set({
        temperature_celsius: result.temperature_celsius,
        relative_humidity_percent: result.relative_humidity_percent,
        precipitation_probability_percent: result.precipitation_probability_percent,
      });
    } catch {
      this.weatherError.set('Could not load weather data — frost alerts may be unavailable.');
    } finally {
      this.weatherLoading.set(false);
    }
  }
}
