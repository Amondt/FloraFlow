-- Up to 6 medium-sized photo URLs from iNat taxon_photos[]; NULL = not yet fetched, {} = fetched but none available
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] NULL;
