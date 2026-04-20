import React, { useState, useRef, useEffect } from 'react';
import { videoTaskService, videoService, videoSegmentService, actionAnnotationService } from '../api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Label } from "../Components/ui/label";
import { Input } from "../Components/ui/input";
import { Textarea } from "../Components/ui/textarea";
import { Slider } from "../Components/ui/slider";
import { RadioGroup, RadioGroupItem } from "../Components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../Components/ui/dialog";
import {
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  ChevronLeft,
  ChevronRight,
  Target,
  ArrowRight,
  Save,
  CheckCircle2,
  Video,
  BarChart3,
  Crosshair,
  Flag,
  Shield,
  Zap,
  Users,
  Plus,
  Clock,
  User,
  ExternalLink,
  Edit,
  Trash2,
  Maximize2
} from 'lucide-react';
import { Skeleton } from "../Components/ui/skeleton";
import { motion, AnimatePresence } from 'framer-motion';
import PitchMap from '../Components/analyst/PitchMap';
import GoalMap from '../Components/analyst/GoalMap';

const actionCategories = [
  { id: 'pass', label: 'Pass', icon: ArrowRight, color: 'bg-blue-500' },
  { id: 'shot', label: 'Shot', icon: Target, color: 'bg-red-500' },
  { id: 'dribble', label: 'Dribble', icon: Zap, color: 'bg-amber-500' },
  { id: 'defensive_action', label: 'Defensive', icon: Shield, color: 'bg-purple-500' }
];

// Standard football pitch dimensions (FIFA recommendations)
const PITCH_LENGTH_METERS = 105; // meters (100-110m for international)
const PITCH_WIDTH_METERS = 68;   // meters (64-75m for international)

// Utility function to convert percentage to meters
const percentToMeters = (percent, dimension) => {
  const maxMeters = dimension === 'x' ? PITCH_LENGTH_METERS : PITCH_WIDTH_METERS;
  return Math.round((percent / 100) * maxMeters * 10) / 10; // Round to 1 decimal
};

// Utility function to convert meters to percentage
const metersToPercent = (meters, dimension) => {
  const maxMeters = dimension === 'x' ? PITCH_LENGTH_METERS : PITCH_WIDTH_METERS;
  return Math.round((meters / maxMeters) * 100);
};


const defensiveTypes = [
  { id: 'tackle_attempt', label: 'Tackle Attempt' },
  { id: 'interception', label: 'Interception' },
  { id: 'pressure_close_down', label: 'Pressure / Close Down' },
  { id: 'block', label: 'Block' },
  { id: 'clearance', label: 'Clearance' },
  { id: 'defensive_duel', label: 'Defensive Duel' },
  { id: 'ball_recovery', label: 'Ball Recovery' },
  { id: 'tracking_cover_run', label: 'Tracking / Cover Run' }
];

export default function AnalystDashboard() {
  const urlParams = new URLSearchParams(window.location.search);
  const taskId = urlParams.get('taskId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Add style for dialog overlay on component mount
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      [role="dialog"] {
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5) !important;
      }
      /* Radix Dialog overlay styling */
      [data-radix-dialog-overlay] {
        background-color: rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(2px);
        -webkit-backdrop-filter: blur(2px);
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Fullscreen event listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);
  
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const timelineRef = useRef(null);
  const capturedStartTimeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentCurrentTime, setSegmentCurrentTime] = useState(0);
  const [dragState, setDragState] = useState(null);
  
  // Action annotation state
  const [actionStart, setActionStart] = useState(null);
  const [actionEnd, setActionEnd] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isExpandedViewOpen, setIsExpandedViewOpen] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [editingAnnotationId, setEditingAnnotationId] = useState(null);
  const [shouldOpenPopup, setShouldOpenPopup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [annotation, setAnnotation] = useState({
    pitch_start_x: undefined,
    pitch_start_y: undefined,
    pitch_end_x: undefined,
    pitch_end_y: undefined,
    outcome: 'successful',
    context: 'open_play',
    pass_length: undefined,
    pass_direction: undefined,
    shot_result: undefined,
    goal_target_x: undefined,
    goal_target_y: undefined,
    body_part: undefined,
    defensive_pressure: 0,
    opponents_bypassed: 0,
    defensive_action_type: undefined,
    defensive_consequence: undefined,
    note: ''
  });

  // Lead/Lag time configuration per category (stored in localStorage)
  const [categoryTiming, setCategoryTiming] = useState(() => {
    const saved = localStorage.getItem('actionCategoryTiming');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Save timing config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('actionCategoryTiming', JSON.stringify(categoryTiming));
  }, [categoryTiming]);

  const { data: allTasks = [], isLoading: allTasksLoading } = useQuery({
    queryKey: ['analystTasks'],
    queryFn: async () => {
      const tasks = await videoTaskService.filter({ task_type: 'analyst_annotation' }, '-created_at');
      return tasks;
    },
    enabled: !taskId
  });

  const { data: allVideos = [] } = useQuery({
    queryKey: ['allVideos'],
    queryFn: async () => {
      const videos = await videoService.list();
      return videos;
    },
    enabled: !taskId && allTasks.length > 0
  });

  const { data: task, isLoading: taskLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const tasks = await videoTaskService.list();
      return tasks.find(t => t.id === taskId);
    },
    enabled: !!taskId
  });

  const { data: video, isLoading: videoLoading } = useQuery({
    queryKey: ['video', task?.video_id],
    queryFn: async () => {
      if (!task?.video_id) return null;
      const videoData = await videoService.get(task.video_id);
      console.log('Video data fetched:', videoData);
      console.log('Video URL:', videoData?.url);
      console.log('Video file_url:', videoData?.file_url);
      return videoData;
    },
    enabled: !!task?.video_id
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', task?.video_id],
    queryFn: async () => {
      const rawSegments = await videoSegmentService.filter({ video_id: task.video_id }, 'start_time');
      // Map segment_type to zone for display consistency with VideoEditor
      return rawSegments.map(seg => ({
        ...seg,
        zone: seg.segment_type || seg.zone
      }));
    },
    enabled: !!task?.video_id
  });

  const { data: annotations = [] } = useQuery({
    queryKey: ['annotations', taskId],
    queryFn: async () => {
      const res = await actionAnnotationService.list(task?.video_id);
      console.log('Fetched annotations for video:', task?.video_id, res);
      return Array.isArray(res) ? res : (res?.data || []);
    },
    enabled: !!task?.video_id
  });

  const createAnnotationMutation = useMutation({
    mutationFn: (data) => actionAnnotationService.create(data),
    onSuccess: () => {
      console.log('Annotation saved successfully, invalidating query for taskId:', taskId);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['annotations', taskId] });
      resetAnnotation();
    },
    onError: (error) => {
      console.error('Failed to save annotation:', {
        message: error.message,
        status: error.status,
        details: error.details,
        fullError: error
      });
      alert(`Error saving annotation: ${error.message || 'Unknown error'}`);
    }
  });

  const updateAnnotationMutation = useMutation({
    mutationFn: ({ id, data }) => actionAnnotationService.update(id, data),
    onSuccess: () => {
      console.log('Annotation updated successfully');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['annotations', taskId] });
      setEditingAnnotationId(null);
      resetAnnotation();
    },
    onError: (error) => {
      console.error('Failed to update annotation:', error);
      alert(`Error updating annotation: ${error.message || 'Unknown error'}`);
    }
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: (id) => actionAnnotationService.delete(id),
    onSuccess: () => {
      console.log('Annotation deleted successfully');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      queryClient.invalidateQueries({ queryKey: ['annotations', taskId] });
    },
    onError: (error) => {
      console.error('Failed to delete annotation:', error);
      alert(`Error deleting annotation: ${error.message || 'Unknown error'}`);
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => videoTaskService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', taskId] })
  });

  const currentSegment = segments[currentSegmentIndex];

  const resetAnnotation = () => {
    setActionStart(null);
    setActionEnd(null);
    setSelectedCategory(null);
    setEditingAnnotationId(null);
    capturedStartTimeRef.current = null;
    setAnnotation({
      pitch_start_x: undefined,
      pitch_start_y: undefined,
      pitch_end_x: undefined,
      pitch_end_y: undefined,
      outcome: 'successful',
      context: 'open_play',
      pass_length: undefined,
      pass_direction: undefined,
      shot_result: undefined,
      goal_target_x: undefined,
      goal_target_y: undefined,
      body_part: undefined,
      defensive_pressure: 0,
      opponents_bypassed: 0,
      defensive_action_type: undefined,
      defensive_consequence: undefined,
      note: ''
    });
  };

  // Load video to specific segment time
  useEffect(() => {
    if (videoRef.current && currentSegment && video) {
      const matchStartTime = task?.match_start_time || 0;
      // Convert milliseconds to seconds
      const startTimeInSeconds = (currentSegment.start_time / 1000) + matchStartTime;
      console.log('🎬 Loading segment:', {
        segmentIndex: currentSegmentIndex,
        segmentStart: currentSegment.start_time,
        matchStartTime: matchStartTime,
        calculatedVideoTime: startTimeInSeconds
      });
      videoRef.current.currentTime = startTimeInSeconds;
      setSegmentCurrentTime(0);
    }
  }, [currentSegmentIndex, currentSegment, video, task]);

  // Log the computed video URL when video data changes
  useEffect(() => {
    if (video) {
      const computedUrl = getVideoUrl(video?.url || video?.file_url);
      console.log('Video URL computed:', {
        rawUrl: video?.url || video?.file_url,
        computedUrl: computedUrl
      });
    }
  }, [video]);

  // Auto-navigate to next segment
  useEffect(() => {
    if (!currentSegment || !videoRef.current) return;
    
    const segmentDuration = currentSegment.end_time - currentSegment.start_time;
    if (segmentCurrentTime >= segmentDuration) {
      videoRef.current.pause();
      setIsPlaying(false);
      
      // Auto-advance to next segment after 1 second
      const timer = setTimeout(() => {
        if (currentSegmentIndex < segments.length - 1) {
          setCurrentSegmentIndex(currentSegmentIndex + 1);
        } else {
          // Loop back to first segment
          setCurrentSegmentIndex(0);
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [segmentCurrentTime, currentSegment, currentSegmentIndex, segments.length]);

  // Open popup when editing annotation (after state updates)
  useEffect(() => {
    if (shouldOpenPopup) {
      handlePopOutAnnotation();
      setShouldOpenPopup(false); // Reset flag after opening
    }
  }, [shouldOpenPopup]);

  // Helper function to convert pixels to time based on segment duration
  const pixelsToTime = (pixels) => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.offsetWidth;
    const segmentDuration = currentSegment 
      ? (currentSegment.end_time - currentSegment.start_time) / 1000 
      : 1;
    return (pixels / width) * segmentDuration;
  };

  // Handle timeline drag for adjusting annotation times
  const handleTimelineMouseDown = (e, annotation, edge) => {
    e.stopPropagation();
    document.body.style.cursor = 'ew-resize';
    const rect = timelineRef.current?.getBoundingClientRect();
    setDragState({
      annotation,
      edge,
      startX: e.clientX,
      timelineLeft: rect?.left || 0,
      timelineWidth: rect?.width || 0,
      initialStartTime: annotation.start_time,
      initialEndTime: annotation.end_time,
      initialSegmentStart: currentSegment ? currentSegment.start_time / 1000 : 0,
      segmentDuration: currentSegment 
        ? (currentSegment.end_time - currentSegment.start_time) / 1000 
        : duration
    });
  };

  // Mouse move and up handlers for timeline dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const pixelsMoved = Math.abs(deltaX);
      
      // Calculate time delta based on pixel movement
      const timeDelta = pixelsToTime(pixelsMoved) * (deltaX > 0 ? 1 : -1);
      const segmentStartTime = dragState.initialSegmentStart;
      const segmentEndTime = segmentStartTime + dragState.segmentDuration;

      let newStart = dragState.initialStartTime / 1000;
      let newEnd = dragState.initialEndTime / 1000;

      if (dragState.edge === 'start') {
        // Adjust start time
        newStart = Math.max(
          segmentStartTime,
          dragState.initialStartTime / 1000 + timeDelta
        );
        // Ensure minimum duration of 1 second
        newStart = Math.min(newStart, newEnd - 1);
      } else if (dragState.edge === 'end') {
        // Adjust end time
        newEnd = Math.min(
          segmentEndTime,
          dragState.initialEndTime / 1000 + timeDelta
        );
        // Ensure minimum duration of 1 second
        newEnd = Math.max(newEnd, newStart + 1);
      } else {
        // Move entire annotation
        const annotationLength = dragState.initialEndTime / 1000 - dragState.initialStartTime / 1000;
        newStart = Math.max(
          segmentStartTime,
          dragState.initialStartTime / 1000 + timeDelta
        );
        newEnd = newStart + annotationLength;
        
        // Constrain to segment end
        if (newEnd > segmentEndTime) {
          newEnd = segmentEndTime;
          newStart = newEnd - annotationLength;
        }
      }

      // Update annotation in real-time for visual feedback
      setDragState(prev => ({
        ...prev,
        previewStart: Math.round(newStart * 1000),
        previewEnd: Math.round(newEnd * 1000)
      }));
    };

    const handleMouseUp = () => {
      if (dragState && dragState.previewStart !== undefined) {
        // Apply the changes only on mouse up
        updateAnnotationMutation.mutate({
          id: dragState.annotation.id,
          data: {
            start_time: dragState.previewStart,
            end_time: dragState.previewEnd
          }
        });
      }
      setDragState(null);
      document.body.style.cursor = 'default';
    };

    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, duration, updateAnnotationMutation, currentSegment]);

  const handlePreviousSegment = () => {
    if (currentSegmentIndex > 0) {
      setCurrentSegmentIndex(currentSegmentIndex - 1);
    }
  };

  const handleNextSegment = () => {
    if (currentSegmentIndex < segments.length - 1) {
      setCurrentSegmentIndex(currentSegmentIndex + 1);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleFullscreen = () => {
    const container = videoContainerRef.current;
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

  const handleSeek = (value) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleSkip = (seconds) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSetActionStart = () => {
    // Capture absolute video time, not segment-relative time
    // This avoids depending on onTimeUpdate firing at exactly the right moment
    const absoluteTime = videoRef.current?.currentTime || 0;
    const matchStartTime = task?.match_start_time || 0;
    const segmentStartInSeconds = currentSegment ? (currentSegment.start_time / 1000) : 0;
    const relativeTime = Math.max(0, absoluteTime - (segmentStartInSeconds + matchStartTime));
    
    console.log('⏱ START time captured:', relativeTime.toFixed(2), '(absolute video time:', absoluteTime.toFixed(2), ')');
    console.log('Calculation: absoluteTime(' + absoluteTime.toFixed(2) + ') - segmentStart(' + segmentStartInSeconds.toFixed(2) + ') - matchStart(' + matchStartTime + ')');
    console.log('Waiting for end click...');
    setActionStart(relativeTime);
  };

  const handleSetActionEnd = () => {
    // Capture absolute video time, not segment-relative time
    const absoluteTime = videoRef.current?.currentTime || 0;
    const matchStartTime = task?.match_start_time || 0;
    const segmentStartInSeconds = currentSegment ? (currentSegment.start_time / 1000) : 0;
    const relativeTime = Math.max(0, absoluteTime - (segmentStartInSeconds + matchStartTime));
    const duration = actionEnd !== null && actionStart !== null ? relativeTime - actionStart : 0;
    
    console.log('✓ END time captured:', relativeTime.toFixed(2), '(absolute video time:', absoluteTime.toFixed(2), ')');
    console.log('Start was:', actionStart?.toFixed(2), '| Duration:', duration.toFixed(2))  
    console.log('Calculation: absoluteTime(' + absoluteTime.toFixed(2) + ') - segmentStart(' + segmentStartInSeconds.toFixed(2) + ') - matchStart(' + matchStartTime + ')');
    setActionEnd(relativeTime);
  };

  const handleCategoryClickForTiming = (categoryId) => {
    // This function is no longer needed since timing happens in popup
    console.log('[Parent] Category click in video player - but timing is now in popup');
  };

  const handlePopOutAnnotation = () => {
    // Create HTML for popup window
    const popupHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Action Annotation - Expanded View</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background-color: #f1f5f9;
          padding: 24px;
          width: 100vw;
          height: 100vh;
          overflow: auto;
        }
        .container {
          max-width: 1400px;
          margin: 0 auto;
        }
        h1 {
          font-size: 28px;
          font-weight: bold;
          color: #0f172a;
          margin-bottom: 24px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 24px;
        }
        .card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }
        .card-header {
          padding: 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        .card-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
        }
        .card-content {
          padding: 16px;
        }
        .grid-2-cols {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 16px;
        }
        .grid-3-cols {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 12px;
        }
        .grid-4-cols {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          gap: 12px;
        }
        button {
          padding: 10px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: white;
          color: #334155;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        button:hover {
          background: #f1f5f9;
        }
        button.active {
          background: #10b981;
          color: white;
          border-color: #10b981;
        }
        /* Category button colors */
        .category-btn[data-category="pass"].active {
          background: #3b82f6 !important;
          border-color: #3b82f6 !important;
        }
        .category-btn[data-category="shot"].active {
          background: #ef4444 !important;
          border-color: #ef4444 !important;
        }
        .category-btn[data-category="dribble"].active {
          background: #f59e0b !important;
          border-color: #f59e0b !important;
        }
        .category-btn[data-category="defensive_action"].active {
          background: #a855f7 !important;
          border-color: #a855f7 !important;
        }
        /* Detail button colors by category */
        .theme-pass .detail-btn.active {
          background: #3b82f6 !important;
          border-color: #3b82f6 !important;
        }
        .theme-shot .detail-btn.active {
          background: #ef4444 !important;
          border-color: #ef4444 !important;
        }
        .theme-dribble .detail-btn.active {
          background: #f59e0b !important;
          border-color: #f59e0b !important;
        }
        .theme-defensive_action .detail-btn.active {
          background: #a855f7 !important;
          border-color: #a855f7 !important;
        }
        button.active.blue {
          background: #3b82f6;
          border-color: #3b82f6;
        }
        button.active.red {
          background: #ef4444;
          border-color: #ef4444;
        }
        button.active.amber {
          background: #f59e0b;
          border-color: #f59e0b;
        }
        button.active.purple {
          background: #a855f7;
          border-color: #a855f7;
        }
        /* Theme colors based on category */
        .theme-pass .card-header {
          background: #dbeafe;
          border-bottom: 3px solid #3b82f6;
        }
        .theme-pass .card-header h2 {
          color: #1e40af;
        }
        .theme-pass #saveBtn {
          background: #3b82f6 !important;
          border-color: #3b82f6 !important;
        }
        .theme-pass #saveBtn:hover:not(:disabled) {
          background: #1d4ed8 !important;
        }
        
        .theme-shot .card-header {
          background: #fee2e2;
          border-bottom: 3px solid #ef4444;
        }
        .theme-shot .card-header h2 {
          color: #991b1b;
        }
        .theme-shot #saveBtn {
          background: #ef4444 !important;
          border-color: #ef4444 !important;
        }
        .theme-shot #saveBtn:hover:not(:disabled) {
          background: #dc2626 !important;
        }
        
        .theme-dribble .card-header {
          background: #fef3c7;
          border-bottom: 3px solid #f59e0b;
        }
        .theme-dribble .card-header h2 {
          color: #92400e;
        }
        .theme-dribble #saveBtn {
          background: #f59e0b !important;
          border-color: #f59e0b !important;
        }
        .theme-dribble #saveBtn:hover:not(:disabled) {
          background: #d97706 !important;
        }
        
        .theme-defensive_action .card-header {
          background: #f3e8ff;
          border-bottom: 3px solid #a855f7;
        }
        .theme-defensive_action .card-header h2 {
          color: #6b21a8;
        }
        .theme-defensive_action #saveBtn {
          background: #a855f7 !important;
          border-color: #a855f7 !important;
        }
        .theme-defensive_action #saveBtn:hover:not(:disabled) {
          background: #9333ea !important;
        }
        label {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 8px;
        }
        textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          min-height: 80px;
        }
        .radio-group {
          display: flex;
          gap: 16px;
        }
        .radio-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .radio-item input {
          cursor: pointer;
        }
        .radio-item label {
          margin: 0;
          font-weight: 500;
          cursor: pointer;
        }
        .buttons-container {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }
        #saveBtn {
          background: #10b981;
          color: white;
          border-color: #10b981;
          padding: 10px 20px;
        }
        #saveBtn:hover:not(:disabled) {
          background: #059669;
        }
        #saveBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        #resetBtn {
          background: white;
          color: #334155;
          border-color: #cbd5e1;
          padding: 10px 20px;
        }
        /* Context menu styles */
        .context-menu {
          position: fixed;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          min-width: 150px;
          display: none;
        }
        .context-menu.visible {
          display: block;
        }
        .context-menu-item {
          padding: 8px 16px;
          cursor: pointer;
          color: #334155;
          font-size: 14px;
          border-bottom: 1px solid #e2e8f0;
          transition: background 0.2s;
        }
        .context-menu-item:last-child {
          border-bottom: none;
        }
        .context-menu-item:hover {
          background: #f1f5f9;
        }
        /* Properties dialog styles */
        .properties-dialog {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: 10001;
          align-items: center;
          justify-content: center;
        }
        .properties-dialog.visible {
          display: flex;
        }
        .properties-content {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .properties-title {
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
          margin-bottom: 20px;
        }
        .timing-input-group {
          margin-bottom: 16px;
        }
        .timing-label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 6px;
          display: block;
        }
        .timing-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .timing-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 14px;
        }
        .timing-value {
          min-width: 40px;
          text-align: center;
          font-weight: 600;
          color: #0f172a;
          padding: 8px 12px;
          background: #f1f5f9;
          border-radius: 6px;
          font-size: 14px;
        }
        .timing-description {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
          line-height: 1.4;
        }
        .properties-buttons {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 20px;
        }
        .properties-buttons button {
          padding: 8px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: white;
          color: #334155;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }
        .properties-buttons button:hover {
          background: #f1f5f9;
        }
        .properties-buttons button.confirm {
          background: #3b82f6;
          color: white;
          border-color: #3b82f6;
        }
        .properties-buttons button.confirm:hover {
          background: #1d4ed8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Action Annotation - Expanded View</h1>
        
        <!-- Timing Status Display -->
        <div id="timingStatus" style="background: #f1f5f9; border: 2px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center; font-size: 16px; font-weight: 600; color: #0f172a; display: none;">
          ⏱ START TIME CAPTURED - Click same category again to mark END
        </div>
        
        <div class="grid">
          <!-- Left Column -->
          <div>
            <div class="card">
              <div class="card-header">
                <h2>Action Category</h2>
              </div>
              <div class="card-content">
                <div class="grid-2-cols">
                  <button class="category-btn" data-category="pass">→ Pass</button>
                  <button class="category-btn" data-category="shot">◯ Shot</button>
                  <button class="category-btn" data-category="dribble">⚡ Dribble</button>
                  <button class="category-btn" data-category="defensive_action">Θ Defensive</button>
                </div>
              </div>
            </div>

            <div class="card" style="margin-top: 24px;">
              <div class="card-header">
                <h2>Pitch Position (Start)</h2>
              </div>
              <div class="card-content">
                <div id="pitchMapContainer" style="position: relative; width: 100%; padding-bottom: 66.67%; background: #10b981; border-radius: 8px; overflow: hidden; cursor: crosshair; border: 2px solid white;">
                  <!-- Field markings -->
                  <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" viewBox="0 0 150 100" preserveAspectRatio="none">
                    <!-- Outline -->
                    <rect x="2" y="2" width="146" height="96" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    
                    <!-- Center line -->
                    <line x1="75" y1="2" x2="75" y2="98" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    
                    <!-- Center circle -->
                    <circle cx="75" cy="50" r="12" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    <circle cx="75" cy="50" r="0.5" fill="white" opacity="0.8"/>
                    
                    <!-- Left penalty area -->
                    <rect x="2" y="22" width="18" height="56" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    <rect x="2" y="35" width="6" height="30" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    
                    <!-- Right penalty area -->
                    <rect x="130" y="22" width="18" height="56" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    <rect x="142" y="35" width="6" height="30" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    
                    <!-- Left arc -->
                    <path d="M 20 40 A 12 12 0 0 1 20 60" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    
                    <!-- Right arc -->
                    <path d="M 130 40 A 12 12 0 0 0 130 60" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    
                    <!-- Corner arcs -->
                    <path d="M 2 5 A 3 3 0 0 0 5 2" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    <path d="M 145 2 A 3 3 0 0 0 148 5" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    <path d="M 2 95 A 3 3 0 0 1 5 98" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                    <path d="M 145 98 A 3 3 0 0 1 148 95" fill="none" stroke="white" stroke-width="0.5" opacity="0.8"/>
                  </svg>

                  <!-- Zone labels -->
                  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; color: rgba(255,255,255,0.25); font-size: 12px; font-weight: 500; pointer-events: none;">
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">DEF</div>
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">MID</div>
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">ATT</div>
                  </div>

                  <!-- Clickable area -->
                  <div id="pitchClickArea" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: crosshair; z-index: 5;"></div>
                </div>
                <p style="font-size: 12px; color: #64748b; margin-top: 8px;">Click on pitch to set position</p>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div>
            <div class="card">
              <div class="card-header">
                <h2>Action Details</h2>
              </div>
              <div class="card-content" id="actionDetails">
                <p style="text-align: center; color: #94a3b8; font-size: 14px;">Select a category to see details</p>
              </div>
            </div>

            <div class="card" style="margin-top: 24px;">
              <div class="card-header">
                <h2>Outcome & Context</h2>
              </div>
              <div class="card-content">
                <div style="margin-bottom: 16px;">
                  <label>Outcome</label>
                  <div class="radio-group">
                    <div class="radio-item">
                      <input type="radio" id="successful" name="outcome" value="successful" checked>
                      <label for="successful" style="color: #10b981;">Successful</label>
                    </div>
                    <div class="radio-item">
                      <input type="radio" id="unsuccessful" name="outcome" value="unsuccessful">
                      <label for="unsuccessful" style="color: #ef4444;">Unsuccessful</label>
                    </div>
                  </div>
                </div>
                <div>
                  <label>Context</label>
                  <div class="radio-group">
                    <div class="radio-item">
                      <input type="radio" id="open_play" name="context" value="open_play" checked>
                      <label for="open_play">Open Play</label>
                    </div>
                    <div class="radio-item">
                      <input type="radio" id="set_piece" name="context" value="set_piece">
                      <label for="set_piece">Set Piece</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Note Field -->
        <div class="card">
          <div class="card-header">
            <h2>Note (Optional)</h2>
          </div>
          <div class="card-content">
            <textarea id="noteField" placeholder="Add any additional observations..."></textarea>
          </div>
        </div>

        <!-- Buttons -->
        <div class="buttons-container">
          <button id="resetBtn">Reset</button>
          <button id="saveBtn">Save & Close</button>
        </div>

        <!-- Context Menu -->
        <div class="context-menu" id="contextMenu">
          <div class="context-menu-item" data-action="properties">⚙️ Properties (Lead/Lag Time)</div>
        </div>

        <!-- Properties Dialog -->
        <div class="properties-dialog" id="propertiesDialog">
          <div class="properties-content">
            <div class="properties-title">
              <span id="propertiesTitle">Pass</span> - Timing Settings
            </div>
            
            <div class="timing-input-group">
              <label class="timing-label">Lead Time (seconds)</label>
              <div class="timing-input-wrapper">
                <input type="range" id="leadTimeSlider" class="timing-input" min="0" max="10" value="0" step="0.5">
                <div class="timing-value" id="leadTimeValue">0s</div>
              </div>
              <div class="timing-description">
                Time subtracted from the event start. If set to 5s, the event will start 5 seconds before you click.
              </div>
            </div>

            <div class="timing-input-group">
              <label class="timing-label">Lag Time (seconds)</label>
              <div class="timing-input-wrapper">
                <input type="range" id="lagTimeSlider" class="timing-input" min="0" max="10" value="0" step="0.5">
                <div class="timing-value" id="lagTimeValue">0s</div>
              </div>
              <div class="timing-description">
                Time added to the event end. If set to 5s, the event will end 5 seconds after you click.
              </div>
            </div>

            <div class="properties-buttons">
              <button id="propertiesCancel">Cancel</button>
              <button id="propertiesConfirm" class="confirm">Confirm</button>
            </div>
          </div>
        </div>
      </div>

      <script>
        let selectedCategory = ${JSON.stringify(selectedCategory)};
        const annotationId = ${JSON.stringify(editingAnnotationId)};
        const parentActionStart = ${JSON.stringify(actionStart)};
        const parentActionEnd = ${JSON.stringify(actionEnd)};
        let popupActionStart = parentActionStart;
        let popupActionEnd = parentActionEnd;
        
        const formData = {
          annotation: JSON.parse('${JSON.stringify(annotation)}'),
          selectedCategory: selectedCategory,
          actionStart: parentActionStart,
          actionEnd: parentActionEnd
        };
        
        console.log('[Popup Init] Received initial data:', {
          actionStart: formData.actionStart,
          actionEnd: formData.actionEnd,
          selectedCategory: selectedCategory,
          annotationId: annotationId
        });

        // Listen for time capture confirmations from parent
        window.addEventListener('message', (e) => {
          if (e.data.type === 'startTimeCaptured') {
            console.log('[Popup] Received startTimeCaptured from parent:', {
              startTime: e.data.startTime,
              category: e.data.category
            });
            popupActionStart = e.data.startTime;
            formData.actionStart = e.data.startTime;
            
            // Update timing status
            const statusDiv = document.getElementById('timingStatus');
            if (statusDiv) {
              statusDiv.style.display = 'block';
            }
          }
          
          if (e.data.type === 'endTimeCaptured') {
            console.log('[Popup] Received endTimeCaptured from parent:', {
              startTime: e.data.startTime,
              endTime: e.data.endTime,
              category: e.data.category
            });
            popupActionStart = e.data.startTime;
            popupActionEnd = e.data.endTime;
            formData.actionStart = e.data.startTime;
            formData.actionEnd = e.data.endTime;
            
            // Hide timing status
            const statusDiv = document.getElementById('timingStatus');
            if (statusDiv) {
              statusDiv.style.display = 'none';
            }
          }
        });

        // Category timing configuration (lead/lag times)
        let categoryTiming = ${JSON.stringify(categoryTiming)};
        let currentPropertiesCategory = null;

        function renderActionDetails(category) {
          const detailsDiv = document.getElementById('actionDetails');
          
          if (!category) {
            detailsDiv.innerHTML = '<p style="text-align: center; color: #94a3b8; font-size: 14px;">Select a category to see details</p>';
            return;
          }

          let html = '';

          if (category === 'pass') {
            html = \`
              <div>
                <label>Pass Length</label>
                <div class="grid-3-cols">
                  <button class="detail-btn" data-field="pass_length" data-value="short">Short</button>
                  <button class="detail-btn" data-field="pass_length" data-value="medium">Medium</button>
                  <button class="detail-btn" data-field="pass_length" data-value="long">Long</button>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <label>Pass Direction</label>
                <div class="grid-3-cols">
                  <button class="detail-btn" data-field="pass_direction" data-value="forward">Forward</button>
                  <button class="detail-btn" data-field="pass_direction" data-value="lateral">Lateral</button>
                  <button class="detail-btn" data-field="pass_direction" data-value="backward">Backward</button>
                </div>
              </div>
            \`;
          } else if (category === 'shot') {
            html = \`
              <div>
                <label>Shot Result</label>
                <div class="grid-2-cols">
                  <button class="detail-btn" data-field="shot_result" data-value="goal">Goal</button>
                  <button class="detail-btn" data-field="shot_result" data-value="on_target">On Target</button>
                  <button class="detail-btn" data-field="shot_result" data-value="off_target">Off Target</button>
                  <button class="detail-btn" data-field="shot_result" data-value="blocked">Blocked</button>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <label>Goal Target Position</label>
                <div id="goalMapContainer" style="position: relative; width: 100%; padding-bottom: 33.33%; background: #e2e8f0; border-radius: 8px; border: 4px solid #cbd5e1; overflow: hidden; cursor: crosshair;">
                  <!-- Net pattern SVG - FIFA goal dimensions 7.32m x 2.44m -->
                  <svg style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1;" viewBox="0 0 100 33.33" preserveAspectRatio="none">
                    <!-- Vertical lines -->
                    <line x1="5" y1="0" x2="5" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="10" y1="0" x2="10" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="15" y1="0" x2="15" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="20" y1="0" x2="20" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="25" y1="0" x2="25" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="30" y1="0" x2="30" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="35" y1="0" x2="35" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="40" y1="0" x2="40" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="45" y1="0" x2="45" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="50" y1="0" x2="50" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="55" y1="0" x2="55" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="60" y1="0" x2="60" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="65" y1="0" x2="65" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="70" y1="0" x2="70" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="75" y1="0" x2="75" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="80" y1="0" x2="80" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="85" y1="0" x2="85" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="90" y1="0" x2="90" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="95" y1="0" x2="95" y2="33.33" stroke="#cbd5e1" stroke-width="0.5"/>
                    <!-- Horizontal lines -->
                    <line x1="0" y1="5" x2="100" y2="5" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="0" y1="10" x2="100" y2="10" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="0" y1="15" x2="100" y2="15" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="0" y1="20" x2="100" y2="20" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="0" y1="25" x2="100" y2="25" stroke="#cbd5e1" stroke-width="0.5"/>
                    <line x1="0" y1="30" x2="100" y2="30" stroke="#cbd5e1" stroke-width="0.5"/>
                  </svg>
                  
                  <!-- Zone overlay grid -->
                  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 1px; z-index: 2; pointer-events: none;">
                    <div style="background: rgba(226, 232, 240, 0.3);"></div>
                    <div style="background: rgba(226, 232, 240, 0.3);"></div>
                    <div style="background: rgba(226, 232, 240, 0.3);"></div>
                    <div style="background: rgba(226, 232, 240, 0.3);"></div>
                    <div style="background: rgba(226, 232, 240, 0.3);"></div>
                    <div style="background: rgba(226, 232, 240, 0.3);"></div>
                  </div>
                  
                  <!-- Clickable area -->
                  <div id="goalClickArea" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: crosshair; z-index: 5;"></div>
                  
                  <!-- Selected marker -->
                  <div id="goalMarker" style="position: absolute; display: none; width: 20px; height: 20px; background: #ef4444; border: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 4px 6px rgba(0,0,0,0.2); z-index: 10;"></div>
                  
                  <!-- Corner labels -->
                  <div style="position: absolute; top: 4px; left: 4px; font-size: 11px; color: #cbd5e1; z-index: 5;">Top Left</div>
                  <div style="position: absolute; top: 4px; right: 4px; font-size: 11px; color: #cbd5e1; z-index: 5;">Top Right</div>
                  <div style="position: absolute; bottom: 4px; left: 4px; font-size: 11px; color: #cbd5e1; z-index: 5;">Bottom Left</div>
                  <div style="position: absolute; bottom: 4px; right: 4px; font-size: 11px; color: #cbd5e1; z-index: 5;">Bottom Right</div>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <label>Body Part</label>
                <div class="grid-4-cols">
                  <button class="detail-btn" data-field="body_part" data-value="right_foot">R Foot</button>
                  <button class="detail-btn" data-field="body_part" data-value="left_foot">L Foot</button>
                  <button class="detail-btn" data-field="body_part" data-value="head">Head</button>
                  <button class="detail-btn" data-field="body_part" data-value="other">Other</button>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <label>Defensive Pressure</label>
                <div class="grid-4-cols">
                  <button class="detail-btn" data-field="defensive_pressure" data-value="0">0</button>
                  <button class="detail-btn" data-field="defensive_pressure" data-value="1">1</button>
                  <button class="detail-btn" data-field="defensive_pressure" data-value="2">2</button>
                  <button class="detail-btn" data-field="defensive_pressure" data-value="3">3+</button>
                </div>
              </div>
            \`;
          } else if (category === 'dribble') {
            html = \`
              <div>
                <label>Opponents Bypassed</label>
                <div class="grid-4-cols">
                  <button class="detail-btn" data-field="opponents_bypassed" data-value="0">0</button>
                  <button class="detail-btn" data-field="opponents_bypassed" data-value="1">1</button>
                  <button class="detail-btn" data-field="opponents_bypassed" data-value="2">2</button>
                  <button class="detail-btn" data-field="opponents_bypassed" data-value="3">3+</button>
                </div>
              </div>
            \`;
          } else if (category === 'defensive_action') {
            html = \`
              <div>
                <label>Defensive Action Type</label>
                <div class="grid-2-cols" style="gap: 8px;">
                  <button class="detail-btn" data-field="defensive_action_type" data-value="tackle_attempt">Tackle Attempt</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="interception">Interception</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="pressure_close_down">Pressure/Close Down</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="block">Block</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="clearance">Clearance</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="defensive_duel">Defensive Duel</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="ball_recovery">Ball Recovery</button>
                  <button class="detail-btn" data-field="defensive_action_type" data-value="tracking_cover_run">Tracking/Cover Run</button>
                </div>
              </div>
              <div style="margin-top: 16px;">
                <label>Consequence</label>
                <div class="grid-2-cols">
                  <button class="detail-btn" data-field="defensive_consequence" data-value="ball_recovered">Ball Recovered</button>
                  <button class="detail-btn" data-field="defensive_consequence" data-value="ball_with_opponent">Ball w/ Opponent</button>
                  <button class="detail-btn" data-field="defensive_consequence" data-value="foul_committed">Foul</button>
                  <button class="detail-btn" data-field="defensive_consequence" data-value="play_stopped">Play Stopped</button>
                </div>
              </div>
            \`;
          }

          detailsDiv.innerHTML = html;

          // Add event listeners to detail buttons
          document.querySelectorAll('.detail-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const field = e.target.dataset.field;
              const value = e.target.dataset.value;
              
              // Remove active class from sibling buttons with same data-field
              document.querySelectorAll(\`[data-field="\${field}"]\`).forEach(b => b.classList.remove('active'));
              e.target.classList.add('active');
              
              // Update form data
              if (field === 'defensive_pressure' || field === 'opponents_bypassed') {
                formData.annotation[field] = parseInt(value);
              } else {
                formData.annotation[field] = value;
              }
            });

            // Highlight active buttons on load
            const field = btn.dataset.field;
            const value = btn.dataset.value;
            if (formData.annotation[field] !== undefined) {
              const annotationValue = formData.annotation[field].toString();
              if (annotationValue === value) {
                btn.classList.add('active');
              }
            }
          });

          // Add goal selector click handler for shot category
          if (category === 'shot') {
            const goalClickArea = document.getElementById('goalClickArea');
            const goalMapContainer = document.getElementById('goalMapContainer');
            const goalMarker = document.getElementById('goalMarker');
            
            if (goalClickArea && goalMapContainer) {
              goalClickArea.addEventListener('click', (e) => {
                const rect = goalMapContainer.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                
                formData.annotation.goal_target_x = Math.round(x);
                formData.annotation.goal_target_y = Math.round(y);
                
                // Show marker
                goalMarker.style.display = 'block';
                goalMarker.style.left = x + '%';
                goalMarker.style.top = y + '%';
              });
              
              // Draw existing marker if position already set
              if (formData.annotation.goal_target_x !== undefined && formData.annotation.goal_target_y !== undefined) {
                goalMarker.style.display = 'block';
                goalMarker.style.left = formData.annotation.goal_target_x + '%';
                goalMarker.style.top = formData.annotation.goal_target_y + '%';
              }
            }
          }
        }

        // Pitch marker update function (global scope)
        function updatePitchMarkers() {
          const pitchMapContainer = document.getElementById('pitchMapContainer');
          
          // Remove existing markers
          const existingStartMarker = document.getElementById('pitchMarkerStart');
          const existingEndMarker = document.getElementById('pitchMarkerEnd');
          const existingLine = document.getElementById('pitchLine');
          
          if (existingStartMarker) existingStartMarker.remove();
          if (existingEndMarker) existingEndMarker.remove();
          if (existingLine) existingLine.remove();
          
          // Draw start marker
          if (formData.annotation.pitch_start_x !== undefined && formData.annotation.pitch_start_y !== undefined) {
            const startMarker = document.createElement('div');
            startMarker.id = 'pitchMarkerStart';
            startMarker.style.cssText = 'position: absolute; width: 16px; height: 16px; background: #3b82f6; border: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 10; left: ' + formData.annotation.pitch_start_x + '%; top: ' + formData.annotation.pitch_start_y + '%;';
            pitchMapContainer.appendChild(startMarker);
          }
          
          // Draw end marker if set
          if (formData.annotation.pitch_end_x !== undefined && formData.annotation.pitch_end_y !== undefined) {
            const endMarker = document.createElement('div');
            endMarker.id = 'pitchMarkerEnd';
            endMarker.style.cssText = 'position: absolute; width: 16px; height: 16px; background: #ef4444; border: 2px solid white; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 4px 6px rgba(0,0,0,0.3); z-index: 10; left: ' + formData.annotation.pitch_end_x + '%; top: ' + formData.annotation.pitch_end_y + '%;';
            pitchMapContainer.appendChild(endMarker);
            
            // Draw connecting line
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'pitchLine';
            svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;';
            svg.setAttribute('viewBox', '0 0 100 100');
            svg.setAttribute('preserveAspectRatio', 'none');
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', formData.annotation.pitch_start_x);
            line.setAttribute('y1', formData.annotation.pitch_start_y);
            line.setAttribute('x2', formData.annotation.pitch_end_x);
            line.setAttribute('y2', formData.annotation.pitch_end_y);
            line.setAttribute('stroke', 'white');
            line.setAttribute('stroke-width', '1');
            line.setAttribute('stroke-dasharray', '4');
            
            svg.appendChild(line);
            pitchMapContainer.appendChild(svg);
          }
        }
        
        // Pitch click handler
        const pitchClickArea = document.getElementById('pitchClickArea');
        const pitchMapContainer = document.getElementById('pitchMapContainer');
        
        if (pitchClickArea && pitchMapContainer) {
          pitchClickArea.addEventListener('click', (e) => {
            const rect = pitchMapContainer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            // For pass/dribble, handle start and end positions
            if ((selectedCategory === 'pass' || selectedCategory === 'dribble') && formData.annotation.pitch_start_x !== undefined) {
              // Set end position
              formData.annotation.pitch_end_x = Math.round(x);
              formData.annotation.pitch_end_y = Math.round(y);
            } else {
              // Set start position
              formData.annotation.pitch_start_x = Math.round(x);
              formData.annotation.pitch_start_y = Math.round(y);
            }
            
            // Redraw markers
            updatePitchMarkers();
          });
          
          // Draw existing markers on load
          updatePitchMarkers();
        }

        // Category selection with timing capture
        document.querySelectorAll('.category-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const clickedCategory = e.target.dataset.category;
            
            // If we don't have a start time yet, this click captures it
            if (popupActionStart === null) {
              console.log('[Popup] Capturing START time for category:', clickedCategory);
              // Send message to parent to capture start time
              if (window.opener) {
                window.opener.postMessage({
                  type: 'captureStartTime',
                  category: clickedCategory
                }, '*');
                
                // Show status message
                const statusDiv = document.getElementById('timingStatus');
                if (statusDiv) {
                  statusDiv.style.display = 'block';
                  statusDiv.style.background = '#dbeafe';
                  statusDiv.style.borderColor = '#3b82f6';
                  statusDiv.style.color = '#1e40af';
                }
              }
            }
            // If we have a start time and same category is clicked, capture end time
            else if (popupActionStart !== null && selectedCategory === clickedCategory) {
              console.log('[Popup] Capturing END time for category:', clickedCategory);
              // Send message to parent to capture end time and process
              if (window.opener) {
                window.opener.postMessage({
                  type: 'captureEndTime',
                  category: clickedCategory
                }, '*');
                
                // Hide status message
                const statusDiv = document.getElementById('timingStatus');
                if (statusDiv) {
                  statusDiv.style.display = 'none';
                }
              }
              return; // Exit without updating UI
            }
            
            // Standard category selection for display
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedCategory = clickedCategory;
            formData.selectedCategory = selectedCategory;
            
            // Apply theme color based on category
            const container = document.querySelector('.container');
            container.className = 'container theme-' + selectedCategory;
            
            // Reset end position when switching categories
            if (selectedCategory !== 'pass' && selectedCategory !== 'dribble') {
              formData.annotation.pitch_end_x = undefined;
              formData.annotation.pitch_end_y = undefined;
            }
            
            renderActionDetails(selectedCategory);
            
            // Re-highlight all buttons after rendering details
            setTimeout(() => {
              highlightAllButtons();
            }, 50);
          });

          // Right-click context menu for category buttons
          btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const contextMenu = document.getElementById('contextMenu');
            contextMenu.style.left = e.clientX + 'px';
            contextMenu.style.top = e.clientY + 'px';
            contextMenu.classList.add('visible');
            
            // Store which category we're editing properties for
            currentPropertiesCategory = e.target.dataset.category;
          });
        });

        // Close context menu on click elsewhere
        document.addEventListener('click', (e) => {
          const contextMenu = document.getElementById('contextMenu');
          if (contextMenu && !contextMenu.contains(e.target)) {
            contextMenu.classList.remove('visible');
          }
        });

        // Context menu action handler
        document.getElementById('contextMenu').addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          if (action === 'properties' && currentPropertiesCategory) {
            openPropertiesDialog(currentPropertiesCategory);
            document.getElementById('contextMenu').classList.remove('visible');
          }
        });

        // Properties dialog functions
        function openPropertiesDialog(category) {
          const timing = categoryTiming[category] || { lead: 0, lag: 0 };
          
          // Update dialog title
          const categoryNames = {
            'pass': 'Pass',
            'shot': 'Shot',
            'dribble': 'Dribble',
            'defensive_action': 'Defensive'
          };
          document.getElementById('propertiesTitle').textContent = categoryNames[category] || category;
          
          // Set slider values
          document.getElementById('leadTimeSlider').value = timing.lead || 0;
          document.getElementById('lagTimeSlider').value = timing.lag || 0;
          
          // Update displayed values
          document.getElementById('leadTimeValue').textContent = (timing.lead || 0) + 's';
          document.getElementById('lagTimeValue').textContent = (timing.lag || 0) + 's';
          
          // Show dialog
          document.getElementById('propertiesDialog').classList.add('visible');
          currentPropertiesCategory = category;
        }

        // Properties dialog controls
        document.getElementById('leadTimeSlider').addEventListener('input', (e) => {
          document.getElementById('leadTimeValue').textContent = e.target.value + 's';
        });

        document.getElementById('lagTimeSlider').addEventListener('input', (e) => {
          document.getElementById('lagTimeValue').textContent = e.target.value + 's';
        });

        document.getElementById('propertiesCancel').addEventListener('click', () => {
          document.getElementById('propertiesDialog').classList.remove('visible');
          currentPropertiesCategory = null;
        });

        document.getElementById('propertiesConfirm').addEventListener('click', () => {
          if (currentPropertiesCategory) {
            const leadTime = parseFloat(document.getElementById('leadTimeSlider').value);
            const lagTime = parseFloat(document.getElementById('lagTimeSlider').value);
            
            categoryTiming[currentPropertiesCategory] = { lead: leadTime, lag: lagTime };
            
            // Store in localStorage
            localStorage.setItem('actionCategoryTiming', JSON.stringify(categoryTiming));
            
            // Close dialog
            document.getElementById('propertiesDialog').classList.remove('visible');
            currentPropertiesCategory = null;
          }
        });

        // Close properties dialog when clicking outside
        document.getElementById('propertiesDialog').addEventListener('click', (e) => {
          if (e.target.id === 'propertiesDialog') {
            document.getElementById('propertiesDialog').classList.remove('visible');
            currentPropertiesCategory = null;
          }
        });

        // Explicit function to highlight all buttons based on formData
        function highlightAllButtons() {
          // Highlight category button
          if (selectedCategory) {
            document.querySelectorAll('.category-btn').forEach(btn => {
              if (btn.dataset.category === selectedCategory) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            });
          }
          
          // Highlight detail buttons
          document.querySelectorAll('.detail-btn').forEach(btn => {
            const field = btn.dataset.field;
            const value = btn.dataset.value;
            const annotationValue = formData.annotation[field];
            
            if (annotationValue !== undefined && annotationValue !== null) {
              if (annotationValue.toString() === value.toString()) {
                btn.classList.add('active');
              } else {
                btn.classList.remove('active');
              }
            } else {
              btn.classList.remove('active');
            }
          });
        }

        // Initialize on page load with existing data
        function initializePage() {
          
          // Pre-select category button if set
          if (selectedCategory) {
            const categoryBtn = document.querySelector(\`[data-category="\${selectedCategory}"]\`);
            if (categoryBtn) {
              categoryBtn.classList.add('active');
            }
            const container = document.querySelector('.container');
            container.className = 'container theme-' + selectedCategory;
            
            // IMPORTANT: Call renderActionDetails FIRST to create buttons
            renderActionDetails(selectedCategory);
            
            // THEN immediately highlight those buttons
            highlightAllButtons();
            
            // Clear end position for non-pass/dribble categories
            if (selectedCategory !== 'pass' && selectedCategory !== 'dribble') {
              formData.annotation.pitch_end_x = undefined;
              formData.annotation.pitch_end_y = undefined;
            }
          }
          
          // Pre-populate outcome radio
          if (formData.annotation.outcome) {
            const outcomeRadio = document.querySelector(\`input[name="outcome"][value="\${formData.annotation.outcome}"]\`);
            if (outcomeRadio) {
              outcomeRadio.checked = true;
            }
          }
          
          // Pre-populate context radio
          if (formData.annotation.context) {
            const contextRadio = document.querySelector(\`input[name="context"][value="\${formData.annotation.context}"]\`);
            if (contextRadio) {
              contextRadio.checked = true;
            }
          }
          
          // Pre-populate note field
          if (formData.annotation.note) {
            document.getElementById('noteField').value = formData.annotation.note;
          }
          
          // Draw pitch markers
          updatePitchMarkers();
        }
        
        // Call initialization right away
        initializePage();

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => {
          selectedCategory = null;
          formData.selectedCategory = null;
          formData.annotation.pitch_start_x = undefined;
          formData.annotation.pitch_start_y = undefined;
          formData.annotation.pitch_end_x = undefined;
          formData.annotation.pitch_end_y = undefined;
          document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
          document.getElementById('noteField').value = '';
          
          // Remove pitch markers
          const existingStartMarker = document.getElementById('pitchMarkerStart');
          const existingEndMarker = document.getElementById('pitchMarkerEnd');
          const existingLine = document.getElementById('pitchLine');
          if (existingStartMarker) existingStartMarker.remove();
          if (existingEndMarker) existingEndMarker.remove();
          if (existingLine) existingLine.remove();
          
          renderActionDetails(null);
          document.querySelector('input[name="outcome"][value="successful"]').checked = true;
          document.querySelector('input[name="context"][value="open_play"]').checked = true;
        });

        // Save button
        document.getElementById('saveBtn').addEventListener('click', () => {
          formData.annotation.note = document.getElementById('noteField').value;
          formData.annotation.outcome = document.querySelector('input[name="outcome"]:checked').value;
          formData.annotation.context = document.querySelector('input[name="context"]:checked').value;
          
          console.log('[Popup Save] Initial times:', {
            actionStart: formData.actionStart,
            actionEnd: formData.actionEnd,
            selectedCategory: formData.selectedCategory
          });
          
          // Apply lead/lag times to action start and end
          if (formData.selectedCategory && categoryTiming[formData.selectedCategory]) {
            const timing = categoryTiming[formData.selectedCategory];
            const leadTime = timing.lead || 0;
            const lagTime = timing.lag || 0;
            
            console.log('[Popup Save] Applying lead/lag times:', {
              leadTime: leadTime,
              lagTime: lagTime,
              category: formData.selectedCategory
            });
            
            // Apply lead time (subtract from start)
            formData.actionStart = Math.max(0, formData.actionStart - leadTime);
            
            // Apply lag time (add to end)
            formData.actionEnd = formData.actionEnd + lagTime;
            
            console.log('[Popup Save] After lead/lag adjustment:', {
              actionStart: formData.actionStart,
              actionEnd: formData.actionEnd
            });
          }
          
          if (window.opener) {
            window.opener.postMessage({
              type: 'annotationData',
              annotationId: annotationId,
              data: formData,
              categoryTiming: categoryTiming
            }, '*');
          }
          window.close();
        });
      </script>
    </body>
    </html>
    `;

    // Open new window with HTML
    const windowWidth = 1200;
    const windowHeight = 900;
    const left = (window.innerWidth - windowWidth) / 2 + window.screenX;
    const top = (window.innerHeight - windowHeight) / 2 + window.screenY;
    
    const popupWindow = window.open(
      '',
      'AnalystAnnotationPopup',
      `width=${windowWidth},height=${windowHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    if (popupWindow) {
      popupWindow.document.write(popupHTML);
      popupWindow.document.close();
      
      // Listen for messages from popup
      const handlePopupMessage = (e) => {
        // Handle start time capture from popup
        if (e.data.type === 'captureStartTime') {
          console.log('[Parent] Received captureStartTime from popup:', e.data.category);
          const absoluteTime = videoRef.current?.currentTime || 0;
          const matchStartTime = task?.match_start_time || 0;
          const segmentStartInSeconds = currentSegment ? (currentSegment.start_time / 1000) : 0;
          const relativeTime = Math.max(0, absoluteTime - (segmentStartInSeconds + matchStartTime));
          
          console.log('[Parent] Captured START time:', relativeTime.toFixed(2), 'at video time:', absoluteTime.toFixed(2));
          
          // Store in ref for immediate availability (state updates are async)
          capturedStartTimeRef.current = relativeTime;
          
          setActionStart(relativeTime);
          setSelectedCategory(e.data.category);
          
          // Send confirmation back to popup with captured time
          if (popupWindow && !popupWindow.closed) {
            popupWindow.postMessage({
              type: 'startTimeCaptured',
              startTime: relativeTime,
              category: e.data.category
            }, '*');
          }
          return;
        }
        
        // Handle end time capture from popup
        if (e.data.type === 'captureEndTime') {
          console.log('[Parent] Received captureEndTime from popup:', e.data.category);
          const absoluteTime = videoRef.current?.currentTime || 0;
          const matchStartTime = task?.match_start_time || 0;
          const segmentStartInSeconds = currentSegment ? (currentSegment.start_time / 1000) : 0;
          const relativeTime = Math.max(0, absoluteTime - (segmentStartInSeconds + matchStartTime));
          
          console.log('[Parent] Captured END time:', relativeTime.toFixed(2), 'at video time:', absoluteTime.toFixed(2));
          
          // Use the ref value which was set immediately when START was captured
          const startTime = capturedStartTimeRef.current;
          console.log('[Parent] END Times:', { start: startTime?.toFixed(2), end: relativeTime.toFixed(2) });
          
          setActionEnd(relativeTime);
          // Keep the popup open - user can close it when they want
          console.log('[Parent] Popup stays open for next action or to close manually');
          
          // Send confirmation back to popup with captured times (from ref, not state)
          if (popupWindow && !popupWindow.closed) {
            popupWindow.postMessage({
              type: 'endTimeCaptured',
              startTime: startTime,
              endTime: relativeTime,
              category: e.data.category
            }, '*');
          }
          return;
        }
        
        // Handle annotation data one last time
        if (e.data.type === 'annotationData') {
          const data = e.data.data;
          const annotationId = e.data.annotationId;
          const updatedTiming = e.data.categoryTiming;
          
          console.log('[Parent Message] Received annotation data:', {
            actionStart: data.actionStart,
            actionEnd: data.actionEnd,
            selectedCategory: data.selectedCategory,
            annotationId: annotationId
          });
          
          // Update category timing if provided
          if (updatedTiming) {
            setCategoryTiming(updatedTiming);
          }
          
          setAnnotation(data.annotation);
          setSelectedCategory(data.selectedCategory);
          setActionStart(data.actionStart);
          setActionEnd(data.actionEnd);
          
          // Automatically save the annotation to the database
          if (data.actionStart !== null && data.actionEnd !== null && data.selectedCategory && 
              video && task && currentSegment) {
            const matchStartTime = task?.match_start_time || 0;
            const segmentStartMs = currentSegment.start_time;
            const absoluteStartMs = Math.round((segmentStartMs / 1000 + data.actionStart) * 1000);
            const absoluteEndMs = Math.round((segmentStartMs / 1000 + data.actionEnd) * 1000);

            console.log('[Parent Save] Calculating absolute times:', {
              'data.actionStart (rel sec)': data.actionStart,
              'data.actionEnd (rel sec)': data.actionEnd,
              'segmentStartMs': segmentStartMs,
              'segmentStartSec': segmentStartMs / 1000,
              'calculatedAbsoluteStartMs': absoluteStartMs,
              'calculatedAbsoluteEndMs': absoluteEndMs,
              'durationMs': absoluteEndMs - absoluteStartMs
            });

            const payloadData = {
              video_id: video.id,
              start_time: absoluteStartMs,
              end_time: absoluteEndMs,
              action_category: data.selectedCategory,
              ...data.annotation
            };

            // If editing existing annotation, update it. Otherwise create new one.
            if (annotationId) {
              console.log('Updating annotation:', annotationId, payloadData);
              updateAnnotationMutation.mutate({ id: annotationId, data: payloadData });
            } else {
              console.log('Creating new annotation:', payloadData);
              createAnnotationMutation.mutate(payloadData);
            }
          }
          
          // Remove listener after annotation is processed
          window.removeEventListener('message', handlePopupMessage);
        }
      };
      
      window.addEventListener('message', handlePopupMessage);
    }
  };

  const handleSaveAnnotation = () => {
    if (!actionStart || !actionEnd || !selectedCategory) return;
    if (annotation.pitch_start_x === undefined || annotation.pitch_start_y === undefined) return;
    if (!video || !task || !currentSegment) {
      console.error('Missing required data:', { video, task, currentSegment });
      return;
    }

    // Convert segment-relative time to absolute time
    // currentSegment times are in milliseconds, actionStart/End are in seconds
    const absoluteStartMs = Math.round((currentSegment.start_time / 1000 + actionStart) * 1000);
    const absoluteEndMs = Math.round((currentSegment.start_time / 1000 + actionEnd) * 1000);

    const payloadData = {
      video_id: video.id,
      start_time: absoluteStartMs,
      end_time: absoluteEndMs,
      action_category: selectedCategory,
      ...annotation
    };

    console.log('Sending annotation payload:', payloadData);

    createAnnotationMutation.mutate(payloadData);
  };

  const handleCompleteTask = async () => {
    await updateTaskMutation.mutateAsync({
      id: taskId,
      data: { 
        status: 'completed',
        completed_date: new Date().toISOString()
      }
    });
    navigate(createPageUrl('AnalystDashboard'));
  };

  const canSave = actionStart !== null && 
    actionEnd !== null && 
    selectedCategory && 
    annotation.pitch_start_x !== undefined;

  // Debug logging for save button state
  React.useEffect(() => {
    console.log('Save button state:', {
      canSave,
      actionStart,
      actionEnd,
      selectedCategory,
      pitch_start_x: annotation.pitch_start_x,
      reasons: {
        'actionStart set': actionStart !== null,
        'actionEnd set': actionEnd !== null,
        'category selected': !!selectedCategory,
        'pitch position set': annotation.pitch_start_x !== undefined
      }
    });
  }, [actionStart, actionEnd, selectedCategory, annotation.pitch_start_x]);

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

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Analyst Annotation Tasks</h2>
          <p className="text-slate-500 mt-1">Select a task to start annotating</p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search by video title, player name, match, or assigned user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Status</option>
            <option value="pending_assignment">Pending Assignment</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {(() => {
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

          if (filteredTasks.length === 0 && allTasks.length > 0) {
            return (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
                  <p className="text-slate-500 text-lg mb-2">No tasks match your filters</p>
                  <p className="text-sm text-slate-400">Try adjusting your search or filters</p>
                </CardContent>
              </Card>
            );
          }

          if (allTasks.length === 0) {
            return (
              <Card className="border-0 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
                  <p className="text-slate-500 text-lg mb-2">No analyst tasks available</p>
                  <p className="text-sm text-slate-400">Complete video editor tasks to create analyst tasks</p>
                </CardContent>
              </Card>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => {
              const video = allVideos.find(v => v.id === task.video_id);
              const statusColors = {
                pending_assignment: 'bg-amber-100 text-amber-700',
                assigned: 'bg-blue-100 text-blue-700',
                in_progress: 'bg-purple-100 text-purple-700',
                completed: 'bg-emerald-100 text-emerald-700'
              };

              return (
                <Card
                  key={task.id}
                  className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => navigate(createPageUrl('AnalystDashboard') + `?taskId=${task.id}`)}
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
                          {video?.player_name || 'No player assigned'}
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
          );
        })()}
      </div>
    );
  }

  if (taskLoading || videoLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[400px] rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const getVideoUrl = (url) => {
    if (!url) return '';
    
    // Already a full HTTP(S) URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Already has leading slash
    if (url.startsWith('/')) {
      return url;
    }
    
    // Relative path - add leading slash
    // This handles cases like "videos/xyz.mp4"
    return `/${url}`;
  };



  return (
    <div className="space-y-6">
      {/* Success Notification */}
      {saveSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-700">✓ Action saved successfully! Check the Annotated Actions section below.</span>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Action Annotation</h2>
          <p className="text-slate-500">
            {video?.player_name} • {video?.home_team} vs {video?.away_team}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-100 text-emerald-700">
            {annotations.length} Actions Annotated
          </Badge>
          <Button 
            onClick={handlePopOutAnnotation}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Expand
          </Button>
          {annotations.length > 0 && (
            <Button onClick={handleCompleteTask} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Task
            </Button>
          )}
        </div>
      </div>

      {/* Video Player */}
      <Card className={`overflow-hidden border-0 shadow-lg ${isFullscreen ? 'video-player-fullscreen' : ''}`} ref={videoContainerRef}>
        <div className="bg-black relative">
          {segments.length === 0 ? (
            <div className="w-full h-[350px] flex items-center justify-center text-white">
              <div className="text-center">
                <Video className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                <p className="text-slate-400">No segments available</p>
                <p className="text-sm text-slate-500 mt-2">Segments need to be created in Video Editor first</p>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={getVideoUrl(video?.url || video?.file_url)}
                className={`w-full object-contain ${isFullscreen ? 'flex-1' : 'h-[350px]'}`}
                onLoadStart={() => {
                  const videoUrl = getVideoUrl(video?.url || video?.file_url);
                  console.log('Video load started, src:', videoUrl);
                  console.log('Raw video URL:', video?.url || video?.file_url);
                }}
                onTimeUpdate={() => {
                  if (!currentSegment) return;
                  const matchStartTime = task?.match_start_time || 0;
                  const absoluteTime = videoRef.current?.currentTime || 0;
                  // currentSegment.start_time is in milliseconds, convert to seconds
                  const segmentStartInSeconds = currentSegment.start_time / 1000;
                  const segmentEndInSeconds = currentSegment.end_time / 1000;
                  const relativeTime = absoluteTime - (segmentStartInSeconds + matchStartTime);
                  
                  // Debug logging every 100ms or so to minimize noise
                  if (Math.floor(relativeTime) !== Math.floor(segmentCurrentTime)) {
                    console.log('[TimeUpdate]', {
                      videoTime: absoluteTime.toFixed(2),
                      segmentStart: segmentStartInSeconds,
                      matchStartTime: matchStartTime,
                      calculatedRelativeTime: relativeTime.toFixed(2),
                      previousSegmentCurrentTime: segmentCurrentTime.toFixed(2)
                    });
                  }
                  
                  setSegmentCurrentTime(Math.max(0, relativeTime));
                  setCurrentTime(absoluteTime);
                  
                  // Auto-pause and auto-advance when segment ends
                  const segmentDurationSeconds = (currentSegment.end_time - currentSegment.start_time) / 1000;
                  if (relativeTime >= segmentDurationSeconds) {
                    videoRef.current.pause();
                    setIsPlaying(false);
                    
                    // Auto-advance to next segment after 1 second
                    setTimeout(() => {
                      if (currentSegmentIndex < segments.length - 1) {
                        setCurrentSegmentIndex(currentSegmentIndex + 1);
                      }
                    }, 1000);
                  }
                }}
                onSeeking={() => {
                  // Prevent seeking outside segment bounds
                  if (!currentSegment || !videoRef.current) return;
                  const matchStartTime = task?.match_start_time || 0;
                  const segmentStartInSeconds = currentSegment.start_time / 1000;
                  const segmentEndInSeconds = currentSegment.end_time / 1000;
                  const absoluteStart = segmentStartInSeconds + matchStartTime;
                  const absoluteEnd = segmentEndInSeconds + matchStartTime;
                  
                  if (videoRef.current.currentTime < absoluteStart) {
                    videoRef.current.currentTime = absoluteStart;
                  } else if (videoRef.current.currentTime > absoluteEnd) {
                    videoRef.current.currentTime = absoluteEnd;
                    videoRef.current.pause();
                    setIsPlaying(false);
                  }
                }}
                onLoadedMetadata={() => {
                  const dur = videoRef.current?.duration || 0;
                  console.log('Video loaded, duration:', dur);
                  setDuration(dur);
                }}
                onPlay={() => {
                  console.log('Video play started');
                  setIsPlaying(true);
                }}
                onPause={() => {
                  console.log('Video paused');
                  setIsPlaying(false);
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                }}
              />
              
              <div className="absolute top-4 left-4 space-y-2">
                <div className="bg-black/70 text-white px-3 py-1.5 rounded-lg font-mono text-sm">
                  {formatTime(segmentCurrentTime)} / {formatTime((currentSegment.end_time - currentSegment.start_time) / 1000)}
                </div>
                <div className="bg-emerald-600/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                  {currentSegment.zone ? `${{
                    'defending': 'Defending',
                    'attacking': 'Attacking',
                    'offensive_transition': 'Off Transition',
                    'defensive_transition': 'Def Transition'
                  }[currentSegment.zone] || currentSegment.zone}` : `Segment ${currentSegmentIndex + 1}`}
                  {currentSegment.zone && ` • Segment ${currentSegmentIndex + 1} of ${segments.length}`}
                </div>
              </div>
            </>
          )}
        </div>

        <CardContent className="p-4 bg-slate-900 space-y-4">
          {currentSegment && (
            <Slider
              value={[segmentCurrentTime]}
              max={(currentSegment.end_time - currentSegment.start_time) / 1000}
              step={0.1}
              onValueChange={(value) => {
                if (videoRef.current && currentSegment) {
                  const matchStartTime = task?.match_start_time || 0;
                  const startTimeInSeconds = (currentSegment.start_time / 1000) + matchStartTime;
                  const maxSegmentTime = (currentSegment.end_time - currentSegment.start_time) / 1000;
                  // Clamp the value to segment bounds
                  const clampedValue = Math.min(value[0], maxSegmentTime);
                  videoRef.current.currentTime = startTimeInSeconds + clampedValue;
                  setSegmentCurrentTime(clampedValue);
                }
              }}
              className="w-full"
            />
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={handlePreviousSegment}
                disabled={currentSegmentIndex === 0 || segments.length === 0}
                className="text-white hover:bg-white/20"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleSkip(-2)} className="text-white hover:bg-white/20" disabled={segments.length === 0}>
                <SkipBack className="w-5 h-5" />
              </Button>
              <Button 
                size="icon" 
                onClick={handlePlayPause} 
                className="bg-white text-slate-900 hover:bg-white/90 w-12 h-12"
                disabled={segments.length === 0}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => handleSkip(2)} className="text-white hover:bg-white/20" disabled={segments.length === 0}>
                <SkipForward className="w-5 h-5" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={handleNextSegment}
                disabled={currentSegmentIndex >= segments.length - 1 || segments.length === 0}
                className="text-white hover:bg-white/20"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-white text-sm font-medium px-3 py-2 bg-slate-700/50 rounded-lg">
                {actionStart === null 
                  ? "👉 Click category in popup" 
                  : `✓ Both times captured - Close popup to finish`}
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={handleFullscreen}
                className="text-white hover:bg-white/20"
                title="Fullscreen"
              >
                <Maximize2 className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Integrated Timeline Section - Only for Current Segment */}
          {!isFullscreen && annotations.length > 0 && currentSegment && (() => {
            const segmentAnnotations = annotations.filter(ann => {
              const annStart = ann.start_time / 1000;
              const annEnd = ann.end_time / 1000;
              const segStart = currentSegment.start_time / 1000;
              const segEnd = currentSegment.end_time / 1000;
              return annStart < segEnd && annEnd > segStart;
            });
            if (segmentAnnotations.length === 0) return null;
            const segmentDuration = (currentSegment.end_time - currentSegment.start_time) / 1000;
            const segmentStartTime = currentSegment.start_time / 1000;
            const colorMap = {
              'pass': '#3b82f6',
              'shot': '#ef4444',
              'dribble': '#f59e0b',
              'defensive_action': '#a855f7'
            };
            return (
              <div className="border-t border-slate-700 mt-6 pt-6 space-y-6">
                <div className="text-sm font-semibold text-slate-300">Timeline - {currentSegment.zone || `Segment ${currentSegmentIndex + 1}`}</div>
                <div className="space-y-2">
                  {actionCategories.map((cat) => {
                    const catAnnotations = segmentAnnotations.filter(a => a.action_category === cat.id);
                    const bgColor = colorMap[cat.id] || '#6b7280';
                    return (
                      <div key={cat.id} className="flex gap-3 items-center">
                        <div className="w-24 flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: bgColor }} />
                            <span className="text-xs font-medium text-slate-400">{cat.label}</span>
                          </div>
                        </div>
                        <div ref={timelineRef} className="flex-1 relative bg-slate-800 rounded h-6 border border-slate-600 overflow-hidden">
                          {catAnnotations.map((ann, idx) => {
                            const isDragging = dragState?.annotation?.id === ann.id;
                            const displayStartTime = isDragging && dragState.previewStart !== undefined ? dragState.previewStart / 1000 : ann.start_time / 1000;
                            const displayEndTime = isDragging && dragState.previewEnd !== undefined ? dragState.previewEnd / 1000 : ann.end_time / 1000;
                            const relativeStartTime = Math.max(0, displayStartTime - segmentStartTime);
                            const relativeEndTime = Math.min(segmentDuration, displayEndTime - segmentStartTime);
                            const startPercent = Math.max(0, Math.min(100, (relativeStartTime / segmentDuration) * 100));
                            const widthPercent = Math.max(2, Math.min(100 - startPercent, ((relativeEndTime - relativeStartTime) / segmentDuration) * 100));
                            return (
              <div
                                key={ann.id || idx}
                                      className="absolute h-full rounded hover:shadow-lg transition-all flex items-center justify-between px-1 text-center group/item relative"
                                      style={{
                                        left: `${startPercent}%`,
                                        width: `${widthPercent}%`,
                                        backgroundColor: bgColor,
                                        opacity: dragState?.annotation?.id === ann.id ? 0.8 : 0.95,
                                        zIndex: dragState?.annotation?.id === ann.id ? 50 : 10,
                                        cursor: 'move'
                                      }}
                                      onMouseDown={(e) => {
                                        if (e.button !== 0) return;
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const leftEdgeThreshold = 20;
                                        const rightEdgeThreshold = rect.width - 20;
                                        if (x < leftEdgeThreshold) {
                                          handleTimelineMouseDown(e, ann, 'start');
                                        } else if (x > rightEdgeThreshold) {
                                          handleTimelineMouseDown(e, ann, 'end');
                                        } else {
                                          handleTimelineMouseDown(e, ann, 'move');
                                        }
                                      }}
                                    >
                                      <div 
                                        className="absolute left-0 top-0 w-2 h-full bg-gradient-to-r from-white/60 to-white/20 cursor-ew-resize hover:from-white/100 hover:to-white/50 transition-all"
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          handleTimelineMouseDown(e, ann, 'start');
                                        }}
                                      />
                                      <span className="text-white text-xs font-bold whitespace-nowrap">
                                        {formatTime(relativeStartTime)}
                                      </span>
                                      <div 
                                        className="absolute right-0 top-0 w-2 h-full bg-gradient-to-l from-white/60 to-white/20 cursor-ew-resize hover:from-white/100 hover:to-white/50 transition-all"
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          handleTimelineMouseDown(e, ann, 'end');
                                        }}
                                      />
                                      <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                        <button
                                          className="p-0.5 rounded hover:bg-black/20 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingAnnotationId(ann.id);
                                            setAnnotation({
                                              pitch_start_x: ann.pitch_start_x,
                                              pitch_start_y: ann.pitch_start_y,
                                              pitch_end_x: ann.pitch_end_x,
                                              pitch_end_y: ann.pitch_end_y,
                                              outcome: ann.outcome,
                                              context: ann.context,
                                              pass_length: ann.pass_length,
                                              pass_direction: ann.pass_direction,
                                              shot_result: ann.shot_result,
                                              goal_target_x: ann.goal_target_x,
                                              goal_target_y: ann.goal_target_y,
                                              body_part: ann.body_part,
                                              defensive_pressure: ann.defensive_pressure,
                                              opponents_bypassed: ann.opponents_bypassed,
                                              defensive_action_type: ann.defensive_action_type,
                                              defensive_consequence: ann.defensive_consequence,
                                              note: ann.note
                                            });
                                            setSelectedCategory(ann.action_category);
                                            setActionStart(ann.start_time / 1000 - segmentStartTime);
                                            setActionEnd(ann.end_time / 1000 - segmentStartTime);
                                            setShouldOpenPopup(true);
                                          }}
                                        >
                                          <Edit className="w-3 h-3 text-white" />
                                        </button>
                                        <button
                                          className="p-0.5 rounded hover:bg-black/30 transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirmId(ann.id);
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3 text-white" />
                                        </button>
                                      </div>
              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => {
        if (!open) setDeleteConfirmId(null);
      }}>
        <DialogContent className="sm:max-w-md bg-white" style={{ 
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}>
          <DialogHeader>
            <DialogTitle>Delete Annotation</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">Are you sure you want to delete this annotation? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              No, Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirmId) {
                  deleteAnnotationMutation.mutate(deleteConfirmId);
                }
                setDeleteConfirmId(null);
              }}
            >
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Actions Toolbar - button moved to Annotated Actions header */}

        {/* Action Category Selection */}
        {/* <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Action Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              {actionCategories.map(cat => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  className={`h-16 flex-col gap-1 ${selectedCategory === cat.id ? cat.color : ''}`}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  <cat.icon className="w-5 h-5" />
                  {cat.label}
                </Button>
              ))}
            </div>

            <div>
              <Label className="mb-2 block">Pitch Position (Start)</Label>
              <PitchMap
                selectedX={annotation.pitch_start_x}
                selectedY={annotation.pitch_start_y}
                onSelect={(x, y) => setAnnotation(prev => ({ ...prev, pitch_start_x: x, pitch_start_y: y }))}
                showEnd={selectedCategory === 'pass' || selectedCategory === 'dribble'}
                endX={annotation.pitch_end_x}
                endY={annotation.pitch_end_y}
                onEndSelect={(x, y) => setAnnotation(prev => ({ ...prev, pitch_end_x: x, pitch_end_y: y }))}
              />
            </div>

            <div>
              <Label className="mb-2 block">Outcome</Label>
              <RadioGroup
                value={annotation.outcome}
                onValueChange={(v) => setAnnotation(prev => ({ ...prev, outcome: v }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="successful" id="successful" />
                  <Label htmlFor="successful" className="text-emerald-600 font-medium">Successful</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unsuccessful" id="unsuccessful" />
                  <Label htmlFor="unsuccessful" className="text-red-600 font-medium">Unsuccessful</Label>
                </div>
                {selectedCategory === 'defensive_action' && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partially_successful" id="partial" />
                    <Label htmlFor="partial" className="text-amber-600 font-medium">Partial</Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            <div>
              <Label className="mb-2 block">Context</Label>
              <RadioGroup
                value={annotation.context}
                onValueChange={(v) => setAnnotation(prev => ({ ...prev, context: v }))}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="open_play" id="open_play" />
                  <Label htmlFor="open_play">Open Play</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="set_piece" id="set_piece" />
                  <Label htmlFor="set_piece">Set Piece</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Action Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {selectedCategory === 'pass' && (
                <motion.div
                  key="pass"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="mb-2 block">Pass Length</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['short', 'medium', 'long'].map(length => (
                        <Button
                          key={length}
                          variant={annotation.pass_length === length ? 'default' : 'outline'}
                          className={annotation.pass_length === length ? 'bg-blue-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, pass_length: length }))}
                        >
                          {length.charAt(0).toUpperCase() + length.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Pass Direction (Optional)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {['forward', 'lateral', 'backward'].map(dir => (
                        <Button
                          key={dir}
                          variant={annotation.pass_direction === dir ? 'default' : 'outline'}
                          className={annotation.pass_direction === dir ? 'bg-blue-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, pass_direction: dir }))}
                        >
                          {dir.charAt(0).toUpperCase() + dir.slice(1)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

               Shot Fields 
              {selectedCategory === 'shot' && (
                <motion.div
                  key="shot"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="mb-2 block">Shot Result</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'goal', label: 'Goal', color: 'bg-emerald-600' },
                        { id: 'on_target', label: 'On Target', color: 'bg-blue-600' },
                        { id: 'off_target', label: 'Off Target', color: 'bg-slate-600' },
                        { id: 'blocked', label: 'Blocked', color: 'bg-amber-600' }
                      ].map(result => (
                        <Button
                          key={result.id}
                          variant={annotation.shot_result === result.id ? 'default' : 'outline'}
                          className={annotation.shot_result === result.id ? result.color : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, shot_result: result.id }))}
                        >
                          {result.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Goal Target Position</Label>
                    <GoalMap
                      selectedX={annotation.goal_target_x}
                      selectedY={annotation.goal_target_y}
                      onSelect={(x, y) => setAnnotation(prev => ({ ...prev, goal_target_x: x, goal_target_y: y }))}
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Body Part</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'right_foot', label: 'R Foot' },
                        { id: 'left_foot', label: 'L Foot' },
                        { id: 'head', label: 'Head' },
                        { id: 'other', label: 'Other' }
                      ].map(part => (
                        <Button
                          key={part.id}
                          variant={annotation.body_part === part.id ? 'default' : 'outline'}
                          className={annotation.body_part === part.id ? 'bg-red-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, body_part: part.id }))}
                        >
                          {part.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Defensive Pressure</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(num => (
                        <Button
                          key={num}
                          variant={annotation.defensive_pressure === num ? 'default' : 'outline'}
                          className={annotation.defensive_pressure === num ? 'bg-red-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, defensive_pressure: num }))}
                        >
                          {num === 3 ? '3+' : num}
                        </Button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              Dribble Fields 
              {selectedCategory === 'dribble' && (
                <motion.div
                  key="dribble"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="mb-2 block">Opponents Bypassed (Optional)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(num => (
                        <Button
                          key={num}
                          variant={annotation.opponents_bypassed === num ? 'default' : 'outline'}
                          className={annotation.opponents_bypassed === num ? 'bg-amber-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, opponents_bypassed: num }))}
                        >
                          {num === 3 ? '3+' : num}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    Click on the pitch map above to set start and end positions for the dribble.
                  </p>
                </motion.div>
              )}

               Defensive Action Fields 
              {selectedCategory === 'defensive_action' && (
                <motion.div
                  key="defensive"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div>
                    <Label className="mb-2 block">Defensive Action Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {defensiveTypes.map(dt => (
                        <Button
                          key={dt.id}
                          variant={annotation.defensive_action_type === dt.id ? 'default' : 'outline'}
                          className={`${annotation.defensive_action_type === dt.id ? 'bg-purple-600' : ''} text-xs h-auto py-2`}
                          onClick={() => setAnnotation(prev => ({ ...prev, defensive_action_type: dt.id }))}
                        >
                          {dt.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Attacking Players Nearby</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 1, 2, 3].map(num => (
                        <Button
                          key={num}
                          variant={annotation.defensive_pressure === num ? 'default' : 'outline'}
                          className={annotation.defensive_pressure === num ? 'bg-purple-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, defensive_pressure: num }))}
                        >
                          {num === 3 ? '3+' : num}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Immediate Consequence (Optional)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'ball_recovered', label: 'Ball Recovered' },
                        { id: 'ball_with_opponent', label: 'Ball w/ Opponent' },
                        { id: 'foul_committed', label: 'Foul' },
                        { id: 'play_stopped', label: 'Play Stopped' }
                      ].map(cons => (
                        <Button
                          key={cons.id}
                          variant={annotation.defensive_consequence === cons.id ? 'default' : 'outline'}
                          className={`${annotation.defensive_consequence === cons.id ? 'bg-purple-600' : ''} text-xs h-auto py-2`}
                          onClick={() => setAnnotation(prev => ({ ...prev, defensive_consequence: cons.id }))}
                        >
                          {cons.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Body Part / Technique (Optional)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'right_foot', label: 'Foot' },
                        { id: 'head', label: 'Head' },
                        { id: 'other', label: 'Body/Slide' }
                      ].map(part => (
                        <Button
                          key={part.id}
                          variant={annotation.body_part === part.id ? 'default' : 'outline'}
                          className={annotation.body_part === part.id ? 'bg-purple-600' : ''}
                          onClick={() => setAnnotation(prev => ({ ...prev, body_part: part.id }))}
                        >
                          {part.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {!selectedCategory && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 text-slate-400"
                >
                  <Crosshair className="w-12 h-12 mx-auto mb-4" />
                  <p>Select an action category to see specific fields</p>
                </motion.div>
              )}
            </AnimatePresence>

            Note 
            <div>
              <Label className="mb-2 block">Note (Optional)</Label>
              <Textarea
                placeholder="Add any additional observations..."
                value={annotation.note}
                onChange={(e) => setAnnotation(prev => ({ ...prev, note: e.target.value }))}
                rows={2}
              />
            </div>

             Save Button 
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={resetAnnotation}
                className="flex-1"
              >
                Reset
              </Button>
              <Button 
                onClick={handleSaveAnnotation}
                disabled={!canSave || createAnnotationMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                title={!canSave ? 'Set start/end times, select category, and click pitch position' : 'Save action'}
              >
                <Save className="w-4 h-4 mr-2" />
                Save Action
                {!canSave && (
                  <span className="ml-2 text-xs opacity-75">
                    ({!actionStart || !actionEnd ? 'Set times' : !selectedCategory ? 'Select category' : 'Click pitch'})
                  </span>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>*/}
      </div>

      {/* Annotated Actions List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Annotated Actions ({annotations.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {annotations.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400">No actions annotated yet. Mark action start/end times and fill in the details above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {annotations.map((ann, idx) => {
                const cat = actionCategories.find(c => c.id === ann.action_category);
                const Icon = cat?.icon || Crosshair;
                return (
                  <div
                    key={ann.id || idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                    onClick={() => {
                      setSelectedAnnotation(ann);
                      if (videoRef.current) {
                        videoRef.current.currentTime = ann.start_time / 1000;
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={`${cat?.color || 'bg-slate-500'} text-white`}>
                        <Icon className="w-3 h-3 mr-1" />
                        {cat?.label || ann.action_category}
                      </Badge>
                      <span className="text-xs text-slate-500 font-mono">
                        {formatTime(Math.max(0, ann.start_time / 1000 - (currentSegment ? currentSegment.start_time / 1000 : 0)))}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <span className={`text-xs font-medium capitalize ${ann.outcome === 'successful' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {ann.outcome?.replace(/_/g, ' ')}
                      </span>
                      {ann.shot_result && (
                        <>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-600 capitalize">{ann.shot_result?.replace(/_/g, ' ')}</span>
                        </>
                      )}
                      {ann.pass_length && (
                        <>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-600 capitalize">{ann.pass_length}</span>
                        </>
                      )}
                      {ann.defensive_action_type && (
                        <>
                          <span className="text-xs text-slate-300">•</span>
                          <span className="text-xs text-slate-600 capitalize">{ann.defensive_action_type?.replace(/_/g, ' ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expanded View Dialog */}
      {/*<Dialog open={isExpandedViewOpen} onOpenChange={setIsExpandedViewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Action Annotation Details - Expanded View</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           
            <div className="space-y-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Action Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {actionCategories.map(cat => (
                      <Button
                        key={cat.id}
                        variant={selectedCategory === cat.id ? 'default' : 'outline'}
                        className={`h-16 flex-col gap-1 ${selectedCategory === cat.id ? cat.color : ''}`}
                        onClick={() => setSelectedCategory(cat.id)}
                      >
                        <cat.icon className="w-5 h-5" />
                        {cat.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Pitch Position (Start)</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <PitchMap
                    selectedX={annotation.pitch_start_x}
                    selectedY={annotation.pitch_start_y}
                    onSelect={(x, y) => setAnnotation(prev => ({ ...prev, pitch_start_x: x, pitch_start_y: y }))}
                    showEnd={selectedCategory === 'pass' || selectedCategory === 'dribble'}
                    endX={annotation.pitch_end_x}
                    endY={annotation.pitch_end_y}
                    onEndSelect={(x, y) => setAnnotation(prev => ({ ...prev, pitch_end_x: x, pitch_end_y: y }))}
                  />
                </CardContent>
              </Card>
            </div>

      
            <div className="space-y-6">
         
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Action Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AnimatePresence mode="wait">
                    {selectedCategory === 'pass' && (
                      <motion.div key="pass" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div>
                          <Label className="mb-2 block text-sm">Pass Length</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {['short', 'medium', 'long'].map(length => (
                              <Button key={length} variant={annotation.pass_length === length ? 'default' : 'outline'} className={annotation.pass_length === length ? 'bg-blue-600 text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, pass_length: length }))}>
                                {length.charAt(0).toUpperCase() + length.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm">Pass Direction</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {['forward', 'lateral', 'backward'].map(dir => (
                              <Button key={dir} variant={annotation.pass_direction === dir ? 'default' : 'outline'} className={annotation.pass_direction === dir ? 'bg-blue-600 text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, pass_direction: dir }))}>
                                {dir.charAt(0).toUpperCase() + dir.slice(1)}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {selectedCategory === 'shot' && (
                      <motion.div key="shot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div>
                          <Label className="mb-2 block text-sm">Shot Result</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {[{ id: 'goal', label: 'Goal', color: 'bg-emerald-600' }, { id: 'on_target', label: 'On Target', color: 'bg-blue-600' }, { id: 'off_target', label: 'Off Target', color: 'bg-slate-600' }, { id: 'blocked', label: 'Blocked', color: 'bg-amber-600' }].map(result => (
                              <Button key={result.id} variant={annotation.shot_result === result.id ? 'default' : 'outline'} className={annotation.shot_result === result.id ? result.color + ' text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, shot_result: result.id }))}>{result.label}</Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm">Goal Target Position</Label>
                          <GoalMap selectedX={annotation.goal_target_x} selectedY={annotation.goal_target_y} onSelect={(x, y) => setAnnotation(prev => ({ ...prev, goal_target_x: x, goal_target_y: y }))} />
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm">Body Part</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[{ id: 'right_foot', label: 'R Foot' }, { id: 'left_foot', label: 'L Foot' }, { id: 'head', label: 'Head' }, { id: 'other', label: 'Other' }].map(part => (
                              <Button key={part.id} variant={annotation.body_part === part.id ? 'default' : 'outline'} className={annotation.body_part === part.id ? 'bg-red-600 text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, body_part: part.id }))}>{part.label}</Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm">Defensive Pressure</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map(num => (
                              <Button key={num} variant={annotation.defensive_pressure === num ? 'default' : 'outline'} className={annotation.defensive_pressure === num ? 'bg-red-600 text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, defensive_pressure: num }))}>{num === 3 ? '3+' : num}</Button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {selectedCategory === 'dribble' && (
                      <motion.div key="dribble" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div>
                          <Label className="mb-2 block text-sm">Opponents Bypassed</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map(num => (
                              <Button key={num} variant={annotation.opponents_bypassed === num ? 'default' : 'outline'} className={annotation.opponents_bypassed === num ? 'bg-amber-600 text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, opponents_bypassed: num }))}>{num === 3 ? '3+' : num}</Button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {selectedCategory === 'defensive_action' && (
                      <motion.div key="defensive" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                        <div>
                          <Label className="mb-2 block text-sm">Defensive Action Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {defensiveTypes.map(dt => (
                              <Button key={dt.id} variant={annotation.defensive_action_type === dt.id ? 'default' : 'outline'} className={`${annotation.defensive_action_type === dt.id ? 'bg-purple-600' : ''} text-xs h-auto py-2`} onClick={() => setAnnotation(prev => ({ ...prev, defensive_action_type: dt.id }))}>{dt.label}</Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="mb-2 block text-sm">Attacking Players Nearby</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[0, 1, 2, 3].map(num => (
                              <Button key={num} variant={annotation.defensive_pressure === num ? 'default' : 'outline'} className={annotation.defensive_pressure === num ? 'bg-purple-600 text-xs h-auto py-2' : 'text-xs h-auto py-2'} onClick={() => setAnnotation(prev => ({ ...prev, defensive_pressure: num }))}>{num === 3 ? '3+' : num}</Button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                    {!selectedCategory && (
                      <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-6 text-slate-400">
                        <p className="text-sm">Select a category to see details</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>

            
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Outcome & Context</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="mb-2 block text-sm">Outcome</Label>
                    <RadioGroup value={annotation.outcome} onValueChange={(v) => setAnnotation(prev => ({ ...prev, outcome: v }))} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="successful" id="exp-successful" />
                        <Label htmlFor="exp-successful" className="text-emerald-600 font-medium text-sm">Successful</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unsuccessful" id="exp-unsuccessful" />
                        <Label htmlFor="exp-unsuccessful" className="text-red-600 font-medium text-sm">Unsuccessful</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div>
                    <Label className="mb-2 block text-sm">Context</Label>
                    <RadioGroup value={annotation.context} onValueChange={(v) => setAnnotation(prev => ({ ...prev, context: v }))} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="open_play" id="exp-open" />
                        <Label htmlFor="exp-open" className="text-sm">Open Play</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="set_piece" id="exp-set" />
                        <Label htmlFor="exp-set" className="text-sm">Set Piece</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Note (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Add any additional observations..." value={annotation.note} onChange={(e) => setAnnotation(prev => ({ ...prev, note: e.target.value }))} rows={2} />
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { resetAnnotation(); setIsExpandedViewOpen(false); }}>
              Reset
            </Button>
            <Button onClick={() => { handleSaveAnnotation(); setIsExpandedViewOpen(false); }} disabled={!canSave || createAnnotationMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              <Save className="w-4 h-4 mr-2" />
              Save Action
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      */}

      {/* Annotation Details Modal */}
      <Dialog open={!!selectedAnnotation} onOpenChange={(open) => !open && setSelectedAnnotation(null)}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg">Action Details</DialogTitle>
          </DialogHeader>
          
          {selectedAnnotation && (
            <div className="space-y-3">
              {/* Category & Outcome */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Category</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0">
                    <Badge className={`${actionCategories.find(c => c.id === selectedAnnotation.action_category)?.color || 'bg-slate-500'} text-white text-xs`}>
                      {actionCategories.find(c => c.id === selectedAnnotation.action_category)?.label || selectedAnnotation.action_category}
                    </Badge>
                  </CardContent>
                </Card>
                
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Outcome</CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 pt-0">
                    <span className={`text-xs font-medium capitalize ${selectedAnnotation.outcome === 'successful' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {selectedAnnotation.outcome?.replace(/_/g, ' ')}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* Timing */}
              <Card className="border-0 shadow-sm p-0">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold">Timing</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Start Time</Label>
                      <p className="text-xs font-mono font-semibold mt-0.5">
                        {formatTime(Math.max(0, selectedAnnotation.start_time / 1000 - (currentSegment ? currentSegment.start_time / 1000 : 0)))}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">End Time</Label>
                      <p className="text-xs font-mono font-semibold mt-0.5">
                        {formatTime(Math.max(0, selectedAnnotation.end_time / 1000 - (currentSegment ? currentSegment.start_time / 1000 : 0)))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Context & Position */}
              <Card className="border-0 shadow-sm p-0">
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-xs font-semibold">Context</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-slate-500">Type</Label>
                      <p className="text-xs capitalize mt-0.5">{selectedAnnotation.context?.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-500">Start Pos</Label>
                      <p className="text-xs mt-0.5">({percentToMeters(selectedAnnotation.pitch_start_x, 'x')}m, {percentToMeters(selectedAnnotation.pitch_start_y, 'y')}m)</p>
                    </div>
                  </div>
                  {selectedAnnotation.pitch_end_x !== undefined && (
                    <div className="mt-2">
                      <Label className="text-xs text-slate-500">End Pos</Label>
                      <p className="text-xs mt-0.5">({percentToMeters(selectedAnnotation.pitch_end_x, 'x')}m, {percentToMeters(selectedAnnotation.pitch_end_y, 'y')}m)</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pass Details */}
              {selectedAnnotation.action_category === 'pass' && (
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Pass Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAnnotation.pass_length && (
                        <div>
                          <Label className="text-xs text-slate-500">Length</Label>
                          <p className="text-xs capitalize mt-0.5">{selectedAnnotation.pass_length}</p>
                        </div>
                      )}
                      {selectedAnnotation.pass_direction && (
                        <div>
                          <Label className="text-xs text-slate-500">Direction</Label>
                          <p className="text-xs capitalize mt-0.5">{selectedAnnotation.pass_direction}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shot Details */}
              {selectedAnnotation.action_category === 'shot' && (
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Shot Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAnnotation.shot_result && (
                        <div>
                          <Label className="text-xs text-slate-500">Result</Label>
                          <p className="text-xs capitalize mt-0.5">{selectedAnnotation.shot_result?.replace(/_/g, ' ')}</p>
                        </div>
                      )}
                      {selectedAnnotation.body_part && (
                        <div>
                          <Label className="text-xs text-slate-500">Body Part</Label>
                          <p className="text-xs capitalize mt-0.5">{selectedAnnotation.body_part?.replace(/_/g, ' ')}</p>
                        </div>
                      )}
                      {selectedAnnotation.defensive_pressure !== undefined && (
                        <div>
                          <Label className="text-xs text-slate-500">Pressure</Label>
                          <p className="text-xs mt-0.5">{selectedAnnotation.defensive_pressure}</p>
                        </div>
                      )}
                      {selectedAnnotation.goal_target_x !== undefined && (
                        <div>
                          <Label className="text-xs text-slate-500">Goal Target</Label>
                          <p className="text-xs mt-0.5">({percentToMeters(selectedAnnotation.goal_target_x, 'x')}m, {percentToMeters(selectedAnnotation.goal_target_y, 'y')}m)</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Dribble Details */}
              {selectedAnnotation.action_category === 'dribble' && (
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Dribble Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div>
                      <Label className="text-xs text-slate-500">Opponents Bypassed</Label>
                      <p className="text-xs mt-0.5">{selectedAnnotation.opponents_bypassed}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Defensive Details */}
              {selectedAnnotation.action_category === 'defensive_action' && (
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Defensive Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <div className="grid grid-cols-2 gap-3">
                      {selectedAnnotation.defensive_action_type && (
                        <div>
                          <Label className="text-xs text-slate-500">Type</Label>
                          <p className="text-xs capitalize mt-0.5">{selectedAnnotation.defensive_action_type?.replace(/_/g, ' ')}</p>
                        </div>
                      )}
                      {selectedAnnotation.defensive_consequence && (
                        <div>
                          <Label className="text-xs text-slate-500">Consequence</Label>
                          <p className="text-xs capitalize mt-0.5">{selectedAnnotation.defensive_consequence?.replace(/_/g, ' ')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Note */}
              {selectedAnnotation.note && (
                <Card className="border-0 shadow-sm p-0">
                  <CardHeader className="pb-2 pt-3 px-3">
                    <CardTitle className="text-xs font-semibold">Note</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-slate-700">{selectedAnnotation.note}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}

