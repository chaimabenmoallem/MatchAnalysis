import React, { Component } from 'react';
import { videoTaskService, videoService, actionAnnotationService } from '../api/apiClient';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { 
  Upload, 
  Video, 
  ClipboardList, 
  BarChart3,
  Play,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Users,
  Target
} from 'lucide-react';
import { Skeleton } from "../Components/ui/skeleton";
import { motion } from 'framer-motion';

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      tasks: [],
      videos: [],
      annotations: [],
      tasksLoading: true,
      videosLoading: true,
      annotationsLoading: true
    };
  }

  async componentDidMount() {
    await this.loadData();
  }

  loadData = async () => {
    try {
      const [tasks, videos, annotations] = await Promise.all([
        videoTaskService.filter({}, '-created_at'),
        videoService.list(),
        actionAnnotationService.list()
      ]);

      this.setState({
        tasks: tasks.slice(0, 20),
        videos: videos.slice(0, 10),
        annotations: annotations.slice(0, 100),
        tasksLoading: false,
        videosLoading: false,
        annotationsLoading: false
      });
    } catch (error) {
      console.error('Error loading home data:', error);
      this.setState({
        tasksLoading: false,
        videosLoading: false,
        annotationsLoading: false,
        error: 'Failed to load data. Please refresh the page.'
      });
    }
  };

  render() {
    const { tasks, videos, annotations, tasksLoading, videosLoading, error } = this.state;

    if (error) {
      return (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">{error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    const myTasks = tasks.filter(t => t.assigned_to);
    const pendingTasks = myTasks.filter(t => ['assigned', 'in_progress'].includes(t.status));
    const completedTasks = myTasks.filter(t => t.status === 'completed');

    const quickActions = [
      { 
        title: 'Upload Video', 
        description: 'Upload a new match video for analysis', 
        icon: Upload, 
        href: createPageUrl('UploadVideo'),
        color: 'bg-emerald-500'
      },
      { 
        title: 'My Tasks', 
        description: `${pendingTasks.length} pending tasks`, 
        icon: ClipboardList, 
        href: createPageUrl('Tasks'),
        color: 'bg-blue-500'
      },
      { 
        title: 'Video Editor', 
        description: 'Process and segment videos', 
        icon: Video, 
        href: createPageUrl('VideoEditor'),
        color: 'bg-purple-500'
      },
      { 
        title: 'Analyst Dashboard', 
        description: 'Annotate player actions', 
        icon: BarChart3, 
        href: createPageUrl('AnalystDashboard'),
        color: 'bg-amber-500'
      }
    ];

    const recentVideos = videos.slice(0, 5);

    if (tasksLoading || videosLoading) {
      return (
        <div className="space-y-8">
          <Skeleton className="h-32 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2">
              Welcome back, User
            </h1>
            <p className="text-slate-300 mb-6 max-w-xl">
              Your soccer video analysis platform. Upload match videos, track players, and generate detailed performance analytics.
            </p>
            
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingTasks.length}</p>
                  <p className="text-sm text-slate-400">Pending Tasks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedTasks.length}</p>
                  <p className="text-sm text-slate-400">Completed</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{annotations.length}</p>
                  <p className="text-sm text-slate-400">Annotations</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, idx) => (
            <motion.div
              key={action.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Link to={action.href}>
                <Card className="h-full border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <action.icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">{action.title}</h3>
                    <p className="text-sm text-slate-500">{action.description}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Videos */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-500" />
                Recent Videos
              </CardTitle>
              <Link to={createPageUrl('Tasks')}>
                <Button variant="ghost" size="sm" className="text-slate-500">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentVideos.length === 0 ? (
                <div className="text-center py-8">
                  <Video className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500 mb-4">No videos uploaded yet</p>
                  <Link to={createPageUrl('UploadVideo')}>
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Your First Video
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentVideos.map(video => (
                    <div key={video.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center">
                        <Play className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{video.title}</p>
                        <p className="text-sm text-slate-500">
                          {video.player_name} • {video.home_team} vs {video.away_team}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {video.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Tasks */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                My Tasks
              </CardTitle>
              <Link to={createPageUrl('Tasks')}>
                <Button variant="ghost" size="sm" className="text-slate-500">
                  View All <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {pendingTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
                  <p className="text-slate-500">No pending tasks</p>
                  <p className="text-sm text-slate-400">You're all caught up!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.slice(0, 5).map(task => {
                    const video = videos.find(v => v.id === task.video_id);
                    return (
                      <Link 
                        key={task.id} 
                        to={createPageUrl(task.task_type === 'video_processing' ? `VideoEditor?taskId=${task.id}` : `AnalystDashboard?taskId=${task.id}`)}
                      >
                        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            task.task_type === 'video_processing' ? 'bg-purple-100' : 'bg-amber-100'
                          }`}>
                            {task.task_type === 'video_processing' ? (
                              <Video className="w-5 h-5 text-purple-600" />
                            ) : (
                              <BarChart3 className="w-5 h-5 text-amber-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {video?.title || 'Video Task'}
                            </p>
                            <p className="text-sm text-slate-500">
                              {task.task_type === 'video_processing' ? 'Video Processing' : 'Analyst Annotation'}
                            </p>
                          </div>
                          <Badge className={task.status === 'in_progress' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                            {task.status?.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Summary */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Annotation Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <p className="text-3xl font-bold text-blue-600">
                  {annotations.filter(a => a.action_category === 'pass').length}
                </p>
                <p className="text-sm text-slate-600 mt-1">Passes</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl">
                <p className="text-3xl font-bold text-red-600">
                  {annotations.filter(a => a.action_category === 'shot').length}
                </p>
                <p className="text-sm text-slate-600 mt-1">Shots</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-xl">
                <p className="text-3xl font-bold text-amber-600">
                  {annotations.filter(a => a.action_category === 'dribble').length}
                </p>
                <p className="text-sm text-slate-600 mt-1">Dribbles</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-xl">
                <p className="text-3xl font-bold text-purple-600">
                  {annotations.filter(a => a.action_category === 'defensive_action').length}
                </p>
                <p className="text-sm text-slate-600 mt-1">Defensive Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}