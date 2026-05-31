-- ============================================================
-- FloraFlow — Dev Seed (zones + plants)
-- Run in: Supabase Studio → SQL Editor AFTER the auth user exists
--
-- Full reset process after `bunx supabase db reset`:
--   1. Run the PowerShell command in seed_dev_auth.ps1 to create
--      the auth user via the GoTrue admin API
--   2. Run this SQL to seed zones and plants
--
-- Login: admin@floraflow.dev / admin
-- ============================================================
DO $$
DECLARE
  v_user_id  UUID := '00000000-0000-0000-0000-000000000001';
  v_zone1_id UUID := '00000000-0000-0000-0000-000000000010';
  v_zone2_id UUID := '00000000-0000-0000-0000-000000000020';
  v_zone3_id UUID := '00000000-0000-0000-0000-000000000030';
BEGIN

  -- ── 1. Zones ────────────────────────────────────────────────
  INSERT INTO public.zones (id, user_id, name, icon, window_orientation, has_active_ventilation, has_grow_lights, humidity_baseline)
  VALUES
    (v_zone1_id, v_user_id, 'Living Room',    'ri-sofa-line',  'South', false, false, 45),
    (v_zone2_id, v_user_id, 'Kitchen Window', 'ri-sun-line',   'East',  false, false, 55),
    (v_zone3_id, v_user_id, 'South Balcony',  'ri-plant-line', 'South', true,  false, 40)
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Plants ───────────────────────────────────────────────
  -- next_check_due_at covers all four scheduler urgency groups:
  -- Overdue / Due today / Due this week / Upcoming

  INSERT INTO public.plants (
    user_id, zone_id, common_name, scientific_name,
    container_vector, substrate_factor,
    next_check_due_at, current_snooze_interval_days
  ) VALUES
    -- Overdue
    (v_user_id, v_zone1_id, 'Monstera',      'Monstera deliciosa',    'Terracotta', 'High-Drainage Aroid', NOW() - INTERVAL '4 days',  5),
    (v_user_id, v_zone1_id, 'Pothos',         'Epipremnum aureum',     'Plastic',    'Standard Potting',    NOW() - INTERVAL '2 days',  5),
    -- Due today
    (v_user_id, v_zone2_id, 'Peace Lily',     'Spathiphyllum wallisii','Ceramic',    'Heavy Peat',          NOW(),                      7),
    -- Due this week
    (v_user_id, v_zone2_id, 'Spider Plant',   'Chlorophytum comosum',  'Plastic',    'Standard Potting',    NOW() + INTERVAL '2 days',  5),
    (v_user_id, v_zone3_id, 'Aloe Vera',      'Aloe barbadensis',      'Terracotta', 'Desert Succulent',    NOW() + INTERVAL '4 days',  3),
    -- Upcoming
    (v_user_id, v_zone1_id, 'ZZ Plant',       'Zamioculcas zamiifolia','Ceramic',    'High-Drainage Aroid', NOW() + INTERVAL '9 days',  7),
    (v_user_id, v_zone3_id, 'Cactus Mix',     NULL,                    'Terracotta', 'Desert Succulent',    NOW() + INTERVAL '12 days', 7),
    (v_user_id, v_zone2_id, 'Orchid',         'Phalaenopsis amabilis', 'Plastic',    'Sphagnum Moss Mix',   NOW() + INTERVAL '14 days', 7);

END $$;
