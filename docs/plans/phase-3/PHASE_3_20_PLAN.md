# Phase 3.20 — Heat-Stress Soil Advisory

Weather-aware soil-check intelligence: when a heat spell is forecast, FloraFlow automatically shortens each plant's next check interval and surfaces a heat-advisory banner on the dashboard. Both mechanisms reuse the existing `weather-proxy` Edge Function and `WeatherService` — no new external dependency, no per-plant disposition tracking.

**Dependency chain:** A → B → (C ∥ D) → E. Blocks C and D both depend on Block B's `hasHeatRisk` signal and can be built in parallel once B lands.

**Graceful degradation:** no location set → no weather data → `hasHeatRisk()` is `false` → multiplier is `1.0`, banner stays hidden. Identical to how frost alerts already behave.

---

- [x] **Block A — Heat column in `weather_cache` + proxy update** | Agent: `/plumber` · Model: Sonnet · Effort: low
  - Migration: `max_temp_next_24h NUMERIC(5,2)` on `weather_cache` — mirrors the existing `min_temp_next_24h` column (reference: `supabase/migrations/20260604000007_weather_cache_min_temp.sql`).
  - `supabase/functions/weather-proxy/index.ts`:
    - Add `temperature_2m_max` to the `daily` query param string in the Open-Meteo URL.
    - Extend the local `OpenMeteoResponse` type: `daily: { time: string[]; temperature_2m_min: number[]; temperature_2m_max: number[] }`.
    - Compute `max_temp_next_24h`: `Math.max(daily.temperature_2m_max[0] ?? -Infinity, daily.temperature_2m_max[1] ?? -Infinity)`; store `null` when non-finite (mirrors the `min_temp_next_24h` pattern exactly).
    - Add `max_temp_next_24h` to: the cache-hit `.select(...)` column list, the `record` object passed to `upsert`, and the returned JSON.
  - User runs `bun run types` after the migration applies.
  - Update `docs/DB_SCHEMA_MATRIX.md`: add `max_temp_next_24h NUMERIC(5,2)` to the `weather_cache` columns (or add the table section if absent).

- [x] **Block B — `hasHeatRisk` signal in `WeatherService`** | Agent: `/visualizer` · Model: Sonnet · Effort: low
  - `src/app/core/services/weather.service.ts`:
    - Add `readonly HEAT_THRESHOLD_CELSIUS = 30` constant (parallel to `FROST_THRESHOLD_CELSIUS = 4`).
    - Extend `WeatherData` interface: `max_temp_next_24h: number | null`.
    - Extend the `loadWeather()` assignment to map `max_temp_next_24h` from the proxy response.
    - Add `readonly hasHeatRisk = computed(() => (this.weather()?.max_temp_next_24h ?? -Infinity) >= this.HEAT_THRESHOLD_CELSIUS)`.
  - `src/app/core/services/weather.service.spec.ts`: add cases for `hasHeatRisk` true (≥ 30), false (< 30), and null weather.
  - No template changes in this block.

- [x] **Block C — Heat multiplier in soil-check-dialog** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `src/app/features/tasks/soil-check-dialog/soil-check-dialog.ts`:
    - Inject `WeatherService`.
    - Add `private readonly HEAT_MULTIPLIER = 0.65`.
    - Add `readonly isHeatActive = computed(() => this.weatherService.hasHeatRisk())`.
    - Extend `recommendedDays` computed: multiply by `this.isHeatActive() ? this.HEAT_MULTIPLIER : 1` after the growth multiplier. The existing `[1–14]` clamp and preset-snap are unchanged — the heat factor slots into the existing product, nothing else changes.
  - `soil-check-dialog.html` (schedule step only):
    - Add `@if (isHeatActive())` block rendering a one-line note between the recommended-days display and the manual snooze preset grid.
    - Markup: `<p class="text-xs text-warning-500 font-display">{{ 'tasks.soilCheck.heatAdjustment' | transloco }}</p>`.
    - EN copy: _"Hot weather forecast — checking sooner than usual."_
    - Add `tasks.soilCheck.heatAdjustment` to `public/i18n/{en,fr,nl}.json`.
  - `soil-check-dialog.spec.ts`: add cases verifying `recommendedDays` is lower when heat is active vs. inactive with identical plant inputs.

- [x] **Block D — Shared `WeatherAdvisoryBannerComponent` (frost refactor + heat)** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - New dumb presentational component `src/app/shared/components/weather-advisory-banner/weather-advisory-banner.ts`:
    - Inputs: `icon = input.required<string>()`, `heading = input.required<string>()`, `body = input.required<string>()`.
    - Template: the amber banner structure currently inline in `dashboard.html` (lines 96–126), parameterised. Preserve `role="alert"` + `aria-live="assertive"` + `[attr.aria-label]` on the `<section>`. Tokens: `bg-amber-50 dark:bg-yellow-900/20 border border-warning-500 dark:border-yellow-700/50 rounded-garden-md p-4`. Icon: `<i [class]="'pi ' + icon() + ' text-warning-500'" aria-hidden="true">`. No logic — SRP.
  - `dashboard.html`:
    - Replace the inline frost banner with `<app-weather-advisory-banner>` passing existing frost Transloco strings as bound expressions; keep the `@if (outdoorZones().length > 0 && weatherService.hasFrostRisk())` guard unchanged.
    - Add a second `<app-weather-advisory-banner>` directly below, shown when `weatherService.hasHeatRisk() && plantService.plants().length > 0` (all plants, no zone scoping).
    - Heat icon: `pi-sun`. Heat `[attr.aria-label]`: `'dashboard.heatRiskAriaLabel' | transloco`.
  - `dashboard.ts`: add `WeatherAdvisoryBannerComponent` to `imports`.
  - New Transloco keys in `public/i18n/{en,fr,nl}.json`:
    - `dashboard.heatRiskAriaLabel`, `dashboard.heatRiskHeading`, `dashboard.heatRiskBody`.
    - EN body copy: _"Soil dries faster in the heat — consider checking your plants sooner than usual."_

- [x] **Block E — QA gate** | Agent: `/gatekeeper` · Model: Sonnet · Effort: mid
  - `hasHeatRisk()` is `true` when `max_temp_next_24h ≥ 30`; `false` when below threshold or `null`.
  - `recommendedDays` is strictly lower when heat is active vs. inactive for the same plant (same container × substrate × watering × growth inputs).
  - Heat banner appears on the dashboard when `hasHeatRisk()` is `true` and at least one plant exists; absent otherwise.
  - Frost banner still appears independently and correctly — regression check.
  - Heat note appears in the soil-check dialog schedule step when heat is active; absent when inactive.
  - `bun run check` — zero errors.
