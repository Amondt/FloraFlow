# Phase 3.5 Plan — Intelligent Seed Vault Module

Agent chain: `/plumber` (Blocks A–B) → `/visualizer` (Blocks C–F)

---

## Design Intent

The Seed Vault is not a standalone feature — it is the **origin layer of plant management**. A seed batch is a plant before it has a pot. The vault tracks the journey from packet to soil, and when a seedling is potted it graduates directly into the scheduler.

Three integration points make this feel native to the app:

1. **Library → Vault**: Viewing a botanical species? One button saves it as a seed batch to track.
2. **Vault → Scheduler**: When a batch reaches "Potted Up", a "Graduate to Plant" CTA opens the Add Plant form pre-filled — the seed becomes a tracked plant in the care cycle.
3. **Stage intelligence**: Timestamps for sowing and germination are auto-stamped on the relevant transitions. Stages are forward-only — the system enforces the biology.

---

## Stage Progression

```
Stored → Sown Indoors → Germinated → Potted Up → Hardened Off → Transplanted Outside
```

- `sown_at` is stamped when advancing to **Sown Indoors**
- `germinated_at` is stamped when advancing to **Germinated**
- No advance button is shown at **Transplanted Outside** (terminal stage)
- "Graduate to Plant" CTA appears from **Potted Up** onward — at that point the seedling needs care scheduling

---

## Files

**New:**
- `supabase/migrations/<timestamp>_seed_batches.sql`
- `src/app/features/vault/seed-batch.model.ts`
- `src/app/features/vault/seed-batch.service.ts`
- `src/app/features/vault/seed-batch.service.spec.ts`
- `src/app/features/vault/seed-batch-card/seed-batch-card.ts`
- `src/app/features/vault/seed-batch-card/seed-batch-card.html`
- `src/app/features/vault/seed-batch-form-dialog/seed-batch-form-dialog.ts`
- `src/app/features/vault/seed-batch-form-dialog/seed-batch-form-dialog.html`
- `src/app/features/vault/vault.html`

**Modified:**
- `src/app/features/vault/vault.ts` (replace stub)
- `src/app/shared/components/botanical-detail-dialog/botanical-detail-dialog.ts` (Block F)
- `src/app/shared/components/botanical-detail-dialog/botanical-detail-dialog.html` (Block F)
- `src/app/features/library/library.ts` (Block F)

---

- [x] **Block A — Migration: `seed_batches`** | Agent: `/plumber`
  - Create a new migration file in `supabase/migrations/` named `<timestamp>_seed_batches.sql`.
  - Define the ENUM and table per the `docs/DB_SCHEMA_MATRIX.md §7` stub:
    ```sql
    CREATE TYPE seed_stage_type AS ENUM (
        'Stored', 'Sown Indoors', 'Germinated', 'Potted Up', 'Hardened Off', 'Transplanted Outside'
    );

    CREATE TABLE public.seed_batches (
        id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
        common_name     TEXT NOT NULL,
        scientific_name TEXT,
        brand           TEXT,
        packet_year     INT,
        current_stage   seed_stage_type DEFAULT 'Stored'::seed_stage_type NOT NULL,
        sown_at         TIMESTAMP WITH TIME ZONE,
        germinated_at   TIMESTAMP WITH TIME ZONE,
        notes           TEXT,
        created_at      TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        updated_at      TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    ALTER TABLE public.seed_batches ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Gardeners manage their own seed batches"
        ON public.seed_batches FOR ALL
        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    CREATE TRIGGER trg_seed_batches_updated_at
        BEFORE UPDATE ON public.seed_batches
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

    CREATE INDEX idx_seed_batches_user_stage
        ON public.seed_batches(user_id, current_stage);
    ```
  - Apply locally:
    ```powershell
    bunx supabase migration up
    ```
  - Verify the table exists:
    ```powershell
    bunx supabase db execute --local "SELECT id, common_name, current_stage FROM seed_batches LIMIT 1;"
    ```
  - Regenerate types:
    ```powershell
    bun run types
    Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts
    ```
  - Confirm `seed_batches` and `seed_stage_type` appear in `src/types/database.types.ts`.

- [x] **Block B — Model & Service** | Agent: `/plumber`
  - Create `src/app/features/vault/seed-batch.model.ts`:
    - `SeedStage` union type mirroring the ENUM values.
    - `SEED_STAGE_OPTIONS: SeedStage[]` — ordered progression array (used for advance logic).
    - `SeedBatch` interface matching all `seed_batches` columns (use `string | null` for nullable text fields, `number | null` for `packet_year`, `string | null` for timestamps).
    - `SeedBatchFormData` interface: `common_name`, `scientific_name`, `brand`, `packet_year`, `notes` — all optional except `common_name`.
  - Create `src/app/features/vault/seed-batch.service.ts` — `SeedBatchService` (`providedIn: 'root'`):
    - Signals: `batches = signal<SeedBatch[]>([])`, `loading = signal(false)`, `error = signal<string | null>(null)`.
    - `loadBatches()` — SELECT all columns, ordered by `created_at DESC`.
    - `createBatch(data: SeedBatchFormData): Promise<SeedBatch | null>` — INSERT + `.select().single()`; pushes result into `batches` signal.
    - `updateBatch(id: string, data: SeedBatchFormData): Promise<void>` — UPDATE; refreshes the single row in the signal.
    - `deleteBatch(id: string): Promise<void>` — DELETE; removes from signal.
    - `advanceStage(batch: SeedBatch): Promise<void>`:
      - Derive `nextStage` from `SEED_STAGE_OPTIONS` — if already at terminal stage, return early.
      - Build the UPDATE payload: always includes `current_stage: nextStage`.
      - If `nextStage === 'Sown Indoors'`: add `sown_at: new Date().toISOString()`.
      - If `nextStage === 'Germinated'`: add `germinated_at: new Date().toISOString()`.
      - On success: update the matching entry in `batches` signal in-place.
  - Create `src/app/features/vault/seed-batch.service.spec.ts` — unit tests covering:
    - `advanceStage()` returns early when batch is at 'Transplanted Outside'.
    - `advanceStage()` from 'Stored' produces `current_stage: 'Sown Indoors'` and a non-null `sown_at`.
    - `advanceStage()` from 'Sown Indoors' produces `current_stage: 'Germinated'` and a non-null `germinated_at`.
    - `advanceStage()` from 'Germinated' produces `current_stage: 'Potted Up'` without touching timestamps.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    bun run test
    ```

- [x] **Block C — Vault Page Shell + Seed Batch Card** | Agent: `/visualizer`
  - Create `src/app/features/vault/seed-batch-card/seed-batch-card.ts` and `.html`:
    - Inputs: `batch = input.required<SeedBatch>()`.
    - Outputs: `advanceRequested = output<void>()`, `editRequested = output<void>()`, `deleteRequested = output<void>()`, `graduateRequested = output<void>()`.
    - Computed: `isTerminalStage = computed(() => this.batch().current_stage === 'Staged.Outside')` — use `SEED_STAGE_OPTIONS` to determine if no next stage exists.
    - Computed: `canGraduate = computed(() => ['Potted Up', 'Hardened Off', 'Transplanted Outside'].includes(this.batch().current_stage))`.
    - Template (`<article>`): stage badge (see color map below), common name (`<h3>`), scientific name italic, brand + packet year inline if set, sown/germinated dates if set, notes preview (2-line clamp). Footer: "Advance Stage" button (hidden when terminal), "Graduate to Plant" CTA (shown when `canGraduate()`), edit link, delete link.
    - Stage badge color map (compose with `FloraTagPT`):
      - `Stored` → `neutral-400` text, `neutral-100` bg
      - `Sown Indoors` → `primary-600` text, `primary-50` bg
      - `Germinated` → `success-500` text, green-50 bg
      - `Potted Up` → `primary-700` text, `primary-50` bg
      - `Hardened Off` → `warning-500` text, amber-50 bg
      - `Transplanted Outside` → `primary-900` text, `primary-50` bg
  - Replace the `vault.ts` stub and create `vault.html`:
    - Extract existing inline template into `vault.html`; update `vault.ts` to use `templateUrl`.
    - Inject `SeedBatchService`, `ConfirmationService`, `MessageService`, `Router`.
    - On `ngOnInit`: call `loadBatches()`.
    - Signals: `selectedStageFilter = signal<SeedStage | 'All'>('All')`.
    - Computed: `filteredBatches = computed(...)` — filters `batches()` by `selectedStageFilter()`.
    - Computed: `activeCount = computed(() => ...)` — count of batches not at 'Stored'.
    - Header: eyebrow pattern — `"Seed Vault"` as `<h1>`, subtitle with live count (e.g. "5 batches · 3 actively growing").
    - Stage filter tabs: "All" + each of the 6 stage values — plain `<button>` elements with `[class.text-primary-600]="selectedStageFilter() === stage"`.
    - Batch list: `<ul class="flex flex-col gap-4">` with `@for (batch of filteredBatches(); track batch.id)`.
    - Skeleton loaders (3×) while `loading()` is true.
    - Empty state when `!loading() && filteredBatches().length === 0`.
    - Wire card outputs: `(advanceRequested)` → call `confirmAdvance(batch)`, `(editRequested)` → open form dialog in edit mode, `(deleteRequested)` → confirm then delete, `(graduateRequested)` → open plant form dialog (Block E).
    - `confirmAdvance(batch)`: uses `ConfirmationService` to confirm the advance; on accept calls `SeedBatchService.advanceStage(batch)`; on success shows toast `"Batch advanced to ${nextStage}"`.
    - `confirmDelete(batch)`: uses `ConfirmationService`; on accept calls `SeedBatchService.deleteBatch(batch.id)`; on success shows toast `"Batch deleted"`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Vault Page:
    ```
    App running at: http://localhost:4200/vault

    1. Page loads with eyebrow header "Seed Vault" and a subtitle.
    2. No batches yet → empty state renders with a "Add your first seed batch" CTA.
    3. Stage filter tabs appear above the list ("All", "Stored", "Sown Indoors", …).
    4. Clicking a filter tab updates the list (empty state shown correctly when filter returns no results).
    5. Open DevTools Console → zero red errors.
    ```

- [x] **Block D — Add/Edit Batch Dialog** | Agent: `/visualizer`
  - Create `src/app/features/vault/seed-batch-form-dialog/seed-batch-form-dialog.ts` and `.html`:
    - `visible = model<boolean>(false)`.
    - `prefill = input<SeedBatchFormData | null>(null)` — pre-fills fields when set (Library integration + edit mode).
    - `editTarget = input<SeedBatch | null>(null)` — when set, dialog title becomes "Edit Batch"; on submit calls `updateBatch()`; when null, calls `createBatch()`.
    - `saved = output<SeedBatch>()`.
    - Services: `SeedBatchService`, `MessageService`.
    - Signals: `saving = signal(false)`, reactive form fields as signals (`commonNameCtrl`, `scientificNameCtrl`, `brandCtrl`, `packetYearCtrl`, `notesCtrl`) — all `FormControl` via `FormBuilder` / reactive forms.
    - `effect()` on `prefill()`: when non-null, patch the form fields.
    - `effect()` on `editTarget()`: when non-null, patch all form fields from the existing batch.
    - `onSubmit()`: validate, set `saving(true)`, call create or update, on success emit `saved`, close dialog, show toast. On error: show error toast, preserve form values.
    - `onCancel()`: reset form, close dialog.
    - Fields (all using canonical form anatomy from `docs/DESIGN_SYSTEM.md §5`):
      - `common_name` — required, text input
      - `scientific_name` — optional, text input, hint: "Latin name (optional)"
      - `brand` — optional, text input, hint: "Seed brand or supplier"
      - `packet_year` — optional, number input (`pInputText` with `type="number"`, min 2000, max current year)
      - `notes` — optional, textarea
    - Footer: "Cancel" text button + "Save Batch" / "Save Changes" primary button with loading spinner.
  - Wire the dialog into `vault.ts`:
    - Add `formDialogVisible = signal(false)`, `editTarget = signal<SeedBatch | null>(null)`, `prefillData = signal<SeedBatchFormData | null>(null)`.
    - `openCreateDialog(prefill?: SeedBatchFormData)`: sets `editTarget(null)`, `prefillData(prefill ?? null)`, `formDialogVisible(true)`.
    - `openEditDialog(batch: SeedBatch)`: sets `editTarget(batch)`, `prefillData(null)`, `formDialogVisible(true)`.
    - Handle `(saved)` from the dialog: show success toast.
    - Connect the empty-state "Add your first seed batch" CTA and the page-header "New batch" button to `openCreateDialog()`.
    - Connect `(editRequested)` on cards to `openEditDialog(batch)`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Batch Form Dialog:
    ```
    App running at: http://localhost:4200/vault

    1. Click "New batch" → dialog opens with all fields empty, title "New Seed Batch".
    2. Submit with empty common_name → validation error shown on the field; form not submitted.
    3. Fill common_name + optional fields → submit → dialog closes, new card appears in list, toast "Batch saved" fires.
    4. Click Edit on a card → dialog opens pre-filled with that batch's data, title "Edit Batch".
    5. Change a field → save → card updates in-place, toast "Batch updated" fires.
    6. Open DevTools Console → zero red errors.
    ```

- [x] **Block E — Stage Advance + Graduate to Plant CTA** | Agent: `/visualizer`
  - Wire the advance confirm flow in `vault.ts` (scaffolded in Block C):
    - `nextStageName(batch: SeedBatch): string` — pure helper using `SEED_STAGE_OPTIONS`.
    - `confirmAdvance(batch: SeedBatch)`: opens a `ConfirmationService` dialog with message `"Advance '${batch.common_name}' to ${nextStage}? This cannot be undone."`, accept label `"Advance"`, reject label `"Cancel"`.
  - Wire the "Graduate to Plant" CTA in `vault.ts`:
    - Inject `PlantFormDialogComponent` by importing it into `vault.ts`'s `imports` array.
    - Signals: `plantFormVisible = signal(false)`, `graduatePrefill = signal<{ common_name: string; scientific_name: string | null } | null>(null)`.
    - `onGraduateRequested(batch: SeedBatch)`: set `graduatePrefill` from the batch, set `plantFormVisible(true)`.
    - `onPlantSaved()`: set `plantFormVisible(false)`, show toast `"Plant added to your greenhouse"` with a router link to `/scheduler`; toast summary includes the plant name.
    - In `vault.html`: add `<app-plant-form-dialog [(visible)]="plantFormVisible" [prefillName]="graduatePrefill()?.common_name" [prefillScientific]="graduatePrefill()?.scientific_name" (plantSaved)="onPlantSaved()" />`.
    - Check `plant-form-dialog.ts` input names — use the actual input signal names already defined there. If those prefill inputs do not exist, add them as optional `input<string | null>(null)` signals and wire them into the form's initial state via an `effect()`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Stage Advance & Graduate:
    ```
    App running at: http://localhost:4200/vault

    1. Create a batch in "Stored" stage → "Advance Stage" button is visible; no "Graduate to Plant" button.
    2. Click "Advance Stage" → confirm dialog shows "Advance to Sown Indoors? This cannot be undone." → confirm → card badge updates to "Sown Indoors"; toast fires.
    3. Advance through to "Potted Up" → "Graduate to Plant" CTA appears on the card.
    4. Click "Graduate to Plant" → Add Plant dialog opens with common_name pre-filled.
    5. Select a zone and save → dialog closes, toast "Plant added to your greenhouse" fires.
    6. Navigate to /scheduler → the new plant appears.
    7. At "Transplanted Outside" → no "Advance Stage" button visible.
    8. Open DevTools Console → zero red errors.
    ```

- [x] **Block G — Archive End State** | Agent: `/plumber` → `/visualizer`
  - **Plumber:**
  - Create a new migration `<timestamp>_seed_batches_archive.sql`:
    ```sql
    ALTER TABLE public.seed_batches
        ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
    ```
  - Apply locally: `bunx supabase migration up`
  - Verify: `bunx supabase db execute --local "SELECT column_name FROM information_schema.columns WHERE table_name='seed_batches' AND column_name='archived_at';"`
  - Regenerate types: `bun run types` then `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`
  - In `seed-batch.model.ts`: add `archived_at: string | null` to the `SeedBatch` interface.
  - In `seed-batch.service.ts`:
    - `loadBatches()`: add `.is('archived_at', null)` filter — returns active batches only.
    - Add `archivedBatches = signal<SeedBatch[]>([])`.
    - Add `loadArchivedBatches(): Promise<void>` — queries `WHERE archived_at IS NOT NULL ORDER BY archived_at DESC`; populates `archivedBatches`.
    - Add `archiveBatch(id: string): Promise<void>` — UPDATE `archived_at = new Date().toISOString()`; removes the row from `batches()` in-place.
    - Update `advanceStage()`: after a successful advance to `'Transplanted Outside'`, immediately call `archiveBatch(batch.id)` to auto-archive.
  - Verification: `bun run format && bun run lint && bun run test`
  - **Visualizer:**
  - In `seed-batch-card.ts`:
    - Add `isArchived = computed(() => !!this.batch().archived_at)`.
    - Add `archiveRequested = output<void>()`.
    - When `isArchived()`: suppress advance, edit, and graduate outputs; keep delete.
    - When not archived: show an "Archive" action button that emits `archiveRequested`.
  - In `seed-batch-card.html`:
    - When archived: apply muted card styling; show an "Archived" label in place of the stage badge; show the archived date in a small line. No Advance / Edit / Graduate buttons.
    - When not archived: existing layout unchanged, plus Archive action in the footer alongside Edit and Delete.
  - In `vault.ts`:
    - Extend `stageFilters` array and `selectedStageFilter` signal type to include `'Archived'`.
    - Add an `effect()` that calls `batchService.loadArchivedBatches()` when `selectedStageFilter() === 'Archived'`.
    - Update `filteredBatches` computed: when filter is `'Archived'`, return `batchService.archivedBatches()`; otherwise existing logic unchanged.
    - Update `getBatchCount()` to return `batchService.archivedBatches().length` when passed `'Archived'`.
    - Add `confirmArchive(batch: SeedBatch)`: uses `ConfirmationService` with message `"Archive '${batch.common_name}'? It will move to your archive."`, accept label `"Archive"`.
    - Add `_doArchive(batch: SeedBatch)`: calls `batchService.archiveBatch(batch.id)`; on success shows toast `"Batch archived"`.
    - Update `_doAdvance` success toast when `nextStage === 'Transplanted Outside'`: `"'${batch.common_name}' is transplanted outside and has been archived."`.
  - In `vault.html`: wire `(archiveRequested)="confirmArchive(batch)"` on `<app-seed-batch-card>`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Archive End State:
    ```
    App running at: http://localhost:4200/vault

    1. On any active batch card → an "Archive" button is visible in the footer.
    2. Click "Archive" → confirm dialog appears with the batch name → confirm
       → batch disappears from active view; success toast fires.
    3. Click the "Archived" filter tab → the archived batch appears with muted styling,
       an "Archived" label, and the archived date.
    4. Advance a different batch all the way to "Transplanted Outside"
       → batch disappears from the active list immediately after confirmation
       → toast reads "is transplanted outside and has been archived".
    5. Click "Archived" tab → that batch also appears there.
    6. In "Archived" tab: no Advance / Edit / Graduate buttons; Delete is present and works.
    7. Open DevTools Console → confirm zero red errors.
    ```

- [ ] **Block F — Library Integration: "Save to Seed Vault"** | Agent: `/visualizer`
  - In `src/app/shared/components/botanical-detail-dialog/botanical-detail-dialog.ts`:
    - Add `vaultRequested = output<CachedBotanicalRecord>()`.
    - Add `onSaveToVault()`: emits `vaultRequested` with the current `record()`.
  - In `botanical-detail-dialog.html`, in the footer `<ng-template #footer>`:
    - Add a "Save to Vault" secondary outlined button (`icon="pi pi-bookmark"`, `ariaLabel="Save species to Seed Vault"`) before the existing "Add to my greenhouse" button; calls `onSaveToVault()`.
    - Button only visible when `record()` is non-null.
  - In `src/app/features/library/library.ts`:
    - Inject `Router`.
    - Add `onVaultRequested(rec: CachedBotanicalRecord)`: navigate to `/vault` with query params `{ name: rec.common_name, scientific: rec.scientific_name ?? null }`.
  - In `library.html`: wire `(vaultRequested)="onVaultRequested($event)"` on `<app-botanical-detail-dialog>`.
  - In `src/app/features/vault/vault.ts`:
    - Inject `ActivatedRoute`.
    - In `ngOnInit()`, after `loadBatches()`: read `route.snapshot.queryParamMap`; if `name` param is present, call `openCreateDialog({ common_name: name, scientific_name: scientific ?? null, brand: null, packet_year: null, notes: null })`, then clear params via `this.router.navigate([], { queryParams: {}, replaceUrl: true })`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Library → Vault Flow:
    ```
    App running at: http://localhost:4200/library

    1. Search for any species → open the botanical detail dialog.
    2. "Save to Vault" button appears in the dialog footer.
    3. Click "Save to Vault" → dialog closes, browser navigates to /vault.
    4. The "New Seed Batch" form dialog opens automatically, pre-filled with the species name.
    5. Save the form → batch appears in the vault list.
    6. Navigate back to /library → URL has no stale query params.
    7. Open DevTools Console → zero red errors.
    ```
