-- Care Journal seed data — covers all 6 categories across 4 dates
-- Safe to re-run: duplicates will just add more entries (delete first if needed)
DO $$
DECLARE
  v_user_id    uuid;
  v_plant_ids  uuid[];
  v_count      int;
BEGIN

  -- 1. Resolve your dev user
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user in auth.users — sign in to the app first, then re-run.';
  END IF;

  -- 2. Resolve up to 4 of your plants
  SELECT ARRAY(
    SELECT id FROM plants
    WHERE user_id = v_user_id
    ORDER BY created_at
    LIMIT 4
  ) INTO v_plant_ids;

  v_count := COALESCE(array_length(v_plant_ids, 1), 0);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No plants found — add at least one in the Scheduler first.';
  END IF;

  -- 3. Insert entries spread across several dates
  --    LEAST(n, v_count) prevents an out-of-bounds when you have < 4 plants
  INSERT INTO plant_journals (user_id, plant_id, category, notes, logged_at)
  VALUES
    -- Today
    ( v_user_id, v_plant_ids[1],                   'Watering',
      'Thorough soak — soil had dried to 3 cm depth. Water drained cleanly through the drainage holes.',
      now() - interval '2 hours' ),

    ( v_user_id, v_plant_ids[LEAST(2, v_count)],   'Observation',
      'Two new leaves unfurling near the base. Colour is a deep healthy green — no yellowing.',
      now() - interval '4 hours' ),

    -- 3 days ago
    ( v_user_id, v_plant_ids[LEAST(2, v_count)],   'Pruning',
      'Removed three yellowed lower leaves and one damaged stem tip. Used clean, isopropyl-wiped scissors.',
      now() - interval '3 days' ),

    ( v_user_id, v_plant_ids[1],                   'Fertilization',
      'Half-strength balanced feed (NPK 20-20-20), diluted in 500 ml water. Will repeat in 4 weeks.',
      now() - interval '3 days' - interval '3 hours' ),

    -- 10 days ago
    ( v_user_id, v_plant_ids[LEAST(3, v_count)],   'Repotting',
      'Moved up one pot size (12 cm → 15 cm). Roots were circling the bottom — good timing. Fresh aroid mix.',
      now() - interval '10 days' ),

    ( v_user_id, v_plant_ids[LEAST(3, v_count)],   'PestTreatment',
      'Early fungus gnats in the topsoil. Applied sticky traps and will let the substrate dry further between waterings.',
      now() - interval '10 days' - interval '2 hours' ),

    ( v_user_id, v_plant_ids[1],                   'Observation',
      'Slight leaf curl on the outermost leaves — likely low humidity. Moved the humidifier closer, will monitor.',
      now() - interval '10 days' - interval '5 hours' ),

    -- 25 days ago
    ( v_user_id, v_plant_ids[LEAST(4, v_count)],   'Watering',
      'Bottom-watered for 20 minutes, then allowed to drain fully before returning to the tray.',
      now() - interval '25 days' ),

    ( v_user_id, v_plant_ids[LEAST(2, v_count)],   'Fertilization',
      'Slow-release granules applied to the topsoil surface. Packaging says effective for 3 months.',
      now() - interval '25 days' - interval '1 hour' ),

    ( v_user_id, v_plant_ids[LEAST(3, v_count)],   'PestTreatment',
      'Spider mite treatment: diluted neem oil spray, applied on 3 consecutive evenings. Undersides of leaves targeted.',
      now() - interval '25 days' - interval '3 hours' );

  RAISE NOTICE 'Done — inserted 10 journal entries for user % across % plant(s).', v_user_id, v_count;
END $$;
