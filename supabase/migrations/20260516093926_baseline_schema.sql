-- ============================================================
-- FloraFlow — Baseline Schema
-- Tables: profiles, zones, plants, cached_botanical_records,
--         plant_journals
-- Indexes + RLS policies applied in this same migration.
-- ============================================================

-- ─── ENUM TYPES ───────────────────────────────────────────
CREATE TYPE window_orientation_type AS ENUM (
  'North', 'South', 'East', 'West',
  'Northeast', 'Northwest', 'Southeast', 'Southwest', 'None'
);

CREATE TYPE container_vector_type AS ENUM (
  'Terracotta', 'Plastic', 'Ceramic',
  'Fabric', 'Self-Watering', 'Ground'
);

CREATE TYPE substrate_factor_type AS ENUM (
  'High-Drainage Aroid', 'Heavy Peat', 'Standard Potting',
  'Desert Succulent', 'Sphagnum Moss Mix'
);

CREATE TYPE log_category_type AS ENUM (
  'Observation', 'Pruning', 'Repotting',
  'Fertilization', 'PestTreatment'
);

-- ─── TABLE: profiles ──────────────────────────────────────
CREATE TABLE public.profiles (
  id           UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners manage their own profile"
ON public.profiles FOR ALL
USING     (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ─── TABLE: zones ─────────────────────────────────────────
CREATE TABLE public.zones (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                   TEXT        NOT NULL,
  icon                   TEXT        NOT NULL DEFAULT 'ri-plant-line',
  window_orientation     window_orientation_type NOT NULL DEFAULT 'None',
  has_active_ventilation BOOLEAN     NOT NULL DEFAULT FALSE,
  has_grow_lights        BOOLEAN     NOT NULL DEFAULT FALSE,
  humidity_baseline      INT         NOT NULL DEFAULT 40,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_zones_user ON public.zones(user_id);

ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can manage their own zones completely"
ON public.zones FOR ALL
USING     (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ─── TABLE: plants ────────────────────────────────────────
CREATE TABLE public.plants (
  id                        UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID                 NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id                   UUID                 NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  common_name               TEXT                 NOT NULL,
  scientific_name           TEXT,
  perenual_id               INT,
  container_vector          container_vector_type NOT NULL DEFAULT 'Plastic',
  substrate_factor          substrate_factor_type NOT NULL DEFAULT 'Standard Potting',
  last_checked_at           TIMESTAMPTZ,
  next_check_due_at         TIMESTAMPTZ          NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  current_snooze_interval_days INT               NOT NULL DEFAULT 3,
  created_at                TIMESTAMPTZ          NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at                TIMESTAMPTZ          NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_plants_scheduling ON public.plants(user_id, next_check_due_at ASC);

ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners can manage their own specific plants"
ON public.plants FOR ALL
USING     (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ─── TABLE: cached_botanical_records ──────────────────────
CREATE TABLE public.cached_botanical_records (
  scientific_name     TEXT        PRIMARY KEY,
  perenual_id         INT,
  common_name         TEXT        NOT NULL,
  ideal_min_ph        NUMERIC(3,1) DEFAULT 6.0,
  ideal_max_ph        NUMERIC(3,1) DEFAULT 7.0,
  is_toxic_to_pets    BOOLEAN      DEFAULT TRUE,
  propagation_methods TEXT[],
  is_ai_enriched      BOOLEAN      NOT NULL DEFAULT FALSE,
  raw_api_payload     JSONB,
  cached_at           TIMESTAMPTZ  NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_botanical_cache_id ON public.cached_botanical_records(perenual_id);

ALTER TABLE public.cached_botanical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view cached botanical species profiles"
ON public.cached_botanical_records FOR SELECT
USING (auth.role() = 'authenticated');

-- Writes are locked to internal edge operations only (service role bypasses RLS)
CREATE POLICY "Only internal edge operations can populate botanical indices"
ON public.cached_botanical_records FOR ALL
USING     (false)
WITH CHECK (false);

-- ─── TABLE: plant_journals ────────────────────────────────
CREATE TABLE public.plant_journals (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id            UUID             NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  user_id             UUID             NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category            log_category_type NOT NULL DEFAULT 'Observation',
  notes               TEXT,
  image_storage_path  TEXT,
  logged_at           TIMESTAMPTZ      NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.plant_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gardeners manage their own journal entries"
ON public.plant_journals FOR ALL
USING     (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
