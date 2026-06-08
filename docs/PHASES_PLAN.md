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
  - Plant form dialog in `src/app/features/tasks/`.
  - Fields: `common_name` (required), `scientific_name` (optional), `zone_id` (select), `container_vector` (enum), `substrate_factor` (enum).
  - Delete confirmation via PrimeNG ConfirmDialog + 5-second undo toast.
  - `PlantService`: `createPlant()`, `updatePlant()`, `deletePlant()`.
  - `createPlant()` uses `.select().single()` on insert to return the server row.

- [x] **1.7 App Shell & Navigation**
  - `src/app/shared/components/shell/shell.ts` — layout component wrapping `<router-outlet>` + nav bar.
  - `src/app/shared/components/nav/nav.ts` — nav links via `routerLink` + `routerLinkActive` for all five routes: Dashboard, Tasks, Journal, Library, Seeds.
  - Style nav links using `FloraMenuPT` and Tailwind tokens.
  - Update `app.ts` to render `<app-shell>` instead of bare `<router-outlet>`.
  - Login route stays outside the shell (no nav on login page).

- [x] **1.8 Offline Isolation Support (PWA Canvas Sync)**
  - `@angular/pwa` service worker for core layout caching.
  - Offline soil-check interactions write to IndexedDB; reconciliation loop syncs on reconnect.

- [x] **1.9 Pre-Upload Client Image Compression**
  - Offscreen HTML5 Canvas pipeline in journal upload component.
  - All uploads resized below **300KB** before hitting the network.

- [x] **1.10 Onboarding Wizard** | Agent: `/plumber` → `/visualizer`
  - Migration: `has_completed_onboarding BOOLEAN DEFAULT FALSE NOT NULL` on `profiles`.
  - New `ProfileService` singleton exposes the profile signal and `completeOnboarding()` PATCH.
  - New `onboardingGuard` redirects unauthenticated-onboarding users to `/onboarding`; applied to shell route.
  - `/onboarding` route outside the shell (no nav bar); three-step wizard: Welcome → Create Zone → All Set.
  - Completion writes the flag and navigates to `/dashboard`; back-navigation to `/onboarding` immediately forwards to `/dashboard`.
  - Plan: `docs/plans/phase-1/PHASE_1_10_PLAN.md`

- [x] **1.11 Plant Form Dialog UX Redesign** | Agent: `/visualizer`
  - Split the single "Plant name" autocomplete into two dedicated sections: **Species (optional)** and **My plant's name (required)**.
  - Species section: autocomplete search when unselected; read-only chip (🌿 Common · _Scientific_ + "Change" button) when a species is locked.
  - Nickname section: always-visible plain text input, pre-filled from species common name on selection but always editable.
  - Remove the standalone scientific name input from the visible form (data still wired internally).
  - No DB migration — `common_name` remains the user's display label; `scientific_name` and `perenual_id` wiring unchanged.
  - Plan: `docs/plans/phase-1/PHASE_1_11_PLAN.md`

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
- [x] **2.5 Open-Meteo Meteorological Proxy** | Agent: `/plumber`
  - New Edge Function `weather-proxy` calling the Open-Meteo free API (no API key required).
  - Returns current temperature, humidity, precipitation probability for a given lat/lon.
  - Response cached in `frost_date_cache` table (Phase 3.6 stub) with a short TTL; no redundant outbound calls.
  - No Angular UI at this phase — backend data layer only; consumed by Phase 3.6 frost alerts.
- [x] **2.6 Monday Morning Email Digest** | Agent: `/plumber`
  - Edge Function `digest-email` queries all users' overdue and due-today plants grouped by zone.
  - Composes and sends an HTML email via Resend API (free tier: 100 emails/day).
  - Triggered by a Supabase cron job (pg_cron) firing every Monday at 07:00 UTC.
  - `RESEND_API_KEY` stored in Edge Function secrets — never in client bundle.
- [x] **2.7 Web Push Notification Architecture** | Agent: `/plumber` → `/visualizer`
  - Generate VAPID key pair (one-time); store private key in Edge Function secrets.
  - Angular `PushNotificationService` requests browser push permission on first login and stores the subscription.
  - New `push_subscription JSONB` column on `profiles` (nullable) to persist the subscription endpoint.
  - Edge Function checks for overdue plants and sends push payloads to subscribed devices.
- [x] **2.8 Plant Browser & Botanical Wiki** | Agent: `/visualizer` → `/plumber`
  - New `/library` route with filter controls: watering frequency, sunlight, pet toxicity, lifecycle type.
  - Filters query `cached_botanical_records`; cache miss triggers Perenual fetch + AI Scribe (requires 2.4).
  - Species detail panel shows pH range, propagation methods, toxicity flags, watering/sunlight/cycle.
  - "Add to my plants" action pre-fills Add Plant form with `common_name`, `scientific_name`, `perenual_id`.
- [x] **2.9 Journal Feed** | Agent: `/visualizer`
  - New `/journal` route listing all `plant_journals` entries for the authenticated user.
  - Grouped by plant, ordered by `logged_at DESC`; filterable by `log_category_type`.
  - Photo thumbnails resolved from `image_storage_path` via Supabase Storage public URL.
  - Each entry links back to the plant's tasks card.
  - Plan: `docs/plans/phase-2/PHASE_2_9_PLAN.md`
- [x] **2.10 Zone Detail View** | Agent: `/visualizer`
  - New route `/dashboard/zones/:id` — shows all plants in a zone with per-plant soil check and species info dialogs.
  - Zone card name becomes a navigation link; back link returns to `/dashboard`.
  - Reuses `SoilCheckDialogComponent` (Block C) and the shared botanical detail dialog extracted during 2.8 (Block D).
  - No new migrations — reads from existing `ZoneService` and `PlantService` signals.
  - Plan: `docs/plans/phase-2/PHASE_2_10_PLAN.md`
- [x] **2.11 Background Botanical Cache Enrichment Worker** | Agent: `/plumber`
  - `botanical-search` extended to paginate all Perenual pages (up to 5 pages, ~150 results max) per query — no slice limit.
  - `_shared/enrich-record.ts` extracted: `ENRICHMENT_SYSTEM_PROMPT`, `EnrichmentSchema`, `fetchINatThumbnail()`, and `enrichRecord()` shared between `claude-enrichment` and the new worker.
  - `claude-enrichment` refactored to use shared module — zero API contract change.
  - New `cache-enrichment-worker` Edge Function: processes 5 unenriched `cached_botanical_records` per run (Claude AI + iNaturalist), ordered by `cached_at DESC` (most recently searched first).
  - New pg_cron job: fires `cache-enrichment-worker` every 10 minutes.
  - Plan: `docs/plans/phase-2/PHASE_2_11_PLAN.md`
- [x] **2.12 Library Species Grouping** | Agent: `/visualizer`
  - Client-side grouping of library results by common name — multi-cultivar species collapse into one card with a variety count badge.
  - Botanical detail dialog gains an inline cultivar picker (chip strip ≤5, dropdown >5) between the identity strip and the content tabs — switching cultivar updates all content tabs in-place.
  - "Add to my plants" and "Track seeds" always act on the currently selected cultivar.
  - No DB migration — pure computed transformation of the existing `results()` signal.
  - Plan: `docs/plans/phase-2/PHASE_2_12_PLAN.md`

### 🔒 Phase 2 QA Criteria

1. No third-party API tokens in client bundles.
2. Repeated identical queries within 60s hit the DB cache exactly once.
3. Library filter changes do not trigger new external API calls if results are cached.

---

## 3. Phase 3: Cognitive AI Core & Advanced Gardening Modules

- **Objective:** Multimodal plant health analytics, AI data enrichment, and advanced cultivation tracking.

### 📋 Phase 3 Tasks

- [x] **3.1** Claude Data Enrichment (AI Scribe) — Edge Function `claude-enrichment`
  - Fills missing Perenual fields: `ideal_min_ph`, `ideal_max_ph`, `is_toxic_to_pets`, `toxicity_notes`, `propagation_methods`.
  - Extended schema: also enriches `check_depth_description` (qualitative watering depth text per species), `ideal_humidity_min`, `ideal_humidity_max` (species-specific RH %), `care_difficulty` (Beginner / Intermediate / Advanced).
  - New columns added to `cached_botanical_records`; see `docs/DB_SCHEMA_MATRIX.md §2.4` and `docs/AI_PROMPT_MANIFEST.md §1`.
  - Once live, `check_depth_description` replaces the substrate-based approximation from Phase 2.3.
- [x] **3.2 Plant Growth Stage Field** | Agent: `/plumber` → `/visualizer`
  - Migration: `growth_stage_type` ENUM (`'Seedling'`, `'Juvenile'`, `'Mature'`, `'Dormant'`) + `growth_stage` column on `plants` (default `'Mature'`).
  - Modify `snooze_plant_check` RPC to apply a multiplier: Seedling × 0.5, Juvenile × 1.0, Mature × 1.0, Dormant × 2.0.
  - Plant form: add growth stage select field.
  - Soil check dialog: show growth stage in the plant context line.
  - Note: `Seed` is excluded — seeds belong in the Seeds module (Phase 3.5), not in `plants`.
  - Plan: `docs/plans/phase-3/PHASE_3_2_PLAN.md`
- [x] **3.3 Care Recommendations Panel** | Agent: `/visualizer`
  - Surface AI-enriched fields on the plant profile card: `check_depth_description`, `ideal_humidity_min/max`, `sunlight` (from Perenual), `watering` frequency.
  - Also surface Phase 3.10 fields when available: `description`, `preferred_soil_type`, `maintenance_level`, `native_region`.
  - Compare `ideal_humidity_min/max` against the zone's `humidity_baseline` and flag when the zone is outside the plant's tolerance.
  - The `check_depth_description` field from the enriched record overrides the substrate-approximation shown in Phase 2.3 when the species has been AI-enriched.
  - No additional DB migration — all fields added in Phase 3.1 and Phase 3.10.
- [x] **3.4** Multimodal Vision Diagnostics (AI Leaf Doctor) | Agent: `/plumber` → `/visualizer`
  - New `claude-vision` Edge Function receives a base64 image from the client.
  - Claude Sonnet multimodal call; system prompt and JSON schema from `docs/AI_PROMPT_MANIFEST.md §3`.
  - Returns: `is_botanical_image`, `primary_condition`, `confidence_score`, `immediate_remedial_actions`, `systemic_risk_assessment`.
  - Angular: dedicated "Diagnose a Plant" dialog on the journal page — diagnose first, then optionally save as an Observation entry pre-filled with the diagnostic result. The care log form ("Log Care Event") is not involved.
  - Diagnostic results stored in `diagnostics JSONB` on `plant_journals`; displayed as a collapsible section on journal entry cards.
  - Safety guard: `is_botanical_image: false` shows a user-facing error state — never crashes or guesses.
- [x] **3.5** Intelligent Seed Vault Module (`/seeds`) | Agent: `/plumber` → `/visualizer`
  - Migration: `seed_batches` table (stub in `docs/DB_SCHEMA_MATRIX.md §7`); `seed_stage_type` ENUM already defined.
  - Stage progression: Stored → Sown Indoors → Germinated → Potted Up → Hardened Off → Transplanted Outside.
  - New `/seeds` route: seed batch list with add / edit / delete CRUD and stage transition UI.
  - Tracks brand, packet year, sown date, germination date, and free-text notes per batch.
  - Stage transitions are forward-only and timestamp-stamped; no regression allowed.
- [x] **3.6** Real-Time Frost Line Alerts | Agent: `/plumber` → `/visualizer`
  - User configures coordinates (lat/lon) on their profile or outdoor zone.
  - Reads from `weather-proxy` Edge Function (Phase 2.5); caches result in `frost_date_cache` table (DB stub).
  - Dashboard warning bar appears when current or forecast temperature threatens outdoor zones.
  - Alert clears automatically when frost risk passes; no user action required.
  - New `latitude` / `longitude` columns on `profiles` (nullable) to store the user's location.
  - **Phase 3.10 integration:** when botanical records are available, scope frost warnings to plants with `placement = 'Outdoor'` or `'Both'` only — indoor-exclusive plants are excluded from frost risk.
- [~] **3.7** Companion Planting & Allelopathy Lookup Engine — **Dropped**
  - Research confirmed the primary mechanism (root exudate allelopathy) requires shared soil and does not apply to plants in separate pots, which covers the majority of FloraFlow's indoor use cases. Manual data curation would be required (no API source exists), and the feature would generate warnings that don't reflect real risk for potted plants. Dropped in favour of building features with genuine value for the app's actual context.
- [x] **3.8** Substrate Composition Mix Wizard | Agent: `/visualizer`
  - Plan: `docs/plans/phase-3/PHASE_3_8_PLAN.md`
  - Standalone wizard accessible from the Library or a dedicated tab (no disruption to daily dashboard flow).
  - User selects genus profile (Epiphytic Aroid, Desert Succulent, Carnivorous Bog, etc.) and inputs pot volume in litres.
  - Pure client-side math outputs volumetric breakdown (e.g. 40% Orchid Bark, 30% Perlite, 30% Coco Coir).
  - Add `pot_diameter_cm INT` (nullable) to `plants` table — pre-fills pot volume when the user opens the wizard from their plant profile.
  - After computing the breakdown, the wizard estimates the resulting **mix pH range** using documented component midpoints: fir/pine bark 4.0–6.5, sphagnum moss 3.5–4.5, peat 3.5–4.8, coco coir 6.0–6.8, perlite ~7.0 (sources: PT Horticulture, OrchidResourceCenter, KiS Organics). Simplified weighted mean — adequate for practical gardening guidance.
  - When opened from a plant profile that has `ideal_min_ph`/`ideal_max_ph` in `cached_botanical_records`, the wizard compares the estimated mix pH against the plant's ideal range and surfaces either a "pH compatible" badge or a mismatch warning (e.g. "This mix sits at ~6.5–7.0 — too alkaline for a plant needing pH 4.5–5.5").
  - A one-line caveat is shown alongside the estimate: "Estimated pH — not a lab measurement." No new DB migration needed — client-side computation only.
  - **Phase 3.10 integration:** when `preferred_soil_type` is available from the botanical record, pre-select the genus profile that most closely matches those soil descriptors (e.g. `['Well-draining', 'Sandy']` → Desert Succulent profile).
- [x] **3.9** AI Plant Identifier (Photo-to-Species) | Agent: `/plumber` → `/visualizer`
  - Upload / camera action inside the Add Plant form triggers `claude-plant-id` Edge Function.
  - Claude Sonnet multimodal call; system prompt and JSON schema from `docs/AI_PROMPT_MANIFEST.md §2`.
  - Returns: `species_match` (common name, scientific name, confidence score) + up to 3 `alternative_candidates`.
  - On successful identification: checks `cached_botanical_records`; queues AI Scribe enrichment if the species is absent.
  - Pre-fills `common_name`, `scientific_name`, `perenual_id` in Add Plant form from the identified species.
  - Safety guard: `is_plant_image: false` shows error state — never hallucinates a species name.
- [x] **3.10 Extended Plant Profile — Schema, AI Enrichment & Multi-Surface UI** | Agent: `/plumber` → `/visualizer` → `/gatekeeper`
  - Depends on 3.1 (AI Scribe must be deployed first).
  - **Block A** — Migration: 16 new columns on `cached_botanical_records`.
  - **Block B** — AI Scribe extended to fill all 16 new fields; `docs/AI_PROMPT_MANIFEST.md §1` updated.
  - **Block C** — Botanical detail dialog: 4 tabs (Overview / Care / Growth & Seasons / Safety) + "Add to greenhouse" care advisory for Advanced plants.
  - **Block D** — Library card: `description` subtitle + `care_difficulty` + `placement` badges.
  - **Block E** — Zone detail plant card: `care_difficulty` + `placement` + `is_tropical` badges via batch botanical fetch.
  - **Block F** — Library filters: 6 new filter dimensions (Placement, Care Difficulty, Maintenance, Tropical, Air-Purifying, Safe for Humans).
  - **Block G** — Plant-zone compatibility warnings: amber inline alerts on zone detail cards when `placement` or tropical humidity needs conflict with the zone.
  - Plan: `docs/plans/phase-3/PHASE_3_10_PLAN.md`
- [x] **3.11 Plant Species Thumbnails (iNaturalist)** | Agent: `/plumber` → `/visualizer` → `/gatekeeper`
  - Depends on 3.10 Block C (identity strip image slot).
  - **Block A** — Migration: `thumbnail_url TEXT` + `regular_url TEXT` on `cached_botanical_records`.
  - **Block B** — AI Scribe: parallel Claude + iNaturalist fetch; cache sentinel + client filter extended with `thumbnail_url != null`.
  - **Block C** — UI wiring: identity strip (`regular_url`), library card (`thumbnail_url`), zone detail card (`thumbnail_url`). Leaf icon fallback on all surfaces. `loading="lazy"` on every `<img>`.
  - Plan: `docs/plans/phase-3/PHASE_3_11_PLAN.md`
- [x] **3.12 Botanically-Informed Snooze & Confirm** | Agent: `/mind` + `/plumber`
  - **Client (`soil-check-dialog.ts`):** `recommendedDays` now computes `SNOOZE_MATRIX[container×substrate] × WATERING_MULTIPLIER[watering] × GROWTH_MULTIPLIER[growth_stage]`, clamped to [1–14]. All three multipliers applied client-side so the user sees the exact days that will be stored.
  - **Presets expanded:** `snoozePresets` changed from `[2,5,7]` to `[2,5,7,10,14]`; grid updated to `grid-cols-5` to cover the full botanical range.
  - **Dry path fixed:** `onConfirm()` emits `recommendedDays()` as `days`; both `tasks.ts` and `zone-detail.ts` pass it to `confirmCheck(plantId, days)`; dry-step text updated.
  - **`plant.service.ts`:** `confirmCheck` accepts `snoozeDays`; passes it to the RPC and to the offline queue; offline replay uses it with a fallback of 5.
  - **Migration (plumber):** `confirm_plant_check` drops old single-param signature and adds `p_snooze_days INT`; `snooze_plant_check` drops growth-stage multiplier — both become simple writers. After migration: `bun run types` + copy types to `_shared`.
- [x] **3.13 Journal Entry Edit / Delete + Care-Tips-Style Accordion** | Agent: `/visualizer`
  - No DB migration — pure frontend work within `src/app/features/journal/`.
  - `JournalService`: `updateEntry(id, payload)` and `deleteEntry(id)` methods.
  - `JournalEntryFormComponent`: edit mode via `editEntry` input — pre-fills category, notes, date; hides photo section; updates dialog title and submit label.
  - `JournalEntryCardComponent`: card footer with Edit + Delete buttons + diagnostic "Action points" accordion toggle (zone-detail Care tips pattern); `editRequested` and `deleteRequested` outputs.
  - `JournalComponent`: `ConfirmationService` delete flow, `editingEntry` signal, wires both events to the shared form dialog.
  - Plan: `docs/plans/phase-3/PHASE_3_13_PLAN.md`
- [x] **3.14 Multi-Image Leaf Doctor** | Agent: `/plumber` → `/visualizer`
  - Enhancement to 3.4: user can upload up to 3 photos per diagnosis session; all are sent to Claude as a single multi-image request for better diagnostic precision.
  - No DB migration — primary image still stored in `image_storage_path`; additional images are ephemeral (analysis only); diagnosis result in `diagnostics JSONB` already covers the full multi-image analysis.
  - `claude-vision` Edge Function: request body changes from `{ imageBase64, imageMediaType }` to `{ images: [{imageBase64, imageMediaType}, ...] }` (1–3 items); each becomes an `image` content block in Claude's `content[]` array.
  - Angular dialog: three scalar signals become arrays (`compressedBlobs`, `previewObjectUrls`, `compressedLabels`); "Add photo" button hidden at 3; per-thumbnail remove button; adding/removing a photo resets diagnosis state.
  - `docs/AI_PROMPT_MANIFEST.md §3.0` updated to document the new `images[]` request shape.
  - Plan: `docs/plans/phase-3/PHASE_3_14_PLAN.md`
- [x] **3.15 Leaf Doctor from Zone Detail** | Agent: `/plumber` → `/visualizer`
  - Leaf Doctor accessible from every plant card in zone-detail, not only from the Journal.
  - Because the plant is already known, the dialog locks the plant selector and shows a read-only name badge instead.
  - Optional `plantContext` field added to the `claude-vision` request body; Claude receives the species name in the prompt and tailors its diagnosis to that species. Both flows send it — the journal flow requires the user to pick a plant first; the zone-detail flow locks the preselected plant.
  - No DB migration — pure frontend + Edge Function enhancement.
  - Plan: `docs/plans/phase-3/PHASE_3_15_PLAN.md`
- [ ] **3.16 iNaturalist Migration & Botanical Cache Hardening** | Agents: `/plumber` → `/visualizer`
  - Retire Perenual API (free tier capped at species IDs 1–3,000); adopt iNaturalist taxa API as primary search source (no key, 10M+ species, inline thumbnails, common names included).
  - DB migration: `inat_taxon_id INTEGER NULL` on `cached_botanical_records` and `plants`; existing `perenual_id` and `is_perenual_enriched` columns kept for backward compat.
  - Rewrite `botanical-search` Edge Function: single iNat call replaces the 5-page Perenual loop; `thumbnail_fetched = true` set on upsert (photos are inline).
  - Update `_shared/enrich-record.ts`: skip iNat thumbnail HTTP call when already populated; populate `inat_taxon_id` from all enrichment paths.
  - Update `claude-plant-id`: return `inat_taxon_id`; insert cache stub for newly identified species so the background cron picks them up.
  - Thread `inat_taxon_id` through Angular: `BotanicalSuggestion`, `Plant`, `PlantFormData`, `PlantIdentifiedEvent`, all form dialogs, and all spec fixtures.
  - Library per-page enrichment: `_enrichCurrentPage()` fires only for the visible page; `goToPage()` triggers next-page enrichment.
  - Block G: one-shot `inat-backfill` Edge Function populates `inat_taxon_id` for all 924 existing records; `group-botanical-records.util.ts` refactored to group by `inat_taxon_id` — cultivar cards correctly collapse into one species card.
  - `locale=en` added to all iNat queries; `thumbnail_fetched` retained as infinite-retry guard for species absent from iNat's photo database.
  - Plan: `docs/plans/phase-3/PHASE_3_16_PLAN.md`
- [ ] **3.17 Species Photo Gallery (iNaturalist Carousel)** | Agent: `/plumber` → `/visualizer`
  - Depends on 3.16 complete — `inat_taxon_id` must be populated on all records before the gallery fetch can run.
  - iNat's `/v1/taxa/{id}` endpoint returns `taxon_photos[]` (typically 6–12 photos per species); no API key required.
  - DB migration: `gallery_urls TEXT[] NULL` on `cached_botanical_records` — stores up to 6 medium-sized photo URLs.
  - `_shared/enrich-record.ts`: new `fetchINatGallery()` helper; `enrichRecord()` extended to populate `gallery_urls` when `inat_taxon_id` is known and `gallery_urls IS NULL`.
  - `inat-backfill` extended: populates `gallery_urls` alongside `inat_taxon_id` in the same pass.
  - New `SpeciesPhotoCarouselComponent`: prev/next arrows + dot pagination; falls back to leaf icon when empty.
  - Botanical detail dialog: lightbox removed; identity strip replaced with the carousel (feeds `regular_url` + `gallery_urls`).
  - Library cards and zone detail cards keep their single `thumbnail_url` — carousel is dialog-only.
  - Plan: `docs/plans/phase-3/PHASE_3_17_PLAN.md`
- [ ] **3.18 Leaf Doctor Diagnostic Honesty** | Agent: `/plumber` → `/visualizer`
  - Refinement to 3.4/3.15: the `claude-vision` response schema forces a `diagnostics` object with a mandatory `primary_condition`, so a healthy plant or a wrong-species photo gets a confabulated condition. Add honest escape hatches instead.
  - Additive `claude-vision` response fields (no migration — `diagnostics` is `jsonb`): `is_healthy`, `identified_plant`, `species_matches_context`; `diagnostics` becomes null when healthy.
  - System prompt rewrite (`AI_PROMPT_MANIFEST.md §3`): identify first, healthy is a valid outcome, evidence-gated diagnosis, species cross-check against `plantContext`.
  - UX: species mismatch shows a non-blocking amber banner (still diagnoses what's in the photo); healthy plant shows a reassuring panel and saves a positive checkup.
  - Sequencing: independent of 3.16/3.17 — build immediately after 3.15.
  - Plan: `docs/plans/phase-3/PHASE_3_18_PLAN.md`

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
- [ ] **4.3 Logout Button** | Agent: `/visualizer`
  - "Sign out" button in the top nav, pushed to the far right with `ml-auto`.
  - Calls `SupabaseService.signOut()` then navigates to `/login` unconditionally (Supabase clears the local session immediately regardless of network state).
  - Spinner replaces icon while the call is in-flight; button disabled during that window.
  - Plan: `docs/plans/phase-4/PHASE_4_3_PLAN.md`
- [ ] **4.4 Create Account (Sign-up)** | Agent: `/plumber` → `/visualizer`
  - New `SupabaseService.signUp()` method returning `{ error, needsEmailConfirmation }`.
  - New `/register` route (public, no guard) with email + password + confirm-password form.
  - On success: shows "Check your inbox" state when email confirmation is required, or redirects to `/login` when auto-confirmed (local dev).
  - "Don't have an account? Create one" link added to the bottom of the login page.
  - "Already have an account? Sign in" link on the register page.
  - Plan: `docs/plans/phase-4/PHASE_4_4_PLAN.md`

### 🔒 Phase 4 QA Criteria

1. No `flora-theme` key in localStorage + browser set to dark → `.dark` on `<html>` on first paint.
2. Language switch updates all strings on current route within same render cycle, zero page reload.
3. Clicking "Sign out" in the nav clears the Supabase session and redirects to `/login`; navigating to `/dashboard` after signing out redirects back to `/login`.
4. Submitting `/register` with valid unique credentials produces either the confirmation-pending state or a redirect to `/login`; submitting with mismatched passwords shows a field-level error.
5. `bun run lint` — zero errors after all Phase 4 code.

---

## 5. Phase 5: Mobile Responsive & Touch UX

- **Objective:** Make FloraFlow fully usable on smartphones — thumb-reachable navigation, touch-sized tap targets, filter sheets instead of sidebars, camera-aware photo capture, mobile-first dialog sizing, and pointer-event corrections for touch-only interactions.

### 📋 Phase 5 Tasks

- [ ] **5.1 Viewport & PWA Shell Hardening** | Agent: `/visualizer`
  - Add `viewport-fit=cover` to the `index.html` viewport meta so iOS Safari extends the layout under the notch and home indicator and reports correct safe-area insets.
  - Add base safe-area utility classes to `styles.input.css` using `env(safe-area-inset-bottom)` so bottom-fixed elements never overlap the home indicator.
  - Verify `manifest.webmanifest` has `"display": "standalone"` and a valid `start_url`.

- [ ] **5.2 Responsive Bottom Navigation** | Agent: `/visualizer`
  - On `md+` (≥768 px): keep the existing top `<header>` nav unchanged.
  - On `<md` (<768 px): show a fixed bottom tab bar via `md:hidden` / `block md:hidden` Tailwind variants — pure CSS, no JS breakpoint observer.
  - Bottom bar height: `calc(3.5rem + env(safe-area-inset-bottom, 0px))` so the tab bar clears the iPhone home indicator.
  - Each tab shows a PrimeNG icon (`pi pi-*`) above a short label; active route highlighted with `text-primary-600`.
  - All feature `<main>` wrappers gain `pb-20 md:pb-0` so content is never hidden beneath the tab bar.
  - Top nav gains `max-md:hidden`; bottom nav gains `md:hidden` — both share the same `routerLink` + `routerLinkActive` logic.

- [ ] **5.3 Touch Target Sizing & Active Tap Feedback** | Agent: `/visualizer`
  - All interactive controls reach a minimum 44×44 px tap zone on mobile — add `min-h-11` to PT `root` slots that currently use `h-control` (38 px) where the surrounding padding does not already cover the gap.
  - Plant alert cards, zone cards, journal entry cards, and dashboard task chips gain `active:opacity-70 transition-opacity` so users see immediate tap feedback.
  - Add `touch-action: manipulation` to interactive card lists (`<ul>` elements) to eliminate the 300 ms tap delay without `fastclick`.
  - All `hover:`-only visual feedback classes gain a paired `active:` variant so touch users see the same state.

- [ ] **5.4 Library Filter Bottom Sheet** | Agent: `/visualizer`
  - On `md+`: sidebar `<aside>` unchanged (sticky, `w-52`).
  - On `<md`: sidebar hidden (`max-md:hidden`); a "Filters" pill button appears above the results list.
  - The pill button shows a badge with the count of active filters; badge hidden when no filters are set.
  - Tapping the pill opens a full-width bottom sheet overlay that contains the same `<details>` filter sections.
  - Sheet slides in from the bottom (CSS `transform` + `transition`), dismisses on outside tap or a visible "Done" button.
  - All existing `filters()` signal logic and `clearFilters()` remain unchanged — only the presentation layer changes.

- [ ] **5.5 Responsive Page Layout & Overflow** | Agent: `/visualizer`
  - Reduce side padding on mobile: `p-6` → `px-4 py-6 md:p-6` on every feature `<main>` wrapper (dashboard, tasks, journal, library, seeds, zone-detail).
  - Dashboard header action buttons (`Add plant`, `Identify a plant`) wrap to a second row below `sm` via `flex-wrap`.
  - Journal category tab bar gets `overflow-x-auto` with `scrollbar-gutter: stable` so tabs scroll horizontally on narrow screens without layout shift.
  - Scheduler section-header secondary italics (`"Address first…"`, `"Monitor but no action needed yet"`) hidden on `<md` with `max-md:hidden` — recovers horizontal space for the section title and badge.
  - Zero horizontal overflow verified on every route at 375 px viewport width.

- [ ] **5.6 Mobile-First Dialog Sizing** | Agent: `/visualizer`
  - Update `FloraDialogPT`, `FloraConfirmDialogPT`, and `FloraDetailDialogPT`:
    - `<md`: full-width, no horizontal margin, anchored to bottom (`position: fixed; bottom: 0`), top corners rounded, bottom corners flush.
    - `md+`: centered modal unchanged (existing max-w and centered layout).
  - Dialog content area is scrollable (`overflow-y: auto`) when the virtual keyboard shrinks the iOS Safari viewport.
  - Bottom of dialog respects safe area: `padding-bottom: env(safe-area-inset-bottom, 0px)`.

- [ ] **5.7 Camera-Aware Photo Capture** | Agent: `/visualizer`
  - In `journal-entry-form`: on `<md`, replace the single file `<input>` with two side-by-side labelled inputs:
    - **Take photo** — `<input type="file" accept="image/*" capture="environment">`: launches the back camera directly (iOS + Android).
    - **Choose from library** — `<input type="file" accept="image/*">`: opens the native media picker.
  - Both inputs are visually styled as buttons via `<label>` wrappers; the raw `<input>` is visually hidden.
  - On `md+`, the original single styled file input is shown unchanged (`max-md:hidden` / `md:block`).
  - Both inputs call the same `onFileChange()` handler, feeding the existing canvas compression pipeline.
  - No service or backend changes — the output blob is identical regardless of capture path.

- [ ] **5.8 Pointer Events & Hover Interaction Fixes** | Agent: `/visualizer`
  - Replace `(mousedown)` on the library pH slider wrapper with `(pointerdown)` so the active-handle tracker fires on both mouse drag and touch drag.
  - Convert the five CSS hover-only tooltips in the library filter sidebar (watering, sunlight, pet toxicity, lifecycle, soil pH) from `group-hover:visible` to a `signal<boolean>` tap-toggle per tooltip button.
  - Each tooltip closes when another opens, and closes on a `(document:click)` listener so tapping outside dismisses it.
  - Audit remaining `hover:` classes app-wide: any that reveal information (not just colour/opacity) gain a `focus-visible:` twin so keyboard and touch users always see the same content.

### 🔒 Phase 5 QA Criteria

1. Chrome DevTools mobile emulation at 375×812 (iPhone 12): zero horizontal overflow on every route; all five bottom nav tabs reachable without scrolling.
2. Journal entry form on touch emulation: **Take photo** triggers camera; **Choose from library** opens media picker — both produce a compressed image that appears in `compressedLabel()`.
3. Library pH slider: drag-able with touch emulation (DevTools Sensors → Touch) without releasing unintentionally.
4. Library at 375 px: filter sheet opens and closes correctly; one-column results grid; no sidebar overflow.
5. All dialogs at 375 px: full-width, not clipped horizontally; Notes textarea scrollable with virtual keyboard open.
6. `bun run lint` — zero errors after all Phase 5 code.

---

## Design Refactor Reference

**Visual design spec:** `https://api.anthropic.com/v1/design/h/sXAF8Iv27kBfEnAbIYb-RQ?open_file=FloraFlow.html`

> **⚠️ Do not start automatically.** Always ask the user before beginning — they confirm when the design is final.

When instructed: (1) diff design color/radius/shadow values against `@theme` tokens in `src/styles.input.css`; (2) update PT objects in `src/app/shared/ui/pt/`; (3) update `docs/DESIGN_SYSTEM.md` tokens; (4) no Angular structural changes needed.
