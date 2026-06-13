import { Component, computed, inject, input } from '@angular/core';
import { Message } from 'primeng/message';
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
import { FloraMessagePT } from '../../ui/pt/index';

@Component({
  selector: 'app-care-recommendations-panel',
  standalone: true,
  imports: [Message, TranslocoPipe],
  templateUrl: './care-recommendations-panel.html',
})
export class CareRecommendationsPanelComponent {
  private readonly t = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);

  readonly record = input.required<CachedBotanicalRecord>();
  readonly zoneHumidity = input<number | null>(null);

  protected readonly FloraMessagePT = FloraMessagePT;

  protected readonly wateringLabel = computed(() => getWateringLabel(this.record().watering));
  protected readonly sunlightLabels = computed(() => getSunlightLabels(this.record().sunlight));
  protected readonly preferredSoilTypes = computed(() =>
    getSoilTypeLabels(this.record().preferred_soil_type),
  );

  protected readonly difficultyLabel = computed(() => {
    const _lang = this.localeService.locale();
    const key = CARE_DIFFICULTY_KEY[this.record().care_difficulty ?? ''];
    return key ? this.t.translate(key) : (this.record().care_difficulty ?? '');
  });

  protected readonly maintenanceLevelLabel = computed(() => {
    const _lang = this.localeService.locale();
    const key = MAINTENANCE_LEVEL_KEY[this.record().maintenance_level ?? ''];
    return key ? this.t.translate(key) : (this.record().maintenance_level ?? '');
  });

  protected readonly difficultyClass = computed(() => {
    switch (this.record().care_difficulty) {
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
    switch (this.record().maintenance_level) {
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

  protected readonly humidityStatus = computed((): 'compatible' | 'low' | 'high' | null => {
    const zone = this.zoneHumidity();
    const min = this.record().ideal_humidity_min;
    const max = this.record().ideal_humidity_max;

    if (zone === null) return null;
    if (min === null && max === null) return null;

    if (min !== null && zone < min) return 'low';
    if (max !== null && zone > max) return 'high';
    return 'compatible';
  });

  protected readonly humidityWarningText = computed((): string => {
    const _lang = this.localeService.locale();
    const zone = this.zoneHumidity();
    const min = this.record().ideal_humidity_min;
    const max = this.record().ideal_humidity_max;
    const status = this.humidityStatus();

    if (!status || zone === null || status === 'compatible') return '';

    const range =
      min !== null && max !== null ? `${min}–${max}%` : min !== null ? `≥${min}%` : `≤${max}%`;

    return status === 'low'
      ? this.t.translate('botanical.care.humidityLow', { zone, range })
      : this.t.translate('botanical.care.humidityHigh', { zone, range });
  });
}
