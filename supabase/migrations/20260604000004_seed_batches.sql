CREATE TYPE seed_stage_type AS ENUM(
  'Stored',
  'Sown Indoors',
  'Germinated',
  'Potted Up',
  'Hardened Off',
  'Transplanted Outside'
);

CREATE TABLE public.seed_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles (id) ON DELETE CASCADE NOT NULL,
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  brand TEXT,
  packet_year INT,
  current_stage seed_stage_type DEFAULT 'Stored'::seed_stage_type NOT NULL,
  sown_at TIMESTAMP WITH TIME ZONE,
  germinated_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE ('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE ('utc'::text, NOW()) NOT NULL
);

CREATE INDEX idx_seed_batches_user_stage ON public.seed_batches (user_id, current_stage);

ALTER TABLE public.seed_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners manage their own seed batches" ON public.seed_batches FOR ALL USING (auth.uid () = user_id)
WITH
  CHECK (auth.uid () = user_id);

CREATE TRIGGER trg_seed_batches_updated_at
BEFORE UPDATE ON public.seed_batches FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at ();
