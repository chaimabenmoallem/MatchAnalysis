import React, { useState } from 'react';
import { Button } from "../../Components/ui/button";
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function PlayerIdentificationGallery({ frames, playerName, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageRect, setImageRect] = useState(null);
  const imageRef = React.useRef(null);
  const containerRef = React.useRef(null);

  const handleNext = () => {
    if (currentIndex < frames.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
    if (e.key === 'Escape') onClose();
  };

  const calculateImageRect = () => {
    if (!imageRef.current || !containerRef.current) return;
    
    const img = imageRef.current;
    const container = containerRef.current;
    
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const imageAspectRatio = img.naturalWidth / img.naturalHeight;
    const containerAspectRatio = containerWidth / containerHeight;
    
    let displayedWidth, displayedHeight, offsetX, offsetY;
    
    if (imageAspectRatio > containerAspectRatio) {
      // Image is wider - fit to width
      displayedWidth = containerWidth;
      displayedHeight = containerWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (containerHeight - displayedHeight) / 2;
    } else {
      // Image is taller - fit to height
      displayedHeight = containerHeight;
      displayedWidth = containerHeight * imageAspectRatio;
      offsetX = (containerWidth - displayedWidth) / 2;
      offsetY = 0;
    }
    
    setImageRect({
      width: displayedWidth,
      height: displayedHeight,
      left: offsetX,
      top: offsetY
    });
  };

  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  React.useEffect(() => {
    calculateImageRect();
    window.addEventListener('resize', calculateImageRect);
    return () => window.removeEventListener('resize', calculateImageRect);
  }, [currentIndex]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentFrame = frames[currentIndex];
  const annotation = currentFrame?.annotation;
  
  let annotationData = null;
  try {
    if (annotation) {
      if (typeof annotation === 'string') {
        try {
          annotationData = JSON.parse(annotation);
          if (typeof annotationData === 'string') {
            annotationData = JSON.parse(annotationData);
          }
        } catch (e) {
          // If it's not JSON, maybe it's the raw value or something else
        }
      } else {
        annotationData = annotation;
      }
    }
    
    // Fallback: If no annotation object, check if there are coordinate fields directly on the frame
    if (!annotationData && currentFrame?.x !== undefined && currentFrame?.y !== undefined) {
      annotationData = {
        x: currentFrame.x,
        y: currentFrame.y,
        width: currentFrame.width || 10,
        height: currentFrame.height || 10
      };
    }
  } catch (e) {
    console.error('Error parsing annotation:', e, annotation);
  }

  // Force a re-render/re-calculate when annotationData changes
  React.useEffect(() => {
    if (annotationData) {
      calculateImageRect();
    }
  }, [currentIndex, !!annotationData]);

  return (
    <div className="fixed inset-0 z-[100] bg-black" onClick={onClose}>
      <div className="absolute inset-0 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Navigation buttons */}
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="absolute left-4 z-10 w-16 h-16 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}

        {currentIndex < frames.length - 1 && (
          <button
            onClick={handleNext}
            className="absolute right-4 z-10 w-16 h-16 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}

        {/* Main image */}
        <div ref={containerRef} className="relative w-full h-full flex items-center justify-center p-4">
          <img
            ref={imageRef}
            src={currentFrame?.frame_url || currentFrame?.url}
            alt={`Frame ${currentIndex + 1}`}
            className="w-full h-full object-contain"
            onLoad={calculateImageRect}
          />

          {/* Annotation marker */}
          {annotationData && imageRect && (
            <div
              className="absolute border-2 border-emerald-500 bg-emerald-500/10 rounded-lg transform -translate-x-1/2 -translate-y-1/2 shadow-lg z-20 pointer-events-none"
              style={{
                left: `${imageRect.left + (imageRect.width * (annotationData.x || 0) / 100)}px`,
                top: `${imageRect.top + (imageRect.height * (annotationData.y || 0) / 100)}px`,
                width: `${(imageRect.width * (annotationData.width || 10) / 100)}px`,
                height: `${(imageRect.height * (annotationData.height || 10) / 100)}px`,
                minWidth: '30px',
                minHeight: '30px'
              }}
            >
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap bg-emerald-500 text-white px-2 py-0.5 rounded font-medium shadow-md text-[10px] z-30">
                {playerName || 'Player'}
              </div>
            </div>
          )}

          {/* Info overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/70 text-white px-6 py-3 rounded-lg">
            <span className="font-mono text-lg">{formatTime(currentFrame?.timestamp || 0)}</span>
            <span className="text-slate-400">|</span>
            <span className="text-lg">Frame {currentIndex + 1} / {frames.length}</span>
            {annotationData && (
              <>
                <span className="text-slate-400">|</span>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Identified</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Thumbnail strip */}
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80vw] overflow-x-auto px-4 py-2 bg-black/50 rounded-lg">
          {frames.map((frame, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative flex-shrink-0 w-20 h-12 rounded overflow-hidden border-2 transition-all ${
                idx === currentIndex 
                  ? 'border-emerald-500 ring-2 ring-emerald-500' 
                  : frame.annotation 
                    ? 'border-emerald-400/50' 
                    : 'border-white/20 hover:border-white/40'
              }`}
            >
              <img
                src={frame?.frame_url || frame?.url}
                alt={`Thumbnail ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              {(frame?.annotation || 
                (typeof frame?.annotation === 'string' && frame.annotation !== 'null' && frame.annotation !== '') ||
                (frame?.x !== undefined && frame?.y !== undefined)) && (
                <div className="absolute top-0.5 right-0.5 bg-emerald-500 rounded-full p-0.5">
                  <CheckCircle2 className="w-2 h-2 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}