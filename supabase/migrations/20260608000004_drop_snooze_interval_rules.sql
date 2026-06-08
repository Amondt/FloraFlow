-- Phase 3.16 cleanup — drop snooze_interval_rules lookup table.
--
-- As of migration 20260601000001, both snooze_plant_check and confirm_plant_check
-- accept p_snooze_days directly from the client. The client computes the full
-- interval (SNOOZE_MATRIX × watering × growth-stage multipliers) and passes the
-- final value. The lookup table has had zero readers since that migration.
DROP TABLE IF EXISTS public.snooze_interval_rules;
