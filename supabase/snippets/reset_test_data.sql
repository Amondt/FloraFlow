-- =====================================================================
-- FloraFlow Test Data Reset
-- User: 00000000-0000-0000-0000-000000000001 (FloraFlow Admin)
--
-- Preserves: cached_botanical_records (DO NOT TOUCH)
-- Clears:    plant_journals, plants, zones, seed_batches
-- Re-seeds:  4 zones, 12 plants, 9 journal entries, 8 seed batches
--
-- Coverage matrix:
--   Urgency:    OVERDUE (3) | DUE TODAY (2) | DUE THIS WEEK (3) | UPCOMING (4)
--   Enrichment: AI-enriched (7) | Perenual-only (2) | Unenriched (3)
--   Stage:      Seedling (2) | Juvenile (2) | Mature (7) | Dormant (1)
--   Zone type:  indoor (3) | outdoor (1)
--   Seed stage: Stored (2) | Sown Indoors (2) | Germinated (1) | Potted Up (1) | Hardened Off (1) | Transplanted Outside (1)
-- =====================================================================
BEGIN;

-- ── 1. Clear existing user data ──────────────────────────────────────
-- Order matters: journals → plants → zones (FK cascade order)
DELETE FROM public.plant_journals
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.plants
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.zones
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

DELETE FROM public.seed_batches
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

-- ── 2. Zones ──────────────────────────────────────────────────────────
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

-- ── 3. Plants ─────────────────────────────────────────────────────────
--
-- Enrichment key:
--   AI-enriched    → scientific_name matches cached_botanical_records with is_ai_enriched = true
--   Perenual-only  → perenual_id set, but cache row has is_ai_enriched = false
--   Unenriched     → no scientific_name, no perenual_id (app-only label)
INSERT INTO
  public.plants (
    id,
    user_id,
    zone_id,
    common_name,
    scientific_name,
    perenual_id,
    container_vector,
    substrate_factor,
    growth_stage,
    last_checked_at,
    next_check_due_at,
    current_snooze_interval_days
  )
VALUES
  -- ═══ LIVING ROOM ═════════════════════════════════════════════════
  -- AI-enriched | Mature | OVERDUE 5 days
  -- Tests: enriched plant in OVERDUE bucket, care panel fully populated
  (
    'bb000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000001-0000-0000-0000-000000000001'::uuid,
    'Neon Pothos',
    'Epipremnum aureum ''Neon''',
    2774,
    'Plastic',
    'High-Drainage Aroid',
    'Mature',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '5 days',
    3
  ),
  -- AI-enriched | Dormant | Due this week (+4 days)
  -- Tests: Dormant stage multiplier, no perenual_id (AI-only enrichment)
  (
    'bb000002-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000001-0000-0000-0000-000000000001'::uuid,
    'Snake Plant',
    'Sansevieria trifasciata',
    NULL,
    'Ceramic',
    'Desert Succulent',
    'Dormant',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '4 days',
    7
  ),
  -- Unenriched | Juvenile | Upcoming (+12 days)
  -- Tests: plant with no scientific_name → no cache lookup, no care panel data
  (
    'bb000003-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000001-0000-0000-0000-000000000001'::uuid,
    'Rubber Plant',
    NULL,
    NULL,
    'Terracotta',
    'Standard Potting',
    'Juvenile',
    NOW() - INTERVAL '2 days',
    NOW() + INTERVAL '12 days',
    5
  ),
  -- ═══ BEDROOM ═════════════════════════════════════════════════════
  -- AI-enriched | Mature | DUE TODAY
  -- Tests: enriched plant in DUE TODAY bucket, heavy peat substrate
  (
    'bb000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000002-0000-0000-0000-000000000001'::uuid,
    'Peace Lily',
    'Spathiphyllum wallisii',
    NULL,
    'Ceramic',
    'Heavy Peat',
    'Mature',
    NOW() - INTERVAL '6 days',
    NOW(),
    6
  ),
  -- AI-enriched | Seedling | OVERDUE 3 days
  -- Tests: Seedling stage multiplier, overdue enriched plant
  (
    'bb000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000002-0000-0000-0000-000000000001'::uuid,
    'Spider Plant',
    'Chlorophytum comosum',
    NULL,
    'Plastic',
    'Standard Potting',
    'Seedling',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 days',
    2
  ),
  -- AI-enriched | Mature | Upcoming (+10 days)
  -- Tests: Self-Watering container, perenual_id + ai_enriched both true
  (
    'bb000006-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000002-0000-0000-0000-000000000001'::uuid,
    'Satin Pothos',
    'Scindapsus pictus ''Argyraeus''',
    7276,
    'Self-Watering',
    'Standard Potting',
    'Mature',
    NOW() - INTERVAL '4 days',
    NOW() + INTERVAL '10 days',
    7
  ),
  -- ═══ SOUTH BALCONY ═══════════════════════════════════════════════
  -- AI-enriched | Mature | Due this week (+3 days)
  -- Tests: outdoor zone, desert succulent substrate, long snooze interval
  (
    'bb000007-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000003-0000-0000-0000-000000000001'::uuid,
    'Aloe Vera',
    'Aloe vera',
    NULL,
    'Terracotta',
    'Desert Succulent',
    'Mature',
    NOW() - INTERVAL '11 days',
    NOW() + INTERVAL '3 days',
    14
  ),
  -- AI-enriched | Mature | OVERDUE 7 days
  -- Tests: Ground container, outdoor zone, longest-overdue plant
  (
    'bb000008-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000003-0000-0000-0000-000000000001'::uuid,
    'English Lavender',
    'Lavandula angustifolia',
    NULL,
    'Ground',
    'Standard Potting',
    'Mature',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '7 days',
    5
  ),
  -- Perenual-only (not AI-enriched) | Dormant | Upcoming (+15 days)
  -- Tests: perenual_id=540 in cache but is_ai_enriched=false, Dormant+long snooze
  (
    'bb000009-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000003-0000-0000-0000-000000000001'::uuid,
    'Desert Rose',
    'Adenium obesum',
    540,
    'Terracotta',
    'Desert Succulent',
    'Dormant',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '15 days',
    14
  ),
  -- ═══ KITCHEN WINDOWSILL ══════════════════════════════════════════
  -- Perenual-only (not AI-enriched) | Juvenile | DUE TODAY
  -- Tests: perenual_id=2773 in cache but is_ai_enriched=false, Juvenile stage
  (
    'bb000010-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000004-0000-0000-0000-000000000001'::uuid,
    'Golden Pothos',
    'Epipremnum aureum',
    2773,
    'Plastic',
    'Standard Potting',
    'Juvenile',
    NOW() - INTERVAL '5 days',
    NOW(),
    5
  ),
  -- Unenriched | Seedling | Due this week (+2 days)
  -- Tests: completely unenriched, Seedling growth stage, Terracotta/Desert Succulent
  (
    'bb000011-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000004-0000-0000-0000-000000000001'::uuid,
    'Cactus Mix',
    NULL,
    NULL,
    'Terracotta',
    'Desert Succulent',
    'Seedling',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '2 days',
    14
  ),
  -- Unenriched (scientific_name in cache but is_ai_enriched=false) | Mature | Upcoming (+20 days)
  -- Tests: scientific_name present but no AI enrichment, longest upcoming plant
  (
    'bb000012-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000004-0000-0000-0000-000000000001'::uuid,
    'Fiddle-Leaf Fig',
    'Ficus lyrata',
    NULL,
    'Terracotta',
    'Standard Potting',
    'Mature',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '20 days',
    5
  );

-- ── 4. Journal entries ────────────────────────────────────────────────
INSERT INTO
  public.plant_journals (id, plant_id, user_id, category, notes, logged_at)
VALUES
  -- Neon Pothos: watered 3 days ago (before it became overdue)
  (
    gen_random_uuid(),
    'bb000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Watering',
    'Soil was nearly bone dry — watered thoroughly until drainage ran clear. Looking healthy overall.',
    NOW() - INTERVAL '3 days'
  ),
  -- Neon Pothos: yellowing leaf noticed today
  (
    gen_random_uuid(),
    'bb000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    'One older leaf turning yellow at the base. Could be normal senescence or slight overwatering. Monitoring.',
    NOW() - INTERVAL '2 hours'
  ),
  -- Peace Lily: drooping before watering yesterday
  (
    gen_random_uuid(),
    'bb000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Watering',
    'Leaves starting to droop slightly — good indicator it needed water. Revived fully within an hour of watering.',
    NOW() - INTERVAL '1 day'
  ),
  -- Peace Lily: fertilizer applied 8 days ago
  (
    gen_random_uuid(),
    'bb000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Fertilization',
    'Applied half-strength balanced liquid fertilizer (20-20-20). Start of active growing season.',
    NOW() - INTERVAL '8 days'
  ),
  -- Spider Plant: new plantlets forming
  (
    gen_random_uuid(),
    'bb000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    'Three runners now producing plantlets — will propagate two into water propagation jars next week.',
    NOW() - INTERVAL '2 days'
  ),
  -- Spider Plant: repotted 3 weeks ago
  (
    gen_random_uuid(),
    'bb000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Repotting',
    'Moved up to a 14 cm plastic pot. Roots were tightly circling the base of the old container.',
    NOW() - INTERVAL '21 days'
  ),
  -- English Lavender: pruned after first flowering flush
  (
    gen_random_uuid(),
    'bb000008-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Pruning',
    'Light trim after the first flush of flowers faded. Cut back by roughly one third to encourage bushy regrowth.',
    NOW() - INTERVAL '6 days'
  ),
  -- Fiddle-Leaf Fig: new healthy leaf spotted
  (
    gen_random_uuid(),
    'bb000012-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Observation',
    'New leaf unfurling — red-tinged new growth, very healthy looking. Growth spurt after recent fertilization.',
    NOW() - INTERVAL '1 day'
  ),
  -- Fiddle-Leaf Fig: spider mite treatment 10 days ago
  (
    gen_random_uuid(),
    'bb000012-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'PestTreatment',
    'Found early signs of spider mites (fine webbing on 2 leaves). Wiped all leaf surfaces with diluted neem oil solution.',
    NOW() - INTERVAL '10 days'
  );

-- ── 5. Seed batches ───────────────────────────────────────────────────
--
-- Coverage axes:
--   Stage:         all 6 ENUM values (one batch per stage, two at Stored/Sown Indoors for variety)
--   Optional text: brand (4/8) | packet_year (5/8) | scientific_name (5/8) | notes (6/8)
--   Timestamps:    sown_at NULL for Stored; germinated_at NULL for Stored+Sown Indoors; both set for Germinated+
--   Graduate CTA:  visible on Potted Up, Hardened Off, Transplanted Outside batches
--   Advance btn:   hidden only on Transplanted Outside (terminal)
INSERT INTO
  public.seed_batches (
    id,
    user_id,
    common_name,
    scientific_name,
    brand,
    packet_year,
    current_stage,
    sown_at,
    germinated_at,
    notes
  )
VALUES
  -- ── Stored (1/2) — full optional fields, waiting to sow ──────────────
  -- Tests: brand + packet_year + scientific_name, both timestamps NULL, no notes
  (
    'cc000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Sunflower',
    'Helianthus annuus',
    'Mr. Fothergill''s',
    2026,
    'Stored',
    NULL,
    NULL,
    NULL
  ),
  -- ── Stored (2/2) — minimal fields, saved seeds ───────────────────────
  -- Tests: no brand, no packet_year, no scientific_name, notes only (real-world saved-seed scenario)
  (
    'cc000002-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Mint',
    NULL,
    NULL,
    NULL,
    'Stored',
    NULL,
    NULL,
    'Saved from last year''s harvest. Should still be viable — stored in a cool dry tin.'
  ),
  -- ── Sown Indoors (1/2) — full fields, under grow lights ─────────────
  -- Tests: sown_at set, germinated_at still NULL, all optional fields present
  (
    'cc000003-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Tomato ''Gardener''s Delight''',
    'Solanum lycopersicum',
    'Suttons',
    2025,
    'Sown Indoors',
    NOW() - INTERVAL '21 days',
    NULL,
    'Sown in seed tray under grow lights at 18°C. Covering with propagator lid to retain humidity.'
  ),
  -- ── Sown Indoors (2/2) — no brand, sown recently ────────────────────
  -- Tests: scientific_name + packet_year, no brand, no notes, very recent sown_at
  (
    'cc000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Sweet Basil',
    'Ocimum basilicum',
    NULL,
    2026,
    'Sown Indoors',
    NOW() - INTERVAL '10 days',
    NULL,
    NULL
  ),
  -- ── Germinated — both timestamps set, fast germinator ───────────────
  -- Tests: sown_at + germinated_at both present, brand present, notes describe germination speed
  (
    'cc000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Courgette',
    'Cucurbita pepo',
    'Thompson & Morgan',
    2026,
    'Germinated',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '24 days',
    'Germinated in just 4 days — very vigorous. Thinned to one seedling per cell.'
  ),
  -- ── Potted Up — Graduate CTA visible, no brand or packet year ────────
  -- Tests: Potted Up stage, canGraduate() = true, no brand/year (unsourced seeds)
  (
    'cc000006-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'French Marigold',
    'Tagetes patula',
    NULL,
    NULL,
    'Potted Up',
    NOW() - INTERVAL '42 days',
    NOW() - INTERVAL '35 days',
    'Pricked out the three strongest seedlings. Discarded four leggy ones. Potted into 9 cm modules.'
  ),
  -- ── Hardened Off — long lifecycle, heritage variety ─────────────────
  -- Tests: Hardened Off stage, canGraduate() = true, long timestamp span, all fields populated
  (
    'cc000007-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Sweet Pea ''Cupani''',
    'Lathyrus odoratus',
    'Sarah Raven',
    2025,
    'Hardened Off',
    NOW() - INTERVAL '70 days',
    NOW() - INTERVAL '56 days',
    'Pinched out tips at 15 cm to encourage side shoots. Moving outside for 2–3 hours daily to harden off.'
  ),
  -- ── Transplanted Outside — terminal stage, no notes ──────────────────
  -- Tests: terminal stage (no Advance btn), canGraduate() = true, no notes, minimal optional fields
  (
    'cc000008-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'Cosmos',
    'Cosmos bipinnatus',
    NULL,
    2026,
    'Transplanted Outside',
    NOW() - INTERVAL '84 days',
    NOW() - INTERVAL '70 days',
    NULL
  );

COMMIT;
