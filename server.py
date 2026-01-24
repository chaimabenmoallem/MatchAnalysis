from flask import Flask, request, jsonify, send_from_directory
import os
import cv2
import base64
import requests
import tempfile
import json
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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
        video_id = data.get('id') or str(int(datetime.utcnow().timestamp() * 1000))
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
        return jsonify({
            'id': video.id,
            'title': video.title,
            'url': video.url,
            'status': video.status,
            'sample_frames': video.get_sample_frames()
        }), 201
    except Exception as e:
        db.session.rollback()
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
        annotation = ActionAnnotation(
            video_id=data.get('video_id'),
            start_time=data.get('start_time'),
            end_time=data.get('end_time'),
            action_category=data.get('action_category'),
            note=data.get('note')
        )
        db.session.add(annotation)
        db.session.commit()
        return jsonify({'id': annotation.id}), 201
    except Exception as e:
        db.session.rollback()
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
        'note': a.note
    } for a in annotations])

@app.route('/api/extract-frames', methods=['POST'])
def extract_frames():
    try:
        data = request.json
        video_url = data.get('url')
        if not video_url:
            return jsonify({'error': 'Video URL required'}), 400
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
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                frame_base64 = base64.b64encode(buffer).decode('utf-8')
                frames.append(f"data:image/jpeg;base64,{frame_base64}")
        cap.release()
        if local_path and local_path.startswith(tempfile.gettempdir()):
            try: os.remove(local_path)
            except: pass
        if not frames:
            return jsonify({'error': 'No frames extracted'}), 500
        return jsonify({'frames': frames})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080)
