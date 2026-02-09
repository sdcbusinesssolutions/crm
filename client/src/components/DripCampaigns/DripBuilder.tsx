import React, { useState, useEffect } from 'react';
import { dripCampaignService, DripCampaign, DripStep } from '../../services/dripCampaignService';

interface DripBuilderProps {
    campaignId: string | null;
    onBack: () => void;
}

const DripBuilder: React.FC<DripBuilderProps> = ({ campaignId, onBack }) => {
    // Campaign State
    const [campaign, setCampaign] = useState<Partial<DripCampaign>>({
        name: 'New Sequence',
        description: '',
        trigger_type: 'TAG_ADDED',
        trigger_value: '',
        status: 'DRAFT',
        stop_on_reply: true,
        steps: [],

        // V2 Defaults
        allowed_days: '0,1,2,3,4,5,6',
        time_window_start: '09:00',
        time_window_end: '18:00'
    });

    const [loading, setLoading] = useState(false);
    const [selectedStep, setSelectedStep] = useState<DripStep | null>(null);
    const [templates, setTemplates] = useState<any[]>([]);

    const [showConfig, setShowConfig] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false); // Fix: Click-based dropdown
    const [activeTab, setActiveTab] = useState<'BUILDER' | 'ENROLLMENTS'>('BUILDER');
    const [enrollments, setEnrollments] = useState<any[]>([]);

    useEffect(() => {
        if (campaignId && activeTab === 'ENROLLMENTS') {
            loadEnrollments();
        }
    }, [campaignId, activeTab]);

    const loadEnrollments = async () => {
        try {
            if (!campaignId) return;
            const data = await dripCampaignService.getEnrollments(campaignId);
            setEnrollments(data || []);
        } catch (e) {
            console.error('Failed to load enrollments', e);
        }
    };

    const handleStopEnrollment = async (id: string) => {
        if (!window.confirm("Stop this sequence for this user?")) return;
        try {
            await dripCampaignService.stopEnrollment(id);
            loadEnrollments(); // Refresh
        } catch (e) { alert("Failed"); }
    };

    useEffect(() => {
        if (campaignId) {
            loadCampaign(campaignId);
        }
        loadTemplates();
    }, [campaignId]);

    const loadTemplates = async () => {
        try {
            const { data: { session } } = await import('../../lib/supabase').then(m => m.supabase.auth.getSession());
            if (!session) return;
            const res = await fetch('/api/whatsapp/templates', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const json = await res.json();
                setTemplates(json.data || []);
            }
        } catch (e) {
            console.error('Failed to load templates', e);
        }
    };

    const loadCampaign = async (id: string) => {
        setLoading(true);
        try {
            const data = await dripCampaignService.getCampaign(id);
            setCampaign(data);
        } catch (error) {
            console.error('Failed to load campaign', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveCampaign = async (exitAfterSave = true) => {
        setLoading(true);
        try {
            if (campaignId) {
                await dripCampaignService.updateCampaign(campaignId, campaign);
                if (exitAfterSave) onBack();
            } else {
                const newCampaign = await dripCampaignService.createCampaign(campaign);
                // CRITICAL: Since we cannot update the parent's ID state easily from here without a prop,
                // we must exit. We can't "stay" on a new campaign without reloading the editor.
                if (exitAfterSave) {
                    onBack();
                } else {
                    alert("Campaign created! Please re-open it from the list to add steps.");
                    onBack();
                }
            }
        } catch (error) {
            console.error('Failed to save campaign', error);
        } finally {
            setLoading(false);
        }
    };

    // V2: Add Step logic
    const handleAddStep = async (type: 'WHATSAPP_MESSAGE' | 'EMAIL') => {
        if (!campaignId) {
            if (window.confirm("Please save this new sequence first. content will be saved and you'll be redirected to the list.")) {
                await handleSaveCampaign(true);
            }
            return;
        }

        const newStep: Partial<DripStep> = {
            campaign_id: campaignId,
            step_order: (campaign.steps?.length || 0) + 1,
            step_type: type,
            step_config: {},

            // Default Delay (e.g. 1 Day)
            delay_value: 1,
            delay_unit: 'DAYS'
        };

        try {
            await dripCampaignService.createStep(campaignId, newStep);
            loadCampaign(campaignId);
        } catch (error) {
            console.error('Failed to add step', error);
        }
    };

    const handleUpdateStep = async (stepId: string, updates: Partial<DripStep>) => {
        if (!campaignId) return;

        // Optimistic update
        const updatedSteps = campaign.steps?.map(s => s.id === stepId ? { ...s, ...updates } : s);
        setCampaign({ ...campaign, steps: updatedSteps });

        if (selectedStep && selectedStep.id === stepId) {
            setSelectedStep({ ...selectedStep, ...updates });
        }

        try {
            await dripCampaignService.updateStep(campaignId, stepId, updates);
        } catch (error) {
            console.error('Failed to update step', error);
        }
    };

    const handleDeleteStep = async (stepId: string) => {
        if (!campaignId) return;
        if (!window.confirm('Delete this step?')) return;
        try {
            await dripCampaignService.deleteStep(campaignId, stepId);
            loadCampaign(campaignId);
            setSelectedStep(null);
        } catch (error) {
            console.error('Failed to delete step', error);
        }
    };

    // Helper to format days
    const daysMap = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const toggleDay = (dayIndex: number) => {
        const days = (campaign.allowed_days || '0,1,2,3,4,5,6').split(',').map(Number);
        const newDays = days.includes(dayIndex)
            ? days.filter(d => d !== dayIndex)
            : [...days, dayIndex].sort();
        setCampaign({ ...campaign, allowed_days: newDays.join(',') });
    };

    const toggleStepDay = (dayIndex: number) => {
        if (!selectedStep) return;
        const currentDays = (selectedStep.custom_allowed_days || '0,1,2,3,4,5,6').split(',').map(Number);
        const newDays = currentDays.includes(dayIndex)
            ? currentDays.filter(d => d !== dayIndex)
            : [...currentDays, dayIndex].sort();

        handleUpdateStep(selectedStep.id, { custom_allowed_days: newDays.join(',') });
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 relative overflow-hidden">
            {/* Header / Nav */}
            <div className="flex justify-between items-center px-6 py-4 bg-white border-b border-slate-200 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition">
                        {/* Back Icon */}
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5 block">Sequence Name</label>
                        <div className="flex items-center gap-2 group cursor-text relative">
                            <input
                                type="text"
                                value={campaign.name || ''}
                                onChange={(e) => setCampaign({ ...campaign, name: e.target.value })}
                                className="text-xl font-bold text-slate-800 bg-transparent border-b-2 border-transparent hover:border-brand-200 focus:border-brand-500 focus:ring-0 px-0 py-1 placeholder-slate-300 w-72 transition-colors"
                                placeholder="Enter Sequence Name..."
                            />
                            <svg className="w-4 h-4 text-slate-300 group-hover:text-brand-400 transition-colors absolute right-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </div>
                        <div className="flex gap-4 mt-2">
                            <button
                                onClick={() => setActiveTab('BUILDER')}
                                className={`text-xs font-bold uppercase pb-1 border-b-2 transition ${activeTab === 'BUILDER' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                Campaign Builder
                            </button>
                            <button
                                onClick={() => setActiveTab('ENROLLMENTS')}
                                className={`text-xs font-bold uppercase pb-1 border-b-2 transition ${activeTab === 'ENROLLMENTS' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                Active Enrollments ({campaign.enrollment_count || 0})
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => handleSaveCampaign(true)}
                        disabled={loading}
                        className="px-6 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-sm transition disabled:opacity-50 font-medium"
                    >
                        {loading ? 'Saving...' : 'Save & Close'}
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden">

                {activeTab === 'ENROLLMENTS' ? (
                    <div className="flex-1 overflow-y-auto bg-slate-50 p-8">
                        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800">Active Contacts in Sequence</h3>
                                <button onClick={loadEnrollments} className="text-sm text-brand-600 hover:underline">Refresh List</button>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
                                    <tr>
                                        <th className="px-6 py-3">Contact</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Progress</th>
                                        <th className="px-6 py-3">Stop Date</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {enrollments.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No active enrollments found.</td></tr>
                                    ) : (
                                        enrollments.map(en => (
                                            <tr key={en.id} className="hover:bg-slate-50">
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-700">{en.contact?.name || 'Unknown'}</div>
                                                    <div className="text-xs text-slate-400">{en.contact?.phone}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${en.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                                        en.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {en.status}
                                                    </span>
                                                    {en.is_looping && <span className="ml-2 text-[10px] bg-purple-100 text-purple-700 px-1 rounded border border-purple-200">LOOP</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-slate-600">Step {en.current_step?.step_order || '-'}</div>
                                                    <div className="text-xs text-slate-400">Next: {en.next_run_at ? new Date(en.next_run_at).toLocaleString() : '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {en.stop_at ? new Date(en.stop_at).toLocaleDateString() : 'Never'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {en.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={() => handleStopEnrollment(en.id)}
                                                            className="text-red-500 hover:text-red-700 font-bold text-xs border border-red-200 bg-red-50 hover:bg-red-100 px-3 py-1 rounded"
                                                        >
                                                            STOP
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="w-full relative flex h-full">
                        {/* Scrollable Canvas (Builder) */}
                        <div className="flex-1 overflow-y-auto bg-slate-50 relative p-8">
                            <div className="max-w-3xl mx-auto pb-32">

                                {/* 1. Sequence Configuration Card */}
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 shadow-sm">
                                    <div className="flex justify-between items-start cursor-pointer" onClick={() => setShowConfig(!showConfig)}>
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-amber-100 rounded-full text-amber-600">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800">Sequence Settings</h3>
                                                <p className="text-xs text-slate-500">
                                                    Trigger: <span className="font-mono font-bold">{campaign.trigger_type}</span>
                                                    {campaign.trigger_value && ` = ${campaign.trigger_value}`} •
                                                    Window: {campaign.time_window_start} - {campaign.time_window_end}
                                                </p>
                                            </div>
                                        </div>
                                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${showConfig ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>

                                    {/* Collapsible Config area */}
                                    {showConfig && (
                                        <div className="mt-4 pt-4 border-t border-amber-200 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trigger Type</label>
                                                <select
                                                    value={campaign.trigger_type}
                                                    onChange={(e) => setCampaign({ ...campaign, trigger_type: e.target.value as any })}
                                                    className="w-full text-sm border-slate-300 rounded focus:ring-amber-500 focus:border-amber-500"
                                                >
                                                    <option value="TAG_ADDED">Tag Added</option>
                                                    <option value="pipeline_STAGE_CHANGED">Stage Changed</option>
                                                    <option value="MANUAL">Start via Follow-Up / Manual</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Trigger Value</label>
                                                {campaign.trigger_type === 'MANUAL' ? (
                                                    <div className="text-sm text-slate-400 italic p-2 bg-slate-50 rounded border border-slate-200">
                                                        No value needed. You will select this sequence manually.
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={campaign.trigger_value || ''}
                                                        onChange={(e) => setCampaign({ ...campaign, trigger_value: e.target.value })}
                                                        className="w-full text-sm border-slate-300 rounded focus:ring-amber-500 focus:border-amber-500"
                                                        placeholder={campaign.trigger_type === 'TAG_ADDED' ? 'e.g. NEW_LEAD' : 'e.g. Pipeline ID'}
                                                    />
                                                )}
                                            </div>

                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Delivery Window</label>
                                                <div className="flex flex-wrap gap-4 items-center bg-white p-3 rounded border border-amber-100">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={campaign.time_window_start}
                                                            onChange={(e) => setCampaign({ ...campaign, time_window_start: e.target.value })}
                                                            className="text-sm border-slate-300 rounded"
                                                        />
                                                        <span className="text-slate-400">to</span>
                                                        <input
                                                            type="time"
                                                            value={campaign.time_window_end}
                                                            onChange={(e) => setCampaign({ ...campaign, time_window_end: e.target.value })}
                                                            className="text-sm border-slate-300 rounded"
                                                        />
                                                    </div>
                                                    <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
                                                    <div className="flex gap-1">
                                                        {daysMap.map((d, i) => {
                                                            const isSelected = (campaign.allowed_days || '0,1,2,3,4,5,6').includes(String(i));
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => toggleDay(i)}
                                                                    className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center transition
                                                                ${isSelected ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}
                                                            `}
                                                                >
                                                                    {d}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="col-span-2 pt-2 border-t border-amber-100">
                                                <div className="flex items-center gap-6">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={campaign.stop_on_reply !== false} // Default true
                                                            onChange={(e) => setCampaign({ ...campaign, stop_on_reply: e.target.checked })}
                                                            className="rounded text-amber-600 focus:ring-amber-500"
                                                        />
                                                        <span className="text-xs font-bold text-slate-600">Stop on Reply</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={campaign.allow_reentry || false}
                                                            onChange={(e) => setCampaign({ ...campaign, allow_reentry: e.target.checked })}
                                                            className="rounded text-amber-600 focus:ring-amber-500"
                                                        />
                                                        <span className="text-xs font-bold text-slate-600">Allow Re-entry</span>
                                                    </label>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mt-1">
                                                    <strong>Stop on Reply:</strong> Ends sequence if user messages back. <br />
                                                    <strong>Allow Re-entry:</strong> Allows the same contact to trigger this sequence multiple times.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Timeline Steps */}
                                <div className="relative flex flex-col items-center">
                                    {/* Vertical Line */}
                                    <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300 left-1/2 -translate-x-1/2 z-0"></div>

                                    {/* Trigger Node Visual */}
                                    <div className="z-10 bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm border border-green-200 mb-6">
                                        START: {campaign.trigger_type === 'MANUAL' ? 'Started from Follow-Up' : `On ${campaign.trigger_type}`}
                                    </div>

                                    {/* Steps Loop */}
                                    {campaign.steps?.sort((a, b) => a.step_order - b.step_order).map((step, index) => (
                                        <React.Fragment key={step.id}>

                                            {/* Delay Connector Badge */}
                                            <div className="z-10 mb-6">
                                                <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200 shadow-sm flex items-center gap-2 cursor-pointer hover:bg-purple-200 transition"
                                                    onClick={() => setSelectedStep(step)}
                                                >
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    Wait {step.delay_value || 0} {step.delay_unit?.toLowerCase() || 'hours'}
                                                </div>
                                            </div>

                                            {/* Step Card */}
                                            <div
                                                onClick={() => setSelectedStep(step)}
                                                className={`z-10 w-full bg-white rounded-xl border-2 p-4 shadow-sm hover:shadow-md transition cursor-pointer mb-6 relative group
                                            ${selectedStep?.id === step.id ? 'border-brand-500 ring-2 ring-brand-100' : 'border-slate-200'}
                                        `}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg 
                                                    ${step.step_type === 'WHATSAPP_MESSAGE' ? 'bg-green-100 text-green-600' :
                                                                step.step_type === 'EMAIL' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-600'}
                                                `}>
                                                            {step.step_type === 'WHATSAPP_MESSAGE' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 001.333 4.993L2 22l5.122-1.342A9.961 9.961 0 0012.012 22c5.506 0 9.989-4.478 9.989-9.984S17.518 2 12.012 2zm0 18.328a8.325 8.325 0 01-4.253-1.164l-.305-.181-3.166.83.845-3.085-.2-.318a8.332 8.332 0 117.079 3.918z" /></svg>}
                                                            {step.step_type === 'EMAIL' && <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-800">
                                                                {step.step_type === 'WHATSAPP_MESSAGE' ? 'WhatsApp Message' : 'Send Email'}
                                                            </h4>
                                                            <p className="text-sm text-slate-500">
                                                                {step.step_config?.template_name || step.step_config?.subject || 'Click to configure...'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Delete Button (Hidden till hover) */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                                                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>

                                        </React.Fragment>
                                    ))}

                                    {/* Add Step Button */}
                                    <div className="z-10 mt-2 relative">
                                        <button
                                            onClick={() => setShowAddMenu(!showAddMenu)}
                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-600 rounded-full shadow-sm hover:border-brand-500 hover:text-brand-600 transition font-medium text-sm"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                            Add Step
                                        </button>

                                        {/* Dropdown - controlled by state */}
                                        {showAddMenu && (
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden animate-fade-in-up z-50">
                                                <button onClick={() => { handleAddStep('WHATSAPP_MESSAGE'); setShowAddMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3">
                                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> WhatsApp
                                                </button>
                                                <button onClick={() => { handleAddStep('EMAIL'); setShowAddMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 flex items-center gap-3">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Email
                                                </button>
                                                <div className="border-t border-slate-100">
                                                    <button onClick={() => setShowAddMenu(false)} className="w-full text-center py-2 text-xs text-slate-400 hover:bg-slate-50">Cancel</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* Right Panel: Settings (Context Sensitive) */}
                        {selectedStep && (
                            <div className="w-96 border-l border-slate-200 bg-white p-6 shadow-2xl z-30 absolute right-0 top-0 bottom-0 h-full flex flex-col animate-slide-in-right">
                                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                    <h3 className="font-bold text-lg text-slate-800">Step Settings</h3>
                                    <button onClick={() => setSelectedStep(null)} className="text-slate-400 hover:text-slate-600">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-6">
                                    {/* 1. Delay Settings */}
                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                        <label className="block text-xs font-bold text-purple-700 uppercase mb-2">1. Sequence Timing (Wait Duration)</label>
                                        <div className="flex gap-2 items-center mb-2">
                                            <span className="text-sm text-slate-600 font-medium">Wait</span>
                                            <input
                                                type="number"
                                                min="0"
                                                value={selectedStep.delay_value || 0}
                                                onChange={(e) => handleUpdateStep(selectedStep.id, { delay_value: parseInt(e.target.value) || 0 })}
                                                className="w-20 px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-center"
                                            />
                                            <select
                                                value={selectedStep.delay_unit || 'HOURS'}
                                                onChange={(e) => handleUpdateStep(selectedStep.id, { delay_unit: e.target.value as any })}
                                                className="px-3 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                                            >
                                                <option value="MINUTES">Minutes</option>
                                                <option value="HOURS">Hours</option>
                                                <option value="DAYS">Days</option>
                                                <option value="WEEKS">Weeks</option>
                                            </select>
                                            <span className="text-sm text-slate-600 font-medium">after previous step.</span>
                                        </div>
                                    </div>

                                    {/* 2. Content Settings */}
                                    <div>
                                        <label className="block text-sm font-bold text-slate-800 mb-3">Message Content</label>

                                        {selectedStep.step_type === 'WHATSAPP_MESSAGE' && (
                                            <div className="space-y-3">
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Current Template</p>
                                                    <p className="font-medium text-slate-800">{selectedStep.step_config?.template_name || 'None Selected'}</p>
                                                </div>
                                                <button
                                                    className="w-full py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium text-sm shadow-sm transition"
                                                    onClick={() => {
                                                        // Ideally open a modal but for now simple select
                                                        // Or replace with dropdown
                                                    }}
                                                >
                                                    + Pick Template
                                                </button>

                                                {/* Inline Select fallback */}
                                                <select
                                                    value={selectedStep.step_config?.template_id || ''}
                                                    onChange={(e) => {
                                                        const tpl = templates.find(t => t.id === e.target.value);
                                                        handleUpdateStep(selectedStep.id, {
                                                            step_config: {
                                                                ...selectedStep.step_config,
                                                                template_id: tpl?.id,
                                                                template_name: tpl?.name
                                                            }
                                                        });
                                                    }}
                                                    className="w-full text-sm border-slate-300 rounded mt-2"
                                                >
                                                    <option value="">Select Template...</option>
                                                    {templates.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Delivery Preferences */}
                                    <div className="pt-6 border-t border-slate-100">
                                        <label className="flex items-center gap-2 cursor-pointer mb-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedStep.use_custom_schedule || false}
                                                onChange={(e) => handleUpdateStep(selectedStep.id, { use_custom_schedule: e.target.checked })}
                                                className="rounded text-brand-600 focus:ring-brand-500"
                                            />
                                            <span className="text-sm font-bold text-slate-700">Strict Delivery Window (Optional)</span>
                                        </label>

                                        {selectedStep.use_custom_schedule && (
                                            <div className="bg-slate-50 p-3 rounded border border-slate-200 text-xs">
                                                <p className="mb-2 text-slate-500">Only send this message if it falls within:</p>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input type="time" className="border-slate-300 rounded px-1 py-0.5" defaultValue="09:00" />
                                                    <span>to</span>
                                                    <input type="time" className="border-slate-300 rounded px-1 py-0.5" defaultValue="18:00" />
                                                </div>
                                                <div className="flex gap-1 justify-between">
                                                    {daysMap.map((d, i) => {
                                                        const isSelected = (selectedStep.custom_allowed_days || '0,1,2,3,4,5,6').split(',').map(Number).includes(i);
                                                        return (
                                                            <button
                                                                key={i}
                                                                onClick={() => toggleStepDay(i)}
                                                                className={`w-5 h-5 flex items-center justify-center rounded text-[8px] transition active:scale-95
                                                        ${isSelected
                                                                        ? 'bg-brand-500 text-white shadow-sm'
                                                                        : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}
                                                    `}
                                                            >
                                                                {d}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-100">
                                    <button
                                        onClick={() => handleDeleteStep(selectedStep.id)}
                                        className="w-full py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold transition"
                                    >
                                        Delete Step
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )
                }
            </div >
        </div >
    );
};

export default DripBuilder;
