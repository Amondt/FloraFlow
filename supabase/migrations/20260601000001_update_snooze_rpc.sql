-- FloraFlow — Update snooze_plant_check to accept user-chosen snooze duration
--
-- The previous version always looked up the interval from snooze_interval_rules
-- and ignored the user's explicit choice in the UI. The client now passes
-- p_snooze_days directly, so the lookup is no longer needed.
--
-- The old single-parameter overload must be dropped first: PostgreSQL treats
-- functions with different argument lists as distinct overloads, so
-- CREATE OR REPLACE alone would leave both versions alive.
DROP FUNCTION IF EXISTS public.snooze_plant_check (UUID);

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
