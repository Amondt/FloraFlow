-- Phase 3.10 — Extended Plant Profile
-- 16 new columns on cached_botanical_records, all filled by the AI Scribe.
-- All nullable (or have a DEFAULT) — no backfill needed, no existing rows break.
-- RLS is unchanged: existing SELECT policy covers the new columns automatically.
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS placement TEXT CHECK (placement IN ('Indoor', 'Outdoor', 'Both')),
ADD COLUMN IF NOT EXISTS is_tropical BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_toxic_to_humans BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS human_toxicity_notes TEXT,
ADD COLUMN IF NOT EXISTS produces_fruit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fruit_season TEXT,
ADD COLUMN IF NOT EXISTS produces_flowers BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS flowering_season TEXT,
ADD COLUMN IF NOT EXISTS growth_rate TEXT CHECK (growth_rate IN ('Slow', 'Moderate', 'Fast')),
ADD COLUMN IF NOT EXISTS maintenance_level TEXT CHECK (maintenance_level IN ('Low', 'Medium', 'High')),
ADD COLUMN IF NOT EXISTS preferred_soil_type TEXT[],
ADD COLUMN IF NOT EXISTS native_region TEXT,
ADD COLUMN IF NOT EXISTS max_height_cm INT,
ADD COLUMN IF NOT EXISTS max_spread_cm INT,
ADD COLUMN IF NOT EXISTS air_purifying BOOLEAN DEFAULT FALSE;
