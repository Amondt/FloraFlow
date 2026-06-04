-- =====================================================================
-- FloraFlow — Populate: zones
-- User: 00000000-0000-0000-0000-000000000001 (FloraFlow Admin)
--
-- Dependency: none
-- Depended on by: populate_plants.sql
--
-- Clears and re-seeds 4 zones:
--   Living Room (indoor, South) | Bedroom (indoor, East)
--   South Balcony (outdoor)     | Kitchen Windowsill (indoor, West)
-- =====================================================================
BEGIN;

DELETE FROM public.zones
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO
  public.zones (
    id,
    user_id,
    name,
    icon,
    zone_type,
    window_orientation,
    has_active_ventilation,
    has_grow_lights,
    humidity_baseline
  )
VALUES
  -- South-facing living room — warm, bright indirect light
  (
    'aa000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Living Room',
    'ri-sofa-line',
    'indoor',
    'South',
    FALSE,
    FALSE,
    55
  ),
  -- East-facing bedroom — softer morning light, grow lights supplement
  (
    'aa000002-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Bedroom',
    'ri-moon-line',
    'indoor',
    'East',
    FALSE,
    TRUE,
    45
  ),
  -- Open south balcony — full outdoor exposure, naturally ventilated
  (
    'aa000003-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'South Balcony',
    'ri-sun-line',
    'outdoor',
    'South',
    TRUE,
    FALSE,
    65
  ),
  -- West kitchen windowsill — afternoon sun, small pots
  (
    'aa000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Kitchen Windowsill',
    'ri-plant-line',
    'indoor',
    'West',
    FALSE,
    FALSE,
    50
  );

COMMIT;
