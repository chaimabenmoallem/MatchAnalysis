#!/usr/bin/env python
"""
Direct SQL migration to add new columns to action_annotation table in PostgreSQL
This script connects directly to your database URL
"""

import os
import sys
from sqlalchemy import create_engine, text

def migrate():
    # Get DATABASE_URL from environment
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        print("Please set DATABASE_URL before running this script")
        return False
    
    try:
        # Connect to database
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            # Start transaction
            trans = conn.begin()
            
            try:
                print("Dropping old action_annotation table...")
                conn.execute(text("DROP TABLE IF EXISTS action_annotation CASCADE"))
                print("✓ Old table dropped")
                
                print("Creating new action_annotation table with new columns...")
                create_table_sql = """
                CREATE TABLE action_annotation (
                    id SERIAL PRIMARY KEY,
                    video_id VARCHAR(255) REFERENCES video(id),
                    start_time DOUBLE PRECISION,
                    end_time DOUBLE PRECISION,
                    action_category VARCHAR(100),
                    note TEXT,
                    pitch_start_x DOUBLE PRECISION,
                    pitch_start_y DOUBLE PRECISION,
                    pitch_end_x DOUBLE PRECISION,
                    pitch_end_y DOUBLE PRECISION,
                    outcome VARCHAR(50),
                    context VARCHAR(50),
                    pass_length DOUBLE PRECISION,
                    pass_direction VARCHAR(100),
                    shot_result VARCHAR(50),
                    goal_target_x DOUBLE PRECISION,
                    goal_target_y DOUBLE PRECISION,
                    body_part VARCHAR(50),
                    defensive_pressure INTEGER,
                    opponents_bypassed INTEGER,
                    defensive_action_type VARCHAR(100),
                    defensive_consequence VARCHAR(100),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
                conn.execute(text(create_table_sql))
                print("✓ New table created successfully!")
                
                trans.commit()
                print("\n✓ Database migration completed successfully!")
                print("\nNew columns added:")
                print("  - pitch_start_x, pitch_start_y, pitch_end_x, pitch_end_y")
                print("  - outcome, context")
                print("  - pass_length, pass_direction")
                print("  - shot_result, goal_target_x, goal_target_y")
                print("  - body_part, defensive_pressure, opponents_bypassed")
                print("  - defensive_action_type, defensive_consequence")
                print("  - created_at")
                return True
                
            except Exception as e:
                trans.rollback()
                print(f"✗ Error during migration: {e}")
                return False
                
    except Exception as e:
        print(f"✗ Error connecting to database: {e}")
        return False

if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
