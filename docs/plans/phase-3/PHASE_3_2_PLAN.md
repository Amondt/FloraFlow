# Phase 3.2 — Plant Growth Stage Field

Adds `growth_stage` to `plants`, updates the `snooze_plant_check` RPC to apply a growth-stage multiplier, and surfaces the field in the Add/Edit Plant form and the Soil Check dialog context line.

**Agent chain:** `/plumber` (Blocks A–C) → `/visualizer` (Blocks D–E) → `/gatekeeper` (sign-off)

---

- [x] **Block A — Migration: growth_stage ENUM + column** | Agent: `/plumber`
  - New migration file (timestamp prefix, e.g. `20260604000001_growth_stage.sql`).
  - `CREATE TYPE public.growth_stage_type AS ENUM ('Seedling', 'Juvenile', 'Mature', 'Dormant');`
  - `ALTER TABLE public.plants ADD COLUMN growth_stage growth_stage_type DEFAULT 'Mature'::growth_stage_type NOT NULL;`
  - Apply locally: `bunx supabase migration up`
  - Verification query (paste result back):
    ```sql
    SELECT column_name, udt_name
    FROM information_schema.columns
    WHERE table_name = 'plants' AND column_name = 'growth_stage';
    ```
  - Then: `bunx supabase db test`

- [ ] **Block B — RPC update: growth-stage multiplier** | Agent: `/plumber`
  - New migration file (e.g. `20260604000002_snooze_growth_multiplier.sql`).
  - `CREATE OR REPLACE FUNCTION public.snooze_plant_check(p_plant_id UUID, p_snooze_days INT)` — signature unchanged.
  - Inside the function: read `growth_stage` from the plant row, derive multiplier (Seedling 0.5, Juvenile 1.0, Mature 1.0, Dormant 2.0), compute `v_effective_days = GREATEST(1, ROUND(p_snooze_days * multiplier)::INT)`, use `v_effective_days` for all three SET columns.
  - Apply locally: `bunx supabase migration up`
  - Verification: set a test plant's `growth_stage = 'Seedling'`, call RPC with `p_snooze_days = 6`, confirm `current_snooze_interval_days = 3` and `next_check_due_at ≈ NOW() + 3 days`.
  - Then: `bunx supabase db test`

- [ ] **Block C — Type regen + Angular model/service** | Agent: `/plumber`
  - `bun run types` — confirm `database.types.ts` gains `growth_stage` on `plants` Row/Insert/Update and `growth_stage_type` in Enums.
  - `plant.model.ts`:
    - Add `export type GrowthStage = 'Seedling' | 'Juvenile' | 'Mature' | 'Dormant';`
    - Add `export const GROWTH_STAGE_OPTIONS: GrowthStage[] = ['Seedling', 'Juvenile', 'Mature', 'Dormant'];`
    - Add `growth_stage: GrowthStage` to `Plant` interface.
    - Add `growth_stage: GrowthStage` to `PlantFormData` interface.
  - `plant.service.ts`:
    - Add `growth_stage` to the `.select()` string in `loadPlants()`.
    - Add `growth_stage` to the `.select()` string in `_refreshPlant()`.
    - Add `growth_stage` to the `.select()` string in `createPlant()`.
    - Add `growth_stage: data.growth_stage` to the optimistic `Plant` object in the offline create path.
    - Fix pre-existing offline snooze bug in `_drainQueue()`: pass `p_snooze_days: item.snooze_days ?? 5` when replaying snooze actions.
  - Run:
    ```powershell
    bun run format
    bun run lint
    ```

- [ ] **Block D — Plant form dialog: growth stage select** | Agent: `/visualizer`
  - `plant-form-dialog.ts`:
    - Import `GrowthStage`, `GROWTH_STAGE_OPTIONS` from `../plant.model`.
    - Add `readonly growthStageId = \`flora-plant-gs-${crypto.randomUUID().slice(0, 8)}\`;`
    - Expose `protected readonly GROWTH_STAGE_OPTIONS = GROWTH_STAGE_OPTIONS;`
    - Add to the form group: `growth_stage: new FormControl<GrowthStage>('Mature', { nonNullable: true })`.
    - In the edit-prefill `effect()`: patch `growth_stage: p.growth_stage`.
    - In `onSubmit()`: include `growth_stage: this.form.controls.growth_stage.value` in the emitted `PlantFormData`.
  - `plant-form-dialog.html`:
    - Add a growth stage `<p-select>` field after the substrate field, following the form anatomy pattern from `DESIGN_SYSTEM.md §5`.
    - Label: "Growth stage"; `[options]="GROWTH_STAGE_OPTIONS"`; default 'Mature' comes from the form control.
    - Hint text: `"Seedling checks more often; Dormant less often."`
  - Run:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Plant Form Dialog
    ```
    App running at: http://localhost:4200/scheduler

    1. Open Add Plant dialog → Growth stage select visible, defaults to "Mature".
    2. Change to "Seedling" → form stays valid, no console errors.
    3. Save → plant appears in scheduler list without errors.
    4. Open Edit Plant on a saved plant → Growth stage select shows the saved value.
    5. Change growth stage and save → updated value persists on next edit open.
    6. Open DevTools Console → zero red errors.
    ```

- [ ] **Block E — Soil check dialog: growth stage context line** | Agent: `/visualizer`
  - `soil-check-dialog.html`: in the plant hero section, extend the context `<p>` (zone name + last-checked line) to also show the growth stage.
  - Append `· {{ plant().growth_stage }}` after the zone name segment, matching the existing separator style.
  - No TS changes — `plant()` carries `growth_stage` after Block C.
  - Run:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Soil Check Dialog
    ```
    App running at: http://localhost:4200/scheduler

    1. Open Soil Check on any plant → growth stage label ("Mature", "Seedling", etc.) visible in the context line below the plant name.
    2. Open Soil Check on a plant edited to "Dormant" → shows "Dormant".
    3. Open DevTools Console → zero red errors.
    ```

---

## Phase sign-off — `/gatekeeper`

After all five blocks pass:
1. All five block checkboxes in this file are `[x]`.
2. `bun run lint` — zero errors.
3. Both Manual Browser Checks confirmed by user.
4. `bunx supabase db test` passes.
5. Mark `docs/PHASES_PLAN.md §3` → task **3.2** checkbox `[x]`.
