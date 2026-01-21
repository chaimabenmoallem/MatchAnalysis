import React, { Component } from 'react';
import { videoService, videoTaskService, storageService } from '../api/supabaseClient';
import { Button } from "../Components/ui/button";
import { Input } from "../Components/ui/input";
import { Label } from "../Components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../Components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../Components/ui/select";
import { Progress } from "../Components/ui/progress";
import { Switch } from "../Components/ui/switch";
import { 
  Upload, 
  Video, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Calendar,
  Users,
  MapPin,
  User,
  Shirt,
  Clock,
  Target,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

class UploadVideoWrapper extends Component {
  render() {
    const navigate = (url) => window.location.href = url;
    return <UploadVideo navigate={navigate} />;
  }
}

class UploadVideo extends Component {
  constructor(props) {
    super(props);
    
    this.fileInputRef = React.createRef();
    
    this.state = {
      step: 1,
      uploading: false,
      uploadProgress: 0,
      extractingFrames: false,
      selectedFrames: [],
      currentFrameIndex: 0,
      videoData: {
        title: '',
        file_url: '',
        duration: 0,
        resolution: '',
        frame_rate: 0,
        file_size: 0,
        format: 'mp4',
        home_team: '',
        away_team: '',
        competition: '',
        match_date: '',
        venue: '',
        player_name: '',
        jersey_number: '',
        player_team: '',
        player_position: '',
        played_full_match: true,
        minutes_played: 90,
        sample_frames: [],
        status: 'uploaded',
        storage_path: ''
      },
      error: ''
    };
  }

  handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validFormats = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!validFormats.includes(file.type)) {
      this.setState({ error: 'Invalid format. Please upload MP4, MOV, AVI, or MKV files.' });
      return;
    }

    this.setState({ error: '', uploading: true, uploadProgress: 0 });

    const progressInterval = setInterval(() => {
      this.setState(prev => {
        if (prev.uploadProgress >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return { uploadProgress: prev.uploadProgress + 10 };
      });
    }, 200);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const uniqueId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      const storagePath = `videos/${uniqueId}.${extension}`;
      
      const result = await storageService.uploadFile(file, storagePath, (progress) => {
        this.setState({ uploadProgress: Math.max(progress, 50) });
      });
      
      clearInterval(progressInterval);
      this.setState({ uploadProgress: 100 });

      const formatMap = { mp4: 'mp4', mov: 'mov', avi: 'avi', mkv: 'mkv' };

      this.setState(prev => ({
        videoData: {
          ...prev.videoData,
          title: file.name.replace(/\.[^/.]+$/, ''),
          file_url: storageService.getPublicUrl(storagePath),
          file_size: file.size,
          format: formatMap[extension] || 'mp4',
          storage_path: storagePath
        }
      }));

      setTimeout(() => {
        this.setState(prev => ({
          videoData: {
            ...prev.videoData,
            duration: 5400,
            resolution: '1920x1080',
            frame_rate: 30
          },
          uploading: false,
          step: 2
        }));
      }, 1000);
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Upload error:', err);
      this.setState({ error: `Upload failed: ${err.message}`, uploading: false });
    }
  };

  handleMatchInfoSubmit = () => {
    const { videoData } = this.state;
    if (!videoData.home_team || !videoData.away_team) {
      this.setState({ error: 'Please fill in required match information.' });
      return;
    }
    this.setState({ error: '', step: 3 });
  };

  handlePlayerInfoSubmit = () => {
    const { videoData } = this.state;
    if (!videoData.player_name || !videoData.player_team) {
      this.setState({ error: 'Please fill in required player information.' });
      return;
    }
    this.setState({ error: '' });
    this.extractFrames();
  };

  extractFrames = async () => {
    this.setState({ extractingFrames: true, step: 4 });
    
    try {
      const { videoData } = this.state;
      const fileUrl = videoData.file_url;
      console.log('Starting frame extraction from:', fileUrl);
      
      const result = await actionAnnotationService.extractFrames(fileUrl);
      if (result && result.frames) {
        console.log(`Successfully extracted ${result.frames.length} frames from backend`);
        this.setState(prev => ({
          videoData: {
            ...prev.videoData,
            sample_frames: result.frames.map((frame_url, index) => ({
              timestamp: 0, // Backend doesn't return timestamps yet, could be improved
              frame_url: frame_url,
              annotation: null
            }))
          },
          extractingFrames: false
        }));
      } else {
        throw new Error('No frames returned from backend');
      }
    } catch (err) {
      console.error('Frame extraction error:', err);
      this.setState({ error: `Failed to extract frames: ${err.message}`, extractingFrames: false });
    }
  };

  handleFrameAnnotation = (frameIndex, x, y) => {
    const { videoData, selectedFrames } = this.state;
    const frames = [...videoData.sample_frames];
    frames[frameIndex].annotation = {
      x: Math.round(x),
      y: Math.round(y),
      width: 50,
      height: 50
    };
    
    this.setState(prev => ({
      videoData: {
        ...prev.videoData,
        sample_frames: frames
      },
      selectedFrames: selectedFrames.includes(frameIndex) 
        ? selectedFrames 
        : [...selectedFrames, frameIndex]
    }));
  };

  handleConfirmFrames = () => {
    if (this.state.selectedFrames.length === 0) {
      this.setState({ error: 'Please annotate the player in at least one frame.' });
      return;
    }
    this.setState({ error: '', step: 5 });
  };

  handleCreateTask = async () => {
    try {
      this.setState({ uploading: true });
      
      const video = await videoService.create(this.state.videoData);
      
      await videoTaskService.create({
        video_id: video.id,
        task_type: 'video_processing',
        status: 'pending_processing',
        priority: 'medium'
      });

      this.props.navigate('/Pages/VideoEditor');
    } catch (err) {
      console.error('Error creating task:', err);
      this.setState({ error: `Failed to create task: ${err.message}`, uploading: false });
    }
  };

  formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  render() {
    const { step, uploading, uploadProgress, extractingFrames, selectedFrames, currentFrameIndex, videoData, error } = this.state;

    const steps = [
      { number: 1, title: 'Upload Video', icon: Upload },
      { number: 2, title: 'Match Info', icon: Users },
      { number: 3, title: 'Player Info', icon: User },
      { number: 4, title: 'Identify Player', icon: Target },
      { number: 5, title: 'Confirm', icon: CheckCircle2 }
    ];

    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, idx) => (
              <React.Fragment key={s.number}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all
                    ${step >= s.number 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-slate-200 text-slate-500'}
                  `}>
                    <s.icon className="w-5 h-5" />
                  </div>
                  <span className={`mt-2 text-sm font-medium ${step >= s.number ? 'text-slate-900' : 'text-slate-500'}`}>
                    {s.title}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className={`flex-1 h-1 mx-4 rounded-full ${step > s.number ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Upload Video */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Video className="w-5 h-5 text-emerald-500" />
                    Upload Match Video
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    onClick={() => this.fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
                      ${uploading ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50'}
                    `}
                  >
                    <input
                      ref={this.fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
                      onChange={this.handleFileSelect}
                      className="hidden"
                    />
                    
                    {uploading ? (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                          <Upload className="w-8 h-8 text-emerald-500 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-lg font-medium text-slate-900">Uploading...</p>
                          <p className="text-sm text-slate-500">{uploadProgress}%</p>
                        </div>
                        <Progress value={uploadProgress} className="w-64 mx-auto" />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center">
                          <Upload className="w-8 h-8 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-lg font-medium text-slate-900">Drop your video here</p>
                          <p className="text-sm text-slate-500">or click to browse</p>
                        </div>
                        <p className="text-xs text-slate-400">Supported formats: MP4, MOV, AVI, MKV</p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Match Info */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-500" />
                    Match Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Duration</p>
                      <p className="font-medium">{this.formatDuration(videoData.duration)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Resolution</p>
                      <p className="font-medium">{videoData.resolution}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Frame Rate</p>
                      <p className="font-medium">{videoData.frame_rate} fps</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">File Size</p>
                      <p className="font-medium">{this.formatFileSize(videoData.file_size)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Home Team *</Label>
                      <Input 
                        placeholder="e.g., FC Barcelona"
                        value={videoData.home_team}
                        onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, home_team: e.target.value }}))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Away Team *</Label>
                      <Input 
                        placeholder="e.g., Real Madrid"
                        value={videoData.away_team}
                        onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, away_team: e.target.value }}))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Competition</Label>
                      <Input 
                        placeholder="e.g., La Liga"
                        value={videoData.competition}
                        onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, competition: e.target.value }}))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Match Date
                      </Label>
                      <Input 
                        type="date"
                        value={videoData.match_date}
                        onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, match_date: e.target.value }}))}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Venue (optional)
                    </Label>
                    <Input 
                      placeholder="e.g., Camp Nou"
                      value={videoData.venue}
                      onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, venue: e.target.value }}))}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button onClick={this.handleMatchInfoSubmit} className="bg-emerald-600 hover:bg-emerald-700">
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Player Info */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-emerald-500" />
                    Player Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Player Name *</Label>
                      <Input 
                        placeholder="e.g., Lionel Messi"
                        value={videoData.player_name}
                        onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, player_name: e.target.value }}))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Shirt className="w-3 h-3" />
                        Jersey Number
                      </Label>
                      <Input 
                        type="number"
                        placeholder="e.g., 10"
                        value={videoData.jersey_number}
                        onChange={(e) => this.setState(prev => ({ videoData: { ...prev.videoData, jersey_number: parseInt(e.target.value) || '' }}))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Team *</Label>
                      <Select 
                        value={videoData.player_team}
                        onValueChange={(value) => this.setState(prev => ({ videoData: { ...prev.videoData, player_team: value }}))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={videoData.home_team}>{videoData.home_team || 'Home Team'}</SelectItem>
                          <SelectItem value={videoData.away_team}>{videoData.away_team || 'Away Team'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Position</Label>
                      <Select
                        value={videoData.player_position}
                        onValueChange={(value) => this.setState(prev => ({ videoData: { ...prev.videoData, player_position: value }}))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GK">Goalkeeper</SelectItem>
                          <SelectItem value="DEF">Defender</SelectItem>
                          <SelectItem value="MID">Midfielder</SelectItem>
                          <SelectItem value="FWD">Forward</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Did the player play the full match?</Label>
                        <p className="text-sm text-slate-500">100% of match minutes</p>
                      </div>
                      <Switch
                        checked={videoData.played_full_match}
                        onCheckedChange={(checked) => this.setState(prev => ({ 
                          videoData: { 
                            ...prev.videoData, 
                            played_full_match: checked,
                            minutes_played: checked ? 90 : prev.videoData.minutes_played
                          }
                        }))}
                      />
                    </div>

                    {!videoData.played_full_match && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <Label className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Approximate Minutes Played
                        </Label>
                        <Select
                          value={videoData.minutes_played?.toString()}
                          onValueChange={(value) => this.setState(prev => ({ videoData: { ...prev.videoData, minutes_played: parseInt(value) }}))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select minutes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15">0-15 minutes</SelectItem>
                            <SelectItem value="30">15-30 minutes</SelectItem>
                            <SelectItem value="45">30-45 minutes</SelectItem>
                            <SelectItem value="60">45-60 minutes</SelectItem>
                            <SelectItem value="75">60-75 minutes</SelectItem>
                            <SelectItem value="85">75-90 minutes</SelectItem>
                          </SelectContent>
                        </Select>
                      </motion.div>
                    )}
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => this.setState({ step: 2 })}>
                      Back
                    </Button>
                    <Button onClick={this.handlePlayerInfoSubmit} className="bg-emerald-600 hover:bg-emerald-700">
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Frame Extraction */}
          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-500" />
                    Identify Player in Sample Frames
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-2">
                    We've extracted 10 frames from the video. Click on the player in each frame to identify them.
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {extractingFrames ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                            <ImageIcon className="w-8 h-8 text-emerald-500 animate-pulse" />
                          </div>
                          <p className="text-lg font-medium text-slate-900">Extracting Frames...</p>
                          <p className="text-sm text-slate-500 mt-1">
                            {videoData.sample_frames?.length || 0} / 10 frames extracted
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-slate-900">Frame {currentFrameIndex + 1} of 10</h3>
                            <p className="text-sm text-slate-500">
                              {videoData.sample_frames?.[currentFrameIndex]?.annotation 
                                ? '✓ Player identified' 
                                : 'Click on the player to identify them'}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {Array(10).fill(0).map((_, i) => (
                              <button
                                key={i}
                                onClick={() => this.setState({ currentFrameIndex: i })}
                                className={`w-3 h-3 rounded-full transition-all ${
                                  i === currentFrameIndex 
                                    ? 'bg-emerald-500 w-8' 
                                    : selectedFrames.includes(i) 
                                      ? 'bg-emerald-500' 
                                      : 'bg-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>

                        <div
                          className={`relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden cursor-crosshair border-4 transition-all ${
                            videoData.sample_frames?.[currentFrameIndex]?.annotation 
                              ? 'border-emerald-500' 
                              : 'border-slate-300 hover:border-emerald-400'
                          }`}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            const y = ((e.clientY - rect.top) / rect.height) * 100;
                            this.handleFrameAnnotation(currentFrameIndex, x, y);
                          }}
                        >
                          {videoData.sample_frames?.[currentFrameIndex] && (
                            <>
                              <img 
                                src={videoData.sample_frames[currentFrameIndex].frame_url} 
                                alt={`Frame ${currentFrameIndex + 1}`}
                                className="absolute inset-0 w-full h-full object-contain"
                              />
                              
                              <div className="absolute top-4 left-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-lg font-mono">
                                {this.formatTime(videoData.sample_frames[currentFrameIndex].timestamp)}
                              </div>
                              
                              <div className="absolute top-4 right-4 bg-black/70 text-white text-sm px-3 py-1.5 rounded-lg font-semibold">
                                {currentFrameIndex + 1} / 10
                              </div>
                              
                              {videoData.sample_frames[currentFrameIndex].annotation && (
                                <div
                                  className="absolute w-20 h-20 border-4 border-emerald-500 bg-emerald-500/20 rounded-xl transform -translate-x-1/2 -translate-y-1/2 shadow-lg"
                                  style={{
                                    left: `${videoData.sample_frames[currentFrameIndex].annotation.x}%`,
                                    top: `${videoData.sample_frames[currentFrameIndex].annotation.y}%`
                                  }}
                                >
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-500 text-white text-sm px-3 py-1 rounded-lg font-medium shadow-lg">
                                    {videoData.player_name}
                                  </div>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-500 bg-white rounded-full" />
                                  </div>
                                </div>
                              )}
                              
                              {!videoData.sample_frames[currentFrameIndex].annotation && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <div className="text-white/50 text-center">
                                    <Target className="w-12 h-12 mx-auto mb-2" />
                                    <p className="text-sm">Click on {videoData.player_name}</p>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <Button
                            variant="outline"
                            onClick={() => this.setState({ currentFrameIndex: Math.max(0, currentFrameIndex - 1) })}
                            disabled={currentFrameIndex === 0}
                            className="gap-2"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            Previous
                          </Button>
                          
                          <div className="text-center">
                            <p className="text-sm font-medium text-slate-900">
                              {selectedFrames.length} / 10 frames annotated
                            </p>
                            <p className="text-xs text-slate-500">
                              {selectedFrames.length === 0 && 'Annotate at least 1 frame'}
                              {selectedFrames.length > 0 && selectedFrames.length < 10 && 'Annotate more for better accuracy'}
                              {selectedFrames.length === 10 && '✓ All frames completed'}
                            </p>
                          </div>

                          {currentFrameIndex < 9 ? (
                            <Button
                              onClick={() => this.setState({ currentFrameIndex: currentFrameIndex + 1 })}
                              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                            >
                              Next
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              onClick={this.handleConfirmFrames}
                              disabled={selectedFrames.length === 0}
                              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                            >
                              Done
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </div>
                      )}

                      <div className="flex justify-between">
                        <Button variant="outline" onClick={() => this.setState({ step: 3 })}>
                          Back
                        </Button>
                        <Button 
                          onClick={this.handleConfirmFrames}
                          disabled={selectedFrames.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Continue
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    Review & Create Task
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">Video Summary</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Title</p>
                          <p className="font-medium truncate">{videoData.title}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Match</p>
                          <p className="font-medium text-sm">{videoData.home_team} vs {videoData.away_team}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Player</p>
                          <p className="font-medium text-sm">{videoData.player_name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Team</p>
                          <p className="font-medium">{videoData.player_team}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Position</p>
                          <p className="font-medium">{videoData.player_position}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Annotated Frames</p>
                          <p className="font-medium">{selectedFrames.length}/10</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => this.setState({ step: 4 })}>
                      Back
                    </Button>
                    <Button 
                      onClick={this.handleCreateTask} 
                      disabled={uploading}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {uploading ? 'Creating Task...' : 'Create Processing Task'}
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
}

export default UploadVideoWrapper;
