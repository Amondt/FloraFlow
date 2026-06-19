import type { TagPassThroughOptions } from 'primeng/tag';
import type { ChipPassThroughOptions } from 'primeng/chip';

export const FloraTagPT = {
  root: ({ instance }: { instance?: { severity?: string | null } } = {}) => ({
    class: [
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-display border',
      {
        // info / default → sage
        'bg-primary-50 text-primary-700 border-primary-200/70 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800/50':
          !instance?.severity || instance.severity === 'info',
        // success → sage (positive)
        'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-800/50':
          instance?.severity === 'success',
        // warn → warm amber — caution signal preserved, matches --color-warning-500
        'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40':
          instance?.severity === 'warn',
        // danger → coral — overdue/flagged pop (true destructive stays in button.pt.ts)
        'bg-coral-400/10 text-neutral-800 border-coral-500/30 dark:bg-coral-400/20 dark:text-coral-400 dark:border-coral-400/30':
          instance?.severity === 'danger',
        // secondary → warm neutral
        'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-700 dark:text-neutral-300 dark:border-neutral-600':
          instance?.severity === 'secondary',
      },
    ],
  }),
  icon: { class: 'text-xs' },
  label: { class: '' },
} satisfies TagPassThroughOptions;

export const FloraChipPT = {
  root: {
    class:
      'inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-600 rounded-full text-sm font-display',
  },
  label: { class: 'leading-none' },
  icon: { class: 'text-sm text-neutral-500' },
  removeIcon: {
    class:
      'text-xs text-neutral-400 cursor-pointer hover:text-danger-500 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-danger-500 rounded',
  },
} satisfies ChipPassThroughOptions;
