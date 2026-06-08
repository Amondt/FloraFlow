import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { CachedBotanicalRecord } from '../../../features/library/library.service';
import { getSunlightLabels, getWateringLabel } from '../../utils/botanical-label.util';
import { FloraButtonPT, FloraDetailDialogPT } from '../../ui/pt/index';
import { LeafIconComponent } from '../leaf-icon/leaf-icon';
import { tabClass } from '../../utils/tab-styles.util';

type DialogTab = 'overview' | 'care' | 'growth' | 'safety';

const DIALOG_TABS: { id: DialogTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'pi pi-compass' },
  { id: 'care', label: 'Care', icon: 'pi pi-heart' },
  { id: 'growth', label: 'Growth', icon: 'pi pi-chart-line' },
  { id: 'safety', label: 'Safety', icon: 'pi pi-shield' },
];

function inatRankLabel(rank: string | null): string | null {
  switch (rank) {
    case 'subspecies':
      return 'Subspecies';
    case 'variety':
      return 'Variety';
    case 'form':
      return 'Form';
    case 'hybrid':
    case 'genushybrid':
      return 'Hybrid';
    default:
      return null;
  }
}

function extractCultivarLabel(scientificName: string): string {
  // Anchor on the first cultivar-name quote — handles multi-word species bases such as
  // 'Juniperus x media' and 'Beta vulgaris (Garden Beet Group)', genus-only entries, and
  // standard 'Genus species' forms. DB data uses ASCII apostrophes throughout.
  const quoteIdx = scientificName.indexOf("'");
  if (quoteIdx === -1) return 'Original';
  const cultivarPart = scientificName.slice(quoteIdx);
  // Strip opening delimiter; strip closing delimiter before a space or end-of-string.
  // Preserves internal apostrophes (e.g. Dart's Gold) and trade names after the close quote.
  return cultivarPart
    .replace(/^'/, '')
    .replace(/'(?=[ \t\n\r]|$)/, '')
    .trim();
}

@Component({
  selector: 'app-botanical-detail-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, LeafIconComponent],
  templateUrl: './botanical-detail-dialog.html',
})
export class BotanicalDetailDialogComponent {
  readonly records = input<CachedBotanicalRecord[]>([]);
  readonly visible = input<boolean>(false);
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
  protected readonly showLightbox = signal(false);
  protected readonly selectedVarietyIndex = signal<number>(0);
  private readonly lightboxEl = viewChild<ElementRef<HTMLDivElement>>('lightboxEl');

  protected readonly activeRecord = computed(
    (): CachedBotanicalRecord | null => this.records()[this.selectedVarietyIndex()] ?? null,
  );

  protected readonly hasVarieties = computed(() => this.records().length > 1);

  protected readonly cultivarChips = computed(() => {
    const activeIdx = this.selectedVarietyIndex();
    const base =
      'cursor-pointer inline-flex items-center rounded-full px-3 py-1 font-display text-xs font-semibold border transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';
    const activeClass =
      'bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-600';
    const inactiveClass =
      'bg-neutral-50 text-neutral-600 border-neutral-200 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700 dark:hover:bg-neutral-700';
    return this.records().map((r, i) => ({
      label: extractCultivarLabel(r.scientific_name),
      rankLabel: inatRankLabel(r.inat_rank),
      index: i,
      scientificName: r.scientific_name,
      chipClass: `${base} ${activeIdx === i ? activeClass : inactiveClass}`,
    }));
  });

  protected readonly lightboxUrl = computed(
    () => this.activeRecord()?.regular_url ?? this.activeRecord()?.thumbnail_url ?? null,
  );

  protected readonly sunlightLabels = computed(() =>
    getSunlightLabels(this.activeRecord()?.sunlight),
  );
  protected readonly wateringLabel = computed(() =>
    getWateringLabel(this.activeRecord()?.watering),
  );
  protected readonly preferredSoilTypes = computed(
    () => this.activeRecord()?.preferred_soil_type ?? [],
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
        this.showLightbox.set(false);
      }
    });

    effect(() => {
      if (!this.visible()) this.showLightbox.set(false);
    });

    effect(() => {
      if (this.showLightbox()) {
        Promise.resolve().then(() => this.lightboxEl()?.nativeElement.focus());
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
