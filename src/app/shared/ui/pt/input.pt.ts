import type { InputTextPassThroughOptions } from 'primeng/types/inputtext';
import type { InputNumberPassThroughOptions } from 'primeng/types/inputnumber';
import type { TextareaPassThroughOptions } from 'primeng/types/textarea';
import { FLORA_FOCUS, FLORA_DISABLED } from './states.pt';

export const FloraInputTextPT = {
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
} satisfies InputTextPassThroughOptions;

export const FloraInputNumberPT = {
  root: { class: 'w-full flex rounded-garden-sm overflow-hidden border border-neutral-300 dark:border-neutral-600' },
  pcInputText: {
    root: {
      class: [
        'flex-1 px-3 py-2 text-sm font-display',
        'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
        'border-none outline-none',
        FLORA_FOCUS,
      ].join(' '),
    },
  },
  buttonGroup: {
    class: 'flex flex-col border-l border-neutral-300 dark:border-neutral-600',
  },
  incrementButton: {
    class: 'flex flex-1 items-center justify-center px-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors duration-150',
  },
  decrementButton: {
    class: 'flex flex-1 items-center justify-center px-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors duration-150 border-t border-neutral-300 dark:border-neutral-600',
  },
} satisfies InputNumberPassThroughOptions;

export const FloraTextareaPT = {
  root: {
    class: [
      'w-full px-3 py-2 text-sm font-display resize-y min-h-24',
      'bg-white dark:bg-neutral-800',
      'text-neutral-900 dark:text-neutral-100',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'placeholder:text-neutral-400',
      FLORA_FOCUS, FLORA_DISABLED,
    ].join(' '),
  },
} satisfies TextareaPassThroughOptions;
