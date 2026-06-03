-- Phase 3.2 — Add growth_stage_type ENUM and growth_stage column to plants
--
-- Every plant carries an explicit growth stage. A follow-on migration updates
-- the snooze_plant_check RPC to apply a multiplier based on this value:
-- Seedling × 0.5 (checks more often), Dormant × 2.0 (checks less often),
-- Juvenile / Mature × 1.0 (baseline unchanged).
--
-- Existing plants default to 'Mature' — no back-fill migration needed.
-- 'Seed' is intentionally excluded: seeds belong in seed_batches (Phase 3.5).

CREATE TYPE public.growth_stage_type AS ENUM (
  'Seedling',
  'Juvenile',
  'Mature',
  'Dormant'
);

ALTER TABLE public.plants
  ADD COLUMN growth_stage public.growth_stage_type
    DEFAULT 'Mature'::public.growth_stage_type
    NOT NULL;
