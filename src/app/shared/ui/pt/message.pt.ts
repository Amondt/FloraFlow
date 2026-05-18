import type { MessagePassThroughOptions } from 'primeng/types/message';

export const FloraMessagePT = {
  root: ({ props = {} }: { props?: { severity?: string } } = {}) => ({
    class: [
      'flex items-center gap-3 px-4 py-3 rounded-garden-md text-sm font-display border',
      {
        'bg-primary-50 border-primary-500 text-primary-900 dark:bg-primary-900/20 dark:text-primary-200': props.severity === 'info' || !props.severity,
        'bg-green-50 border-success-500 text-green-900 dark:bg-green-900/20 dark:text-green-200': props.severity === 'success',
        'bg-yellow-50 border-warning-500 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200': props.severity === 'warn',
        'bg-red-50 border-danger-500 text-red-900 dark:bg-red-900/20 dark:text-red-200': props.severity === 'error',
      },
    ],
  }),
  icon:         { class: 'flex-shrink-0 text-base' },
  text:         { class: 'flex-1' },
  closeButton:  { class: 'ml-auto p-1 rounded hover:bg-black/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500' },
} satisfies MessagePassThroughOptions;
