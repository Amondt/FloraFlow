import type { CheckboxPassThroughOptions } from 'primeng/checkbox';
import type { RadioButtonPassThroughOptions } from 'primeng/radiobutton';
import type { ToggleSwitchPassThroughOptions } from 'primeng/toggleswitch';
import { FLORA_FOCUS } from './states.pt';

export const FloraCheckboxPT = {
  root:  { class: 'inline-flex items-center gap-2 cursor-pointer' },
  box:   {
    class: [
      'w-4 h-4 flex items-center justify-center rounded-garden-sm border-2',
      'border-neutral-300 dark:border-neutral-600',
      'bg-white dark:bg-neutral-800',
      'transition-colors duration-150',
      'peer-checked:bg-primary-500 peer-checked:border-primary-500',
      FLORA_FOCUS,
    ].join(' '),
  },
  icon:  { class: 'text-white text-xs' },
} satisfies CheckboxPassThroughOptions;

export const FloraRadioButtonPT = {
  root:  { class: 'inline-flex items-center gap-2 cursor-pointer' },
  box:   {
    class: [
      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
      'border-neutral-300 dark:border-neutral-600',
      'bg-white dark:bg-neutral-800',
      'transition-colors duration-150',
      FLORA_FOCUS,
    ].join(' '),
  },
  icon:  { class: 'w-2 h-2 rounded-full bg-primary-500' },
} satisfies RadioButtonPassThroughOptions;

export const FloraToggleSwitchPT = {
  root: {
    class: [
      'relative inline-flex w-10 h-6 rounded-full cursor-pointer transition-colors duration-200',
      FLORA_FOCUS,
      'bg-neutral-300 dark:bg-neutral-600',
    ].join(' '),
  },
  input: {
    class: 'absolute inset-0 w-full h-full opacity-0 appearance-none cursor-pointer m-0',
  },
  slider: {
    class: [
      'absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
      'translate-x-0',
    ].join(' '),
  },
} satisfies ToggleSwitchPassThroughOptions;
