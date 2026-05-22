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

- [x] **1.6 Plant CRUD (Add / Edit / Delete)**
    - Plant form dialog in `src/app/features/scheduler/`.
    - Fields: `common_name` (required), `scientific_name` (optional), `zone_id` (select), `container_vector` (enum), `substrate_factor` (enum).
    - Delete confirmation via PrimeNG ConfirmDialog + 5-second undo toast.
    - `PlantService`: `createPlant()`, `updatePlant()`, `deletePlant()`.
    - `createPlant()` uses `.select().single()` on insert to return the server row.

- [x] **1.7 App Shell & Navigation**
    - `src/app/shared/components/shell/shell.ts` — layout component wrapping `<router-outlet>` + nav bar.
    - `src/app/shared/components/nav/nav.ts` — nav links via `routerLink` + `routerLinkActive` for all five routes: Dashboard, Scheduler, Journal, Library, Vault.
    - Style nav links using `FloraMenuPT` and Tailwind tokens.
    - Update `app.ts` to render `<app-shell>` instead of bare `<router-outlet>`.
    - Login route stays outside the shell (no nav on login page).

- [x] **1.8 Offline Isolation Support (PWA Canvas Sync)**
    - `@angular/pwa` service worker for core layout caching.
    - Offline soil-check interactions write to IndexedDB; reconciliation loop syncs on reconnect.

- [x] **1.9 Pre-Upload Client Image Compression**
    - Offscreen HTML5 Canvas pipeline in journal upload component.
    - All uploads resized below **300KB** before hitting the network.

### 🔒 Phase 1 QA Acceptance Criteria

1. `supabase db test` — users cannot access/edit/delete data owned by other users (100% RLS).
2. Offline mode via browser inspector — watering interactions captured without uncaught network exceptions.

---

## 2. Phase 2: External Integrations, Microclimates & Caching Proxy

- **Objective:** Connect to third-party botanical registries and weather metrics via a caching layer protecting free API rate limits.

### 📋 Phase 2 Tasks

- [x] **2.1** `cached_botanical_records` table + Edge Function cache-first lookup
    - Migration: `cached_botanical_records` table with all botanical fields and RLS policies.
    - `botanical-search` Deno Edge Function — cache-first: checks DB by `scientific_name` before calling Perenual search endpoint.
    - On cache hit: returns stored row immediately (no outbound call).
    - On cache miss: calls Perenual, writes result to `cached_botanical_records` via service_role, returns fresh data.
- [x] **2.2** Botanical name autocomplete in Add Plant form (requires 2.1)
    - Autocomplete input in Add Plant form debounces user input and queries `botanical-search` Edge Function.
    - Dropdown suggestions show `common_name` + `scientific_name`; selecting pre-fills both fields and stores `perenual_id` on the plant record.
    - Minimum 2 characters before query fires; loading skeleton shown during fetch.
- [x] **2.3 Soil Check Depth Fix** | Agent: `/visualizer`
    - Replace the hardcoded `checkDepth` computed in `soil-check-dialog.ts` with a substrate-keyed map.
    - Research-backed values (UConn CAHNR Extension, UMN Extension, Missouri Botanical Garden):
      High-Drainage Aroid / Standard Potting / Heavy Peat → 3 cm; Sphagnum Moss Mix → 2 cm; Desert Succulent → 5 cm.
    - Dialog text updated to show qualitative description alongside the depth (e.g. "Let soil dry completely — check 5 cm deep").
    - No DB migration needed — client-side display fix only.
- [x] **2.4 Perenual Taxonomy Integration + AI Scribe fallback** | Agent: `/plumber`
    - Extend `botanical-search` Edge Function to call Perenual `species/details` endpoint after a cache miss.
    - Populate `cached_botanical_records` with Perenual-sourced fields: `watering`, `sunlight`, `cycle`, `plant_type`.
    - On null fields: chain into `claude-enrichment` Edge Function (AI Scribe) to fill `ideal_min_ph/max_ph`, `is_toxic_to_pets`, `toxicity_notes`, `propagation_methods`.
    - Set `is_ai_enriched = true` after Scribe pass; `perenual_id` links the plant record to the cache row.
- [ ] **2.5 Open-Meteo Meteorological Proxy** | Agent: `/plumber`
    - New Edge Function `weather-proxy` calling the Open-Meteo free API (no API key required).
    - Returns current temperature, humidity, precipitation probability for a given lat/lon.
    - Response cached in `frost_date_cache` table (Phase 3.6 stub) with a short TTL; no redundant outbound calls.
    - No Angular UI at this phase — backend data layer only; consumed by Phase 3.6 frost alerts.
- [ ] **2.6 Monday Morning Email Digest** | Agent: `/plumber`
    - Edge Function `digest-email` queries all users' overdue and due-today plants grouped by zone.
    - Composes and sends an HTML email via Resend API (free tier: 100 emails/day).
    - Triggered by a Supabase cron job (pg_cron) firing every Monday at 07:00 UTC.
    - `RESEND_API_KEY` stored in Edge Function secrets — never in client bundle.
- [ ] **2.7 Web Push Notification Architecture** | Agent: `/plumber` → `/visualizer`
    - Generate VAPID key pair (one-time); store private key in Edge Function secrets.
    - Angular `PushNotificationService` requests browser push permission on first login and stores the subscription.
    - New `push_subscription JSONB` column on `profiles` (nullable) to persist the subscription endpoint.
    - Edge Function checks for overdue plants and sends push payloads to subscribed devices.
- [ ] **2.8 Plant Browser & Botanical Wiki** | Agent: `/visualizer` → `/plumber`
    - New `/library` route with filter controls: watering frequency, sunlight, pet toxicity, lifecycle type.
    - Filters query `cached_botanical_records`; cache miss triggers Perenual fetch + AI Scribe (requires 2.4).
    - Species detail panel shows pH range, propagation methods, toxicity flags, watering/sunlight/cycle.
    - "Add to my greenhouse" action pre-fills Add Plant form with `common_name`, `scientific_name`, `perenual_id`.
- [ ] **2.9 Journal Feed** | Agent: `/visualizer`
    - New `/journal` route listing all `plant_journals` entries for the authenticated user.
    - Grouped by plant, ordered by `logged_at DESC`; filterable by `log_category_type`.
    - Photo thumbnails resolved from `image_storage_path` via Supabase Storage public URL.
    - Each entry links back to the plant's scheduler card.

### 🔒 Phase 2 QA Criteria

1. No third-party API tokens in client bundles.
2. Repeated identical queries within 60s hit the DB cache exactly once.
3. Library filter changes do not trigger new external API calls if results are cached.

---

## 3. Phase 3: Cognitive AI Core & Advanced Gardening Modules

- **Objective:** Multimodal plant health analytics, AI data enrichment, and advanced cultivation tracking.

### 📋 Phase 3 Tasks

- [ ] **3.1** Claude Data Enrichment (AI Scribe) — Edge Function `claude-enrichment`
    - Fills missing Perenual fields: `ideal_min_ph`, `ideal_max_ph`, `is_toxic_to_pets`, `toxicity_notes`, `propagation_methods`.
    - Extended schema: also enriches `check_depth_description` (qualitative watering depth text per species), `ideal_humidity_min`, `ideal_humidity_max` (species-specific RH %), `care_difficulty` (Beginner / Intermediate / Advanced).
    - New columns added to `cached_botanical_records`; see `docs/DB_SCHEMA_MATRIX.md §2.4` and `docs/AI_PROMPT_MANIFEST.md §1`.
    - Once live, `check_depth_description` replaces the substrate-based approximation from Phase 2.3.
- [ ] **3.2 Plant Growth Stage Field** | Agent: `/plumber` → `/visualizer`
    - Migration: `growth_stage_type` ENUM (`'Seedling'`, `'Juvenile'`, `'Mature'`, `'Dormant'`) + `growth_stage` column on `plants` (default `'Mature'`).
    - Modify `snooze_plant_check` RPC to apply a multiplier: Seedling × 0.5, Juvenile × 1.0, Mature × 1.0, Dormant × 2.0.
    - Plant form: add growth stage select field.
    - Soil check dialog: show growth stage in the plant context line.
    - Note: `Seed` is excluded — seeds belong in the Seed Vault (Phase 3.5), not in `plants`.
- [ ] **3.3 Care Recommendations Panel** | Agent: `/visualizer`
    - Surface AI-enriched fields on the plant profile card: `check_depth_description`, `ideal_humidity_min/max`, `sunlight` (from Perenual), `watering` frequency.
    - Compare `ideal_humidity_min/max` against the zone's `humidity_baseline` and flag when the zone is outside the plant's tolerance.
    - The `check_depth_description` field from the enriched record overrides the substrate-approximation shown in Phase 2.3 when the species has been AI-enriched.
    - No additional DB migration — all fields added in Phase 3.1.
- [ ] **3.4** Multimodal Vision Diagnostics (AI Leaf Doctor) | Agent: `/plumber` → `/visualizer`
    - New `claude-vision` Edge Function receives a base64 image + plant context from the client.
    - Claude Sonnet multimodal call; system prompt and JSON schema from `docs/AI_PROMPT_MANIFEST.md §3`.
    - Returns: `is_botanical_image`, `primary_condition`, `confidence_score`, `immediate_remedial_actions`, `systemic_risk_assessment`.
    - Angular: upload/camera trigger inside the Journal entry form; diagnostic result displayed as a card in the journal feed.
    - Safety guard: `is_botanical_image: false` shows a user-facing error state — never crashes or guesses.
- [ ] **3.5** Intelligent Seed Vault Module (`/vault`) | Agent: `/plumber` → `/visualizer`
    - Migration: `seed_batches` table (stub in `docs/DB_SCHEMA_MATRIX.md §7`); `seed_stage_type` ENUM already defined.
    - Stage progression: Stored → Sown Indoors → Germinated → Potted Up → Hardened Off → Transplanted Outside.
    - New `/vault` route: seed batch list with add / edit / delete CRUD and stage transition UI.
    - Tracks brand, packet year, sown date, germination date, and free-text notes per batch.
    - Stage transitions are forward-only and timestamp-stamped; no regression allowed.
- [ ] **3.6** Real-Time Frost Line Alerts | Agent: `/plumber` → `/visualizer`
    - User configures coordinates (lat/lon) on their profile or outdoor zone.
    - Reads from `weather-proxy` Edge Function (Phase 2.5); caches result in `frost_date_cache` table (DB stub).
    - Dashboard warning bar appears when current or forecast temperature threatens outdoor zones.
    - Alert clears automatically when frost risk passes; no user action required.
    - New `latitude` / `longitude` columns on `profiles` (nullable) to store the user's location.
- [ ] **3.7** Companion Planting & Allelopathy Lookup Engine | Agent: `/plumber` → `/visualizer`
    - `companion_planting_rules` table (DB stub) seeded with known beneficial / allelopathic / neutral pairs.
    - UI panel (Library or Dashboard): select two plants → relationship status returned from lookup.
    - Alert badge on zone card when an allelopathic conflict is detected among plants sharing the same zone.
    - Rules are read-only for users — seed data only, no client writes to the rules table.
- [ ] **3.8** Substrate Composition Mix Wizard | Agent: `/visualizer`
    - Standalone wizard accessible from the Library or a dedicated tab (no disruption to daily dashboard flow).
    - User selects genus profile (Epiphytic Aroid, Desert Succulent, Carnivorous Bog, etc.) and inputs pot volume in litres.
    - Pure client-side math outputs volumetric breakdown (e.g. 40% Orchid Bark, 30% Perlite, 30% Coco Coir).
    - Add `pot_diameter_cm INT` (nullable) to `plants` table — pre-fills pot volume when the user opens the wizard from their plant profile.
- [ ] **3.9** AI Plant Identifier (Photo-to-Species) | Agent: `/plumber` → `/visualizer`
    - Upload / camera action inside the Add Plant form triggers `claude-plant-id` Edge Function.
    - Claude Sonnet multimodal call; system prompt and JSON schema from `docs/AI_PROMPT_MANIFEST.md §2`.
    - Returns: `species_match` (common name, scientific name, confidence score) + up to 3 `alternative_candidates`.
    - On successful identification: checks `cached_botanical_records`; queues AI Scribe enrichment if the species is absent.
    - Pre-fills `common_name`, `scientific_name`, `perenual_id` in Add Plant form from the identified species.
    - Safety guard: `is_plant_image: false` shows error state — never hallucinates a species name.

### 🔒 Phase 3 QA Criteria

1. AI modules reject non-botanical images without crashing; structured JSON returned on both paths.
2. Claude JSON output validated against `docs/AI_PROMPT_MANIFEST.md` schemas before any DB write.
3. Plant Identifier `is_plant_image` guard verified on both true/false paths.

---

## 4. Phase 4: Theming & Internationalisation

- **Objective:** Dark/light theme toggle with system-preference detection and localStorage persistence; runtime multilingual support (EN/FR/NL) without page reload.

### 📋 Phase 4 Tasks

- [ ] **4.1** Dark/Light Theme Toggle | Agent: `/visualizer`
    - `ThemeService` singleton reads `flora-theme` from localStorage; falls back to `prefers-color-scheme` media query.
    - Theme stored as a Signal; an `effect()` persists every change to localStorage and toggles `.dark` on `<html>`.
    - Tailwind `dark:` variants handle all token switching — no manual class juggling in components.
    - `ThemeToggleComponent` in the nav bar renders a sun / moon icon button (requires 1.7).
    - No page reload — theme change is immediate and reactive.
- [ ] **4.2** i18n EN / FR / NL | Agent: `/visualizer`
    - Install and configure `@jsverse/transloco`; `LocaleService` wraps active locale as a Signal.
    - Translation files: `src/assets/i18n/{en,fr,nl}.json` covering every user-facing string.
    - `LanguageSwitcherComponent` added to the nav bar; selection persisted to localStorage (requires 1.7).
    - Full string audit across all components and templates — no hardcoded UI text left after this phase.
    - Language switch applies in the same render cycle without page reload.

### 🔒 Phase 4 QA Criteria

1. No `flora-theme` key in localStorage + browser set to dark → `.dark` on `<html>` on first paint.
2. Language switch updates all strings on current route within same render cycle, zero page reload.
3. `bun run lint` — zero errors after all Phase 4 code.

---

## Design Refactor Reference

**Visual design spec:** `https://api.anthropic.com/v1/design/h/sXAF8Iv27kBfEnAbIYb-RQ?open_file=FloraFlow.html`

> **⚠️ Do not start automatically.** Always ask the user before beginning — they confirm when the design is final.

When instructed: (1) diff design color/radius/shadow values against `@theme` tokens in `src/styles.input.css`; (2) update PT objects in `src/app/shared/ui/pt/`; (3) update `docs/DESIGN_SYSTEM.md` tokens; (4) no Angular structural changes needed.
