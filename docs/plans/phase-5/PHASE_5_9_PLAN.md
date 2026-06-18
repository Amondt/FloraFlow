# Phase 5.9 — Camera-Aware Photo Capture (3 surfaces)

**Goal:** On a phone, taking a plant photo should open the camera, not a file browser. Today all three photo inputs use a plain `<input type="file" accept="image/*">` (no `capture`), and the plant-identifier even leads with a desktop drag-drop zone.

**Corrects the original plan:** old 5.7 named only `journal-entry-form`. There are **three** photo surfaces, and the most important for "identify a plant" is the one it omitted:
- `src/app/features/journal/journal-entry-form/journal-entry-form.html` (single photo)
- `src/app/shared/components/plant-identifier/plant-identifier-dialog.html` (single photo, **primary identify flow**, reached from dashboard + library + plant form)
- `src/app/features/journal/leaf-doctor-dialog/leaf-doctor-dialog.html` (up to 3 photos)

**No DB migration / no service change** — the output blob is identical regardless of capture path; it feeds the existing canvas compression. `/visualizer` · Sonnet · mid.

---

- [x] **Block A — Shared `photo-capture-input` component** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Three surfaces would otherwise each duplicate the "Take photo / Choose" markup → extract one dumb presentational component `src/app/shared/components/photo-capture-input/photo-capture-input.{ts,html}` (`CODE_RULES.md` DRY).
  - Behaviour:
    - `<md`: two labelled buttons — **Take photo** wrapping `<input type="file" accept="image/*" capture="environment">` (rear camera), and **Choose from library** wrapping `<input type="file" accept="image/*">` (media picker). Raw inputs visually hidden inside `<label>`s.
    - `md+`: the single styled trigger button as today (`max-md:hidden` / `md:flex`).
  - API: an `@Output() fileSelected = output<File>()` (or emit the change event) + inputs for the trigger label / aria-label / `disabled`. The component does **no** compression — it just surfaces the chosen `File`; the host runs its existing pipeline.
  - Confirm `capture="environment"` behaviour/attribute support via context7 (MDN/HTML spec) before finalising.

- [x] **Block B — Wire the three surfaces** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - **journal-entry-form**: replace the single `triggerPhotoInput()` button (the "no photo yet" branch) with `<app-photo-capture-input>`; keep the existing preview / replace / remove / leaf-doctor-locked branches unchanged; route the emitted file into the current `onFileChange` logic.
  - **plant-identifier-dialog**: on `<md`, replace the desktop drag-drop dropzone with `<app-photo-capture-input>` (drag-drop is meaningless on touch). Keep the dropzone on `md+` (`max-md:hidden`). Feed the file into `onFileChange`/`triggerPhotoInput`’s handler.
  - **leaf-doctor-dialog**: the "Add photo" button (shown while `canAddPhoto()`) becomes `<app-photo-capture-input>` so each of the up-to-3 additions can come from the camera; keep the thumbnail row + remove buttons + the 3-photo cap logic intact.

**Verification:**

```powershell
bun run format
bun run lint
```

```
Manual Browser Check — Camera capture (all 3 surfaces)
───────────────────────────────────────────────────────
App: http://localhost:4200  ·  DevTools device toolbar → mobile (Touch)
(A real phone is ideal for the actual camera; emulation shows the two-button UI + picker.)

1. Journal → New entry → Photo: on mobile width you see TWO controls — "Take photo"
   and "Choose from library". "Take photo" requests the camera (real device) / "Choose"
   opens the picker. Selected image shows the compressed preview + size label.
2. Library (or Dashboard) → Identify a plant: on mobile the drag-drop zone is replaced
   by the same two buttons; picking a photo runs identification as before.
3. Journal → Diagnose a plant (Leaf Doctor): "Add photo" offers Take/Choose; add up to
   3, remove one, add again — the cap + thumbnails behave as before.
4. Each path produces a working compressed image (analysis/upload succeeds).
5. Resize ≥768 px → all three revert to their original desktop controls (single trigger
   for journal; drag-drop zone for identifier; single Add for leaf doctor).
6. Console → zero red errors.
```
