import type { DialogPassThroughOptions } from 'primeng/dialog';

export const FloraDialogPT = {
  root: {
    class: 'max-w-md w-full bg-white dark:bg-neutral-900 rounded-garden-lg shadow-2xl overflow-hidden',
  },
  header: {
    class: 'bg-primary-900 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title:   { class: 'text-base' },
  pcCloseButton: {
    root: { class: 'inline-flex items-center justify-center p-1 rounded hover:bg-primary-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white' },
  },
  content: {
    class: 'p-6 text-neutral-700 dark:text-neutral-200 text-base leading-relaxed font-display',
  },
  footer: {
    class: 'bg-neutral-50 dark:bg-neutral-800 p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700',
  },
  mask: { class: 'bg-neutral-900/50 backdrop-blur-sm' },
} satisfies DialogPassThroughOptions;

// p-confirmdialog passes its entire pt object to the inner p-dialog via [pt]="pt",
// so this object must match DialogPassThroughOptions, not ConfirmDialogPassThroughOptions.
// The PrimeNG type for ConfirmDialogPassThroughOptions.root (= DialogPassThrough) is a
// typing mismatch — at runtime root expects a flat { class } PassThroughOption.
export const FloraConfirmDialogPT: DialogPassThroughOptions & {
  pcAcceptButton?: { root?: { class: string } };
  pcRejectButton?: { root?: { class: string } };
} = {
  root: {
    class: 'max-w-sm w-full bg-white dark:bg-neutral-900 rounded-garden-lg shadow-2xl overflow-hidden border border-neutral-100 dark:border-neutral-700',
  },
  header: {
    class: 'bg-danger-500 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title:   { class: 'text-base' },
  content: {
    class: 'p-6 text-neutral-700 dark:text-neutral-200 text-sm leading-relaxed font-display',
  },
  footer:  { class: 'p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700' },
  pcAcceptButton: {
    root: {
      class: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-garden-sm bg-danger-500 text-white hover:bg-danger-700 transition-colors duration-150',
    },
  },
  pcRejectButton: {
    root: {
      class: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-garden-sm bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-150',
    },
  },
  mask: { class: 'bg-neutral-900/50 backdrop-blur-sm' },
};
