import React, { useState, useEffect, useRef } from 'react';
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
    SparklesIcon
} from '../icons';

// --- Types ---
interface DripBuilderProps {
    campaignId: string | null;
    onBack: () => void;
}

const DripBuilder: React.FC<DripBuilderProps> = ({ campaignId, onBack }) => {
    // --- State: Data ---
    const [campaign, setCampaign] = useState<Partial<DripCampaign>>({
        name: 'New Sequence',
        description: '',
        trigger_type: 'MANUAL',
        trigger_value: '',
        status: 'DRAFT',
        stop_on_reply: true,
        steps: [],
        // V2 Defaults
        allowed_days: '0,1,2,3,4,5,6',
        time_window_start: '09:00',
        time_window_end: '18:00'
    });
    const [enrollments, setEnrollments] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [gmailConnections, setGmailConnections] = useState<any[]>([]);
    const [smtpConnections, setSmtpConnections] = useState<any[]>([]);
    const [openaiConnections, setOpenaiConnections] = useState<any[]>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [availableStages, setAvailableStages] = useState<any[]>([]);

    // --- State: UI ---
    const [loading, setLoading] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [activeTab, setActiveTab] = useState<'BUILDER' | 'ENROLLMENTS'>('BUILDER');
    const [selectedStep, setSelectedStep] = useState<DripStep | null>(null);
    const [showCampaignSettings, setShowCampaignSettings] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);

    // --- State: Canvas ---
    const [viewport, setViewport] = useState({ x: 0, y: 50, zoom: 1 });
    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);

    // --- Effects ---
    useEffect(() => {
        if (campaignId) {
            loadCampaign(campaignId);
            if (activeTab === 'ENROLLMENTS') loadEnrollments();
        }
        loadTemplates();
        loadEmailConnections();
        loadMetadata();
    }, [campaignId, activeTab]);

    // --- Loaders ---
    const loadMetadata = async () => {
        try {
            const tags = await tagService.getTags();
            setAvailableTags(tags.map(t => t.name));

            const pipelines = await pipelineService.getPipelines();
            let stages: any[] = [];
            for (const p of pipelines) {
                const pStages = await pipelineService.getPipelineStages(p.id);
                // Simple sort by display order if available
                stages.push(...pStages.map(s => ({ ...s, pipelineName: p.name })));
            }
            setAvailableStages(stages);
        } catch (e) { console.error('Failed to load metadata', e); }
    };
    const loadCampaign = async (id: string) => {
        setLoading(true);
        try {
            const data = await dripCampaignService.getCampaign(id);
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

    const loadEmailConnections = async () => {
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
    };

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

            if (exitAfterSave) onBack();
        } catch (e) {
            console.error('Failed to save drip campaign:', e);
            alert('Failed to save. Please check your network and try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddStep = (type: 'WHATSAPP_MESSAGE' | 'EMAIL' | 'AI_INTENT') => {
        // MANUAL MODE: Just update local state. IDs for new steps are temporary
        const newStep: DripStep = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            campaign_id: campaignId || '',
            step_order: (campaign.steps?.length || 0) + 1,
            step_type: type,
            step_config: type === 'EMAIL' ? { provider: 'GMAIL' } : type === 'AI_INTENT' ? { intents: ['INTERESTED', 'NOT_INTERESTED', 'LATER', 'QUESTION'] } : {},
            delay_value: 1,
            delay_unit: 'DAYS'
        };

        setCampaign(prev => ({
            ...prev,
            steps: [...(prev.steps || []), newStep]
        }));
        setShowAddMenu(false);
    };

    const handleUpdateStep = (stepId: string, updates: Partial<DripStep>) => {
        // MANUAL MODE: Just update local state
        setCampaign(prev => {
            const updatedSteps = prev.steps?.map(s => s.id === stepId ? { ...s, ...updates } : s);
            return { ...prev, steps: updatedSteps };
        });

        if (selectedStep?.id === stepId) {
            setSelectedStep(prev => prev ? { ...prev, ...updates } : null);
        }
    };

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

    const handleDeleteStep = (stepId: string) => {
        if (!window.confirm('Delete step from your sequence?')) return;

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
    };

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

    // --- Canvas Logic ---
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setViewport(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    };

    const handleMouseUp = () => { isPanning.current = false; };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            const zoomDelta = -e.deltaY * 0.001;
            setViewport(p => ({ ...p, zoom: Math.min(Math.max(p.zoom + zoomDelta, 0.1), 3) }));
        } else {
            setViewport(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    };

    const daysMap = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // --- Renderers ---
    return (
        <div className="h-full w-full flex flex-col font-sans bg-slate-950 text-white overflow-hidden relative">
            {/* Header */}
            <div className="z-30 px-4 py-3 shrink-0 bg-slate-900/50 backdrop-blur-md border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all border border-slate-700">
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span className="font-bold text-xs">Back</span>
                    </button>
                    <div>
                        <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Campaign Builder</div>
                        <input
                            type="text"
                            value={campaign.name || ''}
                            onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                            className="bg-transparent border-none text-white font-bold text-lg focus:ring-0 p-0 placeholder-slate-600 w-64"
                            placeholder="Untitled Campaign"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    <button
                        onClick={() => setActiveTab('BUILDER')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'BUILDER' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Graph
                    </button>
                    <button
                        onClick={() => setActiveTab('ENROLLMENTS')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'ENROLLMENTS' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        Enrollments
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {/* Status Toggle */}
                    <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 mr-2">
                        <button
                            onClick={() => setCampaign({ ...campaign, status: 'DRAFT' })}
                            className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${campaign.status === 'DRAFT' ? 'bg-slate-700 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'DRAFT' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></div>
                            Draft
                        </button>
                        <button
                            onClick={() => setCampaign({ ...campaign, status: 'ACTIVE' })}
                            className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${campaign.status === 'ACTIVE' ? 'bg-slate-700 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'ACTIVE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}></div>
                            Publish
                        </button>
                    </div>

                    <button
                        onClick={() => handleSaveCampaign(true)}
                        disabled={loading}
                        className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-brand-900/20 transition-all active:scale-95 disabled:opacity-50 border border-brand-500"
                    >
                        {loading ? 'Saving...' : (campaign.status === 'ACTIVE' ? 'Publish & Exit' : 'Save & Exit')}
                    </button>
                </div>
            </div>


            {/* Main Workspace */}
            <div className="flex-1 relative overflow-hidden flex">
                {activeTab === 'ENROLLMENTS' ? (
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
                        <div className="max-w-5xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <h3 className="font-bold text-slate-200">Active Enrollments ({enrollments.length})</h3>
                                <button onClick={loadEnrollments} className="text-xs font-bold text-brand-400 hover:text-brand-300">Refresh</button>
                            </div>
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-900/50 text-slate-500 uppercase text-xs font-bold border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Step</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {enrollments.map(en => (
                                        <tr key={en.id} className="hover:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium text-white">{en.contact?.name}<div className="text-xs text-slate-500">{en.contact?.phone}</div></td>
                                            <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold border ${en.status === 'ACTIVE' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{en.status}</span></td>
                                            <td className="px-6 py-4">{en.current_step?.step_order || '-'}</td>
                                            <td className="px-6 py-4 flex gap-3">
                                                <button onClick={() => handleStopEnrollment(en.id)} className="text-yellow-500 hover:text-yellow-400 text-xs font-bold">Stop</button>
                                                <button onClick={() => handleDeleteEnrollment(en.id)} className="text-red-400 hover:text-red-300 text-xs font-bold">Delete</button>
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
                        <div
                            ref={canvasRef}
                            className="flex-1 bg-slate-950 relative cursor-grab active:cursor-grabbing"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                        >
                            {/* Dot Background */}
                            <div className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                    backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                                    backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
                                    backgroundPosition: `${viewport.x}px ${viewport.y}px`
                                }}
                            />

                            {/* Transform Layer */}
                            <div
                                style={{
                                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                                    transformOrigin: '0 0',
                                    width: '100%',
                                    // Height needs to be large enough to contain the vertical stack
                                    minHeight: '2000px'
                                }}
                                className="w-full relative flex justify-center py-20"
                            >
                                <div className="flex flex-col items-center relative gap-0 w-[400px]">

                                    {/* Campaign Settings Node */}
                                    <div
                                        onClick={() => { setShowCampaignSettings(true); setSelectedStep(null); }}
                                        className={`group relative z-10 w-80 bg-slate-900 rounded-2xl p-5 border-2 transition-all cursor-pointer shadow-2xl ${showCampaignSettings ? 'border-brand-500 shadow-brand-500/20' : 'border-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 opacity-50">
                                            <div className="w-1 h-32 bg-gradient-to-b from-transparent to-slate-800/0"></div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-amber-500 flex items-center justify-center shrink-0">
                                                <SettingsIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-base">Start Campaign</h3>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                    {campaign.trigger_type}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Output Handle */}
                                        <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-4 h-4 bg-slate-900 border-2 border-slate-600 rounded-full z-20"></div>
                                    </div>

                                    {/* Connecting Line */}
                                    <div className="w-0.5 h-12 bg-slate-700"></div>

                                    {/* Steps */}
                                    {campaign.steps?.sort((a, b) => a.step_order - b.step_order).map((step, index) => (
                                        <React.Fragment key={step.id}>
                                            {/* Delay Node */}
                                            <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-bold text-slate-300 mb-0 shadow-lg flex items-center gap-2 hover:border-brand-500 transition-colors cursor-pointer"
                                                onClick={() => { setSelectedStep(step); setShowCampaignSettings(false); }}
                                            >
                                                <ClockIcon className="w-3 h-3 text-slate-500" />
                                                <span>Wait {step.delay_value} {step.delay_unit?.toLowerCase()}</span>
                                            </div>

                                            {/* Connecting Line */}
                                            <div className="w-0.5 h-12 bg-slate-700"></div>

                                            {/* Action Node */}
                                            <div
                                                onClick={() => { setSelectedStep(step); setShowCampaignSettings(false); }}
                                                className={`relative z-10 w-80 bg-slate-900 rounded-2xl p-4 border-2 transition-all cursor-pointer shadow-xl group ${selectedStep?.id === step.id ? 'border-brand-500 shadow-brand-500/20' : 'border-slate-800 hover:border-slate-700'}`}
                                            >
                                                {/* Input Handle */}
                                                <div className="absolute left-1/2 -top-2.5 -translate-x-1/2 w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded-full z-20"></div>

                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${step.step_type === 'WHATSAPP_MESSAGE'
                                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                        : step.step_type === 'EMAIL'
                                                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                            : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                                                        }`}>
                                                        {step.step_type === 'WHATSAPP_MESSAGE' ? <MessageIcon className="w-5 h-5" /> : step.step_type === 'EMAIL' ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> : <SparklesIcon className="w-5 h-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-start">
                                                            <h4 className="font-bold text-slate-200 text-sm">{step.step_type === 'WHATSAPP_MESSAGE' ? 'WhatsApp' : step.step_type === 'EMAIL' ? 'Email' : 'AI Analysis'}</h4>
                                                            <button onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all">
                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <p className="text-xs text-slate-500 mt-1 truncate font-mono">
                                                            {step.step_config?.template_name || step.step_config?.subject || 'Configure...'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Output Handle */}
                                                <div className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded-full z-20"></div>
                                            </div>

                                            {/* Connecting Line */}
                                            <div className="w-0.5 h-12 bg-slate-700"></div>
                                        </React.Fragment>
                                    ))}

                                    {/* Add Button */}
                                    <div className="relative z-10 group">
                                        <button
                                            onClick={() => setShowAddMenu(!showAddMenu)}
                                            className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 hover:border-brand-500 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all shadow-lg"
                                        >
                                            <PlusIcon className="w-5 h-5" />
                                        </button>
                                        {showAddMenu && (
                                            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-1 z-50">
                                                <button onClick={() => { handleAddStep('WHATSAPP_MESSAGE'); setShowAddMenu(false); }} className="w-full text-left p-2 rounded-lg hover:bg-slate-700 text-sm font-bold text-slate-300 hover:text-white flex items-center gap-2">
                                                    <MessageIcon className="w-4 h-4 text-emerald-500" /> WhatsApp
                                                </button>
                                                <button onClick={() => { handleAddStep('EMAIL'); setShowAddMenu(false); }} className="w-full text-left p-2 rounded-lg hover:bg-slate-700 text-sm font-bold text-slate-300 hover:text-white flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                    Email
                                                </button>
                                                <button onClick={() => { handleAddStep('AI_INTENT'); setShowAddMenu(false); }} className="w-full text-left p-2 rounded-lg hover:bg-slate-700 text-sm font-bold text-slate-300 hover:text-white flex items-center gap-2">
                                                    <SparklesIcon className="w-4 h-4 text-indigo-500" /> AI Intent
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* End line fade */}
                                    <div className="w-0.5 h-32 bg-gradient-to-b from-slate-700 to-transparent"></div>
                                </div>
                            </div>

                            {/* Navigation Controls */}
                            <div className="absolute bottom-6 right-6 flex flex-col gap-2 bg-slate-800 rounded-lg border border-slate-700 p-1 shadow-xl z-30">
                                <button onClick={() => setViewport(v => ({ ...v, zoom: Math.min(v.zoom + 0.1, 3) }))} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold w-9 h-9 flex items-center justify-center transition-all" title="Zoom In">+</button>
                                <button onClick={() => setViewport(v => ({ ...v, zoom: Math.min(Math.max(v.zoom - 0.1, 0.1), 3) }))} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold w-9 h-9 flex items-center justify-center transition-all" title="Zoom Out">-</button>
                                <div className="h-px bg-slate-700 my-0.5"></div>
                                <button onClick={() => setViewport({ x: 0, y: 50, zoom: 1 })} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold w-9 h-9 flex items-center justify-center transition-all text-[10px] uppercase" title="Reset View">Fit</button>
                            </div>
                        </div>

                        {/* Settings Overlay Sidebar */}
                        <div className={`w-96 border-l border-white/5 bg-slate-900 absolute right-0 top-0 bottom-0 h-full flex flex-col transition-transform duration-300 shadow-2xl z-40 ${selectedStep || showCampaignSettings ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5">
                                <h3 className="font-bold text-white text-lg">{showCampaignSettings ? 'Campaign Settings' : 'Step Settings'}</h3>
                                <button onClick={() => { setSelectedStep(null); setShowCampaignSettings(false); }} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {showCampaignSettings && (
                                    <div className="space-y-6 text-slate-300">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trigger Event</label>
                                            <select
                                                value={campaign.trigger_type}
                                                onChange={(e) => setCampaign({ ...campaign, trigger_type: e.target.value as any })}
                                                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
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
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                    >
                                                        <option value="">Select Tag...</option>
                                                        {availableTags.map((t, i) => <option key={i} value={t}>{t}</option>)}
                                                    </select>
                                                ) : campaign.trigger_type === 'pipeline_STAGE_CHANGED' ? (
                                                    <select
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign({ ...campaign, trigger_value: e.target.value })}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
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
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                        placeholder="Trigger Value"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delivery Window</label>
                                            <div className="flex items-center gap-2 mb-2">
                                                <input type="time" value={campaign.time_window_start} onChange={e => setCampaign({ ...campaign, time_window_start: e.target.value })} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
                                                <span className="text-xs">to</span>
                                                <input type="time" value={campaign.time_window_end} onChange={e => setCampaign({ ...campaign, time_window_end: e.target.value })} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
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
                                                        className={`w-6 h-6 rounded text-[10px] font-bold ${((campaign.allowed_days || '').includes(String(i))) ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                                                    >
                                                        {d}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-4 pt-4 border-t border-white/5">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={campaign.stop_on_reply} onChange={e => setCampaign({ ...campaign, stop_on_reply: e.target.checked })} className="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0" />
                                                <span className="text-sm font-bold">Stop on Reply</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={campaign.allow_reentry} onChange={e => setCampaign({ ...campaign, allow_reentry: e.target.checked })} className="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0" />
                                                <span className="text-sm font-bold">Allow Re-entry</span>
                                            </label>
                                        </div>
                                    </div>
                                )}

                                {selectedStep && (
                                    <div className="space-y-8 text-slate-300">
                                        {/* Delay Section */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">1</div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-500">Wait Duration</h4>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={selectedStep.delay_value || 0}
                                                    onChange={(e) => handleUpdateStep(selectedStep.id, { delay_value: parseInt(e.target.value) || 0 })}
                                                    className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-center font-bold focus:border-brand-500 outline-none"
                                                />
                                                <select
                                                    value={selectedStep.delay_unit || 'HOURS'}
                                                    onChange={(e) => handleUpdateStep(selectedStep.id, { delay_unit: e.target.value as any })}
                                                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 font-bold text-sm focus:border-brand-500 outline-none"
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
                                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">2</div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-500">Message Content</h4>
                                            </div>

                                            {selectedStep.step_type === 'WHATSAPP_MESSAGE' && (
                                                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">WhatsApp Template</label>
                                                        <select
                                                            value={selectedStep.step_config?.template_id || ''}
                                                            onChange={(e) => {
                                                                const tpl = templates.find(t => t.id === e.target.value);
                                                                handleUpdateStep(selectedStep.id, {
                                                                    step_config: {
                                                                        ...selectedStep.step_config,
                                                                        template_id: tpl?.id,
                                                                        template_name: tpl?.name,
                                                                        template_language: tpl?.language,
                                                                        parameters: {} // Reset params on change
                                                                    }
                                                                });
                                                            }}
                                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-sm focus:border-brand-500 outline-none"
                                                        >
                                                            <option value="">Select Template...</option>
                                                            {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                                                        </select>
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
                                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                                                        <div className="text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                                                            Header ({header.format})
                                                                        </div>
                                                                        {['IMAGE', 'VIDEO', 'DOCUMENT'].includes((header.format || '').toUpperCase()) && (
                                                                            <div>
                                                                                <div className="flex gap-2 mb-2">
                                                                                    <input
                                                                                        type="file"
                                                                                        accept={(header.format || '').toUpperCase() === 'IMAGE' ? 'image/*' : (header.format || '').toUpperCase() === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                                                                                        onChange={(e) => handleFileUpload(e, selectedStep.id, 'HEADER')}
                                                                                        className="block w-full text-xs text-slate-400
                                                                                        file:mr-2 file:py-1 file:px-2
                                                                                        file:rounded-full file:border-0
                                                                                        file:text-[10px] file:font-bold
                                                                                        file:bg-brand-600 file:text-white
                                                                                        hover:file:bg-brand-500
                                                                                        cursor-pointer"
                                                                                    />
                                                                                </div>
                                                                                {uploadingMedia && <p className="text-[10px] text-brand-400 animate-pulse mb-2">Uploading...</p>}
                                                                                <label className="text-[10px] text-slate-500 mb-1 block">Or Direct URL</label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:border-brand-500 outline-none"
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
                                                                        )}
                                                                        {(header.format || '').toUpperCase() === 'TEXT' && header.text?.includes('{{1}}') && (
                                                                            <div>
                                                                                <label className="text-[10px] text-slate-500 mb-1 block">Header Variable {'{{1}}'}</label>
                                                                                <input
                                                                                    type="text"
                                                                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:border-brand-500 outline-none"
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
                                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 space-y-4">
                                                                        <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2 uppercase">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                                                            Carousel Cards Media
                                                                        </div>
                                                                        {carousel.cards.map((card: any, idx: number) => {
                                                                            const headerComp = card.components?.find((c: any) => c.type === 'HEADER' || c.type === 'header');
                                                                            const cardFormat = (headerComp?.format || 'IMAGE').toUpperCase();
                                                                            return (
                                                                                <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
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
                                                                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:border-brand-500 outline-none"
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
                                                                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
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
                                                                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:border-brand-500 outline-none font-mono text-slate-300"
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
                                                                                            className="px-2 bg-slate-800 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-400 hover:text-brand-400 hover:border-brand-500 whitespace-nowrap"
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
                                                                        <div className="p-3 bg-slate-800/30 rounded-lg border border-slate-700 space-y-3 opacity-80 pointer-events-none">
                                                                            {footer && (
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">Footer</div>
                                                                                    <div className="text-xs text-slate-400 italic">{footer.text}</div>
                                                                                </div>
                                                                            )}
                                                                            {buttons && buttons.buttons?.length > 0 && (
                                                                                <div>
                                                                                    <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">Buttons</div>
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {buttons.buttons.map((btn: any, bIdx: number) => (
                                                                                            <div key={bIdx} className="px-3 py-1 bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg border border-slate-600 flex items-center gap-1">
                                                                                                {btn.type === 'URL' && <span className="text-brand-400">🔗</span>}
                                                                                                {btn.type === 'QUICK_REPLY' && <span className="text-emerald-400">↩️</span>}
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
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, provider: 'GMAIL', connectionId: '' } })}
                                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border ${selectedStep.step_config?.provider === 'GMAIL' ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-slate-800 border-slate-700'}`}>Gmail</button>
                                                        <button onClick={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, provider: 'SMTP', connectionId: '' } })}
                                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border ${selectedStep.step_config?.provider === 'SMTP' ? 'bg-blue-900/30 text-blue-400 border-blue-800' : 'bg-slate-800 border-slate-700'}`}>SMTP</button>
                                                    </div>

                                                    <select
                                                        value={selectedStep.step_config?.connectionId || ''}
                                                        onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, connectionId: e.target.value } })}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                    >
                                                        <option value="">Select Connection...</option>
                                                        {selectedStep.step_config?.provider === 'GMAIL'
                                                            ? gmailConnections.map(c => <option key={c.id} value={c.id}>{c.connection_name}</option>)
                                                            : smtpConnections.map(c => <option key={c.id} value={c.id}>{c.connection_name}</option>)
                                                        }
                                                    </select>

                                                    <input
                                                        type="text"
                                                        value={selectedStep.step_config?.subject || ''}
                                                        onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, subject: e.target.value } })}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                        placeholder="Subject"
                                                    />

                                                    <textarea
                                                        value={selectedStep.step_config?.body || ''}
                                                        onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, body: e.target.value } })}
                                                        className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none resize-none"
                                                        placeholder="Email body..."
                                                    />
                                                </div>
                                            )}

                                            {selectedStep.step_type === 'AI_INTENT' && (
                                                <div className="space-y-4">
                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Analysis Engine</label>
                                                        <div className="flex flex-col gap-2 mb-4">
                                                            <label className={`flex flex-col gap-2 p-3 rounded-lg border cursor-pointer transition-all ${(selectedStep.step_config?.analysis_mode || 'KEYWORD') === 'OPENAI'
                                                                ? 'bg-emerald-500/10 border-emerald-500/50'
                                                                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                                                }`}>
                                                                <div className="flex items-start gap-3">
                                                                    <input
                                                                        type="radio"
                                                                        name="analysis_mode"
                                                                        value="OPENAI"
                                                                        checked={selectedStep.step_config?.analysis_mode === 'OPENAI'}
                                                                        onChange={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, analysis_mode: 'OPENAI' } })}
                                                                        className="mt-1"
                                                                    />
                                                                    <div>
                                                                        <div className="text-sm font-bold text-slate-200">Smart AI (OpenAI)</div>
                                                                        <div className="text-[10px] text-slate-400">Uses GPT to understand meaning. Requires API Key. Extremely accurate.</div>
                                                                    </div>
                                                                </div>

                                                                {/* Connection Selector (visible only when checked) */}
                                                                {selectedStep.step_config?.analysis_mode === 'OPENAI' && (
                                                                    <div className="ml-7 mt-1">
                                                                        {openaiConnections.length > 0 ? (
                                                                            <select
                                                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-emerald-500 outline-none"
                                                                                value={selectedStep.step_config?.connection_id || ''}
                                                                                onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, connection_id: e.target.value } })}
                                                                            >
                                                                                <option value="">Use System Default / Any Available</option>
                                                                                {openaiConnections.map(conn => (
                                                                                    <option key={conn.id} value={conn.id}>
                                                                                        {conn.name} ({conn.maskedKey})
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        ) : (
                                                                            <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                                                                No OpenAI keys found. <a href="/settings" target="_blank" className="underline font-bold">Add one in Settings</a> or Keyword Mode will be used.
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </label>

                                                            <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${(selectedStep.step_config?.analysis_mode || 'KEYWORD') === 'KEYWORD'
                                                                ? 'bg-blue-500/10 border-blue-500/50'
                                                                : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                                                                }`}>
                                                                <input
                                                                    type="radio"
                                                                    name="analysis_mode"
                                                                    value="KEYWORD"
                                                                    checked={(selectedStep.step_config?.analysis_mode || 'KEYWORD') === 'KEYWORD'}
                                                                    onChange={() => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, analysis_mode: 'KEYWORD' } })}
                                                                    className="mt-1"
                                                                />
                                                                <div>
                                                                    <div className="text-sm font-bold text-slate-200">Keyword Match (Free)</div>
                                                                    <div className="text-[10px] text-slate-400">Checks for words like "yes", "stop", "later". Fast & Free but less smart.</div>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-4">Intent Routing</label>

                                                        {['INTERESTED', 'NOT_INTERESTED', 'LATER', 'QUESTION'].map(intent => (
                                                            <div key={intent} className="mb-4 last:mb-0">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-xs font-bold text-slate-300 bg-slate-700 px-2 py-0.5 rounded border border-slate-600 font-mono">{intent}</span>
                                                                    <span className="text-[10px] text-slate-500">Move to Stage</span>
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
                                                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:border-brand-500 outline-none"
                                                                >
                                                                    <option value="">Do Nothing (Tag Only)</option>
                                                                    {availableStages.map(s => (
                                                                        <option key={s.id} value={s.id}>{s.pipelineName} - {s.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        ))}

                                                        <p className="text-[10px] text-slate-500 mt-4 italic border-t border-slate-700 pt-2">
                                                            Note: The contact will always be tagged with "AI_{'{INTENT}'}" regardless of stage change.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Delivery Preferences */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">3</div>
                                                <h4 className="font-bold text-xs uppercase tracking-wide text-slate-500">Delivery Window</h4>
                                            </div>

                                            <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
                                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedStep.use_custom_schedule || false}
                                                        onChange={(e) => handleUpdateStep(selectedStep.id, { use_custom_schedule: e.target.checked })}
                                                        className="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-bold text-slate-300 block">Strict Schedule</span>
                                                        <span className="text-xs text-slate-500">Override campaign window</span>
                                                    </div>
                                                </label>

                                                {selectedStep.use_custom_schedule && (
                                                    <div className="space-y-4 pl-7 animate-fade-in">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={selectedStep.custom_time_start || '09:00'}
                                                                onChange={(e) => handleUpdateStep(selectedStep.id, { custom_time_start: e.target.value })}
                                                                className="flex-1 bg-slate-900 border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300"
                                                            />
                                                            <span className="text-slate-500 text-[10px] font-bold">TO</span>
                                                            <input
                                                                type="time"
                                                                value={selectedStep.custom_time_end || '18:00'}
                                                                onChange={(e) => handleUpdateStep(selectedStep.id, { custom_time_end: e.target.value })}
                                                                className="flex-1 bg-slate-900 border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300"
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
                                                                                ? 'bg-brand-600 text-white'
                                                                                : 'bg-slate-800 text-slate-600 hover:bg-slate-700'
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