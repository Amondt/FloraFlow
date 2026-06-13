-- Phase 4.5 — AI Content Translations
-- Adds per-locale JSONB columns for on-demand AI translation of free-text prose.
-- English base columns are never overwritten; translations are stored in sub-objects.
-- Shape: { "fr": { "description": "...", "check_depth_description": "...", ... },
--          "nl": { "description": "...", ... } }
-- Fields translated: description, check_depth_description, toxicity_notes,
-- human_toxicity_notes, native_region, fruit_season, flowering_season.
ALTER TABLE public.cached_botanical_records
ADD COLUMN IF NOT EXISTS translations JSONB;

-- Shape: { "fr": { "primary_condition": "...", "identified_plant": "...",
--                  "immediate_remedial_actions": ["...", ...] },
--          "nl": { ... } }
-- Fields translated: primary_condition, identified_plant, immediate_remedial_actions.
-- User-authored plant_journals.notes is never auto-translated.
ALTER TABLE public.plant_journals
ADD COLUMN IF NOT EXISTS diagnostics_i18n JSONB;
