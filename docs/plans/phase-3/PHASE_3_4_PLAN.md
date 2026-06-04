# Phase 3.4 Plan — AI Leaf Doctor (Vision Diagnostics)

Agent chain: `/plumber` (Blocks A–B) → `/visualizer` (Blocks C-Fix, D, E)

---

## Flow summary

1. User taps "Diagnose a Plant" on the journal page → selects a plant → uploads a photo.
2. "Analyze" button appears; user taps it.
3. The Angular client converts the blob to base64 and calls the `claude-vision` Edge Function.
4. The function verifies the user's JWT, sends the image to Claude Sonnet multimodal, and returns a structured diagnostic response.
5. The dialog shows the result (condition, confidence badge, risk badge, remedial actions).
6. User taps "Save as Observation" → an `Observation` journal entry is created with the photo and the `diagnostics` payload pre-filled; notes are auto-generated from the remedial actions.
7. In the journal feed, cards with a `diagnostics` payload show a collapsible Leaf Doctor section.

The care log form ("Log Care Event") remains a clean, routine-only tool. It does not trigger the Leaf Doctor.

---

- [x] **Block A — Edge Function `claude-vision`** | Agent: `/plumber`
  - Create `supabase/functions/claude-vision/index.ts`
  - Auth: extract `Authorization` header; return 401 if absent. Create a service-role Supabase client and call `supabase.auth.getUser(token)` — return 401 if the user cannot be resolved.
  - Body shape: `{ imageBase64: string, imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp' }`. Return 400 if either field is missing.
  - Strip the `data:...;base64,` prefix from `imageBase64` if present (defensive guard).
  - Zod schema mirrors `docs/AI_PROMPT_MANIFEST.md §3.2`: `is_botanical_image` (boolean), `error_message` (string | null), `diagnostics` (object | null) with `primary_condition` (string), `confidence_score` (number 0–1), `immediate_remedial_actions` (string[]), `systemic_risk_assessment` (`'Isolated' | 'ZoneContagious' | 'FatalThreat'`).
  - Build the `messages` array per §3.0: one `image` content block (source `base64`) + one `text` block instructing JSON output.
  - Call `anthropic.messages.parse()` — model `claude-sonnet-4-6`, `max_tokens: 1024`, system prompt from §3.1.
  - If `parsed_output` is null, log the error and return HTTP 503.
  - If `is_botanical_image` is false, return HTTP 200 with `{ is_botanical_image: false, error_message, diagnostics: null }`.
  - If the Anthropic call throws, log with `console.error` and return HTTP 503 with `{ error: 'Leaf Doctor unavailable', error_code: 'API_ERROR' }` per §0.
  - No DB writes — this function is read-only.

- [x] **Block B — DB Migration: `diagnostics` on `plant_journals`** | Agent: `/plumber`
  - New migration file: `ALTER TABLE public.plant_journals ADD COLUMN IF NOT EXISTS diagnostics JSONB;`
  - No RLS change needed — the existing `FOR ALL` policy on `plant_journals` covers the new column.
  - Apply locally: `bunx supabase migration up`
  - Regenerate types: `bun run types`
  - Copy to shared: `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`

- [x] **Block C — Journal Entry Form: Leaf Doctor trigger** | Agent: `/visualizer`
  - ⚠️ Superseded by Block C-Fix. The Leaf Doctor trigger added here is removed in Block C-Fix; the photo preview improvement is carried forward.

- [x] **Block C-Fix — Care log form: remove Leaf Doctor, add photo preview** | Agent: `/visualizer`
  - In `journal-entry-form.ts`:
    - Remove: `LeafDoctorResult` and `LeafDoctorDiagnostics` imports; `diagnosisState`, `diagnosisResult`, `diagnosisAnalyzing` signals; `analyzePlant()`, `confidenceBadgeClass()`, `confidenceBadgeLabel()`, `riskBadgeClass()` methods.
    - Remove from `onFileChange()`: the `diagnosisState.set('idle')` and `diagnosisResult.set(null)` calls.
    - Remove from `resetForm()`: the same two calls; also remove the now-unused `Json` import.
    - Remove from `onSubmit()`: `diagnostics: this.diagnosisResult() as Json | null` — the field is omitted from the payload entirely (nullable column, defaults to null).
    - Add `readonly previewObjectUrl = signal<string | null>(null)`.
    - In `onFileChange()`, after `compressedBlob.set(blob)`: revoke any existing object URL, then `this.previewObjectUrl.set(URL.createObjectURL(blob))`.
    - In `resetForm()`: revoke the preview URL (`const old = this.previewObjectUrl(); if (old) URL.revokeObjectURL(old)`) and set to null.
    - Implement `OnDestroy`: revoke the last URL in `ngOnDestroy()`.
  - In `journal-entry-form.html`, in the Photo section:
    - Replace the `@if (compressedLabel())` text paragraph with a thumbnail row: `<div class="flex items-center gap-3">` containing `<img [src]="previewObjectUrl()" alt="Compressed photo preview" class="w-16 h-16 rounded-garden-sm object-cover border border-neutral-200 dark:border-neutral-700">` alongside the size label text.
    - Remove the entire Leaf Doctor block: analyze button, loading button, success panel, not-botanical message, error message.
  - Below the Notes textarea, add a character counter: `<span class="text-xs font-display text-neutral-400 text-right">{{ notesCtrl.value?.length ?? 0 }}/1000</span>`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Care Log Form:
    ```
    App running at: http://localhost:4200/journal
    1. Open "Log Care Event" → select a plant photo → a 64×64 thumbnail appears alongside the compressed size label.
    2. Select a different photo → thumbnail updates to the new image.
    3. Type in the Notes field → character counter increments (e.g., "12/1000").
    4. Confirm there is no "Analyze with Leaf Doctor" button anywhere in the form.
    5. Submit an entry with a photo → success toast fires, dialog closes.
    6. Open DevTools Console → zero red errors.
    ```

- [ ] **Block D — Journal feed: Leaf Doctor section in entry card** | Agent: `/visualizer`
  - Create `src/app/features/journal/leaf-doctor.utils.ts` with three exported pure functions (thresholds from `docs/AI_PROMPT_MANIFEST.md §0.1`):
    ```ts
    export function confidenceBadgeClass(score: number): string { ... }
    export function confidenceBadgeLabel(score: number): string { ... }
    export function riskBadgeClass(risk: string): string { ... }
    ```
  - In `journal-entry-card.ts`:
    - Import `LeafDoctorDiagnostics` from `'../journal.service'`.
    - Import the three utils from `'../leaf-doctor.utils'`.
    - Import `FLORA_FOCUS` from `'../../../shared/ui/pt/index'`.
    - Add `readonly showDiagnostics = signal(false)`.
    - Add `readonly diagnostics = computed(() => this.entry().diagnostics as LeafDoctorDiagnostics | null)`.
    - Add `toggleDiagnostics()`: `this.showDiagnostics.update(v => !v)`.
    - Expose the three util functions as protected class members so the template can call them: `protected readonly confidenceBadgeClass = confidenceBadgeClass`, etc.
    - Expose `FLORA_FOCUS` as a protected readonly field.
  - In `journal-entry-card.html`, below the entry body `<div>`, add `@if (diagnostics())`:
    - Collapsible toggle `<button type="button" [class]="FLORA_FOCUS + ' w-full flex items-center gap-2 pt-2 mt-1 border-t border-neutral-100 dark:border-neutral-700 text-xs font-semibold font-display text-neutral-500 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-150'" (click)="toggleDiagnostics()" [attr.aria-expanded]="showDiagnostics()" aria-controls="diag-...">`: `pi pi-eye` icon + "Leaf Doctor" label + `pi pi-chevron-down`/`pi pi-chevron-up` toggle.
    - `@if (showDiagnostics())`: expanded panel `<div>` containing primary condition (`text-sm font-semibold`), confidence badge, risk badge, and `<ul class="list-disc pl-4 space-y-0.5 text-xs font-display text-neutral-700 dark:text-neutral-300">` of remedial actions.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Journal Feed Cards:
    ```
    App running at: http://localhost:4200/journal
    1. Find a journal entry created via Block E (has a diagnosis) → a "Leaf Doctor" row appears below the entry body.
    2. Click the row → section expands showing condition, confidence badge, risk badge, and remedial actions list.
    3. Click again → section collapses.
    4. A journal entry without diagnostics shows no Leaf Doctor row.
    5. Open DevTools Console → zero red errors.
    ```

- [ ] **Block E — Standalone "Diagnose a Plant" dialog** | Agent: `/visualizer`
  - Create `src/app/features/journal/leaf-doctor-dialog/leaf-doctor-dialog.ts` and `leaf-doctor-dialog.html`.
  - In `leaf-doctor-dialog.ts`:
    - `visible = model<boolean>(false)`, `preselectedPlantId = input<string | null>(null)`, `entrySaved = output<void>()`.
    - Services: `PlantService`, `JournalService`, `ImageCompressorService`, `SupabaseService`, `MessageService`.
    - Signals: `selectedPlantId = signal<string | null>(null)`, `compressedBlob`, `previewObjectUrl`, `compressedLabel`, `diagnosisState` (`'idle' | 'loading' | 'success' | 'error' | 'not-botanical'`), `diagnosisResult = signal<LeafDoctorDiagnostics | null>(null)`, `saving = signal(false)`.
    - Computed: `plantOptions` (from `PlantService.plants()`), `canSave = computed(() => !!this.selectedPlantId() && this.diagnosisState() === 'success' && !!this.compressedBlob())`, `isAnalyzing = computed(() => this.diagnosisState() === 'loading')`.
    - Constructor `effect()`: when `visible()` becomes true, if `preselectedPlantId()` is non-null, set `selectedPlantId` to it.
    - `onFileChange()`: compress, set blob, set preview URL (revoke old first), reset diagnosis state and result.
    - `analyzePlant()`: read blob → base64 via `FileReader` → set state `'loading'` → invoke `'claude-vision'` → handle all four response paths (not-botanical, success, error/null data).
    - `saveAsObservation()`: set `saving(true)`, get user, upload image, generate notes string (`"Leaf Doctor: ${result.primary_condition}\n${result.immediate_remedial_actions.join('\n')}"`), call `journalService.createEntry()` with `category: 'Observation'`, `diagnostics: result as Json`, and the notes. On success: show toast, emit `entrySaved`, call `resetDialog()`. On error: show error toast. Always clear `saving`.
    - `onCancel()`: call `resetDialog()`, `this.visible.set(false)`.
    - `onVisibleChange(v: boolean)`: if `!v`, call `resetDialog()`; `this.visible.set(v)`.
    - `resetDialog()`: set all signals to their initial values; revoke preview URL.
    - Implement `OnDestroy` to revoke the object URL.
    - Expose `confidenceBadgeClass`, `confidenceBadgeLabel`, `riskBadgeClass` from `'../leaf-doctor.utils'` as protected readonly fields.
    - Expose `FLORA_FOCUS` as protected readonly.
  - In `leaf-doctor-dialog.html`:
    - `<p-dialog>` with header "Diagnose a Plant", `[modal]="true"`, `[draggable]="false"`, `[resizable]="false"`, `[dismissableMask]="true"`, `[pt]="FloraDialogPT"`.
    - Plant selector (required, `FloraSelectPT`, bound to `selectedPlantId` via `ngModel`).
    - Photo section: file input with same styling as the care log form, calls `onFileChange()`. When `compressedBlob()`: thumbnail row (identical structure to Block C-Fix). Analyze button (when blob set and state idle): `<p-button label="Analyze" icon="pi pi-eye" variant="outlined" (onClick)="analyzePlant()" [pt]="FloraButtonPT">`. Loading button (when state loading): same button with `[loading]="true" [disabled]="true"`. Result panel (when state success): condition + badges + remedial list (same structure as the removed Block C panel). Not-botanical `<p-message severity="warn">`. Error `<p-message severity="error">`.
    - Footer `<ng-template #footer>`: "Cancel" text button + "Save as Observation" primary button (`[disabled]="!canSave()" [loading]="saving()"`).
  - In `journal.ts`:
    - Import `LeafDoctorDialogComponent`.
    - Add `readonly diagnosisDialogVisible = signal(false)`.
    - Add `openDiagnosisDialog()`: `this.diagnosisDialogVisible.set(true)`.
  - In `journal.html`, inside the header's `hasPlants()` button group:
    - Add a "Diagnose Plant" outlined button (`icon="pi pi-eye"`, `ariaLabel="Diagnose a plant with Leaf Doctor AI"`) that calls `openDiagnosisDialog()`.
    - Add `<app-leaf-doctor-dialog [(visible)]="diagnosisDialogVisible" [preselectedPlantId]="selectedPlant()" (entrySaved)="onEntrySaved()" />` at the bottom of the template, alongside the existing `<app-journal-entry-form>`.
  - Verification:
    ```powershell
    bun run format
    bun run lint
    ```
  - Manual Browser Check — Leaf Doctor Dialog:
    ```
    App running at: http://localhost:4200/journal
    1. "Diagnose Plant" button appears in the journal header → click it → "Diagnose a Plant" dialog opens.
    2. Select a plant from the dropdown.
    3. Select a plant photo → thumbnail appears in the dialog.
    4. Click "Analyze" → button enters loading state.
    5. On success: diagnostic panel renders (condition, confidence badge, risk badge, remedial list). "Save as Observation" button becomes enabled.
    6. Click "Save as Observation" → toast "Entry logged" fires, dialog closes, journal feed reloads and shows the new Observation entry.
    7. Expand the Leaf Doctor section on the new card → diagnosis data matches what was shown in the dialog.
    8. Try a non-plant image → "not a plant photo" warning appears; "Save as Observation" remains disabled.
    9. Reopen dialog with a plant filter active → plant selector is pre-filled with the filtered plant.
    10. Open DevTools Console → zero red errors.
    ```
