# Phase 2.11 — Background Botanical Cache Enrichment Worker

**Goal:** Replace the broken inline enrichment approach in `botanical-search` with a clean, two-layer architecture: the search function caches all Perenual pages fast and returns immediately; a background pg_cron worker enriches unenriched records with Claude AI + iNaturalist thumbnails, little by little, without ever blocking the user.

**Agents:** `/plumber` (all blocks)
**No new schema columns** — all fields exist; one new cron migration only.

---

## Context & What Changes

### What existed before (vestigial, now removed or replaced)

| Old behaviour | Problem | Fix |
|---|---|---|
| `botanical-search` fetched Perenual `species/details` per result | Caused 55s wall-clock timeouts from parallel 429-rate-limited requests | Removed entirely |
| `botanical-search` sliced results to 15 | Cache locked in with too few results forever | Remove the slice |
| `botanical-search` early-returned at ≥ 5 cached results | Same few results shown forever | Raise threshold; paginate all Perenual pages |
| `is_perenual_enriched` flag read in `botanical-search` | Now unused — detail fetch is gone | Clean the select list; column stays in DB |

### Target architecture

```
User types "grape"
    │
    ▼
botanical-search (fast)
    ├─ 1. Cache query — if ≥ 25 results, return immediately
    └─ 2. Perenual pages 1, 2, … (up to 5) — upsert basic fields, return merged
            ↓ (no enrichment here)

pg_cron (every 10 min)
    │
    ▼
cache-enrichment-worker (batch = 5 records / run)
    ├─ Query: SELECT ... WHERE is_ai_enriched = false ORDER BY cached_at DESC LIMIT 5
    └─ For each: Claude AI + iNaturalist in parallel → upsert → is_ai_enriched = true
```

`claude-enrichment` remains for **on-demand enrichment** when a user explicitly saves a plant. The worker handles **bulk background enrichment** of cached search results the user may never explicitly select.

---

## Blocks

- [ ] **Block A — `botanical-search` pagination + cleanup** | Agent: `/plumber`
  - Add a `page` loop: fetch `&page=1`, `&page=2`, … until `body.data` is empty or `page > 5` (safety cap)
  - Remove `is_perenual_enriched` from the `.select()` list — the field is vestigial in this function
  - Keep `CACHE_THRESHOLD = 25` and `MAX_RESULTS = 30` (already correct from last fix)
  - No detail-fetch code reintroduced — that path is gone
  - `bun run format && bun run lint` must pass

- [ ] **Block B — Extract `_shared/enrich-record.ts` + refactor `claude-enrichment`** | Agent: `/plumber`
  - Create `supabase/functions/_shared/enrich-record.ts` containing:
    - `ENRICHMENT_SYSTEM_PROMPT` — the AI Scribe system prompt (moved from `claude-enrichment`)
    - `EnrichmentSchema` — the Zod schema (moved from `claude-enrichment`)
    - `queryINat(query, signal)` — iNaturalist single lookup (moved)
    - `fetchINatThumbnail(scientificName, commonName)` — iNat thumbnail with fallback (moved)
    - `enrichRecord(supabase, anthropic, scientificName, commonName)` — orchestrates Claude + iNat in parallel, upserts to `cached_botanical_records`, returns the upserted row; the same logic currently inside `claude-enrichment`'s `Deno.serve` handler, extracted to a pure function
  - Refactor `claude-enrichment/index.ts` to import from `_shared/enrich-record.ts`; the `Deno.serve` handler keeps only: preflight → auth → input validation → `enrichRecord()` call → response
  - Zero change to `claude-enrichment`'s external API contract
  - `bun run format && bun run lint` must pass

- [ ] **Block C — `cache-enrichment-worker` Edge Function** | Agent: `/plumber`
  - Create `supabase/functions/cache-enrichment-worker/index.ts`
  - Auth: `x-cron-secret` header (server-to-server, same pattern as `push-plant-alerts`)
  - Logic — Separation of Concerns:
    1. Preflight (`OPTIONS`)
    2. Auth check (`x-cron-secret`)
    3. Query `cached_botanical_records` for `BATCH_SIZE = 5` records where `is_ai_enriched = false`, ordered by `cached_at DESC` (most recently searched first — user most likely to view these)
    4. For each record: call `enrichRecord()` from `_shared/enrich-record.ts`; catch per-record errors so one failure does not abort the batch
    5. Return `{ processed: N, errors: N }` JSON
  - If `ANTHROPIC_API_KEY` is absent: return `503` with a clear message (no silent crash)
  - `bun run format && bun run lint` must pass

- [ ] **Block D — pg_cron migration** | Agent: `/plumber`
  - New migration file: `supabase/migrations/20260606000002_cache_enrichment_cron.sql`
  - Schedules `cache-enrichment-worker` every 10 minutes (`*/10 * * * *`)
  - Pattern: identical to `20260527000001_push_alerts_cron.sql` — uses `extensions.http_post` with `x-cron-secret` header
  - Apply locally: `bunx supabase migration up`
  - Confirm the job appears: run the verification SQL in Supabase Studio

---

## Verification

```powershell
bun run format
bun run lint
bunx supabase migration up
```

**Verify cron is registered** (run in Supabase Studio at http://127.0.0.1:54323):
```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'cache-enrichment-worker';
```
Expected: one row, `active = true`.

**Trigger the worker manually** (Terminal, with functions already served):
```powershell
$secret = "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"
Invoke-RestMethod `
  -Uri "http://127.0.0.1:54321/functions/v1/cache-enrichment-worker" `
  -Method POST `
  -Headers @{ "x-cron-secret" = $secret; "Content-Type" = "application/json" } `
  -Body "{}"
```
Expected: `{ "processed": N, "errors": 0 }` where N ≤ 5. Function completes in < 30s.

**Confirm records are being enriched** (Supabase Studio):
```sql
SELECT scientific_name, is_ai_enriched, thumbnail_url
FROM cached_botanical_records
ORDER BY cached_at DESC
LIMIT 10;
```
Expected: after one or more worker runs, rows show `is_ai_enriched = true` and non-null `thumbnail_url` for the most recently cached species.
