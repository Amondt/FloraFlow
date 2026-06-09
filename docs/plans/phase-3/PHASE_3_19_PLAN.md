# Phase 3.19 — Leaf Doctor Symptom Description

**Goal:** Let the gardener optionally describe what they're seeing — symptoms, recent changes, what happened — in the **Diagnose a Plant** dialog, so the AI Leaf Doctor has context beyond the photos. Better input → sharper diagnosis. When provided, the description is woven into the Claude prompt and preserved in the saved Observation note.

**No DB migration.** Frontend + Edge Function only. The description is ephemeral to the AI call (like the extra images in 3.14); when the diagnosis is saved, it is prepended to the Observation note — `plant_journals.notes` already holds free text, so no new column is needed.

**One component, both surfaces.** `leaf-doctor-dialog` is shared by the Journal and Zone-detail flows, so the field appears in both automatically.

**Relationship to roadmap.** Independent of in-progress 3.16 (iNat migration) and of 3.18 (Diagnostic Honesty). Both 3.18 and 3.19 touch `buildUserText()` and the dialog layout — whichever lands second rebases the `buildUserText` signature and re-places its block. Buildable now.

---

## Blocks

- [x] **Block A — claude-vision: optional symptom description** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - Request body gains `userDescription?: string` (optional — existing callers unaffected, no breaking change).
  - Add `extractUserDescription(raw: unknown): string | undefined` helper (mirrors `extractPlantContext`): return `undefined` unless `raw` is a non-empty string; `trim()`; cap at 1000 chars via `slice(0, 1000)`; empty-after-trim → `undefined`.
  - Extend `buildUserText(imageCount, plantContext?, userDescription?)` with a **third composable dimension**: when `userDescription` is present, append a clearly delimited sentence after the existing text, e.g.
    `` ` The gardener also describes what they are seeing: "${userDescription}". Weigh this against the visual evidence — do not assume it is correct if the photos contradict it.` ``
    Must compose with both existing dimensions (image-count, species) — append, never overwrite.
  - Wire it through `Deno.serve`: `const userDescription = extractUserDescription(body.userDescription);` then pass to `buildUserText(images.length, plantContext, userDescription)`. Update the body cast type to include `userDescription?: unknown`.
  - **Safety:** the free text is bounded (1000 chars) and quoted, and the response shape is still enforced by `zodOutputFormat(LeafDoctorSchema)` — a stray instruction in the text cannot change the output schema. Keep the existing system-prompt guardrails unchanged.
  - Update `docs/AI_PROMPT_MANIFEST.md §3.0`: add `userDescription?: string` to the request interface (note the 1000-char cap), document the third dimension, and add one composed example string.
  - Verification: `bun run format` → `bun run lint` → `bun run functions:serve` + `Invoke-RestMethod` with and without `userDescription` (confirm 200 + diagnosis both ways; an over-long string is accepted and truncated, not rejected).

- [ ] **Block B — LeafDoctorDialogComponent: symptom textarea + persisted note** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - Add `readonly symptomNotes = signal<string>('')`.
  - Import `TextareaModule` (`primeng/textarea`) into `imports`; import `FloraTextareaPT` from `../../../shared/ui/pt/index`.
  - **Template** — insert a new section **between** the Plant selector block and the Photo+analysis block (all user inputs grouped above the inline AI status/result):
    - `<label [for]="…">` reading `Describe what you're seeing` + a muted `(optional)` suffix (mirror the journal-notes label anatomy: `<span class="text-neutral-400 font-normal text-xs ml-1">(optional)</span>`).
    - `<textarea pTextarea [pt]="FloraTextareaPT" rows="3" maxlength="1000" [ngModel]="symptomNotes()" (ngModelChange)="symptomNotes.set($event)" placeholder="e.g. Lower leaves yellowing and dropping since I moved it near the AC vent two weeks ago" [id]="…" [attr.aria-describedby]="…counterId">`.
    - Char counter `{{ symptomNotes().length }}/1000` (mirror `journal-entry-form`), with the counter element carrying `…counterId`.
    - Helper `<small role="note">`: "Optional — symptoms, recent changes, anything the photos don't show. Helps the diagnosis." (info-circle icon, same anatomy as the existing same-plant hint).
  - `analyzePlant()`: include `userDescription` in the invoke body **only when non-empty** — `const notes = this.symptomNotes().trim();` then `...(notes ? { userDescription: notes } : {})`, composing with the existing `...(plantContext ? { plantContext } : {})` spread.
  - `saveAsObservation()`: prepend the description to the saved note when present:
    ```ts
    const observation = this.symptomNotes().trim();
    const aiSummary = `Leaf Doctor: ${result.primary_condition}\n${result.immediate_remedial_actions.join('\n')}`;
    const notes = observation ? `${observation}\n\n${aiSummary}` : aiSummary;
    ```
  - `resetDialog()`: add `this.symptomNotes.set('')`. **Do not** clear it in `onFileChange` / `removePhoto` — the description is the user's observation, independent of which photos are loaded (those handlers reset only diagnosis state).
  - Spec (`leaf-doctor-dialog.spec.ts`): add (1) `resetDialog` clears `symptomNotes`; (2) `saveAsObservation` calls `createEntry` with `notes` that **start with** the typed description when set, and with the AI-only note when blank (set success state + plant + one blob + mock `getUser`).
  - Verification: `bun run format` → `bun run lint` → `bun run test` (spec) → Manual Browser Check.

  Manual Browser Check — Leaf Doctor symptom description
  ────────────────────────────────────────────────────
  App running at: http://localhost:4200/journal

  1. Open Leaf Doctor → a "Describe what you're seeing (optional)" textarea sits below the plant selector → counter reads 0/1000
  2. Type a description → counter updates live; cannot exceed 1000 chars
  3. Select plant + photo, **leave description blank**, Analyze → diagnosis returns (DevTools Network: request body has **no** `userDescription` key)
  4. Add a description, Analyze again → request body now carries `userDescription`
  5. Save as Observation → open the saved entry in Journal → note shows your description on top, "Leaf Doctor: …" below
  6. Save a diagnosis with a blank description → note shows only the "Leaf Doctor: …" summary (unchanged from before)
  7. Reopen the dialog → textarea is empty (reset); type text then add/remove a photo → text stays put
  8. Open from a zone-detail plant card → same textarea present below the locked plant-name badge
  9. Open DevTools Console → zero red errors
