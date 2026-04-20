import React, { Component } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

class VideoPlayerWithTrimming extends Component {
  constructor(props) {
    super(props);
    
    this.videoRef = React.createRef();
    
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false,
      videoDimensions: { width: 0, height: 0 },
      videoError: null,
      videoLoaded: false
    };
  }

  componentDidMount() {
    const video = this.videoRef.current;
    if (video) {
      video.addEventListener('play', this.handlePlay);
      video.addEventListener('pause', this.handlePause);
      video.addEventListener('timeupdate', this.handleTimeUpdate);
      video.addEventListener('loadedmetadata', this.handleLoadedMetadata);
      video.addEventListener('ended', this.handleEnded);
      video.addEventListener('error', this.handleVideoError);
      video.addEventListener('canplay', this.handleCanPlay);
    }
  }

  componentWillUnmount() {
    const video = this.videoRef.current;
    if (video) {
      video.removeEventListener('play', this.handlePlay);
      video.removeEventListener('pause', this.handlePause);
      video.removeEventListener('timeupdate', this.handleTimeUpdate);
      video.removeEventListener('loadedmetadata', this.handleLoadedMetadata);
      video.removeEventListener('ended', this.handleEnded);
      video.removeEventListener('error', this.handleVideoError);
      video.removeEventListener('canplay', this.handleCanPlay);
    }
  }

  handlePlay = () => {
    this.setState({ isPlaying: true });
  };

  handlePause = () => {
    this.setState({ isPlaying: false });
  };

  handleTimeUpdate = () => {
    const video = this.videoRef.current;
    if (video) {
      this.setState({ currentTime: video.currentTime });
    }
  };

  handleLoadedMetadata = () => {
    const video = this.videoRef.current;
    if (video) {
      this.setState({ 
        duration: video.duration,
        videoDimensions: { width: video.videoWidth, height: video.videoHeight }
      });
      if (this.props.onDurationLoaded) {
        this.props.onDurationLoaded(video.duration);
      }
    }
  };

  handleEnded = () => {
    this.setState({ isPlaying: false });
  };

  handleCanPlay = () => {
    this.setState({ videoLoaded: true });
  };

  handleVideoError = (e) => {
    const video = this.videoRef.current;
    if (video) {
      let errorMessage = 'Failed to load video';
      switch (video.error.code) {
        case video.error.MEDIA_ERR_ABORTED:
          errorMessage = 'Video loading was aborted';
          break;
        case video.error.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading video';
          break;
        case video.error.MEDIA_ERR_DECODE:
          errorMessage = 'Video decode error - unsupported format?';
          break;
        case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported';
          break;
        default:
          errorMessage = 'Unknown video error';
      }
      console.error('Video Error:', errorMessage, video.error);
      this.setState({ videoError: errorMessage });
    }
  };

  togglePlayPause = () => {
    const video = this.videoRef.current;
    if (video) {
      if (this.state.isPlaying) {
        video.pause();
      } else {
        video.play();
      }
    }
  };

  toggleMute = () => {
    this.setState(prev => ({ isMuted: !prev.isMuted }));
    const video = this.videoRef.current;
    if (video) {
      video.muted = !this.state.isMuted;
    }
  };

  handleSeek = (value) => {
    const video = this.videoRef.current;
    if (video) {
      video.currentTime = value[0];
      this.setState({ currentTime: value[0] });
    }
  };

  handleVolumeChange = (value) => {
    const video = this.videoRef.current;
    if (video) {
      video.volume = value[0];
      this.setState({ volume: value[0] });
    }
  };

  setMatchStartTime = () => {
    if (this.props.onSetMatchStart) {
      this.props.onSetMatchStart(this.state.currentTime);
    }
  };

  formatTime = (seconds) => {
    if (isNaN(seconds)) return '00:00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  render() {
    const { videoUrl, matchStartTime } = this.props;
    const { isPlaying, currentTime, duration, volume, isMuted, videoError, videoLoaded } = this.state;

    return (
      <div className="w-full bg-slate-900 rounded-xl overflow-hidden shadow-lg">
        {/* Video Container */}
        <div className="relative w-full bg-black aspect-video flex items-center justify-center">
          {videoUrl ? (
            <>
              <video
                ref={this.videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
              />

              {videoError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl">
                  <div className="bg-red-900/80 border border-red-600 rounded-lg p-4 max-w-xs">
                    <p className="text-red-100 text-sm font-medium mb-2">Video Error:</p>
                    <p className="text-red-200 text-sm">{videoError}</p>
                    <p className="text-red-300 text-xs mt-2">URL: {videoUrl}</p>
                  </div>
                </div>
              )}

              {/* Match Start Time Indicator */}
              {matchStartTime !== undefined && matchStartTime > 0 && (
                <div className="absolute top-4 left-4 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
                  Match Starts: {this.formatTime(matchStartTime)}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-slate-400">
                <div className="text-sm">No video selected</div>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-slate-800 p-4 space-y-3">
          {/* Timeline Scrubber */}
          {duration > 0 && (
            <div className="space-y-1">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration}
                step={0.1}
                onValueChange={this.handleSeek}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>{this.formatTime(currentTime)}</span>
                <span>{this.formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex items-center justify-between gap-4">
            {/* Play/Pause & Volume Controls */}
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={this.togglePlayPause}
                disabled={!videoUrl}
                className="hover:bg-emerald-600 hover:text-white hover:border-emerald-600"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={this.toggleMute}
                disabled={!videoUrl}
                className="hover:bg-slate-700 hover:border-slate-600"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </Button>

              {/* Volume Slider */}
              <div className="w-24">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={this.handleVolumeChange}
                  disabled={!videoUrl}
                />
              </div>

              <span className="text-sm text-slate-400 font-mono min-w-20">
                {this.formatTime(currentTime)}
              </span>
            </div>

            {/* Match Start Time Setter */}
            <Button
              size="sm"
              onClick={this.setMatchStartTime}
              disabled={!videoUrl || duration === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Set Match Start
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default VideoPlayerWithTrimming;
