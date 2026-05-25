import type { FileUploadPassThroughOptions } from 'primeng/fileupload';
import { FLORA_FOCUS } from './states.pt';

export const FloraFileUploadPT = {
  root: { class: 'flex flex-col gap-3' },
  header: {
    class:
      'flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md',
  },
  content: {
    class:
      'border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-garden-md p-6 text-center text-sm text-neutral-500 dark:text-neutral-400',
  },
  pcChooseButton: {
    root: {
      class: [
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold font-display rounded-garden-sm',
        'bg-primary-500 text-white hover:bg-primary-600 transition-colors duration-150',
        FLORA_FOCUS,
      ].join(' '),
    },
  },
  pcUploadButton: {
    root: {
      class:
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold font-display rounded-garden-sm bg-neutral-600 text-white hover:bg-neutral-700 transition-colors duration-150',
    },
  },
  pcCancelButton: {
    root: {
      class:
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold font-display rounded-garden-sm bg-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-150',
    },
  },
} satisfies FileUploadPassThroughOptions;
