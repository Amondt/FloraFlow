-- Phase 3.2 — Apply a growth-stage multiplier inside snooze_plant_check
--
-- The user-chosen p_snooze_days is treated as a baseline. The function reads
-- the plant's growth_stage and scales the interval before writing:
--   Seedling × 0.5  (more frequent checks — shallow roots, faster drying)
--   Juvenile × 1.0  (baseline)
--   Mature   × 1.0  (baseline)
--   Dormant  × 2.0  (less frequent checks — plant is resting)
--
-- GREATEST(1, ...) guarantees a minimum of 1 day regardless of rounding.
-- Signature (p_plant_id UUID, p_snooze_days INT) is unchanged — no DROP needed.
CREATE OR REPLACE FUNCTION public.snooze_plant_check(p_plant_id UUID, p_snooze_days INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_stage          public.growth_stage_type;
  v_multiplier     NUMERIC;
  v_effective_days INT;
BEGIN
  SELECT growth_stage INTO v_stage
  FROM   public.plants
  WHERE  id      = p_plant_id
    AND  user_id = auth.uid();

  v_multiplier := CASE v_stage
    WHEN 'Seedling' THEN 0.5
    WHEN 'Dormant'  THEN 2.0
    ELSE                 1.0
  END;

  v_effective_days := GREATEST(1, ROUND(p_snooze_days * v_multiplier)::INT);

  UPDATE public.plants
  SET
    last_checked_at              = NOW(),
    next_check_due_at            = NOW() + (v_effective_days * INTERVAL '1 day'),
    current_snooze_interval_days = v_effective_days,
    updated_at                   = NOW()
  WHERE id      = p_plant_id
    AND user_id = auth.uid();
END;
$$;
