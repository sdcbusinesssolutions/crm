
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flowService } from '../services/flowService';
import { Node, Edge, NodeType, AnyNodeData, MediaType, Flow } from '../types';
import NodesPanel from './NodesPanel';
import SettingsPanel from './SettingsPanel';
import Canvas from './Canvas';
import Navigation from './Navigation';
import { ArrowLeftIcon, EditIcon, PlusIcon } from './icons';

interface FlowEditorProps {
  flowId: string;
  onBack: () => void;
}

const FlowEditor: React.FC<FlowEditorProps> = ({ flowId, onBack }) => {
  const [flowName, setFlowName] = useState('Untitled Flow');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [flowStatus, setFlowStatus] = useState<'Draft' | 'Published'>('Draft');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingSource, setConnectingSource] = useState<{ nodeId: string; handleId?: string } | null>(null);
  const connectingSourceRef = useRef(connectingSource);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);

  const [isNodesPanelOpen, setIsNodesPanelOpen] = useState(true);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const viewportRef = useRef(viewport);

  const draggingNode = useRef<{ id: string; offset: { x: number; y: number } } | null>(null);
  const isPanning = useRef(false);
  const lastClientPos = useRef({ x: 0, y: 0 });
  const [connectionLine, setConnectionLine] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { connectingSourceRef.current = connectingSource; }, [connectingSource]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  useEffect(() => {
    const checkScreenSize = () => {
      if (window.innerWidth < 768) setIsNodesPanelOpen(false);
      else setIsNodesPanelOpen(true);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const loadFlow = async () => {
      setLoading(true);
      const flow = await flowService.getFlow(flowId);
      if (flow) {
        setNodes(flow.nodes);
        setEdges(flow.edges);
        setFlowName(flow.name);
        setFlowStatus(flow.status);
      } else {
        showNotification('Flow not found');
        onBack();
      }
      setLoading(false);
    };
    loadFlow();
  }, [flowId, onBack]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentFlow = await flowService.getFlow(flowId);
      if (currentFlow) {
        const updatedFlow: Flow = { ...currentFlow, name: flowName, status: flowStatus, nodes, edges, updatedAt: new Date().toLocaleDateString() };
        await flowService.saveFlow(updatedFlow);
        showNotification('Flow saved successfully!');
      }
    } catch (error) {
      showNotification('Error saving flow.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    if (!canvasWrapperRef.current) return { x: 0, y: 0 };
    const bounds = canvasWrapperRef.current.getBoundingClientRect();
    const currentViewport = viewportRef.current;
    return { x: (screenX - bounds.left - currentViewport.x) / currentViewport.zoom, y: (screenY - bounds.top - currentViewport.y) / currentViewport.zoom };
  }, []);

  const getClientPos = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: (e as any).clientX, y: (e as any).clientY };
  };

  const addNode = useCallback((type: NodeType, position?: { x: number, y: number }) => {
    // (Reuse existing addNode logic, abbreviated for brevity as it logic doesn't change, just UI)
    // ... [Same Node Default Data Logic as previous file] ...
    const baseData: any = { label: `New ${type.replace(/([A-Z])/g, ' $1')}` };
    switch (type) {
      case NodeType.OnMessage: baseData.label = 'On Message'; baseData.messageType = 'Text'; baseData.keywords = []; baseData.phoneNumbers = []; break;
      case NodeType.TextMessage: baseData.message = ''; break;
      case NodeType.MediaMessage: baseData.label = 'Send Media Message'; baseData.mediaType = MediaType.Video; baseData.url = ''; baseData.caption = ''; break;
      case NodeType.Webhook: baseData.eventType = ''; break;
      case NodeType.SetWebhook: Object.assign(baseData, { label: 'Set Webhook', url: 'https://api.example.com/endpoint', method: 'GET', headers: [{ key: '', value: '' }], params: [{ key: '', value: '' }], body: '{}' }); break;
      case NodeType.WriteAttribute: baseData.label = 'Write attribute'; baseData.agentId = ''; break;
      case NodeType.Timing: baseData.delayValue = 1; baseData.delayUnit = 'Minutes'; break;
      case NodeType.Takeaway: baseData.storeId = ''; break;
      case NodeType.Delivery: baseData.serviceId = ''; break;
      case NodeType.AddressMessage: baseData.name = ''; baseData.address = ''; break;
      case NodeType.ListMessage: Object.assign(baseData, { label: 'List Message', header: 'Header Text', body: 'This is the body text.', footer: 'Footer text.', buttonText: 'Menu', sections: [{ id: `sec-${Date.now()}`, title: 'Section 1', items: [{ id: `item-${Date.now()}`, title: 'Button 1', description: 'Optional description' }] }], validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.QuickReplyMessage: Object.assign(baseData, { label: 'Quick Reply', headerType: 'None', headerText: '', body: '', footer: '', buttons: [{ id: `btn-${Date.now()}`, title: 'Button 1' }], validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.CTAMessage: Object.assign(baseData, { label: 'Send CTA Message', headerType: 'None', body: '', displayText: '', url: '', footer: '' }); break;
      case NodeType.AskAnything: Object.assign(baseData, { label: 'Ask anything', text: 'Write your message here', validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.CheckCondition: Object.assign(baseData, { label: 'Check condition', conditions: [{ id: `cg-${Date.now()}`, name: 'Block-1', rules: [{ id: `cr-${Date.now()}`, attribute: 'Name', operator: 'is', value: '' }] }] }); break;
      case NodeType.Gsheet: baseData.spreadsheetId = ''; baseData.sheetName = ''; baseData.action = 'READ'; baseData.range = 'A1'; break;
      case NodeType.Code: baseData.code = '// Your code here'; break;
      case NodeType.CatalogueMessage: baseData.header = ''; baseData.body = ''; baseData.items = []; break;
      case NodeType.Appointment: baseData.calendarId = ''; baseData.durationMinutes = 30; break;
      case NodeType.ManageCart: baseData.action = 'ADD'; baseData.productId = ''; baseData.quantity = 1; break;
      case NodeType.Payment: baseData.provider = ''; baseData.amount = 10; baseData.currency = 'USD'; break;
      case NodeType.AskLocation: baseData.text = 'Please share your location.'; break;
    }

    let nodePos = position;
    if (!nodePos && canvasWrapperRef.current) {
      const bounds = canvasWrapperRef.current.getBoundingClientRect();
      const worldPos = screenToWorld(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
      nodePos = { x: worldPos.x - 150, y: worldPos.y - 50 };
    }

    const newNode: Node = { id: `${type}-${Date.now()}`, type, position: nodePos || { x: 0, y: 0 }, data: baseData };
    setNodes((prev) => [...prev, newNode]);
    if (window.innerWidth < 768) setIsNodesPanelOpen(false);
  }, [screenToWorld]);

  const updateNodeData = (nodeId: string, data: AnyNodeData) => setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, data } : n));
  const deleteNode = (nodeId: string) => {
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    setNodes(nodes => nodes.filter(n => n.id !== nodeId));
    setEdges(edges => edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    if (connectingSource?.nodeId === nodeId) cancelConnection();
  };

  const handleGlobalMove = useCallback((e: MouseEvent | TouchEvent) => {
    const { x, y } = getClientPos(e);
    const deltaX = x - lastClientPos.current.x;
    const deltaY = y - lastClientPos.current.y;
    lastClientPos.current = { x, y };

    if (isPanning.current) {
      setViewport(prev => ({ ...prev, x: prev.x + deltaX, y: prev.y + deltaY }));
      if (e.type === 'touchmove') e.preventDefault();
      return;
    }
    if (draggingNode.current) {
      const { id, offset } = draggingNode.current;
      const worldPos = screenToWorld(x, y);
      setNodes(prev => prev.map(n => n.id === id ? { ...n, position: { x: worldPos.x - offset.x, y: worldPos.y - offset.y } } : n));
      if (e.type === 'touchmove') e.preventDefault();
    }
    if (connectingSourceRef.current) {
      const worldPos = screenToWorld(x, y);
      setConnectionLine(line => line ? { ...line, x2: worldPos.x, y2: worldPos.y } : null);
      if (e.type === 'touchmove') e.preventDefault();
    }
  }, [screenToWorld]);

  const cancelConnection = useCallback(() => {
    document.body.classList.remove('is-connecting');
    setConnectingSource(null);
    setConnectionLine(null);
  }, []);

  const handleCompleteConnection = useCallback((targetNodeId: string) => {
    const source = connectingSourceRef.current;
    if (!source) return;
    if (targetNodeId && targetNodeId !== source.nodeId) {
      setEdges(prev => {
        if (!prev.some(e => e.source === source.nodeId && e.sourceHandle === source.handleId && e.target === targetNodeId)) {
          return [...prev, { id: `e-${source.nodeId}-${source.handleId || 'default'}-${targetNodeId}`, source: source.nodeId, sourceHandle: source.handleId, target: targetNodeId }];
        }
        return prev;
      });
    }
    cancelConnection();
  }, [cancelConnection]);

  const handleGlobalUp = useCallback((e: MouseEvent | TouchEvent) => {
    document.body.classList.remove('dragging-node', 'is-connecting');
    const source = connectingSourceRef.current;
    if (source && 'changedTouches' in e) {
      const target = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      const nodeEl = target?.closest('[data-node-id]');
      if (nodeEl) { handleCompleteConnection(nodeEl.getAttribute('data-node-id')!); cleanupListeners(); return; }
    }
    draggingNode.current = null;
    isPanning.current = false;
    if (source) cancelConnection();
    cleanupListeners();
  }, [cancelConnection, handleCompleteConnection]);

  const cleanupListeners = () => {
    window.removeEventListener('mousemove', handleGlobalMove);
    window.removeEventListener('mouseup', handleGlobalUp);
    window.removeEventListener('touchmove', handleGlobalMove);
    window.removeEventListener('touchend', handleGlobalUp);
  };

  const startInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    const { x, y } = getClientPos(e);
    lastClientPos.current = { x, y };
    if (e.type === 'touchstart') { window.addEventListener('touchmove', handleGlobalMove, { passive: false }); window.addEventListener('touchend', handleGlobalUp); }
    else { window.addEventListener('mousemove', handleGlobalMove); window.addEventListener('mouseup', handleGlobalUp); }
  };

  const handleCanvasStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.type === 'mousedown' && (e as React.MouseEvent).button !== 0) return;
    isPanning.current = true;
    setSelectedNodeId(null);
    if (connectingSource) cancelConnection();
    startInteraction(e);
  };

  const handleNodeDragStart = (e: React.MouseEvent | React.TouchEvent, nodeId: string) => {
    if (connectingSource) return;
    e.stopPropagation();
    if (e.type === 'mousedown') e.preventDefault();
    // Move to top
    setNodes(prev => { const idx = prev.findIndex(n => n.id === nodeId); if (idx === -1 || idx === prev.length - 1) return prev; const next = [...prev]; next.push(next.splice(idx, 1)[0]); return next; });

    const { x, y } = getClientPos(e);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const worldPos = screenToWorld(x, y);
    draggingNode.current = { id: nodeId, offset: { x: worldPos.x - node.position.x, y: worldPos.y - node.position.y } };
    document.body.classList.add('dragging-node');
    startInteraction(e);
  };

  const handleSourceHandleStart = (e: React.MouseEvent | React.TouchEvent, nodeId: string, handleId: string) => {
    e.stopPropagation();
    setConnectingSource({ nodeId, handleId });
    document.body.classList.add('is-connecting');
    const { x, y } = getClientPos(e);
    const worldPos = screenToWorld(x, y);
    setConnectionLine({ x1: worldPos.x, y1: worldPos.y, x2: worldPos.x, y2: worldPos.y });
    startInteraction(e);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = -e.deltaY * 0.001;
      setViewport(prev => ({ ...prev, zoom: Math.min(Math.max(prev.zoom + delta, 0.1), 3) }));
    } else {
      setViewport(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    }
  };

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    let type = event.dataTransfer.getData('application/reactflow') as NodeType;
    if (!type) type = event.dataTransfer.getData('text/plain') as NodeType;
    if (!type) return;
    const worldPos = screenToWorld(event.clientX, event.clientY);
    addNode(type, { x: worldPos.x - 150, y: worldPos.y - 50 });
  }, [addNode, screenToWorld]);

  if (loading) return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></div>Loading Flow...</div>;

  return (
    <div className="h-full w-full flex flex-col font-sans bg-slate-950 text-white relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none px-4 py-3">
        <div className="max-w-5xl mx-auto bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-xl shadow-2xl px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 pointer-events-auto">
          <div className="flex items-center w-full sm:w-auto relative z-40">
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white mr-2"><ArrowLeftIcon className="w-5 h-5" /></button>
            <div className="h-8 w-px bg-slate-700 mx-2 hidden sm:block"></div>
            <div className="flex-1 sm:flex-none relative">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Flow Name</label>
              {isEditingName ? (
                <input type="text" value={flowName} onChange={(e) => setFlowName(e.target.value)} onBlur={() => setIsEditingName(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)} autoFocus className="bg-transparent text-white font-bold text-lg focus:outline-none border-b border-brand-500 w-full sm:w-64 placeholder-slate-600 py-1" placeholder="Untitled Flow" />
              ) : (
                <div className="group flex items-center cursor-pointer py-1" onClick={() => setIsEditingName(true)}>
                  <h1 className="font-bold text-lg text-white truncate max-w-[200px] sm:max-w-xs mr-2 border-b border-transparent hover:border-slate-500 transition-colors">{flowName}</h1>
                  <EditIcon className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors opacity-50 group-hover:opacity-100" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${flowStatus === 'Published' ? 'text-emerald-400' : 'text-slate-400'}`}>{flowStatus}</span>
              <button onClick={() => setFlowStatus(s => s === 'Draft' ? 'Published' : 'Draft')} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${flowStatus === 'Published' ? 'bg-emerald-500' : 'bg-slate-700'}`} title={`Switch to ${flowStatus === 'Draft' ? 'Published' : 'Draft'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${flowStatus === 'Published' ? 'translate-x-4.5' : 'translate-x-1'}`} style={{ transform: flowStatus === 'Published' ? 'translateX(1.125rem)' : 'translateX(0.125rem)' }} />
              </button>
            </div>
            <div className="h-8 w-px bg-slate-700 mx-1 hidden sm:block"></div>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-btn shadow-lg shadow-brand-900/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Saving...</span></>) : (<span>Save Flow</span>)}
            </button>
          </div>
        </div>
      </div>

      {notification && <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"><div className="bg-emerald-600 text-white px-4 py-2 rounded-full shadow-xl text-sm font-medium animate-fade-in flex items-center gap-2">{notification}</div></div>}

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`absolute inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out bg-slate-900 shadow-2xl border-r border-slate-800 h-full ${isNodesPanelOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:translate-x-0`}>
          <NodesPanel onAddNode={(type) => addNode(type)} onClose={() => setIsNodesPanelOpen(false)} />
        </div>

        {isNodesPanelOpen && <div className="absolute inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setIsNodesPanelOpen(false)} />}

        <div ref={canvasWrapperRef} className={`flex-1 relative h-full overflow-hidden flex flex-col transition-colors duration-200 bg-slate-950`} onWheel={handleWheel}>
          <div className="absolute inset-0 z-0">
            <Canvas nodes={nodes} edges={edges} connectingSource={connectingSource} connectionLine={connectionLine} viewport={viewport} onNodeDragStart={handleNodeDragStart} onNodeTouchStart={handleNodeDragStart} onCanvasMouseDown={handleCanvasStart} onCanvasTouchStart={handleCanvasStart} onUpdateNode={updateNodeData} onDeleteNode={deleteNode} onSourceHandleMouseDown={handleSourceHandleStart} onSourceHandleTouchStart={handleSourceHandleStart} onNodeSettingsClick={(nodeId) => setSelectedNodeId(nodeId)} onNodeClick={() => { }} onNodeMouseUp={handleCompleteConnection} onDragOver={onDragOver} onDrop={onDrop} />
            <Navigation zoom={viewport.zoom} onZoomIn={() => setViewport(p => ({ ...p, zoom: Math.min(p.zoom + 0.2, 3) }))} onZoomOut={() => setViewport(p => ({ ...p, zoom: Math.max(p.zoom - 0.2, 0.1) }))} onFitView={() => setViewport({ x: 0, y: 0, zoom: 1 })} className="absolute bottom-6 right-6 md:bottom-8 md:left-8" />
          </div>
        </div>

        {!isNodesPanelOpen && (
          <button onClick={() => setIsNodesPanelOpen(true)} className="md:hidden absolute bottom-6 left-6 w-12 h-12 bg-brand-600 text-white rounded-full shadow-lg shadow-brand-900/50 flex items-center justify-center z-20 hover:bg-brand-500 active:scale-90 transition-all">
            <PlusIcon className="w-6 h-6" />
          </button>
        )}

        {selectedNode && <SettingsPanel selectedNode={selectedNode} nodes={nodes} edges={edges} onUpdateNode={updateNodeData} onClose={() => setSelectedNodeId(null)} />}
      </div>
    </div>
  );
};

export default FlowEditor;
