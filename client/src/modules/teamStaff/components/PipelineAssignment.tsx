import React, { useState, useEffect } from 'react';
import { getPipelines, getPipelineStages, moveLeadToStage, updateLead, createLead, getLeads, getLead } from '../../../services/lead-management-api';
import Modal from '../../../components/Modal';
import { Pipeline, PipelineStage, Lead } from '../../../types/lead-management';
import { BriefcaseIcon, ChevronRightIcon, CheckIcon, PlusIcon, SearchIcon, ChevronDownIcon } from '../../../components/icons';

let globalPipelinesPromise: Promise<Pipeline[]> | null = null;
let globalStagesPromises: Record<string, Promise<PipelineStage[]>> = {};

interface PipelineAssignmentProps {
    leadId?: string;
    contact: any; // Can be a Lead or a Contact
    onAssignmentComplete?: (updatedLead: Lead) => void;
}

const PipelineAssignment: React.FC<PipelineAssignmentProps> = ({ leadId, contact, onAssignmentComplete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [activeAssignments, setActiveAssignments] = useState<{ leadId: string, pipelineId: string, stageId: string }[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(contact.pipeline_id || null);
    const [stagesCache, setStagesCache] = useState<Record<string, PipelineStage[]>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Load pipelines right away so badges can render pipeline names
                if (!globalPipelinesPromise) {
                    globalPipelinesPromise = getPipelines().catch(err => {
                        globalPipelinesPromise = null; // Clear cache on error so it can retry
                        throw err;
                    });
                }
                const pData = await globalPipelinesPromise;
                setPipelines(pData);
                
                const assignments: { leadId: string, pipelineId: string, stageId: string }[] = [];
                
                if (leadId) {
                    const existingLead = await getLead(leadId);
                    if (existingLead && existingLead.pipeline_id && existingLead.stage_id) {
                        assignments.push({
                            leadId: existingLead.id,
                            pipelineId: existingLead.pipeline_id,
                            stageId: existingLead.stage_id
                        });
                    }
                } else if (contact.phone || contact.contact_phone) {
                    const phoneToSearch = contact.phone || contact.contact_phone;
                    const leads: any = await getLeads(undefined, undefined, 1, 100, { exactPhone: phoneToSearch });
                    const leadsData = leads?.data || leads || [];
                    if (Array.isArray(leadsData)) {
                        for (const l of leadsData) {
                            if (l.pipeline_id && l.stage_id) {
                                assignments.push({
                                    leadId: l.id,
                                    pipelineId: l.pipeline_id,
                                    stageId: l.stage_id
                                });
                            }
                        }
                    }
                }
                
                setActiveAssignments(assignments);
                if (assignments.length > 0 && !selectedPipelineId && !isOpen) {
                    setSelectedPipelineId(assignments[0].pipelineId);
                }
                
                if (!selectedPipelineId && assignments.length === 0) {
                    setIsDropdownOpen(true);
                }

                // Pre-load stages for any active assignments so badges render correctly
                const newStagesCache = { ...stagesCache };
                let cacheChanged = false;
                for (const a of assignments) {
                    if (!globalStagesPromises[a.pipelineId]) {
                        globalStagesPromises[a.pipelineId] = getPipelineStages(a.pipelineId).catch(err => {
                            delete globalStagesPromises[a.pipelineId]; // Clear cache on error
                            throw err;
                        });
                    }
                    try {
                        const sData = await globalStagesPromises[a.pipelineId];
                        if (newStagesCache[a.pipelineId] !== sData) {
                            newStagesCache[a.pipelineId] = sData;
                            cacheChanged = true;
                        }
                    } catch (e) {
                        console.error("Failed to load stages for pipeline", a.pipelineId, e);
                    }
                }
                if (cacheChanged) {
                    setStagesCache(newStagesCache);
                }

            } catch (err) {
                console.error("Failed to load initial assignment data", err);
            }
        };
        
        loadInitialData();
    }, [leadId, contact.phone, contact.contact_phone]);

    useEffect(() => {
        if (selectedPipelineId && !stagesCache[selectedPipelineId]) {
            if (!globalStagesPromises[selectedPipelineId]) {
                globalStagesPromises[selectedPipelineId] = getPipelineStages(selectedPipelineId).catch(err => {
                    delete globalStagesPromises[selectedPipelineId];
                    throw err;
                });
            }
            globalStagesPromises[selectedPipelineId].then(sData => {
                setStagesCache(prev => ({ ...prev, [selectedPipelineId]: sData }));
            }).catch(console.error);
        }
    }, [selectedPipelineId]);

    const loadPipelines = async () => {
        setIsLoading(true);
        try {
            const data = await getPipelines();
            setPipelines(data);
        } catch (error) {
            console.error('Failed to load pipelines', error);
        } finally {
            setIsLoading(false);
        }
    };



    const handleStageSelect = async (stageId: string) => {
        setIsSaving(true);
        try {
            let result: Lead | null = null;
            
            // Find if there's already an active assignment for this specific pipeline
            const existingAssignment = activeAssignments.find(a => a.pipelineId === selectedPipelineId);
            
            if (existingAssignment) {
                // Update the existing lead in that pipeline to the new stage
                result = await updateLead(existingAssignment.leadId, { pipeline_id: selectedPipelineId!, stage_id: stageId });
            } else {
                // Create a new lead for this pipeline
                result = await createLead({
                    name: contact.name || contact.contact_name || 'Unnamed Contact',
                    email: contact.email || '',
                    phone: contact.phone || contact.contact_phone || '',
                    company: contact.company || contact.custom_data?.company || '',
                    pipeline_id: selectedPipelineId!,
                    stage_id: stageId,
                    source: contact.source || 'Manual'
                });
            }

            if (result && onAssignmentComplete) {
                onAssignmentComplete(result);
            }
            
            // Update local state to reflect changes instantly
            if (result) {
                setActiveAssignments(prev => {
                    const filtered = prev.filter(a => a.pipelineId !== selectedPipelineId);
                    return [...filtered, { leadId: result!.id, pipelineId: selectedPipelineId!, stageId: stageId }];
                });
            }
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to assign pipeline', error);
            alert('Failed to assign pipeline. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // Helper to render a badge
    const renderBadge = (assignment: { leadId: string, pipelineId: string, stageId: string }) => {
        const currentPipeline = pipelines.find(p => p.id === assignment.pipelineId) || { name: '...' };
        const currentStage = (stagesCache[assignment.pipelineId] || []).find(s => s.id === assignment.stageId) || { name: '...', color: '#3b82f6' };
        
        return (
            <button 
                key={assignment.leadId} 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    setSelectedPipelineId(assignment.pipelineId); 
                    setIsOpen(true); 
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all" 
                title={`Pipeline: ${currentPipeline.name}`}
            >
                <div 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: (currentStage as any).color || '#3b82f6' }}
                />
                <div className="flex items-center gap-1.5 leading-none">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-tight truncate max-w-[100px]">
                        {currentPipeline.name}
                    </span>
                    <span className="text-slate-300 font-bold text-[10px]">-</span>
                    <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[100px]">
                        {currentStage.name}
                    </span>
                </div>
            </button>
        );
    };

    return (
        <div className="relative flex flex-nowrap gap-1.5 items-center">
            {activeAssignments.length > 0 && renderBadge(activeAssignments[0])}

            {activeAssignments.length > 1 && (
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
                    className="flex items-center justify-center px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition-colors text-[10px] font-bold"
                    title="Manage Pipelines"
                >
                    +{activeAssignments.length - 1}
                </button>
            )}

            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
                className="flex items-center justify-center p-1.5 shrink-0 rounded-lg hover:bg-slate-100 transition-all group border border-dashed border-slate-300 hover:border-[var(--color-brand)] bg-slate-50/50"
                title="Add to Pipeline"
            >
                <PlusIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--color-brand)] transition-colors" />
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Pipeline Assignment"
                size="md"
            >
                <div className="flex flex-col max-h-[65vh] overflow-hidden bg-slate-50/30">
                    <div className="overflow-y-auto p-4 space-y-6">
                        {/* Pipeline Selection */}
                        <div className="flex flex-col gap-2 relative">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider px-1">
                                Select Pipeline
                            </label>
                            
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 transition-all duration-300 w-full bg-white shadow-sm hover:shadow-md ${
                                    isDropdownOpen ? 'border-[var(--color-brand)] ring-4 ring-[var(--color-brand)]/10' : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center">
                                        <BriefcaseIcon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">
                                        {selectedPipelineId 
                                            ? (pipelines.find(p => p.id === selectedPipelineId)?.name || 'Unknown Pipeline') 
                                            : 'Choose a pipeline...'}
                                    </span>
                                </div>
                                <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col gap-2 mt-1">
                                    {isLoading ? (
                                        <div className="text-center py-6 text-slate-400 text-sm animate-pulse bg-white rounded-2xl border border-slate-100">Loading pipelines...</div>
                                    ) : pipelines.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 text-sm italic bg-white rounded-2xl border border-slate-100">No pipelines found.</div>
                                    ) : (
                                        <div className="bg-white border-2 border-slate-100 rounded-2xl shadow-lg overflow-hidden flex flex-col max-h-[40vh]">
                                            <div className="p-3 border-b border-slate-50 bg-slate-50/50 sticky top-0 z-10">
                                                <div className="relative">
                                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search pipelines..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent transition-all shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto p-2 flex flex-col gap-1">
                                                {pipelines.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => {
                                                    const isAlreadyAssigned = activeAssignments.some(a => a.pipelineId === p.id);
                                                    const isSelected = selectedPipelineId === p.id;
                                                    
                                                    return (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => {
                                                                setSelectedPipelineId(p.id);
                                                                setIsDropdownOpen(false);
                                                            }}
                                                            className={`relative flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 group ${
                                                                isSelected 
                                                                    ? 'bg-[var(--color-brand)]/10 text-[var(--color-brand)]' 
                                                                    : 'hover:bg-slate-50 bg-white'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-2 h-2 rounded-full ${isAlreadyAssigned ? 'bg-emerald-500' : 'bg-slate-200 group-hover:bg-slate-300'}`} />
                                                                <span className={`text-sm font-bold tracking-tight ${isSelected ? 'text-[var(--color-brand)]' : 'text-slate-700'}`}>
                                                                    {p.name}
                                                                </span>
                                                            </div>
                                                            {isAlreadyAssigned && (
                                                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
                                                                    <CheckIcon className="w-3 h-3 text-emerald-600" />
                                                                </div>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Stage Selection */}
                        {selectedPipelineId && !isDropdownOpen && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 px-1">
                                    Select Stage
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(stagesCache[selectedPipelineId] || []).map(s => {
                                        const isActiveStage = activeAssignments.some(a => a.pipelineId === selectedPipelineId && a.stageId === s.id);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => handleStageSelect(s.id)}
                                                disabled={isSaving}
                                                className={`flex flex-col items-start p-3.5 rounded-2xl border-2 transition-all duration-300 group overflow-hidden relative ${
                                                    isActiveStage 
                                                        ? 'border-emerald-500 bg-emerald-50/80 shadow-md' 
                                                        : 'border-white hover:border-slate-200 bg-white hover:shadow-md hover:-translate-y-[1px] shadow-sm'
                                                }`}
                                            >
                                                {isActiveStage && (
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                                )}
                                                <div 
                                                    className="w-full h-1.5 rounded-full mb-3 shadow-inner transition-transform duration-300 group-hover:scale-y-125" 
                                                    style={{ backgroundColor: s.color || '#3b82f6' }}
                                                />
                                                <span className={`text-sm font-bold tracking-tight ${isActiveStage ? 'text-emerald-800' : 'text-slate-700'}`}>
                                                    {s.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {isSaving && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-8 h-8 border-3 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-bold text-slate-600">Assigning...</span>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default PipelineAssignment;
