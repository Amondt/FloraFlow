import { Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FloraFormDialogPT, FloraButtonPT } from '../../../shared/ui/pt/index';
import { ContainerVector, GrowthStage, Plant, SubstrateFactor } from '../plant.model';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';
import { PhotoLightboxDialogComponent } from '../../../shared/components/photo-lightbox-dialog/photo-lightbox-dialog';
import { blurActiveElement } from '../../../shared/utils/dom';
import { daysSince } from '../../../shared/utils/date.util';
import { LibraryService, CachedBotanicalRecord } from '../../library/library.service';
import { buildGalleryPhotos } from '../../../shared/utils/botanical-photo.util';
import { WeatherService } from '../../../core/services/weather.service';

const SUBSTRATE_DEPTH_RULES: Record<SubstrateFactor, { depth: string; descriptionKey: string }> = {
  'High-Drainage Aroid': {
    depth: '3 cm',
    descriptionKey: 'tasks.soilCheck.substrate.highDrainageAroid',
  },
  'Standard Potting': {
    depth: '3 cm',
    descriptionKey: 'tasks.soilCheck.substrate.standardPotting',
  },
  'Heavy Peat': { depth: '3 cm', descriptionKey: 'tasks.soilCheck.substrate.heavyPeat' },
  'Sphagnum Moss Mix': {
    depth: '2 cm',
    descriptionKey: 'tasks.soilCheck.substrate.sphagnumMoss',
  },
  'Desert Succulent': {
    depth: '5 cm',
    descriptionKey: 'tasks.soilCheck.substrate.desertSucculent',
  },
};

const SNOOZE_MATRIX: Record<ContainerVector, Record<SubstrateFactor, number>> = {
  Terracotta: {
    'High-Drainage Aroid': 2,
    'Standard Potting': 3,
    'Heavy Peat': 5,
    'Desert Succulent': 2,
    'Sphagnum Moss Mix': 4,
  },
  Plastic: {
    'High-Drainage Aroid': 3,
    'Standard Potting': 5,
    'Heavy Peat': 7,
    'Desert Succulent': 3,
    'Sphagnum Moss Mix': 6,
  },
  Ceramic: {
    'High-Drainage Aroid': 2,
    'Standard Potting': 4,
    'Heavy Peat': 6,
    'Desert Succulent': 2,
    'Sphagnum Moss Mix': 5,
  },
  Fabric: {
    'High-Drainage Aroid': 2,
    'Standard Potting': 3,
    'Heavy Peat': 5,
    'Desert Succulent': 2,
    'Sphagnum Moss Mix': 4,
  },
  'Self-Watering': {
    'High-Drainage Aroid': 7,
    'Standard Potting': 7,
    'Heavy Peat': 7,
    'Desert Succulent': 7,
    'Sphagnum Moss Mix': 7,
  },
  Ground: {
    'High-Drainage Aroid': 5,
    'Standard Potting': 5,
    'Heavy Peat': 7,
    'Desert Succulent': 5,
    'Sphagnum Moss Mix': 7,
  },
};

const WATERING_MULTIPLIER: Record<string, number> = {
  frequent: 0.75,
  average: 1.0,
  minimum: 1.5,
  none: 2.0,
};

const GROWTH_MULTIPLIER: Record<GrowthStage, number> = {
  Seedling: 0.5,
  Juvenile: 1.0,
  Mature: 1.0,
  Dormant: 2.0,
};

type CheckStep = 'ask' | 'schedule';

@Component({
  selector: 'app-soil-check-dialog',
  standalone: true,
  imports: [
    RouterLink,
    DialogModule,
    ButtonModule,
    TranslocoPipe,
    LeafIconComponent,
    PhotoLightboxDialogComponent,
  ],
  templateUrl: './soil-check-dialog.html',
})
export class SoilCheckDialogComponent {
  private readonly libraryService = inject(LibraryService);
  private readonly weatherService = inject(WeatherService);
  private readonly t = inject(TranslocoService);

  private readonly HEAT_MULTIPLIER = 0.65;

  readonly plant = input.required<Plant>();
  readonly zoneName = input<string | null>(null);
  readonly visible = model<boolean>(false);
  readonly confirmed = output<{ plant: Plant; note: string; days: number }>();
  readonly snoozed = output<{ id: string; days: number }>();

  protected readonly FloraFormDialogPT = FloraFormDialogPT;
  protected readonly FloraButtonPT = FloraButtonPT;

  readonly step = signal<CheckStep>('ask');
  readonly isWatering = signal(false);
  readonly snoozeDays = signal(5);
  readonly note = signal('');
  readonly snoozePresets = [2, 5, 7, 10, 14] as const;

  readonly isHeatActive = computed(() => this.weatherService.hasHeatRisk());

  protected readonly showLightbox = signal(false);

  private readonly _botanicalRecord = signal<CachedBotanicalRecord | null>(null);

  constructor() {
    effect(() => {
      if (this.visible()) {
        const name = this.plant().scientific_name;
        this._botanicalRecord.set(null);
        if (name) {
          void this.libraryService
            .fetchByScientificName(name)
            .then((r) => this._botanicalRecord.set(r));
        }
      }
    });
  }

  protected readonly galleryPhotos = computed(() => buildGalleryPhotos(this._botanicalRecord()));

  protected readonly thumbnailUrl = computed(
    () => this._botanicalRecord()?.regular_url ?? this._botanicalRecord()?.thumbnail_url ?? null,
  );

  readonly wateringNeeds = computed(() => {
    const w = this._botanicalRecord()?.watering;
    if (!w) return null;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  readonly isAiEnriched = computed(
    () =>
      !!(
        this._botanicalRecord()?.is_ai_enriched && this._botanicalRecord()?.check_depth_description
      ),
  );

  readonly checkDepth = computed((): string | null => {
    if (this.isAiEnriched()) return null;
    return SUBSTRATE_DEPTH_RULES[this.plant().substrate_factor].depth;
  });

  readonly checkDepthDescription = computed((): string => {
    if (this.isAiEnriched()) return this._botanicalRecord()!.check_depth_description!;
    return this.t.translate(SUBSTRATE_DEPTH_RULES[this.plant().substrate_factor].descriptionKey);
  });

  readonly lastCheckedLabel = computed(() => {
    const ts = this.plant().last_checked_at;
    if (!ts) return this.t.translate('tasks.soilCheck.neverChecked');
    const days = daysSince(ts);
    if (days === 0) return this.t.translate('tasks.soilCheck.lastCheckedToday');
    if (days === 1) return this.t.translate('tasks.soilCheck.lastCheckedYesterday');
    return this.t.translate('tasks.soilCheck.lastCheckedDaysAgo', { days });
  });

  readonly recommendedDays = computed(() => {
    const plant = this.plant();
    const record = this._botanicalRecord();

    const baseDays = SNOOZE_MATRIX[plant.container_vector][plant.substrate_factor];
    const wateringMultiplier = WATERING_MULTIPLIER[record?.watering?.toLowerCase() ?? ''] ?? 1.0;
    const growthMultiplier = GROWTH_MULTIPLIER[plant.growth_stage];
    const heatMultiplier = this.isHeatActive() ? this.HEAT_MULTIPLIER : 1;
    const raw = Math.max(
      1,
      Math.min(14, Math.round(baseDays * wateringMultiplier * growthMultiplier * heatMultiplier)),
    );

    const presets = [2, 5, 7, 10, 14] as const;
    return presets.reduce((prev, cur) => (Math.abs(cur - raw) < Math.abs(prev - raw) ? cur : prev));
  });

  readonly todayLabel = computed(() => {
    const lang = this.t.getActiveLang();
    const locale = lang === 'nl' ? 'nl-NL' : lang === 'fr' ? 'fr-FR' : 'en-GB';
    return new Date().toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  });

  readonly snoozeLabelText = computed(() =>
    this.t.translate('tasks.soilCheck.snoozeLabel', { days: this.snoozeDays() }),
  );

  onVisibleChange(v: boolean): void {
    if (!v) {
      this.step.set('ask');
      this.note.set('');
    }
    this.visible.set(v);
  }

  onDry(): void {
    this.isWatering.set(true);
    this.snoozeDays.set(this.recommendedDays());
    this.step.set('schedule');
  }

  onMoist(): void {
    this.isWatering.set(false);
    this.snoozeDays.set(this.recommendedDays());
    this.step.set('schedule');
  }

  onBack(): void {
    this.step.set('ask');
  }

  onConfirm(): void {
    this.confirmed.emit({ plant: this.plant(), note: this.note(), days: this.snoozeDays() });
    this.close();
  }

  onSnooze(): void {
    this.snoozed.emit({ id: this.plant().id, days: this.snoozeDays() });
    this.close();
  }

  onCancel(): void {
    this.close();
  }

  private close(): void {
    this.step.set('ask');
    this.note.set('');
    this.showLightbox.set(false);
    blurActiveElement();
    this.visible.set(false);
  }
}
