import React from 'react';
import { Badge } from "../../Components/ui/badge";
import { Button } from "../../Components/ui/button";
import { Clock, User, Flag, Trash2, Play } from 'lucide-react';

export default function TimelineThumbnail({ tag, videoUrl, matchStartTime, onClick, onDelete, status = 'system' }) {

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const statusConfig = {
    system: { color: 'border-slate-300 bg-slate-50', label: '' },
    confirmed: { color: 'border-emerald-500 bg-emerald-50', label: 'Confirmed' },
    reviewed: { color: 'border-blue-500 bg-blue-50', label: 'Reviewed' }
  };

  const config = statusConfig[status] || statusConfig.system;

  const tagTypeIcons = {
    involved_start: <Flag className="w-3 h-3 text-emerald-600" />,
    involved_end: <Flag className="w-3 h-3 text-red-600" />,
    player_visible: <User className="w-3 h-3 text-blue-600" />,
    player_out_of_frame: <User className="w-3 h-3 text-slate-400" />,
  };

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-lg ${config.color}`}
    >
      {/* Delete button */}
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-1 right-1 h-6 w-6 bg-red-500/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(tag.id);
        }}
      >
        <Trash2 className="w-3 h-3" />
      </Button>

      <div onClick={onClick}>
      {/* Thumbnail */}
      <div className="w-40 h-24 bg-gradient-to-br from-slate-800 to-slate-900 relative flex items-center justify-center">
        <Play className="w-8 h-8 text-slate-400" />
        
        {/* Overlay info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-white text-xs font-medium truncate">
              {tag.tag_type.replace(/_/g, ' ')}
            </p>
            {tag.note && (
              <p className="text-white/80 text-xs truncate mt-0.5">{tag.note}</p>
            )}
          </div>
        </div>
      </div>

      {/* Time badge */}
      <div className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-mono">
        {formatTime(tag.timestamp)}
      </div>

      {/* Tag type icon */}
      {tagTypeIcons[tag.tag_type] && (
        <div className="absolute top-2 right-2 bg-white/90 p-1 rounded shadow">
          {tagTypeIcons[tag.tag_type]}
        </div>
      )}

      {/* Status label */}
      {config.label && (
        <div className="absolute bottom-2 right-2">
          <Badge variant="outline" className="text-xs bg-white/90">
            {config.label}
          </Badge>
        </div>
      )}

      {/* Zone badge */}
      {tag.zone && (
        <div className="absolute bottom-2 left-2">
          <Badge variant="outline" className="text-xs bg-white/90 capitalize">
            {tag.zone}
          </Badge>
        </div>
      )}
    </div>
    </div>
  );
}