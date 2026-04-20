import React, { Component } from 'react';
import { videoTagService, videoSegmentService, videoTaskService, videoService, storageService, actionAnnotationService } from '../api/apiClient';
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
    this.videoContainerRef = React.createRef();
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
      timelineFrames: [],
      
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
      playbackSpeed: 1,
      isFullscreen: false,
      
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
      confirmedStartIds: {},  // Track confirmed segment IDs that persist across popup close/reopen
      
      // Filters
      searchTerm: '',
      statusFilter: 'all',
      
      // Notifications
      notification: null,
      
      // Analyst task tracking
      analystTaskCreated: false
    };
  }

  componentDidMount() {
    this.loadData();
    this.setupPopupHandlers();
    this.setupFullscreenHandlers();
  }

  setupFullscreenHandlers = () => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      this.setState({ isFullscreen: isCurrentlyFullscreen });
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    this.handleFullscreenChange = handleFullscreenChange;
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
    this.cleanupFullscreenHandlers();
  }

  cleanupFullscreenHandlers = () => {
    if (this.handleFullscreenChange) {
      document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', this.handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', this.handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', this.handleFullscreenChange);
    }
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
          // Both timestamps are in milliseconds - compare directly
          const startTimeMs = startTag.timestamp;
          const endTimeMs = endTag.timestamp;
          
          // Find and delete matching segment (with 500ms tolerance)
          const matchingSegment = allSegments.find(seg => 
            Math.abs(seg.start_time - startTimeMs) < 500 && 
            Math.abs(seg.end_time - endTimeMs) < 500
          );
          if (matchingSegment) {
            console.log('Deleting segment:', matchingSegment.id);
            await videoSegmentService.delete(matchingSegment.id).catch(() => {});
          }
        }

        // Delete the tags
        await videoTagService.delete(startId).catch(() => {});
        await videoTagService.delete(endId).catch(() => {});

        // Remove from confirmed IDs state
        const newConfirmedIds = { ...this.state.confirmedStartIds };
        delete newConfirmedIds[String(startId)];
        this.setState({ confirmedStartIds: newConfirmedIds });

        // Reload data to update UI
        await this.loadTags();
        await this.loadSegments();
        
        // Update popup with new data
        this.updatePopupSegments();
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

    // Handler for popup to request initial data
    window.requestPopupUpdate = () => {
      console.log('Popup requested update');
      this.updatePopupSegments();
    };

    window.confirmSegmentsFromPopup = async (queuedSegments) => {
      try {
        console.log('Confirming segments from popup:', queuedSegments);
        const { video, task, confirmedStartIds } = this.state;
        
        // Add all confirmed IDs to the state so they persist across popup close/reopen
        const newConfirmedIds = { ...confirmedStartIds };
        
        for (const seg of queuedSegments) {
          const startTimeMs = Math.round(seg.startTime * 1000);
          const endTimeMs = Math.round(seg.endTime * 1000);
          
          // Mark this segment as confirmed in state
          newConfirmedIds[String(seg.startId)] = true;
          
          await videoSegmentService.create({
            video_id: video?.id,
            start_time: startTimeMs,
            end_time: endTimeMs,
            segment_type: seg.zone || this.state.selectedZone,
            status: 'pending',
            zone: seg.zone || this.state.selectedZone,
            description: `${seg.zone || this.state.selectedZone} - Player segment from ${seg.startTime.toFixed(2)}s to ${seg.endTime.toFixed(2)}s`
          });
        }
        
        // Save confirmed IDs to state
        this.setState({ confirmedStartIds: newConfirmedIds }, () => {
          // After state is updated, force popup to get the new data
          console.log('State updated with confirmedIds:', newConfirmedIds);
          this.updatePopupSegments();
        });
        
        // Reload segments (tags remain visible in popup)
        await this.loadSegments();
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
    delete window.requestPopupUpdate;
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
    this.setState({ videoLoading: true, analystTaskCreated: false });
    try {
      const video = await videoService.get(videoId);
      if (video) {
        // Check if an analyst task already exists for this video
        let analystTaskCreated = false;
        try {
          const tasks = await videoTaskService.list();
          const existingTask = tasks.find(t => t.video_id === videoId && t.task_type === 'analyst_annotation');
          if (existingTask) {
            analystTaskCreated = true;
          }
        } catch (error) {
          console.error('Error checking existing tasks:', error);
        }
        
        this.setState({ video, videoLoading: false, analystTaskCreated });
        console.log('Video loaded:', video);
        console.log('Video URL from backend:', video?.url);
        console.log('Video file_url from backend:', video?.file_url);
        console.log('Match start time from backend:', video?.match_start_time);
        console.log('Sample frames in video:', video?.sample_frames);
        
        // If match_start_time is set, automatically seek to that position
        if (video?.match_start_time && video.match_start_time > 0) {
          console.log('Setting match start to:', video.match_start_time);
          this.setState({ 
            matchStartSet: true, 
            matchStartTime: video.match_start_time 
          }, () => {
            // Seek to the match start time after state is updated
            setTimeout(() => {
              if (this.videoRef.current) {
                this.videoRef.current.currentTime = video.match_start_time;
                console.log('Seeked to match start time:', video.match_start_time);
              }
            }, 500);
          });
        }
        
        // Extract frames automatically when video is loaded only if sample_frames don't exist
        if (video.url && (!video.sample_frames || video.sample_frames.length === 0)) {
          console.log('Attempting to extract frames for video');
          this.handleExtractFrames(video.url, video.id);
        } else if (video.sample_frames && video.sample_frames.length > 0) {
          console.log('Sample frames already exist in video, mapping URLs if needed');
          // Ensure frames have frame_url and timestamp, preserve annotations
          const framesWithUrls = video.sample_frames.map(frame => {
            // Debug log to see frame structure
            console.log('Processing frame:', frame);
            return {
              ...frame,
              frame_url: frame.frame_url || (frame.frame_id ? `/api/frame/${frame.frame_id}` : `/api/frame/${frame.id}`),
              timestamp: frame.timestamp || (frame.frame_index ? frame.frame_index / 30 : 0),
              // Preserve annotation if it exists
              annotation: frame.annotation || null
            };
          });
          console.log('Frames with URLs ready:', framesWithUrls);
          this.setState({ timelineFrames: framesWithUrls });
        }
      } else {
        this.setState({ videoLoading: false });
      }
    } catch (error) {
      this.setState({ videoLoading: false });
    }
  };

  handleExtractFrames = async (videoUrl, videoId) => {
    try {
      if (!videoUrl) {
        console.warn('No video URL provided for frame extraction');
        return;
      }
      
      if (!videoId) {
        console.warn('No video ID provided for frame extraction');
        return;
      }
      
      console.log('Extracting frames with:', { videoUrl, videoId });
      
      const result = await actionAnnotationService.extractFrames(videoUrl, videoId);
      console.log('Frames extracted successfully:', result);
      
      if (result && result.frames && result.frames.length > 0) {
        // Map frames to include frame_url and preserve structure
        const framesWithUrls = result.frames.map(frame => ({
          frame_id: frame.id,
          frame_index: frame.frame_index,
          timestamp: frame.frame_index ? frame.frame_index / 30 : 0, // Assuming 30 fps, convert frame index to seconds
          frame_url: `/api/frame/${frame.id}`,
          width: frame.width,
          height: frame.height,
          annotation: null  // No annotations on fresh extraction
        }));
        
        // Update both timelineFrames and merge into video object
        this.setState(prevState => ({ 
          timelineFrames: framesWithUrls,
          video: {
            ...prevState.video,
            sample_frames: framesWithUrls
          }
        }));
      } else {
        console.warn('No frames returned from extraction');
      }
    } catch (error) {
      console.error('Error extracting frames:', error, 'URL:', videoUrl, 'ID:', videoId);
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
    // CHANGED: Now returns absolute video time, not match-relative time
    // This ensures segments are stored with correct absolute times
    // and align properly in AnalystDashboard
    return videoTime;
  };

  getVideoUrl = () => {
    const { video } = this.state;
    if (!video?.url && !video?.file_url) {
      return '';
    }
    
    let url = video.url || video.file_url;
    
    // If it's already a full URL (http/https), return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it already has a leading slash, return as-is
    if (url.startsWith('/')) {
      return url;
    }
    
    // Otherwise add leading slash (path like "videos/file.mp4" becomes "/videos/file.mp4")
    return `/${url}`;
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
      const { matchStartTime, matchStartSet } = this.state;
      let seekTime = value[0];
      
      // Add match start time offset if it's set
      // because the slider value is relative to match start
      if (matchStartSet && matchStartTime > 0) {
        seekTime = seekTime + matchStartTime;
      }
      
      this.videoRef.current.currentTime = seekTime;
      this.setState({ currentTime: seekTime });
    }
  };

  handleSkip = (seconds) => {
    if (this.videoRef.current) {
      const { matchStartTime, matchStartSet, duration } = this.state;
      let newTime = Math.max(0, Math.min(duration, this.videoRef.current.currentTime + seconds));
      
      // Prevent skipping before match start time
      if (matchStartSet && matchStartTime > 0) {
        newTime = Math.max(matchStartTime, newTime);
      }
      
      this.videoRef.current.currentTime = newTime;
      this.setState({ currentTime: newTime });
    }
  };

  handlePlaybackSpeedChange = (speed) => {
    if (this.videoRef.current) {
      this.videoRef.current.playbackRate = speed;
      this.setState({ playbackSpeed: speed });
    }
  };

  handleFullscreen = () => {
    const container = this.videoContainerRef.current;
    if (!container) return;

    const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);

    if (!isCurrentlyFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(err => console.error('Error attempting to enable fullscreen:', err));
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.error('Error attempting to exit fullscreen:', err));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
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
      this.updatePopupSegments();
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

    this.setState({ pendingSegments: [] });
    await this.loadSegments();
  };

  showNotification = (message, type = 'success') => {
    this.setState({ notification: { message, type } });
    setTimeout(() => {
      this.setState({ notification: null });
    }, 3000);
  };

  handleCreateAnalystTask = async () => {
    const { segments, video, task, analystTaskCreated } = this.state;
    
    if (analystTaskCreated) {
      return;
    }
    
    if (!segments || segments.length === 0) {
      this.showNotification('No segments to create analyst task. Please confirm segments first.', 'error');
      return;
    }

    try {
      await videoTaskService.create({
        video_id: video.id,
        task_type: 'analyst_annotation',
        status: 'pending_assignment',
        priority: task?.priority || 'medium',
        notes: task?.notes
      });
      this.setState({ analystTaskCreated: true });
      this.showNotification('Analyst task created successfully!', 'success');
    } catch (error) {
      console.error('Error creating analyst task:', error);
      this.showNotification('Error creating analyst task. Please try again.', 'error');
    }
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
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                <button class="zone-btn" onclick="selectZone('defending', this)">Defending</button>
                <button class="zone-btn" onclick="selectZone('attacking', this)">Attacking</button>
                <button class="zone-btn" onclick="selectZone('offensive_transition', this)">Offensive Transition</button>
                <button class="zone-btn" onclick="selectZone('defensive_transition', this)">Defensive Transition</button>
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
                ⏱ Confirm (<span id="confirm-count">0</span>)
              </button>
            </div>
            
            <script>
              var selectedZone = 'defending';
              var queuedSegments = [];
              var queuedStartIds = {};  // Track queued IDs as object for fast lookup
              var allStarts = [];
              var allEnds = [];
              
              var zoneLabels = {
                'defending': 'Defending',
                'attacking': 'Attacking',
                'offensive_transition': 'Offensive Transition',
                'defensive_transition': 'Defensive Transition'
              };
              
              function selectZone(zone, btn) {
                selectedZone = zone;
                document.querySelectorAll('.zone-btn').forEach(function(b) { b.classList.remove('selected'); });
                btn.classList.add('selected');
                document.getElementById('selected-zone').textContent = 'Zone: ' + zoneLabels[zone];
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
                return h.toString().padStart(2,'0') + ':' + m.toString().padStart(2,'0') + ':' + s.toString().padStart(2,'0');
              }
              
              function renderQueued() {
                var list = document.getElementById('queued-list');
                var count = queuedSegments.length;
                document.getElementById('queued-count').textContent = count;
                document.getElementById('confirm-count').textContent = count;
                document.getElementById('confirm-btn').disabled = count === 0;
                
                if (count === 0) {
                  list.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 16px; font-size: 14px;">No segments queued yet</p>';
                } else {
                  var html = '';
                  for (var i = 0; i < queuedSegments.length; i++) {
                    var seg = queuedSegments[i];
                    html += '<div class="queued-item">';
                    html += '<span style="color: #3b82f6; font-weight: 600;">●</span>';
                    html += '<span style="font-weight: 500;">#' + (i + 1) + '</span>';
                    html += '<span>' + formatTime(seg.startTime) + ' - ' + formatTime(seg.endTime) + '</span>';
                    var zoneLabel = zoneLabels[seg.zone] || seg.zone || 'No zone';
                    html += '<span class="zone-badge">' + zoneLabel + '</span>';
                    html += '</div>';
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
                  // Use string ID for lookup to avoid type mismatch
                  var startIdStr = String(start.id);
                  var isQueued = queuedStartIds[startIdStr] === true;
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
                if (queuedSegments.length === 0) return;
                if (window.opener && window.opener.confirmSegmentsFromPopup) {
                  window.opener.confirmSegmentsFromPopup(queuedSegments);
                  // Keep items showing as "Ready to confirm" - don't clear the queue
                  // Just update the queued section to show "Confirmed"
                  document.getElementById('confirm-btn').textContent = '✓ Confirmed!';
                  document.getElementById('confirm-btn').disabled = true;
                  document.getElementById('confirm-btn').style.background = '#10b981';
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
                  var startIdStr = String(startId);
                  console.log('Deleting pair:', startId, endId);
                  if (window.opener && window.opener.deleteTagPairFromPopup) {
                    window.opener.deleteTagPairFromPopup(startId, endId);
                  }
                  delete queuedStartIds[startIdStr];
                  queuedSegments = queuedSegments.filter(function(s) { return String(s.startId) !== startIdStr; });
                  renderQueued();
                }
                
                if (action === 'add' && allStarts[idx] && allEnds[idx]) {
                  var start = allStarts[idx];
                  var end = allEnds[idx];
                  var startIdStr = String(start.id);
                  var startSec = start.timestamp / 1000;
                  var endSec = end.timestamp / 1000;
                  
                  console.log('Adding to queue:', start.id, '->', end.id, 'as string:', startIdStr, 'with zone:', selectedZone);
                  
                  if (queuedStartIds[startIdStr]) {
                    console.log('Already queued, skipping');
                    return;
                  }
                  
                  queuedStartIds[startIdStr] = true;
                  queuedSegments.push({
                    startId: start.id,
                    endId: end.id,
                    startTime: startSec,
                    endTime: endSec,
                    zone: selectedZone
                  });
                  console.log('Queue now has', queuedSegments.length, 'items, IDs:', Object.keys(queuedStartIds));
                  renderAll();
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
                  var confirmedIds = event.data.confirmedStartIds || {};
                  var segments = event.data.segments || [];
                  var newHash = JSON.stringify(newStarts.map(function(s){return s.id;})) + JSON.stringify(newEnds.map(function(e){return e.id;}));
                  
                  console.log('UPDATE_SEGMENTS received:', {
                    confirmedIds: confirmedIds,
                    segmentsCount: segments.length,
                    startsCount: newStarts.length,
                    endsCount: newEnds.length,
                    segments: segments
                  });
                  
                  // Build a set of tag pair IDs that already have segments in the database
                  var confirmedSegmentStartIds = {};
                  segments.forEach(function(seg) {
                    // Match segments to their tag pairs by time
                    // seg.start_time is in SECONDS (from loadSegments conversion)
                    // start.timestamp is in MILLISECONDS
                    newStarts.forEach(function(start) {
                      var segStartMs = Math.round(seg.start_time * 1000); // Convert seconds to milliseconds
                      var tagStartMs = start.timestamp; // Already in milliseconds
                      console.log('Comparing segment time:', segStartMs, 'with tag time:', tagStartMs, 'diff:', Math.abs(segStartMs - tagStartMs));
                      if (Math.abs(segStartMs - tagStartMs) < 100) { // Within 100ms tolerance
                        confirmedSegmentStartIds[String(start.id)] = true;
                        console.log('Matched! Marking as confirmed:', start.id);
                      }
                    });
                  });
                  
                  // Merge confirmed IDs from parent into our local queue
                  var hasNewConfirmed = false;
                  for (var cid in confirmedIds) {
                    console.log('Checking confirmed ID from parent:', cid, 'value:', confirmedIds[cid]);
                    if (confirmedIds[cid] && !queuedStartIds[cid]) {
                      queuedStartIds[cid] = true;
                      hasNewConfirmed = true;
                      console.log('Marked as confirmed from parent:', cid);
                    }
                  }
                  
                  // Also mark segments already in database as confirmed
                  for (var csid in confirmedSegmentStartIds) {
                    console.log('Checking confirmed segment ID:', csid, 'value:', confirmedSegmentStartIds[csid]);
                    if (confirmedSegmentStartIds[csid] && !queuedStartIds[csid]) {
                      queuedStartIds[csid] = true;
                      hasNewConfirmed = true;
                      console.log('Marked as confirmed from database match:', csid);
                    }
                  }
                  
                  // Update data and re-render if segments changed OR if we got new confirmed IDs
                  if (newHash !== lastDataHash || hasNewConfirmed) {
                    lastDataHash = newHash;
                    allStarts = newStarts;
                    allEnds = newEnds;
                    scheduleRender();
                  }
                }
              });
              
              // Initialize
              renderQueued();
              
              // Request initial data from parent after a small delay to ensure listener is ready
              setTimeout(function() {
                if (window.opener && window.opener.requestPopupUpdate) {
                  window.opener.requestPopupUpdate();
                }
              }, 100);
            </script>
          </body>
        </html>
      `);
      popupWindow.document.close();

      const updatePopup = () => {
        if (popupWindow && !popupWindow.closed) {
          popupWindow.postMessage({ 
            type: 'UPDATE_TIME', 
            time: this.state.currentTime  // Send absolute video time directly
          }, '*');
          requestAnimationFrame(updatePopup);
        }
      };
      updatePopup();
    }
  };

  // Send segments update to popup only when data changes
  updatePopupSegments = () => {
    if (this.popupWindowRef.current && !this.popupWindowRef.current.closed) {
      const involvedStarts = this.state.tags.filter(t => t.tag_type === 'involved_start');
      const involvedEnds = this.state.tags.filter(t => t.tag_type === 'involved_end');
      this.popupWindowRef.current.postMessage({ 
        type: 'UPDATE_SEGMENTS', 
        involvedStarts: involvedStarts,
        involvedEnds: involvedEnds,
        confirmedStartIds: this.state.confirmedStartIds,
        segments: this.state.segments
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
      playUntilTime,
      notification
    } = this.state;

    // Calculate effective duration and time offset for display when match start time is set
    const displayDuration = matchStartSet && matchStartTime > 0 ? duration - matchStartTime : duration;
    const displayCurrentTime = matchStartSet && matchStartTime > 0 ? currentTime - matchStartTime : currentTime;

    const involvedStarts = tags.filter(t => t.tag_type === 'involved_start');
    const involvedEnds = tags.filter(t => t.tag_type === 'involved_end');
    const hasPendingStart = involvedStarts.length > involvedEnds.length;
    const lastStartTime = hasPendingStart ? involvedStarts[involvedStarts.length - 1]?.timestamp : null;

    const zones = [
      { id: 'defending', label: 'Defending', color: 'bg-red-500' },
      { id: 'attacking', label: 'Attacking', color: 'bg-emerald-500' },
      { id: 'offensive_transition', label: 'Off Transition', color: 'bg-blue-500' },
      { id: 'defensive_transition', label: 'Def Transition', color: 'bg-amber-500' }
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
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50 ${
            notification.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}>
            <p className="font-medium">{notification.message}</p>
          </div>
        )}
        
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

        {/* Read-Only Mode Banner */}
        {this.state.analystTaskCreated && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <div>
              <p className="text-sm font-medium text-amber-900">Video Editor is Read-Only</p>
              <p className="text-xs text-amber-700 mt-0.5">The analyst task has been created. You cannot modify segments or create new ones until a new video is loaded.</p>
            </div>
          </div>
        )}

        {/* Video Info Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{video?.title}</h2>
            <p className="text-slate-500">
              {video?.home_team} vs {video?.away_team} • {video?.player_name} #{video?.jersey_number}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => this.setState({ showGallery: true })}
              variant="outline"
              className="gap-2"
            >
              <User className="w-4 h-4" />
              View Player Identification Gallery
              {video?.sample_frames && video.sample_frames.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                  {video.sample_frames.filter(f => f.annotation).length}/{video.sample_frames.length}
                </span>
              )}
            </Button>
            {task && (
              <>
                <Button 
                  onClick={this.handlePopOutDashboard}
                  disabled={this.state.analystTaskCreated}
                  className={this.state.analystTaskCreated ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Open Tagging Dashboard
                </Button>
                <Button 
                  onClick={this.handleCreateAnalystTask}
                  disabled={this.state.analystTaskCreated}
                  className={this.state.analystTaskCreated ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {this.state.analystTaskCreated ? 'Task Created' : 'Create Analyst Task'}
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
        <Card className={`overflow-hidden border-0 shadow-lg ${this.state.isFullscreen ? 'video-player-fullscreen' : ''}`} ref={this.videoContainerRef}>
          <div className="bg-black relative">
            <video
              ref={this.videoRef}
              src={this.getVideoUrl()}
              className={`w-full object-contain ${this.state.isFullscreen ? 'flex-1' : 'h-[500px] lg:h-[600px]'}`}
              onTimeUpdate={() => {
                const { matchStartTime, matchStartSet, playUntilTime } = this.state;
                let currentTime = this.videoRef.current?.currentTime || 0;
                
                // Enforce match start time - prevent playback before this time
                if (matchStartSet && matchStartTime > 0 && currentTime < matchStartTime) {
                  this.videoRef.current.currentTime = matchStartTime;
                  currentTime = matchStartTime;
                }
                
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
              onError={(e) => {
                const videoUrl = this.getVideoUrl();
                console.error("Video player error:", e);
                console.error("Video URL being loaded:", videoUrl);
                console.error("Video element src:", this.videoRef.current?.src);
              }}
            />

            {/* Time Overlay */}
            <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1.5 rounded-lg font-mono text-sm">
              {matchStartSet && (
                <span className="text-emerald-400 mr-2">Match:</span>
              )}
              {this.formatTime(displayCurrentTime)}
            </div>
          </div>

          {/* Controls */}
          <CardContent className={`${this.state.isFullscreen ? 'p-3 bg-slate-900/95 w-full' : 'p-4 space-y-4'} bg-slate-900`}>
            {/* Playback Timeline */}
            <div className={`relative ${this.state.isFullscreen ? 'mb-2' : 'mb-4'}`}>
              <Slider
                value={[displayCurrentTime]}
                max={displayDuration}
                step={0.1}
                onValueChange={this.handleSeek}
                className="w-full"
              />
              {segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  className="absolute top-0 h-2 bg-emerald-500/50 rounded"
                  style={{
                    left: `${((seg.start_time - (matchStartSet && matchStartTime > 0 ? matchStartTime : 0)) / displayDuration) * 100}%`,
                    width: `${((seg.end_time - seg.start_time) / displayDuration) * 100}%`
                  }}
                />
              ))}
            </div>

            {/* Playback Controls */}
            <div className={`flex items-center w-full ${this.state.isFullscreen ? 'gap-2 flex-wrap justify-center' : 'gap-4 justify-between'}`}>
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

              <div className={`flex items-center ${this.state.isFullscreen ? 'gap-1' : 'gap-4'}`}>
                {!this.state.isFullscreen && (
                <div className="text-white font-mono text-sm">
                  {this.formatTime(displayCurrentTime)} / {this.formatTime(displayDuration)}
                </div>
                )}

                {/* Playback Speed Control */}
                <div className={`flex items-center gap-1 bg-white/10 rounded-lg p-1 ${this.state.isFullscreen ? 'hidden md:flex' : ''}`}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                    <Button
                      key={speed}
                      size="sm"
                      variant={this.state.playbackSpeed === speed ? "default" : "ghost"}
                      onClick={() => this.handlePlaybackSpeedChange(speed)}
                      className={this.state.playbackSpeed === speed ? "bg-white text-slate-900 hover:bg-white/90" : "text-white hover:bg-white/20 text-xs"}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>

                {/* Fullscreen Button */}
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={this.handleFullscreen}
                  className="text-white hover:bg-white/20"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-5 h-5" />
                </Button>
              </div>

              {!matchStartSet && !this.state.isFullscreen && (
                <Button onClick={this.handleSetMatchStart} className="bg-emerald-600 hover:bg-emerald-700">
                  <Flag className="w-4 h-4 mr-2" />
                  Set Match Start
                </Button>
              )}
            </div>

            {/* Player Segments Timeline */}
            {!this.state.isFullscreen && (
            <div className="pt-4 border-t border-slate-700">
              <EnhancedTimeline
                segments={segments}
                duration={displayDuration}
                currentTime={displayCurrentTime}
                matchStartTime={matchStartTime}
                readOnly={this.state.analystTaskCreated}
                onSeek={(time) => {
                  if (this.videoRef.current) {
                    this.videoRef.current.currentTime = time + (matchStartSet && matchStartTime > 0 ? matchStartTime : 0);
                  }
                }}
                onPlaySegment={(segment) => {
                  if (this.videoRef.current) {
                    this.videoRef.current.currentTime = segment.start_time;
                    this.videoRef.current.play();
                    this.setState({ isPlaying: true, playUntilTime: segment.end_time });
                  }
                }}
                onUpdateSegment={!this.state.analystTaskCreated ? async (id, data) => {
                  // Convert seconds back to milliseconds for database
                  const dbData = {};
                  if (data.start_time !== undefined) dbData.start_time = Math.round(data.start_time * 1000);
                  if (data.end_time !== undefined) dbData.end_time = Math.round(data.end_time * 1000);
                  await videoSegmentService.update(id, dbData);
                  await this.loadSegments();
                } : undefined}
                onDeleteSegment={!this.state.analystTaskCreated ? async (id) => {
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
                } : undefined}
                onEditSegment={!this.state.analystTaskCreated ? (segment) => {
                  if (this.videoRef.current) {
                    this.videoRef.current.currentTime = segment.start_time + matchStartTime;
                  }
                  if (segment.zone) {
                    this.setState({ selectedZone: segment.zone });
                  }
                  this.setState({ showTaggingDialog: true });
                } : undefined}
              />
            </div>
            )}
          </CardContent>
        </Card>

        {/* Player Identification Gallery */}
        {showGallery && (video?.sample_frames || this.state.timelineFrames) && (
          <PlayerIdentificationGallery
            frames={video?.sample_frames || this.state.timelineFrames}
            playerName={video?.player_name}
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
                  disabled={this.state.analystTaskCreated}
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
                        disabled={this.state.analystTaskCreated}
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
                      disabled={this.state.analystTaskCreated}
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
                      disabled={!hasPendingStart || this.state.analystTaskCreated}
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
                              disabled={this.state.analystTaskCreated}
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
                              disabled={this.state.analystTaskCreated}
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
                          {seg.zone && <Badge variant="outline" className="text-xs">{zones.find(z => z.id === seg.zone)?.label || seg.zone}</Badge>}
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
                    Confirm ({pendingSegments.length})
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
                {segments.map((segment, idx) => {
                  const zoneColors = {
                    defending: { border: 'border-red-500', bg: 'bg-red-50', gradient: 'from-red-600 to-red-800', badge: 'bg-red-500 text-white' },
                    attacking: { border: 'border-emerald-500', bg: 'bg-emerald-50', gradient: 'from-emerald-600 to-emerald-800', badge: 'bg-emerald-500 text-white' },
                    offensive_transition: { border: 'border-blue-500', bg: 'bg-blue-50', gradient: 'from-blue-600 to-blue-800', badge: 'bg-blue-500 text-white' },
                    defensive_transition: { border: 'border-amber-500', bg: 'bg-amber-50', gradient: 'from-amber-600 to-amber-800', badge: 'bg-amber-500 text-white' }
                  };
                  const zoneLabels = {
                    defending: 'Defending',
                    attacking: 'Attacking',
                    offensive_transition: 'Off Transition',
                    defensive_transition: 'Def Transition'
                  };
                  const zone = segment.zone || 'defending';
                  const colors = zoneColors[zone] || zoneColors.defending;
                  const zoneName = zoneLabels[zone] || zone;
                  
                  return (
                  <div
                    key={segment.id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 ${colors.border} ${colors.bg} transition-all hover:scale-105 hover:shadow-lg`}
                    onClick={() => {
                      if (this.videoRef.current) {
                        this.videoRef.current.currentTime = segment.start_time;
                        this.videoRef.current.play();
                        this.setState({ isPlaying: true, playUntilTime: segment.end_time });
                      }
                    }}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={this.state.analystTaskCreated}
                      className={`absolute top-2 right-2 h-8 w-8 text-white invisible group-hover:visible transition-all z-50 ${
                        this.state.analystTaskCreated 
                          ? 'bg-gray-500 hover:bg-gray-500 cursor-not-allowed shadow-lg' 
                          : 'bg-red-600 hover:bg-red-700 shadow-lg'
                      }`}
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
                      <Trash2 className="w-4 h-4" />
                    </Button>

                    <div className={`w-40 h-24 bg-gradient-to-br ${colors.gradient} relative flex items-center justify-center`}>
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

                    <div className="absolute bottom-2 left-2">
                      <Badge className={`text-xs ${colors.badge}`}>
                        {zoneName}
                      </Badge>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default VideoEditorWithRouter;