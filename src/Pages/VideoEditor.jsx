import React, { Component } from 'react';
import { videoTagService, videoSegmentService, videoTaskService, videoService, actionAnnotationService } from '../api/apiClient';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Input } from "../Components/ui/input";
import { Slider } from "../Components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../Components/ui/dialog";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Flag,
  MapPin,
  Plus,
  Video,
  ChevronLeft,
  ChevronRight,
  User,
  CheckCircle2,
  ExternalLink,
  Scissors,
  Trash2
} from 'lucide-react';
import { Skeleton } from "../Components/ui/skeleton";
import EnhancedTimeline from '../Components/video/EnhancedTimeline';
import PlayerIdentificationGallery from '../Components/video/PlayerIdentificationGallery';

class VideoEditorWithRouter extends Component {
  render() {
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('taskId');
    const videoId = urlParams.get('videoId');
    const navigate = (url) => window.location.href = url;
    return <VideoEditor taskId={taskId} videoId={videoId} navigate={navigate} />;
  }
}

class VideoEditor extends Component {
  constructor(props) {
    super(props);
    this.videoRef = React.createRef();
    this.popupWindowRef = React.createRef();
    this.state = {
      allTasks: [], allVideos: [], task: null, video: null, tags: [], segments: [],
      allTasksLoading: true, taskLoading: true, videoLoading: true,
      isPlaying: false, currentTime: 0, duration: 0, matchStartSet: false, matchStartTime: 0,
      selectedZone: null, showTaggingDialog: false, pendingSegments: [],
      searchTerm: '', statusFilter: 'all', playUntilTime: null, showGallery: false,
      showCreateTaskDialog: false, taskPriority: 'medium'
    };
  }

  componentDidMount() { this.loadData(); this.setupPopupHandlers(); }
  componentDidUpdate(prevProps, prevState) {
    if (prevProps.taskId !== this.props.taskId || prevProps.videoId !== this.props.videoId) this.loadData();
    if (prevState.task !== this.state.task && this.state.task?.match_start_time) {
      this.setState({ matchStartTime: this.state.task.match_start_time, matchStartSet: true });
    }
  }
  componentWillUnmount() { this.cleanupPopupHandlers(); }

  loadData = async () => {
    if (!this.props.taskId && !this.props.videoId) { await this.loadAllTasks(); await this.loadAllVideos(); }
    else if (this.props.videoId) { await this.loadVideo(this.props.videoId); this.setState({ showCreateTaskDialog: true }); }
    else { await this.loadTask(); await this.loadTags(); await this.loadSegments(); }
  };

  loadAllTasks = async () => {
    this.setState({ allTasksLoading: true });
    try {
      const tasks = await videoTaskService.filter({ task_type: 'video_processing' }, '-created_at');
      this.setState({ allTasks: tasks, allTasksLoading: false });
    } catch (e) { this.setState({ allTasksLoading: false }); }
  };

  loadAllVideos = async () => { try { const videos = await videoService.list(); this.setState({ allVideos: videos }); } catch (e) {} };

  loadTask = async () => {
    if (!this.props.taskId) return;
    this.setState({ taskLoading: true });
    try {
      const task = await videoTaskService.get(this.props.taskId);
      this.setState({ task, taskLoading: false });
      if (task?.video_id) await this.loadVideo(task.video_id);
    } catch (e) { this.setState({ taskLoading: false }); }
  };

  loadVideo = async (videoId) => {
    this.setState({ videoLoading: true });
    try {
      const video = await videoService.get(videoId);
      this.setState({ video, videoLoading: false });
    } catch (e) { this.setState({ videoLoading: false }); }
  };

  loadTags = async () => {
    try {
      const tags = await videoTagService.filter({ video_id: this.state.video?.id });
      this.setState({ tags });
    } catch (e) {}
  };

  loadSegments = async () => {
    try {
      const raw = await videoSegmentService.filter({ video_id: this.state.video?.id });
      this.setState({ segments: raw.map(s => ({ ...s, start_time: s.start_time/1000, end_time: s.end_time/1000, zone: s.segment_type })) });
    } catch (e) {}
  };

  formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  getMatchTime = (videoTime) => this.state.matchStartSet ? Math.max(0, videoTime - this.state.matchStartTime) : videoTime;

  handlePlayPause = () => {
    if (this.videoRef.current) {
      if (this.state.isPlaying) this.videoRef.current.pause(); else this.videoRef.current.play();
      this.setState({ isPlaying: !this.state.isPlaying });
    }
  };

  handleSeek = (value) => { if (this.videoRef.current) { this.videoRef.current.currentTime = value[0]; this.setState({ currentTime: value[0] }); } };
  handleSkip = (seconds) => { if (this.videoRef.current) { const nt = Math.max(0, Math.min(this.state.duration, this.videoRef.current.currentTime + seconds)); this.videoRef.current.currentTime = nt; this.setState({ currentTime: nt }); } };

  handleSetMatchStart = async () => {
    const { currentTime } = this.state;
    this.setState({ matchStartTime: currentTime, matchStartSet: true });
    try { await videoTaskService.update(this.props.taskId, { match_start_time: Math.round(currentTime * 1000), status: 'in_progress' }); } catch (e) {}
  };

  handleAddTag = async (tagType) => {
    const { currentTime, selectedZone, video } = this.state;
    if (!video?.id) return;
    try {
      const matchTime = this.getMatchTime(currentTime);
      await videoTagService.create({
        video_id: video.id, timestamp: Math.round(matchTime * 1000),
        tag_type: tagType, tag_name: tagType, zone: selectedZone, description: `Tag at ${matchTime.toFixed(2)}s`
      });
      await this.loadTags();
    } catch (e) { console.error(e); }
  };

  handleCreatePendingSegment = (startTag, endTag) => {
    const { pendingSegments } = this.state;
    let st = startTag.timestamp / 1000, et = endTag.timestamp / 1000;
    if (st > et) [st, et] = [et, st];
    if (!pendingSegments.find(s => Math.abs(s.start_time - st) < 0.5 && Math.abs(s.end_time - et) < 0.5)) {
      this.setState({ pendingSegments: [...pendingSegments, { start_time: st, end_time: et, zone: startTag.zone || this.state.selectedZone, startTagId: startTag.id, endTagId: endTag.id }] });
    }
  };

  handleRemovePendingSegment = (sid, eid) => this.setState({ pendingSegments: this.state.pendingSegments.filter(s => s.startTagId !== sid || s.endTagId !== eid) });

  handleConfirmPlayerVideo = async () => {
    const { pendingSegments, video, task } = this.state;
    for (const seg of pendingSegments) {
      await videoSegmentService.create({ video_id: video.id, start_time: Math.round(seg.start_time*1000), end_time: Math.round(seg.end_time*1000), segment_type: seg.zone || 'player_involvement', description: `${seg.zone} segment` });
    }
    await videoTaskService.update(this.props.taskId, { status: 'completed' });
    await videoTaskService.create({ video_id: video.id, task_type: 'analyst_annotation', status: 'pending_assignment', priority: task?.priority || 'medium' });
    this.setState({ pendingSegments: [] });
    await this.loadSegments();
  };
  handlePopOutDashboard = () => {
    this.setState({ isPopupOpen: true, showTaggingDialog: false });
    
    const popupWindow = window.open('', 'TaggingDashboard', 'width=800,height=900,left=100,top=100');
    this.popupWindowRef.current = popupWindow;
    
    if (popupWindow) {
      popupWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Quick Tagging Dashboard</title>
            <style>
              body { 
                margin: 0; 
                font-family: system-ui, -apple-system, sans-serif; 
                background: white;
                padding: 20px;
                color: #1e293b;
              }
              .zone-btn { 
                padding: 8px 16px; 
                border: 1px solid #e2e8f0; 
                border-radius: 6px; 
                cursor: pointer; 
                background: white;
                font-size: 14px;
                transition: all 0.2s;
              }
              .zone-btn.selected { background: #10b981; color: white; border-color: #10b981; }
              .tag-btn { 
                padding: 10px 16px; 
                border: 2px solid #e2e8f0; 
                border-radius: 8px; 
                cursor: pointer; 
                background: white;
                font-size: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.2s;
              }
              .tag-btn:hover:not(:disabled) { background: #f8fafc; }
              .tag-btn.success { border-color: #10b981; color: #10b981; }
              .tag-btn.danger { border-color: #ef4444; color: #ef4444; }
              .tag-btn:disabled { opacity: 0.5; cursor: not-allowed; border-color: #e2e8f0; color: #94a3b8; }
              
              .pending-start-banner {
                background: #ecfdf5;
                border: 1px solid #a7f3d0;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 16px;
                display: none;
              }
              .pending-start-banner.active { display: block; }

              .tag-pair-card {
                padding: 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                margin-bottom: 8px;
                display: flex;
                flex-direction: column;
                gap: 8px;
              }
              .tag-pair-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .delete-btn {
                background: transparent;
                color: #ef4444;
                border: none;
                cursor: pointer;
                font-size: 18px;
                padding: 4px;
                border-radius: 4px;
              }
              .delete-btn:hover { background: #fee2e2; }
              
              .add-queue-btn {
                width: 100%;
                background: #2563eb;
                color: white;
                border: none;
                padding: 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                font-weight: 500;
              }
              .add-queue-btn:hover { background: #1d4ed8; }
              
              .zone-badge {
                padding: 2px 6px;
                background: #f1f5f9;
                border-radius: 4px;
                font-size: 11px;
                text-transform: capitalize;
                border: 1px solid #e2e8f0;
              }
              .status-badge {
                padding: 2px 6px;
                background: #dcfce7;
                color: #166534;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
              }
              .primary-btn {
                background: #10b981;
                color: white;
                padding: 12px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                width: 100%;
                transition: background 0.2s;
              }
              .primary-btn:hover:not(:disabled) { background: #059669; }
              .primary-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            </style>
          </head>
          <body>
            <h2>Quick Tagging Dashboard</h2>
            <p style="color: #64748b; margin-bottom: 20px; font-size: 14px;">Use this window for tagging while watching the video in the main window</p>
            
            <div id="pending-banner" class="pending-start-banner">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #065f46; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
                  Start Marked
                </span>
                <span id="pending-time" style="font-family: monospace; font-weight: 600;">00:00</span>
              </div>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #059669;">Click "End" to complete the segment</p>
            </div>

            <div style="margin-bottom: 20px; background: #f1f5f9; padding: 12px; border-radius: 8px;">
              <p style="font-weight: 600; margin: 0; color: #475569;">Current Time: <span id="current-time" style="font-family: monospace; font-size: 18px; color: #1e293b;">00:00</span></p>
            </div>

            <div style="margin-bottom: 20px;">
              <strong style="display: block; margin-bottom: 8px; font-size: 14px; color: #64748b; text-transform: uppercase;">Field Zone</strong>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                <button class="zone-btn" id="zone-defending" onclick="window.selectZone('defending')">Defending</button>
                <button class="zone-btn" id="zone-midfield" onclick="window.selectZone('midfield')">Midfield</button>
                <button class="zone-btn" id="zone-attacking" onclick="window.selectZone('attacking')">Attacking</button>
                <button class="zone-btn" id="zone-transition" onclick="window.selectZone('transition')">Transition</button>
              </div>
            </div>

            <div style="margin-bottom: 20px;">
              <strong style="display: block; margin-bottom: 8px; font-size: 14px; color: #64748b; text-transform: uppercase;">Player Involvement</strong>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <button class="tag-btn success" id="start-btn" onclick="window.opener.handleTagFromPopup('involved_start')">▶ Start</button>
                <button class="tag-btn danger" id="end-btn" onclick="window.opener.handleTagFromPopup('involved_end')" disabled>⏸ End</button>
              </div>
            </div>

            <div>
              <strong style="display: block; margin-bottom: 12px; font-size: 14px; color: #64748b; text-transform: uppercase;">Tagged Pairs (<span id="pair-count">0</span>)</strong>
              <div id="pairs-list" style="max-height: 400px; overflow-y: auto;"></div>
            </div>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <button id="confirm-all-btn" class="primary-btn" onclick="window.opener.handleConfirmFromPopup()">
                ✓ Confirm All & Create Analyst Task
              </button>
            </div>

            <script>
              let selectedZone = null;
              
              const formatTime = (seconds) => {
                if (isNaN(seconds)) return "00:00";
                const h = Math.floor(seconds / 3600);
                const m = Math.floor((seconds % 3600) / 60);
                const s = Math.floor(seconds % 60);
                return (h > 0 ? h + ':' : '') + m.toString().padStart(2, '0') + ':' + s.toString().padStart(2, '0');
              };

              window.selectZone = function(zone) {
                selectedZone = zone;
                document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('selected'));
                const btn = document.getElementById('zone-' + zone);
                if (btn) btn.classList.add('selected');
                if (window.opener && window.opener.setSelectedZoneFromPopup) {
                  window.opener.setSelectedZoneFromPopup(zone);
                }
              };

              window.addEventListener('message', function(event) {
                if (event.data.type === 'UPDATE_TIME') {
                  document.getElementById('current-time').textContent = formatTime(event.data.time);
                }
                
                if (event.data.type === 'UPDATE_DATA') {
                  const { involvedStarts, involvedEnds, pendingSegments, hasPendingStart, lastStartTime, currentZone, segments } = event.data;
                  
                  // Update Zone Selection
                  if (currentZone && currentZone !== selectedZone) {
                    selectedZone = currentZone;
                    document.querySelectorAll('.zone-btn').forEach(b => b.classList.remove('selected'));
                    const btn = document.getElementById('zone-' + currentZone);
                    if (btn) btn.classList.add('selected');
                  }

                  // Update Banner
                  const banner = document.getElementById('pending-banner');
                  if (hasPendingStart) {
                    banner.classList.add('active');
                    document.getElementById('pending-time').textContent = formatTime(lastStartTime / 1000);
                    document.getElementById('start-btn').disabled = true;
                    document.getElementById('end-btn').disabled = false;
                  } else {
                    banner.classList.remove('active');
                    document.getElementById('start-btn').disabled = false;
                    document.getElementById('end-btn').disabled = true;
                  }

                  // Update List
                  const list = document.getElementById('pairs-list');
                  list.innerHTML = '';
                  const count = Math.min(involvedStarts.length, involvedEnds.length);
                  document.getElementById('pair-count').textContent = count;

                  if (count === 0 && !hasPendingStart) {
                    list.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 32px 0; font-size: 14px;">No tags yet.<br/>Mark player involvement start and end times.</p>';
                  }

                  for (let i = 0; i < count; i++) {
                    const start = involvedStarts[i];
                    const end = involvedEnds[i];
                    
                    const isQueued = pendingSegments.some(s => s.startTagId === start.id);
                    const isSaved = segments.some(seg => 
                      Math.abs(seg.start_time - start.timestamp / 1000) < 0.5 && 
                      Math.abs(seg.end_time - end.timestamp / 1000) < 0.5
                    );
                    
                    const card = document.createElement('div');
                    card.className = 'tag-pair-card';
                    card.innerHTML = \`
                      <div class="tag-pair-row">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="width: 24px; height: 24px; background: #e2e8f0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600;">\${i+1}</div>
                          <div>
                            <div style="font-weight: 600; font-size: 14px;">\${formatTime(start.timestamp / 1000)} - \${formatTime(end.timestamp / 1000)}</div>
                            <div style="display: flex; gap: 4px; margin-top: 2px;">
                              \${start.zone ? '<span class="zone-badge">' + start.zone + '</span>' : ''}
                              \${isQueued ? '<span class="status-badge">Queued</span>' : ''}
                              \${isSaved ? '<span class="status-badge" style="background:#e0f2fe; color:#0369a1;">Saved</span>' : ''}
                            </div>
                          </div>
                        </div>
                        <button class="delete-btn" title="Delete Pair" onclick="window.opener.deleteTagPairFromPopup('\${start.id}', '\${end.id}')">🗑</button>
                      </div>
                      \${(!isQueued && !isSaved) ? \`<button class="add-queue-btn" onclick="window.opener.handleCreatePendingSegmentFromPopup(\${i})">+ Add to Queue</button>\` : ''}
                    \`;
                    list.appendChild(card);
                  }

                  // Update Confirm Button
                  const confirmBtn = document.getElementById('confirm-all-btn');
                  if (pendingSegments.length > 0) {
                    confirmBtn.style.display = 'block';
                    confirmBtn.textContent = '✓ Confirm All & Create Analyst Task (' + pendingSegments.length + ')';
                  } else {
                    confirmBtn.style.display = 'none';
                  }
                }
              });
            </script>
          </body>
        </html>
      \`);
      popupWindow.document.close();

      const syncPopup = () => {
        if (popupWindow && !popupWindow.closed) {
          const matchTime = this.getMatchTime(this.state.currentTime);
          popupWindow.postMessage({ type: 'UPDATE_TIME', time: matchTime }, '*');
          
          const tags = this.state.tags || [];
          const involvedStarts = tags.filter(t => t.tag_type === 'involved_start');
          const involvedEnds = tags.filter(t => t.tag_type === 'involved_end');
          const hasPendingStart = involvedStarts.length > involvedEnds.length;
          const lastStartTime = hasPendingStart ? involvedStarts[involvedStarts.length - 1]?.timestamp : null;

          popupWindow.postMessage({
            type: 'UPDATE_DATA',
            involvedStarts,
            involvedEnds,
            pendingSegments: this.state.pendingSegments,
            hasPendingStart,
            lastStartTime,
            currentZone: this.state.selectedZone,
            segments: this.state.segments
          }, '*');
          requestAnimationFrame(syncPopup);
        }
      };
      syncPopup();
    }
  };

  updatePopupSegments = () => {};

  setupPopupHandlers = () => {
    window.handleTagFromPopup = (tagType) => {
      this.handleAddTag(tagType);
    };

    window.setSelectedZoneFromPopup = (zone) => {
      this.setState({ selectedZone: zone });
    };

    window.handleCreatePendingSegmentFromPopup = (idx) => {
      const tags = this.state.tags || [];
      const starts = tags.filter(t => t.tag_type === 'involved_start');
      const ends = tags.filter(t => t.tag_type === 'involved_end');
      if (starts[idx] && ends[idx]) {
        this.handleCreatePendingSegment(starts[idx], ends[idx]);
      }
    };

    window.deleteTagPairFromPopup = async (startId, endId) => {
      try {
        const startTag = this.state.tags.find(t => t.id == startId);
        const endTag = this.state.tags.find(t => t.id == endId);
        
        if (startTag && endTag) {
          const startTimeSeconds = startTag.timestamp / 1000;
          const endTimeSeconds = endTag.timestamp / 1000;
          
          const matchingSegment = this.state.segments.find(seg => 
            Math.abs(seg.start_time - startTimeSeconds) < 0.5 && 
            Math.abs(seg.end_time - endTimeSeconds) < 0.5
          );
          
          if (matchingSegment) {
            await videoSegmentService.delete(matchingSegment.id);
          }
        }

        this.handleRemovePendingSegment(startId, endId);
        await videoTagService.delete(startId);
        await videoTagService.delete(endId);
        
        await this.loadTags();
        await this.loadSegments();
      } catch (error) {
        console.error('Delete error:', error);
      }
    };
    window.handleConfirmFromPopup = () => this.handleConfirmPlayerVideo();
  };
  };

  cleanupPopupHandlers = () => { delete window.handleTagFromPopup; delete window.setSelectedZoneFromPopup; delete window.deleteTagPairFromPopup; delete window.handleConfirmFromPopup; };

  createProcessingTask = async () => {
    try {
      const task = await videoTaskService.create({ video_id: this.state.video.id, task_type: 'video_processing', status: 'pending_processing', priority: this.state.taskPriority });
      this.setState({ task, isNewVideo: false, showCreateTaskDialog: false });
    } catch (e) {}
  };

  render() {
    const { taskId, navigate } = this.props;
    const { allTasks, allVideos, task, video, tags, segments, allTasksLoading, taskLoading, videoLoading, isPlaying, currentTime, duration, matchStartSet, matchStartTime, selectedZone, showTaggingDialog, pendingSegments, searchTerm, statusFilter, playUntilTime, showGallery } = this.state;
    const invS = tags.filter(t => t.tag_type === 'involved_start'), invE = tags.filter(t => t.tag_type === 'involved_end');
    const zones = [ { id: 'defending', label: 'Defending', color: 'bg-red-500' }, { id: 'midfield', label: 'Midfield', color: 'bg-amber-500' }, { id: 'attacking', label: 'Attacking', color: 'bg-emerald-500' }, { id: 'transition', label: 'Transition', color: 'bg-purple-500' } ];

    if (!taskId) {
      if (allTasksLoading) return <div className="p-8 text-center">Loading tasks...</div>;
      const filtered = allTasks.filter(t => t.status.includes(searchTerm) || statusFilter === 'all' || t.status === statusFilter);
      return (
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Video Editor Tasks</h1>
            <Button onClick={() => navigate(createPageUrl('UploadVideo'))}>Upload Video</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <Card key={t.id} className="cursor-pointer hover:shadow-md" onClick={() => navigate(createPageUrl('VideoEditor') + `?taskId=${t.id}`)}>
                <CardHeader><CardTitle className="text-lg">{allVideos.find(v=>v.id===t.video_id)?.title || 'Task '+t.id}</CardTitle></CardHeader>
                <CardContent><Badge>{t.status}</Badge></CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    if (taskLoading || videoLoading) return <div className="p-8 text-center">Loading video...</div>;

    return (
      <div className="p-6 space-y-6">
        <Dialog open={this.state.showCreateTaskDialog} onOpenChange={o=>this.setState({showCreateTaskDialog:o})}>
          <DialogContent><DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
          <Button onClick={this.createProcessingTask}>Confirm</Button></DialogContent>
        </Dialog>

        <div className="flex justify-between items-center">
          <div><h2 className="text-2xl font-bold">{video?.title}</h2><p className="text-slate-500">{video?.home_team} vs {video?.away_team}</p></div>
          <div className="flex gap-2">
            <Button onClick={()=>this.setState({showTaggingDialog:true})} className="bg-emerald-600"><MapPin className="w-4 h-4 mr-2"/>Tagging Dashboard</Button>
            <Badge>{task?.status}</Badge>
          </div>
        </div>

        <Card className="overflow-hidden bg-black">
          <video ref={this.videoRef} src={video?.url ? (video.url.startsWith('http')?video.url:'/'+video.url) : ''} className="w-full h-[500px] object-contain"
            onTimeUpdate={()=>{const t=this.videoRef.current.currentTime; this.setState({currentTime:t}); if(playUntilTime && this.getMatchTime(t)>=playUntilTime){this.videoRef.current.pause(); this.setState({isPlaying:false,playUntilTime:null});}}}
            onLoadedMetadata={()=>this.setState({duration:this.videoRef.current.duration})}
            onPlay={()=>this.setState({isPlaying:true})} onPause={()=>this.setState({isPlaying:false})}
          />
        </Card>

        <CardContent className="bg-slate-900 p-4 space-y-4 rounded-xl">
          <Slider value={[currentTime]} max={duration} step={0.1} onValueChange={this.handleSeek} />
          <div className="flex justify-between items-center text-white">
            <div className="flex gap-2">
              <Button size="icon" variant="ghost" onClick={()=>this.handleSkip(-5)}><ChevronLeft/></Button>
              <Button size="icon" onClick={this.handlePlayPause} className="bg-white text-black">{isPlaying?<Pause/>:<Play/>}</Button>
              <Button size="icon" variant="ghost" onClick={()=>this.handleSkip(5)}><ChevronRight/></Button>
            </div>
            <div className="font-mono">{this.formatTime(currentTime)} / {this.formatTime(duration)}</div>
            {!matchStartSet && <Button onClick={this.handleSetMatchStart} className="bg-emerald-600">Set Match Start</Button>}
          </div>
          <EnhancedTimeline segments={segments} duration={duration} currentTime={this.getMatchTime(currentTime)} matchStartTime={matchStartTime}
            onSeek={t=>{if(this.videoRef.current)this.videoRef.current.currentTime=t+matchStartTime;}}
            onPlaySegment={s=>{if(this.videoRef.current){this.videoRef.current.currentTime=s.start_time+matchStartTime; this.videoRef.current.play(); this.setState({isPlaying:true,playUntilTime:s.end_time});}}}
            onDeleteSegment={async id=>{const s=segments.find(seg=>seg.id===id); if(s){const st=tags.find(t=>t.tag_type==='involved_start'&&Math.abs(t.timestamp/1000-s.start_time)<0.5), et=tags.find(t=>t.tag_type==='involved_end'&&Math.abs(t.timestamp/1000-s.end_time)<0.5); if(st)await videoTagService.delete(st.id); if(et)await videoTagService.delete(et.id);} await videoSegmentService.delete(id); await this.loadTags(); await this.loadSegments();}}
          />
        </CardContent>

        <Dialog open={showTaggingDialog} onOpenChange={o=>this.setState({showTaggingDialog:o})}>
          <DialogContent className="max-w-4xl bg-white p-6">
            <DialogHeader className="flex flex-row justify-between">
              <div><DialogTitle>Tagging Dashboard</DialogTitle><DialogDescription>Mark segments</DialogDescription></div>
              <Button variant="outline" onClick={this.handlePopOutDashboard}><ExternalLink className="w-4 h-4 mr-2"/>Pop Out</Button>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <strong>Zones:</strong>
                <div className="grid grid-cols-2 gap-2">{zones.map(z=>(<Button key={z.id} variant={selectedZone===z.id?'default':'outline'} className={selectedZone===z.id?z.color:''} onClick={()=>this.setState({selectedZone:z.id})}>{z.label}</Button>))}</div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 border-emerald-500" onClick={()=>this.handleAddTag('involved_start')}><Play className="mr-2 w-4 h-4"/>Start</Button>
                  <Button variant="outline" className="flex-1 border-red-500" onClick={()=>this.handleAddTag('involved_end')} disabled={invS.length<=invE.length}><Pause className="mr-2 w-4 h-4"/>End</Button>
                </div>
              </div>
              <div className="space-y-2 overflow-y-auto max-h-[300px]">
                {Array.from({length:Math.min(invS.length,invE.length)}).map((_,i)=>{
                  const s=invS[i], en=invE[i], q=pendingSegments.find(ps=>ps.startTagId===s.id);
                  return (
                    <div key={i} className="p-3 border rounded-lg flex justify-between items-center">
                      <div><p className="font-bold">{this.formatTime(s.timestamp/1000)} - {this.formatTime(en.timestamp/1000)}</p><Badge variant="outline">{s.zone}</Badge></div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={async()=>{await videoTagService.delete(s.id); await videoTagService.delete(en.id); await this.loadTags();}}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                        {!q && <Button size="sm" onClick={()=>this.handleCreatePendingSegment(s,en)}>+ Queue</Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {pendingSegments.length>0 && <Button className="w-full bg-emerald-600 mt-4" onClick={this.handleConfirmPlayerVideo}>Confirm All ({pendingSegments.length})</Button>}
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}

export default VideoEditorWithRouter;
