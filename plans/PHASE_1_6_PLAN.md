# Task 1.6 — Offline Isolation Support (PWA Canvas Sync)

## Context

FloraFlow's scheduler lets users record soil-check results (confirm or snooze). These interactions hit Supabase RPCs and fail silently without a network. Task 1.6 makes the app resilient: the service worker caches the app shell so the UI loads offline, and any soil-check interactions made while offline are queued in IndexedDB and replayed automatically when the connection returns.

---

## Architecture Overview

```
Browser (offline)
  └─ PlantService.confirmCheck() / snoozeCheck()
       ├─ online  → Supabase RPC (existing path)
       └─ offline → OfflineQueueService.enqueue() + optimistic signal update

Browser (back online)
  └─ NetworkStatusService emits isOnline = true
       └─ PlantService reconciliation loop
            ├─ drains IndexedDB queue item by item (FIFO)
            ├─ replays each action against Supabase RPC
            └─ calls loadPlants() to refresh scheduler state
```

---

## Block A — PWA Foundation

**Agent:** `/visualizer`
**Files:** `ngsw-config.json` (new), `angular.json` (auto-patched), `src/app/app.config.ts`

1. Run `bunx ng add @angular/pwa --skip-confirmation` — scaffolds `ngsw-config.json`, patches `angular.json` with `"serviceWorker": true`, injects manifest link into `index.html`.
2. Edit `ngsw-config.json`:
   - `assetGroups` — `installMode: "prefetch"` for app shell (JS/CSS/HTML); `installMode: "lazy"` for optional assets.
   - `dataGroups` — **none** (Supabase API calls must never be cached).
3. Add to `app.config.ts`:
   ```typescript
   provideServiceWorker('ngsw-worker.js', {
     enabled: !isDevMode(),
     registrationStrategy: 'registerWhenStable:30000'
   })
   ```

**Why:** Service worker only activates in production builds. `registerWhenStable` avoids blocking startup.

---

## Block B — NetworkStatusService

**Agent:** `/visualizer`
**File:** `src/app/core/services/network-status.service.ts` (new)

1. Create `NetworkStatusService` with `providedIn: 'root'`.
2. `isOnline = signal<boolean>(navigator.onLine)`.
3. In `afterNextRender()`, attach `window` `online`/`offline` event listeners that call `isOnline.set(true/false)`.
4. Clean up with `DestroyRef.onDestroy()`.

**Why:** `navigator.onLine` gives the initial state; the events track changes reactively. `afterNextRender()` is required for browser API access in the zoneless model.

---

## Block C — OfflineQueueService (IndexedDB)

**Agent:** `/plumber`
**File:** `src/app/core/services/offline-queue.service.ts` (new)
**Dependency:** `bun add idb` (tiny ~1.5 KB Promise-based IndexedDB wrapper)

IndexedDB store schema:
```typescript
interface QueuedAction {
  id: string;           // crypto.randomUUID()
  action: 'confirm' | 'snooze';
  plant_id: string;
  snooze_days?: number; // only for 'snooze'
  queued_at: string;    // ISO timestamp
}
```

DB name: `floraflow-offline` / Store name: `action-queue` / keyPath: `id`

Expose:
- `enqueue(action: QueuedAction): Promise<void>`
- `getAll(): Promise<QueuedAction[]>`
- `remove(id: string): Promise<void>`
- `clear(): Promise<void>`
- `pendingCount = signal<number>(0)` — refreshed after every enqueue/remove for UI badge.

**Why:** `idb` eliminates the callback pyramid of raw IndexedDB. Items are removed individually after successful sync so a partial failure doesn't wipe the whole queue.

---

## Block D — Offline-aware PlantService

**Agent:** `/plumber`
**File:** `src/app/features/scheduler/plant.service.ts` (modify)

1. Inject `NetworkStatusService` and `OfflineQueueService`.
2. `confirmCheck(plantId)`:
   - Online → existing Supabase RPC path (unchanged).
   - Offline → `enqueue({ action: 'confirm', plant_id: plantId, ... })` + optimistic signal update: set `last_checked_at = now()`, advance `next_check_due_at` by `current_snooze_interval_days`.
3. `snoozeCheck(plantId, snoozeDays)`:
   - Online → existing Supabase RPC path (unchanged).
   - Offline → `enqueue({ action: 'snooze', plant_id: plantId, snooze_days: snoozeDays, ... })` + optimistic signal update: advance `next_check_due_at` by `snoozeDays` from today.
4. The scheduler's `computed()` urgency groups re-derive automatically — no template changes needed.

**Why:** Optimistic updates keep the UI responsive offline. The scheduler sees the plant as "handled" immediately, preventing duplicate interactions.

---

## Block E — Reconciliation Loop

**Agent:** `/plumber`
**File:** `src/app/features/scheduler/plant.service.ts` (continue modifying)

1. Add an `effect()` watching `NetworkStatusService.isOnline`.
2. When `isOnline()` transitions to `true`:
   - `getAll()` — returns items in FIFO order.
   - For each item, `await` the matching RPC (`confirm_plant_check` or `snooze_plant_check`).
   - On success → `remove(item.id)`.
   - On failure → leave in queue, `console.error`, continue (best-effort per-item).
3. After drain → `loadPlants()` to pull fresh server state.
4. `isSyncing = signal<boolean>(false)` toggled around the drain loop.

**Why:** FIFO preserves intent order. Best-effort per-item means a transient RPC error doesn't block other queued actions.

---

## Block F — Offline Indicator (Shell UI)

**Agent:** `/visualizer`
**Files:** `src/app/shared/components/shell/shell.ts`, `shell.html` (modify)

1. Inject `NetworkStatusService` and `OfflineQueueService` into `ShellComponent`.
2. In `shell.html`, add a narrow banner above `<router-outlet>`:
   - `@if (!isOnline())` → amber banner: *"You are offline. Soil checks will sync when reconnected."*
   - `@if (isSyncing())` → *"Syncing N pending actions…"* using `pendingCount`.
3. Tailwind tokens from `docs/DESIGN_SYSTEM.md` only — no inline CSS.
4. `role="status"` + `aria-live="polite"` on the banner element.

**Why:** Visibility of system status is a core UX heuristic. The user must know their actions are queued, not lost.

---

## Critical Files

| File | Status | Notes |
|------|--------|-------|
| `ngsw-config.json` | New | Scaffold via `ng add @angular/pwa` |
| `angular.json` | Modify | Auto-patched by `ng add` |
| `src/app/app.config.ts` | Modify | Add `provideServiceWorker` |
| `src/app/core/services/network-status.service.ts` | New | Online/offline signal |
| `src/app/core/services/offline-queue.service.ts` | New | IndexedDB via `idb` |
| `src/app/features/scheduler/plant.service.ts` | Modify | Offline fork + reconciliation loop |
| `src/app/shared/components/shell/shell.ts` | Modify | Inject services for banner |
| `src/app/shared/components/shell/shell.html` | Modify | Offline/syncing banner |

---

## Verification Checklist

1. **Service worker active:** `bun run build` → `npx serve dist/flora-flow/browser` → DevTools → Application → Service Workers: `ngsw-worker.js` registered and active.
2. **Offline queue writes:** DevTools → Network → Offline. Confirm/snooze a plant. DevTools → Application → IndexedDB → `floraflow-offline` → `action-queue`: item appears.
3. **Reconciliation:** Go back online. IndexedDB store empties; plant list refreshes with server state.
4. **Offline banner:** Amber banner visible while offline; disappears on reconnection.
5. **Zero failed requests offline:** DevTools → Network tab shows no failed Supabase calls during offline interactions.
6. **Lint:** `bun run lint` — zero errors.

---

## Sub-task Summary

| Block | Description | Agent | Scope |
|-------|-------------|-------|-------|
| A | PWA scaffold + ngsw-config.json + provideServiceWorker | `/visualizer` | Build config, app.config |
| B | NetworkStatusService (online/offline signal) | `/visualizer` | New Angular service |
| C | OfflineQueueService (IndexedDB via `idb`) | `/plumber` | New data-layer service |
| D | Offline-aware PlantService (offline fork + optimistic update) | `/plumber` | Modify existing service |
| E | Reconciliation loop (drain queue on reconnect) | `/plumber` | Modify existing service |
| F | Offline indicator banner in ShellComponent | `/visualizer` | Modify shell template |

**Execution order:** A → B → C → D → E → F
