-- Tracks whether the Perenual species/details call has been attempted for this record.
-- Mirrors the is_ai_enriched flag used by the claude-enrichment Edge Function.
-- Set to true after the Perenual species/details call completes, regardless of whether it returned data.
-- This prevents repeated details calls for plants where Perenual legitimately returns null fields.
ALTER TABLE public.cached_botanical_records
  ADD COLUMN IF NOT EXISTS is_perenual_enriched BOOLEAN NOT NULL DEFAULT FALSE;
