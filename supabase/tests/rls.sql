-- FloraFlow — Phase 1 RLS Acceptance Test
-- Verifies that users cannot read or write data owned by other users.
-- Runs inside a rolled-back transaction — no data persists.
--
-- We skip inserting into auth.users because that table has many required
-- columns/triggers that differ across Supabase versions. Instead we use
-- SET session_replication_role = 'replica' to bypass the FK constraint
-- from profiles → auth.users, then restore it before inserting zones/plants
-- (which FK to profiles, which now exists). auth.uid() is driven entirely
-- by request.jwt.claims — no real auth row needed.

BEGIN;

SELECT plan(16);

-- ── SETUP ─────────────────────────────────────────────────────────────────
-- Disable FK triggers so we can insert profiles without auth.users rows.
SET session_replication_role = 'replica';

INSERT INTO public.profiles (id, display_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice'),
  ('22222222-2222-2222-2222-222222222222', 'Bob');

-- Re-enable FK triggers before inserting child rows.
SET session_replication_role = 'origin';

INSERT INTO public.zones (id, user_id, name, icon, window_orientation, has_active_ventilation, has_grow_lights, humidity_baseline)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111',
        'Alice Zone', 'ri-plant-line', 'South', false, false, 50);

INSERT INTO public.plants (id, user_id, zone_id, common_name)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alice Fern');

INSERT INTO public.plant_journals (id, plant_id, user_id, notes)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111', 'Looking healthy');

-- Synthetic test row for Phase 2.1 RLS tests — fake species name avoids PK
-- conflicts with any real Perenual data inserted during manual testing.
-- ON CONFLICT DO UPDATE ensures the row always has the expected values.
INSERT INTO public.cached_botanical_records (scientific_name, common_name, perenual_id)
VALUES ('Testus planticus pgTAP', 'Test Plant', 99999)
ON CONFLICT (scientific_name) DO UPDATE SET common_name = 'Test Plant', perenual_id = 99999;

-- ── AS ALICE — positive read access ────────────────────────────────────────

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.zones),
  1,
  'Alice sees her own zone'
);

SELECT is(
  (SELECT count(*)::int FROM public.plants),
  1,
  'Alice sees her own plant'
);

SELECT is(
  (SELECT count(*)::int FROM public.plant_journals),
  1,
  'Alice sees her own journal entry'
);

-- ── AS BOB — read isolation ─────────────────────────────────────────────────
-- Same authenticated role, different JWT sub → auth.uid() returns Bob's id.
-- Alice's rows must be invisible.

SELECT set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.zones),
  0,
  'Bob cannot see Alice''s zones'
);

SELECT is(
  (SELECT count(*)::int FROM public.plants),
  0,
  'Bob cannot see Alice''s plants'
);

SELECT is(
  (SELECT count(*)::int FROM public.plant_journals),
  0,
  'Bob cannot see Alice''s journal entries'
);

-- ── AS BOB — write isolation ────────────────────────────────────────────────
-- RLS USING clause filters out rows Bob does not own.
-- These statements execute silently but affect 0 rows.

UPDATE public.zones    SET name = 'Hacked by Bob' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DELETE FROM public.plants                          WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DELETE FROM public.plant_journals                  WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

-- ── BACK TO POSTGRES — verify writes were blocked ───────────────────────────

RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT name FROM public.zones WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Alice Zone',
  'Bob''s UPDATE on Alice''s zone was blocked — name unchanged'
);

SELECT is(
  (SELECT count(*)::int FROM public.plants WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'Bob''s DELETE on Alice''s plant was blocked — row still exists'
);

SELECT is(
  (SELECT count(*)::int FROM public.plant_journals WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1,
  'Bob''s DELETE on Alice''s journal entry was blocked — row still exists'
);

-- ── ANON ROLE — unauthenticated access ──────────────────────────────────────
-- auth.uid() returns NULL for anon; no rows satisfy USING (auth.uid() = user_id).

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT count(*)::int FROM public.zones),
  0,
  'Anon role cannot see any zones'
);

SELECT is(
  (SELECT count(*)::int FROM public.plants),
  0,
  'Anon role cannot see any plants'
);

RESET ROLE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 2.1 — cached_botanical_records RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- ── TEST 12: Authenticated SELECT succeeds ──────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.cached_botanical_records WHERE scientific_name = 'Testus planticus pgTAP'),
  1,
  'Authenticated user can SELECT from cached_botanical_records'
);

-- ── TEST 13: Anon SELECT is blocked ─────────────────────────────────────────
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT count(*)::int FROM public.cached_botanical_records WHERE scientific_name = 'Testus planticus pgTAP'),
  0,
  'Anon role cannot SELECT from cached_botanical_records'
);

-- ── TEST 14: Authenticated INSERT is blocked ─────────────────────────────────
-- WITH CHECK (false) raises an error — catch it inside DO/EXCEPTION so the
-- outer transaction is not aborted, then verify the fake row was not inserted.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

DO $$
BEGIN
  INSERT INTO public.cached_botanical_records (scientific_name, common_name)
  VALUES ('Testus attempticus pgTAP', 'Should Not Exist');
EXCEPTION WHEN others THEN
  NULL;
END;
$$;

SELECT is(
  (SELECT count(*)::int FROM public.cached_botanical_records WHERE scientific_name = 'Testus attempticus pgTAP'),
  0,
  'Authenticated INSERT into cached_botanical_records was blocked by RLS'
);

-- ── TEST 15: Authenticated UPDATE is blocked ─────────────────────────────────
-- USING (false) makes the row invisible — UPDATE silently affects 0 rows.
UPDATE public.cached_botanical_records SET common_name = 'Hacked' WHERE scientific_name = 'Testus planticus pgTAP';

RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT common_name FROM public.cached_botanical_records WHERE scientific_name = 'Testus planticus pgTAP'),
  'Test Plant',
  'Authenticated UPDATE on cached_botanical_records was blocked — value unchanged'
);

-- ── TEST 16: Authenticated DELETE is blocked ─────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);

DELETE FROM public.cached_botanical_records WHERE scientific_name = 'Testus planticus pgTAP';

RESET ROLE;
SELECT set_config('request.jwt.claims', '{}', true);

SELECT is(
  (SELECT count(*)::int FROM public.cached_botanical_records WHERE scientific_name = 'Testus planticus pgTAP'),
  1,
  'Authenticated DELETE on cached_botanical_records was blocked — row still exists'
);

SELECT * FROM finish();

ROLLBACK;
