import type { MenuPassThroughOptions } from 'primeng/menu';
import { FLORA_FOCUS } from './states.pt';

export const FloraMenuPT = {
  root: {
    class:
      'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl py-1 min-w-40 font-display',
  },
  list: { class: 'flex flex-col' },
  item: { class: 'flex' },
  itemLink: {
    class: `flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors duration-100 w-full ${FLORA_FOCUS}`,
  },
  itemIcon: { class: 'text-base text-neutral-500 dark:text-neutral-400' },
  itemLabel: { class: '' },
  separator: { class: 'border-t border-neutral-100 dark:border-neutral-700 my-1' },
} satisfies MenuPassThroughOptions;
