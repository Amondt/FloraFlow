import type { AutoCompletePassThroughOptions } from 'primeng/types/autocomplete';
import { FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER } from './states.pt';

export const FloraAutoCompletePT = {
  root: {
    class: ['w-full relative', FLORA_DISABLED].join(' '),
  },
  pcInputText: {
    root: {
      class: [
        'w-full px-3 py-2 text-sm font-display',
        'bg-white dark:bg-neutral-800',
        'text-neutral-900 dark:text-neutral-100',
        'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
        'placeholder:text-neutral-400',
        FLORA_FOCUS, FLORA_DISABLED,
      ].join(' '),
    },
  },
  overlay: {
    class: 'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50',
  },
  list: { class: 'py-1 max-h-60 overflow-auto' },
  option: ({ context = { selected: false } }: { context?: { selected: boolean } } = {}) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer font-display',
      'text-neutral-700 dark:text-neutral-200',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium': context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic font-display' },
  loader: { class: 'absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4' },
} satisfies AutoCompletePassThroughOptions;
