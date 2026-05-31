-- Development seed: 10 diverse species covering all filter dimensions.
-- Use while Perenual API quota is exhausted (HTTP 429).
-- Run from: Supabase Dashboard → SQL Editor (http://localhost:54323)
-- The dashboard runs as postgres superuser, which bypasses the RLS
-- write-block on cached_botanical_records. Do not run from the Angular client.
--
-- perenual_id is NULL intentionally — the real IDs will be populated
-- automatically by the botanical-search Edge Function once the Perenual
-- monthly quota resets and a search triggers a cache miss.
-- is_ai_enriched = true prevents the claude-enrichment function from
-- making a redundant API call for these records.
INSERT INTO
  public.cached_botanical_records (
    scientific_name,
    common_name,
    watering,
    sunlight,
    cycle,
    plant_type,
    is_toxic_to_pets,
    toxicity_notes,
    ideal_min_ph,
    ideal_max_ph,
    propagation_methods,
    is_perenual_enriched,
    is_ai_enriched
  )
VALUES
  (
    'Caladium bicolor',
    'Heart of Jesus',
    'Frequent',
    ARRAY['part_shade', 'full_shade'],
    'Perennial',
    'Bulb',
    TRUE,
    'Calcium oxalate crystals — oral and gastric irritation in cats and dogs',
    5.5,
    6.5,
    ARRAY['Division', 'Stem Cuttings'],
    FALSE,
    TRUE
  ),
  (
    'Monstera deliciosa',
    'Swiss Cheese Plant',
    'Average',
    ARRAY['part_shade'],
    'Perennial',
    'Herbaceous Perennial',
    TRUE,
    'Insoluble calcium oxalates — excessive drooling and oral irritation',
    5.5,
    7.0,
    ARRAY['Stem Cuttings', 'Air Layering', 'Division'],
    FALSE,
    TRUE
  ),
  (
    'Sansevieria trifasciata',
    'Snake Plant',
    'Minimum',
    ARRAY['full_sun', 'part_shade', 'full_shade'],
    'Perennial',
    'Herbaceous Perennial',
    TRUE,
    'Saponins — nausea and vomiting in cats and dogs',
    5.5,
    7.5,
    ARRAY['Division', 'Leaf Cuttings', 'Offset Separation'],
    FALSE,
    TRUE
  ),
  (
    'Epipremnum aureum',
    'Golden Pothos',
    'Average',
    ARRAY['part_shade', 'full_shade'],
    'Perennial',
    'Vine',
    TRUE,
    'Calcium oxalate crystals — oral and gastric irritation',
    6.0,
    6.5,
    ARRAY['Stem Cuttings', 'Division'],
    FALSE,
    TRUE
  ),
  (
    'Lavandula angustifolia',
    'English Lavender',
    'Minimum',
    ARRAY['full_sun'],
    'Perennial',
    'Herbaceous Perennial',
    FALSE,
    NULL,
    6.5,
    7.5,
    ARRAY['Seeds', 'Stem Cuttings', 'Division'],
    FALSE,
    TRUE
  ),
  (
    'Spathiphyllum wallisii',
    'Peace Lily',
    'Frequent',
    ARRAY['part_shade', 'full_shade'],
    'Perennial',
    'Herbaceous Perennial',
    TRUE,
    'Calcium oxalate crystals — toxic to cats and dogs',
    5.8,
    6.5,
    ARRAY['Division'],
    FALSE,
    TRUE
  ),
  (
    'Chlorophytum comosum',
    'Spider Plant',
    'Average',
    ARRAY['part_shade'],
    'Perennial',
    'Herbaceous Perennial',
    FALSE,
    NULL,
    6.0,
    7.0,
    ARRAY['Division', 'Offset Separation', 'Seeds'],
    FALSE,
    TRUE
  ),
  (
    'Aloe vera',
    'Aloe Vera',
    'Minimum',
    ARRAY['full_sun', 'part_shade'],
    'Perennial',
    'Succulent',
    TRUE,
    'Saponins and anthraquinones — vomiting and diarrhoea in pets',
    7.0,
    8.5,
    ARRAY['Offset Separation', 'Division'],
    FALSE,
    TRUE
  ),
  (
    'Helianthus annuus',
    'Common Sunflower',
    'Average',
    ARRAY['full_sun'],
    'Annual',
    'Annual',
    FALSE,
    NULL,
    6.0,
    7.5,
    ARRAY['Seeds'],
    FALSE,
    TRUE
  ),
  (
    'Ficus lyrata',
    'Fiddle-Leaf Fig',
    'Average',
    ARRAY['full_sun', 'part_shade'],
    'Perennial',
    'Tree',
    TRUE,
    'Proteolytic enzyme in sap — skin and oral irritation',
    6.0,
    7.0,
    ARRAY['Stem Cuttings', 'Air Layering'],
    FALSE,
    TRUE
  )
ON CONFLICT (scientific_name) DO NOTHING;
