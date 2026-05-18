import type { PanelPassThroughOptions } from 'primeng/panel';
import type { AccordionPassThroughOptions } from 'primeng/accordion';
import { FLORA_FOCUS } from './states.pt';

export const FloraPanelPT = {
  root:    { class: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md overflow-hidden' },
  header:  { class: 'flex items-center justify-between px-5 py-3 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700' },
  title:   { class: 'text-sm font-semibold text-neutral-800 dark:text-neutral-100 font-display' },
  content: { class: 'px-5 py-4 text-sm text-neutral-700 dark:text-neutral-200 font-display' },
  pcToggleButton: {
    root: { class: `p-1 rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${FLORA_FOCUS}` },
  },
} satisfies PanelPassThroughOptions;

export const FloraAccordionPT = {
  root: { class: 'flex flex-col gap-1' },
} satisfies AccordionPassThroughOptions;
