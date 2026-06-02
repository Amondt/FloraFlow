import type { ButtonPassThroughOptions } from 'primeng/button';
import { FLORA_DISABLED, FLORA_HOVER } from './states.pt';

export const FloraButtonPT = {
  root: ({
    instance,
  }: {
    instance?: {
      severity?: string | null;
      outlined?: boolean;
      text?: boolean;
      variant?: string;
      loading?: boolean;
    };
  } = {}) => {
    const isSolid =
      !instance?.outlined &&
      instance?.variant !== 'outlined' &&
      !instance?.text &&
      instance?.variant !== 'text';
    const isOutlined = instance?.outlined || instance?.variant === 'outlined';
    const isText = instance?.text || instance?.variant === 'text';

    return {
      class: [
        'inline-flex items-center justify-center gap-2 cursor-pointer h-control',
        'px-4 text-sm font-semibold font-display rounded-garden-sm',
        'outline-none',
        FLORA_DISABLED,
        FLORA_HOVER,
        {
          // Solid primary — primary-500 ring matches the app's standard focus ring
          'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2':
            isSolid && (!instance?.severity || instance.severity === 'primary'),

          // Solid danger
          'bg-danger-500 text-white hover:bg-danger-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2':
            isSolid && instance?.severity === 'danger',

          // Solid secondary
          'bg-neutral-600 text-white hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2':
            isSolid && instance?.severity === 'secondary',

          // Outlined — standard green ring (transparent bg, green border)
          'bg-transparent border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2':
            isOutlined,

          // Text — standard green ring (no background)
          'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2':
            isText && instance?.severity !== 'danger',

          'bg-transparent text-danger-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2':
            isText && instance?.severity === 'danger',
        },
      ],
    };
  },
  label: { class: 'leading-none' },
  icon: { class: 'text-base leading-none' },
  loadingIcon: { class: 'animate-spin text-base leading-none' },
} satisfies ButtonPassThroughOptions;
