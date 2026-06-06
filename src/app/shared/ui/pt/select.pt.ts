import type { SelectPassThroughOptions } from 'primeng/select';
import type { MultiSelectPassThroughOptions } from 'primeng/multiselect';
import { FLORA_DISABLED, FLORA_FOCUS, FLORA_HOVER } from './states.pt';

export const FloraSelectPT = {
  root: {
    class: [
      // h-control locks height to the same token as p-button (2.375rem = 38px).
      // justify-between pushes the chevron to the far right regardless of PrimeNG's
      // flex: 1 1 auto / width: 1% injected on .p-select-label.
      'w-full flex items-center justify-between px-3 h-control text-sm font-display cursor-pointer',
      'bg-white dark:bg-neutral-800',
      'text-neutral-900 dark:text-neutral-100',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'outline-none',
      FLORA_FOCUS,
      FLORA_DISABLED,
      FLORA_HOVER,
    ].join(' '),
  },
  label: { class: 'flex-1 truncate outline-none' },
  // pl-2 provides the gap between text and chevron; no ml-auto needed with justify-between
  dropdown: { class: 'flex items-center shrink-0 pl-2 text-neutral-400' },
  pcOverlay: {
    root: {
      class:
        'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 overflow-hidden',
    },
  },
  list: { class: 'py-1' },
  option: ({ context = { selected: false } }: { context?: { selected: boolean } } = {}) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer font-display',
      'text-neutral-700 dark:text-neutral-200',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium':
          context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
  optionGroup: {
    class:
      'sticky top-0 z-10 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 first:border-t-0',
  },
} satisfies SelectPassThroughOptions;

export const FloraMultiSelectPT = {
  root: {
    class: [
      'w-full flex items-center justify-between px-3 h-control text-sm font-display cursor-pointer',
      'bg-white dark:bg-neutral-800',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'outline-none',
      FLORA_FOCUS,
      FLORA_DISABLED,
    ].join(' '),
  },
  label: { class: 'flex-1 truncate outline-none text-neutral-900 dark:text-neutral-100' },
  dropdown: { class: 'flex items-center shrink-0 pl-2 text-neutral-400' },
  overlay: {
    class:
      'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 overflow-hidden',
  },
  header: {
    class: 'px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2',
  },
  list: { class: 'py-1 max-h-60 overflow-auto' },
  option: ({ context = { selected: false } }: { context?: { selected: boolean } } = {}) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer flex items-center gap-2 font-display',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30': context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
  chipItem: {
    class:
      'inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 rounded-full',
  },
} satisfies MultiSelectPassThroughOptions;
