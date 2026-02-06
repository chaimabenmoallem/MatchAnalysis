#!/usr/bin/env python
"""
Migration tool - adds missing columns to action_annotation table
"""

import os
import sys

def run_migration():
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print("ERROR: sqlalchemy not installed")
        return False
    
    database_url = os.environ.get('DATABASE_URL')
    
    if not database_url:
        print("WARNING: DATABASE_URL not found in environment")
        print("\nOptions:")
        print("1. Ensure your server is running with DATABASE_URL set")
        print("2. Or set it manually before running this script")
        return False
    
    print("Connecting to database...")
    
    try:
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            print("\nChecking existing columns...")
            result = conn.execute(text("""
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'action_annotation'
            """))
            existing_columns = {row[0] for row in result}
            print(f"   Found {len(existing_columns)} columns")
            
            new_columns = {
                'pitch_start_x': 'DOUBLE PRECISION',
                'pitch_start_y': 'DOUBLE PRECISION',
                'pitch_end_x': 'DOUBLE PRECISION',
                'pitch_end_y': 'DOUBLE PRECISION',
                'outcome': 'VARCHAR(50)',
                'context': 'VARCHAR(50)',
                'pass_length': 'DOUBLE PRECISION',
                'pass_direction': 'VARCHAR(100)',
                'shot_result': 'VARCHAR(50)',
                'goal_target_x': 'DOUBLE PRECISION',
                'goal_target_y': 'DOUBLE PRECISION',
                'body_part': 'VARCHAR(50)',
                'defensive_pressure': 'INTEGER',
                'opponents_bypassed': 'INTEGER',
                'defensive_action_type': 'VARCHAR(100)',
                'defensive_consequence': 'VARCHAR(100)',
                'created_at': 'TIMESTAMP'
            }
            
            with engine.begin() as conn:
                added = 0
                for col_name, col_type in new_columns.items():
                    if col_name not in existing_columns:
                        print(f"   Adding column: {col_name}")
                        try:
                            if col_name == 'created_at':
                                conn.execute(text(f"ALTER TABLE action_annotation ADD COLUMN {col_name} {col_type} DEFAULT CURRENT_TIMESTAMP"))
                            else:
                                conn.execute(text(f"ALTER TABLE action_annotation ADD COLUMN {col_name} {col_type}"))
                            added += 1
                        except Exception as e:
                            print(f"      Warning: {e}")
                    else:
                        print(f"   OK column exists: {col_name}")
                
                print(f"\nAdded {added} new columns")
                print("\nMigration completed successfully!")
                return True
            
    except Exception as e:
        print(f"\nError: {e}")
        print("\nTroubleshooting:")
        print("1. Ensure your Flask server is running: python server.py")
        print("2. The server should set DATABASE_URL automatically")
        print("3. Check: where is your server running?")
        return False

if __name__ == '__main__':
    success = run_migration()
    sys.exit(0 if success else 1)
