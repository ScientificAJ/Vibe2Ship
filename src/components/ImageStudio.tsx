import React, { useEffect, useRef, useState } from 'react';

import '../polyfill';

import { 
  X, 
  Paintbrush, 
  Crop, 
  RotateCcw, 
  Check, 
  Trash2, 
  Sparkles,
  Undo,
  Maximize2
} from 'lucide-react';

interface ImageStudioProps {
  imageSrc: string; // original base64
  onSave: (finalBase64: string) => void;
  onClose: () => void;
}

interface CropRegion {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  w: number; // percentage (0-100)
  h: number; // percentage (0-100)
}

export default function ImageStudio({ imageSrc, onSave, onClose }: ImageStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // History state for premium Undo feature
  const [history, setHistory] = useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<string>(imageSrc);
  
  // Studio configurations
  const [activeTool, setActiveTool] = useState<'draw' | 'crop'>('draw');
  const [brushColor, setBrushColor] = useState<string>('#ef4444'); // default red
  const [brushSize, setBrushSize] = useState<number>(6);
  
  // Crop coordinate states (percentages)
  const [crop, setCrop] = useState<CropRegion>({ x: 10, y: 10, w: 80, h: 80 });
  const [isDraggingCrop, setIsDraggingCrop] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, cropStart: { x: 10, y: 10, w: 80, h: 80 } });

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Load and draw image on canvas
  const loadImageToCanvas = (srcString: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = srcString;
    img.onload = () => {
      // Scale canvas to fit image while keeping its intrinsic aspect ratio
      // Limit maximum rendering resolution to prevent performance lag
      const maxW = 900;
      const maxH = 700;
      let targetW = img.width;
      let targetH = img.height;

      if (targetW > maxW) {
        targetH = (maxW / targetW) * targetH;
        targetW = maxW;
      }
      if (targetH > maxH) {
        targetW = (maxH / targetH) * targetW;
        targetH = maxH;
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.drawImage(img, 0, 0, targetW, targetH);
    };
  };

  // Re-draw canvas whenever the current working image changes
  useEffect(() => {
    loadImageToCanvas(currentImage);
  }, [currentImage]);

  // Handle Undo action
  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setCurrentImage(prev);
  };

  // Save current state to history before modifications
  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setHistory([...history, currentImage]);
    setCurrentImage(dataUrl);
  };

  // Drawing mouse/touch controls
  const getCoordinates = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return null;
    const rect = canvas.getBoundingClientRect();
    
    // Scale factor between canvas scale and its CSS bounding client rect
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (activeTool !== 'draw') return;
    const coords = getCoordinates(e);
    if (!coords) return;

    // Save history point before drawing stroke
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory([...history, currentImage]);
    }

    setIsDrawing(true);
    setLastPos(coords);

    // Single click dot support
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.fillStyle = brushColor;
      ctx.arc(coords.x, coords.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || activeTool !== 'draw') return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Prevent default scrolling on mobile touch
    if (e.cancelable) {
      e.preventDefault();
    }

    ctx.beginPath();
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    setLastPos(coords);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    // Update current working image base64
    const canvas = canvasRef.current;
    if (canvas) {
      setCurrentImage(canvas.toDataURL('image/jpeg', 0.9));
    }
  };

  // Crop controls
  const handleCropDragStart = (handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingCrop(handle);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      cropStart: { ...crop }
    });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop || !containerRef.current || typeof containerRef.current.getBoundingClientRect !== 'function') return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStart.x) / (containerRect.width || 1)) * 100;
    const dy = ((e.clientY - dragStart.y) / (containerRect.height || 1)) * 100;
    
    setCrop((prev) => {
      const updated = { ...prev };
      const start = dragStart.cropStart;

      if (isDraggingCrop === 'move') {
        updated.x = Math.max(0, Math.min(100 - prev.w, start.x + dx));
        updated.y = Math.max(0, Math.min(100 - prev.h, start.y + dy));
      } else if (isDraggingCrop === 'nw') {
        const newX = Math.max(0, Math.min(start.x + start.w - 10, start.x + dx));
        const newY = Math.max(0, Math.min(start.y + start.h - 10, start.y + dy));
        updated.w = start.w + (start.x - newX);
        updated.h = start.h + (start.y - newY);
        updated.x = newX;
        updated.y = newY;
      } else if (isDraggingCrop === 'ne') {
        const newW = Math.max(10, Math.min(100 - start.x, start.w + dx));
        const newY = Math.max(0, Math.min(start.y + start.h - 10, start.y + dy));
        updated.h = start.h + (start.y - newY);
        updated.y = newY;
        updated.w = newW;
      } else if (isDraggingCrop === 'se') {
        updated.w = Math.max(10, Math.min(100 - start.x, start.w + dx));
        updated.h = Math.max(10, Math.min(100 - start.y, start.h + dy));
      } else if (isDraggingCrop === 'sw') {
        const newX = Math.max(0, Math.min(start.x + start.w - 10, start.x + dx));
        updated.w = start.w + (start.x - newX);
        updated.x = newX;
        updated.h = Math.max(10, Math.min(100 - start.y, start.h + dy));
      }

      return updated;
    });
  };

  const handleCropMouseUp = () => {
    setIsDraggingCrop(null);
  };

  // Apply Crop to Canvas
  const applyCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate crop box pixel coordinates
    const sourceX = (crop.x / 100) * canvas.width;
    const sourceY = (crop.y / 100) * canvas.height;
    const sourceW = (crop.w / 100) * canvas.width;
    const sourceH = (crop.h / 100) * canvas.height;

    // Save history point
    setHistory([...history, currentImage]);

    // Create temporary offscreen canvas to hold cropped image region
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = sourceW;
    tempCanvas.height = sourceH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(
        canvas,
        sourceX, sourceY, sourceW, sourceH, // source bounds
        0, 0, sourceW, sourceH // dest bounds
      );
      
      const croppedBase64 = tempCanvas.toDataURL('image/jpeg', 0.9);
      setCurrentImage(croppedBase64);
      // Reset crop overlay back to defaults
      setCrop({ x: 10, y: 10, w: 80, h: 80 });
      setActiveTool('draw'); // return to drawing as main tool
    }
  };

  // Reset entirely
  const handleReset = () => {
    if (window.confirm("Are you sure you want to revert all drawings and crops?")) {
      setHistory([]);
      setCurrentImage(imageSrc);
      setCrop({ x: 10, y: 10, w: 80, h: 80 });
    }
  };

  // Save changes
  const handleSaveAndExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const finalBase64 = canvas.toDataURL('image/jpeg', 0.95);
    onSave(finalBase64);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between text-white select-none animate-fade-in"
      onMouseMove={handleCropMouseMove}
      onMouseUp={handleCropMouseUp}
    >
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-slate-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-beach-coral rounded-xl shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-black tracking-wide text-white flex items-center gap-1.5 uppercase">
              Highlight Studio
            </h2>
            <p className="text-[9px] text-slate-400">Crop, circle, or draw arrows to emphasize the civic concern</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleUndo}
            disabled={history.length === 0}
            className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Undo stroke"
          >
            <Undo className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Undo</span>
          </button>

          <button
            onClick={handleReset}
            className="p-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-xs font-bold text-slate-300"
            title="Revert all changes"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
            title="Close editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative">
        <div 
          ref={containerRef}
          className="relative max-w-full max-h-[65vh] shadow-2xl border border-white/15 rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center"
        >
          {/* Main draw and edit canvas */}
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`max-w-full max-h-[65vh] object-contain rounded-2xl ${
              activeTool === 'draw' ? 'cursor-crosshair touch-none' : 'cursor-default'
            }`}
          />

          {/* Draggable/Resizable Crop Overlay */}
          {activeTool === 'crop' && (
            <div 
              className="absolute inset-0 bg-black/65 cursor-default pointer-events-auto"
              style={{ borderRadius: 'inherit' }}
            >
              {/* Highlighted Crop Area Box */}
              <div 
                className="absolute border-2 border-dashed border-beach-coral bg-transparent cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
                style={{
                  left: `${crop.x}%`,
                  top: `${crop.y}%`,
                  width: `${crop.w}%`,
                  height: `${crop.h}%`
                }}
                onMouseDown={(e) => handleCropDragStart('move', e)}
              >
                {/* Visual guidelines grid lines */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 pointer-events-none">
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-r border-b border-white" />
                  <div className="border-b border-white" />
                  <div className="border-r border-white" />
                  <div className="border-r border-white" />
                  <div className="bg-transparent" />
                </div>

                {/* Corner Resizing Handles */}
                {/* Top-Left */}
                <div 
                  className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-beach-coral border border-white rounded-full cursor-nwse-resize shadow-md"
                  onMouseDown={(e) => handleCropDragStart('nw', e)}
                />
                {/* Top-Right */}
                <div 
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-beach-coral border border-white rounded-full cursor-nesw-resize shadow-md"
                  onMouseDown={(e) => handleCropDragStart('ne', e)}
                />
                {/* Bottom-Right */}
                <div 
                  className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-beach-coral border border-white rounded-full cursor-nwse-resize shadow-md"
                  onMouseDown={(e) => handleCropDragStart('se', e)}
                />
                {/* Bottom-Left */}
                <div 
                  className="absolute -bottom-1.5 -left-1.5 w-3.5 h-3.5 bg-beach-coral border border-white rounded-full cursor-nesw-resize shadow-md"
                  onMouseDown={(e) => handleCropDragStart('sw', e)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Footer and Tooling Panels */}
      <div className="border-t border-white/10 bg-slate-900/90 backdrop-blur-sm p-4 space-y-4">
        {/* Tool Selector Tabs */}
        <div className="flex justify-center max-w-sm mx-auto bg-slate-950 p-1 rounded-2xl border border-white/5 shadow-inner">
          <button
            onClick={() => setActiveTool('draw')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTool === 'draw'
                ? 'bg-beach-coral text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Paintbrush className="w-4 h-4" />
            Highlight Brush
          </button>
          <button
            onClick={() => setActiveTool('crop')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTool === 'crop'
                ? 'bg-beach-coral text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Crop className="w-4 h-4" />
            Crop Frame
          </button>
        </div>

        {/* Selected Tool's Configuration Controls */}
        <div className="max-w-md mx-auto h-12 flex items-center justify-center">
          {activeTool === 'draw' ? (
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-between animate-scale-up">
              {/* Color Palette */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mr-1.5">Color:</span>
                {[
                  { hex: '#ef4444', label: 'Alert Red' },
                  { hex: '#f97316', label: 'Safety Amber' },
                  { hex: '#eab308', label: 'Caution Yellow' },
                  { hex: '#0284c7', label: 'Water Blue' },
                  { hex: '#10b981', label: 'Green OK' }
                ].map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => setBrushColor(color.hex)}
                    className={`w-6 h-6 rounded-full border transition-all cursor-pointer relative flex items-center justify-center ${
                      brushColor === color.hex 
                        ? 'border-white scale-110 shadow-lg' 
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: color.hex }}
                    title={color.label}
                  >
                    {brushColor === color.hex && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                    )}
                  </button>
                ))}
              </div>

              {/* Stroke Width Slider */}
              <div className="flex items-center gap-2 w-1/2 min-w-[150px]">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">Size:</span>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={brushSize}
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="flex-1 accent-beach-coral h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-400 w-6 text-right font-bold">{brushSize}px</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full animate-scale-up">
              <span className="text-[11px] text-slate-300 font-medium">
                Adjust handles to crop down precisely on the hazard
              </span>
              <button
                onClick={applyCrop}
                className="py-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Apply Crop
              </button>
            </div>
          )}
        </div>

        {/* Global Save Action Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 max-w-lg mx-auto">
          <p className="text-[10px] text-slate-400 max-w-[60%] text-left hidden sm:block">
            Once satisfied, save and return. Nano uses this emphasized graphic to extract high-accuracy coordinates and categories.
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-white/10 hover:bg-white/5 rounded-xl font-bold text-xs text-slate-300 hover:text-white transition-all cursor-pointer flex-1 sm:flex-none text-center"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndExport}
              className="px-5 py-2.5 bg-beach-coral hover:bg-beach-coral/90 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-lg transition-all cursor-pointer flex-1 sm:flex-none text-center"
            >
              <Check className="w-4 h-4" />
              Save Highlights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
