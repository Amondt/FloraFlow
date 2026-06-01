import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { SliderModule, SliderSlideEndEvent } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  CachedBotanicalRecord,
  CYCLE_OPTIONS,
  LibraryFilters,
  LibraryService,
  SUNLIGHT_LABEL,
  SUNLIGHT_OPTIONS,
  WATERING_LABEL,
  WATERING_OPTIONS,
} from './library.service';
import {
  FloraButtonPT,
  FloraDetailDialogPT,
  FloraInputTextPT,
  FloraSkeletonPT,
  FloraSliderPT,
  FloraToastPT,
} from '../../shared/ui/pt/index';
import { BotanicalRecordCardComponent } from './botanical-record-card/botanical-record-card';
import { PlantFormDialogComponent } from '../scheduler/plant-form-dialog/plant-form-dialog';
import { PlantService } from '../scheduler/plant.service';
import { PlantFormData } from '../scheduler/plant.model';
import { plantAddedDetail } from '../../shared/utils/plant-message.util';

const TOXICITY_OPTIONS = [
  { label: 'Pet-safe', value: false as boolean },
  { label: 'Toxic', value: true as boolean },
];

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    SkeletonModule,
    ButtonModule,
    DialogModule,
    SliderModule,
    ToastModule,
    PlantFormDialogComponent,
    BotanicalRecordCardComponent,
  ],
  providers: [MessageService],
  templateUrl: './library.html',
})
export class LibraryComponent {
  private readonly libraryService = inject(LibraryService);
  private readonly plantService = inject(PlantService);
  private readonly messageService = inject(MessageService);

  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraDetailDialogPT = FloraDetailDialogPT;
  protected readonly FloraSliderPT = FloraSliderPT;
  protected readonly FloraToastPT = FloraToastPT;

  protected readonly WATERING_OPTIONS = [...WATERING_OPTIONS];
  protected readonly SUNLIGHT_OPTIONS = [...SUNLIGHT_OPTIONS];
  protected readonly CYCLE_OPTIONS = [...CYCLE_OPTIONS];
  protected readonly SUNLIGHT_LABEL = SUNLIGHT_LABEL;
  protected readonly TOXICITY_OPTIONS = TOXICITY_OPTIONS;
  protected readonly loadingPlaceholders = [1, 2, 3, 4, 5, 6];

  readonly filters = signal<LibraryFilters>({});
  readonly searchQuery = signal('');
  readonly results = signal<CachedBotanicalRecord[]>([]);
  readonly isLoading = signal(false);
  readonly selectedRecord = signal<CachedBotanicalRecord | null>(null);
  readonly showAddDialog = signal(false);
  readonly phRange = signal<number[]>([0, 14]);
  readonly phDisplay = signal<number[]>([0, 14]);
  readonly prefillRecord = signal<{
    common_name: string;
    scientific_name: string | null;
    perenual_id: number | null;
  } | null>(null);

  readonly detailVisible = computed(() => this.selectedRecord() !== null);
  readonly selectedSunlightLabels = computed(() =>
    (this.selectedRecord()?.sunlight ?? []).map((s) => SUNLIGHT_LABEL[s] ?? s),
  );
  readonly selectedWateringLabel = computed(() => {
    const w = this.selectedRecord()?.watering;
    return w ? (WATERING_LABEL[w] ?? w) : null;
  });
  readonly hasActiveFilters = computed(() => Object.keys(this.filters()).length > 0);
  readonly hasSearchCriteria = computed(
    () => this.searchQuery().length >= 2 || this.hasActiveFilters(),
  );
  readonly hasPhFilter = computed(() => this.phRange()[0] !== 0 || this.phRange()[1] !== 14);
  readonly hasWateringFilter = computed(() => !!this.filters().watering);
  readonly hasSunlightFilter = computed(() => !!this.filters().sunlight);
  readonly hasToxicityFilter = computed(() => this.filters().is_toxic_to_pets !== undefined);
  readonly hasCycleFilter = computed(() => !!this.filters().cycle);
  readonly isInitialLoad = computed(() => this.isLoading() && this.results().length === 0);
  readonly isReloading = computed(() => this.isLoading() && this.results().length > 0);

  readonly headerVisible = signal(true);

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const searchArea = document.getElementById('library-search-area');
      if (!searchArea) return;
      const observer = new IntersectionObserver(
        ([entry]) => this.headerVisible.set(entry.isIntersecting),
        { threshold: 0 },
      );
      observer.observe(searchArea);
      this._destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      const q = this.searchQuery();
      const f = this.filters();
      const hasCriteria = q.length >= 2 || Object.keys(f).length > 0;

      if (this._debounceTimer !== null) {
        clearTimeout(this._debounceTimer);
      }

      if (!hasCriteria) {
        this.isLoading.set(false);
        this.results.set([]);
        return;
      }

      this.isLoading.set(true);

      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        void this._load(q, f);
      }, 300);
    });
  }

  protected filterBtnClass(active: boolean): string {
    const base =
      'w-full text-left px-3 py-1.5 text-sm font-display rounded-garden-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 border cursor-pointer';
    if (active)
      return `${base} bg-primary-50 text-primary-700 border-primary-200 font-medium dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700`;
    return `${base} text-neutral-600 dark:text-neutral-400 border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }

  protected isFilterActive(key: 'watering' | 'sunlight' | 'cycle', value: string): boolean {
    return this.filters()[key] === value;
  }

  protected toggleFilter(key: 'watering' | 'sunlight' | 'cycle', value: string): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (f[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  protected toggleToxFilter(value: boolean): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (f.is_toxic_to_pets === value) delete next.is_toxic_to_pets;
      else next.is_toxic_to_pets = value;
      return next;
    });
  }

  private _activeHandle: 0 | 1 | null = null;
  private _isCrossed = false;

  protected onPhSliderMouseDown(event: MouseEvent): void {
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
      this.phRange.set([rawA, rawB]);
      this.phDisplay.set([rawA, rawB]);
    } else {
      if (!this._isCrossed) this._isCrossed = true;
      // pushed = position of the grabbed handle, which the other handle catches up to
      const pushed = this._activeHandle === 0 ? rawA : rawB;
      this.phRange.set([pushed, pushed]);
      this.phDisplay.set([pushed, pushed]);
    }
  }

  protected onPhSlideEnd(event: SliderSlideEndEvent): void {
    this._activeHandle = null;
    this._isCrossed = false;
    if (!event.values) return;
    const rawVals = event.values as number[];
    const min = Math.min(...rawVals);
    const max = Math.max(...rawVals);
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (min === 0 && max === 14) {
        delete next.phMin;
        delete next.phMax;
      } else {
        next.phMin = min;
        next.phMax = max;
      }
      return next;
    });
  }

  protected clearPhFilter(): void {
    this.phRange.set([0, 14]);
    this.phDisplay.set([0, 14]);
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      delete next.phMin;
      delete next.phMax;
      return next;
    });
  }

  protected clearFilters(): void {
    this.filters.set({});
    this.phRange.set([0, 14]);
    this.phDisplay.set([0, 14]);
  }

  protected onDetailClose(visible: boolean): void {
    if (!visible) this.selectedRecord.set(null);
  }

  protected openAddDialog(record: CachedBotanicalRecord): void {
    this.prefillRecord.set({
      common_name: record.common_name,
      scientific_name: record.scientific_name,
      perenual_id: record.perenual_id,
    });
    this.selectedRecord.set(null);
    this.showAddDialog.set(true);
  }

  protected async onPlantSaved(data: PlantFormData): Promise<void> {
    const newPlant = await this.plantService.createPlant(data);
    if (this.plantService.error() || !newPlant) {
      this.messageService.add({
        severity: 'error',
        summary: 'Add failed',
        detail: this.plantService.error()!,
      });
    } else {
      this.showAddDialog.set(false);
      this.selectedRecord.set(null);
      this.prefillRecord.set(null);
      this.messageService.add({
        severity: 'success',
        summary: 'Plant added',
        detail: plantAddedDetail(data.common_name, newPlant.next_check_due_at),
      });
    }
  }

  private async _load(query: string, f: LibraryFilters): Promise<void> {
    this.isLoading.set(true);
    try {
      if (query.length >= 2) {
        this.results.set(await this.libraryService.search(query, f));
      } else {
        this.results.set(await this.libraryService.browse(f));
      }
    } finally {
      this.isLoading.set(false);
    }
  }
}
