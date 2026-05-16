# `docs/DESIGN_SYSTEM.md` - Design System & Component Customization Tokens

This document establishes the visual foundation and user interface tokens for **FloraFlow**. To enforce strict separation of concerns, **The Visualizer (Frontend Agent)** must rely entirely on the tokens and rules declared here. Overriding styles using inline CSS attributes is strictly prohibited.

---

## 1. Tailwind CSS v4 Global Configuration

FloraFlow utilizes the Tailwind CSS v4 CSS-first theme configuration mechanism. Copy and maintain the following token architecture within the primary global stylesheet (`src/styles.css`):

    @import "tailwindcss";

    @theme {
      /* --- Semantic Palette --- */
      --color-primary-50: #f0fdf4;    /* Light Sage Accents */
      --color-primary-500: #10b981;   /* Emerald Baseline Leaf Green */
      --color-primary-900: #064e3b;   /* Deep Forest Branding Header */

      --color-warning-500: #d97706;   /* Terracotta Warning Accent */
      --color-danger-500: #ef4444;    /* Active Root Rot Alerts */

      --color-neutral-900: #0f172a;   /* Slate Deep Contrast Text */
      --color-neutral-100: #f1f5f9;   /* Slate Light Dashboard Card Background */

      /* --- Typography Spacing Scale --- */
      --font-display: "Inter", system-ui, sans-serif;

      /* --- Adaptive Border Radius Matrix --- */
      --radius-garden-sm: 0.375rem;
      --radius-garden-md: 0.75rem;   /* Soft dashboard container edges */
      --radius-garden-lg: 1.25rem;   /* Main organic grid wrapper panels */
    }

---

## 2. PrimeNG Unstyled PassThrough (PT) Directives

To keep our dependencies lightweight and avoid bulky CSS imports, all PrimeNG components are loaded in **Unstyled Mode**. Styling must be injected dynamically via PassThrough (PT) configuration schemas using our utility tokens.

### 2.1 Core Typography & Semantic Element Rules

- All page headings must use strict semantic, accessible elements (`<h1>`, `<h2>`, `<article>`, `<section>`).
- Custom component variations must be configured globally inside `app.config.ts` or passed explicitly via component inputs to prevent layout fragmentation.

### 2.2 Global PassThrough (PT) Template References

#### 📦 Element Rule: PrimeNG Card (`p-card`)

When rendering layout modules (such as Greenhouse Zones or Seed Boxes), map the presentation parameters exactly as follows:

    export const FloraCardPT = {
      root: {
        class: 'bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 rounded-garden-md p-5 shadow-sm transition-all duration-200 hover:shadow-md'
      },
      title: {
        class: 'text-lg font-semibold font-display text-neutral-900 dark:text-white mb-2'
      },
      content: {
        class: 'text-sm text-neutral-600 dark:text-neutral-300 antialiased'
      }
    };

#### 📅 Element Rule: PrimeNG Calendar / DatePicker (`p-datepicker`)

Used in the Care Scheduler loop. Formats must respect clean layout targets:

    export const FloraDatePickerPT = {
      root: {
        class: 'font-display text-sm border border-neutral-300 rounded-garden-sm bg-white shadow-inner focus-within:ring-2 focus-within:ring-primary-500'
      },
      input: {
        class: 'p-2 text-neutral-900 border-none bg-transparent outline-none w-full'
      },
      panel: {
        class: 'bg-white border border-neutral-200 shadow-xl rounded-garden-md p-4'
      }
    };

#### 🚨 Element Rule: PrimeNG Dialog / Overlay Modal (`p-dialog`)

The official interaction wrapper used for handling the "Is the soil dry?" confirmation and Snooze workflows.

    export const FloraDialogPT = {
      root: {
        class: 'max-w-md w-full bg-white dark:bg-neutral-900 rounded-garden-lg shadow-2xl overflow-hidden border border-neutral-100'
      },
      header: {
        class: 'bg-primary-900 p-4 flex items-center justify-between text-white font-semibold'
      },
      content: {
        class: 'p-6 text-neutral-700 dark:text-neutral-200 text-base leading-relaxed'
      },
      footer: {
        class: 'bg-neutral-50 p-4 flex justify-end gap-3 border-t border-neutral-100'
      }
    };

---

## 3. WCAG Accessibility & Semantic Guardrails

The Frontend Agent must validate that every template file meets these three compliance baselines before a task can be marked complete:

1. **Interactive Elements:** Every text input field, datepicker, and option picker must be backed by a clear, matching `<label>` element with explicit tracking targets.
2. **Visual Contrast:** All text configurations must strictly maintain a minimum contrast ratio of 4.5:1 against their active background layer, satisfying the WCAG AA requirement.
3. **Keyboard Controls:** Modals, overlays, and task-completion buttons must be fully navigable using basic keyboard controls (Tab to shift focus, Enter/Space to select, and Escape to dismiss panels).
