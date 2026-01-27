import React, { Component } from 'react';
import { videoTagService, videoSegmentService, videoTaskService, videoService, storageService } from '../api/apiClient';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Input } from "../Components/ui/input";
import { Textarea } from "../Components/ui/textarea";
import { Slider } from "../Components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../Components/ui/dialog";
import { Maximize2, ExternalLink } from 'lucide-react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Flag,
  MapPin,
  Eye,
  EyeOff,
  Users,
  UserCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Scissors,
  Video,
  ChevronLeft,
  ChevronRight,
  User
} from 'lucide-react';
import { Skeleton } from "../Components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';
import TimelineThumbnail from '../Components/video/TimelineThumbnail';
import EnhancedTimeline from '../Components/video/EnhancedTimeline';
import PlayerIdentificationGallery from '../Components/video/PlayerIdentificationGallery';

// Wrapper component to handle navigation and query client
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
      // Data
      allTasks: [],
      allVideos: [],
      task: null,
      video: null,
      tags: [],
      segments: [],
      isNewVideo: false,
      showCreateTaskDialog: false,
      taskPriority: 'medium',
      
      // Loading states
      allTasksLoading: true,
      taskLoading: true,
      videoLoading: true,
      
      // Video player state
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      matchStartSet: false,
      matchStartTime: 0,
      playUntilTime: null,
      
      // UI state
      selectedZone: null,
      noteText: '',
      showTaggingDialog: false,
      selectedTag: null,
      selectedFrame: null,
      isDragging: false,
      dialogPosition: { x: 0, y: 0 },
      showGallery: false,
      isPopupOpen: false,
      pendingSegments: [],
      
      // Filters
      searchTerm: '',
      statusFilter: 'all'
    };
  }

  componentDidMount() {
    this.loadData();
    this.setupPopupHandlers();
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.taskId !== this.props.taskId || prevProps.videoId !== this.props.videoId) {
      this.loadData();
    }

    if (prevState.task !== this.state.task && this.state.task) {
      if (this.state.task.match_start_time !== undefined && this.state.task.match_start_time !== null) {
        this.setState({
          matchStartTime: this.state.task.match_start_time,
          matchStartSet: true
        });
      }
    }

    if (prevState.tags !== this.state.tags) {
      this.updatePopupSegments();
    }
  }

  componentWillUnmount() {
    this.cleanupPopupHandlers();
  }

  setupPopupHandlers = () => {
    window.handleTagFromPopup = (tagType) => {
      this.handleAddTag(tagType);
    };

    window.setSelectedZoneFromPopup = (zone) => {
      this.setState({ selectedZone: zone });
    };

    window.deleteTagPairFromPopup = async (startId, endId) => {
      try {
        const allTags = await videoTagService.filter({ video_id: this.state.video?.id });
        const allSegments = await videoSegmentService.filter({ video_id: this.state.video?.id });
        
        const startTag = allTags.find(t => t.id === startId);
        const endTag = allTags.find(t => t.id === endId);
        
        if (startTag && endTag) {
          // Convert timestamps from milliseconds to seconds for comparison
          const startTimeSeconds = startTag.timestamp / 1000;
          const endTimeSeconds = endTag.timestamp / 1000;
          
          const matchingSegment = allSegments.find(seg => 
            Math.abs(seg.start_time - startTimeSeconds) < 0.5 && 
            Math.abs(seg.end_time - endTimeSeconds) < 0.5
          );
          if (matchingSegment) {
            await videoSegmentService.delete(matchingSegment.id).catch(() => {});
          }
        }

        await videoTagService.delete(startId).catch(() => {});
        await videoTagService.delete(endId).catch(() => {});

        this.loadTags();
        this.loadSegments();
      } catch (error) {
        console.error('Delete error:', error);
      }
    };

    window.handleConfirmFromPopup = () => {
      this.handleConfirmPlayerVideo();
    };

    window.addToQueueFromPopup = async (startId, endId) => {
      try {
        const allTags = await videoTagService.filter({ video_id: this.state.video?.id });
        const startTag = allTags.find(t => t.id === startId);
        const endTag = allTags.find(t => t.id === endId);
        
        if (startTag && endTag) {
          this.handleAddToQueue(startTag, endTag);
        }
      } catch (error) {
        console.error('Add to queue error:', error);
      }
    };

    window.confirmSegmentsFromPopup = async (queuedSegments) => {
      try {
        console.log('Confirming segments from popup:', queuedSegments);
        const { video, task } = this.state;
        
        for (const seg of queuedSegments) {
          const startTimeMs = Math.round(seg.startTime * 1000);
          const endTimeMs = Math.round(seg.endTime * 1000);
          
          await videoSegmentService.create({
            video_id: video?.id,
            start_time: startTimeMs,
            end_time: endTimeMs,
            segment_type: 'player_involvement',
            status: 'pending',
            zone: seg.zone || this.state.selectedZone
          });
          
          // Delete the original tags after creating the segment
          try {
            await videoTagService.delete(seg.startId);
            await videoTagService.delete(seg.endId);
          } catch (deleteError) {
            console.log('Tag already deleted or not found:', deleteError);
          }
        }
        
        // Reload both tags and segments
        await this.loadData();
        console.log('All segments confirmed from popup');
      } catch (error) {
        console.error('Confirm segments error:', error);
      }
    };
  };

  cleanupPopupHandlers = () => {
    delete window.handleTagFromPopup;
    delete window.setSelectedZoneFromPopup;
    delete window.deleteTagPairFromPopup;
    delete window.addToQueueFromPopup;
    delete window.confirmSegmentsFromPopup;
    delete window.handleConfirmFromPopup;
  };

  loadData = async () => {
    if (!this.props.taskId && !this.props.videoId) {
      await this.loadAllTasks();
      await this.loadAllVideos();
    } else if (this.props.videoId) {
      // Loading a new video that was just uploaded
      await this.loadVideoById(this.props.videoId);
      this.setState({ isNewVideo: true, showCreateTaskDialog: true });
    } else {
      await this.loadTask();
      await this.loadTags();
      await this.loadSegments();
    }
  };

  loadAllTasks = async () => {
    this.setState({ allTasksLoading: true });
    try {
      const tasks = await videoTaskService.filter({ task_type: 'video_processing' }, '-created_at');
      this.setState({ allTasks: tasks, allTasksLoading: false });
    } catch (error) {
      this.setState({ allTasksLoading: false });
    }
  };

  loadAllVideos = async () => {
    try {
      const videos = await videoService.list();
      this.setState({ allVideos: videos });
    } catch (error) {}
  };

  loadTask = async () => {
    if (!this.props.taskId) return;
    
    this.setState({ taskLoading: true });
    try {
      const task = await videoTaskService.get(this.props.taskId);
      this.setState({ task, taskLoading: false });
      
      if (task?.video_id) {
        await this.loadVideo(task.video_id);
      }
    } catch (error) {
      this.setState({ taskLoading: false });
    }
  };

  loadVideo = async (videoId) => {
    this.setState({ videoLoading: true });
    try {
      const video = await videoService.get(videoId);
      if (video) {
        this.setState({ video, videoLoading: false });
        // Extract frames automatically when video is loaded
        if (video.url) {
          this.handleExtractFrames(video.url);
        }
      } else {
        this.setState({ videoLoading: false });
      }
    } catch (error) {
      this.setState({ videoLoading: false });
    }
  };

  handleExtractFrames = async (videoUrl) => {
    try {
      const result = await actionAnnotationService.extractFrames(videoUrl);
      if (result && result.frames) {
        this.setState({ timelineFrames: result.frames });
      }
    } catch (error) {
      console.error('Error extracting frames:', error);
    }
  };

  loadVideoById = async (videoId) => {
    this.setState({ videoLoading: true });
    try {
      const video = await videoService.get(videoId);
      if (video) {
        this.setState({ video, videoLoading: false });
      } else {
        this.setState({ videoLoading: false });
      }
    } catch (error) {
      this.setState({ videoLoading: false });
    }
  };

  createProcessingTask = async () => {
    const { video, taskPriority } = this.state;
    try {
      this.setState({ taskLoading: true });
      
      // Create the processing task
      const task = await videoTaskService.create({
        video_id: video.id,
        task_type: 'video_processing',
        status: 'pending_processing',
        priority: taskPriority
      });

      // Load the task to display it
      this.setState({ 
        task, 
        isNewVideo: false, 
        showCreateTaskDialog: false,
        taskLoading: false 
      });
    } catch (error) {
      console.error('Error creating task:', error);
      this.setState({ taskLoading: false });
    }
  };

  loadTags = async () => {
    if (!this.props.taskId && !this.state.task) return;
    const taskId = this.props.taskId || this.state.task?.id;
    try {
      const tags = await videoTagService.filter({ video_id: this.state.video?.id });
      this.setState({ tags });
    } catch (error) {}
  };

  loadSegments = async () => {
    if (!this.props.taskId && !this.state.task) return;
    const taskId = this.props.taskId || this.state.task?.id;
    try {
      const rawSegments = await videoSegmentService.filter({ video_id: this.state.video?.id });
      // Convert millisecond timestamps from database to seconds for display
      // Also map segment_type to zone for color display
      const segments = rawSegments.map(seg => ({
        ...seg,
        start_time: seg.start_time / 1000,
        end_time: seg.end_time / 1000,
        zone: seg.segment_type // Use segment_type as zone for color mapping
      }));
      this.setState({ segments });
    } catch (error) {}
  };

  formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  getMatchTime = (videoTime) => {
    if (!this.state.matchStartSet) return videoTime;
    return Math.max(0, videoTime - this.state.matchStartTime);
  };

  handlePlayPause = () => {
    if (this.videoRef.current) {
      if (this.state.isPlaying) {
        this.videoRef.current.pause();
      } else {
        this.videoRef.current.play();
      }
      this.setState({ isPlaying: !this.state.isPlaying });
    }
  };

  handleSeek = (value) => {
    if (this.videoRef.current) {
      this.videoRef.current.currentTime = value[0];
      this.setState({ currentTime: value[0] });
    }
  };

  handleSkip = (seconds) => {
    if (this.videoRef.current) {
      const newTime = Math.max(0, Math.min(this.state.duration, this.videoRef.current.currentTime + seconds));
      this.videoRef.current.currentTime = newTime;
      this.setState({ currentTime: newTime });
    }
  };

  handleSetMatchStart = async () => {
    const { currentTime } = this.state;
    this.setState({ 
      matchStartTime: currentTime,
      matchStartSet: true 
    });
    
    try {
      await videoTaskService.update(this.props.taskId, { 
        match_start_time: Math.round(currentTime * 1000), 
        status: 'in_progress' 
      });
      await this.loadTask();
    } catch (error) {}
  };

  handleAddTag = async (tagType) => {
    const { currentTime, selectedZone, task, matchStartTime } = this.state;
    const taskId = this.props.taskId || task?.id;
    if (!taskId || !this.state.video?.id) {
      console.warn('Missing taskId or videoId:', { taskId, videoId: this.state.video?.id });
      return;
    }
    
    try {
      const matchTime = this.getMatchTime(currentTime);
      const timestampMs = Math.round(matchTime * 1000); // Convert to milliseconds as integer
      
      console.log('Creating tag:', { tagType, matchTime, timestampMs, selectedZone });
      
      await videoTagService.create({
        video_id: this.state.video.id,
        timestamp: timestampMs,
        tag_type: tagType,
        tag_name: tagType,
        zone: selectedZone,
        description: `Tag at ${matchTime.toFixed(2)}s`
      });
      await this.loadTags();
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  handleCreatePendingSegment = (startTag, endTag) => {
    const { pendingSegments, segments } = this.state;
    
    // Convert timestamps from milliseconds to seconds for comparison
    let startTimeSeconds = startTag.timestamp / 1000;
    let endTimeSeconds = endTag.timestamp / 1000;
    
    // Ensure start time is always before end time
    if (startTimeSeconds > endTimeSeconds) {
      [startTimeSeconds, endTimeSeconds] = [endTimeSeconds, startTimeSeconds];
    }
    
    const alreadyPending = pendingSegments.find(seg => 
      Math.abs(seg.start_time - startTimeSeconds) < 0.5 && 
      Math.abs(seg.end_time - endTimeSeconds) < 0.5
    );

    if (!alreadyPending) {
      this.setState({
        pendingSegments: [...pendingSegments, {
          start_time: startTimeSeconds,
          end_time: endTimeSeconds,
          zone: startTag.zone || this.state.selectedZone,
          startTagId: startTag.id,
          endTagId: endTag.id
        }]
      });
    }
  };

  handleRemovePendingSegment = (startTagId, endTagId) => {
    this.setState({
      pendingSegments: this.state.pendingSegments.filter(seg => 
        seg.startTagId !== startTagId || seg.endTagId !== endTagId
      )
    });
  };

  handleConfirmPlayerVideo = async () => {
    const { pendingSegments, segments, video, task } = this.state;
    
    for (const seg of pendingSegments) {
      // Convert times from seconds to milliseconds (as integers)
      const startTimeMs = Math.round(seg.start_time * 1000);
      const endTimeMs = Math.round(seg.end_time * 1000);
      
      await videoSegmentService.create({
        video_id: video.id,
        start_time: startTimeMs,
        end_time: endTimeMs,
        segment_type: seg.zone || 'player_involvement',
        description: `${seg.zone} - Player segment from ${seg.start_time.toFixed(2)}s to ${seg.end_time.toFixed(2)}s`
      });
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    await videoTaskService.update(this.props.taskId, { 
      status: 'completed'
    });

    await videoTaskService.create({
      video_id: video.id,
      task_type: 'analyst_annotation',
      status: 'pending_assignment',
      priority: task?.priority || 'medium',
      notes: task?.notes
    });

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
              }
              .zone-btn { 
                padding: 8px 16px; 
                border: 1px solid #e2e8f0; 
                border-radius: 6px; 
                cursor: pointer; 
                background: white;
                font-size: 14px;
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
                gap: 8px;
              }
              .tag-btn:hover { background: #f8fafc; }
              .tag-btn.success { border-color: #10b981; color: #10b981; }
              .tag-btn.danger { border-color: #ef4444; color: #ef4444; }
              .segment-item {
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 8px;
                border: 2px solid #e2e8f0;
                background: white;
              }
              .segment-item.queued {
                border-color: #3b82f6;
                background: #eff6ff;
              }
              .segment-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
              }
              .segment-info {
                display: flex;
                align-items: center;
                gap: 12px;
              }
              .delete-btn {
                background: transparent;
                color: #ef4444;
                border: none;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
              }
              .delete-btn:hover {
                background: #fee2e2;
              }
              .add-queue-btn {
                width: 100%;
                margin-top: 8px;
                padding: 10px 16px;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
              }
              .add-queue-btn:hover {
                background: #2563eb;
              }
              .segment-number {
                width: 32px;
                height: 32px;
                background: #d1fae5;
                color: #059669;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 14px;
              }
              .segment-number.queued {
                background: #3b82f6;
                color: white;
              }
              .zone-badge {
                display: inline-block;
                padding: 2px 8px;
                font-size: 12px;
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                margin-top: 4px;
                background: white;
                color: #6b7280;
                text-transform: capitalize;
              }
              .ready-badge {
                display: flex;
                align-items: center;
                gap: 4px;
                color: #3b82f6;
                font-size: 13px;
                margin-top: 8px;
              }
              .queued-section {
                margin-top: 20px;
                padding: 16px;
                background: #f8fafc;
                border-radius: 8px;
              }
              .queued-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: white;
                border-radius: 6px;
                margin-bottom: 6px;
                font-size: 14px;
              }
              .confirm-btn {
                width: 100%;
                margin-top: 16px;
                padding: 14px;
                background: #059669;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              }
              .confirm-btn:hover {
                background: #047857;
              }
              .confirm-btn:disabled {
                background: #94a3b8;
                cursor: not-allowed;
              }
            </style>
          </head>
          <body>
            <h2 style="margin-bottom: 8px;">Quick Tagging Dashboard</h2>
            <p style="color: #64748b; margin-bottom: 20px;">Use this window for tagging while watching the video in the main window</p>
            
            <div style="margin-bottom: 20px;">
              <p style="font-weight: 600; margin-bottom: 4px;">Current Time: <span id="current-time">00:00</span></p>
              <p style="color: #64748b; font-size: 14px;">Synced with video player</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <strong style="display: block; margin-bottom: 8px;">Field Zone</strong>
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
                <button class="zone-btn" onclick="selectZone('defending', this)">Defending</button>
                <button class="zone-btn" onclick="selectZone('midfield', this)">Midfield</button>
                <button class="zone-btn" onclick="selectZone('attacking', this)">Attacking</button>
                <button class="zone-btn" onclick="selectZone('transition', this)">Transition</button>
              </div>
              <p id="selected-zone" style="margin-top: 8px; color: #64748b; font-size: 14px;">No zone selected</p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <strong style="display: block; margin-bottom: 8px;">Player Involvement</strong>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                <button class="tag-btn success" onclick="handleTag('involved_start')">▶ Start</button>
                <button class="tag-btn danger" onclick="handleTag('involved_end')">⏸ End</button>
              </div>
            </div>
            
            <div>
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <strong>Tagged Pairs (<span id="segment-count">0</span>)</strong>
                <span style="color: #10b981;">✂</span>
              </div>
              <div id="segments-list" style="max-height: 300px; overflow-y: auto;"></div>
            </div>
            
            <div class="queued-section">
              <p style="font-weight: 600; margin-bottom: 12px;">Queued Segments (<span id="queued-count">0</span>)</p>
              <div id="queued-list"></div>
              <button class="confirm-btn" id="confirm-btn" onclick="confirmAll()" disabled>
                ⏱ Confirm All & Create Analyst Task (<span id="confirm-count">0</span>)
              </button>
            </div>
            
            <script>
              var selectedZone = 'defending';
              var queuedSegments = [];
              var allStarts = [];
              var allEnds = [];
              
              function selectZone(zone, btn) {
                selectedZone = zone;
                document.querySelectorAll('.zone-btn').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                document.getElementById('selected-zone').textContent = 'Zone: ' + zone;
                if (window.opener && window.opener.setSelectedZoneFromPopup) {
                  window.opener.setSelectedZoneFromPopup(zone);
                }
              }
              
              function handleTag(tagType) {
                if (window.opener && window.opener.handleTagFromPopup) {
                  window.opener.handleTagFromPopup(tagType);
                }
              }
              
              function formatTime(seconds) {
                var h = Math.floor(seconds / 3600);
                var m = Math.floor((seconds % 3600) / 60);
                var s = Math.floor(seconds % 60);
                if (h > 0) return h.toString().padStart(2,'0') + ':' + m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');
                return m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');
              }
              
              var confirmedSegments = [];
              
              function renderQueued() {
                var list = document.getElementById('queued-list');
                var pendingCount = queuedSegments.filter(function(s) { return !s.confirmed; }).length;
                var totalCount = queuedSegments.length;
                document.getElementById('queued-count').textContent = totalCount;
                document.getElementById('confirm-count').textContent = pendingCount;
                document.getElementById('confirm-btn').disabled = pendingCount === 0;
                
                if (totalCount === 0) {
                  list.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 16px; font-size: 14px;">No segments queued yet</p>';
                } else {
                  var html = '';
                  for (var i = 0; i < queuedSegments.length; i++) {
                    var seg = queuedSegments[i];
                    if (seg.confirmed) {
                      html += '<div class="queued-item" style="background: #d1fae5; border: 1px solid #10b981;">';
                      html += '<span style="color: #10b981; font-weight: 600;">✓</span>';
                      html += '<span style="font-weight: 500;">#' + (i + 1) + '</span>';
                      html += '<span>' + formatTime(seg.startTime) + ' - ' + formatTime(seg.endTime) + '</span>';
                      html += '<span class="zone-badge" style="background: #10b981; color: white; border-color: #10b981;">' + (seg.zone || 'No zone') + '</span>';
                      html += '<span style="color: #10b981; font-size: 12px; font-weight: 600;">Confirmed</span>';
                      html += '</div>';
                    } else {
                      html += '<div class="queued-item">';
                      html += '<span style="color: #3b82f6; font-weight: 600;">●</span>';
                      html += '<span style="font-weight: 500;">#' + (i + 1) + '</span>';
                      html += '<span>' + formatTime(seg.startTime) + ' - ' + formatTime(seg.endTime) + '</span>';
                      html += '<span class="zone-badge">' + (seg.zone || 'No zone') + '</span>';
                      html += '</div>';
                    }
                  }
                  list.innerHTML = html;
                }
              }
              
              function renderAll() {
                renderSegments();
                renderQueued();
              }
              
              function renderSegments() {
                var pairCount = Math.min(allStarts.length, allEnds.length);
                document.getElementById('segment-count').textContent = pairCount;
                var list = document.getElementById('segments-list');
                
                if (allStarts.length === 0 && allEnds.length === 0) {
                  list.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 32px 0; font-size: 14px;">No tags yet.<br/>Mark player involvement start and end times.</p>';
                  return;
                }
                
                var html = '';
                for (var idx = 0; idx < pairCount; idx++) {
                  var start = allStarts[idx];
                  var end = allEnds[idx];
                  var isQueued = queuedSegments.find(function(s) { return s.startId === start.id; });
                  var startSec = start.timestamp / 1000;
                  var endSec = end.timestamp / 1000;
                  
                  html += '<div class="segment-item ' + (isQueued ? 'queued' : '') + '" data-idx="' + idx + '">';
                  html += '  <div class="segment-row">';
                  html += '    <div class="segment-info">';
                  html += '      <div class="segment-number ' + (isQueued ? 'queued' : '') + '">' + (idx + 1) + '</div>';
                  html += '      <div>';
                  html += '        <p style="font-weight: 600; font-size: 14px; margin: 0;">' + formatTime(startSec) + ' - ' + formatTime(endSec) + '</p>';
                  html += start.zone ? '<span class="zone-badge">' + start.zone + '</span>' : '';
                  html += '      </div>';
                  html += '    </div>';
                  html += '    <button class="delete-btn" data-action="delete" data-idx="' + idx + '">🗑️</button>';
                  html += '  </div>';
                  
                  if (isQueued) {
                    html += '  <div class="ready-badge">⏱ Ready to confirm</div>';
                  } else {
                    html += '  <button class="add-queue-btn" data-action="add" data-idx="' + idx + '">+ Add to Queue</button>';
                  }
                  
                  html += '</div>';
                }
                
                if (allStarts.length > allEnds.length) {
                  var lastStart = allStarts[allStarts.length - 1];
                  html += '<div class="segment-item" style="background: #fef3c7; border-color: #fbbf24;">';
                  html += '  <div class="segment-row">';
                  html += '    <div class="segment-info">';
                  html += '      <div class="segment-number" style="background: #fef3c7; color: #92400e; border: 2px solid #fbbf24;">' + (pairCount + 1) + '</div>';
                  html += '      <div>';
                  html += '        <p style="font-weight: 600; font-size: 14px; margin: 0; color: #92400e;">' + formatTime(lastStart.timestamp / 1000) + ' - <em>Waiting for End</em></p>';
                  html += lastStart.zone ? '<span class="zone-badge" style="background: #fef3c7; color: #92400e;">' + lastStart.zone + '</span>' : '';
                  html += '      </div>';
                  html += '    </div>';
                  html += '  </div>';
                  html += '</div>';
                }
                
                list.innerHTML = html;
              }
              
              function confirmAll() {
                var pendingSegments = queuedSegments.filter(function(s) { return !s.confirmed; });
                if (pendingSegments.length === 0) return;
                if (window.opener && window.opener.confirmSegmentsFromPopup) {
                  window.opener.confirmSegmentsFromPopup(pendingSegments);
                  // Mark all pending segments as confirmed
                  for (var i = 0; i < queuedSegments.length; i++) {
                    if (!queuedSegments[i].confirmed) {
                      queuedSegments[i].confirmed = true;
                    }
                  }
                  renderQueued();
                  renderSegments();
                }
              }
              
              // Debounce render to prevent click interruption
              var renderTimeout = null;
              var lastDataHash = '';
              
              function scheduleRender() {
                if (renderTimeout) clearTimeout(renderTimeout);
                renderTimeout = setTimeout(function() {
                  renderAll();
                }, 100);
              }
              
              // Event delegation for dynamically created buttons
              document.getElementById('segments-list').addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                var btn = e.target;
                if (!btn.hasAttribute('data-action')) {
                  btn = btn.closest('[data-action]');
                }
                if (!btn) return;
                
                var action = btn.getAttribute('data-action');
                var idx = parseInt(btn.getAttribute('data-idx'), 10);
                
                console.log('Button clicked:', action, 'idx:', idx);
                
                if (action === 'delete' && allStarts[idx] && allEnds[idx]) {
                  var startId = allStarts[idx].id;
                  var endId = allEnds[idx].id;
                  console.log('Deleting pair:', startId, endId);
                  if (window.opener && window.opener.deleteTagPairFromPopup) {
                    window.opener.deleteTagPairFromPopup(startId, endId);
                  }
                  queuedSegments = queuedSegments.filter(function(s) { return s.startId !== startId; });
                  renderQueued();
                }
                
                if (action === 'add' && allStarts[idx] && allEnds[idx]) {
                  var start = allStarts[idx];
                  var end = allEnds[idx];
                  var startSec = start.timestamp / 1000;
                  var endSec = end.timestamp / 1000;
                  
                  console.log('Adding to queue:', start.id, '->', end.id);
                  
                  var alreadyQueued = false;
                  for (var i = 0; i < queuedSegments.length; i++) {
                    if (queuedSegments[i].startId === start.id) {
                      alreadyQueued = true;
                      break;
                    }
                  }
                  
                  if (!alreadyQueued) {
                    queuedSegments.push({
                      startId: start.id,
                      endId: end.id,
                      startTime: startSec,
                      endTime: endSec,
                      zone: start.zone || selectedZone
                    });
                    console.log('Queue now has', queuedSegments.length, 'items');
                    renderAll();
                  }
                }
              }, true);
              
              window.addEventListener('message', function(event) {
                if (event.data.type === 'UPDATE_TIME') {
                  var time = event.data.time;
                  document.getElementById('current-time').textContent = formatTime(time);
                }
                if (event.data.type === 'UPDATE_SEGMENTS') {
                  var newStarts = event.data.involvedStarts || [];
                  var newEnds = event.data.involvedEnds || [];
                  var newHash = JSON.stringify(newStarts.map(function(s){return s.id;})) + JSON.stringify(newEnds.map(function(e){return e.id;}));
                  
                  if (newHash !== lastDataHash) {
                    lastDataHash = newHash;
                    allStarts = newStarts;
                    allEnds = newEnds;
                    scheduleRender();
                  }
                }
              });
              
              // Initialize
              renderQueued();
            </script>
          </body>
        </html>
      `);
      popupWindow.document.close();

      const updatePopup = () => {
        if (popupWindow && !popupWindow.closed) {
          popupWindow.postMessage({ 
            type: 'UPDATE_TIME', 
            time: this.getMatchTime(this.state.currentTime) 
          }, '*');
          
          const involvedStarts = this.state.tags.filter(t => t.tag_type === 'involved_start');
          const involvedEnds = this.state.tags.filter(t => t.tag_type === 'involved_end');
          popupWindow.postMessage({ 
            type: 'UPDATE_SEGMENTS', 
            involvedStarts: involvedStarts,
            involvedEnds: involvedEnds,
            segmentsCreated: this.state.segments.length
          }, '*');
          requestAnimationFrame(updatePopup);
        }
      };
      updatePopup();
    }
  };

  updatePopupSegments = () => {
    if (this.popupWindowRef.current && !this.popupWindowRef.current.closed) {
      const involvedStarts = this.state.tags.filter(t => t.tag_type === 'involved_start');
      const involvedEnds = this.state.tags.filter(t => t.tag_type === 'involved_end');
      this.popupWindowRef.current.postMessage({ 
        type: 'UPDATE_SEGMENTS', 
        involvedStarts: involvedStarts,
        involvedEnds: involvedEnds
      }, '*');
    }
  };

  render() {
    const { taskId, navigate } = this.props;
    const {
      allTasks,
      allVideos,
      task,
      video,
      tags,
      segments,
      allTasksLoading,
      taskLoading,
      videoLoading,
      isPlaying,
      currentTime,
      duration,
      matchStartSet,
      matchStartTime,
      selectedZone,
      noteText,
      showTaggingDialog,
      showGallery,
      pendingSegments,
      searchTerm,
      statusFilter,
      playUntilTime
    } = this.state;

    const involvedStarts = tags.filter(t => t.tag_type === 'involved_start');
    const involvedEnds = tags.filter(t => t.tag_type === 'involved_end');
    const hasPendingStart = involvedStarts.length > involvedEnds.length;
    const lastStartTime = hasPendingStart ? involvedStarts[involvedStarts.length - 1]?.timestamp : null;

    const zones = [
      { id: 'defending', label: 'Defending', color: 'bg-red-500' },
      { id: 'midfield', label: 'Midfield', color: 'bg-amber-500' },
      { id: 'attacking', label: 'Attacking', color: 'bg-emerald-500' },
      { id: 'transition', label: 'Transition', color: 'bg-purple-500' }
    ];

    if (!taskId) {
      if (allTasksLoading) {
        return (
          <div className="space-y-6">
            <Skeleton className="h-24 rounded-xl" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
        );
      }

      const filteredTasks = allTasks.filter(task => {
        const video = allVideos.find(v => v.id === task.video_id);
        const matchesSearch = searchTerm === '' || 
          task.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          task.video_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (task.assigned_to && task.assigned_to.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (video?.title && video.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (video?.player_name && video.player_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (video?.home_team && video.home_team.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (video?.away_team && video.away_team.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      });

      return (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Video Editor Tasks</h2>
            <p className="text-slate-500 mt-1">Select a task to start editing</p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by video title, player name, match, or assigned user..."
                value={searchTerm}
                onChange={(e) => this.setState({ searchTerm: e.target.value })}
                className="w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => this.setState({ statusFilter: e.target.value })}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="pending_processing">Pending Processing</option>
              <option value="pending_assignment">Pending Assignment</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {filteredTasks.length === 0 && allTasks.length > 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Video className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg mb-2">No tasks match your filters</p>
                <p className="text-sm text-slate-400">Try adjusting your search or filters</p>
              </CardContent>
            </Card>
          ) : allTasks.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Video className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-slate-500 text-lg mb-2">No video editor tasks available</p>
                <p className="text-sm text-slate-400">Upload a video to create a new task</p>
                <Button className="mt-4" onClick={() => navigate(createPageUrl('UploadVideo'))}>
                  Upload Video
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTasks.map((task) => {
                const video = allVideos.find(v => v.id === task.video_id);
                const statusColors = {
                  pending_processing: 'bg-slate-100 text-slate-700',
                  pending_assignment: 'bg-amber-100 text-amber-700',
                  assigned: 'bg-blue-100 text-blue-700',
                  in_progress: 'bg-purple-100 text-purple-700',
                  completed: 'bg-emerald-100 text-emerald-700'
                };

                return (
                  <Card
                    key={task.id}
                    className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => navigate(createPageUrl('VideoEditor') + `?taskId=${task.id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                            {video?.title || 'Untitled Video'}
                          </CardTitle>
                          <div className="text-sm text-slate-500 mt-1 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(task.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge className={`${statusColors[task.status]} capitalize px-3 py-1`}>
                          {task.status.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center text-slate-600 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <Video className="w-4 h-4 mr-2 text-slate-400" />
                          <span className="font-medium truncate">
                            {video?.home_team && video?.away_team ? `${video.home_team} vs ${video.away_team}` : (video?.url?.split('/').pop() || 'Video file')}
                          </span>
                        </div>
                        <div className="flex items-center text-slate-600 text-sm bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <User className="w-4 h-4 mr-2 text-slate-400" />
                          <span className="font-medium">
                            {video?.player_name || task.notes || 'No player assigned'}
                          </span>
                        </div>
                        {task.assigned_to && (
                          <div className="flex items-center gap-2 text-slate-500 text-xs px-1">
                            <span>Assigned to: {task.assigned_to}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (taskLoading || videoLoading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-48 rounded-xl lg:col-span-2" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Create Task Dialog for New Videos */}
        <Dialog open={this.state.showCreateTaskDialog} onOpenChange={(open) => this.setState({ showCreateTaskDialog: open })}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Create Processing Task
              </DialogTitle>
              <DialogDescription>
                Configure and create a new processing task for this video
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Video Details</h3>
                <div className="bg-slate-50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Title:</span>
                    <span className="font-medium">{this.state.video?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Player:</span>
                    <span className="font-medium">{this.state.video?.player_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Match:</span>
                    <span className="font-medium">{this.state.video?.home_team} vs {this.state.video?.away_team}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Task Priority</label>
                <select
                  value={this.state.taskPriority}
                  onChange={(e) => this.setState({ taskPriority: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => this.setState({ showCreateTaskDialog: false })}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={this.createProcessingTask}
                  disabled={this.state.taskLoading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {this.state.taskLoading ? 'Creating...' : 'Create Task'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Video Info Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{video?.title}</h2>
            <p className="text-slate-500">
              {video?.home_team} vs {video?.away_team} • {video?.player_name} #{video?.jersey_number}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {video?.sample_frames && video.sample_frames.length > 0 && (
              <Button
                onClick={() => this.setState({ showGallery: true })}
                variant="outline"
                className="gap-2"
              >
                <User className="w-4 h-4" />
                View Player Identification Gallery
                <span className="ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                  {video.sample_frames.filter(f => f.annotation).length}/{video.sample_frames.length}
                </span>
              </Button>
            )}
            {task && (
              <>
                <Button 
                  onClick={() => this.setState({ showTaggingDialog: true })}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Open Tagging Dashboard
                </Button>
                <Badge className={task?.status === 'in_progress' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}>
                  {task?.status?.replace(/_/g, ' ')}
                </Badge>
              </>
            )}
            {!task && (
              <Button 
                onClick={() => this.setState({ showCreateTaskDialog: true })}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Processing Task
              </Button>
            )}
          </div>
        </div>

        {/* Video Player */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-black relative">
            <video
              ref={this.videoRef}
              src={video?.url ? (video.url.startsWith('http') ? video.url : `/${video.url}`) : video?.file_url}
              className="w-full h-[400px] lg:h-[500px] object-contain"
              onTimeUpdate={() => {
                const currentTime = this.videoRef.current?.currentTime || 0;
                this.setState({ currentTime });

                if (playUntilTime !== null && this.getMatchTime(currentTime) >= playUntilTime) {
                  this.videoRef.current?.pause();
                  this.setState({ isPlaying: false, playUntilTime: null });
                }
              }}
              onLoadedMetadata={() => {
                const duration = this.videoRef.current?.duration || 0;
                this.setState({ duration });
                console.log("Video loaded, duration:", duration);
              }}
              onPlay={() => this.setState({ isPlaying: true })}
              onPause={() => this.setState({ isPlaying: false })}
              onError={(e) => console.error("Video player error:", e)}
            />

            {/* Time Overlay */}
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-lg font-mono text-sm">
              {matchStartSet && (
                <span className="text-emerald-400 mr-2">Match:</span>
              )}
              {this.formatTime(this.getMatchTime(currentTime))}
            </div>
          </div>

          {/* Controls */}
          <CardContent className="p-4 bg-slate-900 space-y-4">
            {/* Playback Timeline */}
            <div className="relative">
              <Slider
                value={[currentTime]}
                max={duration}
                step={0.1}
                onValueChange={this.handleSeek}
                className="w-full"
              />
              {segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  className="absolute top-0 h-2 bg-emerald-500/50 rounded"
                  style={{
                    left: `${((seg.start_time + matchStartTime) / duration) * 100}%`,
                    width: `${((seg.end_time - seg.start_time) / duration) * 100}%`
                  }}
                />
              ))}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={() => this.handleSkip(-10)} className="text-white hover:bg-white/20">
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => this.handleSkip(-5)} className="text-white hover:bg-white/20">
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button size="icon" onClick={this.handlePlayPause} className="bg-white text-slate-900 hover:bg-white/90 w-12 h-12">
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => this.handleSkip(5)} className="text-white hover:bg-white/20">
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => this.handleSkip(10)} className="text-white hover:bg-white/20">
                  <SkipForward className="w-5 h-5" />
                </Button>
              </div>

              <div className="text-white font-mono text-sm">
                {this.formatTime(currentTime)} / {this.formatTime(duration)}
              </div>

              {!matchStartSet && (
                <Button onClick={this.handleSetMatchStart} className="bg-emerald-600 hover:bg-emerald-700">
                  <Flag className="w-4 h-4 mr-2" />
                  Set Match Start
                </Button>
              )}
            </div>

            {/* Player Segments Timeline */}
            <div className="pt-4 border-t border-slate-700">
              <EnhancedTimeline
                segments={segments}
                duration={duration}
                currentTime={this.getMatchTime(currentTime)}
                matchStartTime={matchStartTime}
                onSeek={(time) => {
                  if (this.videoRef.current) {
                    this.videoRef.current.currentTime = time + matchStartTime;
                  }
                }}
                onPlaySegment={(segment) => {
                  if (this.videoRef.current) {
                    this.videoRef.current.currentTime = segment.start_time + matchStartTime;
                    this.videoRef.current.play();
                    this.setState({ isPlaying: true, playUntilTime: segment.end_time });
                  }
                }}
                onUpdateSegment={async (id, data) => {
                  // Convert seconds back to milliseconds for database
                  const dbData = {};
                  if (data.start_time !== undefined) dbData.start_time = Math.round(data.start_time * 1000);
                  if (data.end_time !== undefined) dbData.end_time = Math.round(data.end_time * 1000);
                  await videoSegmentService.update(id, dbData);
                  await this.loadSegments();
                }}
                onDeleteSegment={async (id) => {
                  try {
                    const segment = segments.find(seg => seg.id === id);
                    if (!segment) return;

                    const matchingStartTag = tags.find(t => 
                      t.tag_type === 'involved_start' && 
                      Math.abs(t.timestamp / 1000 - segment.start_time) < 0.5
                    );
                    const matchingEndTag = tags.find(t => 
                      t.tag_type === 'involved_end' && 
                      Math.abs(t.timestamp / 1000 - segment.end_time) < 0.5
                    );

                    if (matchingStartTag) {
                      await videoTagService.delete(matchingStartTag.id).catch(() => {});
                    }
                    if (matchingEndTag) {
                      await videoTagService.delete(matchingEndTag.id).catch(() => {});
                    }

                    await videoSegmentService.delete(id).catch(() => {});
                    
                    await this.loadTags();
                    await this.loadSegments();
                  } catch (error) {}
                }}
                onEditSegment={(segment) => {
                  if (this.videoRef.current) {
                    this.videoRef.current.currentTime = segment.start_time + matchStartTime;
                  }
                  if (segment.zone) {
                    this.setState({ selectedZone: segment.zone });
                  }
                  this.setState({ showTaggingDialog: true });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Player Identification Gallery */}
        {showGallery && video?.sample_frames && (
          <PlayerIdentificationGallery
            frames={video.sample_frames}
            playerName={video.player_name}
            onClose={() => this.setState({ showGallery: false })}
          />
        )}

        {/* Tagging Dashboard Dialog */}
        <Dialog open={showTaggingDialog} onOpenChange={(open) => this.setState({ showTaggingDialog: open })}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-emerald-500" />
                    Quick Tagging Dashboard
                  </DialogTitle>
                  <DialogDescription>
                    Mark player involvement periods and create segments for analysis
                  </DialogDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handlePopOutDashboard}
                  className="gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Pop Out (Dual Monitor)
                </Button>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* Left Column - Tagging Controls */}
              <div className="space-y-6">
                {/* Zone Selection */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-3">Field Zone</p>
                  <div className="grid grid-cols-4 gap-2">
                    {zones.map(zone => (
                      <Button
                        key={zone.id}
                        variant={selectedZone === zone.id ? 'default' : 'outline'}
                        className={selectedZone === zone.id ? zone.color : ''}
                        onClick={() => this.setState({ selectedZone: zone.id })}
                      >
                        {zone.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Player Involvement Markers */}
                <div>
                  <div className="mb-3">
                    <p className="text-sm font-medium text-slate-700 mb-2">Player Involvement</p>
                    {hasPendingStart && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-emerald-700">Start Marked</span>
                          </div>
                          <span className="text-sm font-mono text-emerald-600">{this.formatTime(lastStartTime / 1000)}</span>
                        </div>
                        <p className="text-xs text-emerald-600 mt-1">Click "End" to complete the segment</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className={`${hasPendingStart ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-emerald-500 text-emerald-600'} hover:bg-emerald-50`}
                      onClick={() => this.handleAddTag('involved_start')}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                      onClick={() => this.handleAddTag('involved_end')}
                      disabled={!hasPendingStart}
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      End
                    </Button>
                  </div>
                </div>
              </div>

              {/* Right Column - Segments Preview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-700">Tagged Pairs ({Math.min(involvedStarts.length, involvedEnds.length)})</p>
                  <Scissors className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {involvedStarts.length === 0 && involvedEnds.length === 0 ? (
                    <p className="text-slate-500 text-center py-8 text-sm">
                      No tags yet.<br/>
                      Mark player involvement start and end times.
                    </p>
                  ) : (
                    <>
                    {Array.from({ length: Math.min(involvedStarts.length, involvedEnds.length) }).map((_, idx) => {
                      const startTag = involvedStarts[idx];
                      const endTag = involvedEnds[idx];
                      const isPending = pendingSegments.find(seg => 
                        seg.startTagId === startTag.id && seg.endTagId === endTag.id
                      ) || segments.find(seg => 
                        Math.abs(seg.start_time - startTag.timestamp / 1000) < 0.5 && 
                        Math.abs(seg.end_time - endTag.timestamp / 1000) < 0.5
                      );

                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg border-2 ${isPending ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${isPending ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>
                                {idx + 1}
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {this.formatTime(startTag.timestamp / 1000)} - {this.formatTime(endTag.timestamp / 1000)}
                                </p>
                                {startTag.zone && (
                                  <Badge variant="outline" className="text-xs mt-1 capitalize">
                                    {startTag.zone}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={async () => {
                                try {
                                  console.log('Deleting tags:', { startTagId: startTag.id, endTagId: endTag.id });
                                  
                                  // Find and remove matching segment first
                                  const startTimeSeconds = startTag.timestamp / 1000;
                                  const endTimeSeconds = endTag.timestamp / 1000;
                                  
                                  const matchingSegment = segments.find(seg => 
                                    Math.abs(seg.start_time - startTimeSeconds) < 0.5 && 
                                    Math.abs(seg.end_time - endTimeSeconds) < 0.5
                                  );
                                  
                                  if (matchingSegment) {
                                    console.log('Deleting matching segment:', matchingSegment.id);
                                    await videoSegmentService.delete(matchingSegment.id);
                                  }

                                  // Remove from pending segments
                                  this.handleRemovePendingSegment(startTag.id, endTag.id);

                                  console.log('Deleting tags:', startTag.id, endTag.id);
                                  await videoTagService.delete(startTag.id);
                                  await videoTagService.delete(endTag.id);
                                  
                                  console.log('Reloading data');
                                  await this.loadTags();
                                  await this.loadSegments();
                                  console.log('Delete complete');
                                } catch (error) {
                                  console.error('Error deleting tags:', error);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {!isPending && (
                            <Button
                              size="sm"
                              className="w-full bg-blue-600 hover:bg-blue-700"
                              onClick={() => this.handleCreatePendingSegment(startTag, endTag)}
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add to Queue
                            </Button>
                          )}
                          {isPending && (
                            <div className="flex items-center gap-2 text-blue-700 text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Ready to confirm</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {hasPendingStart && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                          <p className="text-sm text-amber-700 font-medium">Incomplete pair</p>
                        </div>
                        <p className="text-xs text-amber-600 mt-1">Start: {this.formatTime(lastStartTime / 1000)} - Click End to complete</p>
                      </div>
                    )}
                    </>
                  )}
                </div>

                {/* Pending Segments List */}
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-slate-700 mb-2">Queued Segments ({pendingSegments.length})</p>
                  <div className="space-y-1 max-h-[120px] overflow-y-auto mb-3">
                    {pendingSegments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">No segments queued yet</p>
                    ) : (
                      pendingSegments.map((seg, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs bg-blue-50 p-2 rounded">
                          <div className="w-3 h-3 bg-blue-600 rounded-full" />
                          <span className="text-blue-700 font-medium">#{idx + 1}</span>
                          <span className="text-slate-600">{this.formatTime(seg.start_time)} - {this.formatTime(seg.end_time)}</span>
                          {seg.zone && <Badge variant="outline" className="text-xs capitalize">{seg.zone}</Badge>}
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      this.handleConfirmPlayerVideo();
                      this.setState({ showTaggingDialog: false });
                    }}
                    disabled={pendingSegments.length === 0}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Confirm All & Create Analyst Task ({pendingSegments.length})
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Timeline Events */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-500" />
              Timeline Events ({segments.length})
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Click on any segment to jump to that moment
            </p>
          </CardHeader>
          <CardContent>
            {segments.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500">No segments created yet</p>
                <p className="text-sm text-slate-400 mt-1">
                  Use the tagging dashboard to mark player involvement segments
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {segments.map((segment, idx) => (
                  <div
                    key={segment.id}
                    className="relative group cursor-pointer rounded-lg overflow-hidden border-2 border-emerald-500 bg-emerald-50 transition-all hover:scale-105 hover:shadow-lg"
                    onClick={() => {
                      if (this.videoRef.current) {
                        this.videoRef.current.currentTime = segment.start_time + matchStartTime;
                        this.videoRef.current.play();
                        this.setState({ isPlaying: true, playUntilTime: segment.end_time });
                      }
                    }}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-1 right-1 h-6 w-6 bg-red-500/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const matchingStartTag = tags.find(t => 
                            t.tag_type === 'involved_start' && 
                            Math.abs(t.timestamp - segment.start_time) < 3
                          );
                          const matchingEndTag = tags.find(t => 
                            t.tag_type === 'involved_end' && 
                            Math.abs(t.timestamp - segment.end_time) < 3
                          );

                          if (matchingStartTag) {
                            await videoTagService.delete(matchingStartTag.id).catch(() => {});
                          }
                          if (matchingEndTag) {
                            await videoTagService.delete(matchingEndTag.id).catch(() => {});
                          }

                          await videoSegmentService.delete(segment.id).catch(() => {});
                          
                          await this.loadTags();
                          await this.loadSegments();
                        } catch (error) {}
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>

                    <div className="w-40 h-24 bg-gradient-to-br from-emerald-600 to-emerald-800 relative flex items-center justify-center">
                      <div className="text-white text-center">
                        <div className="text-2xl font-bold mb-1">{idx + 1}</div>
                        <div className="text-xs opacity-90">Player Segment</div>
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-white text-xs font-medium">
                            {this.formatTime(segment.start_time)} - {this.formatTime(segment.end_time)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
                      <div className="bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
                        {this.formatTime(segment.start_time)}
                      </div>
                      <div className="bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
                        {this.formatTime(segment.end_time)}
                      </div>
                    </div>

                    {segment.zone && (
                      <div className="absolute bottom-2 left-2">
                        <Badge variant="outline" className="text-xs bg-white/90 capitalize">
                          {segment.zone}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default VideoEditorWithRouter;