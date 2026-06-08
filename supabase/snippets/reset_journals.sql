-- =====================================================================
-- FloraFlow — Populate: plant_journals
-- User: 00000000-0000-0000-0000-000000000001 (FloraFlow Admin)
--
-- Dependency: populate_plants.sql (plant UUIDs must exist)
--
-- Clears and re-seeds 10 journal entries across 6 plants:
--   Neon Pothos (2) | Peace Lily (2) | Spider Plant (2)
--   English Lavender (1) | Fiddle-Leaf Fig (2) | Aloe Vera (1, Leaf Doctor)
--
-- Category coverage: Watering | Observation | Fertilization | Repotting | Pruning | PestTreatment
-- Leaf Doctor: one Observation entry with diagnostics JSONB (tests badge + card rendering)
-- =====================================================================
BEGIN;

DELETE FROM public.plant_journals
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO
  public.plant_journals (
    id,
    plant_id,
    user_id,
    category,
    notes,
    diagnostics,
    logged_at
  )
VALUES
  -- Neon Pothos: watered 3 days ago (before it became overdue)
  (
    gen_random_uuid(),
    'bb000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Watering',
    'Soil was nearly bone dry — watered thoroughly until drainage ran clear. Looking healthy overall.',
    NULL,
    NOW() - INTERVAL '3 days'
  ),
  -- Neon Pothos: yellowing leaf noticed today
  (
    gen_random_uuid(),
    'bb000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    'One older leaf turning yellow at the base. Could be normal senescence or slight overwatering. Monitoring.',
    NULL,
    NOW() - INTERVAL '2 hours'
  ),
  -- Peace Lily: drooping before watering yesterday
  (
    gen_random_uuid(),
    'bb000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Watering',
    'Leaves starting to droop slightly — good indicator it needed water. Revived fully within an hour of watering.',
    NULL,
    NOW() - INTERVAL '1 day'
  ),
  -- Peace Lily: fertilizer applied 8 days ago
  (
    gen_random_uuid(),
    'bb000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Fertilization',
    'Applied half-strength balanced liquid fertilizer (20-20-20). Start of active growing season.',
    NULL,
    NOW() - INTERVAL '8 days'
  ),
  -- Spider Plant: new plantlets forming
  (
    gen_random_uuid(),
    'bb000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    'Three runners now producing plantlets — will propagate two into water propagation jars next week.',
    NULL,
    NOW() - INTERVAL '2 days'
  ),
  -- Spider Plant: repotted 3 weeks ago
  (
    gen_random_uuid(),
    'bb000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Repotting',
    'Moved up to a 14 cm plastic pot. Roots were tightly circling the base of the old container.',
    NULL,
    NOW() - INTERVAL '21 days'
  ),
  -- English Lavender: pruned after first flowering flush
  (
    gen_random_uuid(),
    'bb000008-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Pruning',
    'Light trim after the first flush of flowers faded. Cut back by roughly one third to encourage bushy regrowth.',
    NULL,
    NOW() - INTERVAL '6 days'
  ),
  -- Fiddle-Leaf Fig: new healthy leaf spotted
  (
    gen_random_uuid(),
    'bb000012-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    'New leaf unfurling — red-tinged new growth, very healthy looking. Growth spurt after recent fertilization.',
    NULL,
    NOW() - INTERVAL '1 day'
  ),
  -- Fiddle-Leaf Fig: spider mite treatment 10 days ago
  (
    gen_random_uuid(),
    'bb000012-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'PestTreatment',
    'Found early signs of spider mites (fine webbing on 2 leaves). Wiped all leaf surfaces with diluted neem oil solution.',
    NULL,
    NOW() - INTERVAL '10 days'
  ),
  -- Aloe Vera: Leaf Doctor diagnosis — tests diagnostics JSONB badge rendering
  -- systemic_risk_assessment = 'ZoneContagious' tests the amber warning badge
  (
    gen_random_uuid(),
    'bb000007-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    E'Leaf Doctor: Fungal leaf spot (Alternaria sp.)\nRemove affected leaves immediately.\nApply copper-based fungicide spray every 7 days for 3 weeks.\nImprove air circulation around the plant.',
    '{"primary_condition":"Fungal leaf spot (Alternaria sp.)","confidence_score":0.84,"immediate_remedial_actions":["Remove affected leaves immediately","Apply copper-based fungicide spray every 7 days for 3 weeks","Improve air circulation around the plant"],"systemic_risk_assessment":"ZoneContagious"}'::jsonb,
    NOW() - INTERVAL '4 days'
  );

COMMIT;
