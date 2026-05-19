# `docs/PHASES_PLAN.md` - Iterative Build Roadmap & QA Verification Checklists

This document establishes the official development sprints, feature milestone groupings, and QA acceptance criteria for **FloraFlow**. **The Mind (Architect Agent)** and **The Gatekeeper (QA Agent)** must use this file to track build progress and verify feature completeness.

---

## 1. Phase 1: Local Foundations, Core Loops & Data Storage

- **Objective:** Establish the local environment, secure authentication, user profile generation, and the core observational data loop. All state logic is managed offline-first using Angular Signals and local storage/IndexedDB.

### 📋 Phase 1 Task Checklist

- [x] **1.1 Workspace Architecture Validation**
    - Initialize the Angular 21 application tree following the directory structure defined in `APP_SPEC.md`.
    - Configure Tailwind CSS v4 custom tokens and unstyled PrimeNG provider properties inside `styles.css` and `app.config.ts`.
    - Install and configure ESLint + `@angular-eslint` — verify `bun run lint` passes on a clean scaffold.
    - Install and configure Vitest for Angular component testing.

- [x] **1.2 Supabase Infrastructure Activation**
    - Spin up local Docker development containers using the Supabase CLI.
    - Execute the baseline DDL migrations defined in `DB_SCHEMA_MATRIX.md` to establish tables: `profiles`, `zones`, `plants`, and `plant_journals`.
    - Apply Row-Level Security (RLS) configurations across all initialized tables.

- [x] **1.3 Authentication Shell & Routing Implementation**
    - Code the accessible semantic HTML `login.component` wrapped using PrimeNG PT components.
    - Bind the client routes with an asynchronous `AuthGuard` that checks active Supabase sessions.

- [x] **1.4 Virtual Greenhouse Dashboard (Local CRUD)**
    - Create the dashboard grid component to display localized environmental cards (`zones`).
    - Implement form models to handle data updates for microclimate properties (e.g., window orientation, active ventilation, supplemental grow lights, and humidity baselines).

- [x] **1.5 Smart Observation Scheduling Loop**
    - Build the state engine using Angular Signals to display all plants grouped into four urgency sections: **Overdue**, **Due today**, **Due this week** (next 7 days), and **Upcoming** (beyond 7 days).
    - `PlantService.loadPlants()` fetches all user plants (no time filter); urgency grouping is derived client-side via `plantsGrouped` computed in `SchedulerComponent`.
    - Implement the confirmation dialog modal asking the user: _"Is the soil dry at the required depth?"_
    - Code the local **Smart Snooze** computation script: if the user flags the soil as wet, automatically push the target plant's `next_check_due_at` timestamp back by a calculated 2, 5, or 7-day interval derived from `snooze_interval_rules`.

- [x] **1.5.1 Plant CRUD (Add / Edit / Delete)**
    - Build a plant form dialog in `src/app/features/scheduler/` allowing users to add plants to a zone.
    - Form fields: `common_name` (required), `scientific_name` (optional), `zone_id` (select from user's zones), `container_vector` (enum select), `substrate_factor` (enum select).
    - Wire delete confirmation via PrimeNG ConfirmDialog with 5-second undo toast.
    - Extend `PlantService` with `createPlant()`, `updatePlant()`, `deletePlant()` methods.
    - `createPlant()` uses `.select().single()` on insert to return the server row directly — avoids clock-skew issues with the urgency filter.
    - This is a prerequisite for Phase 2.6 ("Add to my greenhouse" shortcut).

- [ ] **1.6 Offline Isolation Support (PWA Canvas Sync)**
    - Integrate `@angular/pwa` service worker assets to allow the app to cache core layout elements locally.
    - Bind browser connection monitoring tools to intercept data adjustments when offline, pushing pending logs into IndexedDB caches until connection is restored.

- [ ] **1.7 Pre-Upload Client Image Compression**
    - Code an offscreen HTML5 Canvas pipeline within your journaling file component.
    - Verify that uploaded smartphone attachments are programmatically resized below **300KB** before they hit the network stream.

### 🔒 Phase 1 QA Acceptance Criteria (Gatekeeper Rules)

1. Running `supabase db test` must verify that user accounts cannot access, edit, or delete data records owned by other user contexts (100% RLS coverage).
2. Simulating offline mode via browser inspector tools must capture watering interactions cleanly without throwing uncaught runtime network exceptions.

---

## 2. Phase 2: External Integrations, Microclimates & Caching Proxy

- **Objective:** Connect the local backend proxy to third-party botanical registries and weather metrics, implementing a caching layer to protect free API rate limits.

### 📋 Phase 2 Task Checklist

- [ ] **2.1 Global Botanical Caching Infrastructure**
    - Deploy table `cached_botanical_records` to act as the primary query target.
    - Build an outbound query check routine: the app must always search local cache rows first. If the record doesn't exist, it routes the lookup request to a secure Supabase Edge Function to avoid leaking keys.

- [ ] **2.1.1 Botanical Name Autocomplete in Add Plant Form**
    - Replace the free-text `common_name` and `scientific_name` inputs in `PlantFormDialogComponent` with PrimeNG `p-autocomplete` fields.
    - As the user types ≥ 2 characters, query `cached_botanical_records` (common_name and scientific_name columns) via the Supabase client — never via an external API call.
    - On selection from the suggestion list, auto-populate both name fields and store the matched `perenual_id` on the form so downstream enrichment pipelines (Phase 2.2, 3.1) can resolve the species without an extra lookup.
    - Free-text entry must still be allowed as a fallback when no cache match exists (the user may be adding a species not yet indexed).
    - **Prerequisite:** Task 2.1 must be complete — the `cached_botanical_records` table and its Edge Function population pipeline must exist before this autocomplete has a data source to query.

- [ ] **2.2 Perenual Taxonomy Integration (AI Scribe Fallback)**
    - Code the serverless Deno Edge Function wrapper to process queries against the Perenual API endpoint.
    - Build an automated parsing engine to clean up data responses. If the external registry returns empty records or arrays, pass the missing data flags to the **AI Scribe** pipeline for automated enrichment fallback processing.

- [ ] **2.3 Localized Meteorological Integration (Open-Meteo Proxy)**
    - Code the background integration layer connecting user coordinates to the Open-Meteo public endpoints.
    - Synchronize outdoor microclimate configurations with regional wind speed metrics, UV exposure values, and relative humidity trends.

- [ ] **2.4 Unified Monday Morning Email Digest (Resend Integration)**
    - Draft an HTML template script that iterates over uncompleted soil-check actions grouped by greenhouse zone.
    - Write a cron-triggered Supabase Edge function that uses the Resend infrastructure SDK to distribute this compiled overview directly to users' inboxes every Monday at zero cost.

- [ ] **2.5 Web Push Notification Architecture**
    - Code native service worker notifications inside the PWA background script to push instant care alerts directly to user screens.

- [ ] **2.6 Plant Browser & Botanical Wiki**
    - Build a dedicated `/library` route and `src/app/features/library/` feature module.
    - Implement a filterable plant directory that queries the Perenual caching proxy from task 2.1/2.2 — the Angular client must never call the external API directly.
    - Expose filter controls for key discovery traits: watering frequency, sunlight requirements, toxicity status, and plant lifecycle type (annual, perennial, indoor, outdoor).
    - Each plant card in the results list opens an expandable detail panel that reads from `cached_botanical_records`, triggering the AI Scribe enrichment fallback on demand if the cached record is incomplete.
    - Wire a **"Add to my greenhouse"** shortcut action directly into the detail panel to pre-fill the Add Plant form with the identified species name.

### 🔒 Phase 2 QA Acceptance Criteria (Gatekeeper Rules)

1. Verify via code analysis that no third-party API tokens are bundled inside client browser files. All outgoing connection strings must stay locked in your secure server environment.
2. Confirm that repeating identical plant identity queries inside a 60-second window hits the database cache exactly once, preserving your monthly request limits.
3. Confirm the `/library` filter controls produce correct query parameters on the Edge Function proxy — changing filters must not trigger a new external API call if results are already cached.

---

## 3. Phase 3: Cognitive AI Core & Advanced Gardening Modules

- **Objective:** Introduce multimodal computer vision analytics for plant health, automated profile data enrichment via Claude AI JSON schemas, and advanced micro-cultivation tracking engines.

### 📋 Phase 3 Task Checklist

- [ ] **3.1 Claude Data Enrichment Architecture (The AI Scribe)**
    - Implement a serverless edge processing workflow that triggers when external botanical queries fail to yield comprehensive results.
    - Instruct Claude to generate properly structured data records matching your PostgreSQL columns (e.g., ideal soil pH ranges, pet toxicity details, and typical propagation paths).

- [ ] **3.2 Multimodal Vision Diagnostics (AI Leaf Doctor)**
    - Build an analysis interface within the plant journal view to capture leaf images.
    - Send the image payload to the Claude Anthropic API alongside specialized system rules. The model must return an isolated JSON layout specifying detected health issues, immediate care recommendations, and systemic risk assessments.

- [ ] **3.3 Intelligent Seed Vault Module**
    - Build a dedicated crop-tracking dashboard module that maps seed batch shelf-life metrics and seed production origin data.
    - Code state management handlers to track seed sets as they transition through milestone stages: `Sown Indoors` -> `Germinated` -> `Potted Up` -> `Hardened Off` -> `Transplanted Outside`.

- [ ] **3.4 Real-Time Frost Line Alerts**
    - Code an alert system inside the dashboard that cross-references local outdoor weather updates with historical regional charts.
    - Throw real-time UI warning bars across the screen if an unseasonal late-spring frost or sudden early-autumn freeze drops into active outdoor zones.

- [ ] **3.5 Companion Planting & Allelopathy Lookup Engine**
    - Implement an interactive cultivation grid layout component for outdoor garden beds.
    - Build a lookup helper script that flags beneficial matches (e.g., Marigolds shielding roots) and throws safety alerts if incompatible crops are placed together (e.g., fennel allelopathy risks).

- [ ] **3.6 Substrate Composition Mix Wizard**
    - Code a lightweight volume calculation tool that operates independently from the main dashboard views.
    - Add a dropdown select menu for plant species and an input form for container sizes. Output precise material requirements (e.g., 40% Orchid Bark, 30% Perlite, 30% Coco Coir) based on target volume formulas.

- [ ] **3.7 AI Plant Identifier (Photo-to-Species Pipeline)**
    - Add a new system prompt and JSON response schema to `docs/AI_PROMPT_MANIFEST.md` for the species-identification pipeline.
    - Build a new Supabase Edge Function (`supabase/functions/claude-plant-id`) that sends the uploaded image to Claude Sonnet's multimodal API using the identification system prompt.
    - The response schema must return: a `is_plant_image` boolean guard, a primary `species_match` (common name + scientific name + confidence score), and up to three ranked `alternative_candidates`.
    - Integrate the identifier into the **Add Plant form flow**: expose a camera/upload button that, on completion, passes the identified species names directly into the form fields — eliminating manual lookup for unknown plants.
    - On a successful identification, immediately trigger a `cached_botanical_records` lookup and queue an AI Scribe enrichment pass if the species is not yet cached.

### 🔒 Phase 3 QA Acceptance Criteria (Gatekeeper Rules)

1. The **Gatekeeper Agent** must verify that Claude AI diagnostic modules reject non-botanical images (e.g., pictures of people or unrelated household objects) without crashing, returning an appropriate user warning instead.
2. Confirm that all structured JSON strings generated by Claude are validated against your schema models before being written to the database cache table.
3. The **AI Plant Identifier** must reject non-plant images using its `is_plant_image` guard (same pattern as the Leaf Doctor's `is_botanical_image` guard) — verify both paths return structured JSON without runtime exceptions.

---

## Design Refactor Reference

**Visual design spec (claude.ai/design):** `https://api.anthropic.com/v1/design/h/sXAF8Iv27kBfEnAbIYb-RQ?open_file=FloraFlow.html`

> **⚠️ Do not start this pass automatically.** The design is still a work in progress on claude.ai/design. Always ask the user explicitly before beginning — they will confirm when the design is final and ready to implement.

When instructed by the user, run a design-alignment pass:
1. Extract all color/radius/shadow values from the design and diff against `@theme` tokens in `src/styles.input.css`
2. Update PT objects in `src/app/shared/ui/pt/` to match the design's component shapes
3. Update `docs/DESIGN_SYSTEM.md` to reflect any new or changed tokens
4. No Angular structural changes required — PT objects are the only seam
