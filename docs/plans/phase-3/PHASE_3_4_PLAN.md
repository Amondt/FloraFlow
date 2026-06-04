# Phase 3.4 Plan — AI Leaf Doctor (Vision Diagnostics)

Agent chain: `/plumber` (Blocks A–B) → `/visualizer` (Blocks C–D)

---

## Flow summary

1. User selects a photo in the journal entry form → compressed blob is ready.
2. An "Analyze with Leaf Doctor" button appears; user taps it.
3. The Angular client converts the blob to base64 and calls the `claude-vision` Edge Function.
4. The function verifies the user's JWT, sends the image to Claude Sonnet multimodal, and returns a structured diagnostic response.
5. The form shows the result inline (condition, confidence badge, risk badge, remedial actions).
6. When the user submits the entry, the `diagnostics` JSON is persisted alongside the journal row.
7. In the journal feed, cards with a `diagnostics` payload show a collapsible Leaf Doctor section.

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
  - If `is_botanical_image` is false, return HTTP 200 with `{ is_botanical_image: false, error_message, diagnostics: null }` — a valid response, not a failure.
  - If the Anthropic call throws, log with `console.error` and return HTTP 503 with `{ error: 'Leaf Doctor unavailable', error_code: 'API_ERROR' }` per §0.
  - No DB writes — this function is read-only.
  - Verification: serve with `bunx supabase functions serve --no-verify-jwt --env-file supabase/functions/.env`. Run a manual curl POST with a sample base64 image. Confirm the response matches the schema on both the botanical and non-botanical paths.

- [x] **Block B — DB Migration: `diagnostics` on `plant_journals`** | Agent: `/plumber`
  - New migration file: `ALTER TABLE public.plant_journals ADD COLUMN IF NOT EXISTS diagnostics JSONB;`
  - No RLS change needed — the existing `FOR ALL` policy on `plant_journals` covers the new column.
  - Apply locally: `bunx supabase migration up`
  - Regenerate types: `bun run types`
  - Copy to shared: `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`
  - Verification: `bunx supabase db test` — all existing tests pass. Confirm `diagnostics jsonb` appears in `\d public.plant_journals`.

- [x] **Block C — Journal Entry Form: Leaf Doctor trigger** | Agent: `/visualizer`
  - Define `LeafDoctorDiagnostics` and `LeafDoctorResult` interfaces in `journal.service.ts` (shared by form and card):
    ```ts
    export interface LeafDoctorDiagnostics {
      primary_condition: string;
      confidence_score: number;
      immediate_remedial_actions: string[];
      systemic_risk_assessment: 'Isolated' | 'ZoneContagious' | 'FatalThreat';
    }
    export interface LeafDoctorResult {
      is_botanical_image: boolean;
      error_message: string | null;
      diagnostics: LeafDoctorDiagnostics | null;
    }
    ```
  - In `journal-entry-form.ts`:
    - Add three signals: `diagnosisState = signal<'idle' | 'loading' | 'success' | 'error' | 'not-botanical'>('idle')`, `diagnosisResult = signal<LeafDoctorDiagnostics | null>(null)`, `diagnosisAnalyzing = computed(() => this.diagnosisState() === 'loading')`.
    - Add `async analyzePlant()`: read `compressedBlob()`, convert to base64 via `FileReader` (readAsDataURL → split on `,` → take index 1), set state `'loading'`, call `this.supabase.client.functions.invoke<LeafDoctorResult>('claude-vision', { body: { imageBase64, imageMediaType: 'image/jpeg' } })`. On success with `is_botanical_image: false`, set state `'not-botanical'`. On success with diagnostics, set `diagnosisResult(data.diagnostics)` and state `'success'`. On error or 503, set state `'error'`.
    - In `onFileChange()`, after setting the new blob, call `diagnosisState.set('idle')` and `diagnosisResult.set(null)` to clear any prior result.
    - In `resetForm()`, also reset `diagnosisState('idle')` and `diagnosisResult(null)`.
    - In `onSubmit()`, include `diagnostics: this.diagnosisResult()` in the `createEntry` payload.
  - In `journal-entry-form.html`, below the photo "image ready" label:
    - When `compressedLabel()` is set and `diagnosisState() === 'idle'`: show an "Analyze with Leaf Doctor" button (outlined, `pi pi-eye` icon, calls `analyzePlant()`).
    - When `diagnosisState() === 'loading'`: show same button with `[loading]="true"` and disabled.
    - When `diagnosisState() === 'success'` and `diagnosisResult()`: show a diagnostic panel with:
      - Primary condition in `text-sm font-semibold`.
      - Confidence badge using §0.1 thresholds: `< 0.50` → `bg-danger-500/10 text-danger-700` + "Uncertain"; `0.50–0.75` → `bg-warning-500/10 text-warning-500` + "Low confidence"; `> 0.75` → `bg-success-500/10 text-success-500` + "Confident".
      - Risk badge: `Isolated` → neutral; `ZoneContagious` → `bg-warning-500/10 text-warning-500`; `FatalThreat` → `bg-danger-500/10 text-danger-700`.
      - Remedial actions as `<ul class="list-disc pl-4 space-y-0.5 text-xs font-display text-neutral-700">`.
    - When `diagnosisState() === 'not-botanical'`: `<p-message severity="warn">` — "This doesn't look like a plant photo. Try a clear close-up of a leaf or stem."
    - When `diagnosisState() === 'error'`: `<p-message severity="error">` — "Leaf Doctor is unavailable — your photo will still be saved."
  - Manual Browser Check:
    1. Navigate to `http://localhost:4200/journal`.
    2. Open the "Log Care Event" dialog → select a plant photo → compressed label appears → "Analyze with Leaf Doctor" button appears.
    3. Click Analyze → spinner shows on the button.
    4. On result: diagnostic panel renders with condition, confidence badge, risk badge, and remedial actions list.
    5. Select a different photo → diagnostic panel clears, button reappears as idle.
    6. Try a non-plant image (e.g., a landscape photo) → "not a plant photo" warning appears.
    7. Submit an entry with a successful diagnosis → success toast fires.
    8. Open DevTools Console → zero red errors.

- [ ] **Block D — Journal Feed: diagnostic section in entry card** | Agent: `/visualizer`
  - In `journal-entry-card.ts`:
    - Import `LeafDoctorDiagnostics` from `journal.service.ts`.
    - Add `showDiagnostics = signal(false)`.
    - Add `diagnostics = computed(() => this.entry().diagnostics as LeafDoctorDiagnostics | null)`.
    - Add `toggleDiagnostics()` method: `this.showDiagnostics.update(v => !v)`.
    - Add `confidenceBadgeClass(score: number)` pure method: returns Tailwind classes per §0.1 thresholds.
    - Add `riskBadgeClass(risk: string)` pure method: `'Isolated'` → neutral, `'ZoneContagious'` → warning, `'FatalThreat'` → danger.
  - In `journal-entry-card.html`, below the existing entry body, when `diagnostics()` is non-null:
    - Collapsible section header: `<button>` with `pi pi-eye` icon, "Leaf Doctor" label, `pi pi-chevron-down`/`pi pi-chevron-up` toggle — calls `toggleDiagnostics()`. Apply `FLORA_FOCUS`.
    - When `showDiagnostics()`: expanded body with primary condition, confidence badge, risk badge, and `<ul>` of remedial actions.
  - Manual Browser Check:
    1. Navigate to `http://localhost:4200/journal`.
    2. Find a journal entry that was submitted with a Leaf Doctor diagnosis → a "Leaf Doctor" row appears below the entry body.
    3. Click the row → section expands, showing condition, badges, and remedial list.
    4. Click again → collapses.
    5. A journal entry without diagnostics shows no Leaf Doctor row.
    6. Open DevTools Console → zero red errors.
