from flask import Flask, request, jsonify, send_from_directory, send_file
import os
import cv2
import requests
import tempfile
import json
import io
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime, timezone
import uuid

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Allow large file uploads (up to 2GB for video files)
app.config['MAX_CONTENT_LENGTH'] = 2 * 1024 * 1024 * 1024  # 2GB

db = SQLAlchemy(app)

# Serve uploaded videos
@app.route('/videos/<path:filename>')
def serve_video(filename):
    video_dir = os.path.join(os.getcwd(), 'videos')
    return send_from_directory(video_dir, filename)

# Models
class Video(db.Model):
    id = db.Column(db.String(255), primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(1000))
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    home_team = db.Column(db.String(100))
    away_team = db.Column(db.String(100))
    player_name = db.Column(db.String(100))
    jersey_number = db.Column(db.String(20))
    sample_frames = db.Column(db.Text)

    def __init__(self, id, title, url=None, status='pending', home_team=None, away_team=None, player_name=None, jersey_number=None, sample_frames=None):
        self.id = id
        self.title = title
        self.url = url
        self.status = status
        self.home_team = home_team
        self.away_team = away_team
        self.player_name = player_name
        self.jersey_number = jersey_number
        self.sample_frames = json.dumps(sample_frames) if sample_frames else None
    
    def get_sample_frames(self):
        if self.sample_frames:
            try:
                return json.loads(self.sample_frames)
            except:
                return []
        return []

class ActionAnnotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.String(255), db.ForeignKey('video.id'))
    start_time = db.Column(db.Float)
    end_time = db.Column(db.Float)
    action_category = db.Column(db.String(100))
    note = db.Column(db.Text)
    
    # Pitch position data
    pitch_start_x = db.Column(db.Float)
    pitch_start_y = db.Column(db.Float)
    pitch_end_x = db.Column(db.Float)
    pitch_end_y = db.Column(db.Float)
    
    # Action outcome and context
    outcome = db.Column(db.String(50))  # successful, unsuccessful
    context = db.Column(db.String(50))  # open_play, set_piece
    
    # General action details
    pass_length = db.Column(db.String(50))  # Changed from Float to String (short, medium, long)
    pass_direction = db.Column(db.String(100))
    
    # Shot/Goal details
    shot_result = db.Column(db.String(50))  # goal, saved, blocked, wide, etc.
    goal_target_x = db.Column(db.Float)
    goal_target_y = db.Column(db.Float)
    
    # Player action details
    body_part = db.Column(db.String(50))  # foot, head, chest, etc.
    defensive_pressure = db.Column(db.Integer)  # 0-10 scale
    opponents_bypassed = db.Column(db.Integer)
    
    # Defensive specific
    defensive_action_type = db.Column(db.String(100))  # tackle, interception, block, etc.
    defensive_consequence = db.Column(db.String(100))  # possession_won, dispossessed, etc.
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class VideoTag(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.String(255), db.ForeignKey('video.id'))
    timestamp = db.Column(db.Integer)
    tag_type = db.Column(db.String(50))
    tag_name = db.Column(db.String(100))
    zone = db.Column(db.String(50))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class VideoSegment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.String(255), db.ForeignKey('video.id'))
    start_time = db.Column(db.Integer)
    end_time = db.Column(db.Integer)
    segment_type = db.Column(db.String(100))
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class VideoFrame(db.Model):
    id = db.Column(db.String(255), primary_key=True)
    video_id = db.Column(db.String(255), db.ForeignKey('video.id'))
    frame_index = db.Column(db.Integer)
    frame_data = db.Column(db.LargeBinary)
    width = db.Column(db.Integer)
    height = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# Routes
@app.route('/api/tags', methods=['GET'])
def get_tags():
    video_id = request.args.get('video_id')
    query = VideoTag.query
    if video_id:
        query = query.filter_by(video_id=video_id)
    tags = query.all()
    return jsonify([{
        'id': t.id,
        'video_id': t.video_id,
        'timestamp': t.timestamp,
        'tag_type': t.tag_type,
        'tag_name': t.tag_name,
        'zone': t.zone,
        'description': t.description
    } for t in tags])

@app.route('/api/tags', methods=['POST'])
def create_tag():
    try:
        data = request.json
        tag = VideoTag(
            video_id=data.get('video_id'),
            timestamp=data.get('timestamp'),
            tag_type=data.get('tag_type'),
            tag_name=data.get('tag_name'),
            zone=data.get('zone'),
            description=data.get('description')
        )
        db.session.add(tag)
        db.session.commit()
        return jsonify({'id': tag.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    tag = VideoTag.query.get(tag_id)
    if tag:
        db.session.delete(tag)
        db.session.commit()
    return '', 204

@app.route('/api/segments', methods=['GET'])
def get_segments():
    video_id = request.args.get('video_id')
    query = VideoSegment.query
    if video_id:
        query = query.filter_by(video_id=video_id)
    segments = query.all()
    return jsonify([{
        'id': s.id,
        'video_id': s.video_id,
        'start_time': s.start_time,
        'end_time': s.end_time,
        'segment_type': s.segment_type,
        'description': s.description
    } for s in segments])

@app.route('/api/segments', methods=['POST'])
def create_segment():
    try:
        data = request.json
        segment = VideoSegment(
            video_id=data.get('video_id'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            segment_type=data.get('segment_type'),
            description=data.get('description')
        )
        db.session.add(segment)
        db.session.commit()
        return jsonify({'id': segment.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/segments/<int:segment_id>', methods=['DELETE', 'PUT'])
def handle_segment(segment_id):
    segment = VideoSegment.query.get(segment_id)
    if not segment:
        return jsonify({'error': 'Segment not found'}), 404
        
    if request.method == 'DELETE':
        db.session.delete(segment)
        db.session.commit()
        return '', 204
    else:
        data = request.json
        if 'start_time' in data: segment.start_time = data['start_time']
        if 'end_time' in data: segment.end_time = data['end_time']
        if 'segment_type' in data: segment.segment_type = data['segment_type']
        db.session.commit()
        return jsonify({'id': segment.id})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    path = request.form.get('path', file.filename)
    full_path = os.path.abspath(os.path.join(os.getcwd(), path))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    file.save(full_path)
    return jsonify({'path': path, 'url': path})

@app.route('/api/videos', methods=['GET'])
def get_videos():
    videos = Video.query.all()
    return jsonify([{
        'id': v.id,
        'title': v.title,
        'url': v.url,
        'status': v.status,
        'home_team': v.home_team,
        'away_team': v.away_team,
        'player_name': v.player_name,
        'jersey_number': v.jersey_number,
        'sample_frames': v.get_sample_frames(),
        'created_at': v.created_at.isoformat()
    } for v in videos])

@app.route('/api/videos', methods=['POST'])
def create_video():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        url = data.get('url') or data.get('file_url')
        video_id = data.get('id') or str(int(datetime.now(timezone.utc).timestamp() * 1000))
        print(f"[DEBUG] Creating video with ID: {video_id}, URL: {url}")
        video = Video(
            id=video_id,
            title=data.get('title', 'Untitled Video'),
            url=url,
            status=data.get('status', 'uploaded'),
            home_team=data.get('home_team'),
            away_team=data.get('away_team'),
            player_name=data.get('player_name'),
            jersey_number=data.get('jersey_number'),
            sample_frames=data.get('sample_frames')
        )
        db.session.add(video)
        db.session.commit()
        print(f"[DEBUG] Video created successfully with ID: {video.id}")
        return jsonify({
            'id': video.id,
            'title': video.title,
            'url': video.url,
            'status': video.status,
            'sample_frames': video.get_sample_frames()
        }), 201
    except Exception as e:
        db.session.rollback()
        import traceback
        traceback.print_exc()
        print(f"[ERROR] Failed to create video: {str(e)}")
        return jsonify({'error': str(e)}), 500

class VideoTask(db.Model):
    id = db.Column(db.String(255), primary_key=True)
    video_id = db.Column(db.String(255), db.ForeignKey('video.id'))
    task_type = db.Column(db.String(100))
    status = db.Column(db.String(50))
    priority = db.Column(db.String(50))
    notes = db.Column(db.Text)
    match_start_time = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, id, video_id, task_type, status='pending', priority='medium', notes=None, match_start_time=None):
        self.id = id
        self.video_id = video_id
        self.task_type = task_type
        self.status = status
        self.priority = priority
        self.notes = notes
        self.match_start_time = match_start_time

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    task_type = request.args.get('task_type')
    query = VideoTask.query
    if task_type:
        query = query.filter_by(task_type=task_type)
    sort = request.args.get('sort_by')
    if sort == '-created_at':
        query = query.order_by(VideoTask.created_at.desc())
    tasks = query.all()
    return jsonify([{
        'id': t.id,
        'video_id': t.video_id,
        'task_type': t.task_type,
        'status': t.status,
        'priority': t.priority,
        'notes': t.notes,
        'match_start_time': t.match_start_time,
        'created_at': t.created_at.isoformat()
    } for t in tasks])

@app.route('/api/tasks', methods=['POST'])
def create_task():
    try:
        data = request.json
        task_id = str(int(datetime.utcnow().timestamp() * 1000))
        task = VideoTask(
            id=task_id,
            video_id=data.get('video_id'),
            task_type=data.get('task_type'),
            status=data.get('status', 'pending'),
            priority=data.get('priority', 'medium'),
            notes=data.get('notes'),
            match_start_time=data.get('match_start_time')
        )
        db.session.add(task)
        db.session.commit()
        return jsonify({
            'id': task.id,
            'video_id': task.video_id,
            'status': task.status
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<task_id>', methods=['GET'])
def get_task(task_id):
    task = VideoTask.query.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    return jsonify({
        'id': task.id,
        'video_id': task.video_id,
        'task_type': task.task_type,
        'status': task.status,
        'priority': task.priority,
        'notes': task.notes,
        'match_start_time': task.match_start_time,
        'created_at': task.created_at.isoformat()
    })

@app.route('/api/annotations', methods=['POST'])
def create_annotation():
    try:
        data = request.json
        print(f"[API] Creating annotation with data keys: {data.keys()}")
        annotation = ActionAnnotation(
            video_id=data.get('video_id'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            action_category=data.get('action_category'),
            note=data.get('note'),
            # Pitch position
            pitch_start_x=data.get('pitch_start_x'),
            pitch_start_y=data.get('pitch_start_y'),
            pitch_end_x=data.get('pitch_end_x'),
            pitch_end_y=data.get('pitch_end_y'),
            # Outcome and context
            outcome=data.get('outcome'),
            context=data.get('context'),
            # General action details
            pass_length=data.get('pass_length'),
            pass_direction=data.get('pass_direction'),
            # Shot/Goal details
            shot_result=data.get('shot_result'),
            goal_target_x=data.get('goal_target_x'),
            goal_target_y=data.get('goal_target_y'),
            # Player action details
            body_part=data.get('body_part'),
            defensive_pressure=data.get('defensive_pressure'),
            opponents_bypassed=data.get('opponents_bypassed'),
            # Defensive specific
            defensive_action_type=data.get('defensive_action_type'),
            defensive_consequence=data.get('defensive_consequence')
        )
        db.session.add(annotation)
        db.session.commit()
        print(f"[API] Annotation created successfully with id: {annotation.id}")
        return jsonify({'id': annotation.id}), 201
    except Exception as e:
        db.session.rollback()
        error_msg = str(e)
        print(f"[API ERROR] Failed to create annotation: {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': error_msg}), 500

@app.route('/api/debug/schema', methods=['GET'])
def debug_schema():
    """Debug endpoint to check database schema"""
    try:
        from sqlalchemy import text, inspect
        inspector = inspect(db.engine)
        columns = inspector.get_columns('action_annotation')
        return jsonify({
            'table': 'action_annotation',
            'columns': [col['name'] for col in columns],
            'column_count': len(columns)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/annotations/<video_id>', methods=['GET'])
def get_annotations(video_id):
    annotations = ActionAnnotation.query.filter_by(video_id=video_id).all()
    return jsonify([{
        'id': a.id,
        'video_id': a.video_id,
        'start_time': a.start_time,
        'end_time': a.end_time,
        'action_category': a.action_category,
        'note': a.note,
        'pitch_start_x': a.pitch_start_x,
        'pitch_start_y': a.pitch_start_y,
        'pitch_end_x': a.pitch_end_x,
        'pitch_end_y': a.pitch_end_y,
        'outcome': a.outcome,
        'context': a.context,
        'pass_length': a.pass_length,
        'pass_direction': a.pass_direction,
        'shot_result': a.shot_result,
        'goal_target_x': a.goal_target_x,
        'goal_target_y': a.goal_target_y,
        'body_part': a.body_part,
        'defensive_pressure': a.defensive_pressure,
        'opponents_bypassed': a.opponents_bypassed,
        'defensive_action_type': a.defensive_action_type,
        'defensive_consequence': a.defensive_consequence,
        'created_at': a.created_at.isoformat() if a.created_at else None
    } for a in annotations])

@app.route('/api/extract-frames', methods=['POST'])
def extract_frames():
    try:
        data = request.json
        video_url = data.get('url')
        video_id = data.get('video_id')
        if not video_url:
            return jsonify({'error': 'Video URL required'}), 400
        if not video_id:
            return jsonify({'error': 'Video ID required'}), 400
        
        # Verify video exists in database
        video = Video.query.filter_by(id=video_id).first()
        if not video:
            return jsonify({'error': f'Video with ID {video_id} not found in database'}), 404
        
        print(f"[DEBUG] Extracting frames for video ID: {video_id}")
        
        # Delete existing frames for this video first
        VideoFrame.query.filter_by(video_id=video_id).delete()
        db.session.commit()
        
        local_path = None
        if not video_url.startswith('http'):
            local_path = os.path.abspath(os.path.join(os.getcwd(), video_url))
            if not os.path.exists(local_path):
                local_path = os.path.abspath(video_url)
                if not os.path.exists(local_path):
                    return jsonify({'error': f'Local file not found: {video_url}'}), 404
        else:
            response = requests.get(video_url, stream=True, timeout=30)
            if response.ok:
                fd, temp_path = tempfile.mkstemp(suffix='.mp4')
                with os.fdopen(fd, 'wb') as tmp:
                    for chunk in response.iter_content(chunk_size=8192):
                        tmp.write(chunk)
                local_path = temp_path
            else:
                return jsonify({'error': f'Failed to download video'}), 400
        cap = cv2.VideoCapture(local_path)
        if not cap.isOpened():
            return jsonify({'error': 'OpenCV could not open video'}), 400
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            ret, _ = cap.read()
            if not ret:
                return jsonify({'error': 'Invalid video file'}), 400
            total_frames = 1000
        frames = []
        start_frame = int(total_frames * 0.05)
        end_frame = int(total_frames * 0.95)
        usable_range = max(1, end_frame - start_frame)
        for i in range(10):
            frame_idx = start_frame + int((i * usable_range) / 9)
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if ret:
                frame = cv2.resize(frame, (480, 270))
                height, width = frame.shape[:2]
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                frame_id = str(uuid.uuid4())
                
                # Save frame to database
                try:
                    video_frame = VideoFrame(
                        id=frame_id,
                        video_id=video_id,
                        frame_index=frame_idx,
                        frame_data=buffer.tobytes(),
                        width=width,
                        height=height
                    )
                    db.session.add(video_frame)
                except Exception as frame_err:
                    print(f"[ERROR] Failed to create frame object: {frame_err}")
                    raise
                
                frames.append({
                    'id': frame_id,
                    'frame_index': frame_idx,
                    'width': width,
                    'height': height
                })
        
        print(f"[DEBUG] Committing {len(frames)} frames to database...")
        db.session.commit()
        cap.release()
        if local_path and local_path.startswith(tempfile.gettempdir()):
            try: os.remove(local_path)
            except: pass
        if not frames:
            return jsonify({'error': 'No frames extracted'}), 500
        print(f"[DEBUG] Successfully extracted and saved {len(frames)} frames")
        return jsonify({'frames': frames})
    except Exception as e:
        db.session.rollback()
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        print(f"[ERROR] Frame extraction failed: {error_msg}")
        return jsonify({'error': f'Frame extraction failed: {error_msg}'}), 500

@app.route('/api/frame/<frame_id>', methods=['GET'])
def get_frame(frame_id):
    try:
        video_frame = VideoFrame.query.filter_by(id=frame_id).first()
        if not video_frame:
            return jsonify({'error': 'Frame not found'}), 404
        return send_file(
            io.BytesIO(video_frame.frame_data),
            mimetype='image/jpeg',
            as_attachment=False
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/video/<video_id>/frames', methods=['GET'])
def get_video_frames(video_id):
    try:
        frames = VideoFrame.query.filter_by(video_id=video_id).order_by(VideoFrame.frame_index).all()
        return jsonify([{
            'id': f.id,
            'frame_index': f.frame_index,
            'width': f.width,
            'height': f.height,
            'url': f'/api/frame/{f.id}'
        } for f in frames])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def migrate_database():
    """Add missing columns to tables and fix schema issues"""
    try:
        from sqlalchemy import text, inspect
        
        with app.app_context():
            inspector = inspect(db.engine)
            
            # ============= Fix video_frame table =============
            if 'video_frame' in inspector.get_table_names():
                existing_columns = {col['name'] for col in inspector.get_columns('video_frame')}
                
                # Check if id column exists and is wrong type
                try:
                    with db.engine.begin() as conn:
                        result = conn.execute(text("""
                            SELECT column_name, data_type 
                            FROM information_schema.columns 
                            WHERE table_name = 'video_frame' AND column_name = 'id'
                        """))
                        col_info = result.fetchone()
                        if col_info and col_info[1] in ['integer', 'bigint']:
                            print("[DB] Dropping video_frame table to recreate with correct schema...")
                            conn.execute(text("DROP TABLE IF EXISTS video_frame CASCADE"))
                            print("[DB] Dropped video_frame table")
                except Exception as e:
                    print(f"[DB] Could not check video_frame id type: {str(e)[:100]}")
                
                # After dropping, let db.create_all() recreate it
                print("[DB] Recreating video_frame table with db.create_all()...")
            
            # ============= Migrate action_annotation table =============
            if 'action_annotation' in inspector.get_table_names():
                existing_columns = {col['name'] for col in inspector.get_columns('action_annotation')}
                
                # Columns to add
                columns_to_add = [
                    ('pitch_start_x', 'DOUBLE PRECISION'),
                    ('pitch_start_y', 'DOUBLE PRECISION'),
                    ('pitch_end_x', 'DOUBLE PRECISION'),
                    ('pitch_end_y', 'DOUBLE PRECISION'),
                    ('outcome', 'VARCHAR(50)'),
                    ('context', 'VARCHAR(50)'),
                    ('pass_length', 'VARCHAR(50)'),
                    ('pass_direction', 'VARCHAR(100)'),
                    ('shot_result', 'VARCHAR(50)'),
                    ('goal_target_x', 'DOUBLE PRECISION'),
                    ('goal_target_y', 'DOUBLE PRECISION'),
                    ('body_part', 'VARCHAR(50)'),
                    ('defensive_pressure', 'INTEGER'),
                    ('opponents_bypassed', 'INTEGER'),
                    ('defensive_action_type', 'VARCHAR(100)'),
                    ('defensive_consequence', 'VARCHAR(100)'),
                    ('created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'),
                ]
                
                # Add missing columns
                for col_name, col_type in columns_to_add:
                    if col_name not in existing_columns:
                        try:
                            with db.engine.begin() as conn:
                                conn.execute(text(f"ALTER TABLE action_annotation ADD COLUMN {col_name} {col_type}"))
                            print(f"+ Added column to action_annotation: {col_name}")
                        except Exception as e:
                            print(f"  Note: action_annotation.{col_name} - {str(e)[:100]}")
                
                # Fix pass_length column type if it's wrong
                try:
                    with db.engine.begin() as conn:
                        result = conn.execute(text("""
                            SELECT column_name, data_type 
                            FROM information_schema.columns 
                            WHERE table_name = 'action_annotation' AND column_name = 'pass_length'
                        """))
                        col_info = result.fetchone()
                        if col_info and col_info[1] == 'double precision':
                            print("[DB] Fixing pass_length column type...")
                            conn.execute(text("ALTER TABLE action_annotation DROP COLUMN pass_length"))
                            conn.execute(text("ALTER TABLE action_annotation ADD COLUMN pass_length VARCHAR(50)"))
                            print("[DB] pass_length column type fixed to VARCHAR(50)")
                except Exception as e:
                    print(f"[DB] Note on pass_length fix: {str(e)[:100]}")
    except Exception as e:
        print(f"[DB Migration Error]: {str(e)}")
        pass

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        migrate_database()
    app.run(host='0.0.0.0', port=8080)
