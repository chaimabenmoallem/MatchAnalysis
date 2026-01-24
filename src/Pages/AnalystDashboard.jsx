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
  Plus
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
  
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [segmentCurrentTime, setSegmentCurrentTime] = useState(0);
  
  // Action annotation state
  const [actionStart, setActionStart] = useState(null);
  const [actionEnd, setActionEnd] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      return await videoService.get(task.video_id);
    },
    enabled: !!task?.video_id
  });

  const { data: segments = [] } = useQuery({
    queryKey: ['segments', task?.video_id],
    queryFn: () => videoSegmentService.filter({ video_id: task.video_id }, 'start_time'),
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

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }) => videoTaskService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task', taskId] })
  });

  const currentSegment = segments[currentSegmentIndex];

  const resetAnnotation = () => {
    setActionStart(null);
    setActionEnd(null);
    setSelectedCategory(null);
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
      console.log('Loading segment, setting currentTime to:', startTimeInSeconds);
      videoRef.current.currentTime = startTimeInSeconds;
      setSegmentCurrentTime(0);
    }
  }, [currentSegmentIndex, currentSegment, video, task]);

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
    setActionStart(segmentCurrentTime);
  };

  const handleSetActionEnd = () => {
    setActionEnd(segmentCurrentTime);
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
    navigate(createPageUrl('Tasks'));
  };

  const canSave = actionStart !== null && 
    actionEnd !== null && 
    selectedCategory && 
    annotation.pitch_start_x !== undefined;

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
    if (url.startsWith('http')) return url;
    return `/${url}`;
  };

  return (
    <div className="space-y-6">
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
          {annotations.length > 0 && (
            <Button onClick={handleCompleteTask} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Complete Task
            </Button>
          )}
        </div>
      </div>

      {/* Video Player */}
      <Card className="overflow-hidden border-0 shadow-lg">
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
                className="w-full h-[350px] object-contain"
                onTimeUpdate={() => {
                  if (!currentSegment) return;
                  const matchStartTime = task?.match_start_time || 0;
                  const absoluteTime = videoRef.current?.currentTime || 0;
                  // currentSegment.start_time is in milliseconds, convert to seconds
                  const segmentStartInSeconds = currentSegment.start_time / 1000;
                  const segmentEndInSeconds = currentSegment.end_time / 1000;
                  const relativeTime = absoluteTime - (segmentStartInSeconds + matchStartTime);
                  
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
                  Segment {currentSegmentIndex + 1} of {segments.length}
                  {currentSegment.zone && ` • ${currentSegment.zone}`}
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
              <Button 
                variant={actionStart !== null ? "default" : "outline"}
                onClick={handleSetActionStart}
                className={actionStart !== null ? "bg-emerald-600" : "text-white border-white/30"}
                disabled={segments.length === 0}
              >
                <Flag className="w-4 h-4 mr-2" />
                Start: {actionStart !== null ? formatTime(actionStart) : '--:--'}
              </Button>
              <Button 
                variant={actionEnd !== null ? "default" : "outline"}
                onClick={handleSetActionEnd}
                className={actionEnd !== null ? "bg-red-600" : "text-white border-white/30"}
                disabled={segments.length === 0}
              >
                <Flag className="w-4 h-4 mr-2" />
                End: {actionEnd !== null ? formatTime(actionEnd) : '--:--'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Action Category Selection */}
        <Card className="border-0 shadow-sm">
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

            {/* Pitch Position */}
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

            {/* Outcome */}
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

            {/* Context */}
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

        {/* Category-specific fields */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle>Action Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {/* Pass Fields */}
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

              {/* Shot Fields */}
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

              {/* Dribble Fields */}
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

              {/* Defensive Action Fields */}
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

            {/* Note */}
            <div>
              <Label className="mb-2 block">Note (Optional)</Label>
              <Textarea
                placeholder="Add any additional observations..."
                value={annotation.note}
                onChange={(e) => setAnnotation(prev => ({ ...prev, note: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Save Button */}
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
        </Card>
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
                        {formatTime(ann.start_time / 1000)}
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
    </div>
  );
}