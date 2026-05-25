-- ============================================================
-- FloraFlow — Schema Fixes
--
-- Fixes four categories of issues discovered during documentation audit:
--   A. cached_botanical_records: missing columns (toxicity_notes + Phase 2 filter fields)
--   B. plant_journals: missing created_at / updated_at + trigger
--   C. snooze_interval_rules: lookup table + seed data + updated RPC
--   D. Missing indexes
-- ============================================================
-- ─── A. cached_botanical_records — missing columns ────────────────────────────
-- toxicity_notes: AI Scribe populates this when is_toxic_to_pets = true.
-- Without this column the AI Scribe INSERT fails at runtime.
ALTER TABLE public.cached_botanical_records
ADD COLUMN toxicity_notes TEXT;

-- Phase 2 filter columns — sourced directly from Perenual species details endpoint.
-- All nullable: populated when a Perenual lookup succeeds; NULL otherwise.
ALTER TABLE public.cached_botanical_records
ADD COLUMN watering TEXT, -- e.g. 'Frequent', 'Minimum', 'Average'
ADD COLUMN sunlight TEXT[], -- e.g. ARRAY['full sun', 'part shade']
ADD COLUMN cycle TEXT, -- e.g. 'Annual', 'Perennial', 'Biennial'
ADD COLUMN plant_type TEXT;

-- e.g. 'indoor', 'outdoor' — named plant_type (not type) to avoid SQL keyword conflict
-- ─── B. plant_journals — missing audit columns + trigger ──────────────────────
-- Schema rule: every table must have created_at and updated_at.
-- The trg_plant_journals_updated_at trigger cannot be created without updated_at.
ALTER TABLE public.plant_journals
ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE ('utc', NOW()),
ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE ('utc', NOW());

CREATE TRIGGER trg_plant_journals_updated_at
BEFORE UPDATE ON public.plant_journals FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at ();

-- ─── C. snooze_interval_rules — lookup table + seed data + updated RPC ────────
-- Lookup table for smart snooze interval derivation.
-- Rows are written once at migration time; no user can modify them (no RLS policy = no access).
CREATE TABLE public.snooze_interval_rules (
  container_vector container_vector_type NOT NULL,
  substrate_factor substrate_factor_type NOT NULL,
  snooze_days INT NOT NULL CHECK (snooze_days BETWEEN 1 AND 14),
  PRIMARY KEY (container_vector, substrate_factor)
);

-- Lock down direct client access. The snooze_plant_check RPC is SECURITY DEFINER
-- (runs as the function owner, bypassing RLS), so the RPC still works.
-- No SELECT policy is needed — clients must never query this table directly.
ALTER TABLE public.snooze_interval_rules ENABLE ROW LEVEL SECURITY;

-- Full 6 × 5 seed matrix (container × substrate = 30 rows)
INSERT INTO
  public.snooze_interval_rules (container_vector, substrate_factor, snooze_days)
VALUES
  ('Terracotta', 'High-Drainage Aroid', 2),
  ('Terracotta', 'Standard Potting', 3),
  ('Terracotta', 'Heavy Peat', 5),
  ('Terracotta', 'Desert Succulent', 2),
  ('Terracotta', 'Sphagnum Moss Mix', 4),
  ('Plastic', 'High-Drainage Aroid', 3),
  ('Plastic', 'Standard Potting', 5),
  ('Plastic', 'Heavy Peat', 7),
  ('Plastic', 'Desert Succulent', 3),
  ('Plastic', 'Sphagnum Moss Mix', 6),
  ('Ceramic', 'High-Drainage Aroid', 2),
  ('Ceramic', 'Standard Potting', 4),
  ('Ceramic', 'Heavy Peat', 6),
  ('Ceramic', 'Desert Succulent', 2),
  ('Ceramic', 'Sphagnum Moss Mix', 5),
  ('Fabric', 'High-Drainage Aroid', 2),
  ('Fabric', 'Standard Potting', 3),
  ('Fabric', 'Heavy Peat', 5),
  ('Fabric', 'Desert Succulent', 2),
  ('Fabric', 'Sphagnum Moss Mix', 4),
  ('Self-Watering', 'High-Drainage Aroid', 7),
  ('Self-Watering', 'Standard Potting', 7),
  ('Self-Watering', 'Heavy Peat', 7),
  ('Self-Watering', 'Desert Succulent', 7),
  ('Self-Watering', 'Sphagnum Moss Mix', 7),
  ('Ground', 'High-Drainage Aroid', 5),
  ('Ground', 'Standard Potting', 5),
  ('Ground', 'Heavy Peat', 7),
  ('Ground', 'Desert Succulent', 5),
  ('Ground', 'Sphagnum Moss Mix', 7);

-- Replace the old snooze_plant_check(UUID, INT) with the new signature.
-- The old version accepted p_days from the caller — arbitrary and unsafe.
-- The new version derives snooze_days from the plant's own container × substrate,
-- so the interval is always consistent with the lookup matrix.
DROP FUNCTION IF EXISTS public.snooze_plant_check (UUID, INT);

CREATE OR REPLACE FUNCTION public.snooze_plant_check (p_plant_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_days INT;
BEGIN
  SELECT r.snooze_days INTO v_days
  FROM   public.plants p
  JOIN   public.snooze_interval_rules r
           ON  r.container_vector = p.container_vector
           AND r.substrate_factor = p.substrate_factor
  WHERE  p.id      = p_plant_id
    AND  p.user_id = auth.uid(); -- resolves from the caller's JWT

  v_days := COALESCE(v_days, 3); -- fallback: 3 days if no rule row matched

  UPDATE public.plants
  SET
    last_checked_at              = NOW(),
    next_check_due_at            = NOW() + (v_days * INTERVAL '1 day'),
    current_snooze_interval_days = v_days,
    updated_at                   = NOW()
  WHERE id      = p_plant_id
    AND user_id = auth.uid();
END;
$$;

-- ─── D. Missing indexes ───────────────────────────────────────────────────────
CREATE INDEX idx_plants_zone ON public.plants (zone_id);

CREATE INDEX idx_journals_plant_date ON public.plant_journals (plant_id, logged_at DESC);
