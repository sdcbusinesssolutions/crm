
import React, { useRef, useCallback } from 'react';
import { Node, Edge, NodeType } from '../types';
import NodeComponent from './Node';

interface CanvasProps {
  nodes: Node[];
  edges: Edge[];
  connectingSource: { nodeId: string; handleId?: string } | null;
  connectionLine: { x1: number, y1: number, x2: number, y2: number } | null;
  viewport: { x: number; y: number; zoom: number };
  onNodeDragStart: (e: React.MouseEvent, nodeId: string) => void;
  onNodeTouchStart: (e: React.TouchEvent, nodeId: string) => void;
  onUpdateNode: (nodeId: string, data: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onCanvasMouseDown: (e: React.MouseEvent) => void;
  onCanvasTouchStart: (e: React.TouchEvent) => void;
  onSourceHandleMouseDown: (e: React.MouseEvent, nodeId: string, handleId: string) => void;
  onSourceHandleTouchStart: (e: React.TouchEvent, nodeId: string, handleId: string) => void;
  onNodeSettingsClick: (nodeId: string) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeMouseUp: (nodeId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

const Canvas: React.FC<CanvasProps> = ({ 
  nodes, 
  edges,
  connectingSource, 
  connectionLine,
  viewport,
  onNodeDragStart,
  onNodeTouchStart,
  onUpdateNode,
  onDeleteNode,
  onCanvasMouseDown,
  onCanvasTouchStart,
  onSourceHandleMouseDown,
  onSourceHandleTouchStart,
  onNodeSettingsClick,
  onNodeClick,
  onNodeMouseUp,
  onDragOver,
  onDrop
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  const NODE_WIDTH = 320; // Matches w-[320px] in Node.tsx
  const TARGET_HANDLE_OFFSET = 32; // Matches top-8 (2rem = 32px) in Node.tsx
  const DEFAULT_SOURCE_OFFSET = 60; // Fallback approximation

  // Helper to find positions. Note: Positions are in "World Space"
  const findSourcePosition = useCallback((edge: Edge): { x: number; y: number; found: boolean } => {
    const { source, sourceHandle } = edge;
    const handleId = sourceHandle || 'default';

    // Try to find the specific handle element in the DOM
    const handleEl = document.getElementById(`h-${source}-${handleId}`);
    const nodeEl = document.getElementById(source);
    const node = nodes.find(n => n.id === source);
    
    if (handleEl && nodeEl && node) {
         const handleRect = handleEl.getBoundingClientRect();
         const nodeRect = nodeEl.getBoundingClientRect();
         
         // Calculate relative position and adjust for zoom
         const relativeX = ((handleRect.left - nodeRect.left) + handleRect.width / 2) / viewport.zoom;
         const relativeY = ((handleRect.top - nodeRect.top) + handleRect.height / 2) / viewport.zoom;

         return {
             x: node.position.x + relativeX,
             y: node.position.y + relativeY,
             found: true
         };
    }

    // Fallback for nodes if DOM lookup fails (e.g. strictly during initial render before mount)
    if (!node) return { x: 0, y: 0, found: false };
    return { x: node.position.x + NODE_WIDTH, y: node.position.y + DEFAULT_SOURCE_OFFSET, found: true };
  }, [nodes, viewport.zoom]);
  
  const findNodeTargetPosition = useCallback((nodeId: string): { x: number; y: number; found: boolean } => {
    // Try to find the target handle element in the DOM
    const handleEl = document.getElementById(`h-${nodeId}-target`);
    const nodeEl = document.getElementById(nodeId);
    const node = nodes.find(n => n.id === nodeId);

    if (handleEl && nodeEl && node) {
        const handleRect = handleEl.getBoundingClientRect();
        const nodeRect = nodeEl.getBoundingClientRect();
        const relativeX = ((handleRect.left - nodeRect.left) + handleRect.width / 2) / viewport.zoom;
        const relativeY = ((handleRect.top - nodeRect.top) + handleRect.height / 2) / viewport.zoom;

        return { 
            x: node.position.x + relativeX, 
            y: node.position.y + relativeY, 
            found: true 
        };
    }

    // Fallback
    if (!node) return { x: 0, y: 0, found: false };
     return { x: node.position.x, y: node.position.y + TARGET_HANDLE_OFFSET, found: true };
  }, [nodes, viewport.zoom]);

  return (
    <main 
      ref={canvasRef} 
      className="flex-1 bg-gray-900 relative overflow-hidden cursor-grab active:cursor-grabbing w-full h-full touch-none"
      onMouseDown={onCanvasMouseDown}
      onTouchStart={onCanvasTouchStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        // We apply background position and size based on viewport to create the infinite scrolling grid effect
        backgroundImage: 'radial-gradient(#374151 1px, transparent 1px)',
        backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
        {/* Transform Container: This holds the "World" */}
        <div 
            className="absolute top-0 left-0 w-full h-full origin-top-left pointer-events-none touch-none"
            style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
            }}
        >
            {/* Edges Layer */}
            <svg className="absolute overflow-visible top-0 left-0 w-full h-full pointer-events-none">
                <defs>
                <marker
                    id="arrowhead"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#06b6d4" />
                </marker>
                </defs>
                
                {edges.map((edge) => {
                const sourcePos = findSourcePosition(edge);
                const targetPos = findNodeTargetPosition(edge.target);
                if (!sourcePos.found || !targetPos.found) return null;
                
                return (
                    <path
                    key={edge.id}
                    d={`M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + 100} ${sourcePos.y} ${targetPos.x - 100} ${targetPos.y} ${targetPos.x} ${targetPos.y}`}
                    stroke="#06b6d4"
                    strokeWidth="2"
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    />
                );
                })}

                {connectionLine && (
                <line
                    x1={connectionLine.x1}
                    y1={connectionLine.y1}
                    x2={connectionLine.x2}
                    y2={connectionLine.y2}
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                />
                )}
            </svg>

            {/* Nodes Layer */}
            <div className="pointer-events-auto touch-none">
                {nodes.map((node) => (
                    <NodeComponent
                    key={node.id}
                    node={node}
                    connectingSourceNodeId={connectingSource?.nodeId || null}
                    isConnecting={connectingSource !== null}
                    onNodeDragStart={onNodeDragStart}
                    onNodeTouchStart={onNodeTouchStart}
                    onUpdateNode={onUpdateNode}
                    onDeleteNode={onDeleteNode}
                    onSourceHandleMouseDown={onSourceHandleMouseDown}
                    onSourceHandleTouchStart={onSourceHandleTouchStart}
                    onNodeSettingsClick={onNodeSettingsClick}
                    onNodeClick={onNodeClick}
                    onNodeMouseUp={onNodeMouseUp}
                    />
                ))}
            </div>
      </div>
    </main>
  );
};

export default Canvas;
