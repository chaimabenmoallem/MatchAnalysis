-- Enable RLS on all tables
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActionAnnotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Create policies for anon/authenticated users
-- For development: Allow all operations for authenticated users, restrict for anon

-- Video policies
CREATE POLICY "Allow public read on Video" ON "Video"
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated create on Video" ON "Video"
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on Video" ON "Video"
  FOR UPDATE USING (auth.role() = 'authenticated');

-- VideoTask policies
CREATE POLICY "Allow public read on VideoTask" ON "VideoTask"
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated create on VideoTask" ON "VideoTask"
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update on VideoTask" ON "VideoTask"
  FOR UPDATE USING (auth.role() = 'authenticated');

-- VideoTag policies
CREATE POLICY "Allow public read on VideoTag" ON "VideoTag"
  FOR SELECT USING (true);

CREATE POLICY "Allow public write on VideoTag" ON "VideoTag"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on VideoTag" ON "VideoTag"
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on VideoTag" ON "VideoTag"
  FOR DELETE USING (true);

-- VideoSegment policies
CREATE POLICY "Allow public read on VideoSegment" ON "VideoSegment"
  FOR SELECT USING (true);

CREATE POLICY "Allow public write on VideoSegment" ON "VideoSegment"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on VideoSegment" ON "VideoSegment"
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on VideoSegment" ON "VideoSegment"
  FOR DELETE USING (true);

-- ActionAnnotation policies
CREATE POLICY "Allow public read on ActionAnnotation" ON "ActionAnnotation"
  FOR SELECT USING (true);

CREATE POLICY "Allow public write on ActionAnnotation" ON "ActionAnnotation"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update on ActionAnnotation" ON "ActionAnnotation"
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete on ActionAnnotation" ON "ActionAnnotation"
  FOR DELETE USING (true);

-- User policies
CREATE POLICY "Allow public read on User" ON "User"
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated create on User" ON "User"
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow users update their own profile" ON "User"
  FOR UPDATE USING (auth.uid()::text = id::text);
