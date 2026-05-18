import type { ProgressSpinnerPassThroughOptions } from 'primeng/types/progressspinner';

export const FloraProgressSpinnerPT = {
  root: { class: 'flex items-center justify-center' },
  spin: { class: 'w-8 h-8 animate-spin text-primary-500' },
} satisfies ProgressSpinnerPassThroughOptions;
