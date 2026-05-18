import type { ButtonPassThroughOptions } from 'primeng/button';
import { FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER } from './states.pt';

export const FloraButtonPT = {
  root: ({ instance }: { instance?: { severity?: string | null; outlined?: boolean; text?: boolean; variant?: string; loading?: boolean } } = {}) => ({
    class: [
      'inline-flex items-center justify-center gap-2',
      'px-4 py-2 text-sm font-semibold font-display rounded-garden-sm',
      FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER,
      {
        'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700':
          !instance?.outlined && instance?.variant !== 'outlined' && !instance?.text && instance?.variant !== 'text' &&
          (!instance?.severity || instance.severity === 'primary'),
        'bg-danger-500 text-white hover:bg-danger-700':
          !instance?.outlined && instance?.variant !== 'outlined' && !instance?.text && instance?.variant !== 'text' &&
          instance?.severity === 'danger',
        'bg-neutral-600 text-white hover:bg-neutral-700':
          !instance?.outlined && instance?.variant !== 'outlined' && !instance?.text && instance?.variant !== 'text' &&
          instance?.severity === 'secondary',
        'bg-transparent border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20':
          instance?.outlined || instance?.variant === 'outlined',
        'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2':
          (instance?.text || instance?.variant === 'text') && instance?.severity !== 'danger',
        'bg-transparent text-danger-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2':
          (instance?.text || instance?.variant === 'text') && instance?.severity === 'danger',
      },
    ],
  }),
  label: { class: 'leading-none' },
  icon:  { class: 'text-base leading-none' },
  loadingIcon: { class: 'animate-spin text-base leading-none' },
} satisfies ButtonPassThroughOptions;
