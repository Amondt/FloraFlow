# Zone Detail View — Phase 2.10 Plan

**Goal:** Clicking a zone card name navigates to `/dashboard/zones/:id` — a dedicated page showing all plants in that zone, with per-plant soil check and species info dialogs.

**Data:** No DB migrations. Reads from `ZoneService.zones()` and `PlantService.plants()` signals — both are `providedIn: 'root'` and already loaded on login.

**Note on `perenual_id`:** `PlantService.loadPlants()` does not currently select `perenual_id`. Block D uses `scientific_name` as the lookup key and guard for the species info button.

---

- [ ] **Block A — Route + zone-card navigation link** | Agent: `/visualizer`
  - In `app.routes.ts`: convert the flat `{ path: 'dashboard', loadComponent: DashboardComponent }` entry to a componentless parent with two children — `{ path: '' }` for the dashboard and `{ path: 'zones/:id' }` for the zone detail. The shell `<router-outlet>` renders both; no structural change to any component is needed.
  - Create `src/app/features/dashboard/zone-detail/zone-detail.ts` — stub only (zone name from route + back link).
  - Create `src/app/features/dashboard/zone-detail/zone-detail.html`.
  - In `zone-card.html`: convert the zone-name `<h2>` to an `<a [routerLink]="['/dashboard/zones', zone().id]">` — keep identical font/size styles, add `hover:text-primary-600 transition-colors` and `FLORA_FOCUS` for keyboard nav. The `[id]` attribute stays on the anchor so `aria-labelledby` continues to work on the `<article>`.
  - Add `RouterLink` to `zone-card.ts` imports.
  - Verification: click a zone name on the dashboard → navigates to `/dashboard/zones/[id]`; click the back link → returns to `/dashboard`.

- [ ] **Block B — Zone header + plant list** | Agent: `/visualizer`
  - `ZoneDetailComponent` receives `id = input<string>('id')` — auto-bound from the route param (`withComponentInputBinding()` is already configured in `app.config.ts`).
  - Call `zoneService.loadZones()` and `plantService.loadPlants()` in the constructor — both services guard against redundant re-fetches so this is safe for direct navigation.
  - `zone = computed(() => this.zoneService.zones().find(z => z.id === this.id()))` — when undefined (bad ID or still loading), show a "Zone not found" fallback.
  - `zonePlants = computed(() => this.plantService.plants().filter(p => p.zone_id === this.id()))`.
  - Template structure:
    - Back link: `<a [routerLink]="['/dashboard']">← Dashboard</a>` (eyebrow style, `text-xs uppercase tracking-widest`).
    - Page header (h1): zone name, row of microclimate badges (window orientation, humidity %, grow lights active/inactive, ventilation active/inactive) — reuse the same badge style from `zone-card.html`.
    - Plant list `<ul>` — per plant: name (bold), scientific name (italic, neutral-500), status chip (overdue/due today/on track), container + substrate badges.
    - Skeleton placeholders while `zoneService.loading() || plantService.loading()`.
    - Empty state: "No plants in this zone yet — add one from the Dashboard."
  - Verification: navigate to a zone with plants → all listed; empty zone → empty state; unknown zone ID → "Zone not found" message.

- [ ] **Block C — Soil check integration** | Agent: `/visualizer`
  - `activeSoilPlant = signal<Plant | null>(null)`.
  - Per plant card: "Check soil" button (primary, full `FloraButtonPT`) → `activeSoilPlant.set(plant)`.
  - Render `<app-soil-check-dialog>` only when `activeSoilPlant()` is non-null. Bind `[visible]="true"` and `(visibleChange)="onSoilDialogClose($event)"`.
  - `confirmed` output → `plantService.confirmCheck(plant.id)` → toast "Soil check logged".
  - `snoozed` output → `plantService.snoozeCheck(plant.id)` → toast "Check snoozed".
  - On close: `activeSoilPlant.set(null)`.
  - Add `ToastModule`, `MessageService` (local provider), `SoilCheckDialogComponent` to imports.
  - Verification: click "Check soil" → dialog opens with correct plant name and substrate depth text; confirm → status chip updates; snooze → status chip updates; toast appears for each action.

- [ ] **Block D — Species info dialog** | Agent: `/visualizer`
  **Requires Phase 2.8 complete.** During 2.8, the botanical detail dialog must be extracted to a shared component at `src/app/shared/components/botanical-detail-dialog/botanical-detail-dialog.ts` so it can be reused here without duplicating template code.

  - Add `fetchByScientificName(name: string): Promise<CachedBotanicalRecord | null>` to `LibraryService` — single-row query: `.from('cached_botanical_records').select('*').eq('scientific_name', name).maybeSingle()`.
  - `activeSpeciesRecord = signal<CachedBotanicalRecord | null>(null)`.
  - `speciesLoading = signal(false)`.
  - Per plant card: "Species info" button (outlined `FloraButtonPT`):
    - Hidden when `plant.scientific_name` is null (no cached species to look up).
    - On click: `speciesLoading.set(true)` → `libraryService.fetchByScientificName(name)` → `activeSpeciesRecord.set(result)` → `speciesLoading.set(false)`.
    - While loading: show a spinner inline on the button (or disable it).
  - `<app-botanical-detail-dialog [record]="activeSpeciesRecord()" [visible]="activeSpeciesRecord() !== null" (visibleChange)="onSpeciesClose($event)" />`.
  - Verification: plant with scientific_name → "Species info" button visible; click → dialog opens with pH, sunlight, watering, toxicity; plant without scientific_name → button hidden; DevTools Console → zero errors.
