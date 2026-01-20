import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  Badge,
  Button,
  Input,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Skeleton
} from '@mui/material'; // Replace with MUI or your preferred UI components
import {
  Search,
  Clock,
  User,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Video,
  BarChart3
} from 'lucide-react';

// Replace this with your actual routing util
const createPageUrl = (path) => path;

const statusConfig = {
  pending_processing: { label: 'Pending', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  pending_assignment: { label: 'Awaiting Assignment', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: User },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: User },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Play },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertCircle },
};

// Simulated fetch functions
const fetchTasks = () => new Promise((resolve) => {
  setTimeout(() => resolve([
    { id: 1, video_id: 1, status: 'pending_processing', task_type: 'video_processing', assigned_to: 'Alice', created_at: new Date() },
    { id: 2, video_id: 2, status: 'completed', task_type: 'analyst_annotation', assigned_to: 'Bob', created_at: new Date() },
  ]), 500);
});

const fetchVideos = () => new Promise((resolve) => {
  setTimeout(() => resolve([
    { id: 1, title: 'Video 1', player_name: 'Player 1', jersey_number: 10, player_position: 'Forward', home_team: 'Team A', away_team: 'Team B', competition: 'League', format: 'mp4' },
    { id: 2, title: 'Video 2', player_name: 'Player 2', jersey_number: 7, player_position: 'Midfielder', home_team: 'Team C', away_team: 'Team D', competition: 'Cup', format: 'mp4' },
  ]), 500);
});

export default class Tasks extends Component {
  constructor(props) {
    super(props);
    this.state = {
      searchTerm: '',
      statusFilter: 'all',
      taskTypeFilter: 'all',
      tasks: [],
      videos: [],
      loading: true
    };
  }

  async componentDidMount() {
    const [tasks, videos] = await Promise.all([fetchTasks(), fetchVideos()]);
    this.setState({ tasks, videos, loading: false });
  }

  render() {
    const { searchTerm, statusFilter, taskTypeFilter, tasks, videos, loading } = this.state;

    if (loading) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      );
    }

    const videoMap = videos.reduce((acc, v) => ({ ...acc, [v.id]: v }), {});

    const filteredTasks = tasks.filter(task => {
      const video = videoMap[task.video_id];
      const matchesSearch = !searchTerm ||
        video?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        video?.player_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesType = taskTypeFilter === 'all' || task.task_type === taskTypeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });

    const processingTasks = filteredTasks.filter(t => t.task_type === 'video_processing');
    const analystTasks = filteredTasks.filter(t => t.task_type === 'analyst_annotation');

    const stats = {
      total: tasks.length,
      pending: tasks.filter(t => ['pending_processing', 'pending_assignment'].includes(t.status)).length,
      inProgress: tasks.filter(t => ['assigned', 'in_progress'].includes(t.status)).length,
      completed: tasks.filter(t => t.status === 'completed').length
    };

    return (
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p>Total Tasks</p>
                  <p>{stats.total}</p>
                </div>
                <BarChart3 />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p>Pending</p>
                  <p>{stats.pending}</p>
                </div>
                <Clock />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p>In Progress</p>
                  <p>{stats.inProgress}</p>
                </div>
                <Play />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p>Completed</p>
                  <p>{stats.completed}</p>
                </div>
                <CheckCircle2 />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search />
                <Input
                  placeholder="Search by video or player name..."
                  value={searchTerm}
                  onChange={(e) => this.setState({ searchTerm: e.target.value })}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => this.setState({ statusFilter: e.target.value })}
              >
                <option value="all">All Status</option>
                <option value="pending_processing">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Tabs */}
        <Tabs>
          <TabsList>
            <TabsTrigger value="processing">
              <Video /> Video Processing ({processingTasks.length})
            </TabsTrigger>
            <TabsTrigger value="analyst">
              <BarChart3 /> Analyst Annotation ({analystTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="processing">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processingTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        No video processing tasks found
                      </TableCell>
                    </TableRow>
                  ) : processingTasks.map((task) => {
                    const video = videoMap[task.video_id];
                    const status = statusConfig[task.status];
                    const StatusIcon = status?.icon || Clock;

                    return (
                      <TableRow key={task.id}>
                        <TableCell>{video?.title || 'Unknown Video'}</TableCell>
                        <TableCell>{video?.player_name || '-'}</TableCell>
                        <TableCell>{video?.home_team} vs {video?.away_team}</TableCell>
                        <TableCell>
                          <Badge>
                            <StatusIcon /> {status?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.assigned_to || '-'}</TableCell>
                        <TableCell>{format(new Date(task.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Link to={createPageUrl(`VideoEditor?taskId=${task.id}`)}>
                            <Button>Open <ArrowUpRight /></Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="analyst">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Player</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analystTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12">
                        No analyst annotation tasks found
                      </TableCell>
                    </TableRow>
                  ) : analystTasks.map((task) => {
                    const video = videoMap[task.video_id];
                    const status = statusConfig[task.status];
                    const StatusIcon = status?.icon || Clock;

                    return (
                      <TableRow key={task.id}>
                        <TableCell>{video?.title || 'Unknown Video'}</TableCell>
                        <TableCell>{video?.player_name || '-'}</TableCell>
                        <TableCell>{video?.home_team} vs {video?.away_team}</TableCell>
                        <TableCell>
                          <Badge>
                            <StatusIcon /> {status?.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.assigned_to || '-'}</TableCell>
                        <TableCell>{format(new Date(task.created_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell>
                          <Link to={createPageUrl(`AnalystDashboard?taskId=${task.id}`)}>
                            <Button>Annotate <ArrowUpRight /></Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }
}
