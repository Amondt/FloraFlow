-- Add inat_species_id and inat_rank to cached_botanical_records (Phase 3.16 Block G)
--
-- inat_species_id: species-rank ancestor of the leaf taxon — grouping key.
--   Computed from rank_level + parent_id in the iNat API response; no extra call needed.
--   Rule: rank_level=10 (species/hybrid) → self id; <10 (subspecies/variety/form) → parent_id;
--         >10 (genus or coarser) → null.
--   Indexed: used as a GROUP BY key in botanical card grouping.
--
-- inat_rank: leaf taxon rank string from iNaturalist ('species', 'hybrid', 'subspecies',
--   'variety', 'form'). Display-only — drives the rank badge in the library card.
--   Not indexed: never filtered server-side.
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS inat_species_id INTEGER NULL;

ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS inat_rank TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_cbr_inat_species_id ON public.cached_botanical_records (inat_species_id);
