import React, { useState, useEffect } from 'react';
import { getForms } from '../../services/lead-management-api';
import { FormDefinition } from '../../types/lead-management';
import { CheckFormData } from '../../types';

import { SettingsModal, PanelTextInput } from '../SettingsPanel';
import { ConditionIcon } from '../icons';
import { Node, Edge } from '../../types';

interface CheckFormSettingsProps {
    selectedNode: Node & { data: CheckFormData };
    nodes: Node[];
    edges: Edge[];
    onUpdateNode: (id: string, data: any) => void;
    onClose: () => void;
    availableVariables?: any[];
    canWrite?: boolean;
}

const CheckFormSettings: React.FC<CheckFormSettingsProps> = ({ selectedNode, onUpdateNode, onClose, availableVariables = [], canWrite }) => {
    const data = selectedNode.data;
    const onChange = (updates: Partial<CheckFormData>) => onUpdateNode(selectedNode.id, { ...data, ...updates });

    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchForms = async () => {
            try {
                const fetchedForms = await getForms();
                setForms(fetchedForms);
                
                // Set default form if none selected and forms exist
                if (!data.formId && fetchedForms.length > 0 && fetchedForms[0].id) {
                    onChange({ formId: fetchedForms[0].id });
                }
            } catch (error) {
                console.error("Failed to load forms", error);
            } finally {
                setLoading(false);
            }
        };
        fetchForms();
    }, []);

    return (
        <SettingsModal title="Check Form" onClose={onClose} icon={<ConditionIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Select Form to Check</label>
                    <div className="text-xs text-slate-500 mb-3">
                        This node will check if the current contact has submitted the selected form. It will route to 'Yes' if submitted, and 'No' if not.
                    </div>
                {loading ? (
                    <div className="text-slate-400 text-sm">Loading forms...</div>
                ) : forms.length === 0 ? (
                    <div className="text-red-400 text-sm p-3 bg-red-950/30 rounded-lg border border-red-900/50">
                        No forms found. Please create a form first.
                    </div>
                ) : (
                    <select
                        value={data.formId || ''}
                        onChange={(e) => onChange({ formId: e.target.value })}
                        className="w-full p-2.5 bg-slate-950 border border-slate-700 text-slate-200 rounded-lg shadow-sm text-sm outline-none transition-colors focus:ring-brand-500 focus:border-brand-500"
                    >
                        <option value="" disabled>-- Select a form --</option>
                        {forms.map(f => (
                            <option key={f.id} value={f.id}>
                                {f.name}
                            </option>
                        ))}
                    </select>
                )}
                </div>
                
                <div className="pt-4 border-t border-slate-800">
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Or Manual Form ID (Supports Variables)</label>
                    <div className="text-xs text-slate-500 mb-3">
                        If provided, this overrides the dropdown selection above. You can drag & drop or click variables from the sidebar to insert them.
                    </div>
                    <PanelTextInput
                        value={data.manualFormId || ''}
                        onChange={(val) => onChange({ manualFormId: val })}
                        placeholder="e.g. {{contact.custom_form_id}}"
                    />
                </div>
                <div className="pt-4 border-t border-slate-800">
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">Contact Phone Number (Supports Variables)</label>
                    <div className="text-xs text-slate-500 mb-3">
                        By default, the flow uses the current contact's phone. You can override it here (e.g. to search for a specific number).
                    </div>
                    <PanelTextInput
                        value={data.manualContactPhone || ''}
                        onChange={(val) => onChange({ manualContactPhone: val })}
                        placeholder="Leave blank for default, or e.g. {{contact.phone}}"
                    />
                </div>
            </div>
        </SettingsModal>
    );
};

export default CheckFormSettings;
