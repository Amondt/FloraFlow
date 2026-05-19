# `docs/DESIGN_SYSTEM.md` - Design System & Component Customization Tokens

Single source of truth for all visual and accessibility decisions. **The Visualizer** must read this file before any template or style work.

| Section | Marker | Contents |
|---|---|---|
| §1 | `## 1.` | Tailwind CSS v4 `@theme` tokens |
| §2 | `## 2.` | State constants (`FLORA_FOCUS`, `FLORA_ERROR`, etc.) |
| §3 | `## 3.` | PrimeNG PT rules — v21 slot names, import paths, function context |
| §4 | `## 4.` | WCAG / ARIA compliance checklist |
| §5 | `## 5.` | Form anatomy — canonical HTML structure |
| §6 | `## 6.` | Page & layout conventions |

---

## 1. Tailwind CSS v4 Global Configuration

All tokens live in `src/styles.input.css` under `@theme` and compile into `src/styles.css`. **Never edit `src/styles.css` directly** — it is overwritten on every CLI run.

> **CSS workflow:** Run `bun run tw:watch` alongside `ng serve`. The Tailwind CLI watches `.ts` and `.html` files and regenerates `src/styles.css` on every class change. Angular's PostCSS pipeline does not do this.

```css
/* src/styles.input.css */
@import "tailwindcss";

@theme {
  --color-primary-50:  #f0fdf4;
  --color-primary-500: #10b981;
  --color-primary-600: #059669;
  --color-primary-700: #047857;
  --color-primary-900: #064e3b;

  --color-success-500: #22c55e;
  --color-warning-500: #d97706;
  --color-danger-500:  #ef4444;
  --color-danger-700:  #b91c1c;

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

Five named constants in `src/app/shared/ui/pt/states.pt.ts`. Every interactive PT slot **must** compose from these — never hardcode focus rings, disabled opacity, or error borders.

```ts
export const FLORA_FOCUS    = 'outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2';
export const FLORA_HOVER    = 'transition-colors duration-150';
export const FLORA_DISABLED = 'disabled:opacity-50 disabled:cursor-not-allowed';
export const FLORA_ERROR    = 'border-danger-500 focus-visible:ring-danger-500';
export const FLORA_SKELETON = 'animate-[flora-skeleton_1.5s_ease-in-out_infinite] bg-neutral-200 dark:bg-neutral-700 rounded-garden-sm';
```

**Usage:** compose in PT class strings via template literals:
```ts
root: { class: `${FLORA_FOCUS} ${FLORA_DISABLED} px-4 py-2 rounded-garden-sm ...` }
```

---

## 3. PrimeNG PassThrough (PT) Component Library

### 3.1 PrimeNG v21 PT Rules

**`unstyled: true` is required** in `app.config.ts`:
```ts
providePrimeNG({ ripple: false, unstyled: true })
```

**Renamed slots in v21** — old names cause TypeScript errors with `satisfies`:

| Old name (< v21) | New name (v21+) | Applies to |
|---|---|---|
| `chooseButton` | `pcChooseButton` | FileUpload |
| `uploadButton` | `pcUploadButton` | FileUpload |
| `cancelButton` | `pcCancelButton` | FileUpload |
| `closeButton` | `pcCloseButton` | Dialog, Toast |
| `acceptButton` | `pcAcceptButton` | ConfirmDialog |
| `rejectButton` | `pcRejectButton` | ConfirmDialog |
| `previousButton` | `pcPrevButton` | DatePicker |
| `nextButton` | `pcNextButton` | DatePicker |
| `toggler` | `pcToggleButton` | Panel |
| `input` (nested) | `pcInputText` (nested) | InputNumber, DatePicker |
| `item` | `option` | Select, MultiSelect |
| `overlay` (flat) | `pcOverlay: { root: {...} }` | Select, MultiSelect |
| `filterContainer` | *(removed — omit)* | MultiSelect |
| `itemCheckbox` / `token` / `removeTokenIcon` | *(removed — omit)* | MultiSelect |

**`AccordionPT` and `TabsPT`** only expose `root` (and `motion` for Accordion). Do not add `nav`, `tab`, `header`, `content`, `panels`, `panel`, `headerTitle`.

**`ConfirmDialogPT.root` nesting:** must be `root: { root: { class: '...' } }`.

**Import paths in v21:**
```ts
import type { ButtonPassThroughOptions }          from 'primeng/button';           // direct
import type { DialogPassThroughOptions }          from 'primeng/dialog';           // direct
import type { ConfirmDialogPassThroughOptions }   from 'primeng/confirmdialog';    // direct
import type { FileUploadPassThroughOptions }      from 'primeng/fileupload';       // direct
import type { InputTextPassThroughOptions }       from 'primeng/types/inputtext';  // types/
import type { InputNumberPassThroughOptions }     from 'primeng/types/inputnumber';
import type { TextareaPassThroughOptions }        from 'primeng/types/textarea';
import type { SelectPassThroughOptions }          from 'primeng/types/select';
import type { MultiSelectPassThroughOptions }     from 'primeng/types/multiselect';
import type { CheckboxPassThroughOptions }        from 'primeng/types/checkbox';
import type { RadioButtonPassThroughOptions }     from 'primeng/types/radiobutton';
import type { ToggleSwitchPassThroughOptions }    from 'primeng/types/toggleswitch';
import type { DatePickerPassThroughOptions }      from 'primeng/types/datepicker';
import type { MessagePassThroughOptions }         from 'primeng/types/message';
import type { TabsPassThroughOptions }            from 'primeng/types/tabs';
import type { SkeletonPassThroughOptions }        from 'primeng/types/skeleton';
import type { ProgressSpinnerPassThroughOptions } from 'primeng/types/progressspinner';
```

**PT function context — CRITICAL:** v21 passes `{ instance, parent }`, **not** `{ props, context, state }`. The old `{ props }` pattern silently returns an empty object — severity/variant branching is ignored.

| What you need | Correct accessor |
|---|---|
| Component input (severity, variant…) | `instance?.severity` |
| Per-item state (selected, focused…) | `({ context }) =>` — PrimeNG passes these as explicit extra params |
| Toast per-message severity | `instance?.message?.severity` |

```ts
// ✅ Correct — component-level input
root: ({ instance }: { instance?: { severity?: string | null; variant?: string } } = {}) => ({
  class: {
    'bg-primary-500 text-white': !instance?.severity || instance.severity === 'primary',
    'bg-danger-500 text-white':   instance?.severity === 'danger',
  },
}),

// ✅ Correct — per-item context (Select, DatePicker)
option: ({ context }: { context?: { selected?: boolean } } = {}) => ({
  class: { 'bg-primary-50': context?.selected },
}),

// ❌ BROKEN — props is never in v21 context
root: ({ props = {} }: { props?: { severity?: string } } = {}) => ({
  class: { 'bg-danger-500': props.severity === 'danger' }, // never fires
}),
```

**PT debugging rule:** Copy the function signature from an already-working PT file. `badge.pt.ts` is the canonical reference for `{ instance }`. `select.pt.ts` is the canonical reference for `{ context }`.

### 3.2 PT File Organization

All PT objects live in `src/app/shared/ui/pt/`. **Read source files directly** — the implementations are not duplicated here.

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
├── badge.pt.ts         ← FloraTagPT, FloraChipPT  ← canonical { instance } reference
├── skeleton.pt.ts      ← FloraSkeletonPT
├── progress.pt.ts      ← FloraProgressSpinnerPT
└── menu.pt.ts          ← FloraMenuPT
```

Every PT object uses `satisfies` for compile-time type safety. Every interactive slot must compose `FLORA_FOCUS` and `FLORA_DISABLED`.

---

## 4. WCAG 2.1 AA Compliance Checklist

FloraFlow targets **WCAG 2.1 Level AA**. Validate every template before marking a task complete.

### Perceivable
- **1.1.1** All `<img>` have `[alt]`. Decorative icons: `aria-hidden="true"`.
- **1.3.1** One `<main>` per page. `<nav aria-label="Main navigation">`. `<section aria-label="…">`. `<article>` for cards. No `<div>` as structural element.
- **1.3.5** Login inputs: `autocomplete="email"` / `autocomplete="current-password"`.
- **1.4.3** Normal text ≥ 4.5:1; large text ≥ 3:1.

| Token pair | Ratio | OK for |
|---|---|---|
| `neutral-900` on `white` | 19.5:1 ✅ | Body text |
| `neutral-700` on `neutral-100` | 7.5:1 ✅ | Card content |
| `primary-600` on `white` | 4.6:1 ✅ | Outlined button text |
| `neutral-500` on `white` | 4.5:1 ✅ | Placeholder (minimum — do not go lighter) |
| `white` on `primary-500` | 3.1:1 ⚠️ | Large/bold button labels only |
| `white` on `primary-900` | 15.8:1 ✅ | Dialog headers |

- **1.4.4** Font sizes in `rem` only — never `px`.
- **1.4.11** Input/checkbox/radio borders: `neutral-400` minimum (2.9:1 on white).
- **1.4.13** Popover panels must not disappear when pointer moves from trigger to panel.

### Operable
- **2.1.1** All actions keyboard-reachable: Tab, Enter/Space, Arrow keys in selects, Escape closes dialogs.
- **2.4.3** DOM order matches visual order. No `tabindex > 0`.
- **2.4.7** `FLORA_FOCUS` on every interactive PT slot. Never `outline-none` without `focus-visible:ring-*`.
- **2.5.3** `ariaLabel` must contain the visible label text (e.g., `"Save plant to greenhouse"` not `"Submit"`).

### Understandable
- **3.1.1** `<html lang="en">` in `index.html`.
- **3.2.2** Dropdowns must not navigate or submit on `change` alone.
- **3.3.1** Validation errors: red border (`FLORA_ERROR`) + text `<small>` + `aria-invalid="true"` + `aria-describedby`.
- **3.3.2** Every input has a visible `<label>` linked via `[for]`/`[id]`. Placeholder is never a substitute.
- **3.3.4** All destructive actions require `p-confirmdialog` confirmation.

### Robust
- **4.1.2** Icon-only buttons require `[ariaLabel]`.
- **4.1.3** `p-toast` handles ARIA live regions automatically. Dynamic counts: `aria-live="polite"`. Frost alerts: `role="alert"`.
- Loading: `[attr.aria-busy]="resource.isLoading()"` on the loading container.

---

## 5. Form Anatomy Rules

Every form field must follow this exact structure — no exceptions.

```html
<div class="flex flex-col gap-1.5">

  <label [for]="inputId"
    class="text-sm font-medium text-neutral-700 dark:text-neutral-200 font-display">
    Zone Name
    @if (isRequired) {
      <span aria-hidden="true" class="text-danger-500 ml-0.5">*</span>
      <span class="sr-only">(required)</span>
    }
  </label>

  <input pInputText [id]="inputId" [pt]="FloraInputTextPT"
    [class]="control.invalid && control.touched ? FLORA_ERROR : ''"
    [attr.aria-describedby]="control.invalid && control.touched ? inputId + '-error' : null"
    [attr.aria-invalid]="control.invalid && control.touched"
    [attr.aria-required]="isRequired ? true : null" />

  @if (control.invalid && control.touched) {
    <small [id]="inputId + '-error'" class="text-danger-500 text-xs font-display" role="alert">
      {{ errorMessage() }}
    </small>
  }

  @if (hintText) {
    <small [id]="inputId + '-hint'" class="text-neutral-400 text-xs font-display" role="note">
      {{ hintText }}
    </small>
  }

</div>
```

**Field ID rule:** `readonly inputId = \`flora-${crypto.randomUUID().slice(0, 8)}\`;`

**Required fields:** use both visible asterisk (`aria-hidden="true"`) + screen-reader text (`class="sr-only"`) + `[attr.aria-required]="true"`. Do not use native `required` — it triggers browser-native validation UI.

---

## 6. Page & Layout Conventions

### 6.1 Two-Layer Layout

```html
<!-- Layer 1: full-width shell (no max-w) -->
<app-topnav />
<router-outlet />

<!-- Layer 2: each feature's <main> -->
<main class="p-6 bg-neutral-50 dark:bg-neutral-900 min-h-screen" aria-labelledby="page-heading">
  <div class="max-w-5xl mx-auto">
    <!-- page content -->
  </div>
</main>
```

`max-w-5xl` (64 rem) constrains readable content. Never exceed `max-w-5xl`. Use `min-h-screen` not `h-screen`. Nav is outside `<main>` and never has `max-w-*`.

> **Phase 1 (pre-shell):** `app-topnav` does not yet exist. Each page's `<main>` renders directly in `<router-outlet>`.

### 6.2 Card List Layout

**Task / urgency lists** (scheduler, journal) — single-column:
```html
<ul class="flex flex-col gap-4" aria-label="…">
  @for (item of items(); track item.id) { <li><app-my-card [item]="item" /></li> }
</ul>
```

**Feature overview grids** (dashboard zones) — responsive grid:
```html
<ul class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4" aria-label="…">
  @for (item of items(); track item.id) { <li><app-my-card [item]="item" /></li> }
</ul>
```

### 6.3 Button Hierarchy in Card Footers

| Action type | Pattern |
|---|---|
| Primary workflow — opens modal | Full row/card clickable (`role="button"`) |
| Choice inside modal — symmetric | Native `<button>` styled as choice card |
| Card management — edit | Native `<button>` `text-xs font-medium text-neutral-500 hover:text-primary-600` |
| Card management — destructive | Native `<button>` `text-xs font-medium text-neutral-500 hover:text-danger-500` |
| Standalone form action | `<p-button [pt]="FloraButtonPT">` |

### 6.4 Skeleton vs Spinner

| Situation | Use |
|---|---|
| Async data fetch (cards, lists) | `<p-skeleton [pt]="FloraSkeletonPT">` |
| Brief wait < 2s (form submit) | `<p-progressspinner>` on the button only |
| Long operation > 10s | Progress bar with duration estimate |

`FLORA_SKELETON` is for PT class composition only — never apply directly in templates.

```html
<!-- ✅ Correct -->
<ul aria-label="Loading …">
  @for (_ of loadingPlaceholders; track $index) {
    <li aria-hidden="true"><p-skeleton height="8rem" [pt]="FloraSkeletonPT" /></li>
  }
</ul>
```

### 6.5 Inline Error Banners

Always use `<p-message severity="error" [pt]="FloraMessagePT">` — never a raw `<div>` with hardcoded error colors. Error text must be specific and actionable: "Failed to load zones — check your connection and refresh."

### 6.6 Empty States

Three required elements:
1. Why it's empty (one sentence)
2. Primary CTA button (label starts with a verb)
3. No decoration required

```html
<div class="flex flex-col items-center justify-center py-20 text-center" role="status">
  <p class="text-neutral-500 dark:text-neutral-400 font-display text-base">
    No zones yet. Add your first greenhouse zone to get started.
  </p>
  <p-button label="Add your first zone" variant="outlined" [pt]="FloraButtonPT"
    class="mt-4" ariaLabel="Add your first greenhouse zone" (onClick)="openCreateDialog()" />
</div>
```

### 6.7 Page Header Patterns

**Standard header** (management pages — dashboard zones):
```html
<header class="flex items-center justify-between mb-6">
  <h1 class="text-xs font-semibold uppercase tracking-widest font-display text-neutral-500">Your zones</h1>
  <button class="inline-flex items-center gap-1.5 text-sm font-medium font-display text-primary-600 …">
    <i class="pi pi-plus text-xs" aria-hidden="true"></i> New zone
  </button>
</header>
```

**Eyebrow header** (engine/task pages with live stats — scheduler):
```html
<header class="mb-8">
  <p class="text-xs font-semibold uppercase tracking-widest text-primary-600 font-display mb-1">Anti-Root-Rot Engine</p>
  <h1 class="text-3xl font-semibold font-display text-neutral-900 dark:text-white">Check scheduler</h1>
  <p class="text-sm text-neutral-500 font-display mt-1">3 need attention now · 7 due in the next 3 days</p>
</header>
```

Use eyebrow pattern for real-time data state pages. Use standard pattern for CRUD management pages.
