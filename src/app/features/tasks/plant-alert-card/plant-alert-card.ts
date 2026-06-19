import { Component, computed, inject, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Plant } from '../plant.model';
import { LeafIconComponent } from '../../../shared/components/leaf-icon/leaf-icon';

@Component({
  selector: 'app-plant-alert-card',
  standalone: true,
  imports: [NgClass, TranslocoPipe, LeafIconComponent],
  templateUrl: './plant-alert-card.html',
})
export class PlantAlertCardComponent {
  private readonly t = inject(TranslocoService);

  readonly plant = input.required<Plant>();
  readonly zoneName = input<string | null>(null);
  readonly thumbnailUrl = input<string | null>(null);
  readonly checkNow = output<Plant>();
  readonly edit = output<Plant>();
  readonly deleteRequested = output<Plant>();

  readonly headingId = computed(() => `plant-heading-${this.plant().id}`);

  private readonly daysFromNow = computed(() => {
    const due = new Date(this.plant().next_check_due_at);
    const today = new Date();
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
  });

  readonly isOverdue = computed(() => this.daysFromNow() < 0);

  readonly overdueLabel = computed(() => {
    const d = this.daysFromNow();
    if (d < -1) return this.t.translate('tasks.alertCard.overdueDays', { count: -d });
    if (d === -1) return this.t.translate('tasks.alertCard.overdueOneDay');
    if (d === 0) return this.t.translate('tasks.alertCard.dueTodayLabel');
    if (d === 1) return this.t.translate('tasks.alertCard.inOneDayLabel');
    return this.t.translate('tasks.alertCard.inDaysLabel', { count: d });
  });

  // Left accent stripe color — the primary urgency signal
  readonly stripeColor = computed(() =>
    this.daysFromNow() <= 0 ? 'bg-warning-500' : 'bg-primary-400',
  );

  // Inline urgency text color on the zone/status line
  readonly urgencyTextColor = computed(() =>
    this.daysFromNow() <= 0
      ? 'text-warning-500 dark:text-yellow-400'
      : 'text-primary-600 dark:text-primary-400',
  );

  readonly articleNgClass = computed(() =>
    this.isOverdue()
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50'
      : 'bg-white border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700/50',
  );

  readonly editBorderNgClass = computed(() =>
    this.isOverdue()
      ? 'border-amber-200 dark:border-amber-800/50'
      : 'border-neutral-200 dark:border-neutral-700/50',
  );
}
