# Phase 3.15 — Leaf Doctor from Zone Detail

**Goal:** Make the AI Leaf Doctor **species-aware everywhere** and reachable from zone detail. The dialog always knows which plant it is diagnosing before analysis: the **journal** flow requires the user to pick one of their plants first; the **zone-detail** flow opens with the plant already locked. Both pass the species to Claude for more targeted diagnostics.

**No DB migration.** All changes are purely frontend and Edge Function. (Per the 3.14 design pass: journal flow is plant-first + species-aware, and only the primary photo is stored — see `PHASE_3_14_PLAN.md`.)

---

## Blocks

- [ ] **Block A — claude-vision: plant context + cache stub** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Extend the request body type to accept `plantContext?: { commonName: string; scientificName?: string | null }` (optional, no breaking change)
  - When `plantContext` is present, replace the generic user text with: `"Analyze this image of a ${commonName}${scientificName ? ` (${scientificName})` : ''} and return a JSON response matching the schema. Focus your diagnosis on conditions known to affect this species."`
  - When absent, keep the existing generic text unchanged (defensive — covers any caller that sends no plant)
  - Compose the user text from parts: the image-count / same-plant dimension lands in `PHASE_3_14_PLAN.md` Block C; this block layers the species dimension on top — the two must compose, not overwrite
  - **Background cache stub** — when `plantContext.scientificName` is present, fire a background upsert via `EdgeRuntime?.waitUntil`:
    ```ts
    const stubWork = supabase
      .from('cached_botanical_records')
      .upsert(
        { scientific_name: plantContext.scientificName, common_name: plantContext.commonName },
        { onConflict: 'scientific_name' },
      )
      .catch(err => console.error('claude-vision: cache stub failed:', err));
    EdgeRuntime?.waitUntil(stubWork);
    ```
    This mirrors the `claude-plant-id` pattern: if the species is not yet cached, the 10-min cron picks up the stub for full AI enrichment; if already cached, only `common_name` is updated — all enriched columns are untouched.
  - Add the `EdgeRuntime` declaration at the top of the file: `declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined;`
  - Both flows now send `plantContext` (journal + zone detail), so the stub fires from either — beneficial: more searched species get queued for enrichment
  - Update `docs/AI_PROMPT_MANIFEST.md §3.0` to document the optional field and the cache stub side-effect
  - Verification: `bun run format && bun run lint` then `bun run functions:serve` + `Invoke-RestMethod` with and without `plantContext`

- [ ] **Block B — LeafDoctorDialogComponent: species-aware (both modes)** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Add `selectedPlantContext = computed()` — flatten `plantOptions()`, find the option whose `value === selectedPlantId()`, return `{ commonName: option.label, scientificName: option.scientificName ?? null }` or `null`. One source for both modes; no extra name inputs needed (the selected option already carries the scientific name).
  - **Journal mode** (`preselectedPlantId()` is null): the existing top selector stays visible and becomes **required** — `primaryActionDisabled` returns `true` in the pre-analysis state when `!selectedPlantId()`. Remove the now-dead post-success "Select one of your plants above to save…" hint (a plant is always chosen first).
  - **Zone-detail mode** (`preselectedPlantId()` set): `@if (preselectedPlantId()) { read-only plant-name badge } @else { <app-plant-select> }`; badge label reads `selectedPlantContext()?.commonName`.
  - `analyzePlant`: send `plantContext: selectedPlantContext() ?? undefined` in the request body (fires in both modes).
  - `resetDialog()` must not clear `selectedPlantId` when `preselectedPlantId()` is set (locked); journal mode clears it as today.
  - Verification: Manual Browser Check (below)

  Manual Browser Check — LeafDoctorDialogComponent species-aware
  ────────────────────────────────────────────────────────────
  App running at: http://localhost:4200/journal

  1. Open Leaf Doctor from Journal → selector visible at top → Analyze stays disabled until a plant is selected
  2. Select a plant, upload a photo, click Analyze → diagnosis appears (DevTools Network: request body carries `plantContext`)
  3. (After Block C) Open from a zone-detail plant card → selector hidden; plant-name badge shown; Analyze enabled once a photo is added
  4. Click "Save as Observation" → entry saved, dialog closes
  5. Open DevTools Console → zero red errors

- [ ] **Block C — ZoneDetailComponent: Leaf Doctor entry point** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Add `readonly diagnosisPlant = signal<Plant | null>(null)` and `readonly diagnosisVisible = signal(false)` to `ZoneDetailComponent`
  - Add `openDiagnosis(plant: Plant): void` method — sets `diagnosisPlant` + `diagnosisVisible.set(true)` (after `blurActiveElement()`)
  - Add `onDiagnosisClose(v: boolean): void` — mirrors `onSoilDialogVisibleChange`: sets visibility, clears plant on close
  - Import `LeafDoctorDialogComponent` in the `imports` array
  - Add `<app-leaf-doctor-dialog>` to the dialogs section with bindings:
    - `[visible]="diagnosisVisible()"`
    - `(visibleChange)="onDiagnosisClose($event)"`
    - `[preselectedPlantId]="diagnosisPlant()?.id ?? null"`
    - `(entrySaved)="diagnosisVisible.set(false)"`
  - No name inputs to pass — the badge label and `plantContext` resolve from `selectedPlantId` via `plantOptions` (Block B)
  - Add "Diagnose" button to the plant card footer, between "Mix substrate" and "Check soil":
    ```html
    <button type="button"
      class="inline-flex items-center gap-1 text-xs font-medium font-display text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer px-2 py-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      [attr.aria-label]="'Diagnose ' + ep.plant.common_name + ' with Leaf Doctor'"
      (click)="openDiagnosis(ep.plant)"
    >
      <i class="pi pi-heart-fill text-[10px]" aria-hidden="true"></i>
      Diagnose
    </button>
    ```
  - Verification: `bun run format && bun run lint`

  Manual Browser Check — ZoneDetailComponent Leaf Doctor
  ───────────────────────────────────────────────────────
  App running at: http://localhost:4200/dashboard/zones/<any-id>

  1. Each plant card footer shows a "Diagnose" button between "Mix substrate" and "Check soil"
  2. Click "Diagnose" → Leaf Doctor dialog opens; plant name badge shown (no selector dropdown)
  3. Upload any non-plant image → "doesn't look like a plant photo" warning shown
  4. Upload a plant photo → AI analyzes; result panel shows condition + badges
  5. Click "Save as Observation" → success toast; dialog closes; plant name badge still correct if reopened
  6. Open Leaf Doctor from /journal → selector appears (not locked) and is required before Analyze
  7. Open DevTools Console → zero red errors
