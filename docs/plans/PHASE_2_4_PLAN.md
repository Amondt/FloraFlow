# Phase 2.4 — Perenual Taxonomy Integration + AI Scribe Fallback

Agent: `/plumber`

Pure backend. No Angular changes. Extends `botanical-search` and creates `claude-enrichment`.

---

## Overview

```
botanical-search (existing, extended)
  ├── cache hit (≥5 results) → return immediately          [unchanged]
  ├── cache miss → Perenual species-list → upsert basic    [unchanged]
  │   └── for each perenual_id:
  │       ├── Block B: call species/details → upsert care fields
  │       └── Block C: fire-and-forget → claude-enrichment
  └── return merged results                                 [unchanged]

claude-enrichment (new — Block A)
  ├── check is_ai_enriched → return cached if true
  ├── call Claude Haiku (full AI_PROMPT_MANIFEST §1 schema)
  └── upsert Phase 2.4 columns → set is_ai_enriched = true
```

---

## Blocks

- [x] **Block A — `claude-enrichment` Edge Function** | Agent: `/plumber`
  - New file: `supabase/functions/claude-enrichment/index.ts`
  - Input body: `{ scientificName: string, commonName: string }`
  - Auth: check `Authorization` header is present; reject with 401 if missing (internal function — caller passes service role key)
  - Cache guard: query `cached_botanical_records` by `scientific_name`; if `is_ai_enriched = true`, return the existing row immediately — no Claude call
  - Zod schema: full shape from `AI_PROMPT_MANIFEST.md §1.2` — validates all 12 fields including Phase 3.1 extras (`check_depth_description`, `ideal_humidity_min`, `ideal_humidity_max`, `care_difficulty`), so Phase 3.1 only needs to extend the upsert, not the schema. Import Zod as `import { z } from 'npm:zod/v4'`.
  - Claude Haiku call: `model: 'claude-haiku-4-5-20251001'`, `max_tokens: 512`, system prompt from `AI_PROMPT_MANIFEST.md §1.1`, user message: `"${scientificName} / ${commonName}"`
  - Use `anthropic.messages.parse()` with `output_config: { format: zodOutputFormat(EnrichmentSchema) }`; read result from `msg.parsed_output`. See `BACKEND_PATTERNS.md §Deno Edge Function — Full Structure` for the exact call shape.
  - DB upsert — Phase 2.4 columns only (Phase 3.1 columns do not exist in the DB yet — do not include them):
    - `ideal_min_ph`, `ideal_max_ph`, `is_toxic_to_pets`, `toxicity_notes`, `propagation_methods`, `is_ai_enriched: true`
    - `onConflict: 'scientific_name'`
  - Silent degradation: if Claude call fails, log to `console.error` and return HTTP 503 — caller treats this as non-fatal
  - Return the upserted record as JSON

- [x] **Block B — Perenual `species/details` in `botanical-search`** | Agent: `/plumber`
  - In the cache-miss branch, after the existing `species-list` upsert loop:
    - For each result that has a `perenual_id`, call `https://perenual.com/api/v2/species/details/{perenual_id}?key={PERENUAL_API_KEY}`
    - Apply field mapping from `BACKEND_PATTERNS.md §Perenual API Field Mapping`:
      - `poisonous_to_pets` → `is_toxic_to_pets`
      - `watering` → `watering`
      - `sunlight` → `sunlight`
      - `cycle` → `cycle`
      - `type` → `plant_type`
    - Upsert these fields to `cached_botanical_records` (`onConflict: 'scientific_name'`)
    - Silent degradation: wrap in try/catch; log failure; continue to next result
  - Return shape stays identical (`{ scientific_name, common_name, perenual_id }[]`) — autocomplete is unaffected

- [x] **Block C — Fire-and-forget Scribe chain in `botanical-search`** | Agent: `/plumber`
  - After Block B upserts, collect records where `is_ai_enriched` is not yet true (newly inserted rows)
  - Build the `claude-enrichment` URL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/claude-enrichment`
  - For each unenriched record, create a fetch call: POST with `{ scientificName, commonName }` and `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` header
  - Wrap all calls in `EdgeRuntime.waitUntil(Promise.allSettled([...]))` so they run after the response is sent — no latency impact on autocomplete
  - No error handling beyond what `claude-enrichment` itself logs — fire-and-forget

---

## Verification

After each block, run:

```powershell
bunx supabase db test 2>$null
```

End-to-end test sequence (local):

1. Open Add Plant → type a plant name not yet in the cache
2. Confirm autocomplete returns results (Perenual species-list path)
3. Query `cached_botanical_records` in Supabase Studio — confirm `watering`, `sunlight`, `cycle`, `plant_type` populated (Block B)
4. Wait ~5 seconds; re-query — confirm `is_ai_enriched = true`, `ideal_min_ph`, `ideal_max_ph`, `propagation_methods` populated (Block C → Block A)
5. Repeat the same search — confirm ≥5 hits returns immediately from cache, no outbound calls

RLS check: client cannot write to `cached_botanical_records` directly (existing policy blocks it; service_role only).
