import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../core/services/locale.service';
import { BotanicalTranslationService } from '../../core/services/botanical-translation.service';
import {
  hasLocaleTranslation,
  localizeBotanical,
} from '../../shared/utils/localize-botanical.util';
import {
  CARE_DIFFICULTY_OPTIONS,
  CachedBotanicalRecord,
  CYCLE_OPTIONS,
  LibraryFilters,
  LibraryService,
  MAINTENANCE_OPTIONS,
  PAGE_SIZE,
  PLACEMENT_OPTIONS,
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
  FloraToastPT,
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
import { LibraryFiltersComponent, type FilterLabels } from './library-filters/library-filters';

const PLACEMENT_KEY: Record<string, string> = {
  Indoor: 'library.filter.placementIndoor',
  Outdoor: 'library.filter.placementOutdoor',
  Both: 'library.filter.placementBoth',
};
const WATERING_FILTER_KEY: Record<string, string> = {
  Frequent: 'library.filter.wateringFrequent',
  Average: 'library.filter.wateringAverage',
  Minimum: 'library.filter.wateringMinimum',
  None: 'library.filter.wateringNone',
};
const SUNLIGHT_FILTER_KEY: Record<string, string> = {
  full_sun: 'library.filter.sunlightFullSun',
  part_shade: 'library.filter.sunlightPartShade',
  full_shade: 'library.filter.sunlightShade',
  filtered_indirect: 'library.filter.sunlightIndirect',
};
const CYCLE_KEY: Record<string, string> = {
  Perennial: 'library.filter.cyclePerennial',
  Annual: 'library.filter.cycleAnnual',
  Biennial: 'library.filter.cycleBiennial',
};
const CARE_DIFFICULTY_KEY: Record<string, string> = {
  Beginner: 'library.filter.difficultyBeginner',
  Intermediate: 'library.filter.difficultyIntermediate',
  Advanced: 'library.filter.difficultyAdvanced',
};
const MAINTENANCE_KEY: Record<string, string> = {
  Low: 'library.filter.maintenanceLow',
  Medium: 'library.filter.maintenanceMedium',
  High: 'library.filter.maintenanceHigh',
};

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [
    FormsModule,
    InputTextModule,
    SkeletonModule,
    ButtonModule,
    ToastModule,
    TranslocoPipe,
    BotanicalDetailDialogComponent,
    BotanicalRecordCardComponent,
    PlantFormDialogComponent,
    PlantIdentifierDialogComponent,
    SubstrateMixWizardDialogComponent,
    LibraryFiltersComponent,
  ],
  providers: [MessageService],
  templateUrl: './library.html',
})
export class LibraryComponent {
  private readonly libraryService = inject(LibraryService);
  private readonly plantService = inject(PlantService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  private readonly botanicalTranslationService = inject(BotanicalTranslationService);

  protected readonly FloraInputTextPT = FloraInputTextPT;
  protected readonly FloraSkeletonPT = FloraSkeletonPT;
  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraToastPT = FloraToastPT;

  protected readonly loadingPlaceholders = [1, 2, 3, 4, 5, 6];

  readonly filterLabels = computed((): FilterLabels => {
    const _lang = this.localeService.locale();
    const t = this.t;
    return {
      placement: Object.fromEntries(
        PLACEMENT_OPTIONS.map((o) => [o, t.translate(PLACEMENT_KEY[o])]),
      ),
      watering: Object.fromEntries(
        WATERING_OPTIONS.map((o) => [o, t.translate(WATERING_FILTER_KEY[o])]),
      ),
      sunlight: Object.fromEntries(
        SUNLIGHT_OPTIONS.map((o) => [o, t.translate(SUNLIGHT_FILTER_KEY[o])]),
      ),
      cycle: Object.fromEntries(CYCLE_OPTIONS.map((o) => [o, t.translate(CYCLE_KEY[o])])),
      careDifficulty: Object.fromEntries(
        CARE_DIFFICULTY_OPTIONS.map((o) => [o, t.translate(CARE_DIFFICULTY_KEY[o])]),
      ),
      maintenance: Object.fromEntries(
        MAINTENANCE_OPTIONS.map((o) => [o, t.translate(MAINTENANCE_KEY[o])]),
      ),
    };
  });

  readonly tooltipText = signal('');
  readonly tooltipPos = signal<{ x: number; y: number } | null>(null);

  readonly filters = signal<LibraryFilters>({});
  readonly searchQuery = signal('');
  readonly results = signal<CachedBotanicalRecord[]>([]);
  readonly isLoading = signal(false);
  readonly selectedGroupKey = signal<string[] | null>(null);
  readonly showAddDialog = signal(false);
  readonly phRange = signal<number[]>([0, 14]);
  readonly currentPage = signal(0);
  readonly totalCount = signal(0);
  readonly prefillRecord = signal<{
    common_name: string;
    scientific_name: string | null;
    inat_taxon_id: number | null;
  } | null>(null);
  readonly wizardVisible = signal(false);
  readonly wizardFromBotanicalRecord = signal<CachedBotanicalRecord | null>(null);
  readonly identifierVisible = signal(false);
  readonly isFilterSheetOpen = signal(false);
  private readonly _pendingAutoOpenName = signal<string | null>(null);
  private _savedGroupKey: string[] | null = null;
  private _filterSheetEverOpened = false;

  private readonly _filterSheetRef = viewChild<ElementRef>('filterSheet');
  private readonly _filterPillRef = viewChild<ElementRef>('filterPill');

  readonly groupedResults = computed(() => groupBotanicalRecords(this.localizedResults()));
  readonly selectedKeySet = computed(() => new Set(this.selectedGroupKey() ?? []));
  readonly dialogRecords = computed((): CachedBotanicalRecord[] => {
    const keys = this.selectedGroupKey();
    if (!keys) return [];
    const keySet = new Set(keys);
    const group = this.groupedResults().find((g) =>
      g.varieties.some((v) => keySet.has(v.scientific_name)),
    );
    return group?.varieties ?? [];
  });

  readonly dialogIsEnriching = computed(() =>
    this.dialogRecords().some((r) => this.enrichingNames().has(r.scientific_name)),
  );
  readonly dialogIsTranslating = computed(() =>
    this.dialogRecords().some((r) => this.translatingNames().has(r.scientific_name)),
  );
  readonly detailVisible = computed(() => this.selectedGroupKey() !== null);
  readonly hasActiveFilters = computed(() => Object.keys(this.filters()).length > 0);
  readonly hasSearchCriteria = computed(
    () => this.searchQuery().length >= 2 || this.hasActiveFilters(),
  );

  readonly activeFilterCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.placement != null) count++;
    if (f.sunlight != null) count++;
    if (f.watering != null) count++;
    if (f.isTropical) count++;
    if (f.airPurifying) count++;
    if (f.isSafeForHumans) count++;
    if (f.isPetSafe) count++;
    count += f.careDifficulty?.length ?? 0;
    count += f.maintenanceLevel?.length ?? 0;
    if (f.cycle != null) count++;
    if (this.phRange()[0] !== 0 || this.phRange()[1] !== 14) count++;
    return count;
  });

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

  protected readonly searchCompleted = signal(false);

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

  private readonly _translationPoll = new EnrichmentPoll();
  readonly translatingNames = this._translationPoll.enrichingNames;

  readonly localizedResults = computed(() => {
    const locale = this.localeService.locale();
    return this.results().map((r) => localizeBotanical(r, locale));
  });

  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _destroyRef = inject(DestroyRef);

  constructor() {
    this._destroyRef.onDestroy(() => {
      if (this._debounceTimer !== null) {
        clearTimeout(this._debounceTimer);
        this._debounceTimer = null;
      }
      this._poll.stop();
      this._translationPoll.stop();
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

    // Focus management: move into sheet on open, restore to pill on close
    effect(() => {
      const isOpen = this.isFilterSheetOpen();
      if (isOpen) {
        this._filterSheetEverOpened = true;
        setTimeout(() => {
          const sheet = this._filterSheetRef()?.nativeElement as HTMLElement | undefined;
          const firstFocusable = sheet?.querySelector<HTMLElement>(
            'button:not([disabled]), input:not([disabled])',
          );
          firstFocusable?.focus();
        });
      } else if (this._filterSheetEverOpened) {
        setTimeout(() => {
          (this._filterPillRef()?.nativeElement as HTMLElement | undefined)?.focus();
        });
      }
    });
  }

  protected onSearchQueryChange(value: string): void {
    this.searchQuery.set(value);
    this._syncLoadingState();
  }

  protected onFilterTooltipShow(pos: { x: number; y: number; text: string }): void {
    this.tooltipText.set(pos.text);
    this.tooltipPos.set({ x: pos.x, y: pos.y });
  }

  protected hideTooltip(): void {
    this.tooltipPos.set(null);
  }

  protected onFiltersChange(newFilters: LibraryFilters): void {
    this.filters.set(newFilters);
    this._syncLoadingState();
  }

  protected onPhSlideEndFromFilters(event: { min: number; max: number }): void {
    this.phRange.set([event.min, event.max]);
    this.filters.update((f) => {
      const next: LibraryFilters = { ...f };
      if (event.min === 0 && event.max === 14) {
        delete next.phMin;
        delete next.phMax;
      } else {
        next.phMin = event.min;
        next.phMax = event.max;
      }
      return next;
    });
    this._syncLoadingState();
  }

  protected goToPage(page: number): void {
    this.selectedGroupKey.set(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this._poll.stop();
    this._translationPoll.stop();
    this.currentPage.set(page);
    this._enrichCurrentPage();
    this._translateCurrentPage();
  }

  private _syncLoadingState(): void {
    if (this.searchQuery().length >= 2 || Object.keys(this.filters()).length > 0) {
      this.searchCompleted.set(false);
      this.isLoading.set(true);
    }
  }

  protected clearPhFilter(): void {
    this.phRange.set([0, 14]);
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
  }

  protected onDetailClose(visible: boolean): void {
    if (!visible) this.selectedGroupKey.set(null);
  }

  protected async onLibraryIdentified(event: PlantIdentifiedEvent): Promise<void> {
    this.identifierVisible.set(false);

    const record = await this.libraryService.fetchByScientificName(event.scientific_name);

    if (record) {
      this.results.set([record]);
      const group = this.groupedResults().find((g) =>
        g.varieties.some((v) => v.scientific_name === event.scientific_name),
      );
      if (group) this.openGroup(group);
      this.searchQuery.set(event.common_name);
      this._syncLoadingState();
    } else {
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
    this._translateDialogRecords();
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
      inat_taxon_id: record.inat_taxon_id,
    });
    this.selectedGroupKey.set(null);
    this.showAddDialog.set(true);
  }

  protected async onPlantSaved(data: PlantFormData): Promise<void> {
    const newPlant = await this.plantService.createPlant(data);
    if (this.plantService.error() || !newPlant) {
      this.messageService.add({
        severity: 'error',
        summary: this.t.translate('library.toast.addFailed'),
        detail: this.plantService.error()!,
      });
    } else {
      this.showAddDialog.set(false);
      this.selectedGroupKey.set(null);
      this.prefillRecord.set(null);
      const { key: dKey, params: dParams } = plantAddedDetail(
        data.common_name,
        newPlant.next_check_due_at,
      );
      this.messageService.add({
        severity: 'success',
        summary: this.t.translate('library.toast.plantAdded'),
        detail: this.t.translate(dKey, dParams),
      });
    }
  }

  private _startTranslationPoll(names: string[], locale: string): void {
    this._translationPoll.start(names, async (pending) => {
      const refreshed = await this.libraryService.refetchByScientificNames(pending);
      if (refreshed.length === 0) return new Set(pending);
      const refreshedMap = new Map(refreshed.map((r) => [r.scientific_name, r]));
      this.results.update((current) =>
        current.map((r) => refreshedMap.get(r.scientific_name) ?? r),
      );
      return new Set(
        refreshed.filter((r) => !hasLocaleTranslation(r, locale)).map((r) => r.scientific_name),
      );
    });
  }

  private _triggerTranslation(records: CachedBotanicalRecord[]): void {
    const locale = this.localeService.locale();
    if (locale === 'en') return;
    const untranslated = records.filter((r) => !hasLocaleTranslation(r, locale));
    if (untranslated.length === 0) return;
    this._startTranslationPoll(
      untranslated.map((r) => r.scientific_name),
      locale,
    );
    void this.botanicalTranslationService.triggerBotanicalTranslation(
      untranslated,
      locale,
      this._translationPoll.controller?.signal,
    );
  }

  private _translateCurrentPage(): void {
    this._triggerTranslation(this.pagedGroupedResults().flatMap((g) => g.varieties));
  }

  private _translateDialogRecords(): void {
    this._triggerTranslation(this.dialogRecords());
  }

  private _enrichCurrentPage(): void {
    const pageRecords = this.pagedGroupedResults().flatMap((g) => g.varieties);
    const needsGallery = (r: (typeof pageRecords)[0]) =>
      r.gallery_urls == null && r.inat_taxon_id != null && r.inat_taxon_id > 0;
    const needsEnrichment = pageRecords.filter(
      (r) => !r.is_ai_enriched || r.description == null || !r.thumbnail_fetched || needsGallery(r),
    );
    if (needsEnrichment.length === 0) return;
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
            .filter(
              (r) =>
                !r.is_ai_enriched ||
                r.description == null ||
                !r.thumbnail_fetched ||
                needsGallery(r),
            )
            .map((r) => r.scientific_name),
        );
      },
    );
    void this.libraryService.triggerEnrichment(needsEnrichment, this._poll.controller?.signal);
  }

  private async _load(query: string, f: LibraryFilters): Promise<void> {
    this._poll.stop();
    this._translationPoll.stop();
    this.isLoading.set(true);
    try {
      const result =
        query.length >= 2
          ? await this.libraryService.search(query, f, 0, 1000)
          : await this.libraryService.browse(f, 0, 1000);

      this.results.set(result.data);
      this.totalCount.set(result.count);
      this._enrichCurrentPage();
      this._translateCurrentPage();
    } finally {
      this.isLoading.set(false);
      this.searchCompleted.set(true);
    }
  }
}
