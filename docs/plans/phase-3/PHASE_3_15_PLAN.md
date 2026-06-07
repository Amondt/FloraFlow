# Phase 3.15 — Leaf Doctor from Zone Detail

**Goal:** Surface the AI Leaf Doctor on every plant card in zone-detail. Because the plant is already known at that point, the dialog locks the plant selector and passes the species name to Claude for more targeted, species-aware diagnostics.

**No DB migration.** All changes are purely frontend and Edge Function.

---

## Blocks

- [ ] **Block A — claude-vision: plant context + cache stub** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Extend the request body type to accept `plantContext?: { commonName: string; scientificName?: string | null }` (optional, no breaking change)
  - When `plantContext` is present, replace the generic user text with: `"Analyze this image of a ${commonName}${scientificName ? ` (${scientificName})` : ''} and return a JSON response matching the schema. Focus your diagnosis on conditions known to affect this species."`
  - When absent, keep the existing generic text unchanged — journal flow is unaffected
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
  - Journal flow (no `plantContext`) is unchanged — no upsert fires
  - Update `docs/AI_PROMPT_MANIFEST.md §3.0` to document the optional field and the cache stub side-effect
  - Verification: `bun run format && bun run lint` then `bun run functions:serve` + `Invoke-RestMethod` with and without `plantContext`

- [ ] **Block B — LeafDoctorDialogComponent: locked-plant mode** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Add two optional inputs: `preselectedPlantName = input<string | null>(null)` and `preselectedScientificName = input<string | null>(null)`
  - When `preselectedPlantId()` is non-null at dialog open, show a read-only plant name badge instead of the `<app-plant-select>` — `@if (preselectedPlantId()) { … } @else { … }` guard around the selector section
  - Forward names to the Edge Function body: `plantContext: preselectedPlantName() ? { commonName: preselectedPlantName()!, scientificName: preselectedScientificName() ?? null } : undefined`
  - `resetDialog()` must not clear the `selectedPlantId` when in locked mode (i.e. when `preselectedPlantId()` is set)
  - Journal usage (no `preselectedPlantId`) is unchanged — selector still shown, no `plantContext` sent
  - Verification: `bun run format && bun run lint`

  Manual Browser Check — LeafDoctorDialogComponent locked mode
  ────────────────────────────────────────────────────────────
  App running at: http://localhost:4200/journal

  1. Open Leaf Doctor from Journal → plant selector is visible → works as before
  2. (After Block C) Open Leaf Doctor from a zone-detail plant card → plant selector is hidden; plant name badge shown
  3. Upload a photo and click Analyze → diagnosis result appears
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
    - `[preselectedPlantName]="diagnosisPlant()?.common_name ?? null"`
    - `[preselectedScientificName]="diagnosisPlant()?.scientific_name ?? null"`
    - `(entrySaved)="diagnosisVisible.set(false)"`
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
  6. Open Leaf Doctor from /journal → plant selector still appears (not locked)
  7. Open DevTools Console → zero red errors
