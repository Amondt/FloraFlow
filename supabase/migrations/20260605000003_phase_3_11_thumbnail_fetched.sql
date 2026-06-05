-- Phase 3.11 — sentinel column to track whether the iNaturalist fetch has been attempted.
-- thumbnail_fetched = FALSE: fetch not yet attempted (default for all existing rows).
-- thumbnail_fetched = TRUE:  fetch completed; thumbnail_url may be null if no match was found.
-- Without this flag the client cannot distinguish "never tried" from "tried, no iNat match",
-- causing an infinite re-enrich loop for species absent from iNaturalist.
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS thumbnail_fetched BOOLEAN NOT NULL DEFAULT FALSE;

-- Rows that already have a thumbnail URL have been fetched successfully — mark them done
-- so they are not re-queued on the next library search.
UPDATE public.cached_botanical_records
SET
  thumbnail_fetched = TRUE
WHERE
  thumbnail_url IS NOT NULL;
