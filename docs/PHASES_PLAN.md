# `docs/PHASES_PLAN.md` - Iterative Build Roadmap & QA Verification Checklists

---

## 1. Phase 1: Local Foundations, Core Loops & Data Storage

- **Objective:** Local environment, secure auth, user profile, core observational data loop. All state managed offline-first with Angular Signals and local storage/IndexedDB.

### 📋 Phase 1 Task Checklist

- [x] **1.1 Workspace Architecture Validation**
    - Initialize Angular 21 app tree per `APP_SPEC.md`.
    - Configure Tailwind CSS v4 tokens and unstyled PrimeNG in `styles.css` and `app.config.ts`.
    - Install and configure ESLint + `@angular-eslint` — verify `bun run lint` passes.
    - Install and configure Vitest.

- [x] **1.2 Supabase Infrastructure Activation**
    - Spin up local Docker containers via Supabase CLI.
    - Execute baseline DDL migrations: `profiles`, `zones`, `plants`, `plant_journals`.
    - Apply RLS across all initialized tables.

- [x] **1.3 Authentication Shell & Routing**
    - `login.component` with semantic HTML and PrimeNG PT components.
    - Async `authGuard` checking active Supabase sessions.

- [x] **1.4 Virtual Greenhouse Dashboard (Local CRUD)**
    - Dashboard grid showing zone cards.
    - Zone form for microclimate properties (window orientation, ventilation, grow lights, humidity baseline).

- [x] **1.5 Smart Observation Scheduling Loop**
    - Angular Signals state engine grouping plants into four urgency sections: **Overdue**, **Due today**, **Due this week** (next 7 days), **Upcoming** (beyond 7 days).
    - `PlantService.loadPlants()` fetches all user plants; `plantsGrouped` computed client-side in `SchedulerComponent`.
    - Confirmation dialog: _"Is the soil dry at the required depth?"_
    - Smart Snooze: if soil wet, push `next_check_due_at` by 2, 5, or 7 days from `snooze_interval_rules`.

- [x] **1.5.1 Plant CRUD (Add / Edit / Delete)**
    - Plant form dialog in `src/app/features/scheduler/`.
    - Fields: `common_name` (required), `scientific_name` (optional), `zone_id` (select), `container_vector` (enum), `substrate_factor` (enum).
    - Delete confirmation via PrimeNG ConfirmDialog + 5-second undo toast.
    - `PlantService`: `createPlant()`, `updatePlant()`, `deletePlant()`.
    - `createPlant()` uses `.select().single()` on insert to return the server row.

- [ ] **1.5.2 App Shell & Navigation**
    - `src/app/shared/components/shell/shell.ts` — layout component wrapping `<router-outlet>` + nav bar.
    - `src/app/shared/components/nav/nav.ts` — nav links via `routerLink` + `routerLinkActive` for all five routes: Dashboard, Scheduler, Journal, Library, Vault.
    - Style nav links using `FloraMenuPT` and Tailwind tokens.
    - Update `app.ts` to render `<app-shell>` instead of bare `<router-outlet>`.
    - Login route stays outside the shell (no nav on login page).

- [ ] **1.6 Offline Isolation Support (PWA Canvas Sync)**
    - `@angular/pwa` service worker for core layout caching.
    - Offline soil-check interactions write to IndexedDB; reconciliation loop syncs on reconnect.

- [ ] **1.7 Pre-Upload Client Image Compression**
    - Offscreen HTML5 Canvas pipeline in journal upload component.
    - All uploads resized below **300KB** before hitting the network.

### 🔒 Phase 1 QA Acceptance Criteria

1. `supabase db test` — users cannot access/edit/delete data owned by other users (100% RLS).
2. Offline mode via browser inspector — watering interactions captured without uncaught network exceptions.

---

## 2. Phase 2: External Integrations, Microclimates & Caching Proxy

- **Objective:** Connect to third-party botanical registries and weather metrics via a caching layer protecting free API rate limits.

### 📋 Phase 2 Tasks

- [ ] **2.1** `cached_botanical_records` table + Edge Function cache-first lookup
- [ ] **2.1.1** Botanical name autocomplete in Add Plant form (requires 2.1)
- [ ] **2.2** Perenual Taxonomy Integration + AI Scribe fallback
- [ ] **2.3** Open-Meteo meteorological proxy
- [ ] **2.4** Monday Morning Email Digest (Resend + cron Edge Function)
- [ ] **2.5** Web Push Notification Architecture (PWA service worker)
- [ ] **2.6** Plant Browser & Botanical Wiki (`/library` route, filter controls, AI Scribe on demand, "Add to greenhouse" shortcut)

### 🔒 Phase 2 QA Criteria

1. No third-party API tokens in client bundles.
2. Repeated identical queries within 60s hit the DB cache exactly once.
3. Library filter changes do not trigger new external API calls if results are cached.

---

## 3. Phase 3: Cognitive AI Core & Advanced Gardening Modules

- **Objective:** Multimodal plant health analytics, AI data enrichment, and advanced cultivation tracking.

### 📋 Phase 3 Tasks

- [ ] **3.1** Claude Data Enrichment (AI Scribe) — Edge Function `claude-enrichment`
- [ ] **3.2** Multimodal Vision Diagnostics (AI Leaf Doctor) — Edge Function `claude-vision`
- [ ] **3.3** Intelligent Seed Vault Module (`/vault`)
- [ ] **3.4** Real-Time Frost Line Alerts (dashboard warning bar)
- [ ] **3.5** Companion Planting & Allelopathy Lookup Engine
- [ ] **3.6** Substrate Composition Mix Wizard
- [ ] **3.7** AI Plant Identifier (Photo-to-Species) — Edge Function `claude-plant-id`; integrates into Add Plant form

### 🔒 Phase 3 QA Criteria

1. AI modules reject non-botanical images without crashing; structured JSON returned on both paths.
2. Claude JSON output validated against `docs/AI_PROMPT_MANIFEST.md` schemas before any DB write.
3. Plant Identifier `is_plant_image` guard verified on both true/false paths.

---

## 4. Phase 4: Theming & Internationalisation

- **Objective:** Dark/light theme toggle with system-preference detection and localStorage persistence; runtime multilingual support (EN/FR/NL) without page reload.

### 📋 Phase 4 Tasks

- [ ] **4.1** Dark/Light Theme Toggle — `ThemeService`, `ThemeToggleComponent`, localStorage `flora-theme`, media query listener, sun/moon icon in nav (requires 1.5.2)
- [ ] **4.2** i18n EN/FR/NL — `@jsverse/transloco`, `LocaleService`, `LanguageSwitcherComponent` in nav, translation files `src/assets/i18n/{en,fr,nl}.json`, audit all hardcoded strings (requires 1.5.2)

### 🔒 Phase 4 QA Criteria

1. No `flora-theme` key in localStorage + browser set to dark → `.dark` on `<html>` on first paint.
2. Language switch updates all strings on current route within same render cycle, zero page reload.
3. `bun run lint` — zero errors after all Phase 4 code.

---

## Design Refactor Reference

**Visual design spec:** `https://api.anthropic.com/v1/design/h/sXAF8Iv27kBfEnAbIYb-RQ?open_file=FloraFlow.html`

> **⚠️ Do not start automatically.** Always ask the user before beginning — they confirm when the design is final.

When instructed: (1) diff design color/radius/shadow values against `@theme` tokens in `src/styles.input.css`; (2) update PT objects in `src/app/shared/ui/pt/`; (3) update `docs/DESIGN_SYSTEM.md` tokens; (4) no Angular structural changes needed.
