# Phase 4.4 — Create Account (Sign-up)

**Goal:** Let new users create a FloraFlow account directly from the app — without needing an invite or a separate admin step. Adds a `/register` route alongside `/login`, and links the two pages together.

---

- [ ] **Block A — `SupabaseService.signUp()`** | Agent: `/plumber`
  - Add `async signUp(email, password)` to `src/app/core/services/supabase.service.ts`.
  - Returns `{ error: AuthError | null; needsEmailConfirmation: boolean }`.
  - `needsEmailConfirmation` is `true` when `data.user` is set but `data.session` is `null` — this happens when Supabase requires the user to click a confirmation link before the account is active. In local dev with auto-confirm enabled, `data.session` will be set and this flag stays `false`.

**Verification:**
```powershell
bun run format
bun run lint
```
No browser check needed — service method only.

---

- [ ] **Block B — Register component & route** | Agent: `/visualizer`
  - New files: `src/app/features/auth/register.ts` + `register.html`.
  - `app.routes.ts`: add `{ path: 'register', loadComponent: () => import('./features/auth/register').then(m => m.RegisterComponent) }` before the shell route (public, no guard).
  - Form fields: Email (required, email format), Password (required, minLength 8), Confirm Password (required, must match Password via a cross-field validator).
  - Two template states controlled by a `readonly state = signal<'form' | 'confirmation-pending'>('form')`:
    - `'form'` — renders the sign-up form.
    - `'confirmation-pending'` — hides the form and shows: "We sent a confirmation link to [email]. Click it to activate your account." + a "Return to sign in" link pointing to `/login`.
  - On submit: if `needsEmailConfirmation` → switch state to `'confirmation-pending'`; if session is returned (auto-confirm in local dev) → navigate to `/login`; if error → show an inline error banner above the submit button (never wipe form values).
  - "Already have an account? Sign in" link at the bottom → `/login`.
  - Password field: `autocomplete="new-password"`. Email field: `autocomplete="email"`.
  - Full form anatomy from `docs/DESIGN_SYSTEM.md §5`: label + input + error `<small>` per field.

**Verification:**
```powershell
bun run format
bun run lint
```
Manual Browser Check — Register page
────────────────────────────────────────
App running at: http://localhost:4200/register

1. Page loads without errors → form with Email, Password, Confirm Password fields and "Create account" button is visible.
2. Submit empty form → all three fields show validation errors; form does not submit.
3. Enter mismatched passwords → "Passwords do not match" error on Confirm Password field.
4. Enter valid unique email + matching passwords (min 8 chars) → either redirect to /login (auto-confirm) or confirmation-pending state is shown with the email address in the message.
5. Click "Already have an account? Sign in" → navigates to /login.
6. Open DevTools Console → confirm zero red errors.

---

- [ ] **Block C — Login → Register link** | Agent: `/visualizer`
  - `login.html`: add a "Don't have an account? Create one" link at the bottom of the `<article>`, below the submit button, using `routerLink="/register"`.
  - Style: `text-sm text-neutral-500 font-display text-center` with `text-primary-600 hover:underline` on the link text.

**Verification:**
```powershell
bun run format
bun run lint
```
Manual Browser Check — Login → Register link
────────────────────────────────────────
App running at: http://localhost:4200/login

1. "Don't have an account? Create one" link is visible below the Sign in button.
2. Clicking it navigates to /register.
3. Open DevTools Console → confirm zero red errors.
