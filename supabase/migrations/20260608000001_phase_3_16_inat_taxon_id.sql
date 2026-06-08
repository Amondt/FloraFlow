-- Add inat_taxon_id to cached_botanical_records and plants for iNaturalist migration (Phase 3.16)

ALTER TABLE public.cached_botanical_records
  ADD COLUMN IF NOT EXISTS inat_taxon_id INTEGER NULL;

ALTER TABLE public.plants
  ADD COLUMN IF NOT EXISTS inat_taxon_id INTEGER NULL;

CREATE INDEX IF NOT EXISTS idx_cbr_inat_taxon_id ON public.cached_botanical_records(inat_taxon_id);
CREATE INDEX IF NOT EXISTS idx_plants_inat_taxon_id ON public.plants(inat_taxon_id);
