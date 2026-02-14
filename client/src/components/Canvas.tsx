
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
  onDeleteEdge: (edgeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
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
  onDeleteEdge,
  onDuplicateNode,
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
  const [hoveredEdgeId, setHoveredEdgeId] = React.useState<string | null>(null);

  const NODE_WIDTH = 320; // Matches w-[320px] in Node.tsx
  const TARGET_HANDLE_OFFSET = 32; // Matches top-8 (2rem = 32px) in Node.tsx
  const DEFAULT_SOURCE_OFFSET = 60; // Fallback approximation

  // Color Mapping for Connection Lines
  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case NodeType.OnMessage: return { stroke: '#db2777', animate: '#f9a8d4', name: 'pink' }; // Pink 600/300
      case NodeType.MediaMessage: return { stroke: '#9333ea', animate: '#d8b4fe', name: 'purple' }; // Purple 600/300
      case NodeType.TextMessage:
      case NodeType.ManageGroups:
      case NodeType.ContactPipeline: return { stroke: '#2563eb', animate: '#93c5fd', name: 'blue' }; // Blue 600/300
      case NodeType.Webhook: return { stroke: '#d97706', animate: '#fcd34d', name: 'amber' }; // Amber 600/300
      case NodeType.AskLocation:
      case NodeType.WriteAttribute:
      case NodeType.ManageTags:
      case NodeType.NewLead: return { stroke: '#0d9488', animate: '#5eead4', name: 'teal' }; // Teal 600/300
      case NodeType.Gsheet:
      case NodeType.QuickReplyMessage: return { stroke: '#059669', animate: '#6ee7b7', name: 'emerald' }; // Emerald 600/300
      case NodeType.AIAgent:
      case NodeType.ListMessage: return { stroke: '#7c3aed', animate: '#c4b5fd', name: 'violet' }; // Violet 600/300
      case NodeType.SendFlow:
      case NodeType.CheckCondition:
      case NodeType.Gmail: return { stroke: '#e11d48', animate: '#fda4af', name: 'rose' }; // Rose 600/300
      case NodeType.SetWebhook:
      case NodeType.CTAMessage:
      case NodeType.CallApi: return { stroke: '#0891b2', animate: '#67e8f9', name: 'cyan' }; // Cyan 600/300
      case NodeType.AskAnything:
      case NodeType.Switch:
      case NodeType.AskInput: return { stroke: '#ea580c', animate: '#fdba74', name: 'orange' }; // Orange 600/300
      case NodeType.Code:
      case NodeType.TemplateMessage: return { stroke: '#4f46e5', animate: '#a5b4fc', name: 'indigo' }; // Indigo 600/300
      case NodeType.Timing:
      case NodeType.Smtp: return { stroke: '#475569', animate: '#cbd5e1', name: 'slate' }; // Slate 600/300
      default: return { stroke: '#475569', animate: '#cbd5e1', name: 'slate' };
    }
  };


  // Optimize: Create a map for O(1) lookups to avoid O(N*E) during render
  const nodeLookup = React.useMemo(() => {
    const map: Record<string, Node> = {};
    for (const node of nodes) {
      map[node.id] = node;
    }
    return map;
  }, [nodes]);

  // Helper to find positions. Note: Positions are in "World Space"
  const findSourcePosition = useCallback((edge: Edge): { x: number; y: number; found: boolean } => {
    const { source, sourceHandle } = edge;
    const handleId = sourceHandle || 'default';

    // Try to find the specific handle element in the DOM
    const handleEl = document.getElementById(`h-${source}-${handleId}`);
    const nodeEl = document.getElementById(source);
    const node = nodeLookup[source];

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

    // Fallback for nodes if DOM lookup fails
    if (!node) return { x: 0, y: 0, found: false };
    return { x: node.position.x + NODE_WIDTH, y: node.position.y + DEFAULT_SOURCE_OFFSET, found: true };
  }, [nodeLookup, viewport.zoom]);

  const findNodeTargetPosition = useCallback((nodeId: string): { x: number; y: number; found: boolean } => {
    // Try to find the target handle element in the DOM
    const handleEl = document.getElementById(`h-${nodeId}-target`);
    const nodeEl = document.getElementById(nodeId);
    const node = nodeLookup[nodeId];

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
  }, [nodeLookup, viewport.zoom]);

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
            {['pink', 'purple', 'blue', 'amber', 'teal', 'emerald', 'violet', 'rose', 'cyan', 'orange', 'indigo', 'slate'].map(color => {
              const hex = color === 'pink' ? '#db2777' : color === 'purple' ? '#9333ea' : color === 'blue' ? '#2563eb' : color === 'amber' ? '#d97706' : color === 'teal' ? '#0d9488' : color === 'emerald' ? '#059669' : color === 'violet' ? '#7c3aed' : color === 'rose' ? '#e11d48' : color === 'cyan' ? '#0891b2' : color === 'orange' ? '#ea580c' : color === 'indigo' ? '#4f46e5' : '#475569';
              return (
                <marker key={color} id={`arrowhead-${color}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={hex} />
                </marker>
              );
            })}
          </defs>

          {edges.map((edge) => {
            const sourcePos = findSourcePosition(edge);
            const targetPos = findNodeTargetPosition(edge.target);
            const sourceNode = nodeLookup[edge.source];
            const { stroke: strokeColor, animate: animateColor, name: colorName } = getNodeColor(sourceNode?.type || NodeType.Timing);

            if (!sourcePos.found || !targetPos.found) return null;

            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;
            const isHovered = hoveredEdgeId === edge.id;

            return (
              <g key={edge.id} className="pointer-events-auto" onMouseEnter={() => setHoveredEdgeId(edge.id)} onMouseLeave={() => setHoveredEdgeId(null)}>
                <path
                  d={`M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + 100} ${sourcePos.y} ${targetPos.x - 100} ${targetPos.y} ${targetPos.x} ${targetPos.y}`}
                  stroke={isHovered ? animateColor : strokeColor}
                  strokeWidth={isHovered ? "4" : "2"}
                  fill="none"
                  markerEnd={`url(#arrowhead-${colorName})`}
                  className="transition-all duration-200"
                />
                {/* Animated Flow Dots */}
                <path
                  d={`M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + 100} ${sourcePos.y} ${targetPos.x - 100} ${targetPos.y} ${targetPos.x} ${targetPos.y}`}
                  stroke={animateColor}
                  strokeWidth="2"
                  fill="none"
                  className="animate-flow-line pointer-events-none opacity-80"
                  style={{ strokeDasharray: '5, 8' }} // Custom dash for dots
                />
                {/* Invisible wider path for easier hovering */}
                <path
                  d={`M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + 100} ${sourcePos.y} ${targetPos.x - 100} ${targetPos.y} ${targetPos.x} ${targetPos.y}`}
                  stroke="transparent"
                  strokeWidth="20"
                  fill="none"
                  onClick={() => onDeleteEdge(edge.id)}
                  style={{ cursor: 'pointer' }}
                />
                {/* Delete Button on Hover */}
                {isHovered && (
                  <g
                    onClick={(e) => { e.stopPropagation(); onDeleteEdge(edge.id); }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={midX} cy={midY} r="10" fill="#ef4444" stroke="white" strokeWidth="2" />
                    <path
                      d={`M ${midX - 3} ${midY - 3} L ${midX + 3} ${midY + 3} M ${midX + 3} ${midY - 3} L ${midX - 3} ${midY + 3}`}
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
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
              onDuplicateNode={onDuplicateNode}
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
