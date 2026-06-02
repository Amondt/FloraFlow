# Phase 1.10 — Onboarding Wizard Plan

## Context

New users land on an empty dashboard after first login. This phase adds a single-pass, multi-step onboarding wizard that runs once per account, guiding the user through creating their first zone before they reach the app shell. After completion the flag is written to `profiles` and the wizard never appears again.

## Architecture

- `/onboarding` lives **outside the shell** — first-time users should not see the nav bar.
- A new `onboardingGuard` is added as a second `canActivate` on the shell route; it redirects to `/onboarding` when the profile flag is false.
- The `/onboarding` route carries only `authGuard` (must be logged in, but onboarding not yet done).
- `OnboardingComponent` opens with a redundant forward-check: if the flag is already true it redirects to `/dashboard` immediately, preventing back-navigation abuse.
- Wizard steps: **Welcome → Create Zone → All Set** (3 steps, Signal-driven).
- Completion: `ProfileService.completeOnboarding()` PATCH → navigate to `/dashboard`.

## Blocks

- [ ] **Block A — Migration + `ProfileService`** | Agent: `/plumber`
  - Migration SQL: `ALTER TABLE public.profiles ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE NOT NULL;`
  - New migration file via `bunx supabase migration new add_onboarding_flag`, then `bunx supabase db push`
  - Run `bun run types` — confirm `has_completed_onboarding` appears in `database.types.ts`
  - New singleton `src/app/core/services/profile.service.ts`:
    - `profile = signal<Profile | null>(null)` loaded once on construction via `SupabaseService`
    - `completeOnboarding()` — Supabase UPDATE `has_completed_onboarding = true` where `id = auth.uid()`; updates the local signal after success
  - Update `docs/DB_SCHEMA_MATRIX.md §2.1` to list the new column

- [ ] **Block B — `onboardingGuard` + routing** | Agent: `/visualizer`
  - `src/app/core/guards/onboarding.guard.ts` — async functional guard:
    - Injects `ProfileService`; awaits profile load if not yet ready
    - Returns `true` when `has_completed_onboarding` is true
    - Returns `router.parseUrl('/onboarding')` when false
  - `app.routes.ts` changes:
    - Add `/onboarding` at the top level: `canActivate: [authGuard]`, loads `OnboardingComponent`
    - Add `onboardingGuard` to the shell route's `canActivate` array (after `authGuard`)
  - Manual Browser Check:
    1. Create a fresh test account (or reset flag in DB) → confirm redirect lands on `/onboarding`
    2. Complete onboarding → confirm redirect lands on `/dashboard`
    3. Navigate browser back to `/onboarding` → confirm immediate forward redirect to `/dashboard`
    4. Log out, log back in with the same account → confirm `/dashboard` loads directly (no onboarding)

- [ ] **Block C — Onboarding wizard component** | Agent: `/visualizer`
  - `src/app/features/onboarding/onboarding.ts`
  - Step state: `currentStep = signal<1 | 2 | 3>(1)` — drives `@switch` template
  - **Step 1 — Welcome**: headline, one-line value pitch, "Set up your first zone →" button
  - **Step 2 — Create Zone**: inline zone form (name + microclimate fields) reusing `ZoneService.createZone()`; "Next →" enabled only after successful save
  - **Step 3 — All Set**: success confirmation, "Enter your greenhouse" primary button
    - On click: `ProfileService.completeOnboarding()` → `router.navigateByUrl('/dashboard')`
  - Step indicator: `<ol aria-label="Onboarding steps">` with `aria-current="step"` on active item
  - Semantic layout: `<main>` wrapper, no `ShellComponent`, no nav bar
  - Manual Browser Check:
    1. Load `/onboarding` as a new user → confirm Step 1 renders, no nav bar visible
    2. Click through to Step 2 → fill zone name → confirm zone appears in DB and Step 3 renders
    3. Click "Enter your greenhouse" → confirm redirect to `/dashboard` and zone card is visible
    4. Open DevTools Console → confirm zero red errors across all three steps
