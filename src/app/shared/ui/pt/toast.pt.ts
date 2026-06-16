import type { ToastPassThroughOptions } from 'primeng/toast';

export const FloraToastPT = {
  root: {
    class:
      'z-50 flex flex-col gap-2 max-w-sm w-full max-md:max-w-[calc(100vw_-_1rem)] max-md:!right-2',
  },
  message: ({ instance }: { instance?: { message?: { severity?: string | null } } } = {}) => ({
    class: [
      'flex items-start gap-3 p-4 rounded-garden-md shadow-lg border font-display text-sm',
      {
        'bg-white dark:bg-neutral-800 border-success-500 text-neutral-800 dark:text-neutral-100':
          instance?.message?.severity === 'success',
        'bg-white dark:bg-neutral-800 border-danger-500 text-neutral-800 dark:text-neutral-100':
          instance?.message?.severity === 'error',
        'bg-white dark:bg-neutral-800 border-warning-500 text-neutral-800 dark:text-neutral-100':
          instance?.message?.severity === 'warn',
        'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100':
          !instance?.message?.severity || instance.message.severity === 'info',
      },
    ],
  }),
  messageContent: { class: 'flex items-start gap-3 flex-1' },
  messageIcon: { class: 'mt-0.5 text-base flex-shrink-0' },
  messageText: { class: 'flex flex-col gap-0.5 flex-1' },
  summary: { class: 'font-semibold text-sm' },
  detail: { class: 'text-xs text-neutral-500 dark:text-neutral-400' },
  closeButton: {
    class:
      'ml-auto p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-400 outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
  },
} satisfies ToastPassThroughOptions;
