#!/usr/bin/env python
"""
Database migration script to add new columns to action_annotation table
Run this script to update your PostgreSQL database
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from server import app, db, ActionAnnotation

def migrate():
    with app.app_context():
        # Drop the old action_annotation table if it exists
        print("Dropping old action_annotation table...")
        try:
            ActionAnnotation.__table__.drop(db.engine)
            print("✓ Old table dropped")
        except Exception as e:
            print(f"Note: {e}")
        
        # Create the new table with all columns
        print("Creating new action_annotation table with new columns...")
        try:
            ActionAnnotation.__table__.create(db.engine)
            print("✓ New table created successfully!")
            print("\nNew columns added:")
            print("  - pitch_start_x, pitch_start_y, pitch_end_x, pitch_end_y")
            print("  - outcome, context")
            print("  - pass_length, pass_direction")
            print("  - shot_result, goal_target_x, goal_target_y")
            print("  - body_part, defensive_pressure, opponents_bypassed")
            print("  - defensive_action_type, defensive_consequence")
            print("  - created_at")
        except Exception as e:
            print(f"✗ Error creating table: {e}")
            return False
    
    return True

if __name__ == '__main__':
    success = migrate()
    if success:
        print("\n✓ Database migration completed successfully!")
    else:
        print("\n✗ Migration failed")
