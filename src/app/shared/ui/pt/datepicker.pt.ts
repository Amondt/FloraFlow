import type { DatePickerPassThroughOptions } from 'primeng/datepicker';
import { FLORA_FOCUS } from './states.pt';

export const FloraDatePickerPT = {
  root: { class: 'w-full font-display text-sm' },
  pcInputText: {
    root: {
      class: [
        'w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
        'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
        'placeholder:text-neutral-400',
        FLORA_FOCUS,
      ].join(' '),
    },
  },
  panel: {
    class:
      'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl rounded-garden-md p-4 z-50',
  },
  header: {
    class:
      'flex items-center justify-between mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-200',
  },
  pcPrevButton: {
    root: { class: 'p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors' },
  },
  pcNextButton: {
    root: { class: 'p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors' },
  },
  title: { class: 'font-semibold text-neutral-800 dark:text-neutral-100' },
  table: { class: 'w-full text-sm' },
  tableHeaderCell: { class: 'text-center text-xs text-neutral-400 pb-1' },
  dayCell: { class: 'text-center p-0.5' },
  day: ({
    context = { selected: false, today: false, disabled: false },
  }: { context?: { selected: boolean; today: boolean; disabled: boolean } } = {}) => ({
    class: [
      'w-8 h-8 flex items-center justify-center rounded-full text-sm cursor-pointer transition-colors duration-100',
      {
        'bg-primary-500 text-white font-semibold': context.selected,
        'ring-1 ring-primary-500 text-primary-600 font-medium': context.today && !context.selected,
        'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700':
          !context.selected && !context.disabled,
        'text-neutral-300 dark:text-neutral-600 cursor-not-allowed': context.disabled,
      },
    ],
  }),
} satisfies DatePickerPassThroughOptions;
