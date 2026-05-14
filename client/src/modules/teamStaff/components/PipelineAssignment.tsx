import React, { useState, useEffect } from 'react';
import { getPipelines, getPipelineStages, moveLeadToStage, updateLead, createLead } from '../../../services/lead-management-api';
import Modal from '../../../components/Modal';
import { Pipeline, PipelineStage, Lead } from '../../../types/lead-management';
import { BriefcaseIcon, ChevronRightIcon, CheckIcon, PlusIcon } from '../../../components/icons';

interface PipelineAssignmentProps {
    leadId?: string;
    contact: any; // Can be a Lead or a Contact
    onAssignmentComplete?: (updatedLead: Lead) => void;
}

const PipelineAssignment: React.FC<PipelineAssignmentProps> = ({ leadId, contact, onAssignmentComplete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(contact.pipeline_id || null);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadPipelines();
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedPipelineId) {
            loadStages(selectedPipelineId);
        } else {
            setStages([]);
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

    const loadStages = async (pipelineId: string) => {
        try {
            const data = await getPipelineStages(pipelineId);
            setStages(data);
        } catch (error) {
            console.error('Failed to load stages', error);
        }
    };

    const handleStageSelect = async (stageId: string) => {
        setIsSaving(true);
        try {
            let result: Lead | null = null;
            
            if (leadId) {
                // It's already a lead, just update/move
                if (contact.pipeline_id === selectedPipelineId) {
                    result = await moveLeadToStage(leadId, stageId);
                } else {
                    result = await updateLead(leadId, { pipeline_id: selectedPipelineId!, stage_id: stageId });
                }
            } else {
                // It's a contact, create as a new lead
                result = await createLead({
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    company: contact.company || contact.custom_data?.company,
                    pipeline_id: selectedPipelineId!,
                    stage_id: stageId,
                    source: contact.source || 'Manual'
                });
            }

            if (result && onAssignmentComplete) {
                onAssignmentComplete(result);
            }
            setIsOpen(false);
        } catch (error) {
            console.error('Failed to assign pipeline', error);
            alert('Failed to assign pipeline. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const currentStage = stages.find(s => s.id === contact.stage_id);
    const currentPipeline = pipelines.find(p => p.id === selectedPipelineId) || pipelines.find(p => p.id === contact.pipeline_id);

    return (
        <div className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
                className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-slate-100 transition-all group border border-transparent hover:border-slate-200"
                title="Assign Pipeline"
            >
                {contact.pipeline_id ? (
                    <div className="flex items-center gap-2">
                        <div 
                            className="w-2.5 h-2.5 rounded-full shadow-sm" 
                            style={{ backgroundColor: currentStage?.color || '#3b82f6' }}
                        />
                        <div className="flex flex-col items-start leading-none">
                            <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight truncate max-w-[100px]">
                                {currentPipeline?.name || 'Loading...'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                {currentStage?.name || 'No Stage'}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 group-hover:border-[var(--color-brand)] group-hover:text-[var(--color-brand)] transition-colors">
                            <PlusIcon className="w-3 h-3" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-[var(--color-brand)] uppercase tracking-tight">
                            Add to Pipeline
                        </span>
                    </div>
                )}
            </button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Pipeline Assignment"
                size="md"
            >
                <div className="space-y-6 py-2">
                    {/* Pipeline Selection */}
                    <div>
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 px-1">
                            Select Pipeline
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {isLoading ? (
                                <div className="text-center py-4 text-slate-400 text-sm animate-pulse">Loading pipelines...</div>
                            ) : pipelines.length === 0 ? (
                                <div className="text-center py-4 text-slate-400 text-sm italic">No pipelines found.</div>
                            ) : (
                                pipelines.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPipelineId(p.id)}
                                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all ${
                                            selectedPipelineId === p.id 
                                                ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/[0.03] shadow-sm' 
                                                : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[var(--color-brand)] shadow-sm">
                                                <BriefcaseIcon className="w-4 h-4" />
                                            </div>
                                            <span className={`text-sm font-bold ${selectedPipelineId === p.id ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {p.name}
                                            </span>
                                        </div>
                                        {selectedPipelineId === p.id && (
                                            <div className="w-5 h-5 rounded-full bg-[var(--color-brand)] flex items-center justify-center">
                                                <CheckIcon className="w-3 h-3 text-white" />
                                            </div>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Stage Selection */}
                    {selectedPipelineId && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 px-1">
                                Select Stage
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {stages.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleStageSelect(s.id)}
                                        disabled={isSaving}
                                        className={`flex flex-col items-start p-3 rounded-xl border-2 transition-all group ${
                                            contact.stage_id === s.id 
                                                ? 'border-emerald-500 bg-emerald-50/50' 
                                                : 'border-slate-100 hover:border-slate-200 bg-slate-50/30'
                                        }`}
                                    >
                                        <div 
                                            className="w-full h-1.5 rounded-full mb-2 opacity-60 group-hover:opacity-100 transition-opacity" 
                                            style={{ backgroundColor: s.color || '#3b82f6' }}
                                        />
                                        <span className={`text-xs font-bold ${contact.stage_id === s.id ? 'text-emerald-700' : 'text-slate-600'}`}>
                                            {s.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

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
