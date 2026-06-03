-- Phase 3.1 — AI Scribe extended enrichment columns
-- Adds four species-specific care fields populated exclusively by the
-- claude-enrichment Edge Function (never by Perenual or client writes).
-- All columns are nullable: Claude returns null rather than fabricating
-- values for species it cannot confidently characterise.
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS check_depth_description TEXT,
ADD COLUMN IF NOT EXISTS ideal_humidity_min INT,
ADD COLUMN IF NOT EXISTS ideal_humidity_max INT,
ADD COLUMN IF NOT EXISTS care_difficulty TEXT CHECK (
  care_difficulty IN ('Beginner', 'Intermediate', 'Advanced')
);

-- Reset the enrichment flag so existing records are re-enriched on their next
-- botanical-search hit. botanical-search's backfill loop only triggers for rows
-- where is_ai_enriched = false, so without this reset those rows would keep
-- null values for the new columns permanently.
UPDATE public.cached_botanical_records
SET
  is_ai_enriched = FALSE
WHERE
  is_ai_enriched = TRUE;
