import {
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { SliderModule, SliderSlideEndEvent } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import {
  CARE_DIFFICULTY_OPTIONS,
  CachedBotanicalRecord,
  CYCLE_OPTIONS,
  LibraryFilters,
  LibraryService,
  MAINTENANCE_OPTIONS,
  PAGE_SIZE,
  PLACEMENT_OPTIONS,
  SUNLIGHT_LABEL,
  SUNLIGHT_OPTIONS,
  WATERING_OPTIONS,
} from './library.service';
import {
  SpeciesGroup,
  groupBotanicalRecords,
} from '../../shared/utils/group-botanical-records.util';
import {
  FloraButtonPT,
  FloraInputTextPT,
  FloraSkeletonPT,
  FloraSliderPT,
  FloraToastPT,
  FloraToggleSwitchPT,
} from '../../shared/ui/pt/index';
import { BotanicalRecordCardComponent } from './botanical-record-card/botanical-record-card';
import { BotanicalDetailDialogComponent } from '../../shared/components/botanical-detail-dialog/botanical-detail-dialog';
import { PlantFormDialogComponent } from '../tasks/plant-form-dialog/plant-form-dialog';
import { SubstrateMixWizardDialogComponent } from '../../shared/components/substrate-mix-wizard/substrate-mix-wizard-dialog';
import { PlantService } from '../tasks/plant.service';
import { PlantFormData } from '../tasks/plant.model';
import { plantAddedDetail } from '../../shared/utils/plant-message.util';
import { EnrichmentPoll } from '../../shared/utils/enrichment-poll';
import {
  PlantIdentifierDialogComponent,
  type PlantIdentifiedEvent,
} from '../../shared/components/plant-identifier/plant-identifier-dialog';

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    SkeletonModule,
    ButtonModule,
    SliderModule,
    ToastModule,
    ToggleSwitchModule,
    BotanicalDetailDialogComponent,
    BotanicalRecordCardComponent,
    PlantFormDialogComponent,
    PlantIdentifierDialogComponent,
    SubstrateMixWizardDialogComponent,
  ],
  providers: [MessageService],
  templateUrl: './library.html',
})
export class LibraryComponent {
  private readonly libraryService = inject(LibraryService);
  private readonly plantService = inject(PlantService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraSliderPT = FloraSliderPT;
  protected readonly FloraToastPT = FloraToastPT;
  protected readonly FloraToggleSwitchPT = FloraToggleSwitchPT;

  protected readonly WATERING_OPTIONS = [...WATERING_OPTIONS];
  protected readonly SUNLIGHT_OPTIONS = [...SUNLIGHT_OPTIONS];
  protected readonly CYCLE_OPTIONS = [...CYCLE_OPTIONS];
  protected readonly PLACEMENT_OPTIONS = [...PLACEMENT_OPTIONS];
  protected readonly CARE_DIFFICULTY_OPTIONS = [...CARE_DIFFICULTY_OPTIONS];
  protected readonly MAINTENANCE_OPTIONS = [...MAINTENANCE_OPTIONS];
  protected readonly SUNLIGHT_LABEL = SUNLIGHT_LABEL;
  protected readonly loadingPlaceholders = [1, 2, 3, 4, 5, 6];
  protected readonly lifecycleTooltip =
    'Annual: 1 season\nBiennial: 2 years\nPerennial: returns every year';

  readonly tooltipText = signal('');
  readonly tooltipPos = signal<{ x: number; y: number } | null>(null);

  readonly filters = signal<LibraryFilters>({});
  readonly searchQuery = signal('');
  readonly results = signal<CachedBotanicalRecord[]>([]);
  readonly isLoading = signal(false);
  readonly selectedGroupKey = signal<string[] | null>(null);
  readonly showAddDialog = signal(false);
  readonly phRange = signal<number[]>([0, 14]);
  readonly phDisplay = signal<number[]>([0, 14]);
  readonly currentPage = signal(0);
  readonly totalCount = signal(0);
  readonly prefillRecord = signal<{
    common_name: string;
    scientific_name: string | null;
    perenual_id: number | null;
  } | null>(null);
  readonly wizardVisible = signal(false);
  readonly wizardFromBotanicalRecord = signal<CachedBotanicalRecord | null>(null);
  readonly identifierVisible = signal(false);
  private readonly _pendingAutoOpenName = signal<string | null>(null);
  private _savedGroupKey: string[] | null = null;

  readonly groupedResults = computed(() => groupBotanicalRecords(this.results()));
  readonly selectedKeySet = computed(() => new Set(this.selectedGroupKey() ?? []));
  readonly dialogRecords = computed((): CachedBotanicalRecord[] => {
    const keys = this.selectedGroupKey();
    if (!keys) return [];
    const keySet = new Set(keys);
    // Use the group's sorted varieties (base species first) rather than filtering
    // from raw results(), which has no guaranteed ordering.
    const group = this.groupedResults().find((g) =>
      g.varieties.some((v) => keySet.has(v.scientific_name)),
    );
    return group?.varieties ?? [];
  });
  readonly detailVisible = computed(() => this.selectedGroupKey() !== null);
  readonly hasActiveFilters = computed(() => Object.keys(this.filters()).length > 0);
  readonly hasSearchCriteria = computed(
    () => this.searchQuery().length >= 2 || this.hasActiveFilters(),
  );
  readonly hasPhFilter = computed(() => this.phRange()[0] !== 0 || this.phRange()[1] !== 14);
  readonly hasWateringFilter = computed(() => !!this.filters().watering);
  readonly hasSunlightFilter = computed(() => !!this.filters().sunlight);
  readonly hasCycleFilter = computed(() => !!this.filters().cycle);
  readonly hasPlacementFilter = computed(() => this.filters().placement != null);
  readonly hasDifficultyFilter = computed(() => (this.filters().careDifficulty?.length ?? 0) > 0);
  readonly hasMaintenanceFilter = computed(
    () => (this.filters().maintenanceLevel?.length ?? 0) > 0,
  );
  readonly hasTraitFilters = computed(
    () =>
      this.filters().isTropical === true ||
      this.filters().airPurifying === true ||
      this.filters().isSafeForHumans === true ||
      this.filters().isPetSafe === true,
  );
  readonly isTropicalFilter = computed(() => this.filters().isTropical === true);
  readonly airPurifyingFilter = computed(() => this.filters().airPurifying === true);
  readonly isSafeForHumansFilter = computed(() => this.filters().isSafeForHumans === true);
  readonly isPetSafeFilter = computed(() => this.filters().isPetSafe === true);

  readonly pagedGroupedResults = computed(() => {
    const groups = this.groupedResults();
    const start = this.currentPage() * PAGE_SIZE;
    return groups.slice(start, start + PAGE_SIZE);
  });
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.groupedResults().length / PAGE_SIZE)),
  );
  readonly hasPrevPage = computed(() => this.currentPage() > 0);
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages() - 1);

  // Windowed page list with ellipsis gaps — always shows first, last, and
  // a 5-page window (±2) around the current page.
  readonly pageItems = computed((): Array<number | 'ellipsis'> => {
    const total = this.totalPages();
    const current = this.currentPage();
    const WINDOW = 2;

    const visible = new Set<number>([
      0,
      total - 1,
      ...Array.from({ length: WINDOW * 2 + 1 }, (_, i) =>
        Math.min(total - 1, Math.max(0, current - WINDOW + i)),
      ),
    ]);

    const sorted = [...visible].sort((a, b) => a - b);
    const result: Array<number | 'ellipsis'> = [];

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
      result.push(sorted[i]);
    }

    return result;
  });

  // Tracks whether the most recent query has received a response (success or error).
  // Starts false so skeletons appear as soon as criteria is met — no dependency on
  // isLoading() timing, which eliminates the signal-write race on first search.
  protected readonly searchCompleted = signal(false);

  // Shows skeleton loaders whenever a load is in flight with no results on screen yet.
  // Driven by isLoading() — set synchronously in _syncLoadingState() — rather than
  // !searchCompleted() which depends on the effect flush and can lag behind event handlers.
  readonly isInitialLoad = computed(
    () => this.hasSearchCriteria() && this.isLoading() && this.results().length === 0,
  );
  readonly hasNoResults = computed(
    () => this.hasSearchCriteria() && this.searchCompleted() && this.results().length === 0,
  );
  readonly isReloading = computed(() => this.isLoading() && this.results().length > 0);

  readonly headerVisible = signal(true);

  private readonly _poll = new EnrichmentPoll();
  readonly enrichingNames = this._poll.enrichingNames;
  readonly enrichingCount = this._poll.enrichingCount;

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    this._destroyRef.onDestroy(() => {
      if (this._debounceTimer !== null) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      this._poll.stop();
    });

    afterNextRender(() => {
      const updateHeaderVisible = () => {
        const el = document.getElementById('library-search-area');
        this.headerVisible.set(!el || el.getBoundingClientRect().bottom > 0);
      };
      updateHeaderVisible();
      window.addEventListener('scroll', updateHeaderVisible, { passive: true });
      this._destroyRef.onDestroy(() => window.removeEventListener('scroll', updateHeaderVisible));
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
        this.totalCount.set(0);
        this.currentPage.set(0);
        this.searchCompleted.set(false);
        this._poll.stop();
        return;
      }

      this.searchCompleted.set(false);
      this.isLoading.set(true);

      this._debounceTimer = setTimeout(() => {
        this._debounceTimer = null;
        this.currentPage.set(0);
        void this._load(q, f);
      }, 300);
    });

    effect(() => {
      const pendingName = this._pendingAutoOpenName();
      if (!pendingName || !this.searchCompleted()) return;

      const matchingGroup = this.groupedResults().find((g) =>
        g.varieties.some((v) => v.scientific_name?.toLowerCase() === pendingName.toLowerCase()),
      );
      this._pendingAutoOpenName.set(null);
      if (matchingGroup) this.openGroup(matchingGroup);
    });
  }

  protected showTooltip(event: MouseEvent, text: string): void {
    const el = event.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.tooltipText.set(text);
    this.tooltipPos.set({ x: rect.right + 8, y: rect.top + rect.height / 2 });
  }

  protected hideTooltip(): void {
    this.tooltipPos.set(null);
  }

  protected filterBtnClass(active: boolean): string {
    const base =
      'w-full text-left px-3 py-1.5 text-sm font-display rounded-garden-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 border cursor-pointer';
    if (active)
      return `${base} bg-primary-50 text-primary-700 border-primary-200 font-medium dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700`;
    return `${base} text-neutral-600 dark:text-neutral-400 border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }

  protected multiSelectBtnClass(active: boolean): string {
    const base =
      'w-full text-left px-3 py-1.5 text-sm font-display rounded-garden-sm transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 border cursor-pointer flex items-center gap-2';
    if (active)
      return `${base} bg-primary-50 text-primary-700 border-primary-200 font-medium dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-700`;
    return `${base} text-neutral-600 dark:text-neutral-400 border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  }

  protected checkboxIndicatorClass(active: boolean): string {
    if (active)
      return 'w-3.5 h-3.5 rounded-sm flex-shrink-0 bg-primary-500 border border-primary-500';
    return 'w-3.5 h-3.5 rounded-sm flex-shrink-0 border border-neutral-300 dark:border-neutral-600';
  }

  protected isFilterActive(key: 'watering' | 'sunlight' | 'cycle', value: string): boolean {
    return this.filters()[key] === value;
  }

  protected onSearchQueryChange(value: string): void {
    this.searchQuery.set(value);
    this._syncLoadingState();
  }

  protected toggleFilter(key: 'watering' | 'sunlight' | 'cycle', value: string): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (f[key] === value) delete next[key];
      else next[key] = value;
      return next;
    });
    this._syncLoadingState();
  }

  protected togglePlacementFilter(value: string): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (f.placement === value) delete next.placement;
      else next.placement = value;
      return next;
    });
    this._syncLoadingState();
  }

  protected toggleMultiFilter(key: 'careDifficulty' | 'maintenanceLevel', value: string): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      const current = next[key] ?? [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (updated.length === 0) delete next[key];
      else next[key] = updated;
      return next;
    });
    this._syncLoadingState();
  }

  protected isMultiFilterActive(
    key: 'careDifficulty' | 'maintenanceLevel',
    value: string,
  ): boolean {
    return this.filters()[key]?.includes(value) ?? false;
  }

  protected setTropicalFilter(v: boolean): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (!v) delete next.isTropical;
      else next.isTropical = true;
      return next;
    });
    this._syncLoadingState();
  }

  protected setAirPurifyingFilter(v: boolean): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (!v) delete next.airPurifying;
      else next.airPurifying = true;
      return next;
    });
    this._syncLoadingState();
  }

  protected setSafeForHumansFilter(v: boolean): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (!v) delete next.isSafeForHumans;
      else next.isSafeForHumans = true;
      return next;
    });
    this._syncLoadingState();
  }

  protected setPetSafeFilter(v: boolean): void {
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (!v) delete next.isPetSafe;
      else next.isPetSafe = true;
      return next;
    });
    this._syncLoadingState();
  }

  protected goToPage(page: number): void {
    this.selectedGroupKey.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.currentPage.set(page);
    // No re-fetch — all records are loaded at once; pagedGroupedResults() slices the window.
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
    this._syncLoadingState();
  }

  private _syncLoadingState(): void {
    if (this.searchQuery().length >= 2 || Object.keys(this.filters()).length > 0) {
      // Reset searchCompleted synchronously so isInitialLoad evaluates correctly before
      // the effect flush. Without this, a completed previous search leaves searchCompleted
      // true, which would hide the skeleton on the next load cycle.
      this.searchCompleted.set(false);
      this.isLoading.set(true);
    }
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
    if (!visible) this.selectedGroupKey.set(null);
  }

  protected async onLibraryIdentified(event: PlantIdentifiedEvent): Promise<void> {
    this.identifierVisible.set(false);

    const record = await this.libraryService.fetchByScientificName(event.scientific_name);

    if (record) {
      // Fast path: record is cached — open detail immediately without waiting for search
      this.results.set([record]);
      const group = this.groupedResults().find((g) =>
        g.varieties.some((v) => v.scientific_name === event.scientific_name),
      );
      if (group) this.openGroup(group);
      // Background: run the full search so the library populates behind the open dialog
      this.searchQuery.set(event.common_name);
      this._syncLoadingState();
    } else {
      // Slow path: record not in cache yet — search and auto-open when it lands
      this._pendingAutoOpenName.set(event.scientific_name);
      this.searchQuery.set(event.common_name);
      this._syncLoadingState();
    }
  }

  protected openWizardFromBotanical(record: CachedBotanicalRecord): void {
    this._savedGroupKey = this.selectedGroupKey();
    this.selectedGroupKey.set(null);
    this.wizardFromBotanicalRecord.set(record);
  }

  protected onBotanicalWizardClose(isVisible: boolean): void {
    if (!isVisible) {
      const savedKey = this._savedGroupKey;
      this._savedGroupKey = null;
      this.wizardFromBotanicalRecord.set(null);
      if (savedKey) this.selectedGroupKey.set(savedKey);
    }
  }

  protected openGroup(group: SpeciesGroup): void {
    this.selectedGroupKey.set(group.varieties.map((v) => v.scientific_name));
  }

  protected onSeedsRequested(rec: CachedBotanicalRecord): void {
    this.selectedGroupKey.set(null);
    void this.router.navigate(['/seeds'], {
      queryParams: {
        name: rec.common_name,
        scientific: rec.scientific_name ?? null,
      },
    });
  }

  protected openAddDialog(record: CachedBotanicalRecord): void {
    this.prefillRecord.set({
      common_name: record.common_name,
      scientific_name: record.scientific_name,
      perenual_id: record.perenual_id,
    });
    this.selectedGroupKey.set(null);
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
      this.selectedGroupKey.set(null);
      this.prefillRecord.set(null);
      this.messageService.add({
        severity: 'success',
        summary: 'Plant added',
        detail: plantAddedDetail(data.common_name, newPlant.next_check_due_at),
      });
    }
  }

  private async _load(query: string, f: LibraryFilters): Promise<void> {
    this._poll.stop();
    this.isLoading.set(true);
    try {
      // Fetch all matching records in one shot — grouping and client-side pagination
      // slice them via pagedGroupedResults(). 1000 covers any realistic botanical library.
      const result =
        query.length >= 2
          ? await this.libraryService.search(query, f, 0, 1000)
          : await this.libraryService.browse(f, 0, 1000);

      this.results.set(result.data);
      this.totalCount.set(result.count);

      // Include records missing AI enrichment, description, or an attempted thumbnail fetch
      const needsEnrichment = result.data.filter(
        (r) => !r.is_ai_enriched || r.description == null || !r.thumbnail_fetched,
      );
      this._poll.start(
        needsEnrichment.map((r) => r.scientific_name),
        async (pending) => {
          const refreshed = await this.libraryService.refetchByScientificNames(pending);
          if (refreshed.length === 0) return new Set(pending);
          const refreshedMap = new Map(refreshed.map((r) => [r.scientific_name, r]));
          this.results.update((current) =>
            current.map((r) => refreshedMap.get(r.scientific_name) ?? r),
          );
          return new Set(
            refreshed
              .filter((r) => !r.is_ai_enriched || r.description == null || !r.thumbnail_fetched)
              .map((r) => r.scientific_name),
          );
        },
      );
      void this.libraryService.triggerEnrichment(needsEnrichment, this._poll.controller?.signal);
    } finally {
      this.isLoading.set(false);
      this.searchCompleted.set(true);
    }
  }
}
