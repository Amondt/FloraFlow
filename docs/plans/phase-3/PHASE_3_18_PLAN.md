# Phase 3.18 — Leaf Doctor Diagnostic Honesty

**Goal:** Stop the AI Leaf Doctor from inventing a diagnosis. Two reported failures share one root cause — the response schema makes a `diagnostics` object with a **mandatory** `primary_condition` the only success outcome, so a healthy plant or a wrong-species photo gets a confabulated condition to satisfy the schema. The fix gives the model honest escape hatches (schema + prompt) and renders them.

**No DB migration.** `plant_journals.diagnostics` is `jsonb` — the new fields are additive; existing entries read unchanged.

---

## UX decisions

- **Species mismatch → non-blocking warning.** Still diagnose what is actually in the photo, but show an amber "this looks more like _X_ — double-check the plant" banner above the result. Forgiving and reversible (`DESIGN_SYSTEM §7.4`); the gardener, not the AI, has the final say on which plant it is.
- **Healthy plant → reassuring panel + save.** No invented condition; the same Save-as-Observation path logs a positive checkup (`DESIGN_SYSTEM §7.5` consistency). Deliberately **no** auto-generated "upkeep tips" — that re-creates the produce-content pressure we are removing.

## New `claude-vision` response contract

Three additive fields on the existing shape (all required; nullable where noted). `DiagnosticsSchema` is unchanged.

```ts
is_healthy: boolean; // true ⇒ no problem found; diagnostics = null; never invent a condition
identified_plant: string | null; // what the model actually sees, e.g. "Snake Plant (Sansevieria trifasciata)"
species_matches_context: boolean | null; // null when no plantContext sent; false ⇒ render the mismatch banner
diagnostics: Diagnostics | null; // null when is_healthy === true OR is_botanical_image === false
```

Invariant the prompt must enforce: when `is_botanical_image === true`, `is_healthy === true` ⟺ `diagnostics === null`.

---

## Blocks

- [x] **Block A — claude-vision: honest schema + prompt** | Agent: `/plumber` · Model: Sonnet · Effort: high
  - Extend `LeafDoctorSchema` with `is_healthy` (`z.boolean()`), `identified_plant` (`z.string().nullable()`), `species_matches_context` (`z.boolean().nullable()`). Keep `diagnostics` nullable. Mirror all three into `AI_PROMPT_MANIFEST.md §3.2` (`properties` + `required`).
  - Rewrite the `SYSTEM_PROMPT` guardrails (and `AI_PROMPT_MANIFEST.md §3.1`) to add:
    - **Identify first.** Begin by identifying the plant in the image; populate `identified_plant`.
    - **Healthy is a valid outcome.** If there is no clear sign of disease, pest, deficiency, or distress, set `is_healthy = true` and `diagnostics = null`. Never fabricate a condition to fill the schema.
    - **Evidence-gated diagnosis.** Populate `diagnostics` only when there is visible evidence of a specific problem. When evidence is weak, prefer `is_healthy = true` or a low `confidence_score` over a guessed condition.
    - **Species cross-check.** When the user message names an expected species, compare it to what you see: consistent ⇒ `species_matches_context = true`; clearly a different species ⇒ `species_matches_context = false` and still diagnose what is actually shown. No expected species in the message ⇒ `species_matches_context = null`.
  - Soften the species clause in `buildUserText` so it no longer pressures a diagnosis (e.g. drop "Focus your diagnosis on conditions known to affect this species" → "If it shows problems, weigh conditions known to affect this species"); update the `AI_PROMPT_MANIFEST.md §3.0` text variants to match.
  - Edge Function body: the new fields arrive inside `parsed_output` — return them straight through. Keep the existing `is_botanical_image === false` early-return. No server-side branching needed for healthy (it falls out of `diagnostics === null`).
  - Verification: `bun run format && bun run lint`, then `bun run functions:serve` + `Invoke-RestMethod` three ways — (a) a clearly healthy plant ⇒ `is_healthy: true`, `diagnostics: null`; (b) a photo of a different species + `plantContext` ⇒ `species_matches_context: false`, `identified_plant` set; (c) a genuinely sick plant ⇒ `is_healthy: false`, `diagnostics` populated.

- [x] **Block B — dialog + journal card: healthy & mismatch states** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `journal.service.ts`: extend `LeafDoctorResult` with the three new fields; add optional `is_healthy?: boolean` and `identified_plant?: string | null` to the persisted diagnostics shape so a healthy entry round-trips through `diagnostics` jsonb.
  - `leaf-doctor-dialog.ts`: add `'healthy'` to the `diagnosisState` union; add `speciesMismatchName = signal<string | null>(null)`. In `analyzePlant`, after the not-botanical guard: set `speciesMismatchName` from `species_matches_context === false ? identified_plant : null`; if `is_healthy` → `diagnosisResult.set(null)` + state `'healthy'`, else existing `'success'` path. `canSave` accepts `'success'` **or** `'healthy'`. `saveAsObservation` persists a positive blob (`{ is_healthy: true, identified_plant, confidence_score }`) + a "Healthy — no issues found" note when healthy; existing path otherwise. `resetDialog` clears `speciesMismatchName`.
  - `leaf-doctor-dialog.html`: amber mismatch banner above the result when `speciesMismatchName()` is set (reuse the `severity="warn"` `p-message` + `FloraMessagePT` already used for not-botanical); new healthy panel — reassuring green section, `identified_plant` + check icon + "No issues found", **no** action list; keep the primary button enabled to Save in the healthy state.
  - `journal-entry-card`: guard the diagnostics accordion against a healthy blob (no `primary_condition`) — render a "Healthy checkup" summary instead of condition + action points. Old-shape entries are unaffected (purely additive fields).
  - Update `leaf-doctor-dialog.spec.ts` to cover the healthy branch and the mismatch-banner signal.
  - Verification: `bun run format && bun run lint` + Manual Browser Check.

  Manual Browser Check — Leaf Doctor diagnostic honesty
  ──────────────────────────────────────────────────────
  App running at: http://localhost:4200/journal
  1. Diagnose a clearly healthy plant → green "looks healthy, no issues found" panel; no fabricated condition; Save-as-Observation still available
  2. Click "Save as Observation" on the healthy result → entry saved; journal card shows a "Healthy checkup" summary (no action points, no crash)
  3. From a zone-detail card, open Leaf Doctor (plant locked) and upload a photo of a _different_ species → amber banner names the species actually seen; a diagnosis for the photographed plant still appears below
  4. Diagnose a genuinely sick plant → condition + badges + action points exactly as before (no regression)
  5. Open DevTools Console → zero red errors

## Sequencing

Independent of 3.16 / 3.17 — build immediately after 3.15. The phase number is a label, not a queue position.
