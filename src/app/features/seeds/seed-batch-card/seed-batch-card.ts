import { Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  SeedBatch,
  SeedStage,
  SEED_STAGE_OPTIONS,
  SEED_STAGE_LABEL_KEYS,
} from '../seed-batch.model';

const STAGE_BADGE_COLORS: Record<SeedStage, string> = {
  Stored: 'text-neutral-400 bg-neutral-100 dark:bg-neutral-700 dark:text-neutral-400',
  'Sown Indoors': 'text-primary-600 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400',
  Germinated: 'text-success-500 bg-green-50 dark:bg-green-900/30 dark:text-green-400',
  'Potted Up': 'text-primary-700 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-300',
  'Hardened Off': 'text-warning-500 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
  'Transplanted Outside':
    'text-primary-900 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-200',
};

const BADGE_BASE =
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-display';

@Component({
  selector: 'app-seed-batch-card',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './seed-batch-card.html',
})
export class SeedBatchCardComponent {
  readonly batch = input.required<SeedBatch>();

  readonly advanceRequested = output<void>();
  readonly editRequested = output<void>();
  readonly deleteRequested = output<void>();
  readonly graduateRequested = output<void>();
  readonly archiveRequested = output<void>();

  readonly headingId = computed(() => `seed-batch-heading-${this.batch().id}`);

  readonly isArchived = computed(() => !!this.batch().archived_at);

  readonly articleClass = computed(() => {
    const base =
      'border border-neutral-200 dark:border-neutral-700/50 rounded-garden-md overflow-hidden';
    if (this.isArchived()) {
      return `bg-neutral-50 dark:bg-neutral-800/50 ${base}`;
    }
    return `bg-white dark:bg-neutral-800 ${base} transition-colors duration-150 hover:border-primary-500 dark:hover:border-primary-400 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2`;
  });

  readonly isTerminalStage = computed(() => {
    const idx = SEED_STAGE_OPTIONS.indexOf(this.batch().current_stage);
    return idx === SEED_STAGE_OPTIONS.length - 1;
  });

  readonly canGraduate = computed(() =>
    (['Potted Up', 'Hardened Off', 'Transplanted Outside'] as SeedStage[]).includes(
      this.batch().current_stage,
    ),
  );

  readonly stageBadgeClass = computed(
    () => `${BADGE_BASE} ${STAGE_BADGE_COLORS[this.batch().current_stage]}`,
  );

  stageKey(stage: SeedStage): string {
    return SEED_STAGE_LABEL_KEYS[stage];
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
