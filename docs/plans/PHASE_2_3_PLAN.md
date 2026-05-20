# Phase 2.3 — Soil Check Depth Fix

**Scope:** Client-side display fix only. No DB migration, no new files, no new route.
**Agent:** `/visualizer`
**Files touched:**
- `src/app/features/scheduler/soil-check-dialog/soil-check-dialog.ts`
- `src/app/features/scheduler/soil-check-dialog/soil-check-dialog.html`

---

## Context

`checkDepth` in `soil-check-dialog.ts:31` is hardcoded to two wrong values: `'8 cm'` for Desert Succulent, `'5 cm'` for everything else. It must be replaced with a substrate-keyed map using research-backed depths and qualitative watering guidance per substrate type.

Research sources: UConn CAHNR Extension, UMN Extension, Missouri Botanical Garden.

---

## Substrate depth + description map

| `substrate_factor` | `depth` | `description` |
|---|---|---|
| `'High-Drainage Aroid'` | `'3 cm'` | `'Allow top 3 cm to dry — check 3 cm deep'` |
| `'Standard Potting'` | `'3 cm'` | `'Allow top 3 cm to dry — check 3 cm deep'` |
| `'Heavy Peat'` | `'3 cm'` | `'Allow top 3 cm to dry — check 3 cm deep'` |
| `'Sphagnum Moss Mix'` | `'2 cm'` | `'Keep mostly moist — check 2 cm deep'` |
| `'Desert Succulent'` | `'5 cm'` | `'Let soil dry completely — check 5 cm deep'` |

---

## Blocks

- [x] **Block A — Substrate map + computed signals + template update** | Agent: `/visualizer`
  - Replace the `checkDepth` computed in `soil-check-dialog.ts` with a module-level `SUBSTRATE_DEPTH_RULES` constant typed as `Record<SubstrateFactor, { depth: string; description: string }>`.
  - Replace the single `checkDepth` computed with two: `checkDepth()` returning the depth string, `checkDepthDescription()` returning the description string — both derived from `SUBSTRATE_DEPTH_RULES[this.plant().substrate_factor]`.
  - Update the `step === 'ask'` instruction block in `soil-check-dialog.html` to render the description on its own line above the existing depth-and-question line.
  - Run `bun run lint` — zero errors before marking done.
  - Manual Browser Check: open a soil-check dialog for a Desert Succulent plant, confirm "Let soil dry completely — check 5 cm deep" appears; repeat for a Standard Potting plant, confirm "Allow top 3 cm to dry — check 3 cm deep".
