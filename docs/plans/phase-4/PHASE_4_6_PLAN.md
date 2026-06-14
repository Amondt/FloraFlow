# Phase 4.6 — Google OAuth Login

**Goal:** Let a gardener sign in with their Google account from the login page — one tap, no password to remember. A "Continue with Google" button sits below the email/password form, split off by an "or" divider. Post-login routing reuses the existing guard chain: a brand-new Google user is forwarded to `/onboarding`, a returning one to `/dashboard`. No new callback route, no migration.

**Why no migration:** signing in with Google creates an `auth.users` row, which fires the same `handle_new_user` trigger Phase 4.4 relies on → a `profiles` row with `has_completed_onboarding = false`. `onboardingGuard` then does the new-vs-returning routing for free.

**Build order:** Block A (service method) and Block B (external setup) are independent and can be done in either order, but **both must be done before Block C's browser check** — the button can't reach Google until the provider is configured.

---

- [ ] **Block A — `SupabaseService.signInWithOAuth()`** | Agent: `/plumber` · Model: Sonnet · Effort: low
  - Add `async signInWithOAuth()` to `src/app/core/services/supabase.service.ts`, placed after `signUp()` and mirroring the `{ error }` shape of `signOut()`:
    ```ts
    async signInWithOAuth(): Promise<{ error: AuthError | null }> {
      const { error } = await this.client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      return { error };
    }
    ```
  - **Why it returns only `{ error }`:** in the browser, `signInWithOAuth` triggers a _full-page_ redirect to Google. On the success path the caller's code never finishes — the page is already navigating away. The method exists to surface the rare _pre-redirect_ failure (provider disabled, network down) so the login page can show its existing inline error banner. (Signature verified against the Supabase JS docs via context7.)
  - **Why `redirectTo` targets `/dashboard`:** Supabase appends the auth `code` to this URL on return; `@supabase/supabase-js` (default `detectSessionInUrl`) exchanges it on load and fires `onAuthStateChange`. Landing on the guarded `/dashboard` lets the existing `[authGuard, onboardingGuard]` chain route the user — new users forward to `/onboarding`, returning users stay. `window.location.origin` keeps it correct on local and any future hosted origin. This exact URL must be in the redirect allow-list (Block B).
  - No new imports — `AuthError` is already imported in this file.

**Verification:**

```powershell
bun run format
bun run lint
```

No browser check here — service method only. The end-to-end OAuth flow is exercised in Block C (after Block B is configured).

---

- [ ] **Block B — Google Cloud + local Supabase provider config** | _user-run setup · no app code_
  - One-time external wiring. Paste-ready values below; the secret never enters git.

  **1. Google Cloud Console** (`https://console.cloud.google.com`)
  - Create or select a project.
  - **APIs & Services → OAuth consent screen:** User type **External**; fill app name + support email. While the app is in **Testing**, add your own Google address under **Test users** (only listed accounts can sign in until the app is published).
  - **APIs & Services → Credentials → Create credentials → OAuth client ID:** Application type **Web application**.
    - **Authorized JavaScript origins:** `http://localhost:4200`
    - **Authorized redirect URIs:** `http://127.0.0.1:54321/auth/v1/callback`
      _(the local Supabase Auth callback — Google allows `http://127.0.0.1` for testing; this is **not** the app's URL)._
  - Copy the **Client ID** and **Client secret**.

  **2. Local secret** — add to `supabase/.env` (create if absent). **Never `git add` this file** (it holds the secret):

  ```
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<paste client id>
  SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<paste client secret>
  ```

  **3. `supabase/config.toml`** — add a Google provider block (next to the existing `[auth.external.apple]` stub). This file _is_ committed; it references the secret by env name, so no secret is committed:

  ```toml
  [auth.external.google]
  enabled = true
  client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
  secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
  # Required for local sign-in with Google — skips the nonce check the hosted flow uses.
  skip_nonce_check = true
  ```

  **4. Redirect allow-list** — still in `config.toml`, point the local stack at the app's real origin so the `redirectTo` from Block A is honored:

  ```toml
  site_url = "http://localhost:4200"
  additional_redirect_urls = ["http://localhost:4200/**"]
  ```

  **5. Reload config** — `config.toml` is read at start, so restart the local stack:

  ```powershell
  bunx supabase stop
  bunx supabase start
  ```

  - **Future hosted deployment (note only, not this block):** on a cloud project the same wiring lives in the dashboard — **Authentication → Providers → Google** (enable + paste the same Client ID/secret), Google's authorized redirect URI becomes `https://<project-ref>.supabase.co/auth/v1/callback`, and the deployed app URL goes in **URL Configuration**. No app-code change.

**Verification:**

- `bunx supabase start` reports no config errors and the stack comes up.
- Open Studio (`http://127.0.0.1:54323`) → **Authentication → Providers** → **Google** shows as enabled.
- (Full sign-in is verified in Block C step 3–4.)

---

- [ ] **Block C — Login page button + "or" divider + i18n** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - **Login page only.** The register page deliberately does not get this button — out of scope for 4.6.

  **`src/app/features/auth/login.ts`**
  - Add a dedicated `readonly googleLoading = signal(false);` (separate from `loading` so the two buttons spin independently) and:
    ```ts
    async onGoogleSignIn(): Promise<void> {
      this.googleLoading.set(true);
      this.authError.set('');
      const { error } = await this.supabase.signInWithOAuth();
      if (error) {
        this.authError.set(error.message);
        this.googleLoading.set(false);
      }
      // success path: the browser redirects to Google — nothing else runs here
    }
    ```
  - No new imports — `ButtonModule`, `TranslocoPipe`, and `SupabaseService` are already wired in.

  **`src/app/features/auth/login.html`** — insert _between_ `</form>` and the existing "Don't have an account?" `<p>` (so the order is: form → divider → Google button → register link):
  - **"or" divider** (Tailwind only — no PT object; dark variants mandatory per the 4.1 baseline):
    ```html
    <div class="my-6 flex items-center gap-3" aria-hidden="true">
      <span class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>
      <span
        class="text-xs font-display uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
      >
        {{ 'auth.login.orDivider' | transloco }}
      </span>
      <span class="h-px flex-1 bg-neutral-200 dark:bg-neutral-700"></span>
    </div>
    ```
  - **Google button** — reuse `FloraButtonPT` with `variant="outlined"` (no new PT object; the outlined branch already handles dark-mode hover):
    ```html
    <p-button
      type="button"
      (onClick)="onGoogleSignIn()"
      [label]="'auth.login.googleButton' | transloco"
      icon="pi pi-google"
      variant="outlined"
      [pt]="FloraButtonPT"
      [loading]="googleLoading()"
      [disabled]="googleLoading() || loading()"
      [ariaLabel]="'auth.login.googleAriaLabel' | transloco"
      class="w-full"
      styleClass="w-full justify-center"
    />
    ```

    - `type="button"` is load-bearing: it must **not** submit the email/password form.
    - `icon="pi pi-google"` is a PrimeIcons brand icon. If it renders blank, fall back to an inline Google `<svg>` — confirm against the PrimeIcons set via context7 before substituting.
    - Disabled while either button is in-flight, so the two paths can't fire at once.

  **i18n — add three keys to the `auth.login` object in all three files, after `createOneLink` (add the trailing comma to `createOneLink` first):**
  - `public/i18n/en.json`
    ```json
    "orDivider": "or",
    "googleButton": "Continue with Google",
    "googleAriaLabel": "Sign in to FloraFlow with Google"
    ```
  - `public/i18n/fr.json`
    ```json
    "orDivider": "ou",
    "googleButton": "Continuer avec Google",
    "googleAriaLabel": "Se connecter à FloraFlow avec Google"
    ```
  - `public/i18n/nl.json`
    ```json
    "orDivider": "of",
    "googleButton": "Doorgaan met Google",
    "googleAriaLabel": "Inloggen bij FloraFlow met Google"
    ```

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Login (Google OAuth)
────────────────────────────────────────
App running at: http://localhost:4200/login
(Requires Block B complete — Google provider enabled + local stack restarted.)

1. Page loads → below the "Sign in" button: an "or" divider, then a full-width outlined "Continue with Google" button with a Google icon.
2. Click "Continue with Google" with the email/password fields empty → no form validation errors fire (the button does not submit the form).
3. Click "Continue with Google" → browser redirects to Google's account chooser / consent screen.
4. Approve with a test Google account → returns to the app; a brand-new Google user lands on /onboarding, a returning user on /dashboard.
5. Sign out, return to /login, switch language EN → FR → NL → button reads "Continuer avec Google" / "Doorgaan met Google" and the divider reads "ou" / "of", same render, no reload.
6. Toggle dark mode → divider lines, the "or" text, and the outlined button border/text all read correctly in both themes.
7. (Optional error path) Set google enabled=false in config.toml + restart → clicking the button shows the inline error banner instead of crashing.
8. Open DevTools Console → confirm zero red errors.
```
