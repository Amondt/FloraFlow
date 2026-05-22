-- Tracks whether the Perenual species/details call has been attempted for this record.
-- Mirrors the is_ai_enriched flag used by claude-enrichment (Block A).
-- Set to true after Block B completes, regardless of whether Perenual returned data.
-- This prevents repeated details calls for plants where Perenual legitimately returns null fields.
ALTER TABLE public.cached_botanical_records
  ADD COLUMN IF NOT EXISTS is_perenual_enriched BOOLEAN NOT NULL DEFAULT FALSE;
