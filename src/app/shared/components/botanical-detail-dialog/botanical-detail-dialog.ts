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

@Component({
  selector: 'app-botanical-detail-dialog',
  standalone: true,
  imports: [ButtonModule, DialogModule, LeafIconComponent],
  templateUrl: './botanical-detail-dialog.html',
})
export class BotanicalDetailDialogComponent {
  readonly record = input<CachedBotanicalRecord | null>(null);
  readonly visible = input<boolean>(false);
  readonly showAddButton = input<boolean>(true);
  readonly visibleChange = output<boolean>();
  readonly addRequested = output<CachedBotanicalRecord>();
  readonly seedsRequested = output<CachedBotanicalRecord>();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraDetailDialogPT = FloraDetailDialogPT;
  protected readonly tabs = DIALOG_TABS;
  protected readonly activeTab = signal<DialogTab>('overview');
  protected readonly tabClass = tabClass;
  protected readonly showLightbox = signal(false);
  private readonly lightboxEl = viewChild<ElementRef<HTMLDivElement>>('lightboxEl');

  protected readonly lightboxUrl = computed(
    () => this.record()?.regular_url ?? this.record()?.thumbnail_url ?? null,
  );

  // Tracks the last scientific_name to distinguish "new plant opened" from "same plant refreshed".
  private _lastScientificName: string | null = null;

  constructor() {
    // Reset to Overview only when a different plant opens — not when the same record refreshes.
    effect(() => {
      const name = this.record()?.scientific_name ?? null;
      if (name && name !== this._lastScientificName) {
        this._lastScientificName = name;
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

  protected readonly sunlightLabels = computed(() => getSunlightLabels(this.record()?.sunlight));
  protected readonly wateringLabel = computed(() => getWateringLabel(this.record()?.watering));
  protected readonly preferredSoilTypes = computed(() => this.record()?.preferred_soil_type ?? []);

  protected readonly difficultyClass = computed(() => {
    switch (this.record()?.care_difficulty) {
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
    switch (this.record()?.maintenance_level) {
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
    switch (this.record()?.placement) {
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
    switch (this.record()?.growth_rate) {
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

  protected onAdd(): void {
    const rec = this.record();
    if (rec) this.addRequested.emit(rec);
  }

  protected onSaveToSeeds(): void {
    const rec = this.record();
    if (rec) this.seedsRequested.emit(rec);
  }
}
