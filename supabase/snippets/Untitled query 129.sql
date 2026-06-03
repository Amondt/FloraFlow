UPDATE public.plants
SET
  growth_stage = 'Seedling'
WHERE
  id = '5b6a3c7e-5143-4b81-8936-ed2dfd5d8f97';

SELECT
  public.snooze_plant_check ('5b6a3c7e-5143-4b81-8936-ed2dfd5d8f97'::uuid, 6);

SELECT
  current_snooze_interval_days,
  next_check_due_at
FROM
  public.plants
WHERE
  id = '5b6a3c7e-5143-4b81-8936-ed2dfd5d8f97';
