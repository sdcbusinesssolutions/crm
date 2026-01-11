
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
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
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
    // Set initial state based on screen size, but allow user toggling afterwards
    if (window.innerWidth < 768) setIsNodesPanelOpen(false);
    else setIsNodesPanelOpen(true);
  }, []);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; }, [onBack]);

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
        showNotification('Flow not found', 'error');
        onBackRef.current();
      }
      setLoading(false);
    };
    loadFlow();
  }, [flowId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentFlow = await flowService.getFlow(flowId);
      if (currentFlow) {
        const updatedFlow: Flow = { ...currentFlow, name: flowName, status: flowStatus, nodes, edges, updatedAt: new Date().toLocaleDateString() };
        await flowService.saveFlow(updatedFlow);
        showNotification('Flow saved successfully!', 'success');
        onBackRef.current();
      }
    } catch (error) {
      showNotification('Error saving flow.', 'error');
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
    if (!type) {
      console.error('Attempted to add node with undefined type');
      return;
    }
    // Smart Auto-Naming
    const existingCount = nodes.filter(n => n.type === type).length;
    const suffix = existingCount > 0 ? ` ${existingCount + 1}` : '';
    const baseLabel = type.replace(/([A-Z])/g, ' $1').trim();

    const baseData: any = { label: `${baseLabel}${suffix}` };

    switch (type) {
      case NodeType.OnMessage: baseData.label = 'On Message'; baseData.messageType = 'Text'; baseData.keywords = []; baseData.phoneNumbers = []; break;
      case NodeType.TextMessage: baseData.message = ''; break;
      case NodeType.MediaMessage: baseData.label = `Send Media${suffix}`; baseData.mediaType = MediaType.Video; baseData.url = ''; baseData.caption = ''; break;
      case NodeType.Webhook: baseData.eventType = ''; break;
      case NodeType.SetWebhook: Object.assign(baseData, { label: `Set Webhook${suffix}`, url: 'https://api.example.com/endpoint', method: 'GET', headers: [{ key: '', value: '' }], params: [{ key: '', value: '' }], body: '{}' }); break;
      case NodeType.WriteAttribute: baseData.label = `Write Attribute${suffix}`; baseData.agentId = ''; break;
      case NodeType.Timing: baseData.delaySeconds = 60; break;
      case NodeType.Takeaway: baseData.storeId = ''; break;
      case NodeType.Delivery: baseData.serviceId = ''; break;
      case NodeType.AddressMessage: baseData.name = ''; baseData.address = ''; break;
      case NodeType.ListMessage: Object.assign(baseData, { label: `List Message${suffix}`, header: 'Header Text', body: 'This is the body text.', footer: 'Footer text.', buttonText: 'Menu', sections: [{ id: `sec-${Date.now()}`, title: 'Section 1', items: [{ id: `item-${Date.now()}`, title: 'Button 1', description: 'Optional description' }] }], validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.QuickReplyMessage: Object.assign(baseData, { label: `Quick Reply${suffix}`, headerType: 'None', headerText: '', body: '', footer: '', buttons: [{ id: `btn-${Date.now()}`, title: 'Button 1' }], validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.CTAMessage: Object.assign(baseData, { label: `Send CTA${suffix}`, headerType: 'None', body: '', displayText: '', url: '', footer: '' }); break;
      case NodeType.CarouselMessage: Object.assign(baseData, { label: `Carousel${suffix}`, body: 'Check out these items!', cards: [{ id: `card-${Date.now()}-0`, cardIndex: 0, headerType: 'image', mediaUrl: '', bodyText: 'Item 1 description', buttonText: 'View Item', buttonUrl: 'https://example.com' }, { id: `card-${Date.now()}-1`, cardIndex: 1, headerType: 'image', mediaUrl: '', bodyText: 'Item 2 description', buttonText: 'View Item', buttonUrl: 'https://example.com' }] }); break;
      case NodeType.AskAnything: Object.assign(baseData, { label: `Ask Anything${suffix}`, text: 'Write your message here', validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.AskInput: Object.assign(baseData, { label: `Ask Input${suffix}`, inputType: 'Text', textInputType: 'Text', text: 'Please enter your input...', retryCount: 3, retryMessage: 'Invalid input, please try again.', timeout: 15, timeoutUnit: 'Minutes', timeoutMessage: 'Session timed out.', ifUnresponsive: true }); break;
      case NodeType.CheckCondition: Object.assign(baseData, { label: `Check Condition${suffix}`, conditions: [{ id: `cg-${Date.now()}`, name: 'Block-1', rules: [{ id: `cr-${Date.now()}`, attribute: 'Name', operator: 'is', value: '' }] }] }); break;
      case NodeType.Gsheet: baseData.spreadsheetId = ''; baseData.sheetName = ''; baseData.action = 'READ'; baseData.range = 'A1'; break;
      case NodeType.Code: baseData.code = '// Your code here'; break;
      case NodeType.CatalogueMessage: baseData.header = ''; baseData.body = ''; baseData.items = []; break;
      case NodeType.Appointment: baseData.calendarId = ''; baseData.durationMinutes = 30; break;
      case NodeType.ManageCart: baseData.action = 'ADD'; baseData.productId = ''; baseData.quantity = 1; break;
      case NodeType.Payment: baseData.provider = ''; baseData.amount = 10; baseData.currency = 'USD'; break;
      case NodeType.AskLocation: baseData.text = 'Please share your location.'; break;
      case NodeType.SendFlow: Object.assign(baseData, { label: `Send Flow${suffix}`, flowId: '', flowName: '', headerText: '', bodyText: 'Please complete this form', footerText: '', ctaText: 'Open Form', validateResponse: false, saveResponse: false, ifUnresponsive: false, saveResponseAttribute: 'None', saveResponseNewAttribute: '', unresponsiveTimeout: '10 min' }); break;
      case NodeType.Switch: Object.assign(baseData, { label: `Switch${suffix}`, cases: [{ id: `case-${Date.now()}-1`, label: 'Case 1', condition: { id: `rule-${Date.now()}`, attribute: '', operator: 'is', value: '' } }] }); break;
      case NodeType.ContactPipeline: Object.assign(baseData, { label: `Update Stage${suffix}`, name: '', email: '', pipelineId: '', stageId: '', outputVariableName: '' }); break;
      case NodeType.Gmail: baseData.connectionId = ''; baseData.to = ''; baseData.subject = ''; baseData.body = ''; break;
      case NodeType.NewLead: baseData.label = `New Lead${suffix}`; break;
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
  }, [screenToWorld, nodes]); // Added nodes dependency for counting

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

  const deleteEdge = (edgeId: string) => {
    setEdges(prev => prev.filter(e => e.id !== edgeId));
  };

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

  const duplicateNode = useCallback((nodeId: string) => {
    const nodeToDuplicate = nodes.find(n => n.id === nodeId);
    if (!nodeToDuplicate) return;

    const newId = `${nodeToDuplicate.type}-${Date.now()}`;
    const offset = 50;
    const newNode: Node = {
      ...nodeToDuplicate,
      id: newId,
      position: {
        x: nodeToDuplicate.position.x + offset,
        y: nodeToDuplicate.position.y + offset
      },
      data: JSON.parse(JSON.stringify(nodeToDuplicate.data)) // Deep copy data
    };

    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newId); // Select the new node
  }, [nodes]);

  if (loading) return <div className="h-full w-full flex items-center justify-center bg-slate-900 text-white"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-2"></div>Loading Flow...</div>;

  return (
    <div className="h-full w-full flex flex-col font-sans bg-slate-950 text-white relative overflow-hidden">
      {/* Header */}
      <div className="z-30 px-4 py-3 shrink-0">
        <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 pointer-events-auto shadow-2xl ring-1 ring-white/5">
          <div className="flex items-center w-full sm:w-auto relative z-40 gap-4">
            <button onClick={onBack} className="group flex items-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 shadow-sm" title="Back to Dashboard">
              <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="font-bold text-sm hidden sm:inline">Back</span>
            </button>

            <div className="h-10 w-px bg-slate-800 hidden sm:block"></div>

            <div className="flex-1 sm:flex-none relative min-w-[200px]">
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mb-1 ml-1">Flow Name</label>
              {isEditingName ? (
                <div className="relative">
                  <input
                    type="text"
                    value={flowName}
                    onChange={(e) => setFlowName(e.target.value)}
                    onBlur={() => setIsEditingName(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                    autoFocus
                    className="block w-full bg-slate-950 text-white font-bold text-lg focus:outline-none border-2 border-brand-500 rounded-lg placeholder-slate-600 px-3 py-2 shadow-inner transition-all"
                    placeholder="Untitled Flow"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-500 font-bold animate-pulse">EDITING</div>
                </div>
              ) : (
                <div className="group flex items-center cursor-pointer py-2 px-3 -ml-2 rounded-lg hover:bg-slate-800/50 border border-transparent hover:border-slate-700/50 transition-all" onClick={() => setIsEditingName(true)}>
                  <h1 className="font-bold text-xl text-white truncate max-w-[200px] sm:max-w-sm mr-3 tracking-tight">{flowName}</h1>
                  <div className="bg-slate-800 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-all transform scale-90 group-hover:scale-100 border border-slate-700">
                    <EditIcon className="w-3.5 h-3.5 text-brand-400" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end bg-slate-800/30 p-1.5 rounded-xl border border-slate-800/50">
            <div className="flex items-center gap-2 px-2">
              <span className={`text-[10px] font-black uppercase tracking-wider transition-colors ${flowStatus === 'Published' ? 'text-emerald-400' : 'text-slate-500'}`}>{flowStatus}</span>
              <button onClick={() => setFlowStatus(s => s === 'Draft' ? 'Published' : 'Draft')} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all focus:outline-none border-2 ${flowStatus === 'Published' ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-700 border-slate-600'}`} title={`Switch to ${flowStatus === 'Draft' ? 'Published' : 'Draft'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${flowStatus === 'Published' ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="h-8 w-px bg-slate-700/50 hidden sm:block"></div>

            <button onClick={handleSave} disabled={saving} className={`flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-brand-900/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-b-2 border-brand-800 hover:border-brand-700 active:border-t-2 active:border-b-0`}>
              {saving ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div><span>Saving...</span></>) : (<span>Save & Exit</span>)}
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className={`${notification.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white px-4 py-2 rounded-full shadow-xl text-sm font-medium animate-fade-in flex items-center gap-2`}>
            {notification.message}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`absolute inset-y-0 left-0 z-30 transform transition-all duration-300 ease-in-out bg-slate-900 shadow-2xl border-r border-slate-800 h-full ${isNodesPanelOpen ? 'translate-x-0' : '-translate-x-full'} md:relative ${isNodesPanelOpen ? 'md:w-72 md:translate-x-0' : 'md:w-0 md:border-none md:overflow-hidden'}`}>
          <div className="w-72 h-full">
            <NodesPanel onAddNode={(type) => addNode(type)} onClose={() => setIsNodesPanelOpen(false)} />
          </div>
        </div>

        {isNodesPanelOpen && <div className="absolute inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm" onClick={() => setIsNodesPanelOpen(false)} />}

        <div ref={canvasWrapperRef} className={`flex-1 relative h-full overflow-hidden flex flex-col transition-colors duration-200 bg-slate-950`} onWheel={handleWheel}>
          <div className="absolute inset-0 z-0">
            <Canvas nodes={nodes} edges={edges} connectingSource={connectingSource} connectionLine={connectionLine} viewport={viewport} onNodeDragStart={handleNodeDragStart} onNodeTouchStart={handleNodeDragStart} onCanvasMouseDown={handleCanvasStart} onCanvasTouchStart={handleCanvasStart} onUpdateNode={updateNodeData} onDeleteNode={deleteNode} onDeleteEdge={deleteEdge} onDuplicateNode={duplicateNode} onSourceHandleMouseDown={handleSourceHandleStart} onSourceHandleTouchStart={handleSourceHandleStart} onNodeSettingsClick={(nodeId) => setSelectedNodeId(nodeId)} onNodeClick={() => { }} onNodeMouseUp={handleCompleteConnection} onDragOver={onDragOver} onDrop={onDrop} />
            <Navigation zoom={viewport.zoom} onZoomIn={() => setViewport(p => ({ ...p, zoom: Math.min(p.zoom + 0.2, 3) }))} onZoomOut={() => setViewport(p => ({ ...p, zoom: Math.max(p.zoom - 0.2, 0.1) }))} onFitView={() => setViewport({ x: 0, y: 0, zoom: 1 })} className="absolute bottom-6 right-6 md:bottom-8 md:left-8" />
          </div>
        </div>

        {!isNodesPanelOpen && (
          <button onClick={() => setIsNodesPanelOpen(true)} className="absolute bottom-24 left-6 w-14 h-14 bg-brand-600 text-white rounded-full shadow-2xl shadow-brand-900/50 flex items-center justify-center z-50 hover:bg-brand-500 active:scale-90 transition-all border-2 border-white/10" title="Open Components">
            <PlusIcon className="w-8 h-8" />
          </button>
        )}

        {selectedNode && <SettingsPanel selectedNode={selectedNode} nodes={nodes} edges={edges} onUpdateNode={updateNodeData} onClose={() => setSelectedNodeId(null)} onShowNotification={showNotification} />}
      </div>
    </div>
  );
};

export default FlowEditor;
