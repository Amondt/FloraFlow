-- Phase 2.1 — Extend cached_botanical_records with Perenual care columns
-- The table and its index/RLS were created in the baseline migration.
-- These five columns are written by the botanical-search Edge Function from the
-- Perenual species-list response and are not present in the baseline DDL.

ALTER TABLE public.cached_botanical_records
    ADD COLUMN IF NOT EXISTS toxicity_notes TEXT,
    ADD COLUMN IF NOT EXISTS watering       TEXT,
    ADD COLUMN IF NOT EXISTS sunlight       TEXT[],
    ADD COLUMN IF NOT EXISTS cycle          TEXT,
    ADD COLUMN IF NOT EXISTS plant_type     TEXT;
