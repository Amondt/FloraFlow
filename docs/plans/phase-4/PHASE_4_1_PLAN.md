# Phase 4.1 — Dark / Light Theme Toggle

**Goal:** Give users a real, persistent theme control. A `ThemeService` singleton holds the preference, an inline `<head>` script applies the theme before first paint (no flash), and a nav toggle cycles **Light → Dark → System**. Then close the readability gaps so every surface looks right in dark mode.

**Toggle model (user decision):** three-state — `Light / Dark / System`. `System` follows the OS and keeps following it even after a manual choice is reverted. The service preference is `'light' | 'dark' | 'system'`; `resolvedTheme` is the computed `'light' | 'dark'` actually applied.

**Why this is more than "add a button":** the dark CSS is already ~75% wired (589 `dark:` usages across templates + PT objects), but it has never rendered because `.dark` has never been on `<html>`. Turning the toggle on exposes three latent issues this plan fixes: undefined accent tokens (Block A), first-paint timing (Block B), and a handful of light-only surfaces (Blocks D–E).

---

## Dark-mode UX principles — the acceptance bar

Every block below is judged against these. Derived from Material Design dark theme guidance, WCAG 2.1 §1.4.3, and the UX Planet best-practice article, cross-checked and reconciled:

- **No pure black, no pure white.** Page = `neutral-900` (#0f172a), raised surfaces = `neutral-800`, borders = `neutral-700`; body text = `neutral-100/200`. This is already the codebase convention — preserve it, never introduce `#000`/`#fff`.
- **Desaturate accents on dark.** Green text/links/icons on a dark surface use the lighter `primary-400` (hover `primary-300`), never `primary-600/700`. Saturated/dark greens fail contrast and "vibrate" on dark backgrounds.
- **WCAG AA preserved.** Body text ≥ 4.5:1, large text ≥ 3:1 in both themes (DESIGN_SYSTEM §4). New dark pairs get spot-checked.
- **Elevation via surface, not shadow.** Dark backgrounds swallow shadows — a raised card reads as `neutral-800` on a `neutral-900` page, not as a shadow.
- **System-first, persist only overrides, apply before paint.** Default follows the OS; an explicit choice is the only thing stored; the theme is on `<html>` before Angular boots so there is no flash.

**Sources:** [Material Design — Dark theme](https://m2.material.io/design/color/dark-theme.html) · [Google Design — Material dark theme](https://design.google/library/material-design-dark-theme) · [UX Planet — Dark Mode UI best practices](https://uxplanet.org/dark-mode-ui-design-best-practices-8d3a00a83924) · WCAG 2.1 §1.4.3.

---

- [x] **Block A — Dark-mode accent tokens** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `styles.input.css` `@theme`: add the three accent tones the codebase already references but never defined — `--color-primary-300: #6ee7b7;`, `--color-primary-400: #34d399;`, `--color-primary-800: #065f46;` (continuing the existing emerald ramp). These are the lighter, dark-surface-legible greens; `primary-400` clears ~9:1 on `neutral-900`.
  - Why this is required: Tailwind v4 only generates utilities for tokens that exist in `@theme`. `dark:text-primary-400`, `dark:hover:text-primary-300`, and `dark:bg-primary-800` appear across nav, tasks, zone-detail, substrate wizard, location-dialog, and DESIGN_SYSTEM §6.7's mandated ghost-button style — all currently compile to nothing. Confirmed against the generated `styles.css`: those utilities are absent.
  - Regenerate CSS (`bun run tw:watch` already running, or rebuild) and confirm `.text-primary-400` / `.bg-primary-800` now exist in `styles.css`.
  - Audit for any other undefined token behind a `dark:` class: grep every `dark:`-prefixed color utility in `src/app/**/*.{html,ts}` and `src/app/shared/ui/pt/*.ts` against the `@theme` definitions; the only expected gaps are the three primary tones above, but fix any `danger-`/`success-`/`warning-` stragglers found.
  - `DESIGN_SYSTEM.md §1`: add the three token lines to the `@theme` block with a one-line note that `primary-300/400` are the dark-mode accent tones. Keep it lean.

- [ ] **Block B — ThemeService + first-paint guard** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `src/app/core/services/theme.service.ts`, `@Injectable({ providedIn: 'root' })`, modeled on `network-status.service.ts`:
    - `export type ThemePreference = 'light' | 'dark' | 'system';`
    - `readonly preference = signal<ThemePreference>(...)` initialised from `localStorage['flora-theme']` when it is exactly `'light'` or `'dark'`, otherwise `'system'`.
    - `private readonly systemPrefersDark = signal(window.matchMedia('(prefers-color-scheme: dark)').matches)`.
    - `readonly resolvedTheme = computed<'light' | 'dark'>(() => this.preference() === 'system' ? (this.systemPrefersDark() ? 'dark' : 'light') : this.preference())`.
    - `cycle()` advances `light → dark → system → light`; `setPreference(p)` for direct set.
    - `effect()`: toggle `.dark` on `document.documentElement` from `resolvedTheme()`; **persist only explicit choices** — `localStorage.setItem('flora-theme', p)` for `light`/`dark`, `localStorage.removeItem('flora-theme')` for `system`. (Absence of the key === "follow system", which matches QA criterion 1's mental model and keeps storage clean.)
    - `afterNextRender()`: add a `change` listener on the media query to update `systemPrefersDark`; remove it via `DestroyRef.onDestroy` (mirror `NetworkStatusService`).
  - `index.html` `<head>`, before `<app-root>` — inline, dependency-free FOUC guard that mirrors the resolve logic:
    ```html
    <script>
      (function () {
        var t = localStorage.getItem('flora-theme');
        var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.classList.add('dark');
      })();
    </script>
    ```
    It must be inline and synchronous: Angular bootstraps *after* first paint, so the service alone cannot satisfy "`.dark` on first paint." The `effect()` re-applies the same class idempotently once Angular runs.
  - No component renders the service yet — that is Block C. This block is verified via DevTools (below).

- [ ] **Block C — ThemeToggleComponent in the nav** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `src/app/shared/components/theme-toggle/theme-toggle.ts` (+ `.html`): standalone, injects `ThemeService`. A single native `<button>` calling `theme.cycle()`.
    - Icon reflects `preference()`: `pi pi-sun` (light) · `pi pi-moon` (dark) · `pi pi-desktop` (system).
    - `aria-label` names current state **and** next action, e.g. `"Theme: System. Switch to Light."` — computed from `preference()`.
    - `cursor-pointer`, `h-14` to align with nav links, `FLORA_FOCUS` ring, `text-neutral-600 dark:text-neutral-300 hover:text-primary-600 dark:hover:text-primary-400`, `FLORA_HOVER`. Icon `aria-hidden="true"`.
  - `nav.html`: wrap the control in a right-aligned utility cluster so Phase 4.2 (language switcher) and 4.3 (sign-out) slot in beside it without restructuring:
    ```html
    <div class="ml-auto flex items-center gap-1">
      <app-theme-toggle />
    </div>
    ```
  - `nav.ts`: import `ThemeToggleComponent`.
  - Single Responsibility: the toggle is a presentational control bound to one global singleton — it holds no data-fetch logic, so no container/presentational split is needed.

- [ ] **Block D — Dark-mode gap-fill: auth & shell surfaces** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - These three are the only light-only **first-paint / unauthenticated** surfaces — highest priority because QA criterion 1 lands on `/login`.
  - `login.html`: add dark variants — main `dark:bg-neutral-900`; card `dark:bg-neutral-800 dark:border-neutral-700`; `h1` `dark:text-white`; sub-copy `dark:text-neutral-400`; labels `dark:text-neutral-200`. Replace the raw `bg-red-50 border-danger-500 text-red-900` error `<div>` with dark-aware danger tokens (`dark:bg-danger-500/10 dark:border-danger-500 dark:text-danger-... ` readable pairing) — keep it a `<div role="alert">`, just make it legible in both themes.
  - `onboarding.html`: page bg, card, headings, sub-copy as above; step-indicator inactive chips `dark:bg-neutral-700 dark:text-neutral-300`; connector lines `dark:bg-neutral-700`; success ring `dark:bg-primary-900/40`.
  - `shell.html`: offline + syncing banners `dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200` (keep the `warning-500` / `primary-500` icon accents).

- [ ] **Block E — Dark-mode gap-fill: dialogs + full-route audit** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `location-dialog.html`: the `bg-primary-50` info boxes → `dark:bg-primary-900/30 dark:border-primary-800`; the `bg-white` suggestions dropdown → `dark:bg-neutral-800 dark:border-neutral-700`; dividers `dark:border-neutral-700`; option hover/focus `dark:hover:bg-primary-900/30 dark:focus-visible:bg-primary-900/30`; neutral text gets `dark:` siblings; confirm the now-defined `text-primary-800` reads on dark (swap to `dark:text-primary-300` if not).
  - Systematic audit with the toggle live — walk every route in **dark mode** and fix any remaining low-contrast or missing-variant spot: Dashboard, Tasks, Journal, Library, Seeds, Zone detail, plus every dialog (plant form, soil check, leaf doctor, substrate wizard, botanical detail, plant identifier, seed batch, photo lightbox, care-recommendations panel). Most are already covered by existing `dark:` variants — this is a verification sweep that catches the stragglers, not a rewrite.
  - Check each fix against the **Dark-mode UX principles** above. Spot-check the riskiest new pairs for WCAG AA: `primary-400` on `neutral-900`, `neutral-400` on `neutral-900`, danger/warning text on dark surfaces.

---

## Phase verification

Run after **every** block, in order:

```powershell
bun run format
bun run lint
```

**Manual Browser Check — Theme toggle (run after Block C; re-run the dark sweep after E)**
────────────────────────────────────────
App running at: http://localhost:4200

1. Nav shows the theme button on the right with the icon matching the current state.
2. Click it → cycles Light → Dark → System; `.dark` on `<html>` appears/clears live (DevTools Elements), no page reload, no flash.
3. Set **Dark**, reload → still dark, no white flash on load (FOUC guard). `localStorage['flora-theme'] === 'dark'`.
4. Set **System**, reload → `flora-theme` key is **absent**; theme matches the OS setting.
5. In **System**, flip the OS dark setting (DevTools → Rendering → "Emulate prefers-color-scheme") → theme follows immediately.
6. **QA criterion 1:** clear `localStorage`, set emulation to dark, hard-reload `/login` → page paints dark on first frame (no light flash), `.dark` present before `<app-root>` hydrates.
7. Walk Dashboard, Tasks, Journal, Library, Seeds, Zone detail and open each dialog in dark mode → every text/control/border is readable; green accents are the lighter `primary-400`; no pure-black panels, no invisible text.
8. Toggle back to Light on every route → unchanged from today.
9. Keyboard: Tab to the toggle → visible focus ring; Enter/Space cycles. Screen reader announces current state + next action.
10. DevTools Console → zero red errors on every route, both themes.

**Maps to Phase 4 QA criteria:** step 6 = criterion 1 (first-paint dark with no stored key); `bun run lint` clean = criterion 5.

**Closing:** after Block E, this is the last block of the phase's theming work for 4.1 — call `/gatekeeper` to close out the phase sub-task.
