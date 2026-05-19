# `docs/APP_SPEC.md` - Technical Application Specification

This document defines the technical architecture, framework primitives, directory tree structure, data contracts, and client-side execution boundaries for **FloraFlow**. It guides **The Visualizer (Frontend Agent)** and **The Plumber (Protocol Agent)** to write harmonious, typed code.

---

## 1. Technical Stack Primitives & Runtime

- **Frontend Framework:** Angular 21+ (utilizing standalone component paradigms, strict TypeScript execution flags, and hydration primitives).
- **State Optimization:** Angular Signals (completely eliminating Zone.js monkey-patching dependency overhead for fine-grained re-render loops).
- **UI Foundation:** PrimeNG (configured exclusively in unstyled "PassThrough" (PT) mode).
- **Styling Infrastructure:** Tailwind CSS v4.
- **Backend Architecture:** Supabase BaaS (Data Storage, Auth, Storage Buckets, and Deno Edge Functions).
- **Deployment Vectors:** Static Client bundle targets Cloudflare Pages or Vercel (Free Tiers).

---

## 2. Directory Tree Layout Strategy

To maintain clean separation of concerns and isolate data fetching models from presentation fragments, the Angular workspace must strictly adhere to the following file design:

    src/
    ├── app/
    │   ├── core/                  # Global singletons, auth guards, HTTP/Supabase wrappers
    │   │   ├── services/          # Supabase Client Core, Push Worker Setup
    │   │   └── guards/            # Auth Route Isolation Guards
    │   ├── features/              # Feature modules containing smart components
    │   │   ├── auth/              # Login component (magic-link / email+password)
    │   │   ├── dashboard/         # Greenhouse Zone Grid UI & Overview
    │   │   ├── scheduler/         # Soil-Check Alert Hub & Snooze Modals
    │   │   ├── journal/           # Multi-modal Care Tracking & Photo Feeds
    │   │   ├── library/           # Plant Browser, Botanical Wiki & AI Plant Identifier
    │   │   └── vault/             # Seed Vault & Germination Milestone Tracking
    │   ├── shared/                # Pure visual presentational components
    │   │   ├── components/        # Base Layout Shell, Navs, Accessible Forms
    │   │   └── ui/
    │   │       └── pt/            # PrimeNG PassThrough objects — see docs/DESIGN_SYSTEM.md §3
    │   │           ├── index.ts   # Barrel: re-exports all PT objects and state constants
    │   │           ├── states.pt.ts
    │   │           ├── button.pt.ts
    │   │           ├── card.pt.ts
    │   │           ├── dialog.pt.ts
    │   │           ├── datepicker.pt.ts
    │   │           ├── input.pt.ts
    │   │           ├── select.pt.ts
    │   │           ├── checkbox.pt.ts
    │   │           ├── fileupload.pt.ts
    │   │           ├── toast.pt.ts
    │   │           ├── message.pt.ts
    │   │           ├── popover.pt.ts
    │   │           ├── panel.pt.ts
    │   │           ├── tabs.pt.ts
    │   │           ├── badge.pt.ts
    │   │           ├── skeleton.pt.ts
    │   │           ├── progress.pt.ts
    │   │           └── menu.pt.ts
    │   ├── app.config.ts          # Angular Application Configuration & Providers
    │   └── app.routes.ts          # Central client-side route maps
    └── assets/
        └── icons/                 # SVG Asset Libraries (No bloated icon font bundles)

---

## 3. Client Routing & Route Security

See `src/app/app.routes.ts` for the full route map. All routes except `login` use `canActivate: [authGuard]`.

**Naming rules:** No `.component` suffix (`scheduler.ts` not `scheduler.component.ts`). Guard is functional `authGuard` (lowercase). Routes: `login`, `dashboard`, `scheduler`, `journal`, `library`, `vault`. Default redirects to `dashboard`.

---

## 4. Frontend Resilience Primitives (Phase 1.6+)

Three required optimizations for free-tier bounds and real-world garden environments:

### 📶 4.1 PWA Offline Sinks (Phase 1.6)
`@angular/pwa` service worker caches core layout. Offline soil-check interactions write to IndexedDB; a reconciliation loop syncs back to Supabase once the connection is restored.

### 🖼️ 4.2 Pre-Upload Image Compression (Phase 1.7)
Journal upload component intercepts files before the Supabase SDK upload. Offscreen HTML5 Canvas pipeline compresses to **< 300KB** to protect the 1 GB free storage limit.

### 🔄 4.3 Outbound API Cache Protocol (Phase 2.1)
Angular client never calls third-party botanical APIs directly. All lookups hit `cached_botanical_records` first; on a cache miss, a Deno Edge Function handles the external call and stores the result before returning it to the client.
