# `docs/BACKEND_PATTERNS.md` — Supabase & Deno Edge Function Patterns

Reference for **The Plumber**. Always verify against context7 before implementing — SDKs evolve.

## Debugging Rule — Instrument Before Fixing

When a function returns an unexpected result (wrong status code, wrong auth behavior, unexpected data), **never guess**. Add a targeted `console.error` first, invoke once, read the output, then fix. One concrete data point eliminates multiple guesses.

```ts
// Safe debug pattern — logs shape, not secrets
console.error('[debug]', { secretLen: secret.length, tokenLen: token.length, match: token === secret });
```

Remove all `[debug]` lines before the block is marked done.

---

## Local Development Commands

For starting the dev server and serving Edge Functions, see `README.md`. The commands below target the local Docker instance started with `bunx supabase start` and are specific to backend work.

```powershell
# Apply pending migrations to the local DB
bunx supabase migration up

# Regenerate TypeScript types from the local schema
bun run types

# Copy types into the Edge Function shared folder (run after bun run types)
Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts

# Reset local DB (use the safe wrapper — preserves botanical seed data)
bun run db-reset-safe

# Run pgTAP RLS tests
bunx supabase db test
```

> **Never use `bunx supabase db push`** — that command targets a remote hosted project and requires `--project-ref`. It will fail with "cannot find project ref" in a local-only dev setup.

---

## Supabase Type Generation (run once per schema change)

```powershell
bun run types
```

After generating, copy the file into the shared Edge Function folder so Deno can import it:

```powershell
Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts
```

Never write `any` for Supabase responses. Always import and use `Database`.

---

## Typed Supabase Client

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Server-side (Edge Function) — uses service role key
const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Client-side (Angular) — uses anon key only
const supabase = createClient<Database>(
  environment.supabaseUrl,
  environment.supabaseAnonKey
);
```

---

## Supabase Queries

```ts
// Select with filters — fully typed, no casting
const { data, error } = await supabase
  .from('plants')
  .select('id, common_name, next_check_due_at, zone_id')
  .eq('user_id', userId)
  .order('next_check_due_at', { ascending: true });

if (error) throw error; // always handle error before using data

// Insert
const { data, error } = await supabase
  .from('plants')
  .insert({ user_id: userId, common_name: 'Monstera', zone_id: zoneId })
  .select()
  .single();

// Update
const { error } = await supabase
  .from('plants')
  .update({ next_check_due_at: newDate })
  .eq('id', plantId)
  .eq('user_id', userId); // always scope updates to the user

// RPC (stored procedure) — snooze interval is derived server-side from container × substrate
const { data, error } = await supabase.rpc('snooze_plant_check', {
  p_plant_id: plantId,
});
```

### QueryData — infer row types from a query shape

`QueryData<>` lets TypeScript infer the exact shape a `.select()` call returns — including joined tables — without executing the query. Useful when you need the type in multiple places.

```ts
import type { QueryData } from '@supabase/supabase-js';

const plantsWithZoneQuery = supabase
  .from('plants')
  .select('id, common_name, zone_id, zones(name)');

// Inferred type matches exactly what the query will return at runtime
type PlantWithZone = QueryData<typeof plantsWithZoneQuery>;
```

---

## RLS Migration Pattern

Every new table must follow this exact sequence:

```sql
-- 1. Create the table
CREATE TABLE plant_journals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes before RLS (performance)
CREATE INDEX idx_journals_plant ON plant_journals(plant_id);
CREATE INDEX idx_journals_user  ON plant_journals(user_id);

-- 3. Enable RLS — no policy = no access
ALTER TABLE plant_journals ENABLE ROW LEVEL SECURITY;

-- 4. Write the policy
CREATE POLICY "Users manage own journals"
ON plant_journals FOR ALL
USING     (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

---

## Shared Types for Edge Functions

Deno's module resolver does not bundle files outside the function directory during `supabase functions deploy`. Cross-directory imports like `../../src/types/` fail in production.

**Use the `_shared/` convention instead:**

```powershell
# After running: bun run types
# Copy the generated file into the shared Edge Function folder:
Copy-Item src/types/database.types.ts supabase/functions/_shared/database.types.ts
```

Import from `_shared/` in every Edge Function:

```ts
import type { Database } from '../_shared/database.types.ts';
```

Re-run the copy step whenever the schema changes. The `_shared/` directory is bundled automatically by the Supabase CLI.

---

## Auto-Profile Creation Trigger

`zones` and `plants` both FK to `profiles.id`. A new user has no `profiles` row until one is created — any first zone or plant insert will fail with a foreign key violation.

Add this migration to run immediately after the `profiles` table DDL:

```sql
-- Fires on every new auth.users signup and inserts a matching profiles row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

This runs server-side automatically — no client code needed.

---

## Edge Function Design Principles

- **Single Responsibility** — each Edge Function handles one workflow (enrichment, identification, diagnosis). Never add a second unrelated operation to an existing function; create a new one.
- **Separation of Concerns** — always structure in this order: (1) preflight, (2) auth check, (3) input validation, (4) business logic / external calls, (5) response. Never interleave these layers.
- **Descriptive function names** — helper functions inside an Edge Function follow the same rule: `validateAuthToken()` not `check()`, `fetchEnrichmentData()` not `getData()`.

---

## Deno Edge Function — Full Structure

```ts
import { createClient }   from 'npm:@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';
import { z }               from 'npm:zod/v4';
import type { Database }  from '../_shared/database.types.ts'; // ← use _shared/, not ../../src/

// CORS headers — required for browser requests
const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// Zod schema — single source of truth for shape + runtime validation
const EnrichmentSchema = z.object({
  scientific_name:     z.string(),
  common_name:         z.string(),
  ideal_min_ph:        z.number(),
  ideal_max_ph:        z.number(),
  is_toxic_to_pets:    z.boolean(),
  toxicity_notes:      z.string().nullable(),
  propagation_methods: z.array(z.string()),
  is_ai_enriched:      z.literal(true),
});

Deno.serve(async (req: Request) => {
  // 1. Preflight — must come first
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // 2. Parse body
    const body = await req.json();
    const { scientificName, commonName } = body;
    if (!scientificName || !commonName) return json({ error: 'Missing fields' }, 400);

    // 3. Init clients — always pass the Database generic for full type safety
    const supabase  = createClient<Database>(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

    // 4. Cache check before calling AI
    const { data: cached } = await supabase
      .from('cached_botanical_records')
      .select('*')
      .eq('scientific_name', scientificName)
      .maybeSingle();

    if (cached) return json(cached);

    // 5. Call Claude — messages.parse() validates the response against EnrichmentSchema
    const msg = await anthropic.messages.parse({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     '...paste system prompt from docs/AI_PROMPT_MANIFEST.md...',
      messages:   [{ role: 'user', content: `${scientificName} / ${commonName}` }],
      output_config: { format: zodOutputFormat(EnrichmentSchema) },
    });

    const parsed = msg.parsed_output;
    if (!parsed) return json({ error: 'AI returned invalid shape' }, 502);

    // 6. Persist to cache — parsed is fully typed, no manual guard needed
    await supabase.from('cached_botanical_records').insert(parsed);

    return json(parsed);

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
```

---

## External API Error Handling — Silent Degradation

FloraFlow's core loop (soil checks, journaling, snoozing) must never be blocked by an enrichment API failure. External data is enhancement, not the app's primary purpose.

### Degradation Tiers

| Failure scenario | Server behaviour | User sees |
|---|---|---|
| iNaturalist returns empty or crashes | Cache served as-is; AI Scribe still runs on next enrichment pass | Nothing, enrichment proceeds |
| AI Scribe also fails (quota, network) | Return partial record with enriched fields omitted | Plant created; enriched fields show `—` with tooltip "Details unavailable" |
| Leaf Doctor fails or quota exhausted | Return `{ error: 'diagnosis_unavailable' }` with HTTP 503 | Inline soft message where result would appear; photo is still saved |
| Open-Meteo fails | Return `{ weather: null }` | Weather widget shows `—`; dashboard loads normally |
| Resend cron fails | Log error server-side only | User is unaware; no email that cycle |

### Rules

- **Never throw a blocking modal or full-page error** for an enrichment API failure.
- **Always complete the primary write** (plant creation, journal entry, soil-check log) before attempting any enrichment call. Enrichment is fire-and-forget.
- **Use HTTP 503** (not 500) when an upstream API is unavailable — it signals a transient external failure, not a bug.
- **Log all upstream errors** to `console.error` in the Edge Function so they appear in Supabase Edge Function logs for debugging.

### Pattern — Enrichment with Graceful Fallback

```ts
// Primary write always happens first
const { data: plant, error } = await supabase
  .from('plants')
  .insert({ user_id: user.id, common_name, zone_id })
  .select()
  .single();

if (error) throw error; // only throw on our own DB errors

// Enrichment is best-effort — never let it block the response
try {
  const enriched = await fetchEnrichment(plant.scientific_name);
  if (enriched) {
    await supabase.from('cached_botanical_records').insert(enriched);
  }
} catch (enrichErr) {
  console.error('Enrichment failed — degrading gracefully:', enrichErr);
  // plant was already saved; just return it without enriched fields
}

return json(plant);
```

---

## Supabase Auth in Edge Functions

### User-facing functions (called from Angular with a logged-in user's JWT)

```ts
// Verify the calling user's JWT
const authHeader = req.headers.get('Authorization');
if (!authHeader) return json({ error: 'Unauthorized' }, 401);

const { data: { user }, error } = await supabase.auth.getUser(
  authHeader.replace('Bearer ', '')
);
if (error || !user) return json({ error: 'Unauthorized' }, 401);

// Now safe to use user.id in queries
```

### Server-to-server functions (called by cron or manual invocation — no user JWT)

Use a `CRON_SECRET` env var stored in `supabase/functions/.env`. **Never** compare against `SUPABASE_SERVICE_ROLE_KEY` — that is an internal PostgREST JWT that is auto-injected and invisible in `supabase status`; it cannot be used as an invocation token.

**Important:** Kong (the local API gateway) strips the `Authorization` header before it reaches the Deno function. Use the custom header `x-cron-secret` instead — Kong passes it through untouched.

```ts
// Auth check — must be the first thing after OPTIONS handling
// Use x-cron-secret, NOT Authorization — Kong strips Authorization before reaching Deno
const token = req.headers.get('x-cron-secret') ?? '';
const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
if (!token || token !== cronSecret) {
  return json({ error: 'Unauthorized' }, 401);
}

// SUPABASE_SERVICE_ROLE_KEY is still used for the DB client — that's its only role
const supabase = createClient<Database>(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
```

`supabase/functions/.env` entry:
```
CRON_SECRET=<your-sb_secret_...key-from-supabase-status>
```

Cron migration header:
```sql
headers := jsonb_build_object('x-cron-secret', '<same-CRON_SECRET-value>')
```

### Serving functions locally for manual testing

Always use both flags — omitting either causes silent auth failures:

```powershell
bunx supabase functions serve --no-verify-jwt --env-file supabase/functions/.env
```

- `--no-verify-jwt`: without this the gateway rejects the `sb_secret_...` token as an invalid JWT before the request reaches the function
- `--env-file`: without this, env changes made after `supabase start` are not picked up

---

## iNaturalist Taxa API Field Mapping

`botanical-search` calls this endpoint on cache miss:

```
GET https://api.inaturalist.org/v1/taxa?q={q}&taxon_id=47126&rank=species&per_page=30&locale=en
```

`taxon_id=47126` = Plantae kingdom. `locale=en` forces English `preferred_common_name`. No API key required.

| iNaturalist field | Our column | Notes |
|---|---|---|
| `results[n].id` | `inat_taxon_id` | Integer taxon ID |
| `results[n].name` | `scientific_name` | Binomial — already correctly cased |
| `results[n].preferred_common_name` | `common_name` | Falls back to `name` when absent; apply `toSentenceCase` |
| `results[n].default_photo.url` | `thumbnail_url` | Small square crop (~75 px) |
| `results[n].default_photo.medium_url` | `regular_url` | Medium size (~500 px) |

Photos arrive inline with the search result — no separate thumbnail-fetch pass is needed. The upsert sets `thumbnail_fetched = true` immediately.

Fields not in iNaturalist (filled by AI Scribe): `ideal_min_ph`, `ideal_max_ph`, `watering`, `cycle`, `sunlight`, `toxicity_notes`, and all extended Phase 3.10 fields.

---

## Required Environment Variables

Create a `.env.local` file in the project root (never commit it). All secrets stay server-side — only the two `PUBLIC_` variables are safe to expose to the Angular client bundle.

| Variable | Where to find it | Used in |
|---|---|---|
| `SUPABASE_URL` | Supabase project Settings → API | Edge Functions (auto-injected by CLI) |
| `SUPABASE_ANON_KEY` | Supabase project Settings → API | Angular client (`environment.ts`) — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project Settings → API | Edge Functions only — **never in client** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Edge Functions only — **never in client** |
| `RESEND_API_KEY` | resend.com → API Keys | Edge Functions only — **never in client** |

For local Supabase development, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Edge Functions by the CLI — you do not need to set them in `.env.local` for local dev. They are required in the Supabase dashboard Secrets panel for production deployments.

---

## pgTAP Test Patterns

All tests live in `supabase/tests/rls.sql` inside a single `BEGIN` / `ROLLBACK` transaction. The `plan(N)` count must equal the exact number of `IS()` calls — a mismatch fails the suite even if every assertion passes.

### What works reliably

| Pattern | How |
|---|---|
| Column default / schema assertion | `RESET ROLE` (superuser) + direct `SELECT IS(...)` |
| Authenticated read succeeds | `SET LOCAL ROLE authenticated` + JWT claims + `SELECT IS(count, N, ...)` |
| Blocked write: 0 rows affected | `SET LOCAL ROLE authenticated` + JWT claims + `UPDATE/DELETE` (silently affects 0 rows) + `RESET ROLE` + verify value unchanged |
| Blocked insert: exception path | `SET LOCAL ROLE authenticated` + `DO $$ BEGIN INSERT ... EXCEPTION WHEN others THEN NULL; END; $$` + verify row absent |

### What does NOT work — never attempt these in pgTAP

**Positive authenticated write** — testing that a user _can_ write their own row:

```sql
-- ❌ BROKEN — auth.uid() evaluates to NULL during WITH CHECK on UPDATE
-- in the pgTAP harness. The UPDATE raises an RLS exception, aborts the
-- transaction, and all subsequent IS() calls are silently skipped —
-- giving a misleading "planned N, ran M" failure with 0 reported failures.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"alice-id","role":"authenticated"}', TRUE);
UPDATE public.profiles SET push_subscription = '...' WHERE id = 'alice-id';
```

The USING clause (for SELECT) resolves `auth.uid()` correctly. The `WITH CHECK` clause (for INSERT/UPDATE) does not — it throws rather than returning TRUE, even when the user owns the row. This appears to be a limitation of the pgTAP execution environment in Supabase local.

**Rule:** For every table with `FOR ALL ... WITH CHECK`, only write blocking tests (wrong user → 0 rows) in pgTAP. Positive write coverage is provided by the policy structure itself and the manual browser check.

**Second rule — never UPDATE `profiles` in pgTAP tests.** Even a superuser UPDATE on `profiles` throws inside the pgTAP harness (the `trg_profiles_updated_at` trigger cannot complete in this context). Tests touching `profiles` must only SELECT or attempt a blocked write that resolves to 0 rows. All `profiles` seed data must come from the initial INSERT block at the top of the test file.

### Seeding test data for blocking assertions

If a blocking test needs a pre-existing value to assert "unchanged", seed it as superuser first — not as authenticated:

```sql
-- ✅ Correct — seed as superuser, then try to overwrite as wrong user
RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', TRUE);
UPDATE public.profiles SET push_subscription = '{"endpoint":"https://alice.example.com"}' WHERE id = 'alice-id';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"bob-id","role":"authenticated"}', TRUE);
UPDATE public.profiles SET push_subscription = '{"endpoint":"https://hacked.example.com"}' WHERE id = 'alice-id';

RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', TRUE);
SELECT IS((SELECT push_subscription->>'endpoint' FROM profiles WHERE id = 'alice-id'), 'https://alice.example.com', 'Bob blocked');
```
