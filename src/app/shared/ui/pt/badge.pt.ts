import type { TagPassThroughOptions } from 'primeng/tag';
import type { ChipPassThroughOptions } from 'primeng/chip';

export const FloraTagPT = {
  root: ({ props }: { props: { severity?: string } }) => ({
    class: [
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-display',
      {
        'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300': props.severity === 'info' || !props.severity,
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300':         props.severity === 'success',
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300':     props.severity === 'warn',
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300':                 props.severity === 'danger',
        'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300':    props.severity === 'secondary',
      },
    ],
  }),
  icon:  { class: 'text-xs' },
  label: { class: '' },
} satisfies TagPassThroughOptions;

export const FloraChipPT = {
  root:        { class: 'inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-full text-sm font-display' },
  label:       { class: 'leading-none' },
  icon:        { class: 'text-sm text-neutral-500' },
  removeIcon:  { class: 'text-xs text-neutral-400 cursor-pointer hover:text-danger-500 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-danger-500 rounded' },
} satisfies ChipPassThroughOptions;
