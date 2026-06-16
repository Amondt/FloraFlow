import type { SelectPassThroughOptions } from 'primeng/select';
import type { MultiSelectPassThroughOptions } from 'primeng/multiselect';
import { FLORA_DISABLED, FLORA_FOCUS, FLORA_HOVER } from './states.pt';

export const FloraSelectPT = {
  root: {
    class: [
      // h-control locks height to the same token as p-button (2.375rem = 38px).
      // justify-between pushes the chevron to the far right regardless of PrimeNG's
      // flex: 1 1 auto / width: 1% injected on .p-select-label.
      'w-full flex items-center justify-between px-3 h-control text-sm font-display',
      'bg-white dark:bg-neutral-800',
      'text-neutral-900 dark:text-neutral-100',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'outline-none',
      FLORA_FOCUS,
      `cursor-pointer ${FLORA_HOVER}`,
    ].join(' '),
  },
  label: { class: 'flex-1 truncate outline-none' },
  // pl-2 provides the gap between text and chevron; no ml-auto needed with justify-between
  dropdown: { class: 'flex items-center shrink-0 pl-2 text-neutral-400' },
  pcOverlay: {
    root: {
      class:
        'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 overflow-hidden',
    },
  },
  listContainer: { class: 'max-h-64 overflow-y-auto' },
  list: { class: 'py-1' },
  option: ({ context = { selected: false } }: { context?: { selected: boolean } } = {}) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer font-display',
      'text-neutral-700 dark:text-neutral-200',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium':
          context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
  optionGroup: {
    class:
      'sticky top-0 z-10 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 first:border-t-0',
  },
} satisfies SelectPassThroughOptions;

// Ghost variant — used in page-header filter controls (e.g. journal plant filter).
// No border or background; auto-width; overlay panel minimum width of 14 rem.
export const FloraSelectGhostPT = {
  root: {
    class: [
      'inline-flex items-center gap-1 cursor-pointer',
      'px-2 py-1 text-sm font-medium font-display',
      'bg-transparent text-neutral-600 dark:text-neutral-300',
      'hover:text-neutral-900 dark:hover:text-neutral-100',
      'rounded',
      FLORA_FOCUS,
      FLORA_DISABLED,
      FLORA_HOVER,
    ].join(' '),
  },
  label: { class: 'max-w-40 truncate outline-none' },
  dropdown: { class: 'flex items-center shrink-0 text-neutral-400 dark:text-neutral-500' },
  pcOverlay: {
    root: {
      class: [
        'mt-1 min-w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 overflow-hidden',
        // Mobile bottom sheet: override PrimeNG's inline absolute positioning with !important
        // utilities so the panel anchors full-width to the bottom of the screen (thumb-reachable).
        'max-md:!fixed max-md:!inset-x-0 max-md:!left-0 max-md:!right-0 max-md:!top-auto max-md:!bottom-0',
        'max-md:!min-w-0 max-md:!w-full max-md:!max-w-none max-md:!mt-0',
        'max-md:rounded-b-none max-md:rounded-t-garden-lg max-md:border-x-0 max-md:border-b-0 max-md:shadow-2xl max-md:pb-safe',
        'max-md:animate-[flora-sheet-up_0.22s_ease-out]',
      ].join(' '),
    },
  },
  // flora-select-sheet-list is a marker class (not a Tailwind utility) so plant-select.ts can
  // reset scrollTop to 0 on open — see onPanelShow() there for why that's needed.
  listContainer: { class: 'flora-select-sheet-list max-h-64 overflow-y-auto max-md:max-h-[60vh]' },
  // No vertical padding here — the sticky optionGroup header (top-0) must sit flush against
  // the listContainer's own top edge. A py-1 here would leave a borderless gap above the
  // header where the previous group's last row, still in normal flow just above the sticky
  // point, peeks through. First/last option padding below makes up the lost breathing room.
  list: { class: '' },
  option: ({ context = { selected: false } }: { context?: { selected: boolean } } = {}) => ({
    class: [
      // pointer-coarse:py-3 lifts touch rows to the 44px floor; desktop stays compact.
      // first:mt-1 last:mb-1 replaces the old list-level py-1 without leaving a gap above
      // the sticky group header (see the `list` slot comment).
      'px-3 py-2 pointer-coarse:py-3 first:mt-1 last:mb-1 text-sm cursor-pointer font-display',
      'text-neutral-700 dark:text-neutral-200',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium':
          context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
  optionGroup: {
    class:
      'sticky top-0 z-10 bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 first:border-t-0',
  },
} satisfies SelectPassThroughOptions;

export const FloraMultiSelectPT = {
  root: {
    class: [
      'w-full flex items-center justify-between px-3 h-control text-sm font-display cursor-pointer',
      'bg-white dark:bg-neutral-800',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'outline-none',
      FLORA_FOCUS,
      FLORA_DISABLED,
    ].join(' '),
  },
  label: { class: 'flex-1 truncate outline-none text-neutral-900 dark:text-neutral-100' },
  dropdown: { class: 'flex items-center shrink-0 pl-2 text-neutral-400' },
  overlay: {
    class:
      'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 overflow-hidden',
  },
  header: {
    class: 'px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2',
  },
  list: { class: 'py-1 max-h-60 overflow-auto' },
  option: ({ context = { selected: false } }: { context?: { selected: boolean } } = {}) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer flex items-center gap-2 font-display',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30': context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
  chipItem: {
    class:
      'inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 rounded-full',
  },
} satisfies MultiSelectPassThroughOptions;
