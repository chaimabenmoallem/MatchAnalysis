-- ============================================
-- Supabase Database Schema Setup
-- Run this in Supabase SQL Editor
-- ============================================

-- Create Video table
CREATE TABLE IF NOT EXISTS "Video" (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  duration INTEGER,
  resolution TEXT,
  frame_rate INTEGER,
  file_size BIGINT,
  format VARCHAR(10),
  home_team TEXT,
  away_team TEXT,
  competition TEXT,
  match_date DATE,
  venue TEXT,
  player_name TEXT,
  jersey_number INTEGER,
  player_team TEXT,
  player_position TEXT,
  played_full_match BOOLEAN DEFAULT true,
  minutes_played INTEGER,
  sample_frames JSONB,
  status VARCHAR(50) DEFAULT 'uploaded',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create VideoTask table
CREATE TABLE IF NOT EXISTS "VideoTask" (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES "Video"(id) ON DELETE CASCADE,
  task_type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending_processing',
  assigned_to TEXT,
  assigned_by TEXT,
  assigned_date TIMESTAMP,
  started_date TIMESTAMP,
  completed_date TIMESTAMP,
  match_start_time INTEGER,
  match_end_time INTEGER,
  priority VARCHAR(20),
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create VideoTag table
CREATE TABLE IF NOT EXISTS "VideoTag" (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES "Video"(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  tag_type VARCHAR(50),
  timestamp INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create VideoSegment table
CREATE TABLE IF NOT EXISTS "VideoSegment" (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES "Video"(id) ON DELETE CASCADE,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  segment_type VARCHAR(50),
  description TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create ActionAnnotation table
CREATE TABLE IF NOT EXISTS "ActionAnnotation" (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT REFERENCES "Video"(id) ON DELETE CASCADE,
  task_id BIGINT REFERENCES "VideoTask"(id) ON DELETE CASCADE,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  action_category VARCHAR(50) NOT NULL,
  pitch_start_x FLOAT,
  pitch_start_y FLOAT,
  pitch_end_x FLOAT,
  pitch_end_y FLOAT,
  outcome VARCHAR(50),
  context VARCHAR(50),
  pass_length VARCHAR(50),
  pass_direction VARCHAR(50),
  shot_result VARCHAR(50),
  goal_target_x FLOAT,
  goal_target_y FLOAT,
  body_part VARCHAR(50),
  defensive_pressure INTEGER,
  opponents_bypassed INTEGER,
  defensive_action_type VARCHAR(100),
  defensive_consequence VARCHAR(100),
  note TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create User table (for authentication/management)
CREATE TABLE IF NOT EXISTS "User" (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role VARCHAR(50) DEFAULT 'analyst',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_video_created_at ON "Video"(created_at);
CREATE INDEX IF NOT EXISTS idx_video_status ON "Video"(status);
CREATE INDEX IF NOT EXISTS idx_videotask_video_id ON "VideoTask"(video_id);
CREATE INDEX IF NOT EXISTS idx_videotask_status ON "VideoTask"(status);
CREATE INDEX IF NOT EXISTS idx_videotag_video_id ON "VideoTag"(video_id);
CREATE INDEX IF NOT EXISTS idx_videosegment_video_id ON "VideoSegment"(video_id);
CREATE INDEX IF NOT EXISTS idx_actionannotation_video_id ON "ActionAnnotation"(video_id);

-- Enable Row Level Security (if needed)
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VideoSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ActionAnnotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (adjust as needed for your security requirements)
-- Video table policies
CREATE POLICY "Enable read access for all users" ON "Video"
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "Video"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "Video"
  FOR UPDATE USING (true);

-- VideoTask table policies
CREATE POLICY "Enable read access for all users" ON "VideoTask"
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "VideoTask"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "VideoTask"
  FOR UPDATE USING (true);

-- VideoTag table policies
CREATE POLICY "Enable read access for all users" ON "VideoTag"
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "VideoTag"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "VideoTag"
  FOR UPDATE USING (true);

-- VideoSegment table policies
CREATE POLICY "Enable read access for all users" ON "VideoSegment"
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "VideoSegment"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "VideoSegment"
  FOR UPDATE USING (true);

-- ActionAnnotation table policies
CREATE POLICY "Enable read access for all users" ON "ActionAnnotation"
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "ActionAnnotation"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "ActionAnnotation"
  FOR UPDATE USING (true);

-- User table policies
CREATE POLICY "Enable read access for all users" ON "User"
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON "User"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON "User"
  FOR UPDATE USING (true);
