-- =====================================================================
-- FloraFlow — Populate: seed_batches
-- User: 00000000-0000-0000-0000-000000000001 (FloraFlow Admin)
--
-- Dependency: none (no FK to zones or plants)
--
-- Clears and re-seeds 8 batches — one per stage enum value plus
-- a second Stored and a second Sown Indoors for variety coverage.
--
-- Coverage matrix:
--   Stage:         Stored (2) | Sown Indoors (2) | Germinated (1)
--                  Potted Up (1) | Hardened Off (1) | Transplanted Outside (1)
--   Optional text: brand (4/8) | packet_year (5/8) | scientific_name (5/8) | notes (6/8)
--   Graduate CTA:  visible on Potted Up, Hardened Off, Transplanted Outside
--   Advance btn:   hidden only on Transplanted Outside (terminal stage)
-- =====================================================================
BEGIN;

DELETE FROM public.seed_batches
WHERE
  user_id = '00000000-0000-0000-0000-000000000001';

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
  -- brand + packet_year + scientific_name; both timestamps NULL; no notes
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
  -- no brand, no packet_year, no scientific_name; notes only
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
  -- sown_at set; germinated_at still NULL; all optional fields present
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
  -- scientific_name + packet_year; no brand; no notes; very recent sown_at
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
  -- sown_at + germinated_at both present; brand present; notes describe speed
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
  -- ── Potted Up — Graduate CTA visible; no brand or packet year ─────────
  -- canGraduate() = true; unsourced seeds scenario
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
  -- canGraduate() = true; long timestamp span; all fields populated
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
  -- ── Transplanted Outside — terminal stage; no notes ──────────────────
  -- no Advance button; canGraduate() = true; minimal optional fields
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
