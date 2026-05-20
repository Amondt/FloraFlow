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

SELECT plan(11);

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

SELECT * FROM finish();

ROLLBACK;
