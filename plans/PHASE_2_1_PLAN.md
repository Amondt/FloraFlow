# Phase 2.1 — `cached_botanical_records` + Edge Function + Autocomplete

**Scope:** 2.1 only — table migration + Edge Function. Autocomplete UI is Phase 2.2.

**Architecture rule (APP_SPEC §4.3):** Angular never calls Perenual directly. All lookups hit the DB cache first; on a miss the Edge Function fetches from Perenual, persists the result, then returns it. API key stays server-side.

**Phase 2 QA gate:** No third-party tokens in client bundle. Identical queries within 60 s hit the DB cache exactly once.

---

## Block A — Migration: `cached_botanical_records` | Agent: `/plumber`

- New migration file `supabase/migrations/<timestamp>_cached_botanical_records.sql`
- DDL exactly as specified in `docs/DB_SCHEMA_MATRIX.md §2.4`
- Index `idx_botanical_cache_id` on `perenual_id` (§3)
- RLS: `SELECT` open to `auth.role() = 'authenticated'`; `ALL` policy with `USING (false)` / `WITH CHECK (false)` blocks client writes (§5)
- Run `bunx supabase db reset 2>$null` → confirm zero errors
- Run `bunx supabase gen types typescript --local 2>$null` → copy to `supabase/functions/_shared/database.types.ts`
- Run `bunx supabase db test 2>$null` → confirm existing RLS tests still pass

---

## Block B — Edge Function: `botanical-search` | Agent: `/plumber`

File: `supabase/functions/botanical-search/index.ts`

**Flow:**
1. Preflight CORS (`OPTIONS` → 200)
2. Verify caller JWT via `supabase.auth.getUser()` — return 401 if missing/invalid
3. Parse `?q=` query param — return 400 if blank or `< 2` chars
4. **Cache check:** query `cached_botanical_records` with `ILIKE '%q%'` on `common_name` and `scientific_name`, limit 8
5. If ≥ 5 results found → return cache array immediately (no Perenual call)
6. **Cache miss:** call Perenual `GET /api/v2/species-list?key=API_KEY&q=...`; apply field mapping from `docs/BACKEND_PATTERNS.md §Perenual API Field Mapping`
7. Upsert basic fields (`scientific_name[0]`, `common_name`, `perenual_id`, `raw_api_payload`) into `cached_botanical_records` — service role bypasses RLS
8. Return merged array of `{ scientific_name, common_name, perenual_id }`

**Error handling (BACKEND_PATTERNS §External API Error Handling):**
- Perenual failure → log to `console.error`, return cached results only (may be empty) with HTTP 200
- Never block the caller with a 5xx for an upstream failure

**Env vars needed:** `PERENUAL_API_KEY` — add to `supabase/functions/.env` for local dev, document for Supabase dashboard Secrets for production.

**Verification:** test with `bunx supabase functions serve botanical-search 2>$null` + `curl` with a valid JWT.

---

## Completion gate

- [ ] **Block A** — `cached_botanical_records` migration | Agent: `/plumber`
- [ ] **Block B** — `botanical-search` Edge Function | Agent: `/plumber`

Mark `docs/PHASES_PLAN.md` checkbox `[x]` for 2.1 after Block B is verified and committed. Phase 2.2 (autocomplete UI + `BotanicalService`) gets its own plan file.
