# `docs/BACKEND_PATTERNS.md` — Supabase & Deno Edge Function Patterns

Reference for **The Plumber**. Always verify against context7 before implementing — SDKs evolve.

---

## Supabase Type Generation (run once per schema change)

```bash
supabase gen types typescript --local > src/types/database.types.ts
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

// RPC (stored procedure)
const { data, error } = await supabase.rpc('snooze_plant_check', {
  p_plant_id: plantId,
  p_days: 5,
});
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

## Deno Edge Function — Full Structure

```ts
import { createClient }   from 'npm:@supabase/supabase-js@2';
import Anthropic           from 'npm:@anthropic-ai/sdk';
// Database type lives in src/types/ — import via relative path from supabase/functions/
import type { Database }  from '../../src/types/database.types.ts';

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

    // 5. Call Claude
    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system:     '...paste system prompt from docs/AI_PROMPT_MANIFEST.md...',
      messages:   [{ role: 'user', content: `${scientificName} / ${commonName}` }],
    });

    const raw    = msg.content[0].type === 'text' ? msg.content[0].text : '';
    const parsed = JSON.parse(raw);

    // Validate shape with a type guard before any DB write — never trust raw AI output
    if (!isValidEnrichmentPayload(parsed)) {
      return json({ error: 'AI returned invalid shape' }, 502);
    }

    // 6. Persist to cache
    await supabase.from('cached_botanical_records').insert(parsed);

    return json(parsed);

  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
```

---

## Claude JSON Validation — Type Guards

Never write AI output directly to the DB. Always validate first with a type guard:

```ts
// Define the expected shape (mirrors your JSON schema in AI_PROMPT_MANIFEST.md)
interface EnrichmentPayload {
  scientific_name:     string;
  common_name:         string;
  ideal_min_ph:        number;
  ideal_max_ph:        number;
  is_toxic_to_pets:    boolean;
  propagation_methods: string[];
  is_ai_enriched:      true;
}

function isValidEnrichmentPayload(v: unknown): v is EnrichmentPayload {
  if (typeof v !== 'object' || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.scientific_name  === 'string'  &&
    typeof p.common_name      === 'string'  &&
    typeof p.ideal_min_ph     === 'number'  &&
    typeof p.ideal_max_ph     === 'number'  &&
    typeof p.is_toxic_to_pets === 'boolean' &&
    Array.isArray(p.propagation_methods)    &&
    p.is_ai_enriched === true
  );
}
```

Write one guard per schema defined in `docs/AI_PROMPT_MANIFEST.md`. Keep guards next to their Edge Function.

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
