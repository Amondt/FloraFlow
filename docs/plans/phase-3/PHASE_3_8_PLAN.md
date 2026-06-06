# Phase 3.8 Plan — Substrate Composition Mix Wizard

---

## What this feature is

A reactive substrate calculator that tells a gardener exactly how to mix a potting substrate, in litres, for a specific plant or species. It is **not a standalone page** — it is a shared dialog that opens from the places where the question naturally arises: while managing a plant (zone detail), while researching a species (library), and while configuring a plant (add/edit form).

The feature earns its place by being **contextually aware**: when opened from a plant card it pre-selects the matching substrate profile, pre-fills the pot volume from the plant's stored pot diameter, and compares the computed mix pH against that species' documented ideal range from the botanical cache. The gardener sees instantly whether their mix suits their plant — not just an abstract recipe.

---

## Architecture

**Component location:** `src/app/shared/components/substrate-mix-wizard/substrate-mix-wizard-dialog.ts`
Shared because four different surfaces open it.

**Engine location:** `src/app/shared/utils/substrate-mix.model.ts`
Pure functions only — no Angular, no Supabase. Fully testable in isolation.

**Entry points and context:**

| Entry point                                | Plant context | Botanical record context  | Pre-fill source                                                                         |
| ------------------------------------------ | ------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| Zone-detail plant card                     | ✓             | ✓ (from zone batch fetch) | `substrate_factor` → profile; `pot_diameter_cm` → volume; `ideal_min/max_ph` → pH badge |
| Library botanical detail dialog (Care tab) | —             | ✓                         | `preferred_soil_type` → profile; `ideal_min/max_ph` → pH badge                          |
| Plant form dialog (substrate helper)       | —             | —                         | Currently selected `substrate_factor` → profile only                                    |
| Library page header button                 | —             | —                         | Fully manual (no pre-fill)                                                              |

**Profile pre-selection priority** (highest wins): `plant.substrate_factor` → `botanicalRecord.preferred_soil_type` → `substratePreset` → 'General Tropical' fallback.

---

## Data availability & graceful degradation

The wizard must be useful at every enrichment level. `substrate_factor` is the one field that is **always present** on every plant — the wizard is always functional. Everything else is progressive enhancement.

| What's available                                                                    | Profile source                                                                            | Volume source                      | pH badge                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| Plant only (no scientific name, no botanical record)                                | `substrate_factor` → profile                                                              | `pot_diameter_cm` if set, else 1 L | Not shown                       |
| Plant + botanical record, not AI-enriched (`preferred_soil_type` = null, pH = null) | `substrate_factor` → profile (preferred_soil_type is null, so substrate wins)             | `pot_diameter_cm` if set, else 1 L | Not shown                       |
| Plant + botanical record, AI-enriched (all fields populated)                        | `substrate_factor` → profile (plant's own choice takes priority over preferred_soil_type) | `pot_diameter_cm` if set, else 1 L | Shown (green or amber)          |
| Botanical record only (library entry, no plant)                                     | `preferred_soil_type` → profile if non-null, else 'General Tropical'                      | 1 L default                        | Shown if pH fields present      |
| Substrate preset only (plant form entry)                                            | Preset → profile                                                                          | 1 L default                        | Not shown (no plant, no record) |
| No context (library header button)                                                  | 'General Tropical' default                                                                | 1 L default                        | Not shown                       |

**When pH badge cannot be shown:**

- If plant has no `scientific_name`: show a soft nudge below the pH estimate — "Link a species to your plant to also see pH compatibility."
- If botanical record exists but pH fields are null (not yet AI-enriched): show pH estimate only, no badge, no nudge.
- Never show a broken or empty badge — the section is absent from the DOM entirely when pH data is unavailable.

**Profile pre-selection from `substrate_factor` is never "wrong"** — the gardener already chose that mix type for this plant. It is the direct answer to "what is in my plant's current substrate?". The `preferred_soil_type` fallback is only applied when there is no plant context at all (library/botanical entry points).

---

## Genus profiles & mix recipes

Five profiles map directly to the five `SubstrateFactor` enum values in `plant.model.ts`:

| Profile           | Maps from             | Components                                               | Typical use                               |
| ----------------- | --------------------- | -------------------------------------------------------- | ----------------------------------------- |
| Epiphytic Aroid   | `High-Drainage Aroid` | 40% Orchid Bark · 30% Perlite · 30% Coco Coir            | Monsteras, Philodendrons, Pothos          |
| Desert Succulent  | `Desert Succulent`    | 40% Standard Potting Mix · 35% Coarse Sand · 25% Perlite | Cacti, Echeveria, Aloe                    |
| Sphagnum Epiphyte | `Sphagnum Moss Mix`   | 60% Sphagnum Moss · 30% Perlite · 10% Orchid Bark        | Orchids, moisture-loving epiphytes        |
| Peat-Based Bog    | `Heavy Peat`          | 50% Peat Moss · 30% Perlite · 20% Coarse Sand            | Carnivorous plants, acid-loving tropicals |
| General Tropical  | `Standard Potting`    | 50% Standard Potting Mix · 25% Perlite · 25% Coco Coir   | Most common houseplants                   |

**Recipe rationale (sources consulted):**

- **Epiphytic Aroid 40/30/30**: "Equal-thirds bark/perlite/coir" is the most cited DIY aroid recipe; 40% bark is slightly bark-heavy for better drainage. Consistent with monsteramash.com, elmdirt.com, and pistilsandpollen.com guides.
- **Desert Succulent 40/35/25**: Corrected from initial 50/30/20. Multiple sources (gardeningknowhow.com, masterclass.com) cite a 3:3:2 potting:sand:perlite ratio; our 40/35/25 matches that spirit. Initial recipe was drainage-heavy (80% inorganic) which would suit true xeric cacti but not the average FloraFlow user's potted succulents.
- **Sphagnum Epiphyte 60/30/10**: Corrected from initial 70/20/10. 70% sphagnum stays wet too long in a pot; 60% is still moss-forward (reflecting the "Sphagnum Moss Mix" label) while the 30% perlite ensures air pockets. Consistent with orchid epiphyte guidance from herebutnot.com and oakhillgardens.com.
- **Peat-Based Bog 50/30/20**: Standard carnivorous plant recipe is 1:1 peat:perlite or peat:sand. The 50/30/20 split is consistent with californiacarnivores.com and carnivorousplantnursery.com, and extends to acid-loving tropicals that share the Heavy Peat substrate type.
- **General Tropical 50/25/25**: Corrected from 50/30/20. Equal 25/25 perlite/coir makes the drainage components symmetric, matches the "60% potting + 20% perlite + 20% coir" baseline from the tropical houseplant community, and is simpler to mix.

---

## pH computation

### Component pH ranges

| Component              | pH range | Source                                                                                                |
| ---------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| Orchid Bark (fir/pine) | 4.0–6.5  | OrchidResourceCenter; commercial orchid bark is typically fir-based (4.4–6.5); pine bark runs 3.4–5.5 |
| Perlite                | 7.0–7.0  | Sterile volcanic glass, pH-neutral; confirmed universally                                             |
| Coco Coir              | 6.0–6.8  | Botanicoir; GreenPlanet Nutrients; HORIBA lab analysis                                                |
| Coarse Sand/Grit       | 7.0–7.0  | Silica/quartz sand is pH-neutral; always use horticultural-grade, never fine beach sand               |
| Standard Potting Mix   | 6.0–7.0  | Industry standard; most commercial mixes are limed to this range                                      |
| Sphagnum Moss          | 3.5–4.5  | Consistent with multiple horticultural references                                                     |
| Peat Moss              | 3.0–4.5  | University of Arkansas greenhouse unit; PMC NCBl 8469801 — unamended sphagnum peat measures 3.0–4.5   |

> **Peat Moss correction:** PHASES_PLAN.md §3.8 cited "3.5–4.8". Research shows the correct range is 3.0–4.5 — the spec upper bound was too high.

### Computation method — H⁺ ion weighted mean (not linear average)

pH is a **logarithmic scale**. Directly averaging pH numbers is a known error: a difference of 3 pH units represents a 1000× difference in [H+]. The correct method converts to ion concentration first, weights, then converts back.

**Wrong (what the PHASES_PLAN.md spec originally described):**

```
pH_low  = Σ(component_pH_low  × fraction)   ← linear mean, incorrect
pH_high = Σ(component_pH_high × fraction)
```

**Correct (what the engine must implement):**

```
H+_most_acidic   = Σ(10^(−component_pH_low)  × fraction)
H+_most_alkaline = Σ(10^(−component_pH_high) × fraction)

pH_low  = −log10(H+_most_acidic)     ← most acidic scenario
pH_high = −log10(H+_most_alkaline)   ← most alkaline scenario
```

### Why the method matters — error magnitude

| Profile           | H⁺ method (correct) | Linear (wrong) | Error on low end        |
| ----------------- | ------------------- | -------------- | ----------------------- |
| Epiphytic Aroid   | pH ~4.4–6.7         | pH ~5.5–6.7    | +1.1 units too high     |
| Desert Succulent  | pH ~6.3–7.0         | pH ~6.6–7.0    | +0.3 units (minor)      |
| Sphagnum Epiphyte | pH ~3.7–4.7         | pH ~4.6–5.5    | +0.9 units too high     |
| Peat-Based Bog    | pH ~3.3–4.8         | pH ~5.0–5.8    | **+1.7 units too high** |
| General Tropical  | pH ~6.1–6.9         | pH ~6.3–7.0    | +0.1 units (negligible) |

The Peat-Based Bog error (pH 5.0 vs pH 3.3) is not cosmetic — a carnivorous plant owner seeing "pH 5.0" would think the mix is fine; "pH 3.3" correctly communicates that this is a very acidic environment. The H⁺ method must be used.

### Remaining limitations (document in UI caveat)

Even the H⁺ method is an approximation for substrates. Real pH is affected by:

- **Buffering capacity**: peat and sphagnum have high CEC and resist pH change — the actual root-zone pH may be more stable than the formula suggests.
- **Measurement method**: substrate pH is measured by 1:2 dilution or saturated paste — different from pure solution pH.
- **Amendment history**: commercial mixes often have lime added; a brand-new bag may test differently from an in-use substrate.

The "not a lab measurement" caveat in the UI must remain.

Display: `"Estimated pH: ~4.4–6.7"` (one decimal, rounded from the H⁺ computation).

**pH compatibility badge** (only when botanical record has `ideal_min_ph` and `ideal_max_ph`):

- Mix high < `ideal_min_ph` → amber "⚠ Too acidic — plant needs pH {min}–{max}"
- Mix low > `ideal_max_ph` → amber "⚠ Too alkaline — plant needs pH {min}–{max}"
- Ranges overlap → green "✓ pH compatible (plant prefers pH {min}–{max})"

Always followed by the caveat: _"Estimated pH — not a lab measurement."_

---

## Pot diameter → volume

### Why the original formula was replaced

The plan originally used a tapered-cylinder approximation: `V = π(d/2)² × 0.8d / 1000`. Verification against standard nursery pot specifications shows it **overestimates by 1.5–2× for every common pot size** — a 15 cm pot holds ~1.3 L, not 2.1 L. The formula is replaced by a lookup table of real measured volumes.

### Standard pot size lookup table

Use this table (derived from standard horticultural trade pot dimensions) rather than any formula. For a `pot_diameter_cm` value that doesn't match a table entry exactly, snap to the nearest entry.

| Pot diameter | Volume | Common use              |
| ------------ | ------ | ----------------------- |
| 6 cm         | 0.07 L | Seedlings, offsets      |
| 8 cm         | 0.15 L | Small seedlings         |
| 9 cm         | 0.25 L | Cuttings                |
| 10 cm        | 0.40 L | Small succulents, herbs |
| 12 cm        | 0.70 L | Young plants            |
| 14 cm        | 1.00 L | Small houseplants       |
| 15 cm        | 1.30 L | Standard indoor plant   |
| 17 cm        | 2.00 L | Mid-size houseplants    |
| 19 cm        | 3.00 L |                         |
| 20 cm        | 3.20 L | Larger houseplants      |
| 21 cm        | 4.00 L |                         |
| 25 cm        | 6.00 L | Large plants            |
| 30 cm        | 10.0 L | Statement plants        |

### Volume as a low-friction optional input

**Percentages are the primary output.** Volumes are a convenience scaling tool — they answer "how much of each component do I need to buy?" but they are never required to make the wizard useful.

The UX must reflect this:

- Volume defaults to `1` (the "per 1 litre" reference unit). Results are immediately meaningful because proportions are shown alongside volumes.
- The primary interaction is **five pot-size chips** — not a free-text number. Chips are: `10 cm`, `12 cm`, `15 cm`, `20 cm`, `25 cm`. Each shows its volume in parentheses. One tap fills the volume input without any mental arithmetic.
- The number input remains editable for non-standard pot sizes.
- If `pot_diameter_cm` is set on the plant: the nearest chip is pre-selected on open. No user action needed.
- The `~` prefix on all volume outputs signals approximation (pots vary; this is guidance, not measurement).

**Why chips, not a number input as primary:** a gardener knows "I have a 15 cm pot." They do not know "my pot holds 1.3 litres." Asking for litres puts the conversion burden on the user. The chips do that conversion invisibly.

---

## Blocks

- [x] **Block A — Migration: `pot_diameter_cm` on `plants`** | Agent: `/plumber`
  - Migration file: `ALTER TABLE public.plants ADD COLUMN pot_diameter_cm INT;` — nullable, no default, no RLS changes (existing plant policy covers it)
  - After migration: `bun run types` then `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`
  - Verification: confirm `pot_diameter_cm` appears in `database.types.ts` Plants Row

- [x] **Block B — Plant data layer: model, service & form** | Agent: `/plumber` → `/visualizer`
  - `/plumber`: add `pot_diameter_cm?: number | null` to `Plant` interface and `PlantFormData` in `plant.model.ts`; update `PlantService.loadPlants()` select string to include `pot_diameter_cm`; update `createPlant()` and `updatePlant()` to pass the field when present
  - `/visualizer`: add optional "Pot diameter (cm)" `pInputNumber` field in `plant-form-dialog.html` (position: below substrate_factor, above growth_stage); hint: "Helps calculate volumes when mixing substrate"; `[min]="4"` `[max]="60"` `[step]="1"` `[showButtons]="true"` using `FloraInputNumberPT`; nullable — no validator
  - Verification: open Add Plant form → pot diameter field appears; save a plant with a value → reload tasks page → plant data still loads without error

- [x] **Block C — Mix engine** | Agent: `/visualizer`
  - New file: `src/app/shared/utils/substrate-mix.model.ts`
  - Exports: `GENUS_PROFILES` array, `SubstrateMixResult` interface, `computeMix(profile, volumeLitres)`, `getPhStatus(mixPhLow, mixPhHigh, idealMin, idealMax)`, `preferredSoilToProfile(types: string[])`, `substrateFactorToProfile(factor: SubstrateFactor)`, `diameterToVolume(cm: number)`
  - No Angular imports — pure TypeScript
  - **pH computation must use the H⁺ ion method** (not linear average):
    - Each component stores `pHLow` and `pHHigh`
    - `computeMix` derives pH bounds via `H+ = Σ(10^(−pH_bound) × fraction)`, then `pH = −log10(H+)`
    - The `log` and `pow` functions from `Math` are sufficient — no external dependencies
    - Expected results: Epiphytic Aroid ~4.4–6.7, Desert Succulent ~6.3–7.0, Sphagnum Epiphyte ~3.7–4.7, Peat-Based Bog ~3.3–4.8, General Tropical ~6.1–6.9
  - `preferredSoilToProfile` mapping: contains 'Sandy' or ('Well-draining' and any of 'Dry'/'Gritty') → Desert Succulent; contains 'Sphagnum' → Sphagnum Epiphyte; contains 'Peaty' or 'Acidic' → Peat-Based Bog; contains 'Chunky' or 'Bark' → Epiphytic Aroid; default null (caller falls back to General Tropical)
  - `diameterToVolume(cm: number): number` — **uses the lookup table from the plan, not a formula**; snaps to the nearest table entry by absolute distance; returns the corresponding litre value
  - `POT_SIZE_CHIPS`: exported const array of the 5 UI chips — `{ label: '10 cm', diameterCm: 10, volumeLitres: 0.40 }` etc. for 10/12/15/20/25 cm; used by Block D to render the chip strip without duplicating the table
  - Verification: run `bun run lint` — zero errors; verify in browser console that `computeMix('Peat-Based Bog', 1)` returns pH range approx 3.3–4.8 (not ~5.0, which would indicate the wrong linear formula was used); verify `diameterToVolume(15)` returns `1.3` (not `2.12`)

- [ ] **Block D — Wizard dialog component** | Agent: `/visualizer`
  - New component: `src/app/shared/components/substrate-mix-wizard/substrate-mix-wizard-dialog.ts` + `.html`
  - Inputs: `visible: model<boolean>`, `plant: input<Plant | null>(null)`, `botanicalRecord: input<CachedBotanicalRecord | null>(null)`, `substratePreset: input<SubstrateFactor | null>(null)`
  - `selectedProfile`: `linkedSignal` initialised via this exact priority chain:
    1. `plant()?.substrate_factor` → `substrateFactorToProfile()` (always resolves when plant is provided)
    2. else `botanicalRecord()?.preferred_soil_type` → `preferredSoilToProfile()` when non-null and non-empty
    3. else `substratePreset()` → `substrateFactorToProfile()` when non-null
    4. else `'General Tropical'` hardcoded fallback
       User can override the pre-selection by clicking any profile card — this does not mutate any input.
  - `rawVolume`: `linkedSignal` — initialises from `diameterToVolume(plant().pot_diameter_cm)` when `pot_diameter_cm != null`, else `1` (the reference unit); always editable by the user via the number input
  - `selectedChipDiameter`: `linkedSignal` — initialises to the nearest chip diameter when `pot_diameter_cm` is set (snapping to 10/12/15/20/25), else `null`; updated when the user taps a chip; drives both the chip highlight and the volume input simultaneously
  - `mixResult`: `computed(() => computeMix(selectedProfile(), rawVolume()))` — updates every keystroke
  - `phStatus`: `computed(() => { const r = botanicalRecord(); if (!r?.ideal_min_ph || !r?.ideal_max_ph) return null; return getPhStatus(...); })` — null means pH badge section is absent from DOM entirely
  - `showSpeciesNudge`: `computed(() => plant() != null && plant()!.scientific_name == null)` — shows soft nudge "Link a species to your plant to also see pH compatibility" when true; never shown when `phStatus` is non-null
  - **Approximation disclosure strategy — three layers of progressive disclosure:**
    - **Layer 1 — silent visual signal (always visible, zero reading required):** all estimated numbers are prefixed with `~` — pH estimate reads "Estimated pH: ~4.4–6.7", volume hint reads "~2 L". The tilde is a universal approximation symbol; most users process it subconsciously.
    - **Layer 2 — one-line anchor (visible, skimmable):** immediately below the pH estimate, a small inline row: `ℹ Estimates — actual pH varies by brand and substrate age.` Styled as `text-xs text-neutral-400 dark:text-neutral-500 font-display` with `pi-info-circle` icon. One sentence. No jargon. Does not alarm.
    - **Layer 3 — on-demand detail (opt-in only):** the `ℹ` icon is a small `<button>` that opens a `FloraPopoverPT` popover on click. Popover text (two sentences, max): _"pH is calculated from typical component values reported in horticultural research — actual results depend on the brand, age, and water quality you use. For precision, test your mix with a pH meter after blending."_ Popover closes on outside click. No modal, no blocking UX.
  - UI layout top-to-bottom:
    1. Dialog header "Substrate Mix Guide" + plant name subtitle line (`@if (plant())`)
    2. Profile selector — 5 cards in a responsive grid; active: `border-2 border-primary-600 bg-primary-50`; inactive: `border border-neutral-200 hover:border-neutral-300`
    3. **Volume section** — two rows:
       - Row A (chip strip): `@for (chip of POT_SIZE_CHIPS)` — small pill buttons labeled "10 cm · 0.4 L"; selected chip uses primary-600 outline; tapping auto-fills the input and updates `selectedChipDiameter`; no chip pre-selected by default (unless plant has `pot_diameter_cm`)
       - Row B (number input): `pInputNumber` labelled "Or enter volume (L)" with `[min]="0.05"` `[step]="0.1"` `[showButtons]="false"`; label styled as secondary to signal it's the fallback; below input: `"Or pick a pot size above"` helper in muted grey if no chip is selected
       - Volume section label: "How much substrate do you need?" — not "Volume (L)"
    4. Results table — columns: Component / % / ~Volume; `@for` from `mixResult.components`; volumes prefixed `~`
    5. pH estimate line: `"Estimated pH: ~X.X–Y.Y"` (always shown)
    6. Layer 2 info row with popover trigger (approximation disclosure)
    7. `@if (phStatus())` badge
    8. `@if (showSpeciesNudge())` nudge
    9. Close footer button
  - Styled with `FloraDetailDialogPT`; all interactive elements use `FLORA_FOCUS` and `FLORA_HOVER`; profile cards and info icon button use `cursor-pointer`; popover uses `FloraPopoverPT`
  - Verification: Manual Browser Check — (1) wizard opens with no plant context → 1 L default, no chip selected, results visible immediately as proportions; (2) wizard opens from zone-detail for plant with 15 cm pot diameter → "15 cm · 1.3 L" chip is pre-selected, volume input shows 1.3; (3) tapping a different chip updates volume and results instantly; (4) typing directly in volume input deselects chips; (5) pH line shows `~` prefix; (6) info icon opens popover; (7) clicking outside closes it; (8) switch profiles → results update instantly

- [ ] **Block E — Zone-detail integration** | Agent: `/visualizer`
  - Import `SubstrateMixWizardDialogComponent` into `ZoneDetailComponent`
  - Add signals: `wizardVisible = signal(false)`, `wizardPlant = signal<Plant | null>(null)`, `wizardRecord = signal<CachedBotanicalRecord | null>(null)`
  - Add `openMixWizard(plant: Plant)` method: sets `wizardPlant`, looks up the botanical record for the plant from the existing `botanicalRecords` map (already loaded by zone-detail), sets `wizardRecord`, then sets `wizardVisible(true)`
  - Add "Mix guide" button on each zone-detail plant card — small secondary text action matching the edit/delete pattern; icon `pi-list-check`; label "Mix guide"; `aria-label="Open substrate mix guide for {{ ep.plant.common_name }}"`
  - Add `<app-substrate-mix-wizard-dialog>` at the end of the template with the three signals bound
  - Verification: Manual Browser Check — plant card in zone detail shows "Mix guide" button; clicking it opens the wizard pre-filled with that plant's profile and (if available) volume estimate and pH badge

- [ ] **Block F — Library integration** | Agent: `/visualizer`
  - **Sub-task 1 — Library page header button**: add "Mix Wizard" button to the `/library` page header (next to the "Identify a plant" or main action row); icon `pi-list-check`; opens a local `wizardVisible` signal with no plant/record/preset (fully manual mode); add `<app-substrate-mix-wizard-dialog>` to the library template
  - **Sub-task 2 — Botanical detail dialog Care tab**: in `BotanicalDetailDialogComponent`, add `mixWizardVisible = signal(false)`; add "Build a substrate mix" button on the Care tab (below the preferred_soil_type row, above the pH row); button only rendered when `record()` is non-null; passes `record()` as `botanicalRecord` input to a `<app-substrate-mix-wizard-dialog>` rendered inside the botanical dialog template; the wizard dialog nests fine inside the outer dialog since it opens with its own `z-index`
  - Verification: Manual Browser Check — library header shows "Mix Wizard" button; clicking opens wizard in manual mode; botanical detail dialog Care tab shows "Build a substrate mix" button; clicking opens wizard pre-filled with the species' preferred soil profile and pH comparison badge

---

## Verification sequence (all blocks)

```powershell
bun run format
bun run lint
```

Manual Browser Check after each block. No migration push needed for Block A until the local Supabase stack is running: `bunx supabase migration up`.
