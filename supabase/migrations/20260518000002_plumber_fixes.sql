-- ============================================================
-- FloraFlow — Plumber Fixes
--
-- A. BUG-2: confirm_plant_check RPC
--      The confirm (dry-soil) path previously used a raw client-side
--      .update() with new Date() arithmetic. This RPC moves the logic
--      server-side, using NOW() and the snooze_interval_rules lookup
--      table — making confirm and snooze fully consistent.
--
-- B. SEC-1: plant_journals RLS — plant_id ownership check
--      The previous FOR ALL policy only verified user_id = auth.uid().
--      A user could insert a journal entry with a plant_id belonging to
--      another user. The new WITH CHECK adds an EXISTS guard.
--
-- C. PERF-3: drop redundant idx_journals_plant index
--      idx_journals_plant (plant_id) was created in the baseline schema.
--      Migration 20260518000001 added idx_journals_plant_date
--      (plant_id, logged_at DESC), which covers all single-column
--      plant_id lookups. The original index is now redundant.
-- ============================================================
-- ─── A. confirm_plant_check RPC ──────────────────────────────
-- Called from the client via supabase.rpc('confirm_plant_check', { p_plant_id }).
-- Runs when the user confirms the soil IS dry.
-- Derives next_check_due_at server-side from the snooze_interval_rules
-- lookup table, identical to snooze_plant_check. Both paths are now
-- clock-skew-proof and always consistent with the lookup matrix.
CREATE OR REPLACE FUNCTION public.confirm_plant_check (p_plant_id UUID) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- ─── B. plant_journals RLS — plant_id ownership check ────────
DROP POLICY "Gardeners manage their own journal entries" ON public.plant_journals;

-- USING: governs SELECT, UPDATE, DELETE — user can only see/touch their own rows.
-- WITH CHECK: governs INSERT and UPDATE new values — enforces that plant_id
--   also belongs to the authenticated user, blocking cross-user journal writes.
CREATE POLICY "Gardeners manage their own journal entries" ON public.plant_journals FOR ALL USING (auth.uid () = user_id)
WITH
  CHECK (
    auth.uid () = user_id
    AND EXISTS (
      SELECT
        1
      FROM
        public.plants p
      WHERE
        p.id = plant_id
        AND p.user_id = auth.uid ()
    )
  );

-- ─── C. Drop redundant single-column index ────────────────────
DROP INDEX IF EXISTS idx_journals_plant;
