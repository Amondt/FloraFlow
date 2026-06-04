# Phase 3.6 Plan — Real-Time Frost Line Alerts

Agent chain: `/plumber` (Blocks A–B) → `/visualizer` (Blocks C–D)

---

## Design Intent

Frost alerts protect outdoor plants. The feature is passive: the user sets their location once, and the dashboard automatically surfaces a warning whenever the current temperature threatens outdoor zones.

Two technical building blocks already exist:
1. `weather-proxy` Edge Function (Phase 2.5) — calls Open-Meteo and caches results in `weather_cache` (30-min TTL).
2. `zone_type` column on `zones` (Phase 3.5) — distinguishes outdoor from indoor zones.

Phase 3.6 adds the location layer on top: the user's lat/lon is stored on their profile and the dashboard calls the weather proxy to derive frost risk.

### Location UX — two-tier strategy

Raw lat/lon inputs are not usable. The location dialog uses a two-tier approach:
- **Tier 1 — Auto-detect**: `navigator.geolocation.getCurrentPosition()` — one tap, no manual input.
- **Tier 2 — City search**: Open-Meteo geocoding API (`geocoding-api.open-meteo.com/v1/search`) — user types a city or region name and picks from a dropdown. No API key required; called directly from Angular. Returns `latitude`, `longitude`, `name`, `admin1`, `country` per result.

The user never sees a coordinate. A `location_name` column on `profiles` stores the human-readable label (e.g. "Brussels, Belgium").

### Frost risk threshold

4 °C (40 °F) — standard horticultural frost warning threshold (frost damage begins near 0 °C for most species; 4 °C provides a safety margin). Defined as a readonly constant in `WeatherService`.

### Phase 3.10 integration note

When `cached_botanical_records.placement` is available (Phase 3.10), the alert can be scoped to plants with `placement = 'Outdoor'` or `'Both'`. In this phase, the alert targets outdoor zones (`zone_type = 'outdoor'`) as a proxy.

---

## Files

**New:**
- `supabase/migrations/<timestamp>_frost_alerts.sql`
- `src/app/core/services/weather.service.ts`
- `src/app/features/dashboard/location-dialog/location-dialog.ts`
- `src/app/features/dashboard/location-dialog/location-dialog.html`

**Modified:**
- `src/app/core/services/profile.service.ts`
- `src/app/features/dashboard/dashboard.ts`
- `src/app/features/dashboard/dashboard.html`

---

- [ ] **Block A — Migration: `profiles` location columns + `frost_date_cache`** | Agent: `/plumber`
  - Create `supabase/migrations/<timestamp>_frost_alerts.sql`:
    ```sql
    -- Location columns on profiles (nullable — user opts in)
    ALTER TABLE public.profiles
        ADD COLUMN latitude      NUMERIC(8,5),
        ADD COLUMN longitude     NUMERIC(8,5),
        ADD COLUMN location_name TEXT;

    -- Frost date cache stub (historical frost-window data; not populated in this phase)
    CREATE TABLE public.frost_date_cache (
        id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        latitude          NUMERIC(8,5) NOT NULL,
        longitude         NUMERIC(8,5) NOT NULL,
        last_spring_frost DATE,
        first_fall_frost  DATE,
        hardiness_zone    TEXT,
        fetched_at        TIMESTAMP WITH TIME ZONE
            DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    ALTER TABLE public.frost_date_cache ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Any authenticated user can read frost cache"
        ON public.frost_date_cache FOR SELECT
        USING (auth.role() = 'authenticated');
    ```
  - Apply locally:
    ```powershell
    bunx supabase migration up
    ```
  - Verify columns and table exist:
    ```powershell
    bunx supabase db execute --local "SELECT column_name FROM information_schema.columns WHERE table_name='profiles' AND column_name IN ('latitude','longitude','location_name');"
    bunx supabase db execute --local "SELECT id FROM frost_date_cache LIMIT 1;"
    ```
  - Regenerate types:
    ```powershell
    bun run types
    Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts
    ```
  - Confirm `latitude`, `longitude`, `location_name` appear in the `profiles` Row type in `src/types/database.types.ts`.

- [ ] **Block B — `ProfileService` location methods + `WeatherService`** | Agent: `/plumber`
  - In `src/app/core/services/profile.service.ts`, add two methods:
    - `setLocation(lat: number, lon: number, locationName: string): Promise<void>`:
      - PATCHes `{ latitude: lat, longitude: lon, location_name: locationName }` on the current user's profile row.
      - On success: re-fetches the profile and updates `_profile` signal.
      - On error: throws (caller shows a toast).
    - `clearLocation(): Promise<void>`:
      - PATCHes `{ latitude: null, longitude: null, location_name: null }`.
      - On success: re-fetches and updates `_profile` signal.
  - Create `src/app/core/services/weather.service.ts` (`providedIn: 'root'`):
    - Interface `WeatherData`: `{ temperature_celsius: number; relative_humidity_percent: number; precipitation_probability_percent: number | null }`.
    - `readonly FROST_THRESHOLD_CELSIUS = 4`.
    - Signals: `weather = signal<WeatherData | null>(null)`, `weatherLoading = signal(false)`, `weatherError = signal<string | null>(null)`.
    - `hasFrostRisk = computed(() => (this.weather()?.temperature_celsius ?? Infinity) <= this.FROST_THRESHOLD_CELSIUS)`.
    - `loadWeather(lat: number, lon: number): Promise<void>`:
      - Sets `weatherLoading(true)`, clears `weatherError`.
      - Calls `weather-proxy` Edge Function via `supabase.client.functions.invoke`. Before writing, fetch the exact `functions.invoke` signature from context7 (`@supabase/supabase-js` → `functions.invoke`).
      - On success: sets `weather(data)`.
      - On error: sets `weatherError('Could not load weather data — frost alerts may be unavailable.')`.
      - `finally`: sets `weatherLoading(false)`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```

- [ ] **Block C — Location Dialog (geo-detect + city-search)** | Agent: `/visualizer`
  - Before writing, fetch Open-Meteo geocoding API docs via context7 to confirm the `geocoding-api.open-meteo.com/v1/search` response shape (fields: `id`, `name`, `latitude`, `longitude`, `admin1`, `country`). If context7 has no entry for this, call it with `open-meteo` and check the results; if unavailable, use the known shape from the Open-Meteo public docs.
  - Create `src/app/features/dashboard/location-dialog/location-dialog.ts` and `.html`:
    - `visible = model<boolean>(false)`.
    - `currentLat = input<number | null>(null)`, `currentLon = input<number | null>(null)`, `currentName = input<string | null>(null)`.
    - `locationSaved = output<{ lat: number; lon: number; locationName: string }>()`.
    - `locationCleared = output<void>()`.
    - Interface `GeoResult`: `{ id: number; name: string; latitude: number; longitude: number; admin1: string | null; country: string }`.
    - Signals: `geoDetecting = signal(false)`, `geoError = signal<string | null>(null)`, `searchQuery = signal('')`, `suggestions = signal<GeoResult[]>([])`, `searchLoading = signal(false)`, `selectedResult = signal<GeoResult | null>(null)`, `saving = signal(false)`.
    - `detectLocation(): void`:
      - Sets `geoDetecting(true)`, clears `geoError`.
      - Calls `navigator.geolocation.getCurrentPosition(success, error, { timeout: 10000 })`.
      - On success: calls `onResultSelected({ id: 0, name: 'Current location', latitude: pos.coords.latitude, longitude: pos.coords.longitude, admin1: null, country: '' })`.
      - On error: sets `geoError('Location access was denied — search for your city below')`, clears `geoDetecting`.
      - `finally` via a wrapper: always sets `geoDetecting(false)`.
    - `onSearchInput(query: string): void` — debounce 300 ms, min 2 chars; calls `fetchSuggestions(query)`.
    - `fetchSuggestions(query: string): Promise<void>`:
      - Sets `searchLoading(true)`, clears suggestions.
      - Calls `https://geocoding-api.open-meteo.com/v1/search?name={encodeURIComponent(query)}&count=8&language=en&format=json` using the Angular `HttpClient`.
      - Maps results to `GeoResult[]`; sets `suggestions`.
      - On error: sets `suggestions([])`.
      - `finally`: sets `searchLoading(false)`.
    - `onResultSelected(result: GeoResult): void`:
      - Sets `selectedResult(result)`, clears `suggestions`, sets `searchQuery('')`.
    - `onSave(): void`:
      - If `selectedResult()` is null: do nothing (button is disabled).
      - Emits `locationSaved({ lat: selectedResult().latitude, lon: selectedResult().longitude, locationName: formatLabel(selectedResult()) })`.
      - Closes dialog.
    - `formatLabel(r: GeoResult): string`:
      - `r.name === 'Current location'` → `'Current location'`.
      - Otherwise: `[r.name, r.admin1, r.country].filter(Boolean).join(', ')`.
    - `onClear(): void`: emits `locationCleared`, resets state, closes dialog.
    - `onCancel(): void`: resets state, closes dialog.
    - `effect()` on `visible()`: when it flips to false, reset `suggestions`, `geoError`, `selectedResult`, `searchQuery`.
    - Template (`<p-dialog>` with `FloraDialogPT`, header `"Set location for frost alerts"`):
      - **Detect button row**:
        ```html
        <p-button label="Detect my current location" icon="pi pi-map-marker"
          [loading]="geoDetecting()" (onClick)="detectLocation()"
          variant="outlined" [pt]="FloraButtonPT"
          ariaLabel="Detect my current location using the browser" />
        ```
      - `@if (geoError())` — inline error message using `<p-message severity="warn">`.
      - **Divider** — `<div class="flex items-center gap-3 my-4"><hr class="flex-1 border-neutral-200">or search<hr class="flex-1 border-neutral-200"></div>`.
      - **City search input + dropdown**:
        - A plain `pInputText` with `(input)="onSearchInput($event.target.value)"`, `placeholder="City or region..."`, icon prefix `pi pi-search`, `[attr.aria-label]="'Search for a city or region'"`.
        - `@if (searchLoading())` — small spinner inline.
        - `@if (suggestions().length > 0)` — `<ul role="listbox" aria-label="Location suggestions">` with each result as `<li role="option" (click)="onResultSelected(r)"...>`.
        - Style suggestions list: `absolute z-10 w-full bg-white border border-neutral-200 rounded-garden-md shadow-lg mt-1 max-h-48 overflow-y-auto`.
        - Each suggestion item: `<button type="button" class="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 font-display">`.
      - **Selected result confirmation** (`@if (selectedResult())`):
        ```html
        <div class="flex items-center gap-2 mt-3 p-3 bg-primary-50 rounded-garden-sm">
          <i class="pi pi-check-circle text-primary-600" aria-hidden="true"></i>
          <span class="text-sm font-medium font-display text-primary-700">
            {{ formatLabel(selectedResult()!) }}
          </span>
        </div>
        ```
      - **Privacy note** (`role="note"`): `"Coordinates are stored privately on your account and are never shared."`
      - Footer: "Clear location" outlined danger button (only when `currentLat() != null`) + "Cancel" text button + "Save location" primary `p-button` (`[disabled]="!selectedResult()"`, `[loading]="saving()"`).
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Location Dialog:
    ```
    App running at: http://localhost:4200/dashboard

    1. Trigger location dialog (see Block D wiring).
    2. Click "Detect my current location":
       a. If browser grants permission → selected result shows "Current location" confirmation chip.
       b. If browser denies → warn message "Location access was denied — search for your city below" appears.
    3. Type "Brus" in the search field → after 300 ms, a dropdown appears with cities matching "Brus".
    4. Click a suggestion → confirmation chip shows the city label (e.g. "Brussels, Brussels Capital, Belgium").
    5. "Save location" button is disabled until a result is selected or detected.
    6. Save → dialog closes (toast from Block D fires).
    7. Re-open dialog → "Clear location" button is now visible.
    8. Open DevTools Console → zero red errors.
    ```

- [ ] **Block D — Dashboard Frost Alert Banner + Location Wiring** | Agent: `/visualizer`
  - In `dashboard.ts`:
    - Inject `ProfileService` and `WeatherService`.
    - Computed: `hasLocation = computed(() => this.profileService.profile()?.latitude != null)`.
    - Computed: `outdoorZones = computed(() => this.zoneService.zones().filter(z => z.zone_type === 'outdoor'))`.
    - `locationDialogVisible = signal(false)`.
    - `effect()`: when `hasLocation()` becomes true (and profile lat/lon are non-null), call `weatherService.loadWeather(lat, lon)` via `untracked()` to avoid circular reactivity.
    - `openLocationDialog(): void`: calls `blurActiveElement()`, sets `locationDialogVisible(true)`.
    - `async onLocationSaved(coords: { lat: number; lon: number; locationName: string }): Promise<void>`:
      - Calls `profileService.setLocation(coords.lat, coords.lon, coords.locationName)`.
      - Shows success toast: `"Location saved — frost alerts are now active"`.
      - On error: shows error toast: `"Failed to save location — try again"`.
    - `async onLocationCleared(): Promise<void>`:
      - Calls `profileService.clearLocation()`.
      - Sets `weatherService.weather(null)`.
      - Shows toast: `"Location cleared — frost alerts disabled"`.
    - Import `LocationDialogComponent` and add to `imports` array.
  - In `dashboard.html`:
    - **Frost alert banner** — placed directly below the page `<header>`, shown `@if (outdoorZones().length > 0 && weatherService.hasFrostRisk())`:
      ```html
      <section role="alert" aria-live="assertive" aria-label="Frost risk warning"
        class="flex items-start gap-3 bg-amber-50 border border-warning-500 rounded-garden-md p-4 mb-6">
        <i class="pi pi-exclamation-triangle text-warning-500 mt-0.5 flex-shrink-0" aria-hidden="true"></i>
        <div class="flex-1">
          <p class="text-sm font-semibold font-display text-warning-500">Frost risk detected</p>
          <p class="text-sm font-display text-neutral-600 mt-0.5">
            Current temperature: {{ weatherService.weather()?.temperature_celsius }}°C near
            {{ profileService.profile()?.location_name ?? 'your location' }}.
            Your outdoor zones may be at risk.
          </p>
        </div>
      </section>
      ```
    - **Location prompt** — shown `@if (outdoorZones().length > 0 && !hasLocation())`, placed in the same position:
      ```html
      <p class="text-sm text-neutral-500 font-display mb-6">
        <button type="button" (click)="openLocationDialog()"
          class="text-primary-600 underline hover:text-primary-700 font-medium"
          ariaLabel="Set your location to enable frost alerts">
          Set your location
        </button>
        to enable frost alerts for your outdoor zones.
      </p>
      ```
    - **Location edit button** — shown `@if (hasLocation())`, inside the dashboard `<header>` as a small secondary action:
      ```html
      <button type="button" (click)="openLocationDialog()"
        class="inline-flex items-center gap-1.5 text-xs font-medium font-display text-neutral-500 hover:text-primary-600 transition-colors duration-150"
        aria-label="Edit frost alert location">
        <i class="pi pi-map-marker text-xs" aria-hidden="true"></i>
        {{ profileService.profile()?.location_name ?? 'Location set' }}
      </button>
      ```
    - Wire `<app-location-dialog>` at bottom of template:
      ```html
      <app-location-dialog
        [(visible)]="locationDialogVisible"
        [currentLat]="profileService.profile()?.latitude ?? null"
        [currentLon]="profileService.profile()?.longitude ?? null"
        [currentName]="profileService.profile()?.location_name ?? null"
        (locationSaved)="onLocationSaved($event)"
        (locationCleared)="onLocationCleared()" />
      ```
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Dashboard Frost Alert:
    ```
    App running at: http://localhost:4200/dashboard

    1. No outdoor zones → neither the frost alert banner nor the location prompt appears anywhere.
    2. Add an outdoor zone → the "Set your location" prompt appears.
    3. Click "Set your location" → location dialog opens.
    4. Set a location via city search → dialog closes, success toast fires; prompt disappears;
       a small location label appears in the header.
    5. DevTools Network → confirm a call to the weather-proxy Edge Function was made with lat/lon params.
    6. If the location is in a cold region and temperature ≤ 4 °C: frost banner appears with the temperature.
    7. If temperature > 4 °C: no frost banner.
    8. Click the location label in the header → dialog opens pre-filled with the current city name.
    9. Click "Clear location" → confirmation, location label disappears, prompt returns, no frost banner.
    10. Open DevTools Console → zero red errors.
    ```
