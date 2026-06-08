-- =====================================================================
-- FloraFlow — Populate: plants
-- User: 00000000-0000-0000-0000-000000000001 (FloraFlow Admin)
--
-- Dependency: populate_zones.sql (zone UUIDs must exist)
-- Depended on by: populate_journals.sql
--
-- Clears and re-seeds 12 plants across 4 zones.
--
-- Coverage matrix:
--   Urgency:    OVERDUE (3) | DUE TODAY (2) | DUE THIS WEEK (3) | UPCOMING (4)
--   Enrichment: AI-enriched (7) | iNat-linked, not AI-enriched (2) | Unenriched (3)
--   Stage:      Seedling (2) | Juvenile (2) | Mature (7) | Dormant (1)
-- =====================================================================
BEGIN;

DELETE FROM public.plants
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO
  public.plants (
    id,
    user_id,
    zone_id,
    common_name,
    scientific_name,
    inat_taxon_id,
    container_vector,
    substrate_factor,
    growth_stage,
    last_checked_at,
    next_check_due_at,
    current_snooze_interval_days
  )
VALUES
  -- ═══ LIVING ROOM ═════════════════════════════════════════════════
  -- iNat-linked | Mature | OVERDUE 5 days
  -- Neon Pothos is a cultivar; iNaturalist records at species level only.
  -- Uses 'Epipremnum aureum' (same species as Golden Pothos, different pot + zone).
  (
    'bb000001-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000001-0000-0000-0000-000000000001'::uuid,
    'Neon Pothos',
    'Epipremnum aureum',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Epipremnum aureum'
      LIMIT
        1
    ),
    'Plastic',
    'High-Drainage Aroid',
    'Mature',
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '5 days',
    3
  ),
  -- AI-enriched | Dormant | Due this week (+4 days)
  (
    'bb000002-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000001-0000-0000-0000-000000000001'::uuid,
    'Snake Plant',
    'Sansevieria trifasciata',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Sansevieria trifasciata'
      LIMIT
        1
    ),
    'Ceramic',
    'Desert Succulent',
    'Dormant',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '4 days',
    7
  ),
  -- Unenriched | Juvenile | Upcoming (+12 days)
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
  (
    'bb000004-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000002-0000-0000-0000-000000000001'::uuid,
    'Peace Lily',
    'Spathiphyllum wallisii',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Spathiphyllum wallisii'
      LIMIT
        1
    ),
    'Ceramic',
    'Heavy Peat',
    'Mature',
    NOW() - INTERVAL '6 days',
    NOW(),
    6
  ),
  -- AI-enriched | Seedling | OVERDUE 3 days
  (
    'bb000005-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000002-0000-0000-0000-000000000001'::uuid,
    'Spider Plant',
    'Chlorophytum comosum',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Chlorophytum comosum'
      LIMIT
        1
    ),
    'Plastic',
    'Standard Potting',
    'Seedling',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '3 days',
    2
  ),
  -- iNat-linked | Mature | Upcoming (+10 days)
  -- Satin Pothos (Argyraeus) is a cultivar; iNaturalist records at species level only.
  (
    'bb000006-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000002-0000-0000-0000-000000000001'::uuid,
    'Satin Pothos',
    'Scindapsus pictus',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Scindapsus pictus'
      LIMIT
        1
    ),
    'Self-Watering',
    'Standard Potting',
    'Mature',
    NOW() - INTERVAL '4 days',
    NOW() + INTERVAL '10 days',
    7
  ),
  -- ═══ SOUTH BALCONY ═══════════════════════════════════════════════
  -- AI-enriched | Mature | Due this week (+3 days)
  (
    'bb000007-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000003-0000-0000-0000-000000000001'::uuid,
    'Aloe Vera',
    'Aloe vera',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Aloe vera'
      LIMIT
        1
    ),
    'Terracotta',
    'Desert Succulent',
    'Mature',
    NOW() - INTERVAL '11 days',
    NOW() + INTERVAL '3 days',
    14
  ),
  -- AI-enriched | Mature | OVERDUE 7 days
  (
    'bb000008-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000003-0000-0000-0000-000000000001'::uuid,
    'English Lavender',
    'Lavandula angustifolia',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Lavandula angustifolia'
      LIMIT
        1
    ),
    'Ground',
    'Standard Potting',
    'Mature',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '7 days',
    5
  ),
  -- iNat-linked, not AI-enriched | Dormant | Upcoming (+15 days)
  -- Tests: inat_taxon_id set, cache row exists, is_ai_enriched = false, Dormant+long snooze
  (
    'bb000009-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000003-0000-0000-0000-000000000001'::uuid,
    'Desert Rose',
    'Adenium obesum',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Adenium obesum'
      LIMIT
        1
    ),
    'Terracotta',
    'Desert Succulent',
    'Dormant',
    NOW() - INTERVAL '10 days',
    NOW() + INTERVAL '15 days',
    14
  ),
  -- ═══ KITCHEN WINDOWSILL ══════════════════════════════════════════
  -- iNat-linked, not AI-enriched | Juvenile | DUE TODAY
  -- Tests: inat_taxon_id set, cache row exists, is_ai_enriched = false, Juvenile stage
  (
    'bb000010-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000004-0000-0000-0000-000000000001'::uuid,
    'Golden Pothos',
    'Epipremnum aureum',
    (
      SELECT
        inat_taxon_id
      FROM
        public.cached_botanical_records
      WHERE
        scientific_name = 'Epipremnum aureum'
      LIMIT
        1
    ),
    'Plastic',
    'Standard Potting',
    'Juvenile',
    NOW() - INTERVAL '5 days',
    NOW(),
    5
  ),
  -- Unenriched | Seedling | Due this week (+2 days)
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
  -- Unenriched | Mature | Upcoming (+20 days)
  -- Truly unenriched: no scientific_name, no inat_taxon_id — tests the no-species-data path.
  (
    'bb000012-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000001',
    'aa000004-0000-0000-0000-000000000001'::uuid,
    'Fiddle-Leaf Fig',
    NULL,
    NULL,
    'Terracotta',
    'Standard Potting',
    'Mature',
    NOW() - INTERVAL '5 days',
    NOW() + INTERVAL '20 days',
    5
  );

COMMIT;
