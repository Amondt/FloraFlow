-- Adds zone_type to distinguish indoor from outdoor zones.
-- Outdoor zones (balcony, garden, terrace) do not have active ventilation,
-- grow lights, or a meaningful humidity baseline — the UI hides those fields
-- based on this value. Default 'indoor' keeps all existing rows valid.
ALTER TABLE public.zones
ADD COLUMN zone_type TEXT NOT NULL DEFAULT 'indoor' CHECK (zone_type IN ('indoor', 'outdoor'));
