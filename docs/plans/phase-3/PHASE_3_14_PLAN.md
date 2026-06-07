# 3.14 — Multi-Image Leaf Doctor (enhancement to 3.4, up to 3 photos)

---

## What this enhancement is

The Leaf Doctor currently accepts a single image per diagnosis session. This enhancement allows the user to upload up to three photos before running the analysis — sending all of them to Claude as a single multi-image request. More angles (leaf front, stem, root ball) give the model richer visual evidence and improve diagnostic accuracy.

---

## Architecture

**No DB migration.** The `diagnostics JSONB` field already captures the full AI result regardless of how many images were analyzed. Only the first (primary) image is uploaded to `image_storage_path` — the journal entry representation does not change.

**Edge Function contract change.** The request body changes from:

```ts
{ imageBase64: string; imageMediaType: string }
```

to:

```ts
{ images: Array<{ imageBase64: string; imageMediaType: string }> }  // 1–3 items
```

Each item becomes one `image` content block in Claude's `messages[0].content[]` array, followed by a single `text` block. The response schema is unchanged.

**Angular dialog state change.** Three parallel scalar signals become three array signals:

| Old (scalar) | New (array) |
|---|---|
| `compressedBlob: signal<Blob \| null>` | `compressedBlobs: signal<Blob[]>` |
| `previewObjectUrl: signal<string \| null>` | `previewObjectUrls: signal<string[]>` |
| `compressedLabel: signal<string \| null>` | `compressedLabels: signal<string[]>` |

**UX pattern.** One hidden `<input type="file">` (no `multiple`). Users add photos one at a time, each appended to the arrays. An "Add photo" button is shown when `compressedBlobs().length < 3`. Thumbnails are displayed in a row with individual remove buttons. Removing a photo or adding a new one after a successful diagnosis resets `diagnosisState` to `'idle'` (the prior result is stale).

---

## Blocks

- [x] **Block A — Edge Function: multi-image contract** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Change the `claude-vision` request body: replace `imageBase64` + `imageMediaType` scalars with `images: Array<{ imageBase64: string; imageMediaType: string }>` (1–3 items)
  - Validation (HTTP 400): reject if `images` is missing, not an array, empty, has more than 3 items, or any item is missing `imageBase64` or has an invalid media type
  - Build Claude `content[]` array dynamically: one `image` block per item (strip data-URI prefix per item), then one `text` block at the end
  - Response contract unchanged (`LeafDoctorSchema`)
  - Update `docs/AI_PROMPT_MANIFEST.md §3.0` to document the new `images[]` request shape (replacing the old single-field example)
  - Verification: run the Edge Function locally with `bun run functions:serve`; call via `Invoke-RestMethod` with 1, 2, and 3 images — confirm all return a valid diagnostic result; call with 0 or 4 images — confirm HTTP 400

- [ ] **Block B — Dialog: multi-image state, UI and request** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Replace three scalar signals with arrays: `compressedBlobs`, `previewObjectUrls`, `compressedLabels`
  - Add `hasPhotos = computed(() => compressedBlobs().length > 0)`
  - Add `canAddPhoto = computed(() => compressedBlobs().length < 3)`
  - `onFileChange`: append the new compressed blob/URL/label to their arrays; reset `diagnosisState` to `'idle'` and clear `diagnosisResult` (a new photo invalidates any prior result); no-op if `!canAddPhoto()`
  - New `removePhoto(index: number)`: revoke the object URL at that index, splice all three arrays, reset diagnosis state
  - `primaryActionDisabled`: replace `!compressedBlob()` with `!hasPhotos()`
  - `canSave`: replace `!!compressedBlob()` with `hasPhotos()`
  - Extract the inline FileReader logic into a private `_blobToBase64(blob: Blob): Promise<string>` helper (it now runs once per photo, not once total)
  - `analyzePlant`: `Promise.all(compressedBlobs().map((b) => this._blobToBase64(b)))`; send `{ images: base64s.map((imageBase64) => ({ imageBase64, imageMediaType: 'image/jpeg' })) }` to the Edge Function
  - `saveAsObservation`: upload only `compressedBlobs()[0]` to storage as the journal image
  - `resetDialog`: revoke all URLs in `previewObjectUrls()`; set all three arrays to `[]`
  - `ngOnDestroy`: revoke **every** URL in `previewObjectUrls()` (currently revokes only the single scalar URL — must follow the signal becoming an array)
  - Template — replace the single thumbnail row with a multi-thumbnail grid:
    - "Add photo" button shows when `canAddPhoto()`; label shows current count: "Add photo ({{ compressedBlobs().length }}/3)". This native `<button>` (and every remove button) **must** carry `cursor-pointer` — `FLORA_FOCUS` does not include it and the current "Choose photo" button omits it
    - `@for (url of previewObjectUrls(); track url; let i = $index)` — thumbnail + remove button per image (track by the unique object URL, not `$index`, so removal does not re-key trailing thumbnails); remove button calls `removePhoto(i)` with `aria-label="Remove photo {{ i + 1 }}"`
    - Status line below thumbnails: "{{ compressedBlobs().length }} photo{{ compressedBlobs().length > 1 ? 's' : '' }} ready to analyze" when `hasPhotos()` and `diagnosisState() === 'idle'`
  - Verification: Manual Browser Check (see below)

---

## Verification sequence (all blocks)

```powershell
bun run format
bun run lint
```

**Manual Browser Check — Multi-Image Leaf Doctor**
────────────────────────────────────────
App running at: http://localhost:4200/journal

1. Open the Leaf Doctor dialog → "Add photo" button shows "(0/3)" → analyze button is disabled
2. Upload one photo → thumbnail appears with a remove button → "Add photo (1/3)" visible → "1 photo ready to analyze"
3. Remove the photo → thumbnail disappears → analyze button disabled again
4. Upload three photos → three thumbnails appear → "Add photo" button disappears → "3 photos ready to analyze"
5. Click "Analyze" → loading state → success result renders
6. With three photos loaded → the "Add photo" button is gone — no way to add a fourth
7. After diagnosis success, remove one photo → diagnosis result clears → state returns to idle
8. Save as Observation (select a plant first) → toast "Entry logged" → dialog closes
9. Open DevTools Console → zero red errors
