-- Persist Leaf Doctor diagnostic results alongside journal entries.
-- The existing FOR ALL policy on plant_journals covers this column automatically.
ALTER TABLE public.plant_journals
ADD COLUMN IF NOT EXISTS diagnostics JSONB;
