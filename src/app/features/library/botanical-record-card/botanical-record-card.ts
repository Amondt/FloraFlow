import { Component, computed, input, output } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { CachedBotanicalRecord } from '../library.service';
import { getSunlightLabels, getWateringLabel } from '../../../shared/utils/botanical-label.util';
import { FloraTagPT } from '../../../shared/ui/pt/index';

@Component({
  selector: 'app-botanical-record-card',
  standalone: true,
  imports: [TagModule],
  templateUrl: './botanical-record-card.html',
})
export class BotanicalRecordCardComponent {
  readonly record = input.required<CachedBotanicalRecord>();
  readonly selected = input<boolean>(false);
  readonly cardSelect = output<void>();

  protected readonly FloraTagPT = FloraTagPT;

  protected readonly ariaLabel = computed(() => {
    const r = this.record();
    if (r.common_name && r.scientific_name) {
      return `${r.common_name}, scientific name ${r.scientific_name}`;
    }
    return r.common_name ?? r.scientific_name ?? 'Unknown species';
  });

  protected readonly sunlightLabels = computed(() => getSunlightLabels(this.record().sunlight));

  protected readonly wateringLabel = computed(() => getWateringLabel(this.record().watering));

  protected onSpaceKey(event: Event): void {
    event.preventDefault();
    this.cardSelect.emit();
  }
}
