# Phase 3.9 — AI Plant Identifier (Photo-to-Species)

**Objective:** Let users identify any plant by photographing it. A single shared dialog handles the AI call; four entry points each act on the result in the way that fits their context.

**Entry points:**

| Location | Post-identification action |
|---|---|
| Dashboard "Identify a plant" button | Opens `BotanicalDetailDialog` → "Add to greenhouse" |
| Add Plant dialog | Pre-fills `common_name`, `scientific_name`, `perenual_id` |
| Library page | Auto-selects identified species, opens detail panel |
| Zone Detail page | Opens Add Plant with zone + species pre-filled |

**No DB migration needed.** `cached_botanical_records` already exists; enrichment is triggered async via `claude-enrichment`.

---

## Blocks

- [ ] **Block A — `claude-plant-id` Edge Function** | Agent: `/plumber`
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
      species_match: { common_name: string; scientific_name: string; confidence_score: number };
      alternative_candidates: Array<{ common_name: string; scientific_name: string; confidence_score: number }>;
      perenual_id: number | null; // from cache lookup; null if enrichment is still pending
    }
    ```
  - Update `docs/AI_PROMPT_MANIFEST.md §2` to document the `perenual_id` field in the response shape.
  - No new secrets required — uses `ANTHROPIC_API_KEY` already present in `_shared`.
  - Verification: `bun run functions:serve`, `Invoke-RestMethod` with a real plant JPEG → confirm JSON shape.

- [ ] **Block B — Shared dialog + service** | Agent: `/visualizer`
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

- [ ] **Block C — Dashboard integration** | Agent: `/visualizer`
  - Activate the disabled "Identify a plant" button in `dashboard.html` (remove `disabled` + "Coming soon" tooltip).
  - Wire `(click)` to `openIdentifierDialog()`.
  - Add `<app-plant-identifier-dialog>` to the template; bind `visible` signal.
  - On `identified` output: look up the species in `cached_botanical_records` via `LibraryService` (the existing `searchByScientificName` query) and open `BotanicalDetailDialog` with the result.
  - If no botanical record yet (enrichment pending): show a toast "Species identified — care data is loading. Check the Library in a moment." — do not block the user.
  - Verification: click "Identify a plant" → dialog opens → upload → result shows → "View species profile" opens botanical detail.

- [ ] **Block D — Add Plant dialog integration** | Agent: `/visualizer`
  - Add a camera icon button to the header row of `plant-form-dialog.html` (right side of the dialog header, before the close button).
  - Button is hidden in edit mode (`plant() !== null`) — identification only makes sense when adding a new plant.
  - Clicking opens `PlantIdentifierDialog` (nested, not a separate route).
  - On `identified` output: patch the form via the existing `botanicalPrefill` mechanism — set `common_name`, `scientific_name`, and `selectedPerenualId` exactly as the autocomplete selection does.
  - Confirmation toast: "Species identified — form pre-filled."
  - Verification: open Add Plant, click camera, upload a plant photo, confirm form fields pre-fill correctly.

- [ ] **Block E — Library integration** | Agent: `/visualizer`
  - Add an "Identify a plant" secondary button to the Library search area (`library.html`), inline next to or below the search bar.
  - On `identified` output: set `searchQuery` to `species_match.common_name` (triggers existing search pipeline) and — once results load — call `selectedRecord.set(matchedRecord)` to open the botanical detail panel.
  - If no record exists yet (enrichment pending): set the search query and let the existing enrichment-progress indicator do its job.
  - Verification: click "Identify a plant" → dialog opens → upload → result shown → Library auto-searches and opens botanical detail.

- [ ] **Block F — Zone Detail integration** | Agent: `/visualizer`
  - Add a secondary "Identify & add" icon button to the zone detail header, next to the existing "Add plant" button.
  - On `identified` output: close identifier dialog, open `PlantFormDialog` with both `botanicalPrefill` (from result) and `defaultZoneId` (from the current zone) pre-set.
  - Verification: navigate to a zone, click "Identify & add", upload, confirm Add Plant opens with zone and species pre-filled.

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
