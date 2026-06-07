# Phase 3.9 — AI Plant Identifier (Photo-to-Species)

**Objective:** Let users identify any plant by photographing it. A single shared dialog handles the AI call; four entry points each act on the result in the way that fits their context.

**Entry points:**

| Location                            | Post-identification action                                   |
| ----------------------------------- | ------------------------------------------------------------ |
| Dashboard "Identify a plant" button | Opens `BotanicalDetailDialog` → "Add to my plants"           |
| Add Plant dialog                    | Pre-fills `common_name`, `scientific_name`, `perenual_id`    |
| Library page                        | Auto-selects identified species, opens detail panel          |
| ~~Zone Detail page~~                | ~~Opens Add Plant with zone + species pre-filled~~ — Dropped |

**No DB migration needed.** `cached_botanical_records` already exists; enrichment is triggered async via `claude-enrichment`.

---

## Blocks

- [x] **Block A — `claude-plant-id` Edge Function** | Agent: `/plumber`
  - New file: `supabase/functions/claude-plant-id/index.ts`
  - Request body: `{ imageBase64: string, imageMediaType: 'image/jpeg' | 'image/png' | 'image/webp' }`
  - Calls `claude-sonnet-4-6` with the §2.1 system prompt and §2.2 JSON schema from `docs/AI_PROMPT_MANIFEST.md`.
  - On `is_plant_image: false` → return HTTP 400 with `{ error, error_code: 'INVALID_IMAGE' }`.
  - On successful identification: query `cached_botanical_records` by `scientific_name` (SELECT `perenual_id`).
  - If no cache row found: fire `claude-enrichment` async using Deno `ctx.waitUntil()` — do not await it.
  - Response shape:
    ```ts
    {
      is_plant_image: true;
      species_match: {
        common_name: string;
        scientific_name: string;
        confidence_score: number;
      }
      alternative_candidates: Array<{
        common_name: string;
        scientific_name: string;
        confidence_score: number;
      }>;
      perenual_id: number | null; // from cache lookup; null if enrichment is still pending
    }
    ```
  - Update `docs/AI_PROMPT_MANIFEST.md §2` to document the `perenual_id` field in the response shape.
  - No new secrets required — uses `ANTHROPIC_API_KEY` already present in `_shared`.
  - Verification: `bun run functions:serve`, `Invoke-RestMethod` with a real plant JPEG → confirm JSON shape.

- [x] **Block B — Shared dialog + service** | Agent: `/visualizer`
  - Extract canvas compression into `src/app/shared/utils/image-compression.ts` (reused by journal, Leaf Doctor, and now the identifier — DRY threshold reached).
  - New `PlantIdentifierService` at `src/app/core/services/plant-identifier.service.ts`:
    - `identify(file: File): Promise<PlantIdResult>` — compresses via shared util, strips data-URI prefix, calls `claude-plant-id`.
    - Returns typed `PlantIdResult` (mirrors Edge Function response).
  - New `PlantIdentifierDialogComponent` at `src/app/shared/components/plant-identifier/`:
    - Input: `visible` (model signal).
    - Output: `identified` — emits `{ common_name, scientific_name, perenual_id, confidence_score }`.
    - Three UI states:
      - **Idle**: camera icon + "Choose a photo or take one" file input + drag-drop zone.
      - **Loading**: spinner, disabled controls, `aria-busy`.
      - **Result**: species name, scientific name, confidence badge (< 0.5 warn / 0.5–0.75 low / > 0.75 normal — per §0.1), up to 3 alternative candidates as tappable chips, "Use this species" CTA + "Try another" link.
      - **Error** (`is_plant_image: false`): `<p-message severity="error">` — "The image doesn't appear to show a plant. Try a clear photo of a leaf or stem."
    - "Use this species" emits `identified` and closes; selecting an alternative replaces the primary match before emitting.
    - File input: `accept="image/*"`, compresses to < 300 KB before sending.
    - ARIA: `role="dialog"`, focus trapped, Escape closes.
  - Verification: Manual Browser Check — idle → upload non-plant image → error state; upload plant → result with badge; use alternative → emits correct species.

- [x] **Block C — Dashboard integration** | Agent: `/visualizer`
  - Activate the disabled "Identify a plant" button in `dashboard.html` (remove `disabled` + "Coming soon" tooltip).
  - Wire `(click)` to `openIdentifierDialog()`.
  - Add `<app-plant-identifier-dialog>` to the template; bind `visible` signal.
  - On `identified` output: look up the species in `cached_botanical_records` via `LibraryService` (the existing `searchByScientificName` query) and open `BotanicalDetailDialog` with the result.
  - If no botanical record yet (enrichment pending): show a toast "Species identified — care data is loading. Check the Library in a moment." — do not block the user.
  - Verification: click "Identify a plant" → dialog opens → upload → result shows → "View species profile" opens botanical detail.

- [x] **Block D — Add Plant dialog integration** | Agent: `/visualizer`
  - Camera icon button sits adjacent to the species `<p-autocomplete>` as a flex sibling (affordance proximity — the button fills the field it acts on).
  - Button is hidden in edit mode (`plant() !== null`) and when a species is already locked (`selectedPerenualId() !== null`) — identification only makes sense when adding a new plant with no species selected yet.
  - Clicking opens `PlantIdentifierDialog` (nested, not a separate route).
  - On `identified` output: patch the form via the existing `botanicalPrefill` mechanism — set `common_name`, `scientific_name`, and `selectedPerenualId` exactly as the autocomplete selection does.
  - Confirmation toast: "Species identified — form pre-filled."
  - Verification: open Add Plant, click camera, upload a plant photo, confirm form fields pre-fill correctly.

- [x] **Block E — Library integration** | Agent: `/visualizer`

  **Shared component change — extend `mode` type** (`plant-identifier-dialog.ts` + `.html`):
  - Extend the `mode` input type: `'identify' | 'prefill' | 'browse'`.
  - In the result-state footer (`plant-identifier-dialog.html`):
    - "View profile →" button: change `@if (mode() === 'identify')` → `@if (mode() !== 'prefill')` — shown in both `identify` and `browse`.
    - "Add to my plants" `<p-button>`: wrap in `@if (mode() !== 'browse')` — hidden in `browse`.

  **Mode map** (reference for all entry points):
  | Entry point | `mode` | "View profile →" | "Add to my plants" / "Use this species" |
  |---|---|---|---|
  | Dashboard | `identify` | ✓ | ✓ "Add to my plants" |
  | Library | `browse` | ✓ | ✗ hidden |
  | Add Plant form | `prefill` | ✗ hidden | ✓ "Use this species" |

  **Library-specific changes** (`library.html` + `library.ts`):
  - Move "Identify a plant" button into the `<header>` toolbar as a peer of the "Mix substrate" secondary button — it is a library-level tool, not a search refinement.
  - `<app-plant-identifier-dialog>`: use `mode="browse"`, bind only `(identified)="onLibraryIdentified($event)"` — no `(addToPlants)` binding ("Add to my plants" is not rendered in `browse` mode).
  - `onLibraryIdentified(event: PlantIdentifiedEvent)`: close identifier immediately (`identifierVisible.set(false)`), set `_pendingAutoOpenName` to `event.scientific_name`, set `searchQuery` to `event.common_name`, call `_syncLoadingState()`. The existing auto-open effect handles the rest.

  **Verification:** click "Identify a plant" in the library header → identifier opens → upload a plant photo → result shown → "View profile →" visible, "Add to my plants" absent → click "View profile →" → identifier closes, Library auto-searches, botanical detail panel opens.

- [ ] ~~**Block F — Zone Detail integration** | Agent: `/visualizer`~~ — Dropped

  > _Dropped after UX review: a standalone "Identify & add" button in the zone header is redundant with the camera icon already inside the Add Plant form (Block D). "New plant" → form camera covers this use case. The camera button in the form will be moved closer to the species search input (see Block D refactor)._

- [x] **Block G — Fixed photo aspect ratio** | Agent: `/visualizer`
  - Photo always renders at `w-28 aspect-[4/5]` (112 × 140 px — standard phone portrait) regardless of card content.
  - In `plant-identifier-dialog.html` result section:
    - Remove `items-stretch` from the `flex` container; each side sizes independently.
    - Add `aspect-[4/5] self-start` to the photo `<button>` wrapper (keep `w-28 shrink-0 rounded-garden-sm overflow-hidden`).
    - Image class stays `w-full h-full object-cover`.
  - No TypeScript changes.
  - Verification: Manual Browser Check — identify a plant, confirm the photo thumbnail is always portrait-shaped (taller than wide) regardless of how many text lines the species card has.

- [x] **Block H — Candidate botanical enrichment** | Agent: `/plumber` then `/visualizer`

  **H1 — Edge Function** | `/plumber`
  - In `claude-plant-id/index.ts`, replace the single-row cache lookup (steps 6–7) with a batch approach:
    1. Collect all candidate names: `[species_match, ...alternative_candidates]`.
    2. One `SELECT scientific_name, perenual_id FROM cached_botanical_records WHERE scientific_name IN (...)`.
    3. Build a `Map<string, { perenual_id }>` from the result.
    4. For every candidate **not** in the map, call `EdgeRuntime?.waitUntil(enrichRecord(...))` — one call per missing species.
  - `perenual_id` in the response remains the primary match value (response shape unchanged).
  - Verification: start `bun run functions:serve`, identify a plant with alternatives, open Supabase Studio → `cached_botanical_records` → confirm rows are created for both primary and any missing alternatives within ~5 s.

  **H2 — Client enrichment display** | `/visualizer`
  - Add to `PlantIdentifierService` (`src/app/core/services/plant-identifier.service.ts`):

    ```ts
    import type { Database } from '../../../types/database.types';
    export type BotanicalCacheRow = Database['public']['Tables']['cached_botanical_records']['Row'];

    async fetchCandidateRecords(scientificNames: string[]): Promise<Map<string, BotanicalCacheRow | null>> {
      const { data } = await this.supabase.client
        .from('cached_botanical_records')
        .select('*')
        .in('scientific_name', scientificNames);
      const map = new Map<string, BotanicalCacheRow | null>(scientificNames.map(n => [n, null]));
      data?.forEach(r => map.set(r.scientific_name, r));
      return map;
    }
    ```

  - Add to `PlantIdentifierDialogComponent`:
    - Signal: `readonly candidateRecords = signal<Map<string, BotanicalCacheRow | null>>(new Map())`.
    - Import `BotanicalCacheRow` from `plant-identifier.service`.
    - After `this.identState.set('result')` in `runIdentification()`, fire without await:
      ```ts
      this.identifierService
        .fetchCandidateRecords(allNames)
        .then((map) => this.candidateRecords.set(map));
      ```
      where `allNames` is collected before the async call (avoids reading signals inside `.then`).
    - Clear `candidateRecords` in `resetDialog()`.
  - In `plant-identifier-dialog.html`:
    - **Active match card**: below the confidence badge, `@if` the cached row is available, show the first 80 chars of `description` as a small muted paragraph.
    - **Candidate chips**: below the scientific name, `@if` the cached row is available for that candidate, show a watering badge (`💧 {{ record.watering }}`) and a 14 × 14 px `<img>` thumbnail.
  - Verification: Manual Browser Check — identify a plant twice (second time the cache should be warm from H1 enrichment); on the second attempt, description and watering data should appear in the active card and chips.

- [x] **Block I — Contextual back navigation** | Agent: `/visualizer`

  **Problem:** "View Profile" closes the identifier, then closing `BotanicalDetailDialog` loses the identification result.

  **Solution:** the identifier stays open behind the botanical detail; any dismiss action (✕, Escape, backdrop click) naturally reveals the identifier. A "← Back to Identify a Plant" label in the botanical detail makes the context clear.

  **Changes:**
  1. `plant-identifier-dialog.ts` — `viewProfile()`: remove `this.resetDialog()` and `this.visible.set(false)`. Only emit `identified`. Dialog stays open.
  2. `botanical-detail-dialog.ts` — add `readonly backLabel = input<string | null>(null)`.
  3. `botanical-detail-dialog.html` — when `backLabel()` is non-null, render "← {{ backLabel() }}" as a text button on the left side of the dialog footer; clicking it calls the existing close/visibleChange action. The ✕ button remains.
  4. `dashboard.html` — pass `[backLabel]="'Identify a Plant'"` on the `<app-botanical-detail-dialog>`. No other logic changes needed: when botanical detail closes the identifier is already visible.

  **Follow-up (out of scope for this block):** apply the same `backLabel` pattern when `SubstrateMixWizardDialog` opens from `BotanicalDetailDialog` — pass `backLabel="Plant Profile"`.

  Verification: identify a plant → "View Profile" → botanical detail opens with "← Identify a Plant" in footer → close botanical detail (any method) → identifier result is still shown → "Add to my plants" closes identifier normally.

---

## Verification

```powershell
bun run format
bun run lint
```

Run both after every block before the Manual Browser Check.

**Edge Function smoke test (Block A):**

```powershell
# Start local functions server
bun run functions:serve

# Send a real plant JPEG (replace path as needed)
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('path\to\plant.jpg'))
$body = @{ imageBase64 = $b64; imageMediaType = 'image/jpeg' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:54321/functions/v1/claude-plant-id' `
  -Method POST -ContentType 'application/json' -Body $body
```

Expected: `{ is_plant_image: true, species_match: { ... }, alternative_candidates: [...], perenual_id: null | number }`

**Manual Browser Check — PlantIdentifierDialog (Block B)**

```
App running at: http://localhost:4200/dashboard

1. Open "Identify a plant" → dialog opens in idle state with camera icon
2. Upload a non-plant image (e.g. a landscape) → error state shows p-message "doesn't appear to show a plant"
3. Upload a clear plant photo → loading spinner shows → result appears
4. Confidence badge colour matches the score (amber < 0.5, grey 0.5–0.75, green > 0.75)
5. If alternatives present, click one → primary match updates
6. Click "Use this species" → dialog closes, identified event fires with correct data
7. Press Escape while dialog is open → dialog closes
8. Open DevTools Console → zero red errors
```
