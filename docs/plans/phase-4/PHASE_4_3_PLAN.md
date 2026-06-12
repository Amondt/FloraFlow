# Phase 4.3 — Logout Button

**Goal:** Add a "Sign out" control to the top nav so authenticated users can end their session from anywhere in the app. The action is its own self-contained component (matching `ThemeToggleComponent`), keeping `NavComponent` purely presentational.

---

- [ ] **Block A — SignOutButtonComponent + nav wiring** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - **New component** `src/app/shared/components/sign-out-button/sign-out-button.ts` (+ `.html`) — sibling to `theme-toggle/`, following its exact shape.
    - Inject `SupabaseService` and `Router`.
    - `readonly loggingOut = signal(false)`.
    - `async signOut()`: set `loggingOut.set(true)`, `await supabase.signOut()`, then `window.location.assign('/login')` unconditionally. A **hard reload** (not `router.navigate`) tears down every in-memory signal so the next user starts from a clean slate — `PlantService` / `ZoneService` are root singletons and would otherwise keep the previous user's cached data until refetch. Supabase clears the local session immediately regardless of network state, so we never block on the result.
  - **Template** (`sign-out-button.html`): one native `<button type="button">` styled to match the nav-chrome button in `theme-toggle.html` so all right-side nav controls are visually identical.
    - Base class: `cursor-pointer inline-flex items-center gap-2 h-14 px-3 text-sm font-medium font-display text-neutral-600 dark:text-neutral-300 hover:text-danger-500 dark:hover:text-danger-400` composed with `FLORA_FOCUS` + `FLORA_HOVER` (import both from `../../ui/pt/states.pt`). `FLORA_FOCUS` is mandatory — never ship an interactive control without a focus ring (§2.4.7).
    - Contents: `pi pi-power-off` icon + visible "Sign out" label. While `loggingOut()`: swap the icon for `pi pi-spinner pi-spin` and apply `[disabled]="loggingOut()"`.
    - Attributes: `aria-label="Sign out of FloraFlow"`, `[attr.aria-busy]="loggingOut()"`.
  - **Wire into nav** (`nav.ts` + `nav.html`): import `SignOutButtonComponent`; render `<app-sign-out-button />` **inside the existing right-aligned container** at `nav.html:50` — `<div class="ml-auto flex items-center gap-1">` — placed after `<app-theme-toggle />`. Do **not** add a second `ml-auto`; that container already owns the right edge.

**Verification:**

```powershell
bun run format
bun run lint
```

Manual Browser Check — Nav sign-out button
────────────────────────────────────────
App running at: http://localhost:4200/dashboard

1. Nav top-right → confirm the theme toggle and a "Sign out" button sit side by side, same height, same hover treatment.
2. Tab to the "Sign out" button → confirm a visible focus ring appears.
3. Toggle dark mode → confirm the button text and hover colour read correctly in both themes.
4. Click "Sign out" → confirm a full reload to /login and the session is cleared (manually visiting /dashboard afterwards redirects back to /login).
5. Open DevTools Console → confirm zero red errors.
