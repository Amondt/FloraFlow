# `docs/PRD.md` - Product Requirements Document

This document defines the high-level roadmap, core concept mechanics, target module specifications, and functional boundaries for **FloraFlow**. It serves as the primary reference point for **The Mind (Architect Agent)** to derive granular development tasks.

---

## 1. Core Philosophy & Target Audience

Unlike rigid traditional gardening platforms that rely on generic time-based watering schedules, FloraFlow is designed as an interactive, context-aware observation dashboard, care journal, and microclimate companion. The primary goal is to educate growers, eliminate root-rot caused by algorithmic care timers, and provide a transparent, data-driven window into plant health.

---

## 2. Baseline Gardening Modules (The Observational Approach)

### 🏡 2.1 The Virtual Greenhouse (Contextual Dashboard)

- **Functional Description:** A responsive grid interface that groups a user's plant assets into explicit localized environments.
- **Ecosystem Separation:** Supports both indoor environments (e.g., Living Room, Bathroom) and outdoor configurations (e.g., Raised Bed A, Balcony).
- **Contextual Modifiers:** Each individual zone tracks and displays unique environmental parameters that modify care logic:
    - Window Orientation (North, South, East, West, Northeast, Northwest, Southeast, Southwest, or None).
    - Presence of Active Ventilation / Heating Registers.
    - Supplemental Grow Light Arrays (Boolean Toggle).
    - Base Relative Humidity Estimates (Percentage Input).

### ⏰ 2.2 Smart "Check-Soil" Scheduler (Anti-Root-Rot Engine)

- **Functional Description:** Replaces scheduled programmatic timers with dynamic, state-based observation alerts.
- **Interaction Loop:** The system generates a "Check Task" instead of a "Water Task". Clicking the task triggers a modal overlay asking the user: _"Is the soil dry at the required depth?"_
- **Action Logic Tunnels:**
    - **If Dry:** The user logs a watering event; the system updates the profile and resets the task according to the plant's core baseline.
    - **If Still Wet:** The interface fires a **Smart Snooze** event. The check task is dynamically postponed by 2, 5, or 7 days, depending entirely on the container vector and substrate factors defined below. This observation is saved to calculate historical evaporation rates.

### 🌿 2.3 Context-Aware Plant Profiles

Every plant instance records structural care matrices to feed the Smart Snooze delay calculation engine:

- **Container Vector Options:**
    - _Terracotta:_ Porous material, highly breathable, accelerates moisture evaporation.
    - _Plastic / Ceramic:_ High moisture retention, limits root aeration.
    - _Fabric / Self-Watering:_ Specialized moisture-wicking properties.
- **Substrate Factor Options:**
    - _High-Drainage Aroid Mix:_ Coarse, heavily aerated, drops water rapidly.
    - _Heavy Peat Mix:_ Dense soil configuration, retains moisture long-term.
    - _Standard Potting Soil / Desert Succulent Mix / Sphagnum Moss Mix_.

### 📸 2.4 Multi-Modal Botanical Journaling

- **Functional Description:** A visual progress timeline that maps compressed historical photographs per individual plant asset.
- **Log Categorization rules:** Users can filter logs across specific operational event markers: `Observation`, `Pruning`, `Repotting`, `Fertilization`, and `Pest Treatment`.

---

## 3. Advanced Agricultural Expansion Modules

### 🗄️ 3.1 Intelligent Seed Vault & Germination Tracker

- **Functional Description:** Specialized logging ecosystem tailored for vegetable, fruit, and annual crop production.
- **Inventory Tracking:** Coordinates seed package age metrics, manufacturer/brand origin signatures, and historical success/germination rates per batch.
- **Life Cycle Milestone Transitions:** Tracks seed batches as they advance through rigid environmental and physiological status updates:
    - `Sown Indoors` ──> `Germinated` ──> `Potted Up` ──> `Hardened Off` ──> `Transplanted Outside`

### ❄️ 3.2 Dynamic Frost-Date & Planting Window Automation

- **Functional Description:** Uses real-time meteorological data arrays to compute safety margins for outdoor crops.
- **Algorithmic Cross-Reference:** Intersects user-configured local regional coordinates with historical regional charts and real-time frost line shifts.
- **Alert System:** Issues warning highlights on the central dashboard if a late-spring frost or sudden early-autumn freeze threatens outdoor zones.

### 🗺️ 3.3 Companion Planting & Allelopathy Matrix

- **Functional Description:** A defensive grid lookup helper mapped directly to physical outdoor cultivation grids.
- **Relationship Mapping:**
    - _Beneficial Pairings:_ Highlighting symbiotic associations (e.g., Marigolds blocking root nematodes; Basil modifying tomato defense profiles).
    - _Allelopathic Violations:_ Issuing active UI alerts if a user places incompatible plants in proximity (e.g., Fennel exudates or Allelopathic Walnut elements).

### 🧪 3.4 Soil & Substrate Composition Calculator

- **Functional Description:** A non-disruptive math wizard tool isolated completely from the daily dashboard flow.
- **Calculation Flow:** The user selects a target genus profile (e.g., Epiphytic Aroid, Desert Succulent, Carnivorous Bog) and inputs total target pot volumes (in Liters or Inches). The utility outputs a localized breakdown of raw volumes required (e.g., 40% Orchid Bark, 30% Perlite, 30% Coco Coir).

---

## 4. 🔔 Smart Notification Delivery Architecture

To strictly preserve our absolute $0/month serverless requirement, standard commercial notification pipelines are omitted in favor of two direct strategies:

- **Native PWA Web Push:** Implemented within the frontend browser service worker thread to broadcast immediate soil-check task warnings directly to desktop screens and mobile notification shade layers for free.
- **Resend Email Digest Integration:** An automated cron engine wakes up a serverless function to compile uncompleted tasks across all environmental zones into an elegant HTML digest. This summary email is pushed to the gardener's inbox every Monday morning at zero infrastructure cost.
