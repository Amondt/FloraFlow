# `docs/BACKEND_PATTERNS.md` — Supabase & Deno Edge Function Patterns

Reference for **The Plumber**. Always verify against context7 before implementing — SDKs evolve.

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
| Perenual returns empty or crashes | Hand off silently to AI Scribe — same code path | Nothing, enrichment proceeds |
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

---

## Perenual API Field Mapping

When the Edge Function receives a response from `/api/v2/species/details/[id]`, apply these mappings before writing to `cached_botanical_records`:

| Perenual field | Our column | Notes |
|---|---|---|
| `id` | `perenual_id` | Integer — store as-is |
| `scientific_name` | `scientific_name` | **Array of strings** — take `[0]` |
| `common_name` | `common_name` | String — store as-is |
| `poisonous_to_pets` | `is_toxic_to_pets` | Boolean — maps directly |
| `propagation` | `propagation_methods` | Array of strings — **values may not match our enum**; pass to AI Scribe for normalisation |
| `watering` | `watering` | String — store as-is |
| `sunlight` | `sunlight` | Array of strings — store as-is |
| `cycle` | `cycle` | String — store as-is |
| `type` | `plant_type` | String — rename: `type` is a SQL reserved word |

Fields **not** in Perenual (require AI Scribe enrichment): `ideal_min_ph`, `ideal_max_ph`, `toxicity_notes`.

**PlantNet returns identification data only** (`score`, `scientific_name`, `common_names`, `family`, `genus`). It never returns care metrics. Use PlantNet output solely to resolve a species name, then query Perenual with that name.

---

## Required Environment Variables

Create a `.env.local` file in the project root (never commit it). All secrets stay server-side — only the two `PUBLIC_` variables are safe to expose to the Angular client bundle.

| Variable | Where to find it | Used in |
|---|---|---|
| `SUPABASE_URL` | Supabase project Settings → API | Edge Functions (auto-injected by CLI) |
| `SUPABASE_ANON_KEY` | Supabase project Settings → API | Angular client (`environment.ts`) — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project Settings → API | Edge Functions only — **never in client** |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys | Edge Functions only — **never in client** |
| `PERENUAL_API_KEY` | perenual.com → Account → API Key | Edge Functions only — **never in client** |
| `RESEND_API_KEY` | resend.com → API Keys | Edge Functions only — **never in client** |

For local Supabase development, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected into Edge Functions by the CLI — you do not need to set them in `.env.local` for local dev. They are required in the Supabase dashboard Secrets panel for production deployments.
