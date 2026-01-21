import React, { useState } from 'react';
import { userService, videoTaskService, videoService } from '../api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Button } from "../Components/ui/button";
import { Badge } from "../Components/ui/badge";
import { Input } from "../Components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../Components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../Components/ui/dialog";
import { 
  Users, 
  ClipboardList, 
  Video, 
  BarChart3,
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  Play,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from "../Components/ui/skeleton";
import { toast } from "sonner";

const statusConfig = {
  pending_processing: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  pending_assignment: { label: 'Awaiting Assignment', color: 'bg-orange-100 text-orange-700' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
};

export default function Admin() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list(),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => videoTaskService.list('-created_at', 100),
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => videoService.list(),
  });

  const videoMap = videos.reduce((acc, v) => ({ ...acc, [v.id]: v }), {});

  const assignTaskMutation = useMutation({
    mutationFn: async ({ taskId, userEmail }) => {
      return videoTaskService.update(taskId, {
        assigned_to: userEmail,
        status: 'assigned',
        assigned_date: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setAssignDialogOpen(false);
      setSelectedTask(null);
      setSelectedUser('');
      toast.success('Task assigned successfully');
    }
  });

  const handleAssignTask = () => {
    if (!selectedTask || !selectedUser) return;
    assignTaskMutation.mutate({ taskId: selectedTask.id, userEmail: selectedUser });
  };

  const pendingTasks = tasks.filter(t => ['pending_processing', 'pending_assignment'].includes(t.status));
  const inProgressTasks = tasks.filter(t => ['assigned', 'in_progress'].includes(t.status));
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'bg-blue-500' },
    { label: 'Total Videos', value: videos.length, icon: Video, color: 'bg-purple-500' },
    { label: 'Pending Tasks', value: pendingTasks.length, icon: Clock, color: 'bg-amber-500' },
    { label: 'Completed Tasks', value: completedTasks.length, icon: CheckCircle2, color: 'bg-emerald-500' },
  ];

  if (usersLoading || tasksLoading || videosLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <Card key={idx} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Task Assignment */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-emerald-500" />
              Task Management
            </CardTitle>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Video</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks
                .filter(task => {
                  const video = videoMap[task.video_id];
                  return !searchTerm || 
                    video?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    video?.player_name?.toLowerCase().includes(searchTerm.toLowerCase());
                })
                .map((task) => {
                  const video = videoMap[task.video_id];
                  const status = statusConfig[task.status];
                  
                  return (
                    <TableRow key={task.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium truncate max-w-[200px]">
                            {video?.title || 'Unknown'}
                          </p>
                          <p className="text-xs text-slate-500">{video?.player_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {task.task_type === 'video_processing' ? 'Video Processing' : 'Analyst'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={status?.color}>
                          {status?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.assigned_to || <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell>
                        {format(new Date(task.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {['pending_processing', 'pending_assignment'].includes(task.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTask(task);
                              setAssignDialogOpen(true);
                            }}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Assign
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Tasks</TableHead>
                <TableHead>Completed Tasks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const userTasks = tasks.filter(t => t.assigned_to === user.email);
                const completedCount = userTasks.filter(t => t.status === 'completed').length;
                
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{userTasks.length}</TableCell>
                    <TableCell>
                      <span className="text-emerald-600 font-medium">{completedCount}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Task</DialogTitle>
            <DialogDescription>
              Assign this task to a team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">Video</p>
              <p className="font-medium">{videoMap[selectedTask?.video_id]?.title}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-1">Task Type</p>
              <p className="font-medium">
                {selectedTask?.task_type === 'video_processing' ? 'Video Processing' : 'Analyst Annotation'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-2">Assign To</p>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssignTask}
                disabled={!selectedUser || assignTaskMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Assign Task
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}