# Design Refactor — V4 "Bento Garden"

Restyle FloraFlow toward the **V4 "Bento Garden"** design draft — warm, friendly, pastel/earthy — **without changing any layout, component structure, route, or feature**. We style on top of what already exists.

**Source of truth for the look:** `FloraFlow v4.html`, `bento.jsx`, `styles-v4.css` (a Claude design draft). This supersedes the earlier design-draft URL formerly referenced in `PHASES_PLAN.md`.

**Locked decisions (user, 2026-06-19):**

- **Depth — tokens + PT polish only.** No template/layout edits.
- **Dark mode — kept working.** Light mode is the restyle target; the warm neutral ramp serves both modes. No new dark palette is invented (the source design has none).
- **Primary — forest green `#243d2c`** CTAs + **coral `#e08760`** secondary pop (not the current emerald).

---

## Why this is safe — the token cascade

Almost every color / radius / shadow / font in the app is a Tailwind utility bound to a `@theme` token in `src/styles.input.css`. Changing a token **value** re-skins every consumer with **zero template edits**. Three layers exist; only the first two are in scope:

| Layer | Mechanism | Touches templates? |
| --- | --- | --- |
| 1 · Tokens | `@theme` value swaps in `styles.input.css` | ❌ cascades app-wide |
| 2 · PT objects | tune `src/app/shared/ui/pt/*.ts` | ❌ presentational config only |
| 3 · Pastel bento tiles | per-card color classes in templates | ✅ **out of scope** |

> ⚠️ **Never edit `src/styles.css`** — it is compiled output (overwritten on every Tailwind CLI run). All token edits go in **`src/styles.input.css`**, then `bun run tw:watch` / build.

---

## Proposed token mapping (Block A)

Values are the target; Block A finalizes them and Block E (Gatekeeper) verifies contrast. The mapping deliberately keeps the ramp's **light → dark structure** so dark mode keeps working — only the hue warms.

### Primary → forest green

Dark end (600–900) = light-mode CTAs & text. Light end (300/400) stays bright so **dark-mode** accents remain legible on the warm-black background.

| Token | Today (emerald) | V4 (forest) | Main role |
| --- | --- | --- | --- |
| primary-50 | #f0fdf4 | #eef4ee | palest tint |
| primary-100 | #dcfce7 | #d8e8d0 | sage tint (v4 tile-sage) |
| primary-200 | #bbf7d0 | #bcd6b0 | tint border |
| primary-300 | #6ee7b7 | #9ed4a4 | dark-mode hover accent |
| primary-400 | #34d399 | #74c482 | dark-mode primary accent |
| primary-500 | #10b981 | #3d7a4f | mid fills (meters, selected) |
| primary-600 | #059669 | #2f5f43 | outlined text / hover |
| primary-700 | #047857 | #294f3a | active |
| primary-800 | #065f46 | #243d2c | **solid CTA pill** (v4 accent-bg) |
| primary-900 | #064e3b | #1a2c1f | CTA hover / dark tint bg |

### Coral pop — NEW tokens

Secondary accent for decorative "pop" (e.g. urgency/frost flourishes). Add as tokens so PT references a class — **never hardcode the hex in a PT file**. True destructive stays `danger-*` (red); true warnings stay `warning-*` (amber).

| Token | Value | Source |
| --- | --- | --- |
| coral-400 | #ed9c7c | v4 tile-coral |
| coral-500 | #e08760 | v4 accent-pop |
| coral-600 | #c97350 | v4 hover |

### Neutrals → warm green-gray

Same light → dark structure; hue warmed. Serves **both** cream light surfaces and dark-mode backgrounds.

| Token | Today (cool slate) | V4 (warm) | Main role |
| --- | --- | --- | --- |
| neutral-50 | #f8fafc | #f3efe4 | light page bg (v4 bg-app cream) |
| neutral-100 | #f1f5f9 | #ede8d8 | light surface / card |
| neutral-200 | #e2e8f0 | #d4d9c8 | borders (v4 ink-200) |
| neutral-300 | #cbd5e1 | #b3baa6 | strong border (v4 ink-300) |
| neutral-400 | #94a3b8 | #828c79 | hints / decorative (v4 ink-400) |
| neutral-500 | #64748b | #59644f | secondary text (v4 ink-500) |
| neutral-600 | #475569 | #46523c | — |
| neutral-700 | #334155 | #2d3a2b | body text (v4 ink-700) |
| neutral-800 | #1e293b | #222e22 | dark-mode surface |
| neutral-900 | #0f172a | #1a2418 | darkest text / dark page bg (v4 ink-900) |

### Radii — rounder (sanity-checked for 38 px controls)

| Token | Today | V4 target |
| --- | --- | --- |
| radius-garden-sm | 0.375rem (6px) | 0.625rem (10px) |
| radius-garden-md | 0.75rem (12px) | 1.125rem (18px) |
| radius-garden-lg | 1.25rem (20px) | 1.75rem (28px) |

### Shadows — soft & warm-tinted

Override Tailwind's `--shadow-sm` / `--shadow-md` (every `shadow-sm`/`shadow-md` consumer softens with no edits):

- `--shadow-sm`: `0 1px 3px rgba(28,36,24,0.06), 0 2px 0 rgba(28,36,24,0.04)` (v4 shadow-tile)
- `--shadow-md`: `0 8px 24px rgba(28,36,24,0.10)` (v4 shadow-hover, softened)

### Type

- Keep `--font-display: 'Inter'` — but **load it for real** (see Block A; currently no font link).
- Add `--font-mono: 'JetBrains Mono', ui-monospace, …` — existing `font-mono` consumers upgrade automatically.

---

## Blocks

### `[ ]` Block A — Warm token foundation | Agent: `/visualizer` · Model: Opus · Effort: mid

*The one judgment-heavy block (Opus spent here only): a coherent warm palette that works in **both** modes while preserving WCAG AA.*

- `src/styles.input.css` `@theme`: apply the primary, coral (new), neutral, radii, shadow, and `--font-mono` mappings above.
- `src/index.html`: add Inter + JetBrains Mono loading (Google Fonts `<link>` or `@font-face`). **Currently `index.html` has no font link — the app falls back to `system-ui`; this also fixes that latent gap.** Additive `<head>` change only — not a component/layout edit.
- Light-mode body background: warm cream + soft pastel radial gradients (global rule in `styles.input.css`, scoped to light mode). Dark-mode background unchanged.
- Keep dark-mode accents bright: do **not** darken primary-300/400 — they ride on the warm-black background.
- **Architecture note:** this is the cascade layer — one file (plus the font `<link>`). Splitting palette from neutrals would leave a half-warmed app that only reads as correct holistically, so it stays one block.

### `[ ]` Block B — High-visibility PT polish | Agent: `/visualizer` · Model: Sonnet · Effort: mid

- `button.pt.ts`: solid primary CTA → **forest pill** (`rounded-full`, `bg-primary-800` + hover `primary-900`), white label (≈14:1 contrast). Keep `FLORA_FOCUS` / `FLORA_DISABLED` composition — no hardcoded rings.
- `badge.pt.ts` (`FloraTagPT` / `FloraChipPT`): pastel mapping — sage = ok/info, peach = warn, coral = overdue/pop; soft border.
- `card.pt.ts`: paper surface + softer (new) shadow + rounder radius (inherits Block A).
- `toast.pt.ts`, `message.pt.ts`: warm surfaces; keep severity branching via `{ instance }` (see `badge.pt.ts` canonical reference).
- **Constraint:** only PT class strings change. No new ad-hoc PT objects outside `shared/ui/pt/`; all interactive slots keep `FLORA_FOCUS` + `FLORA_DISABLED`.

### `[ ]` Block C — Remaining PT sweep | Agent: `/visualizer` · Model: Sonnet · Effort: low

- Low-touch long tail — most inherit Block A automatically; apply 0–2 line tweaks where a literal radius/shadow/color was set: `input`, `select`, `checkbox`, `datepicker`, `slider`, `fileupload`, `dialog`, `panel`, `tabs`, `menu`, `popover`, `progress`, `skeleton`, `autocomplete`.
- Verify each still composes the state constants and respects the v21 `{ instance }` / `{ context }` PT signatures.

### `[ ]` Block D — Sync `DESIGN_SYSTEM.md` | Agent: `/mind` · Model: Sonnet · Effort: low

- Update §1 token table to the final Block A values; add the coral accent + JetBrains Mono note.
- Recompute the §4 contrast ratios for the new palette (deterministic — done here; **verified independently in Block E**).
- Keep it lean per project doc rules. Depends only on Block A.

### `[ ]` Block E — QA gate | Agent: `/gatekeeper` · Model: Sonnet · Effort: mid

- WCAG AA contrast re-verification across the new palette in **both** themes — esp. forest CTA labels, warm `neutral-500` text on cream (target ≥ 4.5:1), and dark-mode `primary-400` on `neutral-900` (target ≈ 7–9:1).
- Zero-overflow / no-structure-change visual regression across **every route**, light + dark (user runs the manual browser checklist).
- `bun run check`. Gatekeeper **diagnoses and routes** failures (→ `/visualizer` for token/PT, `/mind` for docs) — it does not fix.

---

## Deliberately deferred (would require template edits)

Out of scope for the locked "tokens + PT" depth; offer as an opt-in follow-up:

- Pastel **multi-color bento tiles** assigned per card type (zone cards, stat blocks) — needs per-card color classes in templates.
- **JetBrains-Mono eyebrow labels** (uppercase tracking-widest labels) — needs `font-mono` added to template eyebrows.
- A few **status badges are inline in templates** (e.g. zone-card header, system badges) using Tailwind built-in `green/yellow`, not tokens — they will keep their current hue (still legible on cream) rather than become sage/peach.

---

## Sequencing & Definition of Done

- **Order:** A → (B, C) → D → E. A is the dependency for everything; D depends only on A.
- Each block follows `docs/DEFINITION_OF_DONE.md`: format + lint, **user confirms** the manual browser check, commit — only then the implementing agent marks the block `[x]`. Never mark `[x]` on lint alone.
- This plan file is ephemeral (`docs/plans/`); it may be archived once the refactor is complete.
