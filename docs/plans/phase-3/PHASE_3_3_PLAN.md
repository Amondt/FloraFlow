# Phase 3.3 — Care Recommendations Panel

Surfaces AI-enriched botanical fields on plant profile cards and in the soil-check dialog. When a species has been enriched by the AI Scribe, the substrate-approximation for check depth is replaced by the species-specific description. Humidity compatibility is compared against the zone's baseline and flagged inline.

**Agent:** `/visualizer` (all blocks) → `/gatekeeper` (sign-off)

**No migration needed.** All fields (`check_depth_description`, `ideal_humidity_min/max`, `care_difficulty`) were added in Phase 3.1. Phase 3.10 fields (`description`, `preferred_soil_type`, `maintenance_level`, `native_region`) are not yet in the schema — this panel will be extended in Phase 3.10 once those columns exist.

---

- [x] **Block A — `CareRecommendationsPanel` shared component** | Agent: `/visualizer`
  - New files:
    - `src/app/shared/components/care-recommendations-panel/care-recommendations-panel.ts`
    - `src/app/shared/components/care-recommendations-panel/care-recommendations-panel.html`
  - Inputs:
    - `record = input.required<CachedBotanicalRecord>()`
    - `zoneHumidity = input<number | null>(null)`
  - Displayed fields (all guarded with `@if` — show only when non-null):
    - **Care difficulty** — `care_difficulty` shown as a badge (`Beginner` / `Intermediate` / `Advanced`); colour-coded: Beginner = success-500, Intermediate = warning-500, Advanced = danger-500.
    - **Watering frequency** — `watering` mapped via existing `getWateringLabel()` utility from `botanical-label.util`.
    - **Sunlight** — `sunlight[]` mapped via existing `getSunlightLabels()` utility; shown as inline chips.
    - **Soil moisture guidance** — `check_depth_description` shown as a plain text paragraph.
    - **Humidity range** — `ideal_humidity_min/max`; if `zoneHumidity` is provided, compare:
      - Zone within range → green "Zone humidity compatible" note.
      - Zone outside range → `<p-message severity="warn" [pt]="FloraMessagePT">` amber alert: e.g. "Zone humidity (45%) is below this plant's ideal range (60–80%)."
  - Import `Message` from `primeng/message`; reuse `FloraMessagePT` and `CachedBotanicalRecord` from existing imports.
  - No new PT object needed.
  - Run:
    ```powershell
    bun run format
    bun run lint
    ```

- [x] **Block B — Soil-check-dialog: AI `check_depth_description` override** | Agent: `/visualizer`
  - `soil-check-dialog.ts`:
    - Inject `LibraryService` via `inject()`.
    - Add `private readonly _botanicalRecord = signal<CachedBotanicalRecord | null>(null)`.
    - Add `effect()`: when `visible()` becomes `true` and `plant().scientific_name` is non-null, call `libraryService.fetchByScientificName(scientific_name)` and set `_botanicalRecord`.
    - Add `readonly isAiEnriched = computed(() => !!(this._botanicalRecord()?.is_ai_enriched && this._botanicalRecord()?.check_depth_description))`.
    - Update `checkDepthDescription()` computed: when `isAiEnriched()`, return `this._botanicalRecord()!.check_depth_description!`; else keep the existing `SUBSTRATE_DEPTH_RULES` lookup.
    - Update `checkDepth()` computed: when `isAiEnriched()`, return `null`; else keep the existing depth string from `SUBSTRATE_DEPTH_RULES`. (The AI description already embeds depth guidance — no separate depth string is needed.)
  - `soil-check-dialog.html` (Step `ask` section):
    - The `checkDepthDescription()` paragraph stays as-is — now shows the AI value when enriched.
    - The "Insert your finger **{{ checkDepth() }}** into the substrate." sentence: wrap in `@if (!isAiEnriched())` so it only shows when using the substrate fallback.
    - Below the substrate hint box, add `@if (isAiEnriched())` → show a tiny `<p>` with `text-[10px] text-neutral-400` noting "Species-specific guidance from AI Scribe."
  - No caller changes — the dialog fetches its own record internally.
  - Run:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Soil Check Dialog
    ```
    App running at: http://localhost:4200/scheduler

    1. Open soil check on a plant with a linked scientific name that has been AI-enriched →
       the hint box shows the AI-sourced text (not the generic substrate wording);
       "Insert your finger X cm" line is absent; "Species-specific guidance from AI Scribe" note is visible.
    2. Open soil check on a plant with no scientific name (or one not yet enriched) →
       existing substrate-based text and "Insert your finger X cm" line both appear unchanged.
    3. Complete the flow (Dry → Log watering, or Not yet → Snooze) → no errors.
    4. Open DevTools Console → zero red errors.
    ```

- [ ] **Block C — Zone-detail: botanical batch fetch + care panel integration** | Agent: `/visualizer`
  - `zone-detail.ts`:
    - Add `readonly botanicalMap = signal<Map<string, CachedBotanicalRecord>>(new Map())`.
    - Add private `async _loadBotanicalRecords(): Promise<void>` — collects all unique `scientific_name` values from `_rawZonePlants()`, filters to names not yet in `botanicalMap`, calls `libraryService.refetchByScientificNames(newNames)`, and merges results into `botanicalMap`.
    - Add `effect()` in the constructor: when `_rawZonePlants()` has plants, call `void this._loadBotanicalRecords()`. Guard with a `toFetch.length === 0` early return inside the method to avoid redundant fetches.
    - Add `readonly expandedPlantId = signal<string | null>(null)`.
    - Add `toggleCarePanel(id: string): void` — sets `expandedPlantId` to `id` if different from current, else to `null`.
    - Add `readonly botanicalRecordFor = (scientificName: string): CachedBotanicalRecord | null => this.botanicalMap().get(scientificName) ?? null`.
  - `zone-detail.html`:
    - Import `CareRecommendationsPanelComponent` in the component's `imports` array.
    - In each plant card's `<footer>`: add a "Care tips" `<button>` (after the Edit button, before the Check soil button) that shows only when `botanicalRecordFor(ep.plant.scientific_name!)` returns a non-null record; clicking calls `toggleCarePanel(ep.plant.id)`. Use the existing management button style (`text-xs font-medium font-display text-neutral-500`). Show "Hide tips" label when `expandedPlantId() === ep.plant.id`, else "Care tips".
    - Below the `<footer>`, add `@if (expandedPlantId() === ep.plant.id && botanicalRecordFor(ep.plant.scientific_name!))`:
      ```html
      <div class="border-t border-neutral-100 dark:border-neutral-700 px-4 py-4">
        <app-care-recommendations-panel
          [record]="botanicalRecordFor(ep.plant.scientific_name!)!"
          [zoneHumidity]="zone()?.humidity_baseline ?? null"
        />
      </div>
      ```
  - Run:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Zone Detail Care Panel
    ```
    App running at: http://localhost:4200/dashboard/zones/<any-zone-id>

    1. Plant with a linked, AI-enriched scientific name → "Care tips" button visible in card footer.
    2. Click "Care tips" → panel expands inline; shows care difficulty badge, watering, sunlight chips, and soil moisture guidance.
    3. When zone humidity is outside the plant's ideal range → amber warning appears in the panel.
    4. When zone humidity is within range → green compatibility note appears.
    5. Click "Hide tips" → panel collapses.
    6. Click "Care tips" on a second plant → first panel collapses, second expands (only one open at a time).
    7. Plant with no scientific name or no botanical record → "Care tips" button is not shown.
    8. Open DevTools Console → zero red errors.
    ```

---

## Phase sign-off — `/gatekeeper`

After all three blocks pass:
1. All three block checkboxes in this file are `[x]`.
2. `bun run lint` — zero errors.
3. All Manual Browser Checks confirmed by user.
4. Mark `docs/PHASES_PLAN.md §3` → task **3.3** checkbox `[x]`.
