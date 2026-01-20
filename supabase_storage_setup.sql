-- Create videos bucket and set permissions
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;

-- Set bucket policies for public access - Allow everyone
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Public Upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Public Update" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'videos')
  WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Public Delete" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'videos');
