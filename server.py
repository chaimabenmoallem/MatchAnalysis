import os
import cv2
import base64
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
    data = request.json
    video_url = data.get('url')
    if not video_url:
        return jsonify({'error': 'Video URL required'}), 400

    cap = cv2.VideoCapture(video_url)
    if not cap.isOpened():
        return jsonify({'error': 'Could not open video URL'}), 400

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frames = []
    
    # Extract 10 evenly spaced frames
    # Skip first and last 5% to avoid black frames
    start_frame = int(total_frames * 0.05)
    end_frame = int(total_frames * 0.95)
    usable_range = end_frame - start_frame
    
    for i in range(10):
        frame_idx = start_frame + int((i * usable_range) / 9)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if ret:
            # Resize for performance and aspect ratio
            # Standard 16:9 thumbnail
            frame = cv2.resize(frame, (480, 270))
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            frames.append(f"data:image/jpeg;base64,{frame_base64}")

    cap.release()
    return jsonify({'frames': frames})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(host='0.0.0.0', port=8080)
