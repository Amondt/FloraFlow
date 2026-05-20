# Phase 1.7 — Pre-Upload Client Image Compression

## Context

Task 1.7 delivers the offscreen HTML5 Canvas compression pipeline that intercepts every image before it reaches Supabase Storage, keeping uploads under the 1 GB free-tier ceiling. The journal component is currently a placeholder; this task adds the minimal journal entry creation form needed to exercise the compressor end-to-end. No entry list or timeline — that is future scope.

---

- [x] **Block A — Supabase Storage bucket** | Agent: `/plumber`
  - SQL migration: insert into `storage.buckets` (`plant-journal-images`, `public: false`)
  - RLS INSERT policy: `auth.uid()::text = (storage.foldername(name))[1]`
  - RLS SELECT policy: same condition
  - Push with `bunx supabase db push 2>$null` and confirm bucket visible in Supabase Studio

---

- [x] **Block B — ImageCompressorService** | Agent: `/visualizer`

  **File:** `src/app/core/services/image-compressor.service.ts`
  - Single public method: `compress(file: File, maxBytes = 300_000): Promise<Blob>`
  - Load file via `URL.createObjectURL` → `new Image()`
  - Draw to `document.createElement('canvas')` (never attached to DOM)
  - Export JPEG at quality 0.85 via `canvas.toBlob()`
  - If result > maxBytes: step quality down by 0.10 and retry (floor: 0.10)
  - If still > maxBytes at minimum quality: halve canvas dimensions, restart at 0.85
  - Revoke object URL in `finally`

---

- [x] **Block C — JournalService** | Agent: `/plumber`

  **File:** `src/app/features/journal/journal.service.ts`
  - `uploadImage(userId: string, plantId: string, blob: Blob): Promise<string>`
    - Storage path: `${userId}/${plantId}/${Date.now()}.jpg`
    - `supabase.client.storage.from('plant-journal-images').upload(path, blob, { contentType: 'image/jpeg' })`
    - Returns path on success; throws on error
  - `createEntry(payload: Insert<'plant_journals'>): Promise<Row<'plant_journals'>>`
    - `.from('plant_journals').insert(payload).select().single()`

---

- [x] **Block D — Journal entry form + updated shell** | Agent: `/visualizer`

  **New file:** `src/app/features/journal/journal-entry-form.ts`
  - Standalone dialog component opened via PrimeNG `DynamicDialogRef` (matches `PlantFormComponent` pattern)
  - `plant_id` — `p-select` populated from `PlantService.loadPlants()` (required)
  - `category` — `p-select` bound to `log_category_type` enum values (required)
  - `notes` — `p-textarea` (optional, max 1000 chars)
  - `photo` — native `<input type="file" accept="image/*">` styled with Tailwind (optional)
  - On file change: call `ImageCompressorService.compress()` → show inline badge `"Compressed: X KB"`
  - On submit: `JournalService.uploadImage()` if photo → `JournalService.createEntry()` → close dialog → toast "Entry logged"
  - ARIA: `aria-label`, `aria-describedby`, `aria-invalid` on all fields; focus ring via `FLORA_FOCUS`

  **Modify:** `src/app/features/journal/journal.ts`
  - Replace placeholder with "Log Care Event" button opening `JournalEntryFormComponent` via `DialogService`
  - Empty state with CTA: "Add a plant in the Scheduler first" (shown when no plants exist)

---

- [x] **Block E — ImageCompressor tests** | Agent: `/gatekeeper`

  **File:** `src/app/core/services/image-compressor.service.spec.ts`
  - Mock `HTMLCanvasElement.prototype.toBlob` to control output blob size
  - Test 1: file ≤ 300KB → returns blob without entering quality loop
  - Test 2: large file → quality iteration → result ≤ 300KB
  - Test 3: extreme file → dimension halving kicks in → result ≤ 300KB

---

## Verification

```
Manual Browser Check — Journal Upload (Phase 1.7)
──────────────────────────────────────────────────
App running at: http://localhost:4200/journal

1. Navigate to /journal → confirm "Log Care Event" button visible
2. Click "Log Care Event" → confirm dialog opens
3. Select a plant and category
4. Attach an image > 300KB → confirm badge shows compressed size ≤ 300KB
5. Submit → confirm toast "Entry logged"
6. Supabase Studio → Storage → plant-journal-images → file present
7. Table Editor → plant_journals → row with image_storage_path populated
8. DevTools Console → zero red errors
```

---

## Completion gate (PLANS_GUIDE.md rules)

A block may be checked only when:

1. `bun run lint` passes with zero errors
2. User has confirmed the relevant verification step
3. Changes are committed to git
