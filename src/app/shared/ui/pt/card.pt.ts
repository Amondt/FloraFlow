import type { CardPassThroughOptions } from 'primeng/card';

export const FloraCardPT = {
  root: {
    class: 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 rounded-garden-md p-5 shadow-sm transition-all duration-200 hover:shadow-md',
  },
  title: {
    class: 'text-lg font-semibold font-display text-neutral-900 dark:text-white mb-2',
  },
  subtitle: {
    class: 'text-xs text-neutral-500 dark:text-neutral-400 font-display mb-3',
  },
  content: {
    class: 'text-sm text-neutral-600 dark:text-neutral-300 antialiased font-display',
  },
  footer: {
    class: 'pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2',
  },
} satisfies CardPassThroughOptions;
