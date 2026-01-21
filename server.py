import os
import cv2
import base64
import requests
import tempfile
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Models
class Video(db.Model):
    id = db.Column(db.String(255), primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(1000))
    status = db.Column(db.String(50), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __init__(self, id, title, url=None, status='pending'):
        self.id = id
        self.title = title
        self.url = url
        self.status = status

class ActionAnnotation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.String(255), db.ForeignKey('video.id'))
    start_time = db.Column(db.Float)
    end_time = db.Column(db.Float)
    action_category = db.Column(db.String(100))
    note = db.Column(db.Text)

# Routes
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    # Use the path provided or the filename
    path = request.form.get('path', file.filename)
    
    # Ensure directory exists relative to current working directory
    full_path = os.path.abspath(os.path.join(os.getcwd(), path))
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    file.save(full_path)
    # Return the path that can be used locally
    return jsonify({'path': path, 'url': path})

@app.route('/api/videos', methods=['GET'])
def get_videos():
    videos = Video.query.all()
    return jsonify([{
        'id': v.id,
        'title': v.title,
        'url': v.url,
        'status': v.status,
        'created_at': v.created_at.isoformat()
    } for v in videos])

@app.route('/api/videos', methods=['POST'])
def create_video():
    data = request.json
    video = Video(
        id=data.get('id'),
        title=data.get('title'),
        url=data.get('url'),
        status=data.get('status', 'pending')
    )
    db.session.add(video)
    db.session.commit()
    return jsonify({'message': 'Video created'}), 201

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
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        video_url = data.get('url')
        if not video_url:
            return jsonify({'error': 'Video URL required'}), 400

        print(f"Extracting frames for: {video_url}")

        local_path = None
        if not video_url.startswith('http'):
            # Convert relative path to absolute path
            local_path = os.path.abspath(os.path.join(os.getcwd(), video_url))
            if not os.path.exists(local_path):
                # Try finding it in workspace root
                local_path = os.path.abspath(video_url)
                if not os.path.exists(local_path):
                    return jsonify({'error': f'Local file not found: {video_url} (checked {local_path})'}), 404
        else:
            try:
                response = requests.get(video_url, stream=True, timeout=30)
                if response.ok:
                    fd, temp_path = tempfile.mkstemp(suffix='.mp4')
                    with os.fdopen(fd, 'wb') as tmp:
                        for chunk in response.iter_content(chunk_size=8192):
                            tmp.write(chunk)
                    local_path = temp_path
                else:
                    return jsonify({'error': f'Failed to download video from {video_url}'}), 400
            except Exception as e:
                return jsonify({'error': f'Download error: {str(e)}'}), 500

        print(f"Opening video at: {local_path}")
        cap = cv2.VideoCapture(local_path)
        if not cap.isOpened():
            error_msg = f'OpenCV could not open video: {video_url}'
            print(error_msg)
            return jsonify({'error': error_msg}), 400

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"Total frames: {total_frames}")
        
        if total_frames <= 0:
            # Fallback for videos where frame count is not reported
            # Try to read first frame to see if it works
            ret, _ = cap.read()
            if not ret:
                return jsonify({'error': 'Invalid video file (no frames readable)'}), 400
            # If we can read frames but don't know total, just take 10 from the start or approximate
            total_frames = 1000 # Dummy value

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
            else:
                print(f"Failed to read frame at index {frame_idx}")

        cap.release()
        
        if local_path and local_path.startswith(tempfile.gettempdir()):
            try:
                os.remove(local_path)
            except:
                pass
                
        if not frames:
            return jsonify({'error': 'No frames could be extracted from the video'}), 500
            
        return jsonify({'frames': frames})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080)
