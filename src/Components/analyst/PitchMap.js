import React from 'react';

export default function PitchMap({ onSelect, selectedX, selectedY, showEnd, endX, endY, onEndSelect }) {
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (showEnd && selectedX !== undefined) {
      onEndSelect?.(Math.round(x), Math.round(y));
    } else {
      onSelect(Math.round(x), Math.round(y));
    }
  };

  return (
    <div 
      className="relative w-full aspect-[1.5] bg-emerald-600 rounded-lg cursor-crosshair overflow-hidden"
      onClick={handleClick}
    >
      {/* Field markings */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 150 100" preserveAspectRatio="none">
        {/* Outline */}
        <rect x="2" y="2" width="146" height="96" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        
        {/* Center line */}
        <line x1="75" y1="2" x2="75" y2="98" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        
        {/* Center circle */}
        <circle cx="75" cy="50" r="12" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        <circle cx="75" cy="50" r="0.5" fill="white" opacity="0.8"/>
        
        {/* Left penalty area */}
        <rect x="2" y="22" width="18" height="56" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        <rect x="2" y="35" width="6" height="30" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        
        {/* Right penalty area */}
        <rect x="130" y="22" width="18" height="56" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        <rect x="142" y="35" width="6" height="30" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        
        {/* Left arc */}
        <path d="M 20 40 A 12 12 0 0 1 20 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        
        {/* Right arc */}
        <path d="M 130 40 A 12 12 0 0 0 130 60" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        
        {/* Corner arcs */}
        <path d="M 2 5 A 3 3 0 0 0 5 2" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        <path d="M 145 2 A 3 3 0 0 0 148 5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        <path d="M 2 95 A 3 3 0 0 1 5 98" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
        <path d="M 145 98 A 3 3 0 0 1 148 95" fill="none" stroke="white" strokeWidth="0.5" opacity="0.8"/>
      </svg>

      {/* Zone labels */}
      <div className="absolute inset-0 flex text-white/40 text-xs font-medium pointer-events-none">
        <div className="flex-1 flex items-center justify-center">DEF</div>
        <div className="flex-1 flex items-center justify-center">MID</div>
        <div className="flex-1 flex items-center justify-center">ATT</div>
      </div>

      {/* Selected point */}
      {selectedX !== undefined && selectedY !== undefined && (
        <div 
          className="absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10"
          style={{ left: `${selectedX}%`, top: `${selectedY}%` }}
        />
      )}

      {/* End point for passes/dribbles */}
      {showEnd && endX !== undefined && endY !== undefined && (
        <>
          <div 
            className="absolute w-4 h-4 bg-red-500 border-2 border-white rounded-full transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-10"
            style={{ left: `${endX}%`, top: `${endY}%` }}
          />
          {/* Line connecting start and end */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-5">
            <line 
              x1={`${selectedX}%`} 
              y1={`${selectedY}%`} 
              x2={`${endX}%`} 
              y2={`${endY}%`} 
              stroke="white" 
              strokeWidth="2" 
              strokeDasharray="4"
            />
          </svg>
        </>
      )}

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 text-white/60 text-xs">
        {showEnd ? 'Click to set end position' : 'Click to set position'}
      </div>
    </div>
  );
}