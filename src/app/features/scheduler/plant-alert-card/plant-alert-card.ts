import { Component, computed, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { Plant } from '../plant.model';

const BASE_BADGE = [
  'inline-flex items-center gap-1.5',
  'whitespace-nowrap flex-shrink-0',
  'px-2.5 py-1 rounded-full',
  'text-xs font-medium font-display',
  'border',
].join(' ');

@Component({
  selector: 'app-plant-alert-card',
  standalone: true,
  imports: [NgClass],
  templateUrl: './plant-alert-card.html',
})
export class PlantAlertCardComponent {
  readonly plant    = input.required<Plant>();
  readonly zoneName = input<string | null>(null);
  readonly checkNow = output<Plant>();
  readonly edit     = output<Plant>();

  readonly headingId = computed(() => `plant-heading-${this.plant().id}`);

  private readonly daysFromNow = computed(() => {
    const due   = new Date(this.plant().next_check_due_at);
    const today = new Date();
    const dueMidnight   = new Date(due.getFullYear(),   due.getMonth(),   due.getDate());
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((dueMidnight.getTime() - todayMidnight.getTime()) / 86_400_000);
  });

  readonly isOverdue = computed(() => this.daysFromNow() < 0);

  readonly overdueLabel = computed(() => {
    const d = this.daysFromNow();
    if (d < -1)  return `Overdue · ${-d} d`;
    if (d === -1) return 'Overdue · 1 d';
    if (d === 0)  return 'Due today';
    if (d === 1)  return 'In 1 d';
    return `In ${d} d`;
  });

  readonly dotColor = computed(() =>
    this.daysFromNow() <= 0 ? 'bg-warning-500' : 'bg-primary-500'
  );

  readonly badgeColor = computed(() => {
    const d = this.daysFromNow();
    if (d <= 0) {
      return `${BASE_BADGE} bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/40`;
    }
    return `${BASE_BADGE} bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-800/40`;
  });

  readonly articleNgClass = computed(() =>
    this.isOverdue()
      ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/50'
      : 'bg-white border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700/50'
  );

  readonly editBorderNgClass = computed(() =>
    this.isOverdue()
      ? 'border-amber-200 dark:border-amber-800/50'
      : 'border-neutral-200 dark:border-neutral-700/50'
  );
}
