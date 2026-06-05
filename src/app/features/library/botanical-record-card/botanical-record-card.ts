import { Component, computed, input, output } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { CachedBotanicalRecord } from '../library.service';
import { FloraTagPT } from '../../../shared/ui/pt/index';

type TagState = { label: string; severity: 'success' | 'warn' | 'danger' };

@Component({
  selector: 'app-botanical-record-card',
  standalone: true,
  imports: [TagModule],
  templateUrl: './botanical-record-card.html',
})
export class BotanicalRecordCardComponent {
  readonly record = input.required<CachedBotanicalRecord>();
  readonly selected = input<boolean>(false);
  readonly isEnriching = input<boolean>(false);
  readonly cardSelect = output<void>();

  protected readonly FloraTagPT = FloraTagPT;

  protected readonly ariaLabel = computed(() => {
    const r = this.record();
    if (r.common_name && r.scientific_name) {
      return `${r.common_name}, scientific name ${r.scientific_name}`;
    }
    return r.common_name ?? r.scientific_name ?? 'Unknown species';
  });

  protected readonly difficultyTag = computed((): TagState | null => {
    switch (this.record().care_difficulty) {
      case 'Beginner':
        return { label: 'Easy care', severity: 'success' };
      case 'Intermediate':
        return { label: 'Moderate care', severity: 'warn' };
      case 'Advanced':
        return { label: 'Expert care', severity: 'danger' };
      default:
        return null;
    }
  });

  protected readonly maintenanceTag = computed((): TagState | null => {
    switch (this.record().maintenance_level) {
      case 'Low':
        return { label: 'Easy upkeep', severity: 'success' };
      case 'Medium':
        return { label: 'Moderate upkeep', severity: 'warn' };
      case 'High':
        return { label: 'High upkeep', severity: 'danger' };
      default:
        return null;
    }
  });

  protected onSpaceKey(event: Event): void {
    event.preventDefault();
    this.cardSelect.emit();
  }
}
