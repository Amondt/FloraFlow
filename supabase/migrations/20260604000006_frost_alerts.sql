-- Location columns on profiles (nullable — user opts in)
ALTER TABLE public.profiles
ADD COLUMN latitude NUMERIC(8, 5),
ADD COLUMN longitude NUMERIC(8, 5),
ADD COLUMN location_name TEXT;

-- Frost date cache stub (historical frost-window data; not populated in this phase)
CREATE TABLE public.frost_date_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  latitude NUMERIC(8, 5) NOT NULL,
  longitude NUMERIC(8, 5) NOT NULL,
  last_spring_frost DATE,
  first_fall_frost DATE,
  hardiness_zone TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE ('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.frost_date_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can read frost cache" ON public.frost_date_cache FOR
SELECT
  USING (auth.role () = 'authenticated');
