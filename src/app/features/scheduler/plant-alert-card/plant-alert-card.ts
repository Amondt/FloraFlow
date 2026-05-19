import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { FloraButtonPT, FloraTagPT } from '../../../shared/ui/pt/index';
import { Plant } from '../plant.model';

@Component({
  selector: 'app-plant-alert-card',
  standalone: true,
  imports: [ButtonModule, TagModule],
  templateUrl: './plant-alert-card.html',
})
export class PlantAlertCardComponent {
  readonly plant    = input.required<Plant>();
  readonly checkNow = output<Plant>();
  readonly edit     = output<Plant>();

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraTagPT    = FloraTagPT;

  readonly headingId = computed(() => `plant-heading-${this.plant().id}`);

  private readonly daysFromNow = computed(() => {
    const due   = new Date(this.plant().next_check_due_at);
    const today = new Date();
    const dueMidnight   = new Date(due.getFullYear(),   due.getMonth(),   due.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
  });

  readonly overdueSeverity = computed(() => {
    const d = this.daysFromNow();
    if (d < -6) return 'danger';
    if (d < 0)  return 'warn';
    if (d === 0) return 'warn';
    return 'success';
  });

  readonly overdueLabel = computed(() => {
    const d = this.daysFromNow();
    if (d < -1) return `${-d} days overdue`;
    if (d === -1) return '1 day overdue';
    if (d === 0) return 'Due today';
    if (d === 1) return 'Due tomorrow';
    return `Due in ${d} days`;
  });
}
