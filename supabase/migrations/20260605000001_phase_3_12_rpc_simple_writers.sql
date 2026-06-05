-- Phase 3.12 — Move all snooze/confirm business logic to the client
--
-- Before this migration the RPCs applied business logic server-side:
--   • confirm_plant_check looked up snooze_interval_rules (no watering / growth-stage).
--   • snooze_plant_check applied a growth-stage multiplier on top of the client value.
--
-- The client now computes the full interval:
--   SNOOZE_MATRIX[container × substrate] × WATERING_MULTIPLIER × GROWTH_MULTIPLIER
-- and passes the final days value.  Both RPCs become simple SECURITY DEFINER writers —
-- no lookup, no multiplier — so the stored value always matches what the user sees.
-- ── confirm_plant_check ──────────────────────────────────────────────────────
-- Old signature: (p_plant_id UUID)          ← different arity = different overload
-- New signature: (p_plant_id UUID, p_snooze_days INT)
--
-- PostgreSQL treats functions with different argument lists as separate overloads.
-- CREATE OR REPLACE cannot replace a different overload, so the old function must
-- be dropped before the new one is created.
DROP FUNCTION IF EXISTS public.confirm_plant_check (UUID);

CREATE OR REPLACE FUNCTION public.confirm_plant_check (p_plant_id UUID, p_snooze_days INT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.plants
  SET
    last_checked_at              = NOW(),
    next_check_due_at            = NOW() + (p_snooze_days * INTERVAL '1 day'),
    current_snooze_interval_days = p_snooze_days,
    updated_at                   = NOW()
  WHERE id      = p_plant_id
    AND user_id = auth.uid();
END;
$$;

-- ── snooze_plant_check ───────────────────────────────────────────────────────
-- Signature unchanged: (p_plant_id UUID, p_snooze_days INT)
-- Body change: remove the growth-stage CASE multiplier added in Phase 3.2.
-- The client now applies that multiplier before calling this function.
CREATE OR REPLACE FUNCTION public.snooze_plant_check (p_plant_id UUID, p_snooze_days INT) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.plants
  SET
    last_checked_at              = NOW(),
    next_check_due_at            = NOW() + (p_snooze_days * INTERVAL '1 day'),
    current_snooze_interval_days = p_snooze_days,
    updated_at                   = NOW()
  WHERE id      = p_plant_id
    AND user_id = auth.uid();
END;
$$;
