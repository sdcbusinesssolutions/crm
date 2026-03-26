import React, { useState, useEffect, useRef, useMemo } from 'react';
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

// --- Memoized Components for Performance ---

const DripHeader = React.memo(({ 
    onBack, 
    campaign, 
    setCampaign, 
    activeTab, 
    setActiveTab, 
    handleExportJSON, 
    handleSaveCampaign, 
    loading 
}: any) => (
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
                    onChange={(e) => setCampaign((prev: any) => ({ ...prev, name: e.target.value }))}
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
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <button
                onClick={handleExportJSON}
                className="px-4 py-1.5 text-slate-400 hover:text-white text-xs font-bold transition-all flex items-center gap-2"
                title="Export this campaign as a JSON file"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
            </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 mr-2">
                <button
                    onClick={() => setCampaign((prev: any) => ({ ...prev, status: 'DRAFT' }))}
                    className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-wider font-bold transition-all flex items-center gap-1.5 ${campaign.status === 'DRAFT' ? 'bg-slate-700 text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className={`w-1.5 h-1.5 rounded-full ${campaign.status === 'DRAFT' ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`}></div>
                    Draft
                </button>
                <button
                    onClick={() => setCampaign((prev: any) => ({ ...prev, status: 'ACTIVE' }))}
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
));

const DripSettingsSidebar = React.memo(({
    selectedStep,
    showCampaignSettings,
    campaign,
    setCampaign,
    handleUpdateStep,
    templates,
    availableTags,
    availableStages,
    gmailConnections,
    smtpConnections,
    openaiConnections,
    handleFileUpload,
    uploadingMedia,
    setSelectedStep,
    setShowCampaignSettings,
    daysMap
}: any) => {
    if (!selectedStep && !showCampaignSettings) return null;

    return (
        <div className={`w-96 border-l border-white/5 bg-slate-900 absolute right-0 top-0 bottom-0 h-full flex flex-col transition-transform duration-300 shadow-2xl z-40 translate-x-0`}>
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
                                            {availableStages.length === 0 && !campaign.trigger_type.includes('MANUAL') ? (
                                                <div className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-500 animate-pulse">Loading stages...</div>
                                            ) : (
                                                <select
                                                    value={campaign.trigger_type}
                                                    onChange={(e) => setCampaign((prev: any) => ({ ...prev, trigger_type: e.target.value as any }))}
                                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                >
                                                    <option value="TAG_ADDED">Tag Added</option>
                                                    <option value="pipeline_STAGE_CHANGED">Stage Changed</option>
                                                    <option value="MANUAL">Follow-up / Manual</option>
                                                </select>
                                            )}
                                        </div>
                                        {campaign.trigger_type !== 'MANUAL' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Trigger Value</label>
                                                {campaign.trigger_type === 'TAG_ADDED' ? (
                                                    <select
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign((prev: any) => ({ ...prev, trigger_value: e.target.value }))}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                    >
                                                        <option value="">Select Tag...</option>
                                                        {availableTags.map((t: string, i: number) => <option key={i} value={t}>{t}</option>)}
                                                    </select>
                                                ) : campaign.trigger_type === 'pipeline_STAGE_CHANGED' ? (
                                                    <select
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign((prev: any) => ({ ...prev, trigger_value: e.target.value }))}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                    >
                                                        <option value="">Select Stage...</option>
                                                        {availableStages.map((s: any) => (
                                                            <option key={s.id} value={s.id}>{s.pipelineName} - {s.name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign((prev: any) => ({ ...prev, trigger_value: e.target.value }))}
                                                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                                        placeholder="Trigger Value"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delivery Window</label>
                                            <div className="flex items-center gap-2 mb-2">
                                                <input type="time" value={campaign.time_window_start} onChange={e => setCampaign((prev: any) => ({ ...prev, time_window_start: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
                                                <span className="text-xs">to</span>
                                                <input type="time" value={campaign.time_window_end} onChange={e => setCampaign((prev: any) => ({ ...prev, time_window_end: e.target.value }))} className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs" />
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {daysMap.map((d: string, i: number) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => {
                                                            const arr = (campaign.allowed_days || '').split(',').map((n: string) => n.trim()).filter(Boolean);
                                                            const exists = arr.includes(String(i));
                                                            const n = exists ? arr.filter((x: string) => x !== String(i)) : [...arr, String(i)];
                                                            setCampaign((prev: any) => ({ ...prev, allowed_days: n.join(',') }));
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
                                                <input type="checkbox" checked={campaign.stop_on_reply} onChange={e => setCampaign((prev: any) => ({ ...prev, stop_on_reply: e.target.checked }))} className="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0" />
                                                <span className="text-sm font-bold text-slate-300">Stop on Reply</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={campaign.allow_reentry} onChange={e => setCampaign((prev: any) => ({ ...prev, allow_reentry: e.target.checked }))} className="rounded bg-slate-800 border-slate-700 text-brand-500 focus:ring-0" />
                                                <span className="text-sm font-bold text-slate-300">Allow Re-entry</span>
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
                                    {templates.length === 0 ? (
                                        <div className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-xs text-slate-500 animate-pulse">Loading templates...</div>
                                    ) : (
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
                                                        parameters: {} 
                                                    }
                                                });
                                            }}
                                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-3 text-sm focus:border-brand-500 outline-none"
                                        >
                                            <option value="">Select Template...</option>
                                            {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="text-[10px] text-slate-400">Variable mapping is automatically handled.</div>
                            </div>
                        )}

                        {selectedStep.step_type === 'EMAIL' && (
                            <div className="space-y-4">
                                <select
                                    value={selectedStep.step_config?.connectionId || ''}
                                    onChange={(e) => handleUpdateStep(selectedStep.id, { step_config: { ...selectedStep.step_config, connectionId: e.target.value } })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:border-brand-500 outline-none"
                                >
                                    <option value="">Select Connection...</option>
                                    {[...gmailConnections, ...smtpConnections].map(c => <option key={c.id} value={c.id}>{c.connection_name}</option>)}
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
                    </div>
                </div>
                )}
            </div>
        </div>
    );
});

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

    const [loadingCampaign, setLoadingCampaign] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [activeTab, setActiveTab] = useState<'BUILDER' | 'ENROLLMENTS'>('BUILDER');
    const [selectedStep, setSelectedStep] = useState<DripStep | null>(null);
    const [showCampaignSettings, setShowCampaignSettings] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [deletedStepIds, setDeletedStepIds] = useState<string[]>([]);
    const [viewport, setViewport] = useState({ x: 0, y: 50, zoom: 1 });

    const isPanning = useRef(false);
    const lastMousePos = useRef({ x: 0, y: 0 });
    const canvasRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isPanning.current) return;
        const dx = e.clientX - lastMousePos.current.x;
        const dy = e.clientY - lastMousePos.current.y;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
        setViewport(p => ({ ...p, x: p.x + dx, y: p.y + dy }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        isPanning.current = true;
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => { isPanning.current = false; };

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const zoomDelta = -e.deltaY * 0.001;
            setViewport(p => {
                const newZoom = Math.min(Math.max(p.zoom + zoomDelta, 0.1), 3);
                return { ...p, zoom: newZoom };
            });
        } else {
            setViewport(p => ({ ...p, x: p.x - e.deltaX, y: p.y - e.deltaY }));
        }
    };

    useEffect(() => {
        const init = async () => {
            // 1. Kick off background tasks IMMEDIATELY without waiting.
            loadMetadata();
            loadTemplates();
            loadEmailConnections();

            if (campaignId) {
                setLoadingCampaign(true);
                try {
                    // 2. Only wait for the actual campaign data to show the graph.
                    const campRes = await dripCampaignService.getCampaign(campaignId);
                    if (campRes) setCampaign(campRes);
                } catch (e) {
                    console.error('Sequence load failed', e);
                } finally {
                    setLoadingCampaign(false);
                }
            }
        };

        init();
    }, [campaignId]);

    useEffect(() => {
        if (campaignId && activeTab === 'ENROLLMENTS') {
            loadEnrollments();
        }
    }, [campaignId, activeTab]);

    const loadMetadata = async () => {
        try {
            const [tags, pipelines] = await Promise.all([
                tagService.getTags(),
                pipelineService.getPipelines()
            ]);
            setAvailableTags(tags.map(t => t.name));
            const stagesPromises = pipelines.map(async (p) => {
                const pStages = await pipelineService.getPipelineStages(p.id);
                return pStages.map(s => ({ ...s, pipelineName: p.name }));
            });
            const stagesResults = await Promise.all(stagesPromises);
            setAvailableStages(stagesResults.flat());
        } catch (e) { console.error(e); }
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
            const { data: { session } } = await supabase.auth.getSession();
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

    const handleSaveCampaign = async (exitAfterSave = true) => {
        if (saving) return;
        setSaving(true);
        try {
            let currentCampaignId = campaignId;
            if (currentCampaignId) {
                await dripCampaignService.updateCampaign(currentCampaignId, campaign);
            } else {
                const createdComp = await dripCampaignService.createCampaign(campaign);
                currentCampaignId = createdComp.id;
            }
            if (currentCampaignId) {
                for (const stepId of deletedStepIds) {
                    await dripCampaignService.deleteStep(currentCampaignId, stepId).catch(() => {});
                }
                if (campaign.steps && campaign.steps.length > 0) {
                    for (const step of campaign.steps) {
                        if (step.id.startsWith('temp_')) {
                            const { id, ...stepData } = step;
                            await dripCampaignService.createStep(currentCampaignId, stepData);
                        } else {
                            await dripCampaignService.updateStep(currentCampaignId, step.id, step);
                        }
                    }
                }
            }
            if (exitAfterSave) onBack();
        } catch (e) {
            console.error('Failed to save:', e);
            alert('Save failed. Please check network.');
        } finally {
            setSaving(false);
        }
    };

    const handleAddStep = (type: any) => {
        const newStep: DripStep = {
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            campaign_id: campaignId || '',
            step_order: (campaign.steps?.length || 0) + 1,
            step_type: type,
            step_config: type === 'EMAIL' ? { provider: 'GMAIL' } : {},
            delay_value: 1,
            delay_unit: 'DAYS'
        };
        setCampaign(prev => ({ ...prev, steps: [...(prev.steps || []), newStep] }));
        setShowAddMenu(false);
    };

    const handleUpdateStep = (stepId: string, updates: Partial<DripStep>) => {
        setCampaign(prev => ({
            ...prev,
            steps: prev.steps?.map(s => s.id === stepId ? { ...s, ...updates } : s)
        }));
        if (selectedStep?.id === stepId) setSelectedStep(prev => prev ? { ...prev, ...updates } : null);
    };

    const handleFileUpload = async (e: any, stepId: string, location: any, cardIndex?: number) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploadingMedia(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                handleUpdateStep(stepId, {
                    step_config: { ...selectedStep?.step_config, parameters: { ...selectedStep?.step_config?.parameters, header: { type: 'IMAGE', url: data.url } } }
                });
            }
        } catch (e) { console.error(e); } finally { setUploadingMedia(false); }
    };

    const handleDeleteStep = (stepId: string) => {
        if (!window.confirm('Delete step?')) return;
        const stepToDelete = campaign.steps?.find(s => s.id === stepId);
        if (stepToDelete && !stepToDelete.id.startsWith('temp_')) setDeletedStepIds(prev => [...prev, stepId]);
        setCampaign(prev => ({ ...prev, steps: prev.steps?.filter(s => s.id !== stepId).map((s, idx) => ({ ...s, step_order: idx + 1 })) }));
        setSelectedStep(null);
    };

    const handleExportJSON = () => {
        const exportData = { ...campaign, export_at: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${campaign.name || 'campaign'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const daysMap = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    if (loadingCampaign) {
        return (
            <div className="h-full w-full bg-slate-950 flex flex-col items-center justify-center font-sans space-y-4">
                <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-slate-400 font-bold animate-pulse text-sm">Loading Sequence...</div>
            </div>
        );
    }

    return (
        <div className="h-full w-full flex flex-col font-sans bg-slate-950 text-white overflow-hidden relative">
            <DripHeader
                onBack={onBack}
                campaign={campaign}
                setCampaign={setCampaign}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleExportJSON={handleExportJSON}
                handleSaveCampaign={handleSaveCampaign}
                loading={saving}
            />

            <div className="flex-1 relative overflow-hidden flex">
                {activeTab === 'ENROLLMENTS' ? (
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
                        <div className="max-w-5xl mx-auto bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
                             <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                                <h3 className="font-bold text-slate-200">Active Enrollments ({enrollments.length})</h3>
                                <button onClick={loadEnrollments} className="text-xs font-bold text-brand-400">Refresh</button>
                            </div>
                            <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-900/50 text-slate-500 uppercase text-xs font-bold border-b border-slate-800">
                                    <tr>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Step</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800">
                                    {enrollments.map(en => (
                                        <tr key={en.id} className="hover:bg-slate-800/50">
                                            <td className="px-6 py-4 font-medium text-white">{en.contact?.name}<div className="text-xs text-slate-500">{en.contact?.phone}</div></td>
                                            <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-xs font-bold border ${en.status === 'ACTIVE' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-900' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>{en.status}</span></td>
                                            <td className="px-6 py-4">{en.current_step?.step_order || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <>
                        <div
                            ref={canvasRef}
                            className="flex-1 bg-slate-950 relative cursor-grab active:cursor-grabbing"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onWheel={handleWheel}
                        >
                            <div className="absolute inset-0 opacity-20 pointer-events-none"
                                style={{
                                    backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)',
                                    backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
                                    backgroundPosition: `${viewport.x}px ${viewport.y}px`
                                }}
                            />
                            <div
                                style={{
                                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                                    transformOrigin: '0 0',
                                    width: '100%'
                                }}
                                className="w-full relative flex justify-center py-20"
                            >
                                <div className="flex flex-col items-center relative gap-0 w-[400px]">
                                    <div
                                        onClick={() => { setShowCampaignSettings(true); setSelectedStep(null); }}
                                        className={`group relative z-10 w-80 bg-slate-900 rounded-2xl p-5 border-2 transition-all cursor-pointer shadow-2xl ${showCampaignSettings ? 'border-brand-500 shadow-brand-500/20' : 'border-slate-800 hover:border-slate-700'}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-amber-500 flex items-center justify-center shrink-0">
                                                <SettingsIcon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white text-base">Start Campaign</h3>
                                                <div className="text-xs text-slate-400 font-mono mt-0.5">{campaign.trigger_type}</div>
                                            </div>
                                        </div>
                                        <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-4 h-4 bg-slate-900 border-2 border-slate-600 rounded-full z-20"></div>
                                    </div>
                                    <div className="w-0.5 h-12 bg-slate-700"></div>
                                    {campaign.steps?.sort((a, b) => a.step_order - b.step_order).map((step, index) => (
                                        <React.Fragment key={step.id}>
                                            <div className="relative z-10 bg-slate-900 border border-slate-700 rounded-full px-4 py-1.5 text-xs font-bold text-slate-300 mb-0 shadow-lg flex items-center gap-2 hover:border-brand-500 transition-colors cursor-pointer"
                                                onClick={() => { setSelectedStep(step); setShowCampaignSettings(false); }}
                                            >
                                                <ClockIcon className="w-3 h-3 text-slate-500" />
                                                <span>Wait {step.delay_value} {step.delay_unit?.toLowerCase()}</span>
                                            </div>
                                            <div className="w-0.5 h-12 bg-slate-700"></div>
                                            <div
                                                onClick={() => { setSelectedStep(step); setShowCampaignSettings(false); }}
                                                className={`relative z-10 w-80 bg-slate-900 rounded-2xl p-4 border-2 transition-all cursor-pointer shadow-xl group ${selectedStep?.id === step.id ? 'border-brand-500 shadow-brand-500/20' : 'border-slate-800 hover:border-slate-700'}`}
                                            >
                                                <div className="absolute left-1/2 -top-2.5 -translate-x-1/2 w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded-full z-20"></div>
                                                <div className="flex items-start gap-4">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${step.step_type === 'WHATSAPP_MESSAGE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                        {step.step_type === 'WHATSAPP_MESSAGE' ? <MessageIcon className="w-5 h-5" /> : <SparklesIcon className="w-5 h-5" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold text-slate-200 text-sm">{step.step_type}</h4>
                                                        <p className="text-xs text-slate-500 mt-1 truncate">{step.step_config?.template_name || 'Configure...'}</p>
                                                    </div>
                                                </div>
                                                <div className="absolute left-1/2 -bottom-2.5 -translate-x-1/2 w-3 h-3 bg-slate-800 border-2 border-slate-600 rounded-full z-20"></div>
                                            </div>
                                            <div className="w-0.5 h-12 bg-slate-700"></div>
                                        </React.Fragment>
                                    ))}
                                    <div className="relative z-10 group">
                                        <button onClick={() => setShowAddMenu(!showAddMenu)} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 hover:border-brand-500 text-slate-400 flex items-center justify-center transition-all">
                                            <PlusIcon className="w-5 h-5" />
                                        </button>
                                        {showAddMenu && (
                                            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-48 bg-slate-800 border-slate-700 rounded-xl shadow-2xl p-1 z-50">
                                                <button onClick={() => handleAddStep('WHATSAPP_MESSAGE')} className="w-full text-left p-2 rounded-lg hover:bg-slate-700 text-sm font-bold text-slate-300">WhatsApp</button>
                                                <button onClick={() => handleAddStep('EMAIL')} className="w-full text-left p-2 rounded-lg hover:bg-slate-700 text-sm font-bold text-slate-300">Email</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-0.5 h-32 bg-gradient-to-b from-slate-700 to-transparent"></div>
                                </div>
                            </div>
                        </div>

                        <DripSettingsSidebar
                            selectedStep={selectedStep}
                            showCampaignSettings={showCampaignSettings}
                            campaign={campaign}
                            setCampaign={setCampaign}
                            handleUpdateStep={handleUpdateStep}
                            templates={templates}
                            availableTags={availableTags}
                            availableStages={availableStages}
                            gmailConnections={gmailConnections}
                            smtpConnections={smtpConnections}
                            openaiConnections={openaiConnections}
                            handleFileUpload={handleFileUpload}
                            uploadingMedia={uploadingMedia}
                            setSelectedStep={setSelectedStep}
                            setShowCampaignSettings={setShowCampaignSettings}
                            daysMap={daysMap}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

export default DripBuilder;