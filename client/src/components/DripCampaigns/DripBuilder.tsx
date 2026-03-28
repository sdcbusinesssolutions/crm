import React, { useState, useEffect, useRef, useCallback } from 'react';
import { dripCampaignService, DripCampaign, DripStep } from '../../services/dripCampaignService';
import { integrationsService } from '../../services/integrationsService';
import { tagService } from '../../services/tagService';
import { pipelineService } from '../../services/pipelineService';
import { supabase } from '../../lib/supabase';
import {
    ArrowLeftIcon,
    SettingsIcon,
    PlusIcon,
    TrashIcon,
    MessageIcon,
    ClockIcon,
    CheckIcon,
    ChevronDownIcon,
    PlayIcon,
    SparklesIcon,
    TriggerIcon
} from '../icons';

// --- Per-campaign in-memory cache (60s TTL) ---
const BUILDER_CACHE_TTL_MS = 60_000;
const _builderCache = new Map<string, { data: DripCampaign; timestamp: number }>();

// --- Types ---
interface DripBuilderProps {
    campaignId: string | null;
    initialCampaignName?: string;
    onBack: () => void;
}

// --- Sub-components for Performance (Isolated State) ---

const DripCanvas = React.memo(({
    campaign,
    selectedStep,
    showCampaignSettings,
    showAddMenu,
    onSelectStep,
    onSelectCampaignSettings,
    onToggleAddMenu,
    onAddStep,
    onDeleteStep,
    DripNode
}: any) => {
    const [viewport, setViewport] = useState({ x: 0, y: 50, zoom: 1 });
    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setViewport(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    }, []);

    const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            const zoomDelta = -e.deltaY * 0.001;
            setViewport(p => ({ ...p, zoom: Math.min(Math.max(p.zoom + zoomDelta, 0.1), 3) }));
        } else {
            setViewport(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    }, []);

    return (
        <div
            ref={canvasRef}
            className="flex-1 bg-slate-50/10 relative cursor-grab active:cursor-grabbing border-r border-[#00684a]"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            {/* Dot Background */}
            <div className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle, #D1D1D1 1px, transparent 1px)',
                    backgroundSize: `${25 * viewport.zoom}px ${25 * viewport.zoom}px`,
                    backgroundPosition: `${viewport.x}px ${viewport.y}px`
                }}
            />

            {/* Transform Layer */}
            <div
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                    transformOrigin: '0 0',
                    width: '100%',
                    minHeight: '100%'
                }}
                className="w-full relative flex flex-col items-center py-32"
            >
                <div className="flex flex-col items-center relative gap-0 w-[400px]">

                    {/* Campaign Settings Node */}
                    <div
                        onClick={onSelectCampaignSettings}
                        className={`group relative z-10 w-80 bg-white rounded-xl overflow-hidden shadow-xl transition-all cursor-pointer border-2 ${showCampaignSettings ? 'ring-4 ring-brand-500/10 border-brand-500 scale-[1.02]' : 'border-slate-200 hover:border-amber-400 hover:shadow-2xl hover:-translate-y-1'}`}
                    >
                        <div className="bg-amber-500 px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <SettingsIcon className="w-3.5 h-3.5 text-white" />
                                <h3 className="font-black text-white text-[10px] uppercase tracking-widest">Campaign Start</h3>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse"></div>
                        </div>
                        <div className="p-4 flex items-center gap-4 bg-white">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100 shadow-inner">
                                <TriggerIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] text-slate-400 font-black uppercase mb-0.5 tracking-tighter">Trigger Event</div>
                                <div className="text-[13px] text-slate-900 font-bold truncate">
                                    {campaign.trigger_type?.replace(/_/g, ' ')}
                                </div>
                            </div>
                        </div>
                        {/* Output Handle */}
                        <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full z-20 shadow-md border-2 border-slate-300"></div>
                    </div>

                    {/* Connecting Line */}
                    <div className="w-[1px] h-12 bg-slate-300"></div>

                    {/* Steps */}
                    {[...(campaign.steps || [])].sort((a: any, b: any) => a.step_order - b.step_order).map((step: any) => (
                        <React.Fragment key={step.id}>
                            {/* Delay Connector */}
                            <div className="flex flex-col items-center">
                                <div className="flex items-center justify-center">
                                    {/* Delay Node */}
                                    <div className="relative z-10 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0 shadow-sm flex items-center gap-2 hover:border-[#00684a] hover:text-[#00684a] transition-all cursor-pointer group/delay"
                                        onClick={() => onSelectStep(step)}
                                    >
                                        <ClockIcon className="w-3 h-3 text-slate-400 group-hover/delay:text-[#00684a]" />
                                        <span>Wait {step.delay_value} {step.delay_unit?.toLowerCase()}</span>
                                    </div>
                                </div>
                                <div className="w-[1px] h-12 bg-slate-300"></div>
                            </div>

                            {/* Action Node */}
                            <DripNode 
                                step={step} 
                                isSelected={selectedStep?.id === step.id} 
                                onClick={() => onSelectStep(step)}
                                onDelete={onDeleteStep}
                            />

                            {/* Final Connecting Line */}
                            <div className="w-[1px] h-12 bg-slate-300"></div>
                        </React.Fragment>
                    ))}

                    {/* Add Button */}
                    <div className="relative z-10 group">
                        <button
                            onClick={onToggleAddMenu}
                            className="w-12 h-12 rounded-full bg-white border border-slate-200 hover:border-[#00684a] hover:bg-slate-50 text-slate-400 hover:text-[#00684a] flex items-center justify-center transition-all shadow-xl group flex flex-col gap-0.5 ring-4 ring-transparent hover:ring-[#00684a]/10"
                        >
                            <PlusIcon className="w-6 h-6 transition-transform group-hover:rotate-90" />
                        </button>
                        {showAddMenu && (
                            <div className="absolute top-14 left-1/2 -translate-x-1/2 w-48 bg-white border border-slate-200 rounded-xl shadow-2xl p-1 z-50">
                                <button 
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onAddStep('WHATSAPP_MESSAGE'); }} 
                                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#00684a] flex items-center gap-3 transition-colors"
                                >
                                    <MessageIcon className="w-4 h-4 text-[#00684a]" /> WhatsApp
                                </button>
                                <button 
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onAddStep('EMAIL'); }} 
                                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 flex items-center gap-3 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    Email
                                </button>
                                <button 
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => { e.stopPropagation(); onAddStep('AI_INTENT'); }} 
                                    className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                                >
                                    <SparklesIcon className="w-4 h-4 text-indigo-500" /> AI Intent
                                </button>
                            </div>
                        )}
                    </div>

                    {/* End line fade */}
                    <div className="w-[1px] h-32 bg-gradient-to-b from-slate-300 to-transparent"></div>
                </div>
            </div>

            {/* Navigation Controls */}
            <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-white rounded-lg border border-slate-200 p-1 shadow-xl z-30">
                <button onClick={() => setViewport(v => ({ ...v, zoom: Math.min(v.zoom + 0.1, 3) }))} className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded font-bold w-9 h-9 flex items-center justify-center transition-all border border-slate-100" title="Zoom In">+</button>
                <button onClick={() => setViewport(v => ({ ...v, zoom: Math.min(Math.max(v.zoom - 0.1, 0.1), 3) }))} className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded font-bold w-9 h-9 flex items-center justify-center transition-all border border-slate-100" title="Zoom Out">-</button>
                <div className="h-px bg-slate-200 my-0.5"></div>
                <button onClick={() => setViewport({ x: 0, y: 50, zoom: 1 })} className="p-2 bg-white hover:bg-slate-50 text-slate-600 rounded font-bold w-9 h-9 flex items-center justify-center transition-all text-[10px] uppercase border border-slate-100" title="Reset View">Fit</button>
            </div>
        </div>
    );
});

const DripBuilder: React.FC<DripBuilderProps> = ({ campaignId, initialCampaignName, onBack }) => {
    // --- State: Data ---
    // Seed immediately from cache if available — single render, no flash, no skeleton
    const [campaign, setCampaign] = useState<Partial<DripCampaign>>(() => {
        if (campaignId) {
            const cached = _builderCache.get(campaignId);
            if (cached && Date.now() - cached.timestamp < BUILDER_CACHE_TTL_MS) {
                return cached.data; // instant — no API call needed
            }
        }
        return {
            name: initialCampaignName || (campaignId ? '' : 'New Sequence'),
            description: '',
            trigger_type: 'MANUAL',
            trigger_value: '',
            status: 'DRAFT',
            stop_on_reply: true,
            steps: [],
            allowed_days: '0,1,2,3,4,5,6',
            time_window_start: '09:00',
            time_window_end: '18:00'
        };
    });
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [gmailConnections, setGmailConnections] = useState<any[]>([]);
    const [smtpConnections, setSmtpConnections] = useState<any[]>([]);
    const [openaiConnections, setOpenaiConnections] = useState<any[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [availableStages, setAvailableStages] = useState<any[]>([]);

    // --- State: UI ---
    // If campaign is already in cache, skip loading state entirely
    const isCacheHit = campaignId
        ? (() => { const c = _builderCache.get(campaignId); return !!(c && Date.now() - c.timestamp < BUILDER_CACHE_TTL_MS); })()
        : false;
    const [loading, setLoading] = useState(campaignId ? !isCacheHit : false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [activeTab, setActiveTab] = useState<'BUILDER' | 'ENROLLMENTS'>('BUILDER');
    const [selectedStep, setSelectedStep] = useState<DripStep | null>(null);
    const [showCampaignSettings, setShowCampaignSettings] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
    const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
    const templateDropdownRef = useRef<HTMLDivElement>(null);

    // --- Effects ---
    // Effect 1: Campaign data (CRITICAL PATH - fires only when campaignId changes)
    useEffect(() => {
        if (campaignId) {
            loadCampaign(campaignId);
        }
    }, [campaignId]);

    // Effect 2: Secondary data (NON-CRITICAL - loads after paint, not blocking UI)
    useEffect(() => {
        // Use requestIdleCallback to defer non-critical data loads
        // so that the critical canvas path renders immediately
        const load = () => {
            loadTemplates();
            loadEmailConnections();
            loadMetadata();
        };
        if ('requestIdleCallback' in window) {
            const id = (window as any).requestIdleCallback(load, { timeout: 1500 });
            return () => (window as any).cancelIdleCallback(id);
        } else {
            // Fallback: defer with setTimeout
            const t = setTimeout(load, 200);
            return () => clearTimeout(t);
        }
    }, []); // Only once on mount

    // Effect 3: Tab-specific data (only fires when tab changes to ENROLLMENTS)
    useEffect(() => {
        if (activeTab === 'ENROLLMENTS' && campaignId) {
            loadEnrollments();
        }
    }, [activeTab, campaignId]);

    // --- Loaders ---
    const loadMetadata = useCallback(async () => {
        try {
            // Fire tags and pipelines in parallel
            const [tags, pipelines] = await Promise.all([
                tagService.getTags().catch(() => []),
                pipelineService.getPipelines().catch(() => [])
            ]);
            setAvailableTags(tags.map((t: any) => t.name));

            // Fetch ALL pipeline stages in parallel (fixes N+1 sequential loop)
            const stageArrays = await Promise.all(
                pipelines.map((p: any) =>
                    pipelineService.getPipelineStages(p.id)
                        .then((s: any[]) => s.map(stage => ({ ...stage, pipelineName: p.name })))
                        .catch(() => [])
                )
            );
            setAvailableStages(stageArrays.flat());
        } catch (e) { console.error('Failed to load metadata', e); }
    }, []);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (templateDropdownRef.current && !templateDropdownRef.current.contains(event.target as Node)) {
                setTemplateDropdownOpen(false);
            }
        };
        if (templateDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [templateDropdownOpen]);

    const loadCampaign = async (id: string) => {
        // Check cache first
        const cached = _builderCache.get(id);
        if (cached && Date.now() - cached.timestamp < BUILDER_CACHE_TTL_MS) {
            setCampaign(cached.data);
            setLoading(false);
            return; // instant — skip API
        }
        setLoading(true);
        try {
            const data = await dripCampaignService.getCampaign(id);
            _builderCache.set(id, { data, timestamp: Date.now() }); // cache it
            setCampaign(data);
        } catch (e) {
            console.error('Failed to load campaign', e);
        } finally {
            setLoading(false);
        }
    };

    const loadEnrollments = async () => {
        if (!campaignId) return;
        try {
            const data = await dripCampaignService.getEnrollments(campaignId);
            setEnrollments(data || []);
        } catch (e) { console.error(e); }
    };

    const loadTemplates = async () => {
        try {
            const { data: { session } } = await import('../../lib/supabase').then(m => m.supabase.auth.getSession());
            if (!session) return;
            const res = await fetch('/api/whatsapp/templates', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
            if (res.ok) {
                const json = await res.json();
                setTemplates(json.data || []);
            }
        } catch (e) { console.error(e); }
    };

    const loadEmailConnections = useCallback(async () => {
        try {
            const [gmail, smtp, openai] = await Promise.all([
                integrationsService.getGmailConnections().catch(() => []),
                integrationsService.getSmtpConnections().catch(() => []),
                integrationsService.getOpenAIConnections().catch(() => [])
            ]);
            setGmailConnections(gmail || []);
            setSmtpConnections(smtp || []);
            setOpenaiConnections(openai || []);
        } catch (e) { console.error(e); }
    }, []);

    // --- Actions ---
    const handleSaveCampaign = async (exitAfterSave = true) => {
        if (loading) return;
        setLoading(true);
        try {
            let currentCampaignId = campaignId;

            // 1. Create or Update the main Campaign metadata
            if (currentCampaignId) {
                await dripCampaignService.updateCampaign(currentCampaignId, campaign);
            } else {
                const createdComp = await dripCampaignService.createCampaign(campaign);
                currentCampaignId = createdComp.id;
            }

            // 2. Reconciliation of Steps (Manual Sync)
            if (currentCampaignId) {
                // a. Delete removed steps
                for (const stepId of deletedStepIds) {
                    await dripCampaignService.deleteStep(currentCampaignId, stepId).catch(err => console.error("Step deletion error:", err));
                }

                // b. Create/Update remaining steps
                if (campaign.steps && campaign.steps.length > 0) {
                    for (const step of campaign.steps) {
                        const isTempId = step.id.startsWith('temp_');
                        if (isTempId) {
                            // Create new step (omit temp ID)
                            const { id, ...stepData } = step;
                            await dripCampaignService.createStep(currentCampaignId, stepData);
                        } else {
                            // Update existing step
                            await dripCampaignService.updateStep(currentCampaignId, step.id, step);
                        }
                    }
                }
            }

            // Invalidate cache so next open fetches fresh post-save data
            if (currentCampaignId) _builderCache.delete(currentCampaignId);

            if (exitAfterSave) onBack();
        } catch (e) {
            console.error('Failed to save drip campaign:', e);
            alert('Failed to save. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStep = useCallback((type: 'WHATSAPP_MESSAGE' | 'EMAIL' | 'AI_INTENT') => {
        const newId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newStep: DripStep = {
            id: newId,
            campaign_id: campaignId || '',
            step_order: Math.max(...(campaign.steps || []).map(s => s.step_order || 0), 0) + 1,
            step_type: type,
            step_config: type === 'EMAIL' ? { provider: 'GMAIL' } : type === 'AI_INTENT' ? { intents: ['INTERESTED', 'NOT_INTERESTED', 'LATER', 'QUESTION'] } : {},
            delay_value: 1,
            delay_unit: 'DAYS'
        };

        setCampaign(prev => ({
            ...prev,
            steps: [...(prev.steps || []), newStep]
        }));
        
        setSelectedStep(newStep);
        setShowCampaignSettings(false);
        setShowAddMenu(false);
    }, [campaignId, campaign.steps]);

    const handleUpdateStep = useCallback((stepId: string, updates: Partial<DripStep>) => {
        setCampaign(prev => {
            const updatedSteps = prev.steps?.map(s => s.id === stepId ? { ...s, ...updates } : s);
            return { ...prev, steps: updatedSteps };
        });
        
        // Also update selectedStep if it's the one being modified to keep sidebar in sync
        setSelectedStep(prev => (prev?.id === stepId ? { ...prev, ...updates } : prev));
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, stepId: string, location: 'HEADER' | 'CAROUSEL', cardIndex?: number) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploadingMedia(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No session');

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                const step = campaign.steps?.find(s => s.id === stepId);
                if (step) {
                    const currentParams = step.step_config?.parameters || {};
                    if (location === 'HEADER') {
                        handleUpdateStep(stepId, {
                            step_config: { ...step.step_config, parameters: { ...currentParams, header: { type: currentParams.header?.type || 'IMAGE', url: data.url } } }
                        });
                    } else if (location === 'CAROUSEL' && cardIndex !== undefined) {
                        const currentCarousel = currentParams.carousel || {};
                        currentCarousel[cardIndex] = data.url;
                        handleUpdateStep(stepId, {
                            step_config: { ...step.step_config, parameters: { ...currentParams, carousel: currentCarousel } }
                        });
                    }
                }
            } else {
                alert('Upload failed: ' + data.error);
            }
        } catch (err: any) {
            alert('Upload error: ' + err.message);
        } finally {
            setUploadingMedia(false);
        }
    };

    const handleDeleteStep = useCallback((stepId: string) => {

        // MANUAL MODE: Remove from local state and track if it was a DB record
        const stepToDelete = campaign.steps?.find(s => s.id === stepId);
        if (stepToDelete && !stepToDelete.id.startsWith('temp_')) {
            setDeletedStepIds(prev => [...prev, stepId]);
        }

        setCampaign(prev => {
            const remainingSteps = prev.steps?.filter(s => s.id !== stepId)
                .map((s, idx) => ({ ...s, step_order: idx + 1 })); // Maintain order
            return { ...prev, steps: remainingSteps };
        });

        setSelectedStep(null);
    }, [campaign.steps]);

    const handleStopEnrollment = async (id: string) => {
        if (!window.confirm("Stop this sequence?")) return;
        try {
            await dripCampaignService.stopEnrollment(id);
            loadEnrollments();
        } catch (e) { alert("Failed"); }
    };

    const handleDeleteEnrollment = async (id: string) => {
        if (!window.confirm("Delete this enrollment record?")) return;
        try {
            await dripCampaignService.deleteEnrollment(id);
            loadEnrollments();
        } catch (e) { alert("Failed"); }
    };

    const handleExportJSON = () => {
        const exportData = {
            ...campaign,
            export_at: new Date().toISOString(),
            version: '2.0'
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${campaign.name?.replace(/\s+/g, '_') || 'campaign'}_export.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // --- Internal Memoized Components ---
    const MemoizedDripNode = React.useMemo(() => React.memo(({ step, isSelected, onClick, onDelete }: any) => (
        <div
            onClick={onClick}
            className={`relative z-10 w-80 bg-white rounded-xl overflow-hidden shadow-xl transition-all cursor-pointer group border border-slate-200/60 border-l-4 ${isSelected
                ? 'ring-4 ring-[#00684a]/15 scale-[1.01] border-[#00684a]'
                : step.step_type === 'WHATSAPP_MESSAGE'
                    ? 'border-l-[#00684a]'
                    : step.step_type === 'EMAIL'
                        ? 'border-l-blue-500'
                        : 'border-l-indigo-500'
                }`}
        >
            {/* Header Bar */}
            <div className={`px-4 py-2.5 flex items-center justify-between border-b ${step.step_type === 'WHATSAPP_MESSAGE'
                ? 'bg-[#00684a] border-emerald-600/10'
                : step.step_type === 'EMAIL'
                    ? 'bg-blue-500 border-blue-600/10'
                    : 'bg-indigo-500 border-indigo-600/10'
                }`}>
                <div className="flex items-center gap-2 text-white">
                    {step.step_type === 'WHATSAPP_MESSAGE' ? <MessageIcon className="w-3.5 h-3.5" /> : step.step_type === 'EMAIL' ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> : <SparklesIcon className="w-3.5 h-3.5" />}
                    <h4 className="font-black text-[10px] uppercase tracking-widest leading-none">{step.step_type === 'WHATSAPP_MESSAGE' ? 'WhatsApp' : step.step_type === 'EMAIL' ? 'Email' : 'AI Analysis'}</h4>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(step.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 text-white rounded transition-all">
                    <TrashIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="p-4 flex items-center gap-4 bg-white">
                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center border shadow-inner ${step.step_type === 'WHATSAPP_MESSAGE'
                    ? 'bg-emerald-50 text-[#00684a] border-emerald-100'
                    : step.step_type === 'EMAIL'
                        ? 'bg-blue-50 text-blue-500 border-blue-100'
                        : 'bg-indigo-50 text-indigo-500 border-indigo-100'
                    }`}>
                    {step.step_type === 'WHATSAPP_MESSAGE' ? <MessageIcon className="w-5 h-5" /> : step.step_type === 'EMAIL' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> : <SparklesIcon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-400 font-black uppercase mb-0.5 tracking-tighter">Content / Template</div>
                    <p className="text-[13px] text-slate-900 font-bold truncate">
                        {step.step_config?.template_name || step.step_config?.subject || 'Configure Context...'}
                    </p>
                </div>
            </div>

            {/* Handles */}
            <div className="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full z-20 shadow-md border-2 border-slate-300 transition-all group-hover:scale-110"></div>
            <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3.5 h-3.5 bg-white rounded-full z-20 shadow-md border-2 border-slate-300 transition-all group-hover:scale-110"></div>
        </div>
    )), []);

    const daysMap = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // --- Renderers ---
    return (
        <div className="h-full w-full flex flex-col font-sans bg-white text-slate-900 overflow-hidden relative">
            {/* Header */}
            <div className="z-30 px-4 py-3 shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 hover:text-slate-900 transition-all border border-slate-200">
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="font-bold text-xs">Back</span>
                    </button>
                    <div>
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Campaign Builder</div>
                        <input
                            type="text"
                            value={campaign.name || ''}
                            onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                            className="bg-transparent border-none text-slate-900 font-bold text-lg focus:ring-0 p-0 placeholder-slate-400 w-64"
                            placeholder="Untitled Campaign"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setActiveTab('BUILDER')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'BUILDER' ? 'bg-slate-200 text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Graph
                    </button>
                    <button
                        onClick={() => setActiveTab('ENROLLMENTS')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'ENROLLMENTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Enrollments
                    </button>
                    <div className="w-px h-4 bg-slate-300 mx-1"></div>
                    <button
                        onClick={handleExportJSON}
                        className="px-4 py-1.5 text-slate-500 hover:text-slate-900 text-xs font-bold transition-all flex items-center gap-2"
                        title="Export this campaign as a JSON file"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Toggle */}
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 mr-2">
                        <button
                            onClick={() => setCampaign({ ...campaign, status: 'DRAFT' })}
                            className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${campaign.status === 'DRAFT' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'DRAFT' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}></div>
                            Draft
                        </button>
                        <button
                            onClick={() => setCampaign({ ...campaign, status: 'ACTIVE' })}
                            className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${campaign.status === 'ACTIVE' ? 'bg-white text-[#00684a] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'ACTIVE' ? 'bg-[#00684a] animate-pulse' : 'bg-slate-300'}`}></div>
                            Publish
                        </button>
                    </div>

                    <button
                        onClick={() => handleSaveCampaign(true)}
                        disabled={loading}
                        className="px-6 py-2.5 bg-[#00684a] hover:bg-[#005c42] text-white rounded-xl font-bold shadow-lg shadow-[#00684a]/20 transform active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : (campaign.status === 'ACTIVE' ? 'Publish & Exit' : 'Save & Exit')}
                    </button>
                </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-1 relative overflow-hidden flex">
                {/* === LOADING OVERLAY: Semi-transparent to keep context === */}
                {loading && (
                    <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[1px] flex items-center justify-center transition-all duration-300">
                        <div className="bg-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-200 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-[#00684a] animate-spin"></div>
                            <div className="flex flex-col items-center">
                                <h3 className="text-sm font-bold text-slate-900">{campaign.id ? 'Saving Changes...' : 'Initializing Builder...'}</h3>
                                <p className="text-[11px] text-slate-500 font-medium">Please wait a moment</p>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* === INITIAL LOAD SKELETON: Only when no data exists === */}
                {!campaign.id && loading && (
                    <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-start pt-24 pointer-events-none">
                        {/* Animated shimmer nodes that mimic the canvas */}
                        <div className="flex flex-col items-center gap-0">
                            {/* Start node skeleton */}
                            <div className="w-[220px] h-[60px] rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
                            <div className="w-px h-8 bg-slate-200" />
                            {/* Step skeletons */}
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex flex-col items-center">
                                    <div
                                        className="w-[180px] h-[28px] rounded-full bg-slate-50 border border-slate-200 animate-pulse"
                                        style={{ animationDelay: `${i * 0.12}s` }}
                                    />
                                    <div className="w-px h-4 bg-slate-200" />
                                    <div
                                        className="w-[220px] h-[60px] rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
                                        style={{ animationDelay: `${i * 0.12}s` }}
                                    />
                                    {i < 3 && <div className="w-px h-4 bg-slate-200" />}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {activeTab === 'ENROLLMENTS' ? (
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                        <div className="max-w-5xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                                <h3 className="font-bold text-slate-800">Active Enrollments ({enrollments.length})</h3>
                                <button onClick={loadEnrollments} className="text-xs font-bold text-brand-600 hover:text-brand-700">Refresh</button>
                            </div>
                            <table className="w-full text-left text-sm text-slate-600">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Step</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {enrollments.map(en => (
                                        <tr key={en.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900">{en.contact?.name}<div className="text-xs text-slate-500">{en.contact?.phone}</div></td>
                                            <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold border ${en.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{en.status}</span></td>
                                            <td className="px-6 py-4">{en.current_step?.step_order || '-'}</td>
                                            <td className="px-6 py-4 flex gap-3">
                                                <button onClick={() => handleStopEnrollment(en.id)} className="text-amber-600 hover:text-amber-700 text-xs font-bold">Stop</button>
                                                <button onClick={() => handleDeleteEnrollment(en.id)} className="text-red-600 hover:text-red-700 text-xs font-bold">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Canvas Area */}
                        <DripCanvas
                            campaign={campaign}
                            selectedStep={selectedStep}
                            showCampaignSettings={showCampaignSettings}
                            showAddMenu={showAddMenu}
                            onSelectStep={(step: any) => { setSelectedStep(step); setShowCampaignSettings(false); }}
                            onSelectCampaignSettings={() => { setShowCampaignSettings(true); setSelectedStep(null); }}
                            onToggleAddMenu={() => setShowAddMenu(prev => !prev)}
                            onAddStep={handleAddStep}
                            onDeleteStep={handleDeleteStep}
                            DripNode={MemoizedDripNode}
                        />

                        {/* Settings Overlay Sidebar */}
                        <div className={`w-96 border-l border-slate-200 bg-white absolute right-0 top-0 bottom-0 h-full flex flex-col transition-transform duration-300 shadow-2xl z-40 ${selectedStep || showCampaignSettings ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200">
                                <h3 className="font-bold text-slate-900 text-lg">{showCampaignSettings ? 'Campaign Settings' : 'Step Settings'}</h3>
                                <button onClick={() => { setSelectedStep(null); setShowCampaignSettings(false); }} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/50">
                                {showCampaignSettings && (
                                    <div className="space-y-6 text-slate-700">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trigger Event</label>
                                            <select
                                                value={campaign.trigger_type}
                                                onChange={(e) => setCampaign({ ...campaign, trigger_type: e.target.value as any })}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none shadow-sm"
                                            >
                                                <option value="TAG_ADDED">Tag Added</option>
                                                <option value="pipeline_STAGE_CHANGED">Stage Changed</option>
                                                <option value="MANUAL">Follow-up / Manual</option>
                                            </select>
                                        </div>
                                        {campaign.trigger_type !== 'MANUAL' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trigger Value</label>
                                                {campaign.trigger_type === 'TAG_ADDED' ? (
                                                    <select
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign({ ...campaign, trigger_value: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                    >
                                                        <option value="">Select Tag...</option>
                                                        {availableTags.map((t, i) => <option key={i} value={t}>{t}</option>)}
                                                    </select>
                                                ) : campaign.trigger_type === 'pipeline_STAGE_CHANGED' ? (
                                                    <select
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign({ ...campaign, trigger_value: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                    >
                                                        <option value="">Select Stage...</option>
                                                        {availableStages.map(s => (
                                                            <option key={s.id} value={s.id}>{s.pipelineName} - {s.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign({ ...campaign, trigger_value: e.target.value })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                        placeholder="Trigger Value"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delivery Window</label>
                                            <div className="flex items-center gap-2 mb-2">
                                                <input type="time" value={campaign.time_window_start} onChange={e => setCampaign({ ...campaign, time_window_start: e.target.value })} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 shadow-sm" />
                                                <span className="text-xs text-slate-500">to</span>
                                                <input type="time" value={campaign.time_window_end} onChange={e => setCampaign({ ...campaign, time_window_end: e.target.value })} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 shadow-sm" />
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {daysMap.map((d, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => {
                                                            const arr = (campaign.allowed_days || '').split(',').map(n => n.trim()).filter(Boolean);
                                                            const exists = arr.includes(String(i));
                                                            const n = exists ? arr.filter(x => x !== String(i)) : [...arr, String(i)];
                                                            setCampaign({ ...campaign, allowed_days: n.join(',') });
                                                        }}
                                                        className={`w-6 h-6 rounded text-[10px] font-bold transition-all ${((campaign.allowed_days || '').includes(String(i))) ? 'bg-brand-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-slate-200">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input type="checkbox" checked={campaign.stop_on_reply} onChange={e => setCampaign({ ...campaign, stop_on_reply: e.target.checked })} className="rounded bg-white border-slate-200 text-brand-600 focus:ring-0" />
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Stop on Reply</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input type="checkbox" checked={campaign.allow_reentry} onChange={e => setCampaign({ ...campaign, allow_reentry: e.target.checked })} className="rounded bg-white border-slate-200 text-brand-600 focus:ring-0" />
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900">Allow Re-entry</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {selectedStep && (
                                    <div className="space-y-8 text-slate-600">
                                        {/* Delay Section */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">1</div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-400">Wait Duration</h4>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={selectedStep.delay_value || 0}
                                                    onChange={(e) => handleUpdateStep(selectedStep.id, { delay_value: parseInt(e.target.value) || 0 })}
                                                    className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-center font-bold text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                />
                                                <select
                                                    value={selectedStep.delay_unit || 'HOURS'}
                                                    onChange={(e) => handleUpdateStep(selectedStep.id, { delay_unit: e.target.value as any })}
                                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 font-bold text-sm text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                >
                                                    <option value="MINUTES">Minutes</option>
                                                    <option value="HOURS">Hours</option>
                                                    <option value="DAYS">Days</option>
                                                    <option value="WEEKS">Weeks</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Content Section */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">2</div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-500">Message Content</h4>
                                            </div>

                                            {selectedStep.step_type === 'WHATSAPP_MESSAGE' && (
                                                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                                                    {/* Delivery Helper Header */}
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 mb-2">
                                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                                            <span className="text-slate-400">Recipient (To)</span>
                                                            <span className="text-emerald-600 font-mono">Enrolled Contact</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                                            <span className="text-slate-400">Sender (From)</span>
                                                            <span className="text-emerald-600 font-mono">System Number</span>
                                                        </div>
                                                    </div>
                                                        <div className="relative" ref={templateDropdownRef}>
                                                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 ml-1">WhatsApp Template</div>
                                                            <button
                                                                onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:border-brand-500 outline-none shadow-sm flex items-center justify-between hover:border-slate-300 transition-all text-left"
                                                            >
                                                                <span className="truncate">{selectedStep.step_config?.template_name || 'Select Template...'}</span>
                                                                <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${templateDropdownOpen ? 'rotate-180' : ''}`} />
                                                            </button>

                                                            {templateDropdownOpen && (
                                                                <div 
                                                                    className="absolute z-50 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden animate-fade-in"
                                                                >
                                                                    {/* Thick Scrollbar Utility CSS Injection */}
                                                                    <style>{`
                                                                        .custom-heavy-scroll::-webkit-scrollbar {
                                                                            width: 12px !important;
                                                                            height: 12px !important;
                                                                            display: block !important;
                                                                        }
                                                                        .custom-heavy-scroll::-webkit-scrollbar-track {
                                                                            background: #f1f5f9 !important;
                                                                            border-radius: 6px;
                                                                        }
                                                                        .custom-heavy-scroll::-webkit-scrollbar-thumb {
                                                                            background-color: #94a3b8 !important;
                                                                            border-radius: 6px;
                                                                            border: 3px solid #f1f5f9;
                                                                        }
                                                                        .custom-heavy-scroll::-webkit-scrollbar-thumb:hover {
                                                                            background-color: #64748b !important;
                                                                        }
                                                                        .custom-heavy-scroll {
                                                                            scrollbar-width: auto;
                                                                            scrollbar-color: #94a3b8 #f1f5f9;
                                                                        }
                                                                    `}</style>
                                                                    <div className="custom-heavy-scroll" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                                                        <div className="p-1 space-y-1">
                                                                            {templates.length === 0 && <div className="p-4 text-center text-xs text-slate-400">No templates found</div>}
                                                                            {templates.map(t => (
                                                                                <div
                                                                                    key={t.id}
                                                                                    onClick={() => {
                                                                                        handleUpdateStep(selectedStep.id, {
                                                                                            step_config: {
                                                                                                ...selectedStep.step_config,
                                                                                                template_id: t.id,
                                                                                                template_name: t.name,
                                                                                                template_language: t.language,
                                                                                                parameters: {} 
                                                                                            }
                                                                                        });
                                                                                        setTemplateDropdownOpen(false);
                                                                                    }}
                                                                                    className={`p-3 rounded-lg text-sm cursor-pointer transition-all flex items-center justify-between group ${
                                                                                        selectedStep.step_config?.template_id === t.id 
                                                                                        ? 'bg-brand-50 border border-brand-200 text-brand-600' 
                                                                                        : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                                                                                    }`}
                                                                                >
                                                                                    <div className="truncate pr-2">
                                                                                        <div className="font-bold truncate">{t.name}</div>
                                                                                        <div className="text-[10px] opacity-70 uppercase tracking-tighter">{t.language}</div>
                                                                                    </div>
                                                                                    {selectedStep.step_config?.template_id === t.id && <CheckIcon className="w-3.5 h-3.5 flex-shrink-0" />}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <p className="text-[9px] text-slate-400 mt-2 italic px-1">Tip: List is limited to 5 visible items. Scroll to see more.</p>
                                                        </div>

                                                    {/* Template Variable Mapping */}
                                                    {(() => {
                                                        const tpl = templates.find(t => t.id === selectedStep.step_config?.template_id);
                                                        if (!tpl) return null;

                                                        const components = tpl.components || [];
                                                        const header = components.find((c: any) => c.type === 'HEADER' || c.type === 'header');
                                                        const body = components.find((c: any) => c.type === 'BODY' || c.type === 'body');
                                                        const carousel = components.find((c: any) => c.type === 'CAROUSEL' || c.type === 'carousel');

                                                        // Parse Body Params ({{1}}, {{2}}) OR Carousel params
                                                        let bodyParamCount = 0;

                                                        if (body) {
                                                            const bodyText = body.text || '';
                                                            const bodyMatch = bodyText.match(/{{(\d+)}}/g) || [];
                                                            bodyParamCount = bodyMatch.length;
                                                        } else if (carousel) {
                                                            // If it's a carousel, check the first card's body for an idea of params per card
                                                            const firstCard = carousel.cards?.[0] || carousel.cards?.[0];
                                                            const cardBody = firstCard?.components?.find((c: any) => c.type === 'BODY' || c.type === 'body');
                                                            if (cardBody) {
                                                                const bodyText = cardBody.text || '';
                                                                const bodyMatch = bodyText.match(/{{(\d+)}}/g) || [];
                                                                bodyParamCount = bodyMatch.length;
                                                            }
                                                        }

                                                        return (
                                                            <div className="space-y-4 animate-fade-in">
                                                                {/* Header Mapping */}
                                                                {header && (
                                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                        <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase flex items-center gap-2">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                                                            Header ({header.format})
                                                                        </div>
                                                                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes((header.format || '').toUpperCase()) && (
                                                                            <div className="space-y-3">
                                                                                <div>
                                                                                    <div className="flex gap-2">
                                                                                        <input
                                                                                            type="file"
                                                                                            accept={(header.format || '').toUpperCase() === 'IMAGE' ? 'image/*' : (header.format || '').toUpperCase() === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                                                                                            onChange={(e) => handleFileUpload(e, selectedStep.id, 'HEADER')}
                                                                                            className="block w-full text-[10px] text-slate-400
                                                                                            file:mr-2 file:py-1 file:px-3
                                                                                            file:rounded-full file:border-0
                                                                                            file:text-[10px] file:font-bold
                                                                                            file:bg-brand-50 file:text-brand-600
                                                                                            hover:file:bg-brand-100
                                                                                            cursor-pointer"
                                                                                        />
                                                                                    </div>
                                                                                    {uploadingMedia && <p className="text-[10px] text-brand-500 font-bold animate-pulse mt-1">Uploading...</p>}
                                                                                </div>
                                                                                <div>
                                                                                    <label className="text-[10px] font-bold text-slate-400 mb-1 block">Or Direct URL</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                                                        placeholder={`https://example.com/file.${(header.format || '').toUpperCase() === 'IMAGE' ? 'jpg' : (header.format || '').toUpperCase() === 'VIDEO' ? 'mp4' : 'pdf'}`}
                                                                                        value={selectedStep.step_config?.parameters?.header?.url || ''}
                                                                                        onChange={(e) => {
                                                                                            const currentParams = selectedStep.step_config?.parameters || {};
                                                                                            handleUpdateStep(selectedStep.id, {
                                                                                                step_config: {
                                                                                                    ...selectedStep.step_config,
                                                                                                    parameters: {
                                                                                                        ...currentParams,
                                                                                                        header: { type: header.format, url: e.target.value }
                                                                                                    }
                                                                                                }
                                                                                            });
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {(header.format || '').toUpperCase() === 'TEXT' && header.text?.includes('{{1}}') && (
                                                                            <div>
                                                                                <label className="text-[10px] text-slate-500 mb-1 block">Header Variable {'{{1}}'}</label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                                                    placeholder="Enter value or {{contact.name}}"
                                                                                    value={selectedStep.step_config?.parameters?.header?.text || ''}
                                                                                    onChange={(e) => {
                                                                                        const currentParams = selectedStep.step_config?.parameters || {};
                                                                                        handleUpdateStep(selectedStep.id, {
                                                                                            step_config: {
                                                                                                ...selectedStep.step_config,
                                                                                                parameters: {
                                                                                                    ...currentParams,
                                                                                                    header: { type: 'TEXT', text: e.target.value }
                                                                                                }
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Carousel Display */}
                                                                {carousel && carousel.cards && (
                                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4 shadow-sm mt-4">
                                                                        <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2 uppercase">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                                            Carousel Cards Media
                                                                        </div>
                                                                        {carousel.cards.map((card: any, idx: number) => {
                                                                            const headerComp = card.components?.find((c: any) => c.type === 'HEADER' || c.type === 'header');
                                                                            const cardFormat = (headerComp?.format || 'IMAGE').toUpperCase();
                                                                            return (
                                                                                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                                                                                    <div className="flex justify-between items-center mb-2">
                                                                                        <span className="text-[10px] font-bold text-slate-400">Card {idx + 1} ({cardFormat})</span>
                                                                                    </div>
                                                                                    <div className="flex gap-2 mb-2">
                                                                                        <input
                                                                                            type="file"
                                                                                            accept={cardFormat === 'VIDEO' ? 'video/*' : 'image/*'}
                                                                                            onChange={(e) => handleFileUpload(e, selectedStep.id, 'CAROUSEL', idx)}
                                                                                            className="block w-full text-xs text-slate-400
                                                                                            file:mr-2 file:py-1 file:px-2
                                                                                            file:rounded-full file:border-0
                                                                                            file:text-[10px] file:font-bold
                                                                                            file:bg-indigo-600 file:text-white
                                                                                            hover:file:bg-indigo-500
                                                                                            cursor-pointer"
                                                                                        />
                                                                                    </div>
                                                                                    <input
                                                                                        type="text"
                                                                                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 outline-none shadow-sm"
                                                                                        value={selectedStep.step_config?.parameters?.carousel?.[idx] || ''}
                                                                                        onChange={(e) => {
                                                                                            const currentParams = selectedStep.step_config?.parameters || {};
                                                                                            const currentCarousel = currentParams.carousel || {};
                                                                                            currentCarousel[idx] = e.target.value;
                                                                                            handleUpdateStep(selectedStep.id, {
                                                                                                step_config: {
                                                                                                    ...selectedStep.step_config,
                                                                                                    parameters: {
                                                                                                        ...currentParams,
                                                                                                        carousel: currentCarousel
                                                                                                    }
                                                                                                }
                                                                                            });
                                                                                        }}
                                                                                        placeholder="Media URL"
                                                                                    />
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                )}

                                                                {/* Body Mapping */}
                                                                {bodyParamCount > 0 && (
                                                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                                        <div className="text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                                                            Body Variables
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            {Array.from({ length: bodyParamCount }).map((_, i) => (
                                                                                <div key={i}>
                                                                                    <label className="text-[10px] text-slate-500 mb-1 block">Variable {'{{' + (i + 1) + '}}'}</label>
                                                                                    <div className="flex gap-1">
                                                                                        <input
                                                                                            type="text"
                                                                                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 focus:border-brand-500 outline-none font-mono shadow-sm"
                                                                                            placeholder="Value..."
                                                                                            value={selectedStep.step_config?.parameters?.body?.[i] || ''}
                                                                                            onChange={(e) => {
                                                                                                const currentParams = selectedStep.step_config?.parameters || {};
                                                                                                const currentBody = [...(currentParams.body || [])];
                                                                                                currentBody[i] = e.target.value;
                                                                                                handleUpdateStep(selectedStep.id, {
                                                                                                    step_config: {
                                                                                                        ...selectedStep.step_config,
                                                                                                        parameters: {
                                                                                                            ...currentParams,
                                                                                                            body: currentBody
                                                                                                        }
                                                                                                    }
                                                                                                });
                                                                                            }}
                                                                                        />
                                                                                        {/* Quick Var Inserter */}
                                                                                        <button
                                                                                            className="px-2 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 hover:text-brand-500 hover:border-brand-500 whitespace-nowrap shadow-sm"
                                                                                            onClick={() => {
                                                                                                const currentParams = selectedStep.step_config?.parameters || {};
                                                                                                const currentBody = [...(currentParams.body || [])];
                                                                                                currentBody[i] = '{{contact.name}}';
                                                                                                handleUpdateStep(selectedStep.id, {
                                                                                                    step_config: {
                                                                                                        ...selectedStep.step_config,
                                                                                                        parameters: {
                                                                                                            ...currentParams,
                                                                                                            body: currentBody
                                                                                                        }
                                                                                                    }
                                                                                                });
                                                                                            }}
                                                                                            title="Insert Name"
                                                                                        >
                                                                                            Name
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Footer and Buttons Previews */}
                                                                {(() => {
                                                                    const footer = components.find((c: any) => c.type === 'FOOTER' || c.type === 'footer');
                                                                    const buttons = components.find((c: any) => c.type === 'BUTTONS' || c.type === 'buttons');
                                                                    if (!footer && (!buttons || !buttons.buttons?.length)) return null;
                                                                    return (
                                                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3 opacity-90 pointer-events-none">
                                                                            {footer && (
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-1">Footer Preview</div>
                                                                                    <div className="text-xs text-slate-500 italic">{footer.text}</div>
                                                                                </div>
                                                                            )}
                                                                            {buttons && buttons.buttons?.length > 0 && (
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mb-2">Buttons Preview</div>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {buttons.buttons.map((btn: any, bIdx: number) => (
                                                                                            <div key={bIdx} className="px-3 py-1 bg-white text-slate-600 text-[10px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 shadow-sm">
                                                                                                {btn.type === 'URL' && <span className="text-blue-500">🔗</span>}
                                                                                                {btn.type === 'QUICK_REPLY' && <span className="text-emerald-500">↩️</span>}
                                                                                                {btn.text}
                                                                                            </div>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Helper Text */}
                                                                <div className="text-[10px] text-slate-500 italic px-1">
                                                                    Use <span className="font-mono text-brand-400">{'{{contact.name}}'}</span>, <span className="font-mono text-brand-400">{'{{contact.first_name}}'}</span>, <span className="font-mono text-brand-400">{'{{contact.phone}}'}</span> to insert dynamic data.
                                                                </div>
                                                            </div>

                                                        );
                                                    })()}
                                                </div>
                                            )}

                                            {selectedStep.step_type === 'EMAIL' && (
                                                <div className="space-y-4">
                                                    {/* Delivery Helper Header */}
                                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 mb-2">
                                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                                            <span className="text-slate-500">Recipient (To)</span>
                                                            <span className="text-blue-400 font-mono">Enrolled Contact</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                                                            <span className="text-slate-500">Sender (From)</span>
                                                            <span className="text-blue-400 font-mono">Selected Connection</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, provider: 'GMAIL', connectionId: '' } })}
                                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${selectedStep.step_config?.provider === 'GMAIL' ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>Gmail</button>
                                                        <button onClick={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, provider: 'SMTP', connectionId: '' } })}
                                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${selectedStep.step_config?.provider === 'SMTP' ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>SMTP</button>
                                                    </div>

                                                    <select
                                                        value={selectedStep.step_config?.connectionId || ''}
                                                        onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, connectionId: e.target.value } })}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none shadow-sm text-slate-700"
                                                    >
                                                        <option value="">Select Connection...</option>
                                                        {selectedStep.step_config?.provider === 'GMAIL'
                                                            ? gmailConnections.map(c => <option key={c.id} value={c.id}>{c.connection_name}</option>)
                                                            : smtpConnections.map(c => <option key={c.id} value={c.id}>{c.connection_name}</option>)
                                                        }
                                                    </select>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">To (Recipient)</label>
                                                        <input
                                                            type="text"
                                                            value={selectedStep.step_config?.to || ''}
                                                            onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, to: e.target.value } })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none shadow-sm text-slate-700 font-mono"
                                                            placeholder="{{contact.email}}"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Subject</label>
                                                        <input
                                                            type="text"
                                                            value={selectedStep.step_config?.subject || ''}
                                                            onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, subject: e.target.value } })}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none shadow-sm text-slate-700"
                                                            placeholder="Subject"
                                                        />
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] text-slate-500 font-bold uppercase ml-1">Email Body</label>
                                                        <textarea
                                                            value={selectedStep.step_config?.body || ''}
                                                            onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, body: e.target.value } })}
                                                            className="w-full h-32 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none resize-none shadow-sm text-slate-700"
                                                            placeholder="Email body..."
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {selectedStep.step_type === 'AI_INTENT' && (
                                                <div className="space-y-4">
                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Analysis Engine</label>
                                                        <div className="flex flex-col gap-2 mb-2">
                                                            <label className={`flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all ${(selectedStep.step_config?.analysis_mode || 'KEYWORD') === 'OPENAI'
                                                                ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300/20'
                                                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                                                }`}>
                                                                <div className="flex items-start gap-3">
                                                                    <input
                                                                        type="radio"
                                                                        name="analysis_mode"
                                                                        value="OPENAI"
                                                                        checked={selectedStep.step_config?.analysis_mode === 'OPENAI'}
                                                                        onChange={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, analysis_mode: 'OPENAI' } })}
                                                                        className="mt-1 text-emerald-500 focus:ring-emerald-500"
                                                                    />
                                                                    <div>
                                                                        <div className="text-[13px] font-bold text-slate-700">Smart AI (OpenAI)</div>
                                                                        <div className="text-[10px] text-slate-500">Uses GPT to understand meaning. Extremely accurate.</div>
                                                                    </div>
                                                                </div>
                                                                
                                                                {selectedStep.step_config?.analysis_mode === 'OPENAI' && (
                                                                    <div className="ml-7 mt-1 border-t border-emerald-100 pt-2">
                                                                        {openaiConnections.length > 0 ? (
                                                                            <select
                                                                                className="w-full bg-white border border-emerald-100 rounded px-2 py-1.5 text-xs text-slate-700 outline-none focus:ring-1 focus:ring-emerald-500"
                                                                                value={selectedStep.step_config?.connection_id || ''}
                                                                                onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, connection_id: e.target.value } })}
                                                                            >
                                                                                <option value="">Use System Default</option>
                                                                                {openaiConnections.map(conn => (
                                                                                    <option key={conn.id} value={conn.id}>{conn.name}</option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <div className="text-[9px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                                                                                No AI keys. Add one in Settings.
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </label>

                                                            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${(selectedStep.step_config?.analysis_mode || 'KEYWORD') === 'KEYWORD'
                                                                ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300/20'
                                                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                                                }`}>
                                                                <input
                                                                    type="radio"
                                                                    name="analysis_mode"
                                                                    value="KEYWORD"
                                                                    checked={(selectedStep.step_config?.analysis_mode || 'KEYWORD') === 'KEYWORD'}
                                                                    onChange={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, analysis_mode: 'KEYWORD' } })}
                                                                    className="mt-1 text-blue-500 focus:ring-blue-500"
                                                                />
                                                                <div>
                                                                    <div className="text-[13px] font-bold text-slate-700">Keyword Match (Free)</div>
                                                                    <div className="text-[10px] text-slate-500">Checks for simple words. Fast & Free.</div>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-4">Intent Routing</label>

                                                        {['INTERESTED', 'NOT_INTERESTED', 'LATER', 'QUESTION'].map(intent => (
                                                            <div key={intent} className="mb-4 last:mb-0">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono shadow-sm">{intent}</span>
                                                                    <span className="text-[10px] text-slate-400 italic">Move to Stage</span>
                                                                </div>
                                                                <select
                                                                    value={selectedStep.step_config?.stage_mappings?.[intent] || ''}
                                                                    onChange={(e) => {
                                                                        const existingMappings = selectedStep.step_config?.stage_mappings || {};
                                                                        handleUpdateStep(selectedStep.id, {
                                                                            step_config: {
                                                                                ...selectedStep.step_config,
                                                                                stage_mappings: { ...existingMappings, [intent]: e.target.value }
                                                                            }
                                                                        });
                                                                    }}
                                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-brand-500 outline-none"
                                                                >
                                                                    <option value="">Do Nothing (Tag Only)</option>
                                                                    {availableStages.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.pipelineName} - {s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Preferences */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 rounded-full bg-slate-400 flex items-center justify-center text-[10px] text-white font-bold">3</div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-500">Delivery Window</h4>
                                            </div>

                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 shadow-sm">
                                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStep.use_custom_schedule || false}
                                                        onChange={(e) => handleUpdateStep(selectedStep.id, { use_custom_schedule: e.target.checked })}
                                                        className="rounded bg-white border-slate-300 text-brand-500 focus:ring-0"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-bold text-slate-700 block">Strict Delivery Window</span>
                                                        <span className="text-xs text-slate-500 font-medium">Override campaign-level timing</span>
                                                    </div>
                                                </label>

                                                {selectedStep.use_custom_schedule && (
                                                    <div className="space-y-4 pl-7 animate-fade-in">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={selectedStep.custom_time_start || '09:00'}
                                                                onChange={(e) => handleUpdateStep(selectedStep.id, { custom_time_start: e.target.value })}
                                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-brand-500 outline-none"
                                                            />
                                                            <span className="text-slate-500 text-[10px] font-bold">TO</span>
                                                            <input
                                                                type="time"
                                                                value={selectedStep.custom_time_end || '18:00'}
                                                                onChange={(e) => handleUpdateStep(selectedStep.id, { custom_time_end: e.target.value })}
                                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:border-brand-500 outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Allowed Days</p>
                                                            <div className="flex w-full justify-between gap-1">
                                                                {daysMap.map((d, i) => {
                                                                    const str = (selectedStep.custom_allowed_days || '0,1,2,3,4,5,6');
                                                                    const arr = str.split(',').map(n => n.trim()).filter(Boolean).map(Number);
                                                                    const isSelected = arr.includes(i);
                                                                    return (
                                                                            <button
                                                                            key={i}
                                                                            onClick={() => {
                                                                                const newDays = isSelected ? arr.filter(day => day !== i) : [...arr, i].sort((a, b) => a - b);
                                                                                handleUpdateStep(selectedStep.id, { custom_allowed_days: newDays.join(',') });
                                                                            }}
                                                                            className={`w-6 h-6 flex items-center justify-center rounded text-[10px] font-bold transition-all ${isSelected
                                                                                ? 'bg-brand-600 text-white shadow-md'
                                                                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                                                                }`}
                                                                        >
                                                                            {d}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </>
                )}
            </div>
        </div >
    );
};

export default DripBuilder;