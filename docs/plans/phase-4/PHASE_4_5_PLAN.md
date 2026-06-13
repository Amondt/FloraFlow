# Phase 4.5 — Multilingual AI Content

> Read `docs/PLANS_GUIDE.md` before touching this file.

## Objective

Translate the open-ended AI-generated prose that Phase 4.2 cannot key — the botanical
free-text in the global cache and the per-user Leaf Doctor diagnoses — **on demand**, caching
each translation in the DB so every (record × language) pair is translated by AI at most once.

## Scope boundary vs 4.2

Phase 4.2 translates everything with a **finite key set**: static UI labels and controlled-
vocabulary enum _values_ (`Beginner`, `Indoor`, `Frequent`, `Isolated`, …) via Transloco keys
(Blocks H + J). Phase 4.5 translates only the **open-ended AI prose** that has no key set.
The two are complementary; 4.5 must not re-translate any enum or static label.

**Free-text fields in scope** — `cached_botanical_records`: `description`,
`check_depth_description`, `toxicity_notes`, `human_toxicity_notes`, `native_region`,
`fruit_season`, `flowering_season`. `plant_journals.diagnostics`: `primary_condition`,
`identified_plant`, `immediate_remedial_actions[]`.

**Explicitly NOT AI-translated** (controlled vocabulary → 4.2 Transloco keys): `watering`,
`sunlight`, `cycle`, `care_difficulty`, `placement`, `growth_rate`, `maintenance_level`,
`preferred_soil_type`, `systemic_risk_assessment`, all booleans. User-authored
`plant_journals.notes` also stays as written — never auto-translated.

## Resolved architecture decisions

1. **Storage = per-locale JSONB sub-objects, not suffixed columns.** `translations` on the
   cache, `diagnostics_i18n` on journals. Adding a 4th locale later needs no migration. Matches
   the existing JSONB columns (`raw_api_payload`, `gallery_urls`, `diagnostics`).
2. **On-demand ("lazy") translate-and-cache** (user-chosen). Mirrors the existing
   `LibraryService.triggerEnrichment` throttle — only translates what is actually viewed,
   backfills the ~900 existing rows as they are browsed, no eager cron, no upfront ×2 cost.
3. **English is canonical and never overwritten.** Translation writes only locale sub-objects.
   Every surface renders `translations[locale]?.[field] ?? base[field]`, so a missing or
   in-flight translation degrades to English, never to blank.
4. **Two thin Edge Functions over one shared core** (`_shared/translate.ts`) — the same shape as
   `claude-enrichment` / `cache-enrichment-worker` wrapping `_shared/enrich-record.ts`:
   - `translate-botanical-record` — global cache: translate **+ service-role write** (clients
     cannot write the cache; RLS blocks it).
   - `translate-text` — generic: translate **only, no DB write**.
5. **The journal write stays client-side.** A diagnosis row is owned by the user, so the client
   writes `diagnostics_i18n[locale]` under the existing `auth.uid() = user_id` RLS. This is safer
   than a service-role write that would have to re-check ownership by hand. → **Recommendation for
   the open question: on-demand for the journal too, _not_ born-in-locale generation.** One
   mechanism then covers both new and historical diagnoses; born-in-locale would be a second
   mechanism that still leaves old entries untranslated. Generation (`claude-vision`) stays
   English-canonical — most reliable for the vision model and a stable translation source.
6. **Model = Claude Haiku** (`claude-haiku-4-5-20251001`), structured JSON via
   `anthropic.messages.parse` + `zodOutputFormat` — same as the Scribe. Translation is simpler
   than enrichment; Haiku is the right tier.
7. **Locale allow-list:** only `'fr'` and `'nl'` are translatable targets (`'en'` is the base).
   Both Edge Functions reject any other value — prevents arbitrary key injection into the JSONB.
8. **No RLS changes.** `cached_botanical_records` (read-all-authenticated, writes service-role
   only) already covers `translations`; `plant_journals` (owner-all) already covers
   `diagnostics_i18n`.

---

## Blocks

- [x] **Block A — Migration: translation storage** | Agent: `/plumber` · Model: Sonnet · Effort: low
  - New migration `supabase/migrations/<ts>_ai_content_translations.sql`:
    `ALTER TABLE public.cached_botanical_records ADD COLUMN IF NOT EXISTS translations JSONB;`
    and `ALTER TABLE public.plant_journals ADD COLUMN IF NOT EXISTS diagnostics_i18n JSONB;`
  - SQL comment on each column documenting the `{ "fr": { …fields }, "nl": { … } }` shape.
  - No RLS, no index (read with the parent row; looked up by PK / owner).
  - Run `bunx supabase migration up`, then `bun run types`, then copy
    `src/types/database.types.ts` → `supabase/functions/_shared/database.types.ts`.
  - Document both columns in `docs/DB_SCHEMA_MATRIX.md §2.4` and `§2.5`.

- [ ] **Block B — Shared translation core (`_shared/translate.ts`)** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - `SUPPORTED_TRANSLATION_LOCALES = ['fr','nl'] as const` + type + `LOCALE_LANGUAGE_NAME`
    (`{ fr: 'French', nl: 'Dutch' }`).
  - `TRANSLATION_SYSTEM_PROMPT` — translate the JSON _values_ into `{language}`; keep keys and
    structure identical (string stays string, array stays array with the same item count); leave
    scientific/Latin names, numbers, and units (`cm`, `%`, `°C`, `pH`) unchanged; translate
    botanical/clinical terms accurately; add nothing, drop nothing; return only JSON.
  - `translateFields(anthropic, fields: Record<string, string | string[]>, locale)` — validates
    the locale, drops empty values, builds a Zod object schema from the surviving keys
    (`string → z.string()`, array → `z.array(z.string())`), calls Haiku via `messages.parse`,
    returns the parsed object. Returns `{}` when nothing is translatable.
  - `TranslationError extends Error { status = 503 }` for upstream-AI failure (mirror
    `EnrichmentError`).

- [ ] **Block C — Translation Edge Functions** | Agent: `/plumber` · Model: Sonnet · Effort: mid
  - `supabase/functions/translate-botanical-record/index.ts` — `{ scientificName, locale }`;
    resolve the bearer token to a user (as `claude-vision` does); validate locale. Load the row;
    if `row.translations?.[locale]` already exists, return the row unchanged (**cache-first — no
    AI call**). Otherwise translate the non-empty free-text fields via `translateFields`, merge
    under `translations[locale]` (preserving other locales and never touching base columns),
    `update` via service role, return the updated row.
  - `supabase/functions/translate-text/index.ts` — `{ fields, locale }`; auth + locale validation;
    reject oversized input (serialized `fields` > ~4 000 chars); `translateFields` →
    `{ translations }`. No DB write.
  - Both import `_shared/translate.ts` + `_shared/response.ts` (`cors`, `json`).
  - Verify with `bun run functions:serve` + `Invoke-RestMethod`; confirm `translations.fr`
    appears on the row in Studio and a second call returns instantly with no AI hit.

- [ ] **Block D — Library: localize overlay + on-demand trigger** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `shared/utils/localize-botanical.util.ts` (+ spec) — pure `localizeBotanical(record, locale)`
    returning a shallow copy with the 7 free-text fields overlaid from `translations[locale]`,
    falling back to base.
  - `core/services/botanical-translation.service.ts` — `triggerBotanicalTranslation(records, locale)`
    mirroring `triggerEnrichment` (fire `translate-botanical-record`, cap 10/trigger, 800 ms
    apart, fire-and-forget); caller refetches via `LibraryService.refetchByScientificNames`.
  - `library.ts` — when `locale() !== 'en'`, after results load / page change, fire the trigger
    for visible records missing `translations[locale]`, then refetch + update the signal; render
    cards through `localizeBotanical`.
  - `botanical-detail-dialog.{ts,html}` — render free-text through `localizeBotanical`; when
    `locale() !== 'en'` and the active record lacks the translation, fire one translate call and
    show an `isTranslating` skeleton on the free-text slots (reuse the existing `isEnriching`
    skeleton pattern), then refetch that one record. **Static labels + enum values on this dialog
    are 4.2 Block H — do not touch them here.**
  - format + lint + Manual Browser Check (library list + detail dialog in FR & NL: free-text
    shimmers then localizes; reload is instant).

- [ ] **Block E — Journal: on-demand diagnosis translation** | Agent: `/visualizer` · Model: Sonnet · Effort: mid
  - `shared/utils/localize-diagnostics.util.ts` (+ spec) — pure overlay of `primary_condition`,
    `identified_plant`, `immediate_remedial_actions` from `diagnostics_i18n[locale]`.
  - `journal.service.ts` — `translateDiagnostics(entryId, diagnostics, locale)`: call
    `translate-text` with the non-empty free-text fields, then `update` the entry's own
    `diagnostics_i18n[locale]` (RLS owner write); return the updated entry.
  - `journal-entry-card.{ts,html}` — render the diagnosis (sick `primary_condition` + action
    points, healthy `identified_plant`) through the overlay; when `locale() !== 'en'` and
    `diagnostics_i18n[locale]` is missing, trigger `translateDiagnostics` once and show a subtle
    pending state. Confidence/risk badges are already localized by 4.2 — leave them.
  - `claude-vision` generation path is unchanged (English-canonical).
  - format + lint + Manual Browser Check (a past EN diagnosis viewed in FR translates and
    persists; switching to EN shows the base; a re-view triggers no second AI call).

---

## Verification (every block)

Run first, in this order:

```powershell
bun run format
bun run lint
```

Then per block type:

- **Plumber (A–C):** `bunx supabase migration up` → `bun run types` → copy types to `_shared`;
  Edge Functions via `bun run functions:serve` + `Invoke-RestMethod`; SQL checks in Studio at
  `http://127.0.0.1:54323/`.
- **Visualizer (D–E):** Manual Browser Check at `http://localhost:4200`, exercised in **FR and NL**,
  ending with "Open DevTools Console → confirm zero red errors."

## Phase QA mapping (add to `docs/PHASES_PLAN.md` §4)

1. First FR view of an untranslated species shimmers, then shows French free-text; reload is
   instant (row `translations.fr` populated). → D
2. Base English columns are byte-for-byte unchanged after translation (Studio diff). → C
3. A past Leaf Doctor diagnosis translates on demand into FR and persists in that user's
   `diagnostics_i18n.fr`; another user cannot read it (own-row RLS). → E
4. Only `fr`/`nl` are accepted; other locales are rejected; a second view of a translated record
   makes no AI call (cache-first). → C

## Sequencing & coordination

- Block A is independent. B → C → (D, E). D and E are parallel after C.
- **Soft ordering:** land D/E after **4.2 Block H** (detail-dialog labels) so each surface reads
  fully localized — no hard code dependency, only visual coherence.
- Last block of the phase → closing line: "All blocks done — call `/gatekeeper` to close out the phase."

## Out of scope

- Static labels + enum-value translation (4.2 Blocks H + J).
- User-authored `plant_journals.notes`.
- Born-in-locale generation; eager / bulk pre-translation of the cache.
