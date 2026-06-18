import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SliderModule, SliderSlideEndEvent } from 'primeng/slider';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CARE_DIFFICULTY_OPTIONS,
  CYCLE_OPTIONS,
  LibraryFilters,
  MAINTENANCE_OPTIONS,
  PLACEMENT_OPTIONS,
  SUNLIGHT_OPTIONS,
  WATERING_OPTIONS,
} from '../library.service';
import { FloraSliderPT, FloraToggleSwitchPT } from '../../../shared/ui/pt/index';

export type FilterLabels = {
  placement: Record<string, string>;
  watering: Record<string, string>;
  sunlight: Record<string, string>;
  cycle: Record<string, string>;
  careDifficulty: Record<string, string>;
  maintenance: Record<string, string>;
};

@Component({
  selector: 'app-library-filters',
  standalone: true,
  imports: [FormsModule, SliderModule, ToggleSwitchModule, TranslocoPipe],
  templateUrl: './library-filters.html',
})
export class LibraryFiltersComponent {
  readonly filters = input.required<LibraryFilters>();
  readonly filterLabels = input.required<FilterLabels>();
  readonly phRange = input.required<number[]>();

  readonly filterChange = output<LibraryFilters>();
  readonly phSlideEnd = output<{ min: number; max: number }>();
  readonly clearPh = output<void>();
  readonly tooltipShow = output<{ x: number; y: number; text: string }>();
  readonly tooltipHide = output<void>();

  protected readonly PLACEMENT_OPTIONS = [...PLACEMENT_OPTIONS];
  protected readonly SUNLIGHT_OPTIONS = [...SUNLIGHT_OPTIONS];
  protected readonly WATERING_OPTIONS = [...WATERING_OPTIONS];
  protected readonly CARE_DIFFICULTY_OPTIONS = [...CARE_DIFFICULTY_OPTIONS];
  protected readonly MAINTENANCE_OPTIONS = [...MAINTENANCE_OPTIONS];
  protected readonly CYCLE_OPTIONS = [...CYCLE_OPTIONS];
  protected readonly FloraSliderPT = FloraSliderPT;
  protected readonly FloraToggleSwitchPT = FloraToggleSwitchPT;

  protected readonly localPhRange = signal<number[]>([0, 14]);
  protected readonly localPhDisplay = signal<number[]>([0, 14]);

  protected readonly hasPhFilter = computed(
    () => this.localPhRange()[0] !== 0 || this.localPhRange()[1] !== 14,
  );
  protected readonly hasPlacementFilter = computed(() => this.filters().placement != null);
  protected readonly hasSunlightFilter = computed(() => !!this.filters().sunlight);
  protected readonly hasWateringFilter = computed(() => !!this.filters().watering);
  protected readonly hasCycleFilter = computed(() => !!this.filters().cycle);
  protected readonly hasDifficultyFilter = computed(
    () => (this.filters().careDifficulty?.length ?? 0) > 0,
  );
  protected readonly hasMaintenanceFilter = computed(
    () => (this.filters().maintenanceLevel?.length ?? 0) > 0,
  );
  protected readonly hasTraitFilters = computed(
    () =>
      this.filters().isTropical === true ||
      this.filters().airPurifying === true ||
      this.filters().isSafeForHumans === true ||
      this.filters().isPetSafe === true,
  );
  protected readonly isTropicalFilter = computed(() => this.filters().isTropical === true);
  protected readonly airPurifyingFilter = computed(() => this.filters().airPurifying === true);
  protected readonly isSafeForHumansFilter = computed(
    () => this.filters().isSafeForHumans === true,
  );
  protected readonly isPetSafeFilter = computed(() => this.filters().isPetSafe === true);

  private _activeHandle: 0 | 1 | null = null;
  private _isCrossed = false;
  private readonly _elRef = inject(ElementRef);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly openTooltipId = signal<string | null>(null);

  constructor() {
    // Sync local pH slider state when parent resets phRange (e.g. clearFilters)
    effect(() => {
      const [min, max] = this.phRange();
      this.localPhRange.set([min, max]);
      this.localPhDisplay.set([min, max]);
    });

    // Close pinned tooltip when clicking outside the filter panel
    afterNextRender(() => {
      const handler = (e: MouseEvent) => {
        if (
          this.openTooltipId() !== null &&
          !this._elRef.nativeElement.contains(e.target as Node)
        ) {
          this.openTooltipId.set(null);
          this.tooltipHide.emit();
        }
      };
      document.addEventListener('click', handler);
      this._destroyRef.onDestroy(() => document.removeEventListener('click', handler));
    });
  }

  protected isFilterActive(key: 'watering' | 'sunlight' | 'cycle', value: string): boolean {
    return this.filters()[key] === value;
  }

  protected isMultiFilterActive(
    key: 'careDifficulty' | 'maintenanceLevel',
    value: string,
  ): boolean {
    return this.filters()[key]?.includes(value) ?? false;
  }

  protected onTogglePlacementFilter(value: string): void {
    const f = this.filters();
    const next: LibraryFilters = { ...f };
    if (f.placement === value) delete next.placement;
    else next.placement = value;
    this.filterChange.emit(next);
  }

  protected onToggleFilter(key: 'watering' | 'sunlight' | 'cycle', value: string): void {
    const f = this.filters();
    const next: LibraryFilters = { ...f };
    if (f[key] === value) delete (next as Record<string, unknown>)[key];
    else (next as Record<string, unknown>)[key] = value;
    this.filterChange.emit(next);
  }

  protected onToggleMultiFilter(key: 'careDifficulty' | 'maintenanceLevel', value: string): void {
    const f = this.filters();
    const next: LibraryFilters = { ...f };
    const current = next[key] ?? [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    if (updated.length === 0) delete next[key];
    else next[key] = updated;
    this.filterChange.emit(next);
  }

  protected onToggleTropical(v: boolean): void {
    const next: LibraryFilters = { ...this.filters() };
    if (!v) delete next.isTropical;
    else next.isTropical = true;
    this.filterChange.emit(next);
  }

  protected onToggleAirPurifying(v: boolean): void {
    const next: LibraryFilters = { ...this.filters() };
    if (!v) delete next.airPurifying;
    else next.airPurifying = true;
    this.filterChange.emit(next);
  }

  protected onToggleSafeForHumans(v: boolean): void {
    const next: LibraryFilters = { ...this.filters() };
    if (!v) delete next.isSafeForHumans;
    else next.isSafeForHumans = true;
    this.filterChange.emit(next);
  }

  protected onTogglePetSafe(v: boolean): void {
    const next: LibraryFilters = { ...this.filters() };
    if (!v) delete next.isPetSafe;
    else next.isPetSafe = true;
    this.filterChange.emit(next);
  }

  protected onPhSliderPointerDown(event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('[data-pc-section="startHandler"]')) {
      this._activeHandle = 0;
      this._isCrossed = false;
    } else if (target.closest('[data-pc-section="endHandler"]')) {
      this._activeHandle = 1;
      this._isCrossed = false;
    }
  }

  protected onPhChange(event: { values?: number[] }): void {
    if (!event.values) return;
    const [rawA, rawB] = event.values as [number, number];
    if (rawA <= rawB) {
      this._isCrossed = false;
      this.localPhRange.set([rawA, rawB]);
      this.localPhDisplay.set([rawA, rawB]);
    } else {
      if (!this._isCrossed) this._isCrossed = true;
      const pushed = this._activeHandle === 0 ? rawA : rawB;
      this.localPhRange.set([pushed, pushed]);
      this.localPhDisplay.set([pushed, pushed]);
    }
  }

  protected onPhSlideEnd(event: SliderSlideEndEvent): void {
    this._activeHandle = null;
    this._isCrossed = false;
    if (!event.values) return;
    const rawVals = event.values as number[];
    const min = Math.min(...rawVals);
    const max = Math.max(...rawVals);
    this.phSlideEnd.emit({ min, max });
  }

  protected onClearPh(): void {
    this.clearPh.emit();
  }

  protected onMouseEnterTooltip(event: MouseEvent, text: string): void {
    this._emitTooltipShow(event.currentTarget as HTMLElement, text);
  }

  protected onMouseLeaveTooltip(): void {
    if (this.openTooltipId() === null) {
      this.tooltipHide.emit();
    }
  }

  protected onToggleTooltip(event: Event, id: string, text: string): void {
    event.stopPropagation();
    if (this.openTooltipId() === id) {
      this.openTooltipId.set(null);
      this.tooltipHide.emit();
    } else {
      this.openTooltipId.set(id);
      this._emitTooltipShow(event.currentTarget as HTMLElement, text);
    }
  }

  protected onEscapeTooltip(): void {
    if (this.openTooltipId() !== null) {
      this.openTooltipId.set(null);
      this.tooltipHide.emit();
    }
  }

  private _emitTooltipShow(el: HTMLElement, text: string): void {
    const rect = el.getBoundingClientRect();
    this.tooltipShow.emit({ x: rect.right + 8, y: rect.top + rect.height / 2, text });
  }

  protected filterBtnClass(active: boolean): string {
    const base =
      'w-full text-left px-3 py-1.5 text-sm font-display rounded-garden-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 border cursor-pointer';
    return active
      ? `${base} bg-primary-50 text-primary-700 border-primary-200 font-medium dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700`
      : `${base} text-neutral-600 dark:text-neutral-400 border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }

  protected multiSelectBtnClass(active: boolean): string {
    const base =
      'w-full text-left px-3 py-1.5 text-sm font-display rounded-garden-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 border cursor-pointer flex items-center gap-2';
    return active
      ? `${base} bg-primary-50 text-primary-700 border-primary-200 font-medium dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700`
      : `${base} text-neutral-600 dark:text-neutral-400 border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }

  protected checkboxIndicatorClass(active: boolean): string {
    return active
      ? 'w-3.5 h-3.5 rounded-sm flex-shrink-0 bg-primary-500 border border-primary-500'
      : 'w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-neutral-300 dark:border-neutral-600';
  }
}
