import React from 'react';

export default function GoalMap({ onSelect, selectedX, selectedY }) {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onSelect(Math.round(x), Math.round(y));
  };

  return (
    <div 
      className="relative w-full aspect-[3] bg-slate-200 rounded-lg cursor-crosshair overflow-hidden border-4 border-slate-400"
      onClick={handleClick}
    >
      {/* Goal frame */}
      <div className="absolute inset-0">
        {/* Net pattern */}
        <svg className="w-full h-full" viewBox="0 0 100 33" preserveAspectRatio="none">
          {/* Vertical lines */}
          {[...Array(20)].map((_, i) => (
            <line 
              key={`v${i}`}
              x1={5 * (i + 1)} 
              y1="0" 
              x2={5 * (i + 1)} 
              y2="33" 
              stroke="#cbd5e1" 
              strokeWidth="0.5"
            />
          ))}
          {/* Horizontal lines */}
          {[...Array(6)].map((_, i) => (
            <line 
              key={`h${i}`}
              x1="0" 
              y1={5 * (i + 1)} 
              x2="100" 
              y2={5 * (i + 1)} 
              stroke="#cbd5e1" 
              strokeWidth="0.5"
            />
          ))}
        </svg>
      </div>

      {/* Zone indicators */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px">
        <div className="bg-slate-300/20 hover:bg-blue-500/20 transition-colors" />
        <div className="bg-slate-300/20 hover:bg-blue-500/20 transition-colors" />
        <div className="bg-slate-300/20 hover:bg-blue-500/20 transition-colors" />
        <div className="bg-slate-300/20 hover:bg-blue-500/20 transition-colors" />
        <div className="bg-slate-300/20 hover:bg-blue-500/20 transition-colors" />
        <div className="bg-slate-300/20 hover:bg-blue-500/20 transition-colors" />
      </div>

      {/* Selected point */}
      {selectedX !== undefined && selectedY !== undefined && (
        <div 
          className="absolute w-5 h-5 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10"
          style={{ left: `${selectedX}%`, top: `${selectedY}%` }}
        />
      )}

      {/* Corner labels */}
      <div className="absolute top-1 left-1 text-xs text-slate-400">Top Left</div>
      <div className="absolute top-1 right-1 text-xs text-slate-400">Top Right</div>
      <div className="absolute bottom-1 left-1 text-xs text-slate-400">Bottom Left</div>
      <div className="absolute bottom-1 right-1 text-xs text-slate-400">Bottom Right</div>
    </div>
  );
}