import type { DialogPassThroughOptions } from 'primeng/dialog';
import type { ConfirmDialogPassThroughOptions } from 'primeng/confirmdialog';

const MOBILE_MASK = 'bg-neutral-900/50 backdrop-blur-sm max-md:!items-end';
const MOBILE_DIALOG_ROOT = 'max-md:max-w-none max-md:rounded-t-garden-lg max-md:max-h-[92vh]';

export const FloraDialogPT = {
  root: {
    class: `max-w-md w-full max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 md:rounded-garden-lg shadow-2xl overflow-hidden border-0 ${MOBILE_DIALOG_ROOT}`,
  },
  header: {
    class:
      'shrink-0 bg-primary-900 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title: { class: 'text-base' },
  pcCloseButton: {
    root: {
      class:
        'cursor-pointer inline-flex items-center justify-center p-1 rounded hover:bg-primary-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white',
    },
  },
  content: {
    class:
      'flex-1 min-h-0 overflow-y-auto p-6 text-neutral-700 dark:text-neutral-200 text-base leading-relaxed font-display',
  },
  footer: {
    class:
      'shrink-0 bg-neutral-50 dark:bg-neutral-800 p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700',
  },
  mask: { class: MOBILE_MASK },
} satisfies DialogPassThroughOptions;

export const FloraFormDialogPT = {
  root: {
    class: `max-w-lg w-full max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 md:rounded-garden-lg shadow-2xl overflow-hidden border-0 ${MOBILE_DIALOG_ROOT}`,
  },
  header: {
    class:
      'shrink-0 bg-primary-900 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title: { class: 'text-base' },
  pcCloseButton: {
    root: {
      class:
        'cursor-pointer inline-flex items-center justify-center p-1 rounded hover:bg-primary-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white',
    },
  },
  content: {
    class:
      'flex-1 min-h-0 overflow-y-auto p-6 text-neutral-700 dark:text-neutral-200 text-base leading-relaxed font-display',
  },
  footer: {
    class:
      'shrink-0 bg-neutral-50 dark:bg-neutral-800 p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700',
  },
  mask: { class: MOBILE_MASK },
} satisfies DialogPassThroughOptions;

export const FloraDetailDialogPT = {
  root: {
    class: `max-w-2xl w-full max-h-[90vh] flex flex-col bg-white dark:bg-neutral-900 md:rounded-garden-lg shadow-2xl overflow-hidden border-0 ${MOBILE_DIALOG_ROOT}`,
  },
  header: {
    class:
      'shrink-0 bg-primary-900 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title: { class: 'text-base' },
  pcCloseButton: {
    root: {
      class:
        'cursor-pointer inline-flex items-center justify-center p-1 rounded hover:bg-primary-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white',
    },
  },
  content: {
    class:
      'flex-1 min-h-0 overflow-y-auto p-6 text-neutral-700 dark:text-neutral-200 text-sm leading-relaxed font-display',
  },
  footer: {
    class:
      'shrink-0 bg-neutral-50 dark:bg-neutral-800 p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700',
  },
  mask: { class: MOBILE_MASK },
} satisfies DialogPassThroughOptions;

// PrimeNG v21 types ConfirmDialogPassThroughOptions.root as DialogPassThrough (a nested
// object), but the component consumes the flat slot structure at runtime. Cast through
// unknown so the template type-checker accepts the binding without altering the shape.
export const FloraConfirmDialogPT = {
  root: {
    class:
      'max-w-sm w-full bg-white dark:bg-neutral-900 md:rounded-garden-lg shadow-2xl overflow-hidden max-md:max-w-none max-md:rounded-t-garden-lg',
  },
  header: {
    class:
      'bg-danger-500 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title: { class: 'text-base' },
  content: {
    class: 'p-6 text-neutral-700 dark:text-neutral-200 text-sm leading-relaxed font-display',
  },
  footer: {
    class: 'p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700',
  },
  pcAcceptButton: {
    root: {
      class:
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-garden-sm bg-danger-500 text-white hover:bg-danger-700 transition-colors duration-150',
    },
  },
  pcRejectButton: {
    root: {
      class:
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-garden-sm bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-150',
    },
  },
  mask: { class: MOBILE_MASK },
} as unknown as ConfirmDialogPassThroughOptions;
