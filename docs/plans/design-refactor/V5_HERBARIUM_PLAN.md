# Design Refactor — V5 "Herbarium"

Restyle FloraFlow toward the **V5 "Herbarium"** design — editorial / archival: aged-paper light mode, deep-archive dark mode, serif (Newsreader) display headings + italic scientific names, mono catalog labels, fine hairline rules — **without changing any layout, component structure, route, or feature**. We style on top of what already exists.

**Source of truth for the look:** `FloraFlow v5.html`, `app-v5.jsx`, `herbarium.jsx`, `styles-v5.css` (a Claude design draft). Supersedes V4 "Bento Garden" (§6) as the active visual language.

**Locked decisions (user, 2026-06-20):**

- **Depth — tokens + PT + class-only typography.** The user chose the _faithful_ identity: cosmetic `font-serif` / `font-mono` class swaps on existing headings, plant/scientific names, and eyebrow labels are in scope. No layout, structure, route, or feature change — only token values, PT class strings, and font utility classes move.
- **Dark mode — keep the existing mechanism.** The app toggles dark via a `.dark` class on `<html>` (`flora-theme` in localStorage) wired through `@variant dark`. We remap token _values_ per mode; we do **not** adopt the demo's `[data-theme]` attribute. Both modes are fully specified in the V5 files.
- **Restyle existing components — do not clone the demo dashboard.** The demo's bespoke specimen-plate, status ledger, and forecast strip are _mood reference only_. FloraFlow's existing components keep their current structure and are restyled to feel Herbarium.
- **Palette barely moves.** V5's forest `--accent #2f5f43` / `--cta-bg #243d2c` are already our `primary-600` / `primary-800`. The real deltas: warm-paper neutrals, a hotter coral, serif/mono typography, tighter radii, fine rules.

---

## Why this is safe — the token cascade

Almost every color / radius / shadow / font is a Tailwind utility bound to a `@theme` token in `src/styles.input.css`. Changing a token **value** re-skins every consumer with **zero template edits**. V5 adds one presentational layer beyond V4 — class-only font swaps — which the user has explicitly authorized.

| Layer                  | Mechanism                                                                     | Touches templates?                                       |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1 · Tokens             | `@theme` value swaps in `styles.input.css`                                    | ❌ cascades app-wide                                     |
| 2 · PT objects         | tune `src/app/shared/ui/pt/*.ts`                                              | ❌ presentational config only                            |
| 3 · Typography classes | swap `font-display` → `font-serif` / `font-mono` on headings, names, eyebrows | ⚠️ class-only — **no** structure/layout change (Block B) |

> ⚠️ **Never edit `src/styles.css`** — it is compiled output (overwritten on every Tailwind CLI run). All token edits go in **`src/styles.input.css`**, then `bun run tw:watch` / build.

---

## Proposed token mapping (Block A)

Values are the target; Block A finalizes them and Block F (Gatekeeper) verifies contrast. The mapping keeps the ramp's **light → dark structure** so dark mode keeps working — the low end paints light paper surfaces, the high end paints dark archive surfaces, the mids carry text in both modes via `dark:` variants.

### Primary — already forest, barely moves

V5's accent/CTA equal our current `primary-600` / `primary-800`. The dark-mode accents also align (`--accent #84cd8f`, `--cta-bg #74c482` ≈ our bright `primary-300/400`). **No change expected** beyond optional ±1-step nudges Block A may make for harmony. Do **not** darken `primary-300/400` — they ride on the dark archive background.

### Neutrals → aged paper / deep archive

Same light → dark structure; hue shifted to the Herbarium paper tone. Two known ramp tensions Block A must resolve holistically (flagged ⚠️).

| Token       | Today   | V5 target | Main role                                                                                                             |
| ----------- | ------- | --------- | --------------------------------------------------------------------------------------------------------------------- |
| neutral-50  | #f3efe4 | #ece6d6   | light page "paper desk" (V5 `--bg`)                                                                                   |
| neutral-100 | #ede8d8 | #e3dccb   | ⚠️ sunken/input/hover — must stay a step **darker** than 50                                                           |
| neutral-200 | #d4d9c8 | #d6cdba   | hairline rule (V5 `--rule` family)                                                                                    |
| neutral-300 | #b3baa6 | #b3aa92   | strong border                                                                                                         |
| neutral-400 | #828c79 | #8a8f79   | hints / decorative (V5 `--faint`)                                                                                     |
| neutral-500 | #59644f | #6a7360   | ⚠️ secondary text — must hold ≥ 4.5:1 on `#ece6d6` paper (V5 `--muted`; darken slightly if it fails on the desk tone) |
| neutral-600 | #46523c | #515a48   | —                                                                                                                     |
| neutral-700 | #2d3a2b | #353f30   | ⚠️ body text (light) **and** raised surface (dark) — single value, body-text contrast wins                            |
| neutral-800 | #222e22 | #181d12   | dark card surface (V5 dark `--surface`)                                                                               |
| neutral-900 | #101a0f | #10140d   | darkest text / dark page (V5 dark `--bg`)                                                                             |

> **Surface relationship:** cards stay `bg-white dark:bg-neutral-800` (the bright "sheet"); the page `<main>` stays `bg-neutral-50 dark:bg-neutral-900` (the "desk"). Retuning neutral-50 to `#ece6d6` gives the sheet-on-desk separation in light mode with **zero** template edits; dark mode maps 1:1 (`#10140d` desk, `#181d12` sheet). The card's warm-paper tint vs pure white is a deliberate, accepted micro-tradeoff (we do not redefine `--color-white`).

### Coral pop — hotter

| Token     | Today   | V5 target | Source           |
| --------- | ------- | --------- | ---------------- |
| coral-400 | #ed9c7c | #e88a5f   | V5 dark `--pop`  |
| coral-500 | #e08760 | #cf6a40   | V5 light `--pop` |
| coral-600 | #c97350 | #b85733   | hover            |

Decorative "pop" only (overdue/frost flourishes). True destructive stays `danger-*`; true warnings stay `warning-*`. Reference the token from PT — never the hex.

### Radii — tighter, more editorial

| Token            | Today           | V5 target              |
| ---------------- | --------------- | ---------------------- |
| radius-garden-sm | 0.625rem (10px) | 0.625rem (10px) — keep |
| radius-garden-md | 1.125rem (18px) | 1rem (16px)            |
| radius-garden-lg | 1.75rem (28px)  | 1.375rem (22px)        |

### Shadows — softer, larger spread

- `--shadow-sm`: `0 1px 2px rgba(27,36,24,0.05), 0 10px 30px rgba(27,36,24,0.05)` (V5 `--shadow-card`)
- `--shadow-md`: `0 14px 44px rgba(27,36,24,0.13)` (V5 `--shadow-pop`)

### Type — add the serif

- Add `--font-serif: 'Newsreader', Georgia, 'Times New Roman', serif;` → Tailwind v4 auto-generates the `font-serif` utility used in Block B.
- `--font-display` stays Inter (body/UI); `--font-mono` stays JetBrains Mono (labels).
- `src/index.html`: add `Newsreader` (ital + weights 400/500) to the existing Google Fonts `<link>` chain — additive `<head>` change, alongside Inter + JetBrains Mono.

### Canvas

- Light `html:not(.dark) body`: shift to the warm paper tone + **fine dot grain** — `radial-gradient(rgba(28,36,24,0.022) 1px, transparent 1px)` at `background-size: 4px 4px` (V5 `--bg-grain`). Replaces the V4 coral/sage radial washes. Global CSS rule — no template edit.
- Dark `:where(.dark, .dark *) body`: same dot grain at the dark opacity (`rgba(236,233,216,0.018)`) so the archive canvas also carries the texture. Archive bg for each `<main>` stays `dark:bg-neutral-900` (unchanged).

---

## Typographic identity (Block B) — the faithful layer

Class-only swaps; **no element is added, removed, or restructured.** The rule:

- **`font-serif`** replaces `font-display` on: page `<h1>` titles, section / card titles, plant & zone **names** in cards and detail headers, **scientific names** (already italic), and large stat numerals (counts, hero figures).
- **`font-mono`** replaces `font-display` on: eyebrow labels (the `text-xs uppercase tracking-widest` lines, `DESIGN_SYSTEM.md §6.7`), unit micro-labels, and catalog-style IDs.
- Body copy, form labels, buttons, chips, nav — **stay `font-display`** (Inter).

Surfaces in scope: every feature page header (dashboard/tasks, zones, zone-detail, library, seeds, journal, plant-detail, settings, auth), the shared card components, feed/list rows, and dialog titles. Visualizer enumerates exact locations by grepping for `font-display` on heading/eyebrow elements.

---

## Blocks

### `[x]` Block A — Herbarium token foundation | Agent: `/visualizer` · Model: Opus · Effort: mid

_The one judgment-heavy block (Opus spent here only): a coherent paper/archive palette that works in **both** modes while preserving WCAG AA, resolving the two ⚠️ ramp tensions above._

- `src/styles.input.css` `@theme`: apply the neutral (paper), coral, radii, shadow mappings; add `--font-serif`.
- `src/index.html`: add Newsreader to the Google Fonts `<link>`.
- Light-mode canvas: warm paper tone + **fine dot grain** (`radial-gradient(rgba(28,36,24,0.022) 1px, transparent 1px)` at `4px 4px`), scoped to `html:not(.dark) body` — replaces V4 washes. Dark canvas: same grain at dark opacity via `:where(.dark, .dark *) body`.
- Keep dark-mode accents bright (do not darken `primary-300/400`).
- One block: the palette only reads as correct holistically — splitting neutrals from canvas would leave a half-warmed app.

### `[x]` Block B — Serif / mono typographic sweep | Agent: `/visualizer` · Model: Sonnet · Effort: mid

- Apply the `font-serif` / `font-mono` rule above across all in-scope surfaces. Depends on Block A (needs the `--font-serif` token / generated utility).
- **Class-only:** swap font utility classes on existing elements. No structural, layout, route, or feature change. Keep all `dark:` text-color variants intact.
- Verify each heading still reads AA in both modes (serif weight/size unchanged — only family swaps).

### `[x]` Block C — High-visibility PT polish | Agent: `/visualizer` · Model: Sonnet · Effort: mid

- `card.pt.ts`: paper surface + the Herbarium hairline rule (firm up the existing `border-neutral-200/60`) + softer shadow + tighter radius (inherits Block A).
- `button.pt.ts`: keep the forest CTA pill; ghost = hairline border (`rule-strong`). Keep `FLORA_FOCUS` / `FLORA_DISABLED`.
- `badge.pt.ts` (`FloraTagPT` / `FloraChipPT`): sage = ok/info, amber = warn, coral = overdue/pop; subtle surface + hairline (V5 chip). Severity branching via `{ instance }` (canonical `badge.pt.ts`).
- `toast.pt.ts`, `message.pt.ts`: warm paper surfaces; keep severity branching.
- **Constraint:** only PT class strings change. No new PT objects outside `shared/ui/pt/`; all interactive slots keep the state constants.

### `[x]` Block D — Remaining PT sweep | Agent: `/visualizer` · Model: Sonnet · Effort: low

- Low-touch long tail — most inherit Block A automatically; 0–2 line tweaks where a literal radius/shadow/color was set: `input`, `select`, `checkbox`, `datepicker`, `slider`, `fileupload`, `dialog`, `panel`, `tabs`, `menu`, `popover`, `progress`, `skeleton`, `autocomplete`.
- Verify each still composes the state constants and respects the v21 `{ instance }` / `{ context }` PT signatures.

### `[x]` Block E — Sync `DESIGN_SYSTEM.md` | Agent: `/mind` · Model: Sonnet · Effort: low

- Update §1 token table to final Block A values; add the `--font-serif` / Newsreader note and a short **Typography** note (serif = display headings + scientific names; sans = body/UI; mono = eyebrow/catalog labels).
- Recompute the §4 contrast ratios for the new paper neutrals (deterministic here; **verified independently in Block F**).
- Keep it lean. Depends on Block A (+ B for the typography note).

### `[x]` Block F — QA gate | Agent: `/gatekeeper` · Model: Sonnet · Effort: mid

- WCAG AA contrast re-verification in **both** themes — esp. serif headings, warm `neutral-500` secondary text on `#ece6d6` paper (≥ 4.5:1), and dark-mode `primary-400` on `neutral-900` archive (≈ 7–9:1).
- Zero-overflow / no-structure-change visual regression across **every** route, light + dark (user runs the manual browser checklist).
- `bun run check`. Gatekeeper **diagnoses and routes** failures (→ `/visualizer` for token/PT/typography, `/mind` for docs) — it does not fix.

---

## Deliberately deferred (would require real structure/layout edits)

Out of scope for the locked depth; offer as opt-in follow-ups:

- The demo's bespoke **specimen-plate / status-ledger / forecast-strip** dashboard layout — a structural rebuild, not a restyle.
- Decorative **corner ticks, plate labels, catalog-number stamps** that have no existing element to attach to.
- The demo's **top-bar search box / `⌘K` / "Herbarium · v5" sub-brand** — chrome that isn't part of the app shell.

---

## Sequencing & Definition of Done

- **Order:** A → (B, C, D) → E → F. A is the dependency for everything; B also depends on A (serif utility); E depends on A (+ B).
- Each block follows `docs/DEFINITION_OF_DONE.md`: format + lint, **user confirms** the manual browser check, commit — only then the implementing agent marks the block `[x]`. Never mark `[x]` on lint alone.
- This plan file is ephemeral (`docs/plans/`); archive once the refactor is complete.
