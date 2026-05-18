import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FloraButtonPT, FloraTagPT } from '../../shared/ui/pt/index';
import { Plant } from './plant.model';

@Component({
  selector: 'app-plant-alert-card',
  standalone: true,
  imports: [ButtonModule, TagModule],
  templateUrl: './plant-alert-card.html',
})
export class PlantAlertCardComponent {
  readonly plant    = input.required<Plant>();
  readonly checkNow = output<Plant>();
  readonly snooze   = output<string>();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraTagPT    = FloraTagPT;

  readonly headingId = computed(() => `plant-heading-${this.plant().id}`);

  readonly daysOverdue = computed(() =>
    Math.max(0, Math.floor(
      (Date.now() - new Date(this.plant().next_check_due_at).getTime()) / 86_400_000
    ))
  );

  readonly overdueSeverity = computed(() =>
    this.daysOverdue() >= 7 ? 'danger' : 'warn'
  );

  readonly overdueLabel = computed(() => {
    const d = this.daysOverdue();
    if (d === 0) return 'Due today';
    if (d === 1) return '1 day overdue';
    return `${d} days overdue`;
  });
}
