# Phase 4.4 — Create Account (Sign-up)

**Goal:** Let new users create a FloraFlow account directly from the app — without an invite or an admin step. Adds a public `/register` route alongside `/login` and links the two pages together.

---

- [ ] **Block A — `SupabaseService.signUp()` + new-user profile check** | Agent: `/plumber` · Model: Sonnet · Effort: low
  - Add `async signUp(email, password)` to `src/app/core/services/supabase.service.ts`, mirroring the shape of `signInWithPassword` directly above it.
  - Returns `{ error: AuthError | null; needsEmailConfirmation: boolean }`.
  - `needsEmailConfirmation` is `true` when `data.user` is set but `data.session` is `null` — Supabase requires a confirmation click before the account is active. With local auto-confirm, `data.session` is populated and the flag stays `false`. (No `session` is returned — callers branch on the flag + `error`; see Block B.)
  - **Profile dependency check (required for Block B's `/dashboard` redirect):** every user so far was created manually, so this is the first time the app registers one itself. Confirm in Studio that signing up a new auth user auto-creates a `profiles` row with `has_completed_onboarding = false` (the standard `handle_new_user` trigger on `auth.users`). If no such trigger exists, `onboardingGuard` / `ProfileService` will break for self-registered users — add a one-line migration creating it **before** Block B ships.
  - _Awareness note (no code):_ with Supabase email-enumeration protection enabled, signing up an *existing* email returns an obfuscated user + null session — indistinguishable from a genuine confirmation-pending. Harmless under local auto-confirm; revisit if this ever runs against a hosted project.

**Verification:**

```powershell
bun run format
bun run lint
```

No browser check needed — service method only. Studio query for the profile-trigger check:

```sql
-- After signing up a test user, confirm the row exists:
select id, has_completed_onboarding from public.profiles order by created_at desc limit 1;
```

---

- [ ] **Block B — Register component & route** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - New files: `src/app/features/auth/register.ts` + `register.html` (flat in `features/auth/`, matching `login.ts`).
  - `app.routes.ts`: add `{ path: 'register', loadComponent: () => import('./features/auth/register').then((m) => m.RegisterComponent) }` immediately after the `login` route (public, no guard) — before the shell route.
  - **Reuse login's visual scaffold verbatim** for sibling consistency: same `<main>` / `<article>` shell, header, field anatomy, and the **raw `<div role="alert">` error banner** from `login.html:86`. Match login exactly — do not introduce `<p-message>` here; login's §6.5 deviation is pre-existing and out of scope for this phase.
  - Form fields (form anatomy per `docs/DESIGN_SYSTEM.md §5`):
    - Email — required, email format, `autocomplete="email"`.
    - Password — required, `minLength 8`, `autocomplete="new-password"`.
    - Confirm Password — required, `autocomplete="new-password"`, must equal Password via a **cross-field validator on the `FormGroup`** (e.g. `passwordsMatch`), surfaced as a field-level error on Confirm Password.
  - Two template states via `readonly state = signal<'form' | 'confirmation-pending'>('form')`:
    - `'form'` — renders the sign-up form.
    - `'confirmation-pending'` — hides the form, shows "We sent a confirmation link to {{ email }}. Click it to activate your account." + a "Return to sign in" link → `/login`.
  - On submit (`form.invalid` → `markAllAsTouched()` and stop):
    - `needsEmailConfirmation` → switch `state` to `'confirmation-pending'`.
    - else if no error (auto-confirmed — the session is already live) → `router.navigate(['/dashboard'])`; `onboardingGuard` then routes the brand-new user to `/onboarding`.
    - error → show the inline banner above the submit button; **never wipe field values** (§7.4).
  - "Already have an account? Sign in" link at the bottom → `/login`, styled identically to Block C's link (including dark variants).

**Verification:**

```powershell
bun run format
bun run lint
```

Manual Browser Check — Register page
────────────────────────────────────────
App running at: http://localhost:4200/register

1. Page loads without errors → form with Email, Password, Confirm Password fields and a "Create account" button is visible.
2. Submit empty form → all three fields show validation errors; form does not submit.
3. Enter mismatched passwords → "Passwords do not match" error on Confirm Password.
4. Enter a valid unique email + matching passwords (≥ 8 chars) → either lands on /onboarding (auto-confirm → /dashboard → onboardingGuard) or shows the confirmation-pending state with the email address in the message.
5. Click "Already have an account? Sign in" → navigates to /login.
6. Toggle dark mode → confirm the form, banner, and bottom link all read correctly in both themes.
7. Open DevTools Console → confirm zero red errors.

---

- [ ] **Block C — Login → Register link** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `login.ts`: add `RouterLink` to the component `imports` (it currently imports only `Router`, for programmatic navigation).
  - `login.html`: add a "Don't have an account? Create one" line as the **last child of `<article>`**, after `</form>` (`login.html:106`):
    ```html
    <p class="mt-6 text-sm text-neutral-500 dark:text-neutral-400 font-display text-center">
      Don't have an account?
      <a routerLink="/register" class="text-primary-600 dark:text-primary-400 hover:underline">
        Create one
      </a>
    </p>
    ```
  - Dark variants are mandatory (Phase 4.1 baseline): `dark:text-neutral-400` on the text, `dark:text-primary-400` on the link — `primary-600` is the wrong accent on the `dark:bg-neutral-800` card.

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
3. Toggle dark mode → confirm the link colour reads correctly in both themes.
4. Open DevTools Console → confirm zero red errors.
