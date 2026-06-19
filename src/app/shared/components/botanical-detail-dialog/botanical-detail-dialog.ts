import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../../core/services/locale.service';
import { CachedBotanicalRecord } from '../../../features/library/library.service';
import {
  CARE_DIFFICULTY_KEY,
  MAINTENANCE_LEVEL_KEY,
  getSoilTypeLabels,
  getSunlightLabels,
  getWateringLabel,
} from '../../utils/botanical-label.util';
import { FloraButtonPT, FloraDetailDialogPT } from '../../ui/pt/index';
import { SpeciesPhotoCarouselComponent } from '../species-photo-carousel/species-photo-carousel';
import { PhotoLightboxDialogComponent } from '../photo-lightbox-dialog/photo-lightbox-dialog';
import { tabClass } from '../../utils/tab-styles.util';
import { buildGalleryPhotos } from '../../utils/botanical-photo.util';

type DialogTab = 'overview' | 'care' | 'growth' | 'safety';

const DIALOG_TABS: { id: DialogTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'botanical.dialog.tabs.overview', icon: 'pi pi-compass' },
  { id: 'care', label: 'botanical.dialog.tabs.care', icon: 'pi pi-heart' },
  { id: 'growth', label: 'botanical.dialog.tabs.growth', icon: 'pi pi-chart-line' },
  { id: 'safety', label: 'botanical.dialog.tabs.safety', icon: 'pi pi-shield' },
];

function inatRankLabel(rank: string | null): string | null {
  switch (rank) {
    case 'subspecies':
      return 'botanical.dialog.ranks.subspecies';
    case 'variety':
      return 'botanical.dialog.ranks.variety';
    case 'form':
      return 'botanical.dialog.ranks.form';
    case 'hybrid':
    case 'genushybrid':
      return 'botanical.dialog.ranks.hybrid';
    default:
      return null;
  }
}

function extractCultivarLabel(scientificName: string): string {
  // Perenual-style cultivar in apostrophes — extract the cultivar name.
  // Anchoring on the first quote handles multi-word bases such as 'Juniperus x media'
  // and 'Beta vulgaris (Garden Beet Group)'. DB data uses ASCII apostrophes throughout.
  const quoteIdx = scientificName.indexOf("'");
  if (quoteIdx !== -1) {
    const cultivarPart = scientificName.slice(quoteIdx);
    // Strip opening delimiter; strip closing delimiter before a space or end-of-string.
    // Preserves internal apostrophes (e.g. Dart's Gold) and trade names after the close quote.
    return cultivarPart
      .replace(/^'/, '')
      .replace(/'(?=[ \t\n\r]|$)/, '')
      .trim();
  }

  // iNat-style trinomial — everything after the first two words (genus + epithet) is the
  // infraspecific descriptor (e.g. "subsp. adansonii", "var. borsigiana").
  // A plain binomial with no infraspecific part is the base species.
  const words = scientificName.trim().split(/\s+/);
  if (words.length <= 2) return 'Typical';
  const infraspecific = words.slice(2).join(' ');
  return infraspecific.charAt(0).toUpperCase() + infraspecific.slice(1);
}

@Component({
  selector: 'app-botanical-detail-dialog',
  standalone: true,
  imports: [
    ButtonModule,
    DialogModule,
    TranslocoPipe,
    SpeciesPhotoCarouselComponent,
    PhotoLightboxDialogComponent,
  ],
  templateUrl: './botanical-detail-dialog.html',
})
export class BotanicalDetailDialogComponent {
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);

  readonly records = input<CachedBotanicalRecord[]>([]);
  readonly visible = input<boolean>(false);
  readonly isEnriching = input<boolean>(false);
  readonly isTranslating = input<boolean>(false);
  readonly showAddButton = input<boolean>(true);
  readonly backLabel = input<string | null>(null);
  readonly visibleChange = output<boolean>();
  readonly addRequested = output<CachedBotanicalRecord>();
  readonly seedsRequested = output<CachedBotanicalRecord>();
  readonly mixWizardRequested = output<CachedBotanicalRecord>();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraDetailDialogPT = FloraDetailDialogPT;
  protected readonly tabs = DIALOG_TABS;
  protected readonly activeTab = signal<DialogTab>('overview');
  protected readonly tabClass = tabClass;
  protected readonly selectedVarietyIndex = signal<number>(0);

  protected readonly activeRecord = computed(
    (): CachedBotanicalRecord | null => this.records()[this.selectedVarietyIndex()] ?? null,
  );

  protected readonly hasVarieties = computed(() => this.records().length > 1);

  // When all non-base-species records share the same rank, returns that label once
  // for the section header (e.g. "Subspecies"). Null when ranks are mixed — each chip
  // then shows its own rank so the user can tell them apart.
  protected readonly uniformVarietyRank = computed((): string | null => {
    const nonBaseRanks = this.records()
      .map((r) => inatRankLabel(r.inat_rank))
      .filter((label): label is string => label !== null);
    if (nonBaseRanks.length === 0) return null;
    const first = nonBaseRanks[0];
    return nonBaseRanks.every((l) => l === first) ? first : null;
  });

  protected readonly cultivarChips = computed(() => {
    const activeIdx = this.selectedVarietyIndex();
    const base =
      'cursor-pointer inline-flex items-center rounded-full px-3 py-1 font-display text-xs font-medium border transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';
    const activeClass =
      'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-600';
    const inactiveClass =
      'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700';
    const isUniform = this.uniformVarietyRank() !== null;
    return this.records().map((r, i) => ({
      label: extractCultivarLabel(r.scientific_name),
      rankLabel: isUniform ? null : inatRankLabel(r.inat_rank),
      index: i,
      scientificName: r.scientific_name,
      chipClass: `${base} ${activeIdx === i ? activeClass : inactiveClass}`,
    }));
  });

  protected readonly galleryPhotos = computed(() => buildGalleryPhotos(this.activeRecord()));

  protected readonly showLightbox = signal(false);
  protected readonly lightboxStartIndex = signal(0);

  protected openLightbox(index: number): void {
    this.lightboxStartIndex.set(index);
    this.showLightbox.set(true);
  }

  protected readonly sunlightLabels = computed(() =>
    getSunlightLabels(this.activeRecord()?.sunlight),
  );
  protected readonly wateringLabel = computed(() =>
    getWateringLabel(this.activeRecord()?.watering),
  );
  protected readonly difficultyLabel = computed(() => {
    const _lang = this.localeService.locale();
    const key = CARE_DIFFICULTY_KEY[this.activeRecord()?.care_difficulty ?? ''];
    return key ? this.t.translate(key) : (this.activeRecord()?.care_difficulty ?? '');
  });
  protected readonly maintenanceLevelLabel = computed(() => {
    const _lang = this.localeService.locale();
    const key = MAINTENANCE_LEVEL_KEY[this.activeRecord()?.maintenance_level ?? ''];
    return key ? this.t.translate(key) : (this.activeRecord()?.maintenance_level ?? '');
  });
  protected readonly preferredSoilTypes = computed(() =>
    getSoilTypeLabels(this.activeRecord()?.preferred_soil_type),
  );

  protected readonly difficultyClass = computed(() => {
    switch (this.activeRecord()?.care_difficulty) {
      case 'Beginner':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'Intermediate':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Advanced':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
    }
  });

  protected readonly maintenanceLevelClass = computed(() => {
    switch (this.activeRecord()?.maintenance_level) {
      case 'Low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'High':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
    }
  });

  protected readonly placementClass = computed(() => {
    switch (this.activeRecord()?.placement) {
      case 'Indoor':
        return 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300';
      case 'Outdoor':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'Both':
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
      default:
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
    }
  });

  protected readonly growthRateClass = computed(() => {
    switch (this.activeRecord()?.growth_rate) {
      case 'Fast':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Slow':
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
      default:
        return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300';
    }
  });

  // Tracks the first record's key to distinguish "new group opened" from "same group refreshed".
  private _lastGroupKey: string | null = null;

  constructor() {
    effect(() => {
      const key = this.records()[0]?.scientific_name ?? null;
      if (key && key !== this._lastGroupKey) {
        this._lastGroupKey = key;
        this.selectedVarietyIndex.set(0);
        this.activeTab.set('overview');
      }
    });
  }

  protected onMixWizardRequested(): void {
    const rec = this.activeRecord();
    if (rec) this.mixWizardRequested.emit(rec);
  }

  protected onAdd(): void {
    const rec = this.activeRecord();
    if (rec) this.addRequested.emit(rec);
  }

  protected onSaveToSeeds(): void {
    const rec = this.activeRecord();
    if (rec) this.seedsRequested.emit(rec);
  }
}
