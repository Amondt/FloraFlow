-- Phase 3.11 — iNaturalist image URL columns on the botanical cache.
-- thumbnail_url: 75×75 square crop (default_photo.url from iNaturalist taxa endpoint).
-- regular_url:   ~500 px version (default_photo.medium_url) used in the detail dialog.
-- Both nullable — null means no iNaturalist match was found during enrichment.
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS regular_url TEXT;
