# Phase 3.1 — AI Scribe Extended Enrichment

Agent: `/plumber`

Pure backend. No Angular changes. Two blocks: a schema migration and an Edge Function update.

---

## Context

The `claude-enrichment` Edge Function was deployed in Phase 2.4 and already contains the correct Zod schema and system prompt for the Phase 3.1 fields (`check_depth_description`, `ideal_humidity_min`, `ideal_humidity_max`, `care_difficulty`). Two gaps remain:

1. The 4 new columns don't exist in the DB yet — they must be added before the upsert can write them.
2. The upsert call inside `claude-enrichment` doesn't include the new fields — they're parsed but thrown away.
3. `max_tokens` is 512 — `docs/AI_PROMPT_MANIFEST.md §1` requires 1024 (the extended schema can truncate at 512).

**Re-enrichment**: Records already marked `is_ai_enriched = true` are skipped by `botanical-search`'s backfill. The migration resets that flag to `false` on all existing rows so they are re-enriched on their next search hit, picking up the new fields.

---

## Blocks

- [x] **Block A — Migration: extended enrichment columns** | Agent: `/plumber`
  - New migration file: `supabase/migrations/<timestamp>_phase_3_1_extended_enrichment.sql`
  - Add 4 columns using the stub from `docs/DB_SCHEMA_MATRIX.md §7`:
    - `check_depth_description TEXT` (nullable)
    - `ideal_humidity_min INT` (nullable)
    - `ideal_humidity_max INT` (nullable)
    - `care_difficulty TEXT CHECK (care_difficulty IN ('Beginner', 'Intermediate', 'Advanced'))` (nullable)
  - All four use `ADD COLUMN IF NOT EXISTS` (safe to run twice)
  - After adding columns: `UPDATE public.cached_botanical_records SET is_ai_enriched = FALSE WHERE is_ai_enriched = TRUE` — forces re-enrichment with the new fields on next botanical-search hit
  - Run `bunx supabase migration up`
  - Run `bun run types` and `Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts`

- [x] **Block B — `claude-enrichment` Edge Function update** | Agent: `/plumber`
  - Raise `max_tokens` from `512` to `1024`
  - Add all 4 new fields to the `.upsert()` call (they're already parsed by Zod — just not written):
    - `check_depth_description: parsed.check_depth_description`
    - `ideal_humidity_min: parsed.ideal_humidity_min`
    - `ideal_humidity_max: parsed.ideal_humidity_max`
    - `care_difficulty: parsed.care_difficulty`
  - These fields are AI-only (not sourced from Perenual), so no `conditionalFields` guard is needed — always write Claude's output, including `null`

---

## Verification

After Block A:

```powershell
bunx supabase migration up
bun run types
Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts
bunx supabase db test
```

Confirm in Studio → Table Editor → `cached_botanical_records`:

- All 4 new columns are present
- All existing rows show `is_ai_enriched = false`

After Block B — end-to-end test (local):

1. Start the local Supabase stack + serve Edge Functions:
   ```powershell
   bunx supabase functions serve --no-verify-jwt --env-file supabase/functions/.env
   ```
2. POST to `claude-enrichment` with a known species (e.g. `{ "scientificName": "Monstera deliciosa", "commonName": "Swiss Cheese Plant" }`)
3. Confirm the response JSON includes `check_depth_description`, `ideal_humidity_min`, `ideal_humidity_max`, and `care_difficulty` (values may be `null` for lesser-known species — that is correct)
4. Query `cached_botanical_records` in Studio — confirm the row has the new fields written and `is_ai_enriched = true`
5. POST the same species again — confirm the early-return fires (response is instant, no Claude call) and the row is unchanged
