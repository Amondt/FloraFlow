import { FLORA_FOCUS } from './states.pt';

// PrimeNG v21 Slider has no exported PassThrough type interface.
export const FloraSliderPT = {
  root: {
    class:
      'relative block h-1 w-full bg-neutral-200 dark:bg-neutral-700 rounded-full select-none cursor-pointer',
  },
  range: {
    class: 'absolute h-full bg-primary-500 rounded-full',
  },
  // Touch hit area: visual dot grows from 16 px → 24 px on coarse-pointer (touch) devices.
  handle: {
    class: `absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-coarse:w-6 pointer-coarse:h-6 bg-white dark:bg-neutral-800 border-2 border-primary-500 rounded-full shadow-sm cursor-pointer cursor-grab active:cursor-grabbing ${FLORA_FOCUS}`,
  },
  startHandler: {
    class: `absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-coarse:w-6 pointer-coarse:h-6 bg-white dark:bg-neutral-800 border-2 border-primary-500 rounded-full shadow-sm cursor-pointer cursor-grab active:cursor-grabbing ${FLORA_FOCUS}`,
  },
  endHandler: {
    class: `absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 pointer-coarse:w-6 pointer-coarse:h-6 bg-white dark:bg-neutral-800 border-2 border-primary-500 rounded-full shadow-sm cursor-pointer cursor-grab active:cursor-grabbing ${FLORA_FOCUS}`,
  },
};
