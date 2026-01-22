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
  Scissors
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
          body { margin: 0; font-family: sans-serif; padding: 20px; color: #1e293b; }
          .zone-btn { padding: 8px 16px; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; background: white; margin-right: 5px; }
          .zone-btn.selected { background: #10b981; color: white; border-color: #10b981; }
          .tag-btn { padding: 10px 16px; border: 2px solid #e2e8f0; border-radius: 8px; cursor: pointer; background: white; width: 48%; }
          .tag-btn.success { border-color: #10b981; color: #10b981; }
          .tag-btn.danger { border-color: #ef4444; color: #ef4444; }
          .tag-btn:disabled { opacity: 0.5; }
          .card { padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
          .primary-btn { background: #10b981; color: white; padding: 12px; border: none; border-radius: 8px; cursor: pointer; width: 100%; font-weight: 600; margin-top: 20px; }
        </style></head>
        <body>
          <h2>Quick Tagging Dashboard</h2>
          <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin-bottom: 20px;">
            Current Time: <span id="current-time" style="font-family: monospace; font-size: 18px;">00:00</span>
          </div>
          <div id="pending-banner" style="display:none; background:#ecfdf5; padding:10px; border-radius:8px; margin-bottom:10px;">
            Start Marked at <span id="pending-time">00:00</span>
          </div>
          <div style="margin-bottom: 20px;">
            <strong>Zones:</strong><br/>
            <button class="zone-btn" id="zone-defending" onclick="window.selectZone('defending')">Defending</button>
            <button class="zone-btn" id="zone-midfield" onclick="window.selectZone('midfield')">Midfield</button>
            <button class="zone-btn" id="zone-attacking" onclick="window.selectZone('attacking')">Attacking</button>
            <button class="zone-btn" id="zone-transition" onclick="window.selectZone('transition')">Transition</button>
          </div>
          <div style="margin-bottom: 20px; display:flex; justify-content:space-between;">
            <button class="tag-btn success" id="start-btn" onclick="window.opener.handleTagFromPopup('involved_start')">▶ Start</button>
            <button class="tag-btn danger" id="end-btn" onclick="window.opener.handleTagFromPopup('involved_end')" disabled>⏸ End</button>
          </div>
          <strong>Pairs:</strong><div id="list"></div>
          <button id="confirm-btn" class="primary-btn" style="display:none;" onclick="window.opener.handleConfirmFromPopup()">Confirm All</button>
          <script>
            let selZone = null;
            const fmt = (s) => { if(isNaN(s)) return "00:00"; const m=Math.floor(s/60), sec=Math.floor(s%60); return m.toString().padStart(2,'0')+':'+sec.toString().padStart(2,'0'); };
            window.selectZone = (z) => { selZone=z; document.querySelectorAll('.zone-btn').forEach(b=>b.classList.remove('selected')); document.getElementById('zone-'+z).classList.add('selected'); window.opener.setSelectedZoneFromPopup(z); };
            window.addEventListener('message', (e) => {
              if(e.data.type==='UPDATE_TIME') document.getElementById('current-time').textContent = fmt(e.data.time);
              if(e.data.type==='UPDATE_DATA') {
                const { involvedStarts, involvedEnds, pendingSegments, hasPendingStart, lastStartTime, currentZone, segments } = e.data;
                const banner = document.getElementById('pending-banner');
                if(hasPendingStart) { banner.style.display='block'; document.getElementById('pending-time').textContent=fmt(lastStartTime/1000); document.getElementById('start-btn').disabled=true; document.getElementById('end-btn').disabled=false; }
                else { banner.style.display='none'; document.getElementById('start-btn').disabled=false; document.getElementById('end-btn').disabled=true; }
                const list = document.getElementById('list'); list.innerHTML = '';
                const count = Math.min(involvedStarts.length, involvedEnds.length);
                for(let i=0; i<count; i++) {
                  const s=involvedStarts[i], en=involvedEnds[i];
                  const q = pendingSegments.some(ps=>ps.startTagId===s.id), sv = segments.some(seg=>Math.abs(seg.start_time-s.timestamp/1000)<0.5);
                  const div = document.createElement('div'); div.className='card';
                  div.innerHTML = \`<div>\${fmt(s.timestamp/1000)} - \${fmt(en.timestamp/1000)} [\${s.zone||''}] \${q?'(Queued)':''} \${sv?'(Saved)':''}</div>
                    <div><button onclick="window.opener.deleteTagPairFromPopup('\${s.id}','\${en.id}')">🗑</button>
                    \${(!q && !sv)?\`<button onclick="window.opener.handleCreatePendingSegmentFromPopup(\${i})">+ Queue</button>\`:''}</div>\`;
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
      if(s&&en) { const ms=this.state.segments.find(seg=>Math.abs(seg.start_time-s.timestamp/1000)<0.5); if(ms) await videoSegmentService.delete(ms.id); }
      this.handleRemovePendingSegment(sid,eid); await videoTagService.delete(sid); await videoTagService.delete(eid);
      await this.loadTags(); await this.loadSegments();
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
