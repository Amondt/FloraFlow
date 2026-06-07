SELECT
  COUNT(*) AS still_pending
FROM
  cached_botanical_records
WHERE
  is_ai_enriched = FALSE;
