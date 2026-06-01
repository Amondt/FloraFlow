-- Make the plant-journal-images bucket public so <img> tags can load photos
-- without authentication headers. getPublicUrl() generates /object/public/ URLs
-- which only work when the bucket's public flag is TRUE.
-- The path structure ({userId}/{plantId}/{timestamp}.jpg) uses UUIDs that are
-- not guessable, providing sufficient access control for personal plant care photos.
UPDATE storage.buckets
SET
  public = TRUE
WHERE
  id = 'plant-journal-images';
