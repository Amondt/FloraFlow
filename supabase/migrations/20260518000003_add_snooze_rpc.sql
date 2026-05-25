-- ============================================================
-- FloraFlow — Add snooze_plant_check RPC
--
-- This function was specified in DB_SCHEMA_MATRIX.md §2.6 but was
-- omitted from the plumber_fixes migration. It is the counterpart
-- to confirm_plant_check: both paths derive the snooze interval
-- server-side from the container × substrate lookup matrix.
--
-- Difference from confirm_plant_check:
--   confirm = soil IS dry  → updates last_checked_at + next_check_due_at
--   snooze  = soil NOT dry → same formula, identical DB effect
--   (The semantic difference is captured in the UX, not the SQL.)
-- ============================================================
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
    AND  p.user_id = auth.uid();

  v_days := COALESCE(v_days, 3);

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
