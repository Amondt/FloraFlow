export const TAB_BASE =
  'inline-flex items-center leading-none gap-1.5 px-3.5 py-2.5 text-[0.8125rem] font-semibold font-display border-b-2 -mb-px shrink-0 whitespace-nowrap cursor-pointer transition-colors duration-150 outline-none focus-visible:!border-primary-500 dark:focus-visible:!border-primary-400';
export const TAB_ACTIVE = 'border-primary-500 text-primary-700 dark:text-primary-400';
export const TAB_INACTIVE =
  'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200';
export const TAB_COUNT_ACTIVE =
  'leading-none font-mono text-[0.7rem] px-1.5 py-px rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400';
export const TAB_COUNT_INACTIVE =
  'leading-none font-mono text-[0.7rem] px-1.5 py-px rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500';

export function tabClass(active: boolean): string {
  return `${TAB_BASE} ${active ? TAB_ACTIVE : TAB_INACTIVE}`;
}

export function tabCountClass(active: boolean): string {
  return active ? TAB_COUNT_ACTIVE : TAB_COUNT_INACTIVE;
}
