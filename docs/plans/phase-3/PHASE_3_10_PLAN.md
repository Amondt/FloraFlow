# Phase 3.10 Plan — Extended Plant Profile

Depends on: Phase 3.1 (AI Scribe must be deployed before Block B).

---

## Field Catalogue & UX Rationale

16 new columns on `cached_botanical_records`. All filled by the AI Scribe (Block B).

| Field | DB type | UX value |
|---|---|---|
| `description` | `TEXT` | First thing a user reads — one or two sentences that make the plant feel alive, not just a data row. |
| `placement` | `TEXT ('Indoor'/'Outdoor'/'Both')` | Answers "does this belong in my zone?" before the user opens the detail. Shown on every card. |
| `is_tropical` | `BOOLEAN` | One flag that implies humidity sensitivity, warmth needs, and cold intolerance — replaces a paragraph of caveats. |
| `is_toxic_to_humans` | `BOOLEAN` | Mirrors the existing `is_toxic_to_pets`. Critical for households with children. |
| `human_toxicity_notes` | `TEXT` | Brief clinical note (e.g. "Causes mouth irritation if ingested"). Null when not toxic. |
| `produces_fruit` | `BOOLEAN` | Informs harvest interest and child safety (some ornamental fruits are toxic). |
| `fruit_season` | `TEXT` | E.g. "Late Summer – Autumn". Null when `produces_fruit` is false. |
| `produces_flowers` | `BOOLEAN` | Core decorative/pollinator interest. |
| `flowering_season` | `TEXT` | E.g. "Spring – Summer". Null when `produces_flowers` is false. |
| `growth_rate` | `TEXT ('Slow'/'Moderate'/'Fast')` | Tells the user how often to expect repotting, pruning, and zone crowding. |
| `maintenance_level` | `TEXT ('Low'/'Medium'/'High')` | Honest weekly time-investment signal — separate from care difficulty (skill) vs maintenance (time). |
| `preferred_soil_type` | `TEXT[]` | E.g. `['Well-draining', 'Sandy']`. Practical repotting guidance. |
| `native_region` | `TEXT` | E.g. "Tropical West Africa". Explains why a plant wants humidity, shade, warmth — context the user infers naturally. |
| `max_height_cm` | `INT` | Mature height. Helps with zone space planning and choosing between species. |
| `max_spread_cm` | `INT` | Mature spread. Same rationale as height. |
| `air_purifying` | `BOOLEAN` | Popular indoor consideration. NASA Clean Air Study reference; surfaced as a small badge. |

> `care_difficulty` ('Beginner'/'Intermediate'/'Advanced') is already planned in Phase 3.1 and is **not** duplicated here. It is surfaced in the UI in this phase.

---

## Surface Map

Four plant-display surfaces, four distinct user questions. Field selection follows from the question — not from data availability.

| Surface | User's question | Phase 3.10 additions |
|---|---|---|
| `/tasks` scheduler card | "What needs watering and how urgently?" | None — task surface; botanical metadata is noise here |
| Zone-detail plant card | "Which plants live here, and are any a poor fit?" | `care_difficulty` + `placement` + `is_tropical` badges (Block E); amber mismatch warnings (Block G) |
| Zone-detail care panel ("Care tips") | "Quick care reference while managing this zone" | `preferred_soil_type` chips + `maintenance_level` pill (Block C) |
| Library card | "Is this species right for me?" | `description` subtitle + `care_difficulty` + `placement` badges (Block D) |
| Botanical detail dialog | "Tell me everything about this species" | 4-tab restructure with all 16 new fields (Block C) |

`description` and `native_region` are discovery text — they belong in the dialog identity strip and Library card only. They must not appear in the care panel.

---

## Information Architecture

Five surfaces, five information densities.

### Botanical Detail Dialog — anatomy

```
[Dialog title bar: common_name ····················· ×]
├── Identity strip (persistent — not inside any tab):
│   ├── Left:  <img w-24 h-24 rounded, leaf icon fallback>  ← Phase 4.3 populates src
│   └── Right: scientific_name (italic) + description (2-line clamp, @if)
├── ─────────────────────────────────────────────────────
├── <p-tabs> — 4 panels:
│   ├── Overview: placement · is_tropical · growth_rate · maintenance_level
│   │             care_difficulty · native_region · max_height/spread · air_purifying
│   ├── Care:     watering · check_depth_description · sunlight · preferred_soil_type
│   │             ideal_humidity_min/max · ideal_min_ph/max_ph
│   ├── Growth:   cycle · plant_type · flowers + season · fruit + season · propagation
│   └── Safety:   is_toxic_to_pets + notes · is_toxic_to_humans + notes
└── [Footer: Close | Add to my greenhouse (+ advisory if Advanced)]
```

All fields conditional — null fields absent from DOM. Image slot built in Phase 3.10 (leaf icon); `regular_url` wired in Phase 4.3 without structural change.

### Library Card — compact additions

Keep the card height unchanged. Add below the name line:
- `description` as a one-line subtitle (`truncate`, max ~90 chars)
- Two new badges: `care_difficulty` pill + `placement` pill (after existing toxicity/watering/sunlight badges)

Do not add: height, fruit, flowers, maintenance — too much for a scan card.

### Zone Detail Plant Card — contextual badges

Show only when a `cached_botanical_records` row is linked and AI-enriched (via the existing `enrichedRecordFor(scientific_name)` helper):
- `care_difficulty` badge
- `placement` badge
- `is_tropical` tag (tropical leaf icon, shown only when `true`)

`ZoneDetailComponent` already owns a `botanicalMap: signal<Map<string, CachedBotanicalRecord>>` and `_loadBotanicalRecords()` from Phase 3.3 work — no new data layer is needed for Block E.

### Zone Detail Care Panel ("Care tips") — extensions

Inline `care-recommendations-panel` currently shows: `care_difficulty`, watering, sunlight, `check_depth_description`, humidity range.

Phase 3.10 additions (handled in Block C):
- `preferred_soil_type` chips (same chip style as sunlight)
- `maintenance_level` pill (same pill style as `care_difficulty`)

`description` and `native_region` stay out of this panel — they are discovery text, not actionable care guidance.

---

## Blocks

- [x] **Block A — DB Migration: Extended Profile Columns** | Agent: `/plumber`
  - New migration: 16 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements on `cached_botanical_records` per `docs/DB_SCHEMA_MATRIX.md §7 Phase 3.10 stub`.
  - Run `bunx supabase migration up` then `bun run types` — paste updated `database.types.ts` diff to confirm.
  - Verification: `SELECT column_name FROM information_schema.columns WHERE table_name = 'cached_botanical_records' ORDER BY ordinal_position;` — confirm all 16 new columns present.

- [x] **Block B — AI Scribe Extension** | Agent: `/plumber`
  - Extend `supabase/functions/claude-enrichment/index.ts` system prompt to request the 16 new fields.
  - Extend the JSON schema (`AI_PROMPT_MANIFEST.md §1.2`) with new property definitions and add all 16 to `required`.
  - Set `max_tokens: 1024` — the expanded schema (~27 fields) will exceed the old 512 limit and produce truncated, unparseable JSON. This is already updated in `docs/AI_PROMPT_MANIFEST.md §1`.
  - Update `docs/AI_PROMPT_MANIFEST.md §1` to reflect the extended schema.
  - Verification: invoke the function locally against a known species (e.g. `Monstera deliciosa`) and paste the JSON response — confirm all new fields appear with expected types and the response is not truncated.

- [x] **Block C — Botanical Detail Dialog: Restructure + Care Panel Extension** | Agent: `/visualizer`
  - Dialog `[header]` switches from `scientific_name` to `common_name`.
  - Add an identity strip **above the tabs**: image slot (leaf icon fallback) + scientific name (italic) + description. Image `src` empty until Phase 4.3 — the leaf icon shows immediately and looks intentional.
  - Replace the flat grid with `<p-tabs [pt]="FloraTabsPT">` — 4 panels. Redistribute all existing flat fields and the 16 new fields:
    - **Overview:** `placement` · `is_tropical` · `growth_rate` · `maintenance_level` · `care_difficulty` · `native_region` · `max_height_cm` / `max_spread_cm` · `air_purifying`
    - **Care:** `watering` · `check_depth_description` · `sunlight` · `preferred_soil_type` · `ideal_humidity_min/max` · `ideal_min_ph/max_ph`
    - **Growth:** `cycle` · `plant_type` · `produces_flowers` + `flowering_season` · `produces_fruit` + `fruit_season` · `propagation_methods`
    - **Safety:** `is_toxic_to_pets` + `toxicity_notes` · `is_toxic_to_humans` + `human_toxicity_notes`
  - All fields conditional — null fields absent from DOM.
  - When `showAddButton()` and `care_difficulty === 'Advanced'`, show a non-blocking advisory above the footer buttons. `showAddButton()` is `false` in zone-detail, so this advisory appears in the Library flow only.
  - Extend `care-recommendations-panel`: add `preferred_soil_type` chips (same chip style as sunlight labels) and a `maintenance_level` pill (same pill style as `care_difficulty`) — both conditional on non-null. `description` and `native_region` must not appear here.
  - Manual Browser Check: open from Library and from Zone Detail — confirm identity strip, leaf icon fallback, all 4 tabs, existing fields in correct tabs, null fields absent. Confirm Advanced advisory shows from Library but not from Zone Detail. Check "Care tips" on an enriched plant in zone-detail — confirm `preferred_soil_type` and `maintenance_level` appear.

- [x] **Block D — Library Card: Description & New Badges** | Agent: `/visualizer`
  - In `botanical-record-card.html`: add `description` as a single truncated line below the name block.
  - Add `care_difficulty` badge and `placement` badge after the existing tag row.
  - Keep existing tag order: toxicity → watering → sunlight → lifecycle → care difficulty → placement.
  - Manual Browser Check: open Library — confirm description line wraps correctly at narrow widths, badges are legible.

- [x] **Block E — Zone Detail Card: Contextual Botanical Badges** | Agent: `/visualizer`
  - `ZoneDetailComponent` already has `botanicalMap: signal<Map<string, CachedBotanicalRecord>>` and `enrichedRecordFor()` — no new service method or data-layer work needed. This block is template-only.
  - In `zone-detail.html`: below the container/substrate badge row, read from `enrichedRecordFor(ep.plant.scientific_name)` and conditionally render `care_difficulty`, `placement`, and `is_tropical` badges — each guarded by `@if` on the field value so no DOM output when null.
  - Manual Browser Check: navigate to a zone with at least one enriched plant — confirm badges appear. Navigate to a zone with no enriched plants — confirm no empty space or broken layout.

- [x] **Block F — Library Filters: 6 New Dimensions** | Agent: `/visualizer`
  - Add 6 new filter sections to the library sidebar filter panel (and future Phase 5.4 bottom sheet — no extra work needed, the sheet already renders the same filter component):
    - **Placement** — radio group: Any / Indoor / Outdoor / Both
    - **Care Difficulty** — checkbox group: Beginner / Intermediate / Advanced
    - **Maintenance** — checkbox group: Low / Medium / High
    - **Tropical only** — toggle switch (filters to `is_tropical = true`)
    - **Air-purifying only** — toggle switch (filters to `air_purifying = true`)
    - **Safe for humans** — toggle switch (filters to `is_toxic_to_humans = false`)
  - Extend the `filters()` signal in `LibraryComponent` with the 6 new dimensions.
  - Extend the Supabase query to apply each active filter as an additional `.eq()` / `.is()` / `.in()` clause.
  - Active filter count badge on the sidebar header updates automatically (badge logic is already count-based).
  - Manual Browser Check: apply each new filter independently — confirm result set updates. Combine Placement + Care Difficulty — confirm AND logic. Clear all → full list.

- [x] **Block G — Plant-Zone Compatibility Warnings** | Agent: `/visualizer`
  - Requires Block E's `botanicalMap` signal to exist.
  - In `ZoneDetailComponent`: add `incompatibilities` computed signal — a `Map<string, string[]>` keyed by `plant.id`. Each value is a list of human-readable warning strings. Two checks per plant:
    1. **Placement mismatch** — `placement = 'Indoor'` in an `outdoor` zone, or `placement = 'Outdoor'` in an `indoor` zone → "Prefers [indoor/outdoor] conditions"
    2. **Humidity mismatch** — `is_tropical = true` and `zone.humidity_baseline < 50` → "Tropical species — zone humidity may be too low"
  - In `zone-detail.html`: when `incompatibilities().get(plant.id)?.length`, show a compact amber row at the bottom of that plant's card article — one line per warning, prefixed with a `pi-exclamation-triangle` icon.
  - Warnings only show when a botanical record is linked and the relevant field is non-null — no false positives from missing data.
  - Manual Browser Check: place a plant with `placement = 'Outdoor'` in an indoor zone → amber warning row visible. Correct the zone → warning absent. Set zone `humidity_baseline` below 50 with a tropical plant → humidity warning appears.
