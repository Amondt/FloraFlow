import { Component, computed, input, output } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { CachedBotanicalRecord } from '../library.service';
import { FloraTagPT } from '../../../shared/ui/pt/index';

const SUNLIGHT_LABEL: Record<string, string> = {
  full_sun: 'Full sun',
  part_shade: 'Part shade',
  full_shade: 'Shade',
  filtered_indirect: 'Indirect',
};

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

  protected readonly sunlightLabels = computed(() =>
    (this.record().sunlight ?? []).map((s) => SUNLIGHT_LABEL[s] ?? s),
  );

  protected onSpaceKey(event: Event): void {
    event.preventDefault();
    this.cardSelect.emit();
  }
}
