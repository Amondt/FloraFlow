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

Client routes are protected by checking user authentication against the internal active Supabase session.

    export const routes: Routes = [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'scheduler',
        loadComponent: () => import('./features/scheduler/scheduler.component').then(m => m.SchedulerComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'journal',
        loadComponent: () => import('./features/journal/journal.component').then(m => m.JournalComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'library',
        loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent),
        canActivate: [AuthGuard]
      },
      {
        path: 'vault',
        loadComponent: () => import('./features/vault/vault.component').then(m => m.VaultComponent),
        canActivate: [AuthGuard]
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: '**', redirectTo: 'dashboard' }
    ];

---

## 4. Frontend Resilience Primitives & Engineering Details

The frontend application code must be built with three specific client-side optimizations to respect our free-tier bounds and support real-world garden environments:

### 📶 4.1 Progressive Web App (PWA) Offline Sinks

- **Context:** Gardening tasks frequently happen in yards, greenhouses, or balconies where Wi-Fi connections drop out completely.
- **Implementation:** The application must utilize Angular's `@angular/pwa` service worker engine from day one.
- **State Capture:** When offline, user interactions (such as soil checks or snooze ticks) must write seamlessly into a browser IndexedDB layer managed by an internal synchronization service.
- **Reconciliation Loop:** The service worker must listen for online connection state transitions. Once connection is restored, a robust reconciliation loop pushes cached logs back to the remote database using an optimistic synchronization layout.

### 🖼️ 4.2 Local Pre-Upload Image Compression

- **Context:** High-resolution modern smartphone camera photos quickly bloat storage arrays. Uploading raw files will completely burn through our 1GB free Supabase storage bucket within weeks.
- **Implementation:** The journal upload component must intercept files _before_ they are sent via the Supabase SDK.
- **Execution:** Photos are loaded into an offscreen HTML5 Canvas utility layer. The script performs client-side downscaling and compression, squeezing files below an absolute max threshold of **300KB** before triggering the upload payload stream.

### 🔄 4.3 Outbound API Rate Limiting & Caching Protocol

- **Context:** Free tiers of public botanical indices (such as Perenual or Pl@ntNet) place strict monthly throttle limits on API keys.
- **Implementation:** The Angular data integration layers are prohibited from directly connecting client apps to third-party endpoints during searches.
- **Execution Pipe:** All botanical calls target our unified backend proxy cache first (`cached_botanical_records`). If the query misses the database cache, a secure serverless Deno Edge Function handles the external lookup, sanitizes the response, indexes it globally, and safely returns the light record payload back down to the frontend UI.
