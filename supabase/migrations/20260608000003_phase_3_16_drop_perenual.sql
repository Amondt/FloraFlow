-- Phase 3.16 — Drop Perenual columns from both tables now that inat_taxon_id
-- is the sole species link on plants and the canonical identity on cached_botanical_records.
-- The frontend stopped selecting plants.perenual_id in Block M, so this drop is safe.
-- cached_botanical_records: remove legacy Perenual fields
ALTER TABLE public.cached_botanical_records
DROP COLUMN IF EXISTS perenual_id;

ALTER TABLE public.cached_botanical_records
DROP COLUMN IF EXISTS is_perenual_enriched;

-- Remove the index that was built on perenual_id
DROP INDEX IF EXISTS public.idx_botanical_cache_id;

-- plants: remove the Perenual species link column
-- inat_taxon_id (added in 20260608000001) is now the sole species link
ALTER TABLE public.plants
DROP COLUMN IF EXISTS perenual_id;
