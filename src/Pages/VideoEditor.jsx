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
  Trash2,
  Clock
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
    const popupWindow = window.open('', 'TaggingDashboard', 'width=800,height=900');
    this.popupWindowRef.current = popupWindow;
    if (popupWindow) {
      popupWindow.document.write(`
        <!DOCTYPE html><html><head><title>Quick Tagging Dashboard</title>
        <style>
          body { margin: 0; font-family: sans-serif; padding: 20px; color: #1e293b; background: white; }
          .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .time-display { background: #f1f5f9; padding: 15px; border-radius: 12px; margin-bottom: 20px; text-align: center; }
          .time-val { font-family: monospace; font-size: 24px; font-weight: bold; color: #0f172a; }
          .zone-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px; }
          .zone-btn { padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: white; font-size: 13px; font-weight: 500; transition: all 0.2s; }
          .zone-btn.selected { background: #10b981; color: white; border-color: #10b981; }
          .marker-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .tag-btn { padding: 14px; border: 2px solid #e2e8f0; border-radius: 10px; cursor: pointer; background: white; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; }
          .tag-btn.success { border-color: #10b981; color: #10b981; }
          .tag-btn.danger { border-color: #ef4444; color: #ef4444; }
          .tag-btn:disabled { opacity: 0.4; cursor: not-allowed; }
          .banner { background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px; border-radius: 10px; margin-bottom: 15px; display: none; }
          .list-container { border-top: 1px solid #e2e8f0; padding-top: 15px; }
          .pair-card { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; }
          .delete-btn { color: #ef4444; border: none; background: none; cursor: pointer; font-size: 18px; padding: 4px; }
          .queue-btn { background: #2563eb; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; }
          .confirm-btn { background: #10b981; color: white; border: none; padding: 14px; border-radius: 10px; cursor: pointer; width: 100%; font-weight: 700; font-size: 16px; margin-top: 20px; }
          .badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; background: white; color: #64748b; }
        </style></head>
        <body>
          <div class="header"><h2>Tagging Dashboard</h2></div>
          <div class="time-display">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">VIDEO TIME</div>
            <div id="current-time" class="time-val">00:00:00</div>
          </div>
          <div id="pending-banner" class="banner">
            <div style="font-weight: 600; color: #065f46;">▶ Start Marked at <span id="pending-time">00:00</span></div>
            <div style="font-size: 12px; color: #059669;">Ready to mark end time</div>
          </div>
          <div style="margin-bottom: 10px; font-size: 13px; font-weight: 600; color: #475569;">FIELD ZONE</div>
          <div class="zone-grid">
            <button class="zone-btn" id="zone-defending" onclick="window.selectZone('defending')">Defending</button>
            <button class="zone-btn" id="zone-midfield" onclick="window.selectZone('midfield')">Midfield</button>
            <button class="zone-btn" id="zone-attacking" onclick="window.selectZone('attacking')">Attacking</button>
            <button class="zone-btn" id="zone-transition" onclick="window.selectZone('transition')">Transition</button>
          </div>
          <div class="marker-grid">
            <button class="tag-btn success" id="start-btn" onclick="window.opener.handleTagFromPopup('involved_start')">START</button>
            <button class="tag-btn danger" id="end-btn" onclick="window.opener.handleTagFromPopup('involved_end')" disabled>END</button>
          </div>
          <div class="list-container">
            <div style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 10px;">TAGGED PAIRS (<span id="count">0</span>)</div>
            <div id="list"></div>
          </div>
          <button id="confirm-btn" class="confirm-btn" style="display:none;" onclick="window.opener.handleConfirmFromPopup()">CONFIRM ALL (<span id="qcount">0</span>)</button>
          <script>
            let selZone = null;
            const fmt = (s) => {
              const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
              return h.toString().padStart(2,'0')+':'+m.toString().padStart(2,'0')+':'+sec.toString().padStart(2,'0');
            };
            window.selectZone = (z) => {
              selZone=z; document.querySelectorAll('.zone-btn').forEach(b=>b.classList.remove('selected'));
              const btn = document.getElementById('zone-'+z); if(btn) btn.classList.add('selected');
              window.opener.setSelectedZoneFromPopup(z);
            };
            window.addEventListener('message', (e) => {
              if(e.data.type==='UPDATE_TIME') document.getElementById('current-time').textContent = fmt(e.data.time);
              if(e.data.type==='UPDATE_DATA') {
                const { involvedStarts, involvedEnds, pendingSegments, hasPendingStart, lastStartTime, currentZone, segments } = e.data;
                const banner = document.getElementById('pending-banner');
                if(hasPendingStart) { banner.style.display='block'; document.getElementById('pending-time').textContent=fmt(lastStartTime/1000); document.getElementById('start-btn').disabled=true; document.getElementById('end-btn').disabled=false; }
                else { banner.style.display='none'; document.getElementById('start-btn').disabled=false; document.getElementById('end-btn').disabled=true; }
                const list = document.getElementById('list'); list.innerHTML = '';
                const count = Math.min(involvedStarts.length, involvedEnds.length);
                document.getElementById('count').textContent = count;
                document.getElementById('qcount').textContent = pendingSegments.length;
                for(let i=0; i<count; i++) {
                  const s=involvedStarts[i], en=involvedEnds[i];
                  const q = pendingSegments.some(ps=>ps.startTagId===s.id), sv = segments.some(seg=>Math.abs(seg.start_time-s.timestamp/1000)<0.5);
                  const div = document.createElement('div'); div.className='pair-card';
                  div.innerHTML = \`<div><div style="font-weight:600; font-size:14px;">\${fmt(s.timestamp/1000).substring(3)} - \${fmt(en.timestamp/1000).substring(3)}</div>
                    <span class="badge">\${s.zone||'No Zone'}</span> \${q?'<span class="badge" style="background:#dbeafe; color:#1d4ed8; border-color:#bfdbfe;">Queued</span>':''} \${sv?'<span class="badge" style="background:#dcfce7; color:#166534; border-color:#bbf7d0;">Saved</span>':''}</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                      \${(!q && !sv)?\`<button class="queue-btn" onclick="window.opener.handleCreatePendingSegmentFromPopup(\${i})">+ Queue</button>\`:''}
                      <button class="delete-btn" onclick="window.opener.deleteTagPairFromPopup('\${s.id}','\${en.id}')">🗑</button>
                    </div>\`;
                  list.appendChild(div);
                }
                document.getElementById('confirm-btn').style.display = pendingSegments.length > 0 ? 'block' : 'none';
              }
            });
          </script>
        </body></html>
      `);
      popupWindow.document.close();
      const sync = () => {
        if (popupWindow && !popupWindow.closed) {
          const mt = this.getMatchTime(this.state.currentTime);
          const starts = this.state.tags.filter(t=>t.tag_type==='involved_start'), ends = this.state.tags.filter(t=>t.tag_type==='involved_end');
          popupWindow.postMessage({ type:'UPDATE_TIME', time:mt }, '*');
          popupWindow.postMessage({ type:'UPDATE_DATA', involvedStarts:starts, involvedEnds:ends, pendingSegments:this.state.pendingSegments, hasPendingStart:starts.length>ends.length, lastStartTime:starts.length>ends.length?starts[starts.length-1].timestamp:null, currentZone:this.state.selectedZone, segments:this.state.segments }, '*');
          requestAnimationFrame(sync);
        }
      };
      sync();
    }
  };

  updatePopupSegments = () => {};
  setupPopupHandlers = () => {
    window.handleTagFromPopup = (t) => this.handleAddTag(t);
    window.setSelectedZoneFromPopup = (z) => this.setState({ selectedZone:z });
    window.handleCreatePendingSegmentFromPopup = (i) => { const s=this.state.tags.filter(t=>t.tag_type==='involved_start'), e=this.state.tags.filter(t=>t.tag_type==='involved_end'); if(s[i]&&e[i]) this.handleCreatePendingSegment(s[i],e[i]); };
    window.deleteTagPairFromPopup = async (sid, eid) => {
      const s=this.state.tags.find(t=>t.id==sid), en=this.state.tags.find(t=>t.id==eid);
      if(s&&en) {
        const ms = this.state.segments.find(seg=>Math.abs(seg.start_time-s.timestamp/1000)<0.5);
        if(ms) await videoSegmentService.delete(ms.id);
      }
      this.handleRemovePendingSegment(sid,eid); 
      await videoTagService.delete(sid); 
      await videoTagService.delete(eid);
      await this.loadTags(); 
      await this.loadSegments();
    };
    window.handleConfirmFromPopup = () => this.handleConfirmPlayerVideo();
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
      if (allTasksLoading) return <div className="p-8 text-center"><Skeleton className="h-10 w-48 mb-4"/><div className="grid grid-cols-3 gap-4"><Skeleton className="h-32"/><Skeleton className="h-32"/><Skeleton className="h-32"/></div></div>;
      const filtered = allTasks.filter(t => t.status.includes(searchTerm) || statusFilter === 'all' || t.status === statusFilter);
      return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-900">Video Editor Tasks</h1>
            <Button onClick={() => navigate(createPageUrl('UploadVideo'))} className="bg-emerald-600 hover:bg-emerald-700">Upload Video</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(t => {
              const v = allVideos.find(vid=>vid.id===t.video_id);
              return (
                <Card key={t.id} className="cursor-pointer hover:shadow-lg transition-shadow border-slate-200" onClick={() => navigate(createPageUrl('VideoEditor') + `?taskId=${t.id}`)}>
                  <CardHeader><CardTitle className="text-lg font-bold text-slate-800">{v?.title || 'Processing Task'}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">{t.status.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-slate-500">{new Date(t.created_at).toLocaleDateString()}</span>
                      </div>
                      {v && <div className="text-sm text-slate-600 flex items-center gap-2"><Video className="w-4 h-4"/>{v.home_team} vs {v.away_team}</div>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    if (taskLoading || videoLoading) return <div className="p-8 text-center space-y-4"><Skeleton className="h-8 w-64 mx-auto"/><Skeleton className="h-[400px] w-full rounded-xl"/></div>;

    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <Dialog open={this.state.showCreateTaskDialog} onOpenChange={o=>this.setState({showCreateTaskDialog:o})}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Create Processing Task</DialogTitle><DialogDescription>Start the processing workflow for this video.</DialogDescription></DialogHeader>
            <div className="py-4"><Button onClick={this.createProcessingTask} className="w-full bg-emerald-600 hover:bg-emerald-700">Confirm and Create Task</Button></div>
          </DialogContent>
        </Dialog>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{video?.title}</h2>
            <p className="text-slate-500 flex items-center gap-2">{video?.home_team} vs {video?.away_team} • {video?.player_name} #{video?.jersey_number}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={()=>this.setState({showGallery:true})} variant="outline" className="gap-2"><User className="w-4 h-4"/>Gallery</Button>
            <Button onClick={()=>this.setState({showTaggingDialog:true})} className="bg-[#0D6D5D] hover:bg-[#0A5A4D] text-white"><MapPin className="w-4 h-4 mr-2"/>Open Tagging Dashboard</Button>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">{task?.status.replace(/_/g, ' ')}</Badge>
          </div>
        </div>

        <Card className="overflow-hidden bg-[#0F172A] border-0 shadow-2xl rounded-xl">
          <div className="relative group">
            <video ref={this.videoRef} src={video?.url ? (video.url.startsWith('http')?video.url:'/'+video.url) : ''} className="w-full max-h-[600px] object-contain mx-auto"
              onTimeUpdate={()=>{const t=this.videoRef.current.currentTime; this.setState({currentTime:t}); if(playUntilTime && this.getMatchTime(t)>=playUntilTime){this.videoRef.current.pause(); this.setState({isPlaying:false,playUntilTime:null});}}}
              onLoadedMetadata={()=>this.setState({duration:this.videoRef.current.duration})}
              onPlay={()=>this.setState({isPlaying:true})} onPause={()=>this.setState({isPlaying:false})}
            />
            <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-md font-mono text-sm backdrop-blur-sm border border-white/10">{this.formatTime(currentTime)}</div>
          </div>
          <CardContent className="bg-[#1E293B] p-4 space-y-4">
            <Slider value={[currentTime]} max={duration} step={0.1} onValueChange={this.handleSeek} className="cursor-pointer" />
            <div className="flex justify-between items-center text-white">
              <div className="flex items-center gap-4">
                <Button size="icon" variant="ghost" onClick={()=>this.handleSkip(-5)} className="hover:bg-white/10"><ChevronLeft/></Button>
                <Button size="icon" onClick={this.handlePlayPause} className="bg-white text-[#0F172A] hover:bg-white/90 rounded-full w-12 h-12 shadow-lg">{isPlaying?<Pause className="fill-current"/>:<Play className="fill-current ml-1"/>}</Button>
                <Button size="icon" variant="ghost" onClick={()=>this.handleSkip(5)} className="hover:bg-white/10"><ChevronRight/></Button>
                <div className="text-slate-400 font-mono text-sm ml-4">{this.formatTime(currentTime)} / {this.formatTime(duration)}</div>
              </div>
              {!matchStartSet && <Button onClick={this.handleSetMatchStart} className="bg-[#10B981] hover:bg-[#059669] gap-2"><Flag className="w-4 h-4"/>Set Match Start</Button>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3"><CardTitle className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Video className="w-4 h-4"/>Player Segments</CardTitle></CardHeader>
          <CardContent className="p-4 bg-white">
            <EnhancedTimeline segments={segments} duration={duration} currentTime={this.getMatchTime(currentTime)} matchStartTime={matchStartTime}
              onSeek={t=>{if(this.videoRef.current)this.videoRef.current.currentTime=t+matchStartTime;}}
              onPlaySegment={s=>{if(this.videoRef.current){this.videoRef.current.currentTime=s.start_time+matchStartTime; this.videoRef.current.play(); this.setState({isPlaying:true,playUntilTime:s.end_time});}}}
              onDeleteSegment={async id=>{
                const s=segments.find(seg=>seg.id===id); 
                if(s){
                  const st=tags.find(t=>t.tag_type==='involved_start'&&Math.abs(t.timestamp/1000-s.start_time)<0.5), 
                        et=tags.find(t=>t.tag_type==='involved_end'&&Math.abs(t.timestamp/1000-s.end_time)<0.5); 
                  if(st)await videoTagService.delete(st.id); if(et)await videoTagService.delete(et.id);
                } 
                await videoSegmentService.delete(id); await this.loadTags(); await this.loadSegments();
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-700 font-bold"><Clock className="w-5 h-5 text-emerald-600"/>Timeline Events ({segments.length})</div>
          {segments.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3"/>
              <p className="text-slate-500 font-medium">No segments created yet</p>
              <p className="text-sm text-slate-400">Use the tagging dashboard to mark player involvement segments</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {segments.map((s,i)=>(
                <Card key={s.id} className="group hover:border-emerald-500 transition-colors cursor-pointer overflow-hidden border-slate-200" onClick={()=>this.videoRef.current.currentTime = s.start_time + matchStartTime}>
                  <div className="flex h-24">
                    <div className="w-2/5 bg-emerald-600 flex flex-col items-center justify-center text-white p-2">
                      <div className="text-xs font-mono opacity-80">{this.formatTime(s.start_time).substring(3)}</div>
                      <div className="text-2xl font-bold">{i+1}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider">Segment</div>
                    </div>
                    <div className="flex-1 p-3 flex flex-col justify-between bg-white">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono text-slate-500">{this.formatTime(s.end_time).substring(3)}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500 border-slate-300 group-hover:border-emerald-300">{s.zone}</Badge>
                      </div>
                      <div className="text-sm font-bold text-slate-800">Player Segment</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Dialog open={showTaggingDialog} onOpenChange={o=>this.setState({showTaggingDialog:o})}>
          <DialogContent className="max-w-4xl bg-white p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
            <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
              <div><DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2"><MapPin className="text-emerald-600"/>Tagging Dashboard</DialogTitle><DialogDescription>Mark segments</DialogDescription></div>
              <Button variant="outline" onClick={this.handlePopOutDashboard} className="shadow-sm border-slate-200 bg-white"><ExternalLink className="w-4 h-4 mr-2"/>Pop Out</Button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-8">
              <div className="space-y-6">
                <div><label className="text-sm font-bold text-slate-500 uppercase mb-3 block">Field Zones</label>
                  <div className="grid grid-cols-2 gap-3">{zones.map(z=>(<Button key={z.id} variant={selectedZone===z.id?'default':'outline'} className={`${selectedZone===z.id?z.color:'bg-white'} border-2 rounded-xl h-12 font-bold`} onClick={()=>this.setState({selectedZone:z.id})}>{z.label}</Button>))}</div>
                </div>
                <div><label className="text-sm font-bold text-slate-500 uppercase mb-3 block">Player Involvement</label>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1 border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 h-14 font-bold rounded-xl" onClick={()=>this.handleAddTag('involved_start')}><Play className="mr-2 w-5 h-5 fill-current"/>Start</Button>
                    <Button variant="outline" className="flex-1 border-2 border-red-500 text-red-700 hover:bg-red-50 h-14 font-bold rounded-xl" onClick={()=>this.handleAddTag('involved_end')} disabled={invS.length<=invE.length}><Pause className="mr-2 w-5 h-5 fill-current"/>End</Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col h-[400px]">
                <label className="text-sm font-bold text-slate-500 uppercase mb-3 block">Tagged Pairs ({Math.min(invS.length,invE.length)})</label>
                <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                  {invS.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center"><Scissors className="w-12 h-12 mb-3 opacity-20"/><p>No tags marked yet</p></div> : 
                  Array.from({length:Math.min(invS.length,invE.length)}).map((_,i)=>{
                    const s=invS[i], en=invE[i], q=pendingSegments.find(ps=>ps.startTagId===s.id);
                    return (
                      <div key={i} className="p-4 border-2 border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center hover:border-emerald-200 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">{i+1}</div>
                          <div><p className="font-bold text-slate-800">{this.formatTime(s.timestamp/1000).substring(3)} - {this.formatTime(en.timestamp/1000).substring(3)}</p><Badge variant="outline" className="text-[10px] bg-white border-slate-300 text-slate-500">{s.zone}</Badge></div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="icon" variant="ghost" onClick={async()=>{await videoTagService.delete(s.id); await videoTagService.delete(en.id); await this.loadTags();}} className="hover:bg-red-50 text-red-500"><Trash2 className="w-5 h-5"/></Button>
                          {!q && <Button size="sm" onClick={()=>this.handleCreatePendingSegment(s,en)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4">+ Queue</Button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-bold text-slate-600">Queued Segments: {pendingSegments.length}</span>
                {pendingSegments.length>0 && <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 rounded-xl" onClick={this.handleConfirmPlayerVideo}>Confirm All and Create Analyst Task</Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {showGallery && video?.sample_frames && (
          <PlayerIdentificationGallery frames={video.sample_frames} playerName={video.player_name} onClose={() => this.setState({ showGallery: false })} />
        )}
      </div>
    );
  }
}

export default VideoEditorWithRouter;
