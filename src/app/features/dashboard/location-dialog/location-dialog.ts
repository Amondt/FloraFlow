import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { InputTextModule } from 'primeng/inputtext';
import {
  FloraButtonPT,
  FloraDialogPT,
  FloraInputTextPT,
  FloraMessagePT,
} from '../../../shared/ui/pt/index';
import { blurActiveElement } from '../../../shared/utils/dom';

export interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1: string | null;
  country: string;
}

@Component({
  selector: 'app-location-dialog',
  standalone: true,
  imports: [DialogModule, ButtonModule, MessageModule, InputTextModule],
  templateUrl: './location-dialog.html',
})
export class LocationDialogComponent {
  private readonly http = inject(HttpClient);
  private readonly _destroyRef = inject(DestroyRef);

  readonly visible = model<boolean>(false);
  readonly currentLat = input<number | null>(null);
  readonly currentLon = input<number | null>(null);
  readonly currentName = input<string | null>(null);

  readonly locationSaved = output<{ lat: number; lon: number; locationName: string }>();
  readonly locationCleared = output<void>();

  protected readonly FloraDialogPT = FloraDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraMessagePT = FloraMessagePT;

  protected readonly searchInputId = `flora-location-search-${crypto.randomUUID().slice(0, 8)}`;
  private readonly _searchInputRef = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly geoDetecting = signal(false);
  protected readonly geoError = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly suggestions = signal<GeoResult[]>([]);
  protected readonly searchLoading = signal(false);
  protected readonly selectedResult = signal<GeoResult | null>(null);
  protected readonly saving = signal(false);

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.suggestions.set([]);
        this.geoError.set(null);
        this.selectedResult.set(null);
        this.searchQuery.set('');
      }
    });

    this._destroyRef.onDestroy(() => {
      if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    });
  }

  onDialogShow(): void {
    this._searchInputRef()?.nativeElement.focus();
  }

  onVisibleChange(v: boolean): void {
    if (!v) blurActiveElement();
    this.visible.set(v);
  }

  detectLocation(): void {
    this.geoDetecting.set(true);
    this.geoError.set(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.onResultSelected({
          id: 0,
          name: 'Current location',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          admin1: null,
          country: '',
        });
        this.geoDetecting.set(false);
      },
      () => {
        this.geoError.set('Location access was denied — search for your city below');
        this.geoDetecting.set(false);
      },
      { timeout: 10000 },
    );
  }

  onSearchBlur(): void {
    // Delay so a suggestion button's (click) fires before we clear the list
    setTimeout(() => this.suggestions.set([]), 150);
  }

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    if (query.length < 2) {
      this.suggestions.set([]);
      return;
    }
    this._debounceTimer = setTimeout(() => void this.fetchSuggestions(query), 300);
  }

  async fetchSuggestions(query: string): Promise<void> {
    this.searchLoading.set(true);
    this.suggestions.set([]);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
      const response = await firstValueFrom(this.http.get<{ results?: GeoResult[] }>(url));
      this.suggestions.set(response?.results ?? []);
    } catch {
      this.suggestions.set([]);
    } finally {
      this.searchLoading.set(false);
    }
  }

  onResultSelected(result: GeoResult): void {
    this.selectedResult.set(result);
    this.suggestions.set([]);
    this.searchQuery.set('');
  }

  formatLabel(r: GeoResult): string {
    if (r.name === 'Current location') return 'Current location';
    return [r.name, r.admin1, r.country].filter(Boolean).join(', ');
  }

  onSave(): void {
    const result = this.selectedResult();
    if (!result) return;
    this.locationSaved.emit({
      lat: result.latitude,
      lon: result.longitude,
      locationName: this.formatLabel(result),
    });
    this.visible.set(false);
  }

  onClear(): void {
    this.locationCleared.emit();
    this.selectedResult.set(null);
    this.searchQuery.set('');
    this.suggestions.set([]);
    this.visible.set(false);
  }

  onCancel(): void {
    this.selectedResult.set(null);
    this.searchQuery.set('');
    this.suggestions.set([]);
    this.visible.set(false);
  }
}
