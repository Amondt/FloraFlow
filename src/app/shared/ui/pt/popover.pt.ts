import type { PopoverPassThroughOptions } from 'primeng/popover';

export const FloraPopoverPT = {
  root: {
    class:
      'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 text-sm font-display',
  },
  content: { class: 'p-4 text-neutral-700 dark:text-neutral-200' },
} satisfies PopoverPassThroughOptions;
