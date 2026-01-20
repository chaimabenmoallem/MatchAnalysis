-- ============================================
-- Supabase Database Schema Setup
-- Run this in Supabase SQL Editor
-- Copy and paste all content, then execute
-- ============================================

-- Create video table (snake_case)
CREATE TABLE IF NOT EXISTS video (
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

-- Create video_task table
CREATE TABLE IF NOT EXISTS video_task (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES video(id) ON DELETE CASCADE,
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

-- Create video_tag table
CREATE TABLE IF NOT EXISTS video_tag (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES video(id) ON DELETE CASCADE,
  tag_name TEXT,
  color VARCHAR(10),
  description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create video_segment table
CREATE TABLE IF NOT EXISTS video_segment (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES video(id) ON DELETE CASCADE,
  start_time INTEGER,
  end_time INTEGER,
  segment_type VARCHAR(50),
  description TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create action_annotation table
CREATE TABLE IF NOT EXISTS action_annotation (
  id BIGSERIAL PRIMARY KEY,
  video_id BIGINT NOT NULL REFERENCES video(id) ON DELETE CASCADE,
  video_task_id BIGINT REFERENCES video_task(id) ON DELETE CASCADE,
  timestamp INTEGER,
  action_type VARCHAR(100),
  x_coordinate FLOAT,
  y_coordinate FLOAT,
  confidence FLOAT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_task_video_id ON video_task(video_id);
CREATE INDEX IF NOT EXISTS idx_video_task_status ON video_task(status);
CREATE INDEX IF NOT EXISTS idx_video_task_created_at ON video_task(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_tag_video_id ON video_tag(video_id);
CREATE INDEX IF NOT EXISTS idx_video_segment_video_id ON video_segment(video_id);
CREATE INDEX IF NOT EXISTS idx_action_annotation_video_id ON action_annotation(video_id);
CREATE INDEX IF NOT EXISTS idx_action_annotation_timestamp ON action_annotation(timestamp);

-- Enable Row Level Security (RLS)
ALTER TABLE video ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_task ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_segment ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_annotation ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for public access (development only - adjust for production)
CREATE POLICY "public_video_select" ON video FOR SELECT USING (true);
CREATE POLICY "public_video_insert" ON video FOR INSERT WITH CHECK (true);
CREATE POLICY "public_video_update" ON video FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_video_delete" ON video FOR DELETE USING (true);

CREATE POLICY "public_video_task_select" ON video_task FOR SELECT USING (true);
CREATE POLICY "public_video_task_insert" ON video_task FOR INSERT WITH CHECK (true);
CREATE POLICY "public_video_task_update" ON video_task FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_video_task_delete" ON video_task FOR DELETE USING (true);

CREATE POLICY "public_video_tag_select" ON video_tag FOR SELECT USING (true);
CREATE POLICY "public_video_tag_insert" ON video_tag FOR INSERT WITH CHECK (true);
CREATE POLICY "public_video_tag_update" ON video_tag FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_video_tag_delete" ON video_tag FOR DELETE USING (true);

CREATE POLICY "public_video_segment_select" ON video_segment FOR SELECT USING (true);
CREATE POLICY "public_video_segment_insert" ON video_segment FOR INSERT WITH CHECK (true);
CREATE POLICY "public_video_segment_update" ON video_segment FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_video_segment_delete" ON video_segment FOR DELETE USING (true);

CREATE POLICY "public_action_annotation_select" ON action_annotation FOR SELECT USING (true);
CREATE POLICY "public_action_annotation_insert" ON action_annotation FOR INSERT WITH CHECK (true);
CREATE POLICY "public_action_annotation_update" ON action_annotation FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_action_annotation_delete" ON action_annotation FOR DELETE USING (true);
