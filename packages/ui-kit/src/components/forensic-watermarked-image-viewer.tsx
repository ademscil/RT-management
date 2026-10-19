import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RefreshCw } from 'lucide-react';
import { Button } from './button.js';

export interface ForensicWatermarkedImageViewerProps {
  imageSrc: string;
  adminName: string;
  adminIp?: string;
  className?: string;
}

export const ForensicWatermarkedImageViewer: React.FC<ForensicWatermarkedImageViewerProps> = ({
  imageSrc,
  adminName,
  adminIp = '127.0.0.1',
  className = '',
}) => {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render forensic watermark on overlay canvas every 10 seconds or on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderWatermark = () => {
      if (!canvas || !containerRef.current) return;
      canvas.width = containerRef.current.clientWidth;
      canvas.height = containerRef.current.clientHeight;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const timestamp = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
      const watermarkText = `${adminName.toUpperCase()} - IP: ${adminIp} - ${timestamp}`;

      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(220, 38, 38, 0.35)'; // Red-600 semi-transparent
      ctx.textAlign = 'center';

      ctx.save();
      ctx.rotate((-25 * Math.PI) / 180);

      // Tiled grid
      const stepX = 350;
      const stepY = 120;
      for (let x = -canvas.width; x < canvas.width * 2; x += stepX) {
        for (let y = -canvas.height; y < canvas.height * 2; y += stepY) {
          ctx.fillText(watermarkText, x, y);
        }
      }
      ctx.restore();
    };

    renderWatermark();
    const interval = setInterval(renderWatermark, 10000); // Update timestamp every 10s

    window.addEventListener('resize', renderWatermark);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', renderWatermark);
    };
  }, [adminName, adminIp]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 overflow-hidden ${className}`}>
      {/* Controls Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700/50 backdrop-blur z-20">
        <span className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Forensic Watermark Active
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-slate-200 hover:text-white h-8 w-8 min-h-0 min-w-0" title="Perkecil">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-slate-200 hover:text-white h-8 w-8 min-h-0 min-w-0" title="Perbesar">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRotate} className="text-slate-200 hover:text-white h-8 w-8 min-h-0 min-w-0" title="Putar 90°">
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleReset} className="text-slate-200 hover:text-white h-8 w-8 min-h-0 min-w-0" title="Reset Tampilan">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Image Viewport with Overlay Canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[350px] flex items-center justify-center p-4 overflow-hidden select-none"
      >
        <img
          src={imageSrc}
          alt="Dokumen KTP/KK Terverifikasi"
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="max-h-[500px] object-contain rounded-lg shadow-2xl pointer-events-none"
        />

        {/* Dynamic Forensic Canvas Overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none z-10 w-full h-full"
        />
      </div>
    </div>
  );
};
