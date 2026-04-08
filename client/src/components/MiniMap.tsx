import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Node } from '../types';

interface MiniMapProps {
  nodes: Node[];
  viewport: { x: number; y: number; zoom: number };
  onMoveTo: (x: number, y: number) => void;
  canvasBounds?: DOMRect | null;
}

const MiniMap: React.FC<MiniMapProps> = ({ nodes, viewport, onMoveTo, canvasBounds }) => {
  const [isMinimized, setIsMinimized] = useState(true);
  const mapWidth = 240; 
  const mapHeight = 140; 
  const containerRef = useRef<HTMLDivElement>(null);

  const [stableBounds, setStableBounds] = useState({ minX: -1000, minY: -1000, maxX: 2000, maxY: 2000 });

  useEffect(() => {
    if (nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + 320);
      maxY = Math.max(maxY, n.position.y + 100);
    });
    setStableBounds({ 
      minX: Math.min(minX - 500, -1000), 
      minY: Math.min(minY - 500, -1000), 
      maxX: Math.max(maxX + 1000, 2000), 
      maxY: Math.max(maxY + 1000, 2000) 
    });
  }, [nodes]);

  const worldToMap = useCallback((wx: number, wy: number) => {
    const { minX, minY, maxX, maxY } = stableBounds;
    const w = maxX - minX;
    const h = maxY - minY;
    return {
      x: ((wx - minX) / w) * mapWidth,
      y: ((wy - minY) / h) * mapHeight
    };
  }, [stableBounds, mapWidth, mapHeight]);

  const mapToWorld = useCallback((mx: number, my: number) => {
    const { minX, minY, maxX, maxY } = stableBounds;
    const w = maxX - minX;
    const h = maxY - minY;
    return {
      wx: (mx / mapWidth) * w + minX,
      wy: (my / mapHeight) * h + minY
    };
  }, [stableBounds, mapWidth, mapHeight]);

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    if (isMinimized) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const { wx, wy } = mapToWorld(mx, my);
    onMoveTo(wx, wy);
  };

  const vpStart = worldToMap((0 - viewport.x) / viewport.zoom, (0 - viewport.y) / viewport.zoom);
  const vpw = canvasBounds ? (canvasBounds.width / viewport.zoom) / (stableBounds.maxX - stableBounds.minX) * mapWidth : 40;
  const vph = canvasBounds ? (canvasBounds.height / viewport.zoom) / (stableBounds.maxY - stableBounds.minY) * mapHeight : 30;

  return (
    <div ref={containerRef} className="relative select-none outline-none group/mm transition-all duration-300 overflow-hidden rounded-xl bg-slate-900/10 border border-white/5">
        {/* Toggleable Map Body */}
        <div 
          className={`relative transition-all duration-500 ease-out ${isMinimized ? 'h-0 opacity-0 pointer-events-none' : `h-[${mapHeight}px] opacity-100`}`}
          style={{ height: isMinimized ? 0 : `${mapHeight}px` }}
          onMouseDown={handleInteraction}
          onMouseMove={(e) => e.buttons === 1 && handleInteraction(e)}
        >
          <div className="absolute inset-0 pointer-events-none opacity-40">
            {nodes.map(n => {
              const pos = worldToMap(n.position.x, n.position.y);
              return <div key={n.id} className="absolute w-1.5 h-0.5 bg-brand-400 rounded-full" style={{ left: pos.x, top: pos.y }} />;
            })}
          </div>

          <div 
            className="absolute border border-brand-500/50 bg-brand-500/10 transition-colors pointer-events-none ring-1 ring-brand-500/20"
            style={{ 
              left: Math.max(0, Math.min(mapWidth - vpw, vpStart.x)), 
              top: Math.max(0, Math.min(mapHeight - vph, vpStart.y)), 
              width: vpw, 
              height: vph 
            }}
          />
        </div>

        {/* Status Bar / Bottom Tab */}
        <div className="px-3 py-1.5 flex items-center justify-between border-t border-white/5 bg-slate-950/20">
          <div className="flex gap-1">
             {isMinimized && nodes.map((n, i) => i < 12 && (
               <div key={`dot-${n.id}`} className="w-1 h-1 bg-brand-500/40 rounded-full animate-pulse transition-all duration-500 hover:scale-150" />
             ))}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
            className="p-1 px-2 flex items-center gap-1.5 rounded-md text-[9px] font-black uppercase text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            {isMinimized ? 'Expand Overview' : 'Close Map'}
            <svg className={`w-3 h-3 transition-transform duration-300 ${isMinimized ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
    </div>
  );
};

export default MiniMap;
