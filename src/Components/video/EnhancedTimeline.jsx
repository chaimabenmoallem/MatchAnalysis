import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../../Components/ui/card";
import { Button } from "../../Components/ui/button";
import { Input } from "../../Components/ui/input";
import { Badge } from "../../Components/ui/badge";
import { 
  Film, 
  GripVertical, 
  Pencil, 
  Trash2, 
  Plus,
  ChevronDown,
  ChevronRight,
  Play
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from "../../Components/ui/popover";

export default function EnhancedTimeline({ 
  segments = [], 
  duration, 
  currentTime, 
  onSeek, 
  onUpdateSegment,
  onDeleteSegment,
  onEditSegment,
  onPlaySegment,
  matchStartTime = 0
}) {
  const [expandedRows, setExpandedRows] = useState(new Set(['segments']));
  const [editingSegment, setEditingSegment] = useState(null);
  const [dragState, setDragState] = useState(null);
  const timelineRef = useRef(null);

  // Dynamically determine time interval based on duration
  const getTimeInterval = () => {
    if (duration < 300) return 30; // < 5 min: every 30 seconds
    if (duration < 1800) return 120; // < 30 min: every 2 minutes
    if (duration < 3600) return 300; // < 60 min: every 5 minutes
    return 300; // >= 60 min: every 5 minutes
  };

  const timeInterval = getTimeInterval();

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const timeToPixels = (time) => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.offsetWidth - 120;
    return (time / duration) * width;
  };

  const pixelsToTime = (pixels) => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.offsetWidth - 120;
    return (pixels / width) * duration;
  };

  const handleMouseDown = (e, segment, edge) => {
    e.stopPropagation();
    setDragState({ segment, edge, startX: e.clientX });
    document.body.style.cursor = 'ew-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = pixelsToTime(Math.abs(deltaX)) * (deltaX > 0 ? 1 : -1);

      if (dragState.edge === 'start') {
        const newStart = Math.max(0, dragState.segment.start_time + deltaTime);
        if (newStart < dragState.segment.end_time - 1) {
          onUpdateSegment(dragState.segment.id, { start_time: newStart });
        }
      } else if (dragState.edge === 'end') {
        const newEnd = Math.min(duration, dragState.segment.end_time + deltaTime);
        if (newEnd > dragState.segment.start_time + 1) {
          onUpdateSegment(dragState.segment.id, { end_time: newEnd });
        }
      } else {
        // Moving entire segment
        const newStart = Math.max(0, dragState.segment.start_time + deltaTime);
        const segmentLength = dragState.segment.end_time - dragState.segment.start_time;
        const newEnd = Math.min(duration, newStart + segmentLength);
        if (newEnd <= duration) {
          onUpdateSegment(dragState.segment.id, { 
            start_time: newStart, 
            end_time: newEnd 
          });
        }
      }
    };

    const handleMouseUp = () => {
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
  }, [dragState, duration, onUpdateSegment]);

  const toggleRow = (rowId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId);
    } else {
      newExpanded.add(rowId);
    }
    setExpandedRows(newExpanded);
  };

  const zoneColors = {
    defending: { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-500' },
    midfield: { bg: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-500' },
    attacking: { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-500' },
    transition: { bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-500' }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-slate-500 flex items-center gap-2">
          <Film className="w-4 h-4" />
          Player Segments
        </h3>
      </div>
      <div className="bg-white p-3 rounded-lg">
        <div ref={timelineRef} className="space-y-1 bg-white">
          {/* Time ruler */}
          <div className="flex items-center border-b border-slate-200 pb-2">
            <div className="w-28 text-xs font-medium text-slate-500">Timeline</div>
            <div className="flex-1 relative h-6">
              {/* Time markers */}
              {Array.from({ length: Math.ceil(duration / timeInterval) + 1 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0"
                  style={{ left: `${timeToPixels(i * timeInterval)}px` }}
                >
                  <div className="w-px h-4 bg-slate-300"></div>
                  <div className="text-xs text-slate-400 -ml-4 mt-1">{formatTime(i * timeInterval)}</div>
                </div>
              ))}
              {/* Current time indicator */}
              <div
                className="absolute top-0 w-0.5 h-full bg-red-500 z-10"
                style={{ left: `${timeToPixels(currentTime)}px` }}
              >
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Segments Header */}
          <div className="border-b border-slate-100">
            <div className="flex items-center py-1 hover:bg-slate-50">
              <button
                onClick={() => toggleRow('segments')}
                className="w-28 flex items-center gap-1 text-sm font-medium text-slate-700 px-2"
              >
                {expandedRows.has('segments') ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                Player Segments
                <Badge variant="outline" className="ml-auto">{segments.length}</Badge>
              </button>
            </div>
          </div>

          {/* Individual Segment Rows */}
          {expandedRows.has('segments') && segments.map((seg, idx) => {
            const color = zoneColors[seg.zone] || zoneColors.defending;
            const left = timeToPixels(seg.start_time);
            const width = timeToPixels(seg.end_time - seg.start_time);

            return (
              <div key={seg.id} className="border-b border-slate-100">
                <div className="flex items-center py-1 hover:bg-slate-50">
                  <div className="w-28 text-xs font-medium text-slate-600 px-2 truncate">
                    Segment {idx + 1}
                  </div>
                  <div className="flex-1 relative h-12 cursor-pointer" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const time = pixelsToTime(x);
                    onSeek(time);
                  }}>
                    <div
                      className={`absolute h-10 ${color.bg} ${color.border} border-2 rounded-lg shadow-sm hover:shadow-md transition-all group cursor-move`}
                      style={{ 
                        left: `${left}px`, 
                        width: `${width}px`,
                        zIndex: dragState?.segment?.id === seg.id ? 50 : 10
                      }}
                      onDoubleClick={() => onSeek(seg.start_time)}
                      onMouseDown={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        if (x < 10) {
                          handleMouseDown(e, seg, 'start');
                        } else if (x > rect.width - 10) {
                          handleMouseDown(e, seg, 'end');
                        } else {
                          handleMouseDown(e, seg, 'move');
                        }
                      }}
                    >
                      {/* Resize handles */}
                      <div className="absolute left-0 top-0 w-2 h-full bg-white/30 cursor-ew-resize"></div>
                      <div className="absolute right-0 top-0 w-2 h-full bg-white/30 cursor-ew-resize"></div>

                      {/* Segment label */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-white font-medium px-2 truncate">
                          {formatTime(seg.start_time)} - {formatTime(seg.end_time)}
                        </span>
                      </div>

                      {/* Hover controls */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1 bg-white rounded-lg shadow-lg p-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-emerald-500 hover:text-emerald-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onPlaySegment) {
                                onPlaySegment(seg);
                              }
                            }}
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6">
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64">
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs font-medium">Start Time</label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={seg.start_time.toFixed(1)}
                                    onChange={(e) => onUpdateSegment(seg.id, { start_time: parseFloat(e.target.value) })}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium">End Time</label>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={seg.end_time.toFixed(1)}
                                    onChange={(e) => onUpdateSegment(seg.id, { end_time: parseFloat(e.target.value) })}
                                    className="h-7 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium">Notes</label>
                                  <Input
                                    value={seg.notes || ''}
                                    onChange={(e) => onUpdateSegment(seg.id, { notes: e.target.value })}
                                    placeholder="Add notes..."
                                    className="h-7 text-xs"
                                  />
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSegment(seg.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onEditSegment) {
                                onEditSegment(seg);
                              }
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Legend */}
          <div className="mt-2 pt-2 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Zone Colors</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(zoneColors).map(([key, color]) => (
                <div key={key} className="flex items-center gap-1">
                  <div className={`w-3 h-3 ${color.bg} rounded`}></div>
                  <span className="text-xs text-slate-600 capitalize">{key}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}