import type { ButtonPassThroughOptions } from 'primeng/button';
import { FLORA_DISABLED, FLORA_FOCUS, FLORA_HOVER } from './states.pt';

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
        // Forest pill — rounded-full is the V4 button signature; focus ring composed
        // from FLORA_FOCUS (which carries outline-none) so no variant hardcodes a ring.
        'px-4 text-sm font-medium font-display rounded-full',
        FLORA_FOCUS,
        FLORA_DISABLED,
        FLORA_HOVER,
        {
          // Solid primary — deep forest fill, white label (~14:1 on primary-800)
          'bg-primary-800 text-white hover:bg-primary-900 active:bg-primary-900':
            isSolid && (!instance?.severity || instance.severity === 'primary'),

          // Solid danger
          'bg-danger-500 text-white hover:bg-danger-700':
            isSolid && instance?.severity === 'danger',

          // Solid secondary
          'bg-neutral-600 text-white hover:bg-neutral-700':
            isSolid && instance?.severity === 'secondary',

          // Ghost — hairline rule-strong border, neutral label; CTA forest pill stays solid
          'bg-transparent border border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800':
            isOutlined,

          // Text — neutral label, no background
          'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2':
            isText && instance?.severity !== 'danger',

          'bg-transparent text-danger-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2':
            isText && instance?.severity === 'danger',
        },
      ],
    };
  },
  label: { class: 'leading-none' },
  icon: { class: 'text-base leading-none' },
  loadingIcon: { class: 'animate-spin text-base leading-none' },
} satisfies ButtonPassThroughOptions;
