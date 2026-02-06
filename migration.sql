-- SQL Migration Script for action_annotation table
-- Run this in your Replit PostgreSQL console using \i command
-- Or copy-paste the commands one by one

-- Add all the new columns to the action_annotation table
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS pitch_start_x DOUBLE PRECISION;
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS pitch_start_y DOUBLE PRECISION;
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS pitch_end_x DOUBLE PRECISION;
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS pitch_end_y DOUBLE PRECISION;

ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS outcome VARCHAR(50);
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS context VARCHAR(50);

ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS pass_length DOUBLE PRECISION;
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS pass_direction VARCHAR(100);

ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS shot_result VARCHAR(50);
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS goal_target_x DOUBLE PRECISION;
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS goal_target_y DOUBLE PRECISION;

ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS body_part VARCHAR(50);
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS defensive_pressure INTEGER;
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS opponents_bypassed INTEGER;

ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS defensive_action_type VARCHAR(100);
ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS defensive_consequence VARCHAR(100);

ALTER TABLE action_annotation ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verify the new schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'action_annotation' 
ORDER BY ordinal_position;
