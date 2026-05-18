# `docs/DESIGN_SYSTEM.md` - Design System & Component Customization Tokens

This document is the **single source of truth** for all visual and accessibility decisions in FloraFlow. **The Visualizer (Frontend Agent)** must read this file before producing any template or style. Overriding styles using inline CSS or undocumented Tailwind classes is strictly prohibited.

---

## 1. Tailwind CSS v4 Global Configuration

FloraFlow uses Tailwind CSS v4's CSS-first theme configuration. All tokens live in `src/styles.css` under `@theme`. Every class used in PT objects (`bg-primary-500`, `rounded-garden-md`, etc.) derives from these tokens — never from arbitrary values.

```css
/* src/styles.css — full token reference */
@import "tailwindcss";

@theme {
  --color-primary-50:  #f0fdf4;
  --color-primary-500: #10b981;
  --color-primary-600: #059669;   /* button hover */
  --color-primary-700: #047857;   /* button active/pressed */
  --color-primary-900: #064e3b;

  --color-success-500: #22c55e;
  --color-warning-500: #d97706;
  --color-danger-500:  #ef4444;
  --color-danger-700:  #b91c1c;   /* danger button hover */

  --color-neutral-50:  #f8fafc;
  --color-neutral-100: #f1f5f9;
  --color-neutral-200: #e2e8f0;
  --color-neutral-300: #cbd5e1;
  --color-neutral-400: #94a3b8;
  --color-neutral-500: #64748b;
  --color-neutral-600: #475569;
  --color-neutral-700: #334155;
  --color-neutral-800: #1e293b;
  --color-neutral-900: #0f172a;

  --font-display: "Inter", system-ui, sans-serif;

  --radius-garden-sm: 0.375rem;
  --radius-garden-md: 0.75rem;
  --radius-garden-lg: 1.25rem;
}

@variant dark (&:where(.dark, .dark *));

@keyframes flora-skeleton {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

---

## 2. Interaction State System

Five named constants live in `src/app/shared/ui/pt/states.pt.ts`. Every interactive PT slot **must** compose from these — never hardcode focus rings, disabled opacity, or error borders directly.

```ts
// src/app/shared/ui/pt/states.pt.ts

/** Standard focus ring — applied to every focusable element */
export const FLORA_FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2';

/** Smooth background transition for hover-sensitive surfaces */
export const FLORA_HOVER = 'transition-colors duration-150';

/** Disabled state — applied to the root slot of all interactive components */
export const FLORA_DISABLED = 'disabled:opacity-50 disabled:cursor-not-allowed';

/** Error field border — applied to input root when the bound control is invalid */
export const FLORA_ERROR = 'border-danger-500 focus-visible:ring-danger-500';

/** Loading skeleton shimmer — for Skeleton component and placeholder blocks */
export const FLORA_SKELETON =
  'animate-[flora-skeleton_1.5s_ease-in-out_infinite] bg-neutral-200 dark:bg-neutral-700 rounded-garden-sm';
```

### Usage pattern

In PT object class strings, compose from these constants via template literals or array joins:

```ts
root: {
  class: `${FLORA_FOCUS} ${FLORA_DISABLED} px-4 py-2 rounded-garden-sm ...`
}
```

---

## 3. PrimeNG PassThrough (PT) Component Library

### 3.1 File Organization

All PT objects live in `src/app/shared/ui/pt/`. Each file exports its objects and `index.ts` re-exports everything.

```
src/app/shared/ui/pt/
├── index.ts            ← barrel: re-exports all PT objects and state constants
├── states.pt.ts        ← FLORA_FOCUS / FLORA_DISABLED / FLORA_ERROR / FLORA_SKELETON
├── button.pt.ts        ← FloraButtonPT
├── card.pt.ts          ← FloraCardPT
├── dialog.pt.ts        ← FloraDialogPT, FloraConfirmDialogPT
├── datepicker.pt.ts    ← FloraDatePickerPT
├── input.pt.ts         ← FloraInputTextPT, FloraInputNumberPT, FloraTextareaPT
├── select.pt.ts        ← FloraSelectPT, FloraMultiSelectPT
├── checkbox.pt.ts      ← FloraCheckboxPT, FloraRadioButtonPT, FloraToggleSwitchPT
├── fileupload.pt.ts    ← FloraFileUploadPT
├── toast.pt.ts         ← FloraToastPT
├── message.pt.ts       ← FloraMessagePT, FloraInlineMessagePT
├── popover.pt.ts       ← FloraPopoverPT
├── panel.pt.ts         ← FloraPanelPT, FloraAccordionPT
├── tabs.pt.ts          ← FloraTabsPT
├── badge.pt.ts         ← FloraTagPT, FloraChipPT
├── skeleton.pt.ts      ← FloraSkeletonPT
├── progress.pt.ts      ← FloraProgressSpinnerPT
└── menu.pt.ts          ← FloraMenuPT
```

Every PT object uses `satisfies` for compile-time type safety. Every interactive slot must compose `FLORA_FOCUS` and `FLORA_DISABLED` from `states.pt.ts`.

---

### 3.2 Forms

---

#### `p-button` — FloraButtonPT

**Variant rule:** One PT object for all buttons. Visual variants are selected via PrimeNG props in templates — `severity`, `[outlined]`, `[text]`. The PT handles shape, font, focus, disabled, and color per severity. Never create separate PT objects per variant.

```ts
import type { ButtonPassThroughOptions } from 'primeng/button';
import { FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER } from './states.pt.ts';

export const FloraButtonPT = {
  root: ({ props }: { props: { severity?: string; outlined?: boolean; text?: boolean; variant?: string; loading?: boolean } }) => ({
    class: [
      // base shape & typography
      'inline-flex items-center justify-center gap-2',
      'px-4 py-2 text-sm font-semibold font-display rounded-garden-sm',
      FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER,
      // filled primary (default)
      {
        'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700':
          !props.outlined && props.variant !== 'outlined' && !props.text && props.variant !== 'text' &&
          (!props.severity || props.severity === 'primary'),
        // filled danger
        'bg-danger-500 text-white hover:bg-danger-700':
          !props.outlined && props.variant !== 'outlined' && !props.text && props.variant !== 'text' &&
          props.severity === 'danger',
        // filled secondary (neutral)
        'bg-neutral-600 text-white hover:bg-neutral-700':
          !props.outlined && props.variant !== 'outlined' && !props.text && props.variant !== 'text' &&
          props.severity === 'secondary',
        // outlined variant
        'bg-transparent border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20':
          props.outlined || props.variant === 'outlined',
        // ghost / text variant
        'bg-transparent text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2':
          props.text || props.variant === 'text',
      },
    ],
  }),
  label: { class: 'leading-none' },
  icon:  { class: 'text-base leading-none' },
  loadingIcon: { class: 'animate-spin text-base leading-none' },
} satisfies ButtonPassThroughOptions;
```

**Template reference:**

```html
<p-button label="Save plant"  [pt]="FloraButtonPT" />
<p-button label="Cancel"      [pt]="FloraButtonPT" variant="outlined" />
<p-button label="Delete zone" [pt]="FloraButtonPT" severity="danger" />
<p-button label="More"        [pt]="FloraButtonPT" variant="text" />
<p-button label="Saving…"     [pt]="FloraButtonPT" [loading]="true" />
```

---

#### `pInputText` — FloraInputTextPT

Used for all single-line text inputs (species search, zone name, notes title, etc.).

```ts
import type { InputTextPassThroughOptions } from 'primeng/inputtext';
import { FLORA_FOCUS, FLORA_DISABLED } from './states.pt.ts';

export const FloraInputTextPT = {
  root: {
    class: [
      'w-full px-3 py-2 text-sm font-display',
      'bg-white dark:bg-neutral-800',
      'text-neutral-900 dark:text-neutral-100',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'placeholder:text-neutral-400',
      FLORA_FOCUS, FLORA_DISABLED,
    ].join(' '),
  },
} satisfies InputTextPassThroughOptions;
```

**Error state:** Add `[class.border-danger-500]="control.invalid && control.touched"` to the element in the template (see Section 5 — Form Anatomy Rules).

---

#### `p-inputnumber` — FloraInputNumberPT

Used for: humidity percentage, pot volume, quantities.

```ts
import type { InputNumberPassThroughOptions } from 'primeng/inputnumber';
import { FLORA_FOCUS, FLORA_DISABLED } from './states.pt.ts';

export const FloraInputNumberPT = {
  root: { class: 'w-full flex rounded-garden-sm overflow-hidden border border-neutral-300 dark:border-neutral-600' },
  input: {
    root: {
      class: [
        'flex-1 px-3 py-2 text-sm font-display',
        'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
        'border-none outline-none',
        FLORA_FOCUS,
      ].join(' '),
    },
  },
  incrementButton: {
    root: {
      class: 'px-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors duration-150 border-l border-neutral-300 dark:border-neutral-600',
    },
  },
  decrementButton: {
    root: {
      class: 'px-2 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors duration-150 border-l border-neutral-300 dark:border-neutral-600',
    },
  },
} satisfies InputNumberPassThroughOptions;
```

---

#### `p-textarea` — FloraTextareaPT

Used for: journal notes, enrichment descriptions, optional location notes.

```ts
import type { TextareaPassThroughOptions } from 'primeng/textarea';
import { FLORA_FOCUS, FLORA_DISABLED } from './states.pt.ts';

export const FloraTextareaPT = {
  root: {
    class: [
      'w-full px-3 py-2 text-sm font-display resize-y min-h-24',
      'bg-white dark:bg-neutral-800',
      'text-neutral-900 dark:text-neutral-100',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      'placeholder:text-neutral-400',
      FLORA_FOCUS, FLORA_DISABLED,
    ].join(' '),
  },
} satisfies TextareaPassThroughOptions;
```

---

#### `p-select` — FloraSelectPT

Used for: window orientation, container type, substrate factor, zone selector, lifecycle type, watering frequency, sunlight requirements.

```ts
import type { SelectPassThroughOptions } from 'primeng/select';
import { FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER } from './states.pt.ts';

export const FloraSelectPT = {
  root: {
    class: [
      'w-full flex items-center gap-2 px-3 py-2 text-sm font-display cursor-pointer',
      'bg-white dark:bg-neutral-800',
      'text-neutral-900 dark:text-neutral-100',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER,
    ].join(' '),
  },
  label:   { class: 'flex-1 truncate' },
  dropdown: { class: 'text-neutral-400 text-xs ml-auto' },
  overlay: {
    class: 'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50',
  },
  list:    { class: 'py-1 max-h-60 overflow-auto' },
  item:    ({ context }: { context: { selected: boolean } }) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer font-display',
      'text-neutral-700 dark:text-neutral-200',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium': context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
} satisfies SelectPassThroughOptions;
```

---

#### `p-multiselect` — FloraMultiSelectPT

Used for: lifecycle type filter (annual / perennial / indoor / outdoor), toxicity filter.

```ts
import type { MultiSelectPassThroughOptions } from 'primeng/multiselect';
import { FLORA_FOCUS, FLORA_DISABLED, FLORA_HOVER } from './states.pt.ts';

export const FloraMultiSelectPT = {
  root: {
    class: [
      'w-full flex items-center gap-2 px-3 py-2 text-sm font-display cursor-pointer',
      'bg-white dark:bg-neutral-800',
      'border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
      FLORA_FOCUS, FLORA_DISABLED,
    ].join(' '),
  },
  label:    { class: 'flex-1 text-neutral-900 dark:text-neutral-100 truncate' },
  dropdown: { class: 'text-neutral-400 text-xs ml-auto' },
  overlay: {
    class: 'mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50',
  },
  header:   { class: 'px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2' },
  filterContainer: { class: 'flex-1' },
  list:     { class: 'py-1 max-h-60 overflow-auto' },
  item:     ({ context }: { context: { selected: boolean } }) => ({
    class: [
      'px-3 py-2 text-sm cursor-pointer flex items-center gap-2 font-display',
      FLORA_HOVER,
      {
        'bg-primary-50 dark:bg-primary-900/30': context.selected,
        'hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected,
      },
    ],
  }),
  itemCheckbox: { class: 'mr-1' },
  emptyMessage: { class: 'px-3 py-2 text-sm text-neutral-400 italic' },
  token: {
    class: 'inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 rounded-full',
  },
  removeTokenIcon: { class: 'text-xs cursor-pointer hover:text-danger-500 transition-colors' },
} satisfies MultiSelectPassThroughOptions;
```

---

#### `p-checkbox` — FloraCheckboxPT

Used for: boolean toggles in filter panels, confirmation checkboxes.

```ts
import type { CheckboxPassThroughOptions } from 'primeng/checkbox';
import { FLORA_FOCUS } from './states.pt.ts';

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
  label: { class: 'text-sm text-neutral-700 dark:text-neutral-200 font-display select-none' },
} satisfies CheckboxPassThroughOptions;
```

---

#### `p-radiobutton` — FloraRadioButtonPT

Used for: Smart Snooze duration selection (2 / 5 / 7 days), watering confirmation flow.

```ts
import type { RadioButtonPassThroughOptions } from 'primeng/radiobutton';
import { FLORA_FOCUS } from './states.pt.ts';

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
  label: { class: 'text-sm text-neutral-700 dark:text-neutral-200 font-display select-none' },
} satisfies RadioButtonPassThroughOptions;
```

---

#### `p-toggleswitch` — FloraToggleSwitchPT

Used for: grow light toggle, ventilation/heating toggle.

```ts
import type { ToggleSwitchPassThroughOptions } from 'primeng/toggleswitch';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraToggleSwitchPT = {
  root: ({ props }: { props: { modelValue?: boolean } }) => ({
    class: [
      'relative inline-flex w-10 h-6 rounded-full cursor-pointer transition-colors duration-200',
      FLORA_FOCUS,
      {
        'bg-primary-500': props.modelValue,
        'bg-neutral-300 dark:bg-neutral-600': !props.modelValue,
      },
    ],
  }),
  slider: ({ props }: { props: { modelValue?: boolean } }) => ({
    class: [
      'absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
      { 'translate-x-4': props.modelValue, 'translate-x-0': !props.modelValue },
    ],
  }),
} satisfies ToggleSwitchPassThroughOptions;
```

---

#### `p-fileupload` — FloraFileUploadPT

Used for: journal photo uploads, AI Plant Identifier image uploads. Client-side compression to <300KB is applied before the upload reaches the network (see `docs/APP_SPEC.md §4.2`).

```ts
import type { FileUploadPassThroughOptions } from 'primeng/fileupload';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraFileUploadPT = {
  root:     { class: 'flex flex-col gap-3' },
  header:   { class: 'flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md' },
  content:  {
    class: 'border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-garden-md p-6 text-center text-sm text-neutral-500 dark:text-neutral-400',
  },
  chooseButton: {
    root: {
      class: [
        'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold font-display rounded-garden-sm',
        'bg-primary-500 text-white hover:bg-primary-600 transition-colors duration-150',
        FLORA_FOCUS,
      ].join(' '),
    },
  },
  uploadButton: {
    root: {
      class: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold font-display rounded-garden-sm bg-neutral-600 text-white hover:bg-neutral-700 transition-colors duration-150',
    },
  },
  cancelButton: {
    root: {
      class: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold font-display rounded-garden-sm bg-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-150',
    },
  },
  progressbar: {
    root: { class: 'h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden mt-2' },
    value: { class: 'h-full bg-primary-500 transition-all duration-300' },
  },
} satisfies FileUploadPassThroughOptions;
```

---

### 3.3 Feedback

---

#### `p-datepicker` — FloraDatePickerPT

Used for: care log date, seed batch age, plant acquisition date.

```ts
import type { DatePickerPassThroughOptions } from 'primeng/datepicker';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraDatePickerPT = {
  root:  { class: 'w-full font-display text-sm' },
  input: {
    root: {
      class: [
        'w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-garden-sm',
        'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
        'placeholder:text-neutral-400',
        FLORA_FOCUS,
      ].join(' '),
    },
  },
  panel: {
    class: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl rounded-garden-md p-4 z-50',
  },
  header: {
    class: 'flex items-center justify-between mb-3 text-sm font-semibold text-neutral-700 dark:text-neutral-200',
  },
  previousButton: {
    root: { class: 'p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors' },
  },
  nextButton: {
    root: { class: 'p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors' },
  },
  title:     { class: 'font-semibold text-neutral-800 dark:text-neutral-100' },
  table:     { class: 'w-full text-sm' },
  tableHeaderCell: { class: 'text-center text-xs text-neutral-400 pb-1' },
  dayCell:   { class: 'text-center p-0.5' },
  day:       ({ context }: { context: { selected: boolean; today: boolean; disabled: boolean } }) => ({
    class: [
      'w-8 h-8 flex items-center justify-center rounded-full text-sm cursor-pointer transition-colors duration-100',
      {
        'bg-primary-500 text-white font-semibold': context.selected,
        'ring-1 ring-primary-500 text-primary-600 font-medium': context.today && !context.selected,
        'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.selected && !context.disabled,
        'text-neutral-300 dark:text-neutral-600 cursor-not-allowed': context.disabled,
      },
    ],
  }),
} satisfies DatePickerPassThroughOptions;
```

---

#### `p-dialog` — FloraDialogPT

The official wrapper for: soil-check confirmation ("Is the soil dry?"), add plant modal, zone edit modal.

```ts
import type { DialogPassThroughOptions } from 'primeng/dialog';

export const FloraDialogPT = {
  root: {
    class: 'max-w-md w-full bg-white dark:bg-neutral-900 rounded-garden-lg shadow-2xl overflow-hidden border border-neutral-100 dark:border-neutral-700',
  },
  header: {
    class: 'bg-primary-900 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title:   { class: 'text-base' },
  closeButton: {
    class: 'p-1 rounded hover:bg-primary-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white',
  },
  content: {
    class: 'p-6 text-neutral-700 dark:text-neutral-200 text-base leading-relaxed font-display',
  },
  footer: {
    class: 'bg-neutral-50 dark:bg-neutral-800 p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700',
  },
  mask: { class: 'bg-neutral-900/50 backdrop-blur-sm' },
} satisfies DialogPassThroughOptions;
```

---

#### `p-confirmdialog` — FloraConfirmDialogPT

Used for all destructive actions: delete plant, delete zone, clear seed batch.

```ts
import type { ConfirmDialogPassThroughOptions } from 'primeng/confirmdialog';

export const FloraConfirmDialogPT = {
  root: {
    class: 'max-w-sm w-full bg-white dark:bg-neutral-900 rounded-garden-lg shadow-2xl overflow-hidden border border-neutral-100 dark:border-neutral-700',
  },
  header: {
    class: 'bg-danger-500 p-4 flex items-center justify-between text-white font-semibold font-display',
  },
  title:   { class: 'text-base' },
  content: {
    class: 'p-6 text-neutral-700 dark:text-neutral-200 text-sm leading-relaxed font-display',
  },
  footer:  { class: 'p-4 flex justify-end gap-3 border-t border-neutral-100 dark:border-neutral-700' },
  acceptButton: {
    root: {
      class: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-garden-sm bg-danger-500 text-white hover:bg-danger-700 transition-colors duration-150',
    },
  },
  rejectButton: {
    root: {
      class: 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-garden-sm bg-transparent text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors duration-150',
    },
  },
  mask: { class: 'bg-neutral-900/50 backdrop-blur-sm' },
} satisfies ConfirmDialogPassThroughOptions;
```

---

#### `p-toast` — FloraToastPT

Used for all transient notifications: successful watering log, sync restored, upload error.

```ts
import type { ToastPassThroughOptions } from 'primeng/toast';

export const FloraToastPT = {
  root:    { class: 'fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full' },
  message: ({ props }: { props: { severity?: string } }) => ({
    class: [
      'flex items-start gap-3 p-4 rounded-garden-md shadow-lg border font-display text-sm',
      {
        'bg-white dark:bg-neutral-800 border-success-500 text-neutral-800 dark:text-neutral-100': props.severity === 'success',
        'bg-white dark:bg-neutral-800 border-danger-500 text-neutral-800 dark:text-neutral-100':  props.severity === 'error',
        'bg-white dark:bg-neutral-800 border-warning-500 text-neutral-800 dark:text-neutral-100': props.severity === 'warn',
        'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100': props.severity === 'info' || !props.severity,
      },
    ],
  }),
  messageContent: { class: 'flex items-start gap-3 flex-1' },
  messageIcon:    { class: 'mt-0.5 text-base flex-shrink-0' },
  messageText:    { class: 'flex flex-col gap-0.5 flex-1' },
  summary:        { class: 'font-semibold text-sm' },
  detail:         { class: 'text-xs text-neutral-500 dark:text-neutral-400' },
  closeButton:    { class: 'ml-auto p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-400 outline-none focus-visible:ring-2 focus-visible:ring-primary-500' },
} satisfies ToastPassThroughOptions;
```

---

#### `p-message` / `p-inlinemessage` — FloraMessagePT

Used for: static inline alerts (frost warnings, offline banner, incomplete data notice).

```ts
import type { MessagePassThroughOptions } from 'primeng/message';

export const FloraMessagePT = {
  root: ({ props }: { props: { severity?: string } }) => ({
    class: [
      'flex items-center gap-3 px-4 py-3 rounded-garden-md text-sm font-display border',
      {
        'bg-primary-50 border-primary-500 text-primary-900 dark:bg-primary-900/20 dark:text-primary-200': props.severity === 'info' || !props.severity,
        'bg-green-50 border-success-500 text-green-900 dark:bg-green-900/20 dark:text-green-200': props.severity === 'success',
        'bg-yellow-50 border-warning-500 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-200': props.severity === 'warn',
        'bg-red-50 border-danger-500 text-red-900 dark:bg-red-900/20 dark:text-red-200': props.severity === 'error',
      },
    ],
  }),
  icon:         { class: 'flex-shrink-0 text-base' },
  text:         { class: 'flex-1' },
  closeButton:  { class: 'ml-auto p-1 rounded hover:bg-black/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-500' },
} satisfies MessagePassThroughOptions;
```

---

#### `p-popover` — FloraPopoverPT

Used for: companion planting relationship tooltips, filter help text, overflow action menus.

```ts
import type { PopoverPassThroughOptions } from 'primeng/popover';

export const FloraPopoverPT = {
  root: {
    class: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl z-50 text-sm font-display',
  },
  content: { class: 'p-4 text-neutral-700 dark:text-neutral-200' },
} satisfies PopoverPassThroughOptions;
```

---

### 3.4 Layout & Display

---

#### `p-card` — FloraCardPT

Used for: greenhouse zone cards, plant overview cards, seed batch cards, detail panels.

```ts
import type { CardPassThroughOptions } from 'primeng/card';

export const FloraCardPT = {
  root: {
    class: 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 dark:border-neutral-700/50 rounded-garden-md p-5 shadow-sm transition-all duration-200 hover:shadow-md',
  },
  title: {
    class: 'text-lg font-semibold font-display text-neutral-900 dark:text-white mb-2',
  },
  subtitle: {
    class: 'text-xs text-neutral-500 dark:text-neutral-400 font-display mb-3',
  },
  content: {
    class: 'text-sm text-neutral-600 dark:text-neutral-300 antialiased font-display',
  },
  footer: {
    class: 'pt-4 mt-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-2',
  },
} satisfies CardPassThroughOptions;
```

---

#### `p-panel` — FloraPanelPT

Used for: collapsible microclimate settings, expandable filter sections.

```ts
import type { PanelPassThroughOptions } from 'primeng/panel';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraPanelPT = {
  root:    { class: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md overflow-hidden' },
  header:  { class: 'flex items-center justify-between px-5 py-3 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-700' },
  title:   { class: 'text-sm font-semibold text-neutral-800 dark:text-neutral-100 font-display' },
  content: { class: 'px-5 py-4 text-sm text-neutral-700 dark:text-neutral-200 font-display' },
  toggler: { class: `p-1 rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors ${FLORA_FOCUS}` },
} satisfies PanelPassThroughOptions;
```

---

#### `p-accordion` — FloraAccordionPT

Used for: journal log filtering by event type, library filter groups.

```ts
import type { AccordionPassThroughOptions } from 'primeng/accordion';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraAccordionPT = {
  root:        { class: 'flex flex-col gap-1' },
  header:      ({ context }: { context: { active: boolean } }) => ({
    class: [
      'flex items-center justify-between px-4 py-3 cursor-pointer rounded-garden-sm',
      'text-sm font-semibold font-display transition-colors duration-150',
      FLORA_FOCUS,
      {
        'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300': context.active,
        'bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700': !context.active,
      },
    ],
  }),
  headerTitle: { class: 'flex-1' },
  content:     { class: 'px-4 py-3 text-sm text-neutral-700 dark:text-neutral-200 font-display border-t border-neutral-100 dark:border-neutral-700' },
} satisfies AccordionPassThroughOptions;
```

---

#### `p-tabs` — FloraTabsPT

Used for: journal event-type tabs (Observation / Pruning / Repotting / Fertilization / Pest Treatment), vault lifecycle view.

```ts
import type { TabsPassThroughOptions } from 'primeng/tabs';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraTabsPT = {
  root:   { class: 'flex flex-col' },
  nav:    { class: 'flex border-b border-neutral-200 dark:border-neutral-700 overflow-x-auto' },
  tab:    ({ context }: { context: { active: boolean } }) => ({
    class: [
      'px-4 py-2.5 text-sm font-medium font-display cursor-pointer whitespace-nowrap',
      'border-b-2 -mb-px transition-colors duration-150',
      FLORA_FOCUS,
      {
        'border-primary-500 text-primary-600 dark:text-primary-400': context.active,
        'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:border-neutral-300': !context.active,
      },
    ],
  }),
  panels: { class: 'pt-4' },
  panel:  { class: 'text-sm text-neutral-700 dark:text-neutral-200 font-display' },
} satisfies TabsPassThroughOptions;
```

---

#### `p-tag` — FloraTagPT

Used for: plant status badges (Overdue, Healthy, Needs Water), library characteristic chips.

```ts
import type { TagPassThroughOptions } from 'primeng/tag';

export const FloraTagPT = {
  root: ({ props }: { props: { severity?: string } }) => ({
    class: [
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium font-display',
      {
        'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300': props.severity === 'info' || !props.severity,
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300':         props.severity === 'success',
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300':     props.severity === 'warn',
        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300':                 props.severity === 'danger',
        'bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300':    props.severity === 'secondary',
      },
    ],
  }),
  icon:  { class: 'text-xs' },
  label: { class: '' },
} satisfies TagPassThroughOptions;
```

---

#### `p-chip` — FloraChipPT

Used for: selected filter tags in library, active zone labels.

```ts
import type { ChipPassThroughOptions } from 'primeng/chip';

export const FloraChipPT = {
  root:        { class: 'inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-full text-sm font-display' },
  label:       { class: 'leading-none' },
  icon:        { class: 'text-sm text-neutral-500' },
  removeIcon:  { class: 'text-xs text-neutral-400 cursor-pointer hover:text-danger-500 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-danger-500 rounded' },
} satisfies ChipPassThroughOptions;
```

---

#### `p-skeleton` — FloraSkeletonPT

Used as loading placeholder for plant cards, photo thumbnails, botanical detail panels. Powered by the `flora-skeleton` keyframe from `src/styles.css`.

```ts
import type { SkeletonPassThroughOptions } from 'primeng/skeleton';

export const FloraSkeletonPT = {
  root: {
    class: 'animate-[flora-skeleton_1.5s_ease-in-out_infinite] bg-neutral-200 dark:bg-neutral-700 rounded-garden-sm overflow-hidden',
  },
} satisfies SkeletonPassThroughOptions;
```

---

#### `p-progressspinner` — FloraProgressSpinnerPT

Used for: image upload progress indicator, AI enrichment processing state.

```ts
import type { ProgressSpinnerPassThroughOptions } from 'primeng/progressspinner';

export const FloraProgressSpinnerPT = {
  root: { class: 'flex items-center justify-center' },
  spin: { class: 'w-8 h-8 animate-spin text-primary-500' },
} satisfies ProgressSpinnerPassThroughOptions;
```

---

#### `p-menu` — FloraMenuPT

Used for: main navigation sidebar, plant card action overflow menus (Edit, Delete, View Journal).

```ts
import type { MenuPassThroughOptions } from 'primeng/menu';
import { FLORA_FOCUS } from './states.pt.ts';

export const FloraMenuPT = {
  root:      { class: 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-garden-md shadow-xl py-1 min-w-40 font-display' },
  list:      { class: 'flex flex-col' },
  item:      { class: 'flex' },
  itemLink:  {
    class: `flex items-center gap-3 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors duration-100 w-full ${FLORA_FOCUS}`,
  },
  itemIcon:  { class: 'text-base text-neutral-500 dark:text-neutral-400' },
  itemLabel: { class: '' },
  separator: { class: 'border-t border-neutral-100 dark:border-neutral-700 my-1' },
} satisfies MenuPassThroughOptions;
```

---

## 4. WCAG 2.1 AA Compliance Rules

FloraFlow targets **WCAG 2.1 Level AA** conformance. The Visualizer must validate each rule for every template before marking a task complete.

---

### 4.1 Perceivable

**1.1.1 — Non-text content:** All `<img>` elements and `p-image` components must have a `[alt]` binding.
- Plant thumbnails: `alt="{{ plant.commonName }} plant photo"`
- Decorative icons and `<i class="pi pi-*">`: add `aria-hidden="true"`
- AI diagnostic result images: include a text description of the findings alongside the image

**1.3.1 — Info and relationships:** Page structure uses semantic HTML. Every page has exactly one `<main>`. Navigation uses `<nav aria-label="Main navigation">`. Sections use `<section aria-label="…">`. Cards use `<article>`. No `<div>` may serve as a meaningful structural element.

**1.3.5 — Identify input purpose:** Login inputs must have explicit autocomplete attributes:
```html
<input pInputText autocomplete="email" />
<input pInputText type="password" autocomplete="current-password" />
```

**1.4.3 — Contrast (minimum):** Normal text ≥ 4.5:1 ratio; large text (≥18pt or 14pt bold) ≥ 3:1.

| Token pair | Ratio | Usage |
|---|---|---|
| `neutral-900` on `white` | 19.5:1 ✅ | Body text on white card |
| `neutral-700` on `neutral-100` | 7.5:1 ✅ | Card content on card background |
| `primary-600` on `white` | 4.6:1 ✅ | Outlined button text |
| `neutral-500` on `white` | 4.5:1 ✅ | Placeholder text (minimum — do not go lighter) |
| `white` on `primary-500` | 3.1:1 ⚠️ | Large/bold button labels only — not for body text |
| `white` on `primary-900` | 15.8:1 ✅ | Dialog headers |

**1.4.4 — Resize text:** All font sizes use `rem` units. Never use `px` for font-size declarations. The UI must remain usable at 200% browser zoom (test via Playwright).

**1.4.11 — Non-text contrast:** Interactive borders (input, checkbox, radio) must be ≥ 3:1 against their background. `neutral-300` (#cbd5e1) on `white` = 1.8:1 — this is acceptable for decorative borders but **inputs must use `neutral-400`** (#94a3b8 = 2.9:1) at minimum, or `neutral-500` for guaranteed compliance.

**1.4.13 — Content on hover/focus:** Popover and tooltip panels must not disappear when the pointer moves from the trigger to the panel content.

---

### 4.2 Operable

**2.1.1 — Keyboard:** Every user action must be reachable without a mouse: Tab shifts focus, Enter/Space activates buttons and checkboxes, Arrow keys navigate Select dropdowns, Escape closes dialogs and popovers.

**2.1.2 — No keyboard trap:** PrimeNG `p-dialog` and `p-confirmdialog` trap focus inside while open and restore it to the trigger on close. Verify this in Playwright keyboard tests.

**2.4.3 — Focus order:** DOM source order matches the visual reading order. Never use `tabindex` values above `0`.

**2.4.7 — Focus visible:** The `FLORA_FOCUS` constant (`focus-visible:ring-2 focus-visible:ring-primary-500`) must appear in every interactive PT slot. Never use `outline-none` without pairing it with `focus-visible:ring-*`.

**2.4.11 — Focus appearance (2.2 AA):** Focus indicators must be at least 2px wide and have 3:1 contrast against adjacent colors. `ring-primary-500` (#10b981) on white = 3.1:1 ✅.

**2.5.3 — Label in name:** When a button has an `ariaLabel`, it must contain the visible label text. Example: a button with label "Save" may have `ariaLabel="Save plant to greenhouse"` — not `ariaLabel="Submit"`.

---

### 4.3 Understandable

**3.1.1 — Language of page:** `index.html` must have `<html lang="en">`.

**3.2.2 — On input:** Form controls must not navigate, submit, or cause major page changes on `change` alone. Dropdowns and selects must require an explicit submit or confirmation action.

**3.3.1 — Error identification:** Validation errors must not rely on color alone. Pattern (see Section 5):
1. Red border (`FLORA_ERROR`)
2. Error icon (optional)
3. Text error message via `<small>` element
4. `aria-invalid="true"` on the input
5. `aria-describedby` linking input to the error text

**3.3.2 — Labels or instructions:** Every form input has a visible `<label>` element linked via `[for]` / `[id]`. Placeholder text alone is never a substitute for a label.

**3.3.4 — Error prevention (legal):** All destructive actions (delete plant, delete zone, clear seed vault entry) require a `p-confirmdialog` confirmation before executing. No undo mechanism is needed if the confirm step exists.

---

### 4.4 Robust

**4.1.2 — Name, role, value:** Every interactive element has a programmatically determinable name. Icon-only buttons require `[ariaLabel]`. PrimeNG components must receive the `ariaLabel` or `ariaLabelledBy` prop where applicable.

```html
<!-- Icon-only button — requires ariaLabel -->
<p-button icon="pi pi-camera" [pt]="FloraButtonPT" ariaLabel="Upload plant photo" />
```

**4.1.3 — Status messages:** Transient notifications must be announced to screen readers without receiving focus.
- `p-toast` with `severity="success"` or `severity="info"`: use `role="status"` (polite)
- `p-toast` with `severity="error"` or `severity="warn"`: use `role="alert"` (assertive)
- PrimeNG Toast handles this automatically; verify with a screen reader in Playwright tests

**Live regions for dynamic content:**
```html
<!-- Overdue task count — polite announcement -->
<span aria-live="polite" aria-atomic="true">{{ overdueCount() }} tasks overdue</span>

<!-- Frost alert banner — assertive, must interrupt -->
<div role="alert" aria-live="assertive" class="...">Frost warning active for outdoor zones</div>
```

**Loading states:** While `httpResource` is loading, add `aria-busy="true"` to the loading container:
```html
<section [attr.aria-busy]="plantsResource.isLoading()">
  @if (plantsResource.isLoading()) {
    <p-skeleton [pt]="FloraSkeletonPT" ... />
  }
</section>
```

---

## 5. Form Anatomy Rules

Every form field in FloraFlow must follow this exact HTML structure — no exceptions. This ensures consistent label association, error messaging, and ARIA compliance across all feature modules.

```html
<!-- Canonical FloraFlow form field -->
<div class="flex flex-col gap-1.5">

  <!-- Label: always visible, always linked via for/id -->
  <label
    [for]="inputId"
    class="text-sm font-medium text-neutral-700 dark:text-neutral-200 font-display"
  >
    Zone Name
    @if (isRequired) {
      <span aria-hidden="true" class="text-danger-500 ml-0.5">*</span>
      <span class="sr-only">(required)</span>
    }
  </label>

  <!-- Input: linked to label, PT injected, error state via class binding -->
  <input
    pInputText
    [id]="inputId"
    [pt]="FloraInputTextPT"
    [class]="control.invalid && control.touched ? FLORA_ERROR : ''"
    [attr.aria-describedby]="control.invalid && control.touched ? inputId + '-error' : null"
    [attr.aria-invalid]="control.invalid && control.touched"
    [attr.aria-required]="isRequired ? true : null"
  />

  <!-- Error: only rendered when invalid + touched, linked via id -->
  @if (control.invalid && control.touched) {
    <small
      [id]="inputId + '-error'"
      class="text-danger-500 text-xs font-display"
      role="alert"
    >
      {{ errorMessage() }}
    </small>
  }

  <!-- Optional hint text — always visible, not an error -->
  @if (hintText) {
    <small
      [id]="inputId + '-hint'"
      class="text-neutral-400 text-xs font-display"
      role="note"
    >
      {{ hintText }}
    </small>
  }

</div>
```

### Field ID rule

Every form field uses a deterministic unique ID generated as a class property:

```ts
readonly inputId = `flora-${crypto.randomUUID().slice(0, 8)}`;
```

### Required field marking

- Always mark required fields with both the visible asterisk (`aria-hidden="true"`) and the screen-reader text (`class="sr-only"`).
- Also set `[attr.aria-required]="true"` on the input element.
- Do not use the native `required` attribute alone — it generates browser-native validation UI that conflicts with our custom error display.
