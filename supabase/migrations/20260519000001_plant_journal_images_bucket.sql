-- Create the plant-journal-images bucket (private — no public URL access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-journal-images', 'plant-journal-images', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload into their own folder only
-- Path structure: {userId}/{plantId}/{timestamp}.jpg
-- foldername(name) splits the path; [1] is the first segment (the userId folder)
CREATE POLICY "Users can upload their own journal images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'plant-journal-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their own journal images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'plant-journal-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
