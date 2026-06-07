# Phase 4.3 — Logout Button

**Goal:** Add a "Sign out" button to the top nav so authenticated users can end their session from anywhere in the app.

---

- [ ] **Block A — Sign-out button in nav** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `nav.ts`: inject `SupabaseService` and `Router`; add `readonly loggingOut = signal(false)`; add `async signOut()` — sets `loggingOut`, calls `supabase.signOut()`, then navigates to `/login` unconditionally (Supabase clears the local session immediately regardless of network state).
  - `nav.html`: add a native `<button>` pushed to the far right of the header with `ml-auto`. Height matches nav links (`h-14`). Label "Sign out" + `pi pi-power-off` icon. Style: `text-neutral-500 hover:text-danger-500 transition-colors duration-150 cursor-pointer`. While `loggingOut()`: show a spinner in place of the icon and disable the button. Attributes: `aria-label="Sign out of FloraFlow"` and `[attr.aria-busy]="loggingOut()"`.

**Verification:**
```powershell
bun run format
bun run lint
```
Manual Browser Check — Nav sign-out button
────────────────────────────────────────
App running at: http://localhost:4200/dashboard

1. Nav is visible at top → confirm "Sign out" button appears on the right side.
2. Click "Sign out" → confirm redirect to /login, session is cleared (refreshing /dashboard sends back to /login).
3. Open DevTools Console → confirm zero red errors.
