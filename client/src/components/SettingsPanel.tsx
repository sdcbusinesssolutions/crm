import React, { ReactNode, useState, useMemo } from 'react';
import { Node, NodeType, OnMessageData, MediaMessageData, SetWebhookData, ListMessageData, CTAMessageData, QuickReplyMessageData, AskAnythingData, AskInputData, CheckConditionData, WriteAttributeData, MediaType, CallApiData, TemplateMessageData, SwitchData, ManageTagsData, ManageGroupsData, ContactGroup, Edge, TimingData, SendFlowData, CarouselMessageData, CarouselCard, ConditionRule, ConditionGroup, ListItem, AnyNodeData, GsheetData, GmailData, TextMessageData, WebhookData, AskLocationData, CodeData, ContactPipelineData, PipelineTriggerData, TaskReminderData, CalendarData, SheetTriggerData, AIAgentData, SmtpData, NotifyData } from '../types';
import { MessageIcon, ImageFileIcon, WebhookIcon, TimingIcon, ListIcon, QuickReplyIcon, CtaIcon, GsheetIcon, CodeIcon, AskLocationIcon, TrashIcon, EditIcon, SettingsIcon, ConditionIcon, BookmarkIcon, SetWebhookIcon, TriggerIcon, CopyIcon, FlowIcon, CallApiIcon, TagIcon, PlusIcon, CloseIcon, UsersIcon, ClockIcon, CarouselIcon, InfoIcon, GmailIcon, CalendarIcon, RobotIcon } from './icons';
import { supabase } from '../lib/supabase';
import { tagService, Tag } from '../services/tagService';
import { contactGroupService } from '../services/contactGroupService';
import { integrationsService } from '../services/integrationsService';
import { aiAgentService } from '../services/aiAgentService';
import DroppableInput from './DroppableInput';
import VariableSidebar from './VariableSidebar';
import { getAvailableVariables, NodeVariables } from '../utils/flowVariables';

interface SettingsPanelProps {
    selectedNode: Node | null;
    nodes: Node[];
    edges: Edge[];
    // HMR Force Update
    onUpdateNode: (nodeId: string, data: any) => void;
    onClose: () => void;
    onShowNotification: (message: string, type?: 'success' | 'error') => void;
    canWrite?: boolean;
}

type PanelTheme = 'light' | 'dark';

const selectClasses: Record<PanelTheme, string> = {
    dark: "bg-slate-950 border-slate-700 text-slate-200 focus:ring-brand-500 focus:border-brand-500",
    light: "bg-white border-gray-300 text-gray-900 focus:ring-brand-500 focus:border-brand-500"
}

const SettingsContext = React.createContext<{
    activeInputSetter: ((token: string) => void) | null;
    setActiveInputSetter: (setter: (token: string) => void) => void;
    activeInputId: string | null;
    setActiveInputId: (id: string | null) => void;
    showNotification: (message: string, type?: 'success' | 'error') => void;
}>({ activeInputSetter: null, setActiveInputSetter: () => { }, activeInputId: null, setActiveInputId: () => { }, showNotification: () => { } });

const PanelTextInput: React.FC<{ value: string; onChange: (val: string) => void; placeholder?: string; maxLength?: number; className?: string; theme?: PanelTheme; type?: string; disabled?: boolean; availableVariables?: NodeVariables[] }> = (props) => {
    const { setActiveInputSetter, setActiveInputId, activeInputId } = React.useContext(SettingsContext);
    const id = React.useMemo(() => `input-${Math.random().toString(36).substr(2, 9)}`, []);
    return <DroppableInput {...props} id={id} multiline={false} onFocus={(setter) => { !props.disabled && setActiveInputSetter(setter); !props.disabled && setActiveInputId(id); }} isActive={activeInputId === id} disabled={props.disabled} />;
};

const PanelTextarea: React.FC<{ value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; maxLength?: number; className?: string; theme?: PanelTheme; availableVariables?: NodeVariables[] }> = (props) => {
    const { setActiveInputSetter, setActiveInputId, activeInputId } = React.useContext(SettingsContext);
    const id = React.useMemo(() => `textarea-${Math.random().toString(36).substr(2, 9)}`, []);
    return <DroppableInput {...props} id={id} multiline={true} onFocus={(setter) => { setActiveInputSetter(setter); setActiveInputId(id); }} isActive={activeInputId === id} />;
};

const PanelNumberInput: React.FC<{ value: number; onChange: (val: number) => void; min?: number; max?: number; className?: string; theme?: PanelTheme; availableVariables?: NodeVariables[] }> = ({ value, onChange, min, max, className, theme = 'dark' }) => (
    <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} min={min} max={max} className={`w-full p-2.5 border rounded-lg shadow-sm text-sm outline-none transition-colors ${theme === 'dark' ? "bg-slate-950 border-slate-700 text-slate-200" : "bg-white border-gray-300"} ${className || ''}`} />
);

const PanelSelect: React.FC<{ value: string, onChange: (val: string) => void, options: (string | { label: string, value: string })[], theme?: PanelTheme, className?: string }> = ({ value, onChange, options, theme = 'dark', className }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`w-full p-2.5 border rounded-lg shadow-sm text-sm outline-none transition-colors ${selectClasses[theme]} ${className}`}>
        {options.map(opt => (typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
);

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
    </label>
);

const FieldRow: React.FC<{ label: string; description?: string; children: ReactNode; }> = ({ label, description, children }) => (
    <div className="flex justify-between items-center py-3 border-b border-slate-800/50 last:border-0">
        <div className="pr-4"><p className="font-medium text-slate-300 text-sm">{label}</p>{description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}</div>
        <div className="shrink-0">{children}</div>
    </div>
);

// Modified SettingsModal to include VariableSidebar
const SettingsModal: React.FC<{ children: ReactNode, title: string, onClose: () => void, icon?: ReactNode, footer?: ReactNode, availableVariables?: NodeVariables[], canWrite?: boolean }> = ({ children, title, onClose, icon, footer, availableVariables = [], canWrite = true }) => {
    const { activeInputSetter } = React.useContext(SettingsContext);
    const [showMobileVariables, setShowMobileVariables] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2000);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-6">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-900 w-full h-full sm:h-[85vh] sm:max-w-5xl sm:rounded-2xl shadow-2xl flex border border-slate-800 animate-slide-up sm:animate-fade-in z-10 overflow-hidden">

                {/* Left Side: Settings Form */}
                <div className="flex-1 flex flex-col min-w-0">
                    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
                        <div className="flex items-center space-x-3 text-white">{icon && <span className="text-brand-500">{icon}</span>}<h2 className="text-lg font-bold tracking-tight">{title}</h2></div>
                        <div className="flex items-center gap-3">
                            {availableVariables.length > 0 && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMobileVariables(true);
                                    }}
                                    className={`md:hidden text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border transition-colors ${activeInputSetter ? 'bg-brand-500 text-white border-brand-500 shadow-lg shadow-brand-500/20' : 'text-brand-400 bg-brand-500/10 border-brand-500/20'}`}
                                >
                                    Variables
                                </button>
                            )}
                            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900">
                        <fieldset disabled={!canWrite} className="space-y-6 contents">
                            {children}
                        </fieldset>
                    </div>
                     <footer className="px-6 py-4 border-t border-slate-800 bg-slate-900 shrink-0 safe-pb">
                        {footer || (
                            <button onClick={onClose} className="w-full px-4 py-3 bg-brand-600 text-white rounded-btn hover:bg-brand-700 text-sm font-bold shadow-lg shadow-brand-900/20 transition-all active:scale-95">
                                {canWrite ? 'Save & Close' : 'Close'}
                            </button>
                        )}
                    </footer>
                </div>

                {/* Right Side: Variable Sidebar (Desktop) */}
                {availableVariables.length > 0 && (
                    <div className="hidden md:block w-72 border-l border-slate-800 bg-slate-900/50">
                        <VariableSidebar availableVariables={availableVariables} onVariableClick={activeInputSetter || undefined} />
                    </div>
                )}

                {/* Mobile Variable Sheet */}
                {showMobileVariables && (
                    <div className="fixed inset-0 z-[70] md:hidden flex flex-col justify-end">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMobileVariables(false)} />
                        <div className="relative bg-slate-900 w-full h-[60vh] rounded-t-2xl border-t border-slate-800 shadow-2xl flex flex-col animate-slide-up">
                            <div className="flex items-center justify-between p-4 border-b border-slate-800">
                                <div className="flex flex-col">
                                    <h3 className="font-bold text-white text-sm uppercase tracking-wider">Select Variable</h3>
                                    <p className="text-[10px] text-emerald-400">
                                        Tap to copy to clipboard
                                    </p>
                                </div>
                                <button onClick={() => setShowMobileVariables(false)} className="text-slate-500 hover:text-white"><CloseIcon className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <VariableSidebar
                                    availableVariables={availableVariables}
                                    onVariableClick={(token) => {
                                        // Always copy to clipboard on mobile for reliability
                                        navigator.clipboard.writeText(token);
                                        // Also try to insert if we have a setter
                                        if (activeInputSetter) {
                                            activeInputSetter(token);
                                        }
                                        setShowMobileVariables(false);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ATTRIBUTES = ['None', 'Name', 'Email', 'Phone Number', 'Gender', 'City', 'Create New Variable'];
const TIMEOUTS = ['1 min', '5 min', '10 min', '15 min', '1 hrs', '24 hrs'];

const ResponseHandlingFields: React.FC<{ data: any; onUpdate: (u: any) => void, allowSaveResponse?: boolean }> = ({ data, onUpdate, allowSaveResponse = false }) => {

    const handleAttributeChange = (value: string) => { const update: any = { saveResponseAttribute: value }; if (value !== 'Create New Variable') update.saveResponseNewAttribute = ''; onUpdate(update); };

    // Parse timeout value and unit
    const timeoutStr = data.unresponsiveTimeout || '10 min';
    const [valStr, unitStr] = timeoutStr.split(' ');
    const timeoutVal = parseFloat(valStr) || 10;
    const timeoutUnit = unitStr || 'min';

    const handleTimeoutChange = (val: number, unit: string) => {
        onUpdate({ unresponsiveTimeout: `${val} ${unit}` });
    };

    return (
        <div className="border-t border-slate-800 pt-4 mt-2">
            {allowSaveResponse && (
                <>
                    <FieldRow label="Validate response" description="Check input against rules."><ToggleSwitch checked={!!data.validateResponse} onChange={checked => onUpdate({ validateResponse: checked })} /></FieldRow>
                    <FieldRow label="Save response"><ToggleSwitch checked={!!data.saveResponse} onChange={checked => onUpdate({ saveResponse: checked })} /></FieldRow>
                    {data.saveResponse && (
                        <div className="pl-0 pb-3 space-y-2 bg-slate-800/30 p-3 rounded-lg border border-slate-800 mb-3 animate-fade-in">
                            <label className="text-xs text-slate-400 font-bold uppercase">Attribute</label>
                            <PanelSelect value={data.saveResponseAttribute || 'None'} onChange={handleAttributeChange} options={ATTRIBUTES} />
                            {data.saveResponseAttribute === 'Create New Variable' && <PanelTextInput value={data.saveResponseNewAttribute || ''} onChange={value => onUpdate({ saveResponseNewAttribute: value })} placeholder="Enter new variable name" />}
                        </div>
                    )}
                </>
            )}
            <FieldRow label="Unresponsive timeout"><ToggleSwitch checked={data.ifUnresponsive} onChange={checked => onUpdate({ ifUnresponsive: checked })} /></FieldRow>
            {data.ifUnresponsive && (
                <div className="pl-0 pb-3 bg-slate-800/30 p-3 rounded-lg border border-slate-800 animate-fade-in">
                    <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Wait Time</label>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <PanelNumberInput
                                value={timeoutVal}
                                onChange={val => handleTimeoutChange(val, timeoutUnit)}
                            />
                        </div>
                        <div className="w-32">
                            <PanelSelect
                                value={timeoutUnit}
                                onChange={unit => handleTimeoutChange(timeoutVal, unit)}
                                options={[
                                    { label: 'Minutes', value: 'min' },
                                    { label: 'Hours', value: 'hours' },
                                    { label: 'Days', value: 'days' }
                                ]}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Specific Panels ---

const CheckConditionSettingsPanel: React.FC<{ selectedNode: Node & { data: CheckConditionData }; nodes: Node[]; edges: Edge[]; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, nodes, edges, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updatedData: Partial<CheckConditionData>) => onUpdateNode(selectedNode.id, { ...data, ...updatedData });

    const addConditionBlock = () => handleUpdate({ conditions: [...data.conditions, { id: `cg-${Date.now()}`, name: `Block-${data.conditions.length + 1}`, rules: [{ id: `cr-${Date.now()}`, attribute: 'Name', operator: 'is', value: '' }] }] });
    const removeConditionBlock = (blockId: string) => handleUpdate({ conditions: data.conditions.filter(c => c.id !== blockId) });
    const addRule = (blockId: string) => handleUpdate({ conditions: data.conditions.map(c => c.id === blockId ? { ...c, rules: [...c.rules, { id: `cr-${Date.now()}`, logicalOperator: 'AND', attribute: 'Name', operator: 'is', value: '' }] } : c) });
    const removeRule = (blockId: string, ruleId: string) => handleUpdate({ conditions: data.conditions.map(c => c.id === blockId ? { ...c, rules: c.rules.filter(r => r.id !== ruleId) } : c) });
    const handleRuleChange = (blockId: string, ruleId: string, field: keyof ConditionRule, value: string) => handleUpdate({ conditions: data.conditions.map(c => c.id === blockId ? { ...c, rules: c.rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r) } : c) });

    return (
        <SettingsModal title="Condition Block" onClose={onClose} icon={<ConditionIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <p className="text-sm text-slate-400 mb-4">Rules are checked sequentially.</p>
            {data.conditions.map((group) => (
                <div key={group.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 shadow-sm space-y-3 relative group">
                    <div className="flex items-center justify-between mb-2">
                        <input type="text" value={group.name} onChange={(e) => {/* */ }} className="font-bold text-white bg-transparent focus:outline-none rounded px-1 w-full text-sm" readOnly />
                        <button onClick={() => removeConditionBlock(group.id)} className="text-slate-500 hover:text-red-500 transition-colors p-1"><TrashIcon /></button>
                    </div>
                    <div className="space-y-3">
                        {group.rules.map((rule, idx) => (
                            <div key={rule.id} className="space-y-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700/50">
                                {idx > 0 && <div className="flex justify-center"><PanelSelect value={rule.logicalOperator || 'AND'} onChange={val => handleRuleChange(group.id, rule.id, 'logicalOperator', val)} options={['AND', 'OR']} className="w-20 text-xs font-bold py-1 h-8 text-center" /></div>}
                                <PanelTextInput value={rule.attribute} onChange={val => handleRuleChange(group.id, rule.id, 'attribute', val)} placeholder="Attribute (e.g. Name, {{var}})" />
                                <PanelSelect value={rule.operator} onChange={val => handleRuleChange(group.id, rule.id, 'operator', val)} options={[
                                    'exists', 'does not exist', 'is empty', 'is not empty',
                                    'is', 'is not', 'is equal to', 'is not equal to',
                                    'contains', 'does not contain',
                                    'starts with', 'does not start with',
                                    'ends with', 'does not end with',
                                    'matches regex', 'does not match regex',
                                    '>', '<', '>=', '<=',
                                    'greater than', 'less than'
                                ]} />
                                <div className="flex items-center gap-2"><PanelTextInput value={rule.value} onChange={val => handleRuleChange(group.id, rule.id, 'value', val)} placeholder="Value" /><button onClick={() => removeRule(group.id, rule.id)} className="text-slate-500 hover:text-red-400 p-1"><CloseIcon className="w-4 h-4" /></button></div>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => addRule(group.id)} className="w-full mt-2 py-2 text-xs flex items-center justify-center space-x-1 text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 rounded-lg font-bold transition-colors border border-dashed border-brand-500/30"><PlusIcon /><span>Add Rule</span></button>
                </div>
            ))}
            <button onClick={addConditionBlock} className="w-full py-3 text-sm flex items-center justify-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white rounded-btn font-bold shadow-lg transition-all"><PlusIcon /><span>Add Condition Block</span></button>
        </SettingsModal>
    )
};

const AskAnythingSettingsPanel: React.FC<{ selectedNode: Node & { data: AskAnythingData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const data = selectedNode.data;
    const handleUpdate = (updatedFields: Partial<AskAnythingData>) => onUpdateNode(selectedNode.id, { ...data, ...updatedFields });
    return (
        <SettingsModal title="Ask Question" onClose={onClose} icon={<MessageIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Question Text</label><PanelTextarea value={data.text} onChange={val => handleUpdate({ text: val })} placeholder="Type your question here..." rows={4} maxLength={1024} /></div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} allowSaveResponse={true} />
        </SettingsModal>
    );
}

const SetWebhookSettingsPanel: React.FC<{ selectedNode: Node & { data: SetWebhookData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const { showNotification } = React.useContext(SettingsContext);
    const [sampleJson, setSampleJson] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    // Generate webhookId if missing
    React.useEffect(() => {
        const updates: any = {};
        if (!data.webhookId) {
            updates.webhookId = Math.random().toString(36).substring(2, 10);
        }
        if (!data.outputVariables) {
            updates.outputVariables = [];
        }
        if (Object.keys(updates).length > 0) {
            onUpdateNode(selectedNode.id, { ...data, ...updates });
        }
    }, [data.webhookId, data.outputVariables]);

    const [isCapturing, setIsCapturing] = useState(false);
    const [captureStatus, setCaptureStatus] = useState<string | null>(null);

    const handleDataChange = (key: keyof SetWebhookData, value: any) => onUpdateNode(selectedNode.id, { ...data, [key]: value });

    const handleJsonChange = (val: string) => {
        setSampleJson(val);
        try {
            if (!val.trim()) {
                handleDataChange('outputVariables', []);
                setJsonError(null);
                return;
            }
            const parsed = JSON.parse(val);

            const getKeys = (obj: any): string[] => {
                const keys = new Set<string>();
                const traverse = (o: any, prefix = '') => {
                    if (typeof o !== 'object' || o === null) return;
                    for (const key in o) {
                        if (Object.prototype.hasOwnProperty.call(o, key)) {
                            const newKey = prefix ? `${prefix}.${key}` : key;
                            keys.add(newKey);

                            const val = o[key];
                            if (typeof val === 'object' && val !== null) {
                                traverse(val, newKey);
                            }
                        }
                    }
                };
                traverse(obj);
                return Array.from(keys);
            };

            const keys = getKeys(parsed);
            handleDataChange('outputVariables', keys);
            setJsonError(null);
        } catch (e) {
            setJsonError('Invalid JSON');
        }
    };

    // Capture Logic
    React.useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isCapturing) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/webhooks/${data.webhookId}/latest`);
                    const json = await res.json();
                    if (json.found) {
                        const payloadStr = JSON.stringify(json.payload, null, 2);
                        // Only update if different to avoid loops/jitters, though handleJsonChange handles state
                        if (payloadStr !== sampleJson) {
                            handleJsonChange(payloadStr);
                            setIsCapturing(false);
                            setCaptureStatus('Captured successfully!');
                            setTimeout(() => setCaptureStatus(null), 3000);
                        }
                    }
                } catch (e) {
                    console.error('Capture error:', e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [isCapturing, data.webhookId, sampleJson]);

    // Construct Dynamic URL
    // We need the phoneNumberId. Since we don't have it in props, we'll use a placeholder or fetch it.
    // Ideally, this should be fetched from context or global state.
    // For now, we'll use a placeholder that the user can replace or we'll fetch it if possible.
    // Assuming the user knows their Phone Number ID or we can display a generic format.
    const [phoneNumberId, setPhoneNumberId] = useState('PHONE_NUMBER_ID');

    React.useEffect(() => {
        const fetchConfig = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data } = await supabase.from('whatsapp_config').select('phone_number_id').eq('user_id', session.user.id).single();
                if ((data as any)?.phone_number_id) setPhoneNumberId((data as any).phone_number_id);
            }
        };
        fetchConfig();
    }, []);

    const dynamicUrl = `${window.location.origin}/api/webhooks/${phoneNumberId}/${data.webhookId}/webhook`;

    return (
        <SettingsModal title="Set Webhook (Incoming)" onClose={onClose} icon={<SetWebhookIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">Dynamic Webhook URL</label>
                    <p className="text-xs text-slate-400 mb-3">
                        Use this URL to trigger this flow step from an external service.
                        The request body will be captured and available as variables.
                    </p>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-slate-950 p-3 rounded-lg text-xs font-mono text-emerald-400 break-all border border-slate-800">
                            {dynamicUrl}
                        </code>
                        <button
                            onClick={() => { navigator.clipboard.writeText(dynamicUrl); showNotification('Copied!', 'success'); }}
                            className="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-lg border border-slate-700 transition-colors"
                            title="Copy URL"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" /><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" /></svg>
                        </button>
                    </div>
                    <p className="text-[10px] text-amber-500 mt-2">
                        * Ensure the external service sends the <strong>contact_phone</strong> in the JSON body to match the active session.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Define Output Variables</label>
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-xs text-slate-500">Paste a sample JSON or capture from a real request.</p>
                        <button
                            onClick={() => {
                                if (isCapturing) {
                                    setIsCapturing(false);
                                    setCaptureStatus(null);
                                } else {
                                    setIsCapturing(true);
                                    setCaptureStatus('Waiting for event...');
                                }
                            }}
                            className={`text-[10px] font-bold px-2 py-1 rounded border transition-all ${isCapturing ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' : 'bg-brand-500/10 text-brand-400 border-brand-500/20 hover:bg-brand-500/20'}`}
                        >
                            {isCapturing ? 'Stop Capturing' : 'Capture Response'}
                        </button>
                    </div>
                    {captureStatus && <p className="text-xs text-emerald-400 mb-2 font-bold">{captureStatus}</p>}
                    <PanelTextarea
                        value={sampleJson}
                        onChange={handleJsonChange}
                        placeholder='{"status": "success", "orderId": "12345"}'
                        rows={6}
                        className="font-mono text-xs"
                    />
                    {jsonError && <p className="text-xs text-red-400 mt-1">{jsonError}</p>}
                </div>

                {data.outputVariables && data.outputVariables.length > 0 && (
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Detected Variables</label>
                        <div className="flex flex-wrap gap-2">
                            {data.outputVariables.map(v => (
                                <span key={v} className="px-2 py-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded text-[10px] font-mono">
                                    response.{v}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </SettingsModal>
    );
};
const ListMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: ListMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[]; nodes: Node[]; edges: Edge[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables, nodes, edges }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<ListMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });

    const totalItems = (data.sections || []).reduce((acc, sec) => acc + sec.items.length, 0);

    // Helper functions for section management
    const addSection = () => {
        const newSection = { id: `sec-${Date.now()}`, title: 'New Section', items: [] };
        handleUpdate({ sections: [...(data.sections || []), newSection] });
    };

    const updateSectionTitle = (index: number, title: string) => {
        const newSections = [...data.sections];
        newSections[index] = { ...newSections[index], title };
        handleUpdate({ sections: newSections });
    };

    const removeSection = (index: number) => {
        if (window.confirm("Remove this section?")) {
            const newSections = data.sections.filter((_, i) => i !== index);
            handleUpdate({ sections: newSections });
        }
    };

    const addItem = (sectionIndex: number) => {
        if (totalItems >= 10) return;
        const newSections = [...data.sections];
        newSections[sectionIndex].items.push({ id: `item-${Date.now()}`, title: 'New Item', description: '' });
        handleUpdate({ sections: newSections });
    };

    const updateItem = (sectionIndex: number, itemIndex: number, field: keyof ListItem, val: string) => {
        const newSections = [...data.sections];
        newSections[sectionIndex].items[itemIndex] = { ...newSections[sectionIndex].items[itemIndex], [field]: val };
        handleUpdate({ sections: newSections });
    };

    const removeItem = (sectionIndex: number, itemIndex: number) => {
        const newSections = [...data.sections];
        newSections[sectionIndex].items = newSections[sectionIndex].items.filter((_, i) => i !== itemIndex);
        handleUpdate({ sections: newSections });
    };

    const getConnectedNodeName = (itemId: string) => {
        const edge = edges.find(e => e.source === selectedNode.id && e.sourceHandle === itemId);
        if (!edge) return 'Not Connected';
        const targetNode = nodes.find(n => n.id === edge.target);
        return targetNode?.data?.label || 'Unknown Node';
    };

    return (
        <SettingsModal title="List Message" onClose={onClose} icon={<ListIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Header (Optional)</label>
                        <PanelTextInput value={data.header || ''} onChange={val => handleUpdate({ header: val })} placeholder="Header text..." maxLength={60} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label>
                        <PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} maxLength={1024} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Footer (Optional)</label>
                        <PanelTextInput value={data.footer || ''} onChange={val => handleUpdate({ footer: val })} placeholder="Footer text..." maxLength={60} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Menu Button Text</label>
                        <PanelTextInput value={data.buttonText} onChange={val => handleUpdate({ buttonText: val })} placeholder="e.g., View Menu" maxLength={20} />
                    </div>
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Dynamic Sections (Advanced)</label>
                        <PanelTextInput
                            value={data.dynamicSections || ''}
                            onChange={val => handleUpdate({ dynamicSections: val })}
                            placeholder="e.g. {{calendar.list_sections}}"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">If set, this variable will be used to populate sections dynamically (max 10 items total). Manual sections will be appended if space permits.</p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Save Response to Variable</label>
                        <PanelTextInput
                            value={data.outputVariableName || ''}
                            onChange={val => handleUpdate({ outputVariableName: val })}
                            placeholder="e.g. selected_slot"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Variable name to store the selected item's details (ID, Title, Description).</p>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <label className="block text-xs font-bold text-brand-400 uppercase tracking-wider">Manual Sections</label>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${totalItems >= 10 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-300'}`}>
                                {totalItems}/10 Items (Manual)
                            </span>
                        </div>
                        <button onClick={addSection} className="text-xs flex items-center gap-1 bg-brand-600/20 text-brand-400 px-2 py-1 rounded hover:bg-brand-600/30 transition-colors"><PlusIcon className="w-3 h-3" /> Add Section</button>
                    </div>
                    <div className="space-y-4">
                        {data.sections.map((section, sIdx) => (
                            <div key={section.id} className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={section.title}
                                        onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                                        className="bg-transparent font-bold text-white text-sm focus:outline-none border-b border-transparent focus:border-brand-500 w-full"
                                        placeholder="Section Title"
                                    />
                                    <button onClick={() => removeSection(sIdx)} className="text-slate-500 hover:text-red-500 p-1"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                                <div className="space-y-2 pl-2 border-l-2 border-slate-700">
                                    {section.items.map((item, iIdx) => (
                                        <div key={item.id} className="flex flex-col gap-1 bg-slate-900/50 p-2 rounded border border-slate-800 group">
                                            <div className="flex justify-between items-start gap-2">
                                                <input
                                                    type="text"
                                                    value={item.title}
                                                    onChange={(e) => updateItem(sIdx, iIdx, 'title', e.target.value)}
                                                    className="bg-transparent text-xs font-medium text-white w-full focus:outline-none"
                                                    placeholder="Item Title"
                                                    maxLength={24}
                                                />
                                                <button onClick={() => removeItem(sIdx, iIdx)} className="text-slate-500 hover:text-red-500 p-1 transition-colors" title="Delete Item"><TrashIcon className="w-3 h-3" /></button>
                                            </div>
                                            <input
                                                type="text"
                                                value={item.description || ''}
                                                onChange={(e) => updateItem(sIdx, iIdx, 'description', e.target.value)}
                                                className="bg-transparent text-[10px] text-slate-400 w-full focus:outline-none"
                                                placeholder="Description (Optional)"
                                                maxLength={72}
                                            />
                                            <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 mt-1 border-t border-slate-800/50 pt-1">
                                                <span>Type: <span className="text-slate-300 font-medium">List Item</span></span>
                                                <span>Connects to: <span className={`font-medium ${getConnectedNodeName(item.id) === 'Not Connected' ? 'text-amber-500' : 'text-emerald-400'}`}>{getConnectedNodeName(item.id)}</span></span>
                                            </div>
                                        </div>
                                    ))}
                                    {section.items.length < 10 && (
                                        <button
                                            onClick={() => addItem(sIdx)}
                                            disabled={totalItems >= 10}
                                            className={`w-full py-1.5 text-[10px] border border-dashed rounded transition-colors ${totalItems >= 10
                                                ? 'border-slate-800 text-slate-600 cursor-not-allowed'
                                                : 'text-slate-400 border-slate-600 hover:bg-slate-800 hover:text-white'
                                                }`}
                                        >
                                            {totalItems >= 10 ? 'Max Items Reached' : '+ Add Row'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} />
        </SettingsModal>
    );
};

const CTAMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: CTAMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<CTAMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);
    return (
        <SettingsModal title="CTA Message" onClose={onClose} icon={<CtaIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                {/* Header Config */}
                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Header (Optional)</label>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2 sm:col-span-1">
                            <PanelSelect
                                value={data.headerType || 'None'}
                                onChange={val => {
                                    const update: Partial<CTAMessageData> = { headerType: val as any };
                                    if (val === 'Text') update.headerUrl = '';
                                    else if (val === 'None') { update.headerUrl = ''; update.headerText = ''; }
                                    else update.headerText = '';
                                    handleUpdate(update);
                                }}
                                options={['None', 'Text', 'Image', 'Video', 'Document']}
                            />
                        </div>
                        {data.headerType && data.headerType !== 'None' && (
                            <div className="col-span-2 sm:col-span-1">
                                {data.headerType === 'Text' ? (
                                    <PanelTextInput value={data.headerText || ''} onChange={val => handleUpdate({ headerText: val })} placeholder="Header text" maxLength={60} />
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="file"
                                            accept={data.headerType === 'Image' ? 'image/*' : data.headerType === 'Video' ? 'video/*' : '.pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.xls,.xlsx'}
                                            onChange={async (e) => {
                                                if (!e.target.files || !e.target.files[0]) return;
                                                const file = e.target.files[0];
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                formData.append('module', 'flow');
                                                try {
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    if (!session) return;
                                                    const res = await fetch('/api/upload', {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Bearer ${session.access_token}` },
                                                        body: formData
                                                    });
                                                    const resData = await res.json();
                                                    if (resData.success) handleUpdate({ headerUrl: resData.url });
                                                    else showNotification('Upload failed: ' + resData.error, 'error');
                                                } catch (err: any) { showNotification('Upload error: ' + err.message, 'error'); }
                                            }}
                                            className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
                                        />
                                        <PanelTextInput value={data.headerUrl || ''} onChange={val => handleUpdate({ headerUrl: val })} placeholder="Asset URL" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label><PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} maxLength={1024} /></div>

                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700"><label className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2 block">Call To Action Button</label><div className="space-y-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Display Text</label><PanelTextInput value={data.displayText} onChange={val => handleUpdate({ displayText: val })} placeholder="e.g. Visit Website" maxLength={20} /></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">URL</label><PanelTextInput value={data.url} onChange={val => handleUpdate({ url: val })} placeholder="https://..." /></div></div></div>

                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Footer (Optional)</label><PanelTextInput value={data.footer || ''} onChange={val => handleUpdate({ footer: val })} placeholder="Footer text..." maxLength={60} /></div>
            </div>
        </SettingsModal>
    );
};

const QuickReplySettingsPanel: React.FC<{ selectedNode: Node & { data: QuickReplyMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[]; nodes: Node[]; edges: Edge[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables, nodes, edges }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<QuickReplyMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);

    const addButton = () => {
        if ((data.buttons?.length || 0) >= 3) return;
        handleUpdate({ buttons: [...(data.buttons || []), { id: `btn-${Date.now()}`, title: 'Button' }] });
    };

    const updateButtonTitle = (id: string, title: string) => {
        const newButtons = data.buttons.map(b => b.id === id ? { ...b, title } : b);
        handleUpdate({ buttons: newButtons });
    };

    const removeButton = (id: string) => {
        const newButtons = data.buttons.filter(b => b.id !== id);
        handleUpdate({ buttons: newButtons });
    };

    const getConnectedNodeName = (btnId: string) => {
        const edge = edges.find(e => e.source === selectedNode.id && e.sourceHandle === btnId);
        if (!edge) return 'Not Connected';
        const targetNode = nodes.find(n => n.id === edge.target);
        return targetNode?.data?.label || 'Unknown Node';
    };

    return (
        <SettingsModal title="Quick Reply" onClose={onClose} icon={<QuickReplyIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                {/* Header Config */}
                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Header (Optional)</label>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <div className="col-span-2 sm:col-span-1">
                            <PanelSelect
                                value={data.headerType}
                                onChange={val => handleUpdate({ headerType: val as any })}
                                options={['None', 'Text', 'Image', 'Video', 'Document']}
                            />
                        </div>
                        {data.headerType !== 'None' && (
                            <div className="col-span-2 sm:col-span-1">
                                {data.headerType === 'Text' ? (
                                    <PanelTextInput value={data.headerText || ''} onChange={val => handleUpdate({ headerText: val })} placeholder="Header text" maxLength={60} />
                                ) : (
                                    <div className="space-y-2">
                                        <input
                                            type="file"
                                            accept={data.headerType === 'Image' ? 'image/*' : data.headerType === 'Video' ? 'video/*' : '.pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.xls,.xlsx'}
                                            onChange={async (e) => {
                                                if (!e.target.files || !e.target.files[0]) return;
                                                const file = e.target.files[0];
                                                const formData = new FormData();
                                                formData.append('file', file);
                                                formData.append('module', 'flow');
                                                try {
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    if (!session) return;
                                                    const res = await fetch('/api/upload', {
                                                        method: 'POST',
                                                        headers: { 'Authorization': `Bearer ${session.access_token}` },
                                                        body: formData
                                                    });
                                                    const resData = await res.json();
                                                    if (resData.success) handleUpdate({ headerUrl: resData.url });
                                                    else showNotification('Upload failed: ' + resData.error, 'error');
                                                } catch (err: any) { showNotification('Upload error: ' + err.message, 'error'); }
                                            }}
                                            className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
                                        />
                                        <PanelTextInput value={data.headerUrl || ''} onChange={val => handleUpdate({ headerUrl: val })} placeholder="Media URL" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label><PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} maxLength={1024} /></div>

                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Footer (Optional)</label><PanelTextInput value={data.footer || ''} onChange={val => handleUpdate({ footer: val })} placeholder="Footer text..." maxLength={60} /></div>

                <div className="border-t border-slate-800 pt-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold text-brand-400 uppercase tracking-wider">Buttons (Max 3)</label>
                        {(data.buttons?.length || 0) < 3 && (
                            <button onClick={addButton} className="text-xs flex items-center gap-1 bg-brand-600/20 text-brand-400 px-2 py-1 rounded hover:bg-brand-600/30 transition-colors"><PlusIcon className="w-3 h-3" /> Add</button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {data.buttons.map((btn) => (
                            <div key={btn.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-slate-500 uppercase font-bold">Title</label>
                                        <PanelTextInput value={btn.title} onChange={val => updateButtonTitle(btn.id, val)} placeholder="Button Title" maxLength={20} />
                                    </div>
                                    <button onClick={() => removeButton(btn.id)} className="mt-4 p-2 text-slate-500 hover:text-red-500 bg-slate-800 rounded-lg border border-slate-700"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-slate-400 px-1">
                                    <span>Type: <span className="text-slate-300 font-medium">Reply</span></span>
                                    <span>Connects to: <span className={`font-medium ${getConnectedNodeName(btn.id) === 'Not Connected' ? 'text-amber-500' : 'text-emerald-400'}`}>{getConnectedNodeName(btn.id)}</span></span>
                                </div>
                            </div>
                        ))}
                        {data.buttons.length === 0 && <p className="text-xs text-slate-600 italic">No buttons added.</p>}
                    </div>
                </div>
            </div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} />
        </SettingsModal>
    );
};

const CarouselSettingsPanel: React.FC<{ selectedNode: Node & { data: CarouselMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<CarouselMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);

    const addCard = () => {
        if (data.cards.length >= 10) return;
        const newCard: CarouselCard = {
            id: `card-${Date.now()}`,
            cardIndex: data.cards.length,
            headerType: data.cards.length > 0 ? data.cards[0].headerType : 'image',
            mediaUrl: '',
            bodyText: 'New Item',
            buttonText: 'View',
            buttonUrl: ''
        };
        handleUpdate({ cards: [...data.cards, newCard] });
    };

    const removeCard = (index: number) => {
        if (data.cards.length <= 2) {
            showNotification("Minimum 2 cards required.", "error");
            return;
        }
        const newCards = data.cards.filter((_, i) => i !== index).map((c, i) => ({ ...c, cardIndex: i }));
        handleUpdate({ cards: newCards });
    };

    const updateCard = (index: number, field: keyof CarouselCard, value: any) => {
        const newCards = [...data.cards];
        newCards[index] = { ...newCards[index], [field]: value };

        // Enforce header type consistency
        if (field === 'headerType') {
            newCards.forEach(c => c.headerType = value);
        }

        handleUpdate({ cards: newCards });
    };

    return (
        <SettingsModal title="Carousel Message" onClose={onClose} icon={<CarouselIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Body</label>
                    <PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} maxLength={1024} />
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold text-brand-400 uppercase tracking-wider">Cards ({data.cards.length}/10)</label>
                        {data.cards.length < 10 && (
                            <button onClick={addCard} className="text-xs flex items-center gap-1 bg-brand-600/20 text-brand-400 px-2 py-1 rounded hover:bg-brand-600/30 transition-colors"><PlusIcon className="w-3 h-3" /> Add Card</button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {data.cards.map((card, idx) => (
                            <div key={card.id} className="bg-slate-800/30 border border-slate-700 rounded-xl p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-slate-400">Card {idx + 1}</span>
                                    <button onClick={() => removeCard(idx)} className="text-slate-500 hover:text-red-500 p-1"><TrashIcon className="w-4 h-4" /></button>
                                </div>

                                <div className="space-y-3">
                                    {/* Header Type - Only show for first card or make it clear it changes all */}
                                    {idx === 0 && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Header Type (All Cards)</label>
                                            <PanelSelect
                                                value={card.headerType}
                                                onChange={val => updateCard(idx, 'headerType', val)}
                                                options={['image', 'video']}
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Media URL ({card.headerType})</label>
                                        <div className="space-y-2 mb-2">
                                            <input
                                                type="file"
                                                accept={card.headerType === 'image' ? 'image/*' : 'video/*'}
                                                onChange={async (e) => {
                                                    if (!e.target.files || !e.target.files[0]) return;
                                                    const file = e.target.files[0];
                                                    const formData = new FormData();
                                                    formData.append('file', file);
                                                    formData.append('module', 'flow');
                                                    try {
                                                        const { data: { session } } = await supabase.auth.getSession();
                                                        if (!session) return;
                                                        const res = await fetch('/api/upload', {
                                                            method: 'POST',
                                                            headers: { 'Authorization': `Bearer ${session.access_token}` },
                                                            body: formData
                                                        });
                                                        const resData = await res.json();
                                                        if (resData.success) updateCard(idx, 'mediaUrl', resData.url);
                                                        else showNotification('Upload failed: ' + resData.error, 'error');
                                                    } catch (err: any) { showNotification('Upload error: ' + err.message, 'error'); }
                                                }}
                                                className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
                                            />
                                            <PanelTextInput value={card.mediaUrl} onChange={val => updateCard(idx, 'mediaUrl', val)} placeholder={`https://example.com/${card.headerType}.jpg`} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Body Text</label>
                                        <PanelTextInput value={card.bodyText} onChange={val => updateCard(idx, 'bodyText', val)} placeholder="Card description" maxLength={160} />
                                    </div>

                                    <div className="bg-slate-900/50 p-2 rounded border border-slate-800">
                                        <label className="block text-[10px] font-bold text-brand-400 uppercase mb-2">CTA Button</label>
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-[10px] text-slate-500 uppercase">Label</label>
                                                <PanelTextInput value={card.buttonText} onChange={val => updateCard(idx, 'buttonText', val)} placeholder="e.g. Shop Now" maxLength={20} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-500 uppercase">URL</label>
                                                <PanelTextInput value={card.buttonUrl} onChange={val => updateCard(idx, 'buttonUrl', val)} placeholder="https://..." />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </SettingsModal>
    );
};

const SendFlowSettingsPanel: React.FC<{ selectedNode: Node & { data: SendFlowData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<SendFlowData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [flows, setFlows] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchingFields, setFetchingFields] = useState(false);

    React.useEffect(() => {
        const fetchFlows = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const res = await fetch('/api/whatsapp/forms', {
                    headers: { Authorization: `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    const publishedFlows = (json.data || []).filter((f: any) => f.status === 'PUBLISHED');
                    setFlows(publishedFlows);
                }
            } catch (e) {
                console.error("Failed to fetch flows", e);
            } finally {
                setLoading(false);
            }
        };
        fetchFlows();
    }, []);

    const refreshFields = async (flowId: string) => {
        if (!flowId) return;
        setFetchingFields(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch(`/api/whatsapp/forms/${flowId}/fields`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (res.ok) {
                const json = await res.json();
                if (json.fields) {
                    handleUpdate({ flowFields: json.fields });
                }
            }
        } catch (e) {
            console.error("Failed to fetch flow fields", e);
        } finally {
            setFetchingFields(false);
        }
    };

    // Fetch fields for existing selection if missing
    React.useEffect(() => {
        if (data.flowId && (!data.flowFields || data.flowFields.length === 0)) {
            refreshFields(data.flowId);
        }
    }, [data.flowId]);

    return (
        <SettingsModal title="Send Flow" onClose={onClose} icon={<FlowIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Select Flow</label>
                        <button
                            onClick={() => refreshFields(data.flowId || '')}
                            disabled={fetchingFields || !data.flowId}
                            className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase disabled:opacity-50"
                        >
                            {fetchingFields ? 'Refreshing...' : 'Refresh Fields'}
                        </button>
                    </div>
                    {loading ? (
                        <div className="text-xs text-slate-500">Loading flows...</div>
                    ) : (
                        <PanelSelect
                            value={data.flowId || ''}
                            onChange={val => {
                                const flow = flows.find(f => f.id === val);
                                // Clear fields when changing flow to trigger useEffect refresh
                                handleUpdate({ flowId: val, flowName: flow?.name || '', flowFields: [] });
                            }}
                            options={[{ label: 'Select a Flow...', value: '' }, ...flows.map(f => ({ label: f.name, value: f.id }))]}
                        />
                    )}

                    {/* Display Detected Fields */}
                    {data.flowFields && data.flowFields.length > 0 && (
                        <div className="mt-3">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detected Fields</label>
                            <div className="flex flex-wrap gap-1">
                                {data.flowFields.map(field => (
                                    <span key={field} className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">
                                        {field}
                                    </span>
                                ))}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1 italic">These fields are available as variables in subsequent nodes.</p>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Content</label>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Header (Optional)</label>
                            <PanelTextInput value={data.headerText || ''} onChange={val => handleUpdate({ headerText: val })} placeholder="Header text" maxLength={60} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Body</label>
                            <PanelTextarea value={data.bodyText} onChange={val => handleUpdate({ bodyText: val })} placeholder="Message body..." rows={3} maxLength={1024} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Footer (Optional)</label>
                            <PanelTextInput value={data.footerText || ''} onChange={val => handleUpdate({ footerText: val })} placeholder="Footer text" maxLength={60} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Button Label</label>
                            <PanelTextInput value={data.ctaText || ''} onChange={val => handleUpdate({ ctaText: val })} placeholder="Open Form" maxLength={20} />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Save Response To Variable (Optional)</label>
                    <PanelTextInput
                        value={data.outputVariableName || ''}
                        onChange={val => handleUpdate({ outputVariableName: val })}
                        placeholder="e.g. survey_result"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 italic">Access the full response using this variable (e.g. {`{{survey_result}}`})</p>
                </div>
            </div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} allowSaveResponse={true} />
        </SettingsModal>
    );
};

const CallApiSettingsPanel: React.FC<{ selectedNode: Node & { data: CallApiData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<CallApiData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [testResponse, setTestResponse] = useState<string>('');
    const [testing, setTesting] = useState(false);
    const [testValues, setTestValues] = useState<Record<string, string>>({});
    const { showNotification } = React.useContext(SettingsContext);

    // Ensure bodyInputType defaults to 'raw'
    React.useEffect(() => {
        if (!data.bodyInputType) {
            handleUpdate({ bodyInputType: 'raw' });
        }
    }, []);

    const handleAddHeader = () => handleUpdate({ headers: [...(data.headers || []), { key: '', value: '' }] });
    const handleHeaderChange = (idx: number, field: 'key' | 'value', val: string) => {
        const newHeaders = [...(data.headers || [])];
        newHeaders[idx][field] = val;
        handleUpdate({ headers: newHeaders });
    };
    const handleRemoveHeader = (idx: number) => handleUpdate({ headers: (data.headers || []).filter((_, i) => i !== idx) });

    const handleAddParam = () => handleUpdate({ params: [...(data.params || []), { key: '', value: '' }] });
    const handleParamChange = (idx: number, field: 'key' | 'value', val: string) => {
        const newParams = [...(data.params || [])];
        newParams[idx][field] = val;
        handleUpdate({ params: newParams });
    };
    const handleRemoveParam = (idx: number) => handleUpdate({ params: (data.params || []).filter((_, i) => i !== idx) });

    const getKeys = (obj: any): string[] => {
        const keys = new Set<string>();
        const traverse = (o: any, prefix = '') => {
            if (typeof o !== 'object' || o === null) return;
            for (const key in o) {
                if (Object.prototype.hasOwnProperty.call(o, key)) {
                    const newKey = prefix ? `${prefix}.${key}` : key;
                    keys.add(newKey);
                    const val = o[key];
                    if (typeof val === 'object' && val !== null) {
                        traverse(val, newKey);
                    }
                }
            }
        };
        traverse(obj);
        return Array.from(keys);
    };

    const testVariables = useMemo(() => {
        const vars = new Set<string>();
        const regex = /\{\{([^}]+)\}\}/g;
        const scan = (str: string) => {
            if (!str) return;
            let match;
            while ((match = regex.exec(str)) !== null) {
                vars.add(match[1].trim());
            }
        };
        scan(data.url || '');
        if (data.bodyInputType === 'kv') {
            data.bodyFields?.forEach(f => { scan(f.key); scan(f.value); });
        } else {
            scan(data.body || '');
        }
        data.headers?.forEach(h => { scan(h.key); scan(h.value); });
        data.params?.forEach(p => { scan(p.key); scan(p.value); });

        // Scan Auth Fields
        if (data.authType === 'basic') {
            scan(data.authUsername || '');
            scan(data.authPassword || '');
        } else if (data.authType === 'bearer') {
            scan(data.authToken || '');
        } else if (data.authType === 'header') {
            scan(data.authHeaderName || '');
            scan(data.authHeaderValue || '');
        }

        return Array.from(vars);
    }, [data.url, data.body, data.headers, data.params, data.bodyInputType, data.bodyFields, data.authType, data.authUsername, data.authPassword, data.authToken, data.authHeaderName, data.authHeaderValue]);

    const testRequest = async () => {
        setTesting(true);
        setTestResponse('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                showNotification('Error: You must be logged in to test requests.', 'error');
                setTesting(false);
                return;
            }

            // Build context from testValues, handling nested keys if necessary (simple flat for now)
            const variables: any = {};

            for (const [key, value] of Object.entries(testValues)) {
                const parts = key.split('.');
                let current = variables;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = value;
            }

            const res = await fetch('/api/test-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    url: data.url,
                    method: data.method,
                    headers: data.headers,
                    params: data.params,
                    body: data.body,
                    bodyType: data.bodyType,
                    bodyInputType: data.bodyInputType,
                    bodyFields: data.bodyFields,
                    variables: variables,
                    authType: data.authType,
                    authUsername: data.authUsername,
                    authPassword: data.authPassword,
                    authToken: data.authToken,
                    authHeaderName: data.authHeaderName,
                    authHeaderValue: data.authHeaderValue
                })
            });
            const json = await res.json();
            setTestResponse(JSON.stringify(json, null, 2));
            if (json && typeof json === 'object') {
                const keys = getKeys(json);
                handleUpdate({ outputVariables: keys });
            }
        } catch (e: any) {
            showNotification(`Error: ${e.message}`, 'error');
        } finally {
            setTesting(false);
        }
    };

    return (
        <SettingsModal title="Call API" onClose={onClose} icon={<CallApiIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Request Details</label>
                    <div className="flex gap-2">
                        <div className="w-24">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Method</label>
                            <PanelSelect value={data.method || 'GET'} onChange={val => handleUpdate({ method: val as any })} options={['GET', 'POST', 'PUT', 'DELETE']} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">URL</label>
                            <PanelTextInput value={data.url || ''} onChange={val => handleUpdate({ url: val })} placeholder="https://api.example.com/v1/resource" />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Authentication</label>
                    <PanelSelect
                        value={data.authType || 'none'}
                        onChange={val => handleUpdate({ authType: val as any })}
                        options={[
                            { label: 'None', value: 'none' },
                            { label: 'Basic Auth', value: 'basic' },
                            { label: 'Bearer Token (JWT)', value: 'bearer' },
                            { label: 'Header Auth', value: 'header' }
                        ]}
                    />

                    {data.authType === 'basic' && (
                        <div className="space-y-2 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Username</label>
                                <PanelTextInput value={data.authUsername || ''} onChange={val => handleUpdate({ authUsername: val })} placeholder="Username" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Password</label>
                                <PanelTextInput value={data.authPassword || ''} onChange={val => handleUpdate({ authPassword: val })} placeholder="Password" type="password" />
                            </div>
                        </div>
                    )}

                    {data.authType === 'bearer' && (
                        <div className="animate-fade-in">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Token</label>
                            <PanelTextInput value={data.authToken || ''} onChange={val => handleUpdate({ authToken: val })} placeholder="e.g. eyJhbGciOiJIUzI1Ni..." type="password" />
                        </div>
                    )}

                    {data.authType === 'header' && (
                        <div className="space-y-2 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Header Name</label>
                                <PanelTextInput value={data.authHeaderName || ''} onChange={val => handleUpdate({ authHeaderName: val })} placeholder="e.g. X-API-Key" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Value</label>
                                <PanelTextInput value={data.authHeaderValue || ''} onChange={val => handleUpdate({ authHeaderValue: val })} placeholder="API Key Value" type="password" />
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Headers</label>
                        <button onClick={handleAddHeader} className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add</button>
                    </div>
                    {data.headers?.map((h, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <PanelTextInput value={h.key} onChange={val => handleHeaderChange(i, 'key', val)} placeholder="Key" className="flex-1" />
                            <PanelTextInput value={h.value} onChange={val => handleHeaderChange(i, 'value', val)} placeholder="Value" className="flex-1" />
                            <button onClick={() => handleRemoveHeader(i)} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {(!data.headers || data.headers.length === 0) && <p className="text-xs text-slate-500 italic">No headers configured.</p>}
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Parameters</label>
                        <button onClick={handleAddParam} className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add</button>
                    </div>
                    {data.params?.map((p, i) => (
                        <div key={i} className="flex gap-2 items-center">
                            <PanelTextInput value={p.key} onChange={val => handleParamChange(i, 'key', val)} placeholder="Key" className="flex-1" />
                            <PanelTextInput value={p.value} onChange={val => handleParamChange(i, 'value', val)} placeholder="Value" className="flex-1" />
                            <button onClick={() => handleRemoveParam(i)} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                        </div>
                    ))}
                    {(!data.params || data.params.length === 0) && <p className="text-xs text-slate-500 italic">No parameters configured.</p>}
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 space-y-3">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Body</label>
                    <div className="flex gap-4 mb-2">
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Content Type</label>
                            <PanelSelect value={data.bodyType || 'json'} onChange={val => handleUpdate({ bodyType: val as any })} options={[{ label: 'JSON', value: 'json' }, { label: 'Form Data', value: 'form-data' }]} />
                        </div>
                        <div className="flex-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Input Mode</label>
                            <PanelSelect value={data.bodyInputType || 'raw'} onChange={val => handleUpdate({ bodyInputType: val as any })} options={[{ label: 'Raw Text', value: 'raw' }, { label: 'Key-Value Pairs', value: 'kv' }]} />
                        </div>
                    </div>

                    {data.bodyInputType === 'kv' ? (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Body Fields</label>
                                <button onClick={() => handleUpdate({ bodyFields: [...(data.bodyFields || []), { key: '', value: '' }] })} className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase flex items-center gap-1"><PlusIcon className="w-3 h-3" /> Add</button>
                            </div>
                            {data.bodyFields?.map((f, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <PanelTextInput value={f.key} onChange={val => {
                                        const newFields = [...(data.bodyFields || [])];
                                        newFields[i].key = val;
                                        handleUpdate({ bodyFields: newFields });
                                    }} placeholder="Key" className="flex-1" />
                                    <PanelTextInput value={f.value} onChange={val => {
                                        const newFields = [...(data.bodyFields || [])];
                                        newFields[i].value = val;
                                        handleUpdate({ bodyFields: newFields });
                                    }} placeholder="Value" className="flex-1" />
                                    <button onClick={() => handleUpdate({ bodyFields: (data.bodyFields || []).filter((_, idx) => idx !== i) })} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            ))}
                            {(!data.bodyFields || data.bodyFields.length === 0) && <p className="text-xs text-slate-500 italic">No fields configured.</p>}
                        </div>
                    ) : (
                        <PanelTextarea value={data.body || ''} onChange={val => handleUpdate({ body: val })} placeholder={data.bodyType === 'json' ? '{"key": "value"}' : 'key=value&foo=bar'} rows={5} />
                    )}
                </div>

                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Test Request</label>
                        <button onClick={testRequest} disabled={testing} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded transition-colors disabled:opacity-50">{testing ? 'Sending...' : 'Send Request'}</button>
                    </div>

                    {testVariables.length > 0 && (
                        <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                            <p className="text-[10px] font-bold text-brand-400 uppercase">Test Variables</p>
                            <p className="text-[10px] text-slate-500 italic">Enter values for variables to use in this test request.</p>
                            {testVariables.map(v => (
                                <div key={v} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-mono w-1/3 truncate" title={v}>{v}</span>
                                    <PanelTextInput value={testValues[v] || ''} onChange={val => setTestValues(prev => ({ ...prev, [v]: val }))} placeholder="Value" className="flex-1" />
                                </div>
                            ))}
                        </div>
                    )}

                    {testResponse && (
                        <div className="mt-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Response</label>
                            <pre className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] text-slate-300 overflow-auto max-h-40">{testResponse}</pre>
                            {data.outputVariables && data.outputVariables.length > 0 && (
                                <div className="mt-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Detected Output Variables</label>
                                    <div className="flex flex-wrap gap-1">
                                        {data.outputVariables.map(v => (
                                            <span key={v} className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">{v}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </SettingsModal>
    );
};

const GenericSettingsPanel: React.FC<{ selectedNode: Node; onUpdateNode: (id: string, data: AnyNodeData) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data, type } = selectedNode;
    const handleDataChange = (key: string, value: any) => onUpdateNode(selectedNode.id, { ...data, [key]: value });
    return (
        <SettingsModal title={`${data.label} Settings`} onClose={onClose} icon={<SettingsIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            {type === NodeType.TextMessage ? <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label><PanelTextarea value={(data as any).message} onChange={val => handleDataChange('message', val)} /></div> : <p className="text-slate-500 text-center py-8 italic">Settings available in specific panels.</p>}
        </SettingsModal>
    );
};

const TemplateMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: TemplateMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<TemplateMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);

    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTemplateObj, setSelectedTemplateObj] = useState<any>(null);
    const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
    const [headerType, setHeaderType] = useState<string | null>(null);
    const [carouselCards, setCarouselCards] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    // Fetch Templates
    React.useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const res = await fetch('/api/whatsapp/templates', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    setTemplates(json.data || []);
                }
            } catch (e) {
                console.error('Error fetching templates:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    // On template ID change (or templates load), find and parse template
    React.useEffect(() => {
        if (!data.templateId || templates.length === 0) {
            setDetectedVariables([]);
            setHeaderType(null);
            setCarouselCards([]);
            setSelectedTemplateObj(null);
            return;
        }
        const tpl = templates.find(t => t.id === data.templateId);
        if (tpl) {
            setSelectedTemplateObj(tpl);
            parseTemplate(tpl);
        }
    }, [data.templateId, templates]);

    const parseTemplate = (tpl: any) => {
        const variables: string[] = [];
        let hType: string | null = null;
        let cCards: any[] = [];

        const components = Array.isArray(tpl.components) ? tpl.components : [];
        if (components.length > 0) {
            components.forEach((comp: any) => {
                if (comp.type === 'BODY') {
                    const text = comp.text || '';
                    const matches = text.match(/{{([a-zA-Z0-9_]+)}}/g);
                    if (matches) {
                        matches.forEach((m: string) => {
                            variables.push(m.replace(/{{|}}/g, ''));
                        });
                    }
                }
                if (comp.type === 'HEADER') {
                    hType = comp.format || null;
                }
                if (comp.type === 'CAROUSEL' && comp.cards) {
                    cCards = comp.cards;
                }
                if (comp.type === 'BUTTONS' && comp.buttons) {
                    comp.buttons.forEach((btn: any) => {
                        if (btn.type === 'URL' && btn.url && btn.url.includes('{{1}}')) {
                            variables.push('url_param_1');
                        }
                    });
                }
            });
        } else {
            // Fallback for when components array is missing (e.g. from local DB cache)
            if (tpl.body_text) {
                const matches = tpl.body_text.match(/{{([a-zA-Z0-9_]+)}}/g);
                if (matches) {
                    matches.forEach((m: string) => {
                        variables.push(m.replace(/{{|}}/g, ''));
                    });
                }
            }
            if (tpl.template_type && tpl.template_type !== 'TEXT') {
                hType = tpl.template_type;
            }
            if (tpl.buttons && tpl.buttons.type === 'MEDIA_CARD_CAROUSEL') {
                cCards = tpl.buttons.cards || [];
            }
        }

        setDetectedVariables([...new Set(variables)]);
        setHeaderType(hType);
        setCarouselCards(cCards);
    };

    // File Upload Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, cardIndex?: number) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'flow');

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
                if (cardIndex !== undefined) {
                    const newUrls = { ...(selectedNode.data.carouselMediaUrls || {}) };
                    newUrls[cardIndex] = data.url;
                    handleUpdate({ carouselMediaUrls: newUrls });
                } else {
                    handleUpdate({ mediaUrl: data.url });
                }
            } else {
                showNotification('Upload failed: ' + data.error, 'error');
            }
        } catch (err: any) {
            showNotification('Upload error: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <SettingsModal title="Send Template Message" onClose={onClose} icon={<MessageIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                {/* Template Selection */}
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Template</label>
                    <PanelSelect
                        value={data.templateId || ''}
                        onChange={(val) => {
                            const tpl = templates.find(t => t.id === val);
                            if (tpl) {
                                handleUpdate({
                                    templateId: tpl.id,
                                    templateName: tpl.name,
                                    language: tpl.language,
                                    variableMapping: {}, // Reset mapping on change
                                    mediaUrl: '',
                                    carouselMediaUrls: {},
                                    components: tpl.components || []
                                });
                            } else {
                                handleUpdate({
                                    templateId: '',
                                    templateName: '',
                                    language: '',
                                    variableMapping: {},
                                    mediaUrl: '',
                                    carouselMediaUrls: {},
                                    components: []
                                });
                            }
                        }}
                        options={[{ label: 'Select a template...', value: '' }, ...templates.filter(t => t.status === 'APPROVED').map(t => ({ label: `${t.name} (${t.language})`, value: t.id }))]}
                    />
                </div>

                {selectedTemplateObj && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Header Media */}
                        {headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Header Media ({headerType})</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="file"
                                        accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                                        onChange={(e) => handleFileUpload(e)}
                                        className="block w-full text-xs text-slate-400
                                        file:mr-2 file:py-1 file:px-2
                                        file:rounded-full file:border-0
                                        file:text-[10px] file:font-bold
                                        file:bg-brand-600 file:text-white
                                        hover:file:bg-brand-500
                                        cursor-pointer"
                                    />
                                </div>
                                {uploading && <p className="text-[10px] text-brand-400 animate-pulse">Uploading...</p>}
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 mt-2">Or Direct URL</label>
                                <PanelTextInput
                                    value={data.mediaUrl || ''}
                                    onChange={val => handleUpdate({ mediaUrl: val })}
                                    placeholder="https://..."
                                />
                            </div>
                        )}

                        {/* Carousel Media */}
                        {carouselCards.length > 0 && (
                            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 space-y-4">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Carousel Cards Media</label>
                                {carouselCards.map((card, idx) => {
                                    const headerComp = card.components?.find((c: any) => c.type === 'HEADER');
                                    const cardFormat = headerComp?.format || 'IMAGE';

                                    return (
                                        <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-bold text-slate-400">Card {idx + 1} ({cardFormat})</span>
                                            </div>
                                            <div className="flex gap-2 mb-2">
                                                <input
                                                    type="file"
                                                    accept={cardFormat === 'VIDEO' ? 'video/*' : 'image/*'}
                                                    onChange={(e) => handleFileUpload(e, idx)}
                                                    className="w-full text-[10px] text-slate-500"
                                                />
                                            </div>
                                            <PanelTextInput
                                                value={(data.carouselMediaUrls && data.carouselMediaUrls[idx]) || ''}
                                                onChange={(val) => {
                                                    const newUrls = { ...(data.carouselMediaUrls || {}) };
                                                    newUrls[idx] = val;
                                                    handleUpdate({ carouselMediaUrls: newUrls });
                                                }}
                                                placeholder="Media URL"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Variables */}
                        {detectedVariables.length > 0 && (
                            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 space-y-3">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Variable Mapping</label>
                                {detectedVariables.map(v => (
                                    <div key={v}>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{`{{${v}}}`}</label>
                                        <PanelTextInput
                                            value={data.variableMapping?.[v] || ''}
                                            onChange={(val) => handleUpdate({ variableMapping: { ...data.variableMapping, [v]: val } })}
                                            placeholder={`Value for {{${v}}}`}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {detectedVariables.length === 0 && !headerType && carouselCards.length === 0 && (
                            <p className="text-xs text-slate-500 italic text-center">No variables or media to configure for this template.</p>
                        )}
                    </div>
                )}

                <ResponseHandlingFields data={data} onUpdate={handleUpdate} />
            </div>
        </SettingsModal>
    );
};

const NotifySettingsPanel: React.FC<{ selectedNode: Node & { data: NotifyData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<NotifyData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);

    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTemplateObj, setSelectedTemplateObj] = useState<any>(null);
    const [detectedVariables, setDetectedVariables] = useState<string[]>([]);
    const [headerType, setHeaderType] = useState<string | null>(null);
    const [carouselCards, setCarouselCards] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);

    // Fetch Templates (Similar to TemplateMessageSettingsPanel)
    React.useEffect(() => {
        const fetchTemplates = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const res = await fetch('/api/whatsapp/templates', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    setTemplates(json.data || []);
                }
            } catch (e) {
                console.error('Error fetching templates:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    React.useEffect(() => {
        if (!data.templateId || templates.length === 0) {
            setDetectedVariables([]);
            setHeaderType(null);
            setCarouselCards([]);
            setSelectedTemplateObj(null);
            return;
        }
        const tpl = templates.find(t => t.id === data.templateId);
        if (tpl) {
            setSelectedTemplateObj(tpl);
            parseTemplate(tpl);
        }
    }, [data.templateId, templates]);

    const parseTemplate = (tpl: any) => {
        const variables: string[] = [];
        let hType: string | null = null;
        let cCards: any[] = [];

        const components = Array.isArray(tpl.components) ? tpl.components : [];
        if (components.length > 0) {
            components.forEach((comp: any) => {
                if (comp.type === 'BODY') {
                    const text = comp.text || '';
                    const matches = text.match(/{{([a-zA-Z0-9_]+)}}/g);
                    if (matches) matches.forEach((m: string) => variables.push(m.replace(/{{|}}/g, '')));
                }
                if (comp.type === 'HEADER') {
                    hType = comp.format || null;
                    if (comp.text && comp.text.match(/{{/)) {
                        const hMatches = comp.text.match(/{{([a-zA-Z0-9_]+)}}/g);
                        if (hMatches) hMatches.forEach((m: string) => variables.push(m.replace(/{{|}}/g, '')));
                    }
                }
                if (comp.type === 'CAROUSEL' && comp.cards) {
                    cCards = comp.cards;
                }
                if (comp.type === 'BUTTONS' && comp.buttons) {
                    comp.buttons.forEach((btn: any) => {
                        if (btn.type === 'URL' && btn.url && btn.url.includes('{{')) {
                            const bMatches = btn.url.match(/{{([a-zA-Z0-9_]+)}}/g);
                            if (bMatches) bMatches.forEach((m: string) => variables.push(m.replace(/{{|}}/g, '')));
                        }
                    });
                }
            });
        } else {
            // Fallback for when components array is missing (e.g. from local DB cache)
            if (tpl.body_text) {
                const matches = tpl.body_text.match(/{{([a-zA-Z0-9_]+)}}/g);
                if (matches) matches.forEach((m: string) => variables.push(m.replace(/{{|}}/g, '')));
            }
            if (tpl.template_type && tpl.template_type !== 'TEXT') {
                hType = tpl.template_type;
            }
            if (tpl.buttons && tpl.buttons.type === 'MEDIA_CARD_CAROUSEL') {
                cCards = tpl.buttons.cards || [];
            }
        }

        setDetectedVariables([...new Set(variables)]);
        setHeaderType(hType);
        setCarouselCards(cCards);
    };

    // File Upload Handler (Mirror standard template)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, cardIndex?: number) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'flow');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });
            const resData = await res.json();
            if (resData.success) {
                if (cardIndex !== undefined) {
                    const newUrls = { ...(data.carouselMediaUrls || {}) };
                    newUrls[cardIndex] = resData.url;
                    handleUpdate({ carouselMediaUrls: newUrls });
                } else {
                    handleUpdate({ mediaUrl: resData.url });
                }
            } else {
                showNotification('Upload failed: ' + resData.error, 'error');
            }
        } catch (err: any) {
            showNotification('Upload error: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <SettingsModal title="Notify Settings" onClose={onClose} icon={<UsersIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Notify Mobile Numbers</label>
                        <span className="text-[10px] font-bold text-amber-500/80 uppercase">Max 4 Numbers</span>
                    </div>
                    <PanelTextInput 
                        value={data.mobileNumbers || ''} 
                        onChange={val => {
                            // Truncate to max 4 if it's a literal list (don't break variables)
                            const parts = val.split(',');
                            if (parts.length > 4) {
                                return; // Stop adding more in UI
                            }
                            handleUpdate({ mobileNumbers: val });
                        }} 
                        placeholder="919876543210, 918877665544..." 
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Comma-separated phone numbers with country code. Max 4 numbers allowed.</p>
                </div>

                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Notification Type</label>
                    <PanelSelect 
                        value={data.notificationType || 'Text'} 
                        onChange={val => handleUpdate({ notificationType: val as any, message: '', templateId: '', mediaUrl: '', carouselMediaUrls: {}, components: [] })} 
                        options={['Text', 'Template']} 
                    />
                </div>

                {(data.notificationType === 'Text' || !data.notificationType) ? (
                    <div className="animate-fade-in bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message Content</label>
                        <PanelTextarea 
                            value={data.message || ''} 
                            onChange={val => handleUpdate({ message: val })} 
                            placeholder="Type your notification message..." 
                            rows={4} 
                            availableVariables={availableVariables}
                        />
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Template</label>
                            <PanelSelect
                                value={data.templateId || ''}
                                onChange={(val) => {
                                    const tpl = templates.find(t => t.id === val);
                                    if (tpl) {
                                        handleUpdate({
                                            templateId: tpl.id,
                                            templateName: tpl.name,
                                            language: tpl.language,
                                            variableMapping: {},
                                            mediaUrl: '',
                                            carouselMediaUrls: {},
                                            components: tpl.components || []
                                        });
                                    } else {
                                        handleUpdate({
                                            templateId: '',
                                            templateName: '',
                                            language: '',
                                            variableMapping: {},
                                            mediaUrl: '',
                                            carouselMediaUrls: {},
                                            components: []
                                        });
                                    }
                                }}
                                options={[{ label: 'Select a template...', value: '' }, ...templates.filter(t => t.status === 'APPROVED').map(t => ({ label: `${t.name} (${t.language})`, value: t.id }))]}
                            />
                        </div>

                        {selectedTemplateObj && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Header Media */}
                                {headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Header Media ({headerType})</label>
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                type="file"
                                                accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf,.doc,.docx'}
                                                onChange={(e) => handleFileUpload(e)}
                                                className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
                                            />
                                        </div>
                                        {uploading && <p className="text-[10px] text-brand-400 animate-pulse">Uploading...</p>}
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 mt-2">Or Direct URL</label>
                                        <PanelTextInput
                                            value={data.mediaUrl || ''}
                                            onChange={val => handleUpdate({ mediaUrl: val })}
                                            placeholder="https://..."
                                            availableVariables={availableVariables}
                                        />
                                    </div>
                                )}

                                {/* Carousel Media */}
                                {carouselCards.length > 0 && (
                                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 space-y-4">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Carousel Cards Media</label>
                                        {carouselCards.map((card, idx) => {
                                            const headerComp = card.components?.find((c: any) => c.type === 'HEADER');
                                            const cardFormat = headerComp?.format || 'IMAGE';
                                            return (
                                                <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                                    <span className="block text-[10px] font-bold text-slate-400 mb-2">Card {idx + 1} ({cardFormat})</span>
                                                    <input
                                                        type="file"
                                                        accept={cardFormat === 'VIDEO' ? 'video/*' : 'image/*'}
                                                        onChange={(e) => handleFileUpload(e, idx)}
                                                        className="w-full text-[10px] text-slate-500 mb-2"
                                                    />
                                                    <PanelTextInput
                                                        value={(data.carouselMediaUrls && data.carouselMediaUrls[idx]) || ''}
                                                        onChange={(val) => {
                                                            const newUrls = { ...(data.carouselMediaUrls || {}) };
                                                            newUrls[idx] = val;
                                                            handleUpdate({ carouselMediaUrls: newUrls });
                                                        }}
                                                        placeholder="Media URL"
                                                        availableVariables={availableVariables}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Variables */}
                                {detectedVariables.length > 0 && (
                                    <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700 space-y-3">
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Variable Mapping</label>
                                        {detectedVariables.map(v => (
                                            <div key={v}>
                                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{`{{${v}}}`}</label>
                                                <PanelTextInput
                                                    value={data.variableMapping?.[v] || ''}
                                                    onChange={(val) => handleUpdate({ variableMapping: { ...data.variableMapping, [v]: val } })}
                                                    placeholder={`Value for {{${v}}}`}
                                                    availableVariables={availableVariables}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </SettingsModal>
    );
};

// --- Sheet Trigger Settings Panel ---
const SheetTriggerSettingsPanel: React.FC<{ selectedNode: Node & { data: SheetTriggerData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const { showNotification } = React.useContext(SettingsContext);
    const handleUpdate = (update: Partial<SheetTriggerData>) => onUpdateNode(selectedNode.id, { ...data, ...update });

    const [connections, setConnections] = useState<{ id: string, connection_name: string }[]>([]);

    React.useEffect(() => {
        integrationsService.getGoogleConnections().then(setConnections).catch(console.error);
    }, []);

    return (
        <SettingsModal title="Google Sheet Trigger" onClose={onClose} icon={<GsheetIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Connection</label>
                        {connections.length > 0 ? (
                            <PanelSelect
                                value={data.credentialId || ''}
                                onChange={(val: any) => handleUpdate({ credentialId: val })}
                                options={[{ label: 'Select Credential...', value: '' }, ...connections.map(c => ({ label: c.connection_name, value: c.id }))]}
                            />
                        ) : (
                            <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                                No Google accounts connected. Please go to Integrations page.
                            </div>
                        )}
                        <p className="text-[10px] text-slate-500 mt-1">Select the Google account to watch.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-9">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Spreadsheet ID</label>
                                <PanelTextInput
                                    value={data.spreadsheetId || ''}
                                    onChange={val => handleUpdate({ spreadsheetId: val })}
                                    placeholder="Spreadsheet ID (from URL)"
                                />
                            </div>
                            <div className="col-span-3 flex items-end">
                                <button
                                    onClick={async () => {
                                        if (!data.credentialId || !data.spreadsheetId) return showNotification('Select connection and enter Spreadsheet ID', 'error');
                                        try {
                                            const { data: { session } } = await supabase.auth.getSession();
                                            const res = await fetch('/api/integrations/google/sheets', {
                                                method: 'POST',
                                                headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ connectionId: data.credentialId, spreadsheetId: data.spreadsheetId })
                                            });
                                            const resData = await res.json();
                                            if (resData.sheets) {
                                                handleUpdate({ sheets: resData.sheets });
                                                showNotification('Sheets loaded!', 'success');
                                            } else {
                                                showNotification(resData.error || 'Failed to load sheets', 'error');
                                            }
                                        } catch (e: any) { showNotification(e.message, 'error'); }
                                    }}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[10px] font-bold uppercase"
                                >
                                    Load
                                </button>
                            </div>
                        </div>

                        {data.sheets && data.sheets.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sheet Name</label>
                                <PanelSelect
                                    value={data.sheetName || ''}
                                    onChange={val => handleUpdate({ sheetName: val })}
                                    options={['Select Sheet...', ...data.sheets]}
                                />
                            </div>
                        )}

                        {!data.sheets && (
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sheet Name</label>
                                <PanelTextInput
                                    value={data.sheetName || ''}
                                    onChange={val => handleUpdate({ sheetName: val })}
                                    placeholder="Sheet1"
                                />
                            </div>
                        )}

                        <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-9">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Phone Column Header</label>
                                {data.columns && data.columns.length > 0 ? (
                                    <PanelSelect
                                        value={data.phoneColumn || ''}
                                        onChange={val => handleUpdate({ phoneColumn: val })}
                                        options={['Select Column...', ...data.columns]}
                                    />
                                ) : (
                                    <PanelTextInput
                                        value={data.phoneColumn || ''}
                                        onChange={val => handleUpdate({ phoneColumn: val })}
                                        placeholder="e.g. Phone"
                                    />
                                )}
                            </div>
                            <div className="col-span-3 flex items-end">
                                <button
                                    onClick={async () => {
                                        if (!data.credentialId || !data.spreadsheetId || !data.sheetName) return showNotification('Fill spreadsheet and sheet details first', 'error');
                                        try {
                                            const { data: { session } } = await supabase.auth.getSession();
                                            const res = await fetch('/api/integrations/google/columns', {
                                                method: 'POST',
                                                headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ connectionId: data.credentialId, spreadsheetId: data.spreadsheetId, sheetName: data.sheetName })
                                            });
                                            const resData = await res.json();
                                            if (resData.columns) {
                                                handleUpdate({ columns: resData.columns });
                                                showNotification('Columns loaded!', 'success');
                                            } else { showNotification(resData.error || 'Failed to load columns', 'error'); }
                                        } catch (e: any) { showNotification(e.message, 'error'); }
                                    }}
                                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-[10px] font-bold uppercase"
                                >
                                    Fetch
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Status Column (Optional)</label>
                            {data.columns && data.columns.length > 0 ? (
                                <PanelSelect
                                    value={data.statusColumn || ''}
                                    onChange={val => handleUpdate({ statusColumn: val })}
                                    options={['None', ...data.columns]}
                                />
                            ) : (
                                <PanelTextInput
                                    value={data.statusColumn || ''}
                                    onChange={val => handleUpdate({ statusColumn: val })}
                                    placeholder="e.g. Status"
                                />
                            )}
                            <p className="text-[10px] text-slate-500 mt-1">If set, will update this column to "Sent" after triggering.</p>
                        </div>
                    </div>
                </div>

                {/* Filter Conditions */}
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Filter Conditions (Optional)</label>
                    <p className="text-[10px] text-slate-500 mb-3">Only trigger if the new row matches these rules.</p>
                    <div className="space-y-3">
                        {(data.trigger_condition || []).map((cond: any, idx: number) => (
                            <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 flex flex-col gap-2">
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        {data.columns && data.columns.length > 0 ? (
                                            <PanelSelect
                                                value={cond.column || ''}
                                                onChange={val => {
                                                    const newConds = [...(data.trigger_condition || [])];
                                                    newConds[idx] = { ...newConds[idx], column: val };
                                                    handleUpdate({ trigger_condition: newConds });
                                                }}
                                                options={['Select Column...', ...data.columns]}
                                            />
                                        ) : (
                                            <PanelTextInput
                                                value={cond.column || ''}
                                                onChange={val => {
                                                    const newConds = [...(data.trigger_condition || [])];
                                                    newConds[idx] = { ...newConds[idx], column: val };
                                                    handleUpdate({ trigger_condition: newConds });
                                                }}
                                                placeholder="Column Header"
                                            />
                                        )}
                                    </div>
                                    <div className="w-1/3">
                                        <PanelSelect
                                            value={cond.operator || 'equals'}
                                            onChange={val => {
                                                const newConds = [...(data.trigger_condition || [])];
                                                newConds[idx] = { ...newConds[idx], operator: val };
                                                handleUpdate({ trigger_condition: newConds });
                                            }}
                                            options={[
                                                { label: 'Equals', value: 'equals' },
                                                { label: 'Contains', value: 'contains' },
                                                { label: 'Does Not Equal', value: 'not_equals' },
                                                { label: 'Does Not Contain', value: 'does_not_contain' },
                                                { label: 'Starts With', value: 'starts_with' },
                                                { label: 'Ends With', value: 'ends_with' },
                                                { label: 'Greater Than', value: 'greater_than' },
                                                { label: 'Less Than', value: 'less_than' },
                                                { label: 'Is Empty', value: 'is_empty' },
                                                { label: 'Is Not Empty', value: 'is_not_empty' }
                                            ]}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <div className="flex-1">
                                        {!['is_empty', 'is_not_empty'].includes(cond.operator) && (
                                            <PanelTextInput
                                                value={cond.value || ''}
                                                onChange={val => {
                                                    const newConds = [...(data.trigger_condition || [])];
                                                    newConds[idx] = { ...newConds[idx], value: val };
                                                    handleUpdate({ trigger_condition: newConds });
                                                }}
                                                placeholder="Value to match"
                                            />
                                        )}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newConds = (data.trigger_condition || []).filter((_: any, i: number) => i !== idx);
                                            handleUpdate({ trigger_condition: newConds });
                                        }}
                                        className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 rounded border border-slate-700 transition-colors"
                                        title="Remove Condition"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            onClick={() => {
                                handleUpdate({ trigger_condition: [...(data.trigger_condition || []), { column: '', operator: 'equals', value: '' }] });
                            }}
                            className="text-xs flex items-center gap-1 text-brand-400 font-bold uppercase hover:text-brand-300 transition-colors"
                        >
                            <PlusIcon className="w-3 h-3" /> Add Condition
                        </button>
                    </div>
                </div>

                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <p className="text-xs text-slate-300 font-medium">Trigger Behavior</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                        When this flow is published, the system will poll the specified sheet every few minutes.
                        Any <strong>new rows</strong> added to the bottom of the sheet will trigger this flow.
                    </p>
                    <p className="text-[10px] text-slate-500 mt-2">
                        The entire row content will be available as variables (e.g. <code>{`{{trigger.Name}}`}</code> if you have a 'Name' header).
                    </p>
                </div>
            </div>
        </SettingsModal>
    );
};

// --- Timing Settings Panel ---
const TimingSettingsPanel: React.FC<{ selectedNode: Node & { data: TimingData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: Partial<TimingData>) => onUpdateNode(selectedNode.id, { ...data, ...updated });

    // Ensure default values
    React.useEffect(() => {
        if (data.delayValue === undefined || data.delayUnit === undefined) {
            handleUpdate({
                delayValue: data.delayValue ?? 1,
                delayUnit: data.delayUnit ?? 'Minutes'
            });
        }
    }, [data.delayValue, data.delayUnit]);

    return (
        <SettingsModal title="Delay" onClose={onClose} icon={<ClockIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-4">
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Delay Configuration</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className={data.delayUnit === 'Custom Date' ? 'hidden' : 'block'}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Value</label>
                            <PanelNumberInput value={data.delayValue ?? 1} onChange={val => handleUpdate({ delayValue: val })} />
                        </div>
                        <div className={data.delayUnit === 'Custom Date' ? 'col-span-2' : ''}>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit</label>
                                <PanelSelect
                                    value={data.delayUnit || 'Minutes'}
                                    onChange={val => handleUpdate({ delayUnit: val as any })}
                                    options={['Minutes', 'Hours', 'Days', 'Weeks', 'Custom Date']}
                                />
                        </div>
                        {data.delayUnit === 'Custom Date' && (
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Resume Date & Time</label>
                                <input
                                    type="datetime-local"
                                    className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
                                    value={data.customDate || ''}
                                    onChange={(e) => handleUpdate({ customDate: e.target.value })}
                                />
                                <p className="text-[10px] text-amber-500 mt-1 italic">
                                    Specified date/time is local to the server time. Relative waits are recommended for flexible flows.
                                </p>
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-3 italic">
                        The flow execution will pause until the specified time or duration is reached.
                    </p>
                </div>
            </div>
        </SettingsModal>
    );
};

const MediaMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: MediaMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<MediaMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);
    const [uploading, setUploading] = useState(false);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        setUploading(true);
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'flow');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData
            });
            const resData = await res.json();
            if (resData.success) {
                handleUpdate({ url: resData.url });
            } else {
                showNotification('Upload failed: ' + resData.error, 'error');
            }
        } catch (err: any) {
            showNotification('Upload error: ' + err.message, 'error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <SettingsModal title="Send Media" onClose={onClose} icon={<ImageFileIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-5">
                <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Media</label>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Media Type</label>
                            <PanelSelect
                                value={data.mediaType || 'Image'}
                                onChange={val => handleUpdate({ mediaType: val as any })}
                                options={['Image', 'Video', 'Audio', 'Document']}
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Upload File ({data.mediaType || 'Image'})</label>
                            <input
                                type="file"
                                accept={data.mediaType === 'Image' ? 'image/*' : data.mediaType === 'Video' ? 'video/*' : data.mediaType === 'Audio' ? 'audio/*' : '.pdf,.doc,.docx,.ppt,.pptx,.txt,.csv,.xls,.xlsx'}
                                onChange={handleFileUpload}
                                className="block w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 cursor-pointer"
                            />
                            {uploading && <p className="text-[10px] text-brand-400 animate-pulse mt-1">Uploading...</p>}
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Or Direct URL</label>
                            <PanelTextInput value={data.url || ''} onChange={val => handleUpdate({ url: val })} placeholder="https://..." />
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Caption (Optional)</label>
                            <PanelTextarea value={data.caption || ''} onChange={val => handleUpdate({ caption: val })} placeholder="Caption text" maxLength={1024} rows={3} />
                        </div>
                    </div>
                </div>
            </div>
        </SettingsModal>
    );
};

const SwitchSettingsPanel: React.FC<SettingsPanelProps & { availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    // Import SwitchData type
    const data = selectedNode!.data as any; // Using 'any' briefly to avoid import issues if not yet updated in types.ts imports, but we should cast to SwitchData
    // Ensure data.cases exists
    const cases = data.cases || [];

    const { showNotification } = React.useContext(SettingsContext);

    const handleUpdate = (updates: any) => onUpdateNode(selectedNode!.id, { ...data, ...updates });

    const addCase = () => {
        const newCase = {
            id: `case-${Date.now()}`,
            label: `Case ${cases.length + 1}`,
            condition: {
                id: `rule-${Date.now()}`,
                attribute: '',
                operator: 'is',
                value: ''
            }
        };
        handleUpdate({ cases: [...cases, newCase] });
    };

    const removeCase = (index: number) => {
        if (cases.length <= 1) {
            showNotification("At least one case is required.", "error");
            return;
        }
        const newCases = [...cases];
        newCases.splice(index, 1);
        handleUpdate({ cases: newCases });
    };

    const updateCaseLabel = (index: number, label: string) => {
        const newCases = [...cases];
        newCases[index] = { ...newCases[index], label };
        handleUpdate({ cases: newCases });
    };

    const updateCaseCondition = (index: number, field: string, value: string) => {
        const newCases = [...cases];
        newCases[index].condition = {
            ...newCases[index].condition,
            [field]: value
        };
        handleUpdate({ cases: newCases });
    };

    return (
        <SettingsModal title="Switch Settings" onClose={onClose} icon={<ConditionIcon />} availableVariables={availableVariables} footer={
            <div className="flex justify-between w-full">
                <button onClick={addCase} className="flex items-center gap-2 text-brand-400 hover:text-brand-300 transition-colors font-medium text-sm"><PlusIcon className="w-4 h-4" /> Add Case</button>
                <div className="flex gap-3"><button onClick={onClose} className="px-5 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button><button onClick={onClose} className="px-6 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-brand-900/20 transition-all">Save & Close</button></div>
            </div>
        }>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Switch Label</label>
                    <PanelTextInput value={data.label} onChange={val => handleUpdate({ label: val })} placeholder="e.g. Route by User Type" />
                </div>

                <div className="space-y-2">
                    <p className="text-xs text-slate-500 italic">Define cases. Each case creates an output on the node. The first matching case wins. If none match, the 'Default' output is used.</p>
                </div>

                <div className="space-y-4">
                    {cases.map((caseItem: any, index: number) => (
                        <div key={caseItem.id} className="bg-slate-950/50 rounded-xl border border-slate-800 p-4 relative group">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-900 px-2 py-1 rounded">Case {index + 1}</span>
                                    <input
                                        type="text"
                                        value={caseItem.label}
                                        onChange={(e) => updateCaseLabel(index, e.target.value)}
                                        className="bg-transparent text-sm font-bold text-orange-200 outline-none border-b border-transparent hover:border-orange-500/50 focus:border-orange-500 transition-colors w-40"
                                        placeholder="Case Label"
                                    />
                                </div>
                                <button onClick={() => removeCase(index)} className="text-slate-600 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-500/10"><TrashIcon className="w-4 h-4" /></button>
                            </div>

                            {/* Single Rule per Case for Simplicity, or could expand to ConditionGroup later */}
                            <div className="grid grid-cols-10 gap-2 items-center bg-slate-900 p-2.5 rounded-lg border border-slate-800/50">
                                <div className="col-span-4">
                                    <PanelTextInput
                                        value={caseItem.condition.attribute}
                                        onChange={val => updateCaseCondition(index, 'attribute', val)}
                                        placeholder="Variable (e.g. {{name}})"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <PanelSelect
                                        value={caseItem.condition.operator}
                                        onChange={val => updateCaseCondition(index, 'operator', val)}
                                        options={[
                                            'exists', 'does not exist', 'is empty', 'is not empty',
                                            'is', 'is not', 'is equal to', 'is not equal to',
                                            'contains', 'does not contain',
                                            'starts with', 'does not start with',
                                            'ends with', 'does not end with',
                                            'matches regex', 'does not match regex',
                                            '>', '<', '>=', '<=',
                                            'greater than', 'less than'
                                        ]}
                                    />
                                </div>
                                <div className="col-span-4">
                                    <PanelTextInput
                                        value={caseItem.condition.value}
                                        onChange={val => updateCaseCondition(index, 'value', val)}
                                        placeholder="Value"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </SettingsModal>
    );
};

const ManageTagsSettingsPanel: React.FC<{ selectedNode: Node & { data: ManageTagsData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<ManageTagsData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');

    React.useEffect(() => {
        loadTags();
    }, []);

    const loadTags = async () => {
        setIsLoading(true);
        try {
            const tags = await tagService.getTags();
            setAvailableTags(tags);
        } catch (error) {
            console.error('Failed to load tags', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleTag = (tagName: string) => {
        const currentTags = data.tags || [];
        if (currentTags.includes(tagName)) {
            handleUpdate({ tags: currentTags.filter(t => t !== tagName) });
        } else {
            handleUpdate({ tags: [...currentTags, tagName] });
        }
    };

    const handleCreateTag = async () => {
        if (!newTagInput.trim()) return;
        const tagName = newTagInput.trim();
        // Optimistically add to list
        const tempTag: Tag = { id: `temp-${Date.now()}`, name: tagName };
        setAvailableTags(prev => [...prev, tempTag]);
        setNewTagInput('');

        // Add to selection
        const currentTags = data.tags || [];
        if (!currentTags.includes(tagName)) {
            handleUpdate({ tags: [...currentTags, tagName] });
        }

        // Persist
        try {
            await tagService.saveTag({ name: tagName });
            // Reload to get real ID
            loadTags();
        } catch (e) {
            console.error('Failed to create tag', e);
        }
    };

    return (
        <SettingsModal title="Manage Tags" onClose={onClose} icon={<TagIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Action</label>
                    <PanelSelect
                        value={data.action || 'add'}
                        onChange={val => handleUpdate({ action: val as 'add' | 'remove' })}
                        options={[{ label: 'Add Tags', value: 'add' }, { label: 'Remove Tags', value: 'remove' }]}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Tags</label>

                    {/* Selected Tags Preview */}
                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-950 rounded-lg border border-slate-800 min-h-[42px]">
                        {data.tags && data.tags.length > 0 ? (
                            data.tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                    {tag}
                                    <button onClick={() => toggleTag(tag)} className="hover:text-white"><CloseIcon className="w-3 h-3" /></button>
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-500 text-xs italic">No tags selected</span>
                        )}
                    </div>

                    {/* Available Tags List */}
                    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/20">
                        <div className="p-2 border-b border-slate-700 bg-slate-800/50">
                            <input
                                type="text"
                                placeholder="Search or create tag..."
                                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500"
                                value={newTagInput}
                                onChange={e => setNewTagInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateTag();
                                    }
                                }}
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                            {isLoading ? (
                                <p className="text-center text-slate-500 p-2 text-xs">Loading tags...</p>
                            ) : availableTags
                                .filter(t => t.name.toLowerCase().includes(newTagInput.toLowerCase()))
                                .map(tag => (
                                    <div
                                        key={tag.id}
                                        onClick={() => toggleTag(tag.name)}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${data.tags?.includes(tag.name) ? 'bg-teal-500/10 text-teal-300' : 'hover:bg-slate-700 text-slate-300'}`}
                                    >
                                        <span className="text-sm">{tag.name}</span>
                                        {data.tags?.includes(tag.name) && <span className="text-teal-400 text-xs">Selected</span>}
                                    </div>
                                ))}
                            {newTagInput && !availableTags.find(t => t.name.toLowerCase() === newTagInput.toLowerCase()) && (
                                <div onClick={handleCreateTag} className="p-2 text-sm text-brand-400 cursor-pointer hover:bg-brand-500/10 rounded font-medium">
                                    + Create "{newTagInput}"
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                    <p className="text-[10px] text-slate-400">
                        When this node is executed, the selected tags will be {data.action === 'remove' ? 'removed from' : 'added to'} the active contact.
                    </p>
                </div>
            </div>
        </SettingsModal>
    );
};


const AskInputSettingsPanel: React.FC<{ selectedNode: Node & { data: AskInputData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updates: Partial<AskInputData>) => onUpdateNode(selectedNode.id, { ...data, ...updates });

    const inputType = data.inputType || 'Text';

    return (
        <SettingsModal title="Ask Input" onClose={onClose} icon={<MessageIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                {/* 1. Prompt User */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Prompt Message</label>
                    <PanelTextarea value={data.text || ''} onChange={val => handleUpdate({ text: val })} placeholder="e.g. Please enter your email..." rows={3} maxLength={1024} />
                </div>

                {/* 1b. Output Variable */}
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Save Answer To Variable (Optional)</label>
                    <PanelTextInput
                        value={data.outputVariableName || ''}
                        onChange={val => handleUpdate({ outputVariableName: val })}
                        placeholder="e.g. user_email"
                    />
                    <p className="text-[10px] text-slate-500 mt-1 italic">Use this variable name to access the answer later (e.g. {`{{user_email}}`})</p>
                </div>

                {/* 2. Input Configuration */}
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700 space-y-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Input Configuration</label>

                    {/* Input Type Selection */}
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                        {['Text', 'Media'].map((type) => (
                            <button
                                key={type}
                                onClick={() => handleUpdate({ inputType: type as any })}
                                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${inputType === type ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {type} Input
                            </button>
                        ))}
                    </div>

                    {inputType === 'Text' && (
                        <div className="space-y-3 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expected Format</label>
                                <PanelSelect
                                    value={data.textInputType || 'Text'}
                                    onChange={val => {
                                        const updates: any = { textInputType: val as any };
                                        if (val === 'Email') updates.validationRegex = '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$';
                                        else if (val === 'Phone') updates.validationRegex = '^\\+?[0-9]{10,15}$';
                                        else if (val === 'Date') {
                                            updates.dateFormat = 'DD/MM/YYYY'; // Default
                                            updates.validationRegex = '^(0?[1-9]|[12][0-9]|3[01])/(0?[1-9]|1[0-2])/\\d{4}$';
                                        } else {
                                            updates.validationRegex = '';
                                        }
                                        handleUpdate(updates);
                                    }}
                                    options={['Text', 'Name', 'Email', 'Phone', 'Date', 'Number', 'Custom']}
                                />
                            </div>
                            {data.textInputType === 'Date' && (
                                <div className="space-y-3 pt-2 border-t border-slate-700/50">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date Format</label>
                                    <PanelSelect
                                        value={data.dateFormat || 'DD/MM/YYYY'}
                                        onChange={val => {
                                            const newFormat = val as string;
                                            let regex = '';
                                            if (newFormat === 'DD/MM/YYYY') regex = '^(0?[1-9]|[12][0-9]|3[01])/(0?[1-9]|1[0-2])/\\d{4}$';
                                            else if (newFormat === 'MM/DD/YYYY') regex = '^(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])/\\d{4}$';
                                            else if (newFormat === 'YYYY-MM-DD') regex = '^\\d{4}-(0?[1-9]|1[0-2])-(0?[1-9]|[12][0-9]|3[01])$';
                                            else if (newFormat === 'DD-MM-YYYY') regex = '^(0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[0-2])-\\d{4}$';
                                            else if (newFormat === 'DD-MMM-YYYY') regex = '^(0?[1-9]|[12][0-9]|3[01])-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\\d{4}$';
                                            else if (newFormat === 'YYYY/MM/DD') regex = '^\\d{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$';

                                            handleUpdate({ dateFormat: newFormat, validationRegex: regex || (data.validationRegex || '') });
                                        }}
                                        options={['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'DD-MMM-YYYY', 'YYYY/MM/DD', 'Custom Format']}
                                    />
                                    {data.dateFormat === 'Custom Format' && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Custom Regex</label>
                                            <PanelTextInput value={data.validationRegex || ''} onChange={val => handleUpdate({ validationRegex: val })} placeholder="e.g. ^\\d{2}-\\d{2}-\\d{4}$" className="font-mono text-xs" />
                                            <p className="text-[9px] text-slate-500 mt-1">Provide a Regular Expression to validate the date string.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {(data.textInputType === 'Custom' || data.textInputType === 'Text') && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Validation Regex (Optional)</label>
                                    <PanelTextInput value={data.validationRegex || ''} onChange={val => handleUpdate({ validationRegex: val })} placeholder="e.g. ^[0-9]{5}$" className="font-mono text-xs" />
                                </div>
                            )}
                        </div>
                    )}

                    {inputType === 'Media' && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Media Type (Select One)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['Image', 'Video', 'Audio', 'Document'].map((media) => (
                                        <button
                                            key={media}
                                            onClick={() => handleUpdate({ mediaInputType: media as any })}
                                            className={`flex items-center space-x-2 p-2 rounded border transition-all ${data.mediaInputType === media ? 'bg-brand-500/20 border-brand-500 text-brand-300' : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-600'}`}
                                        >
                                            <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${data.mediaInputType === media ? 'border-brand-500' : 'border-slate-600'}`}>
                                                {data.mediaInputType === media && <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                                            </div>
                                            <span className="text-xs font-medium">{media}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {data.mediaInputType && (
                                <div className="animate-fade-in">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Allowed Formats (Optional)</label>
                                    <PanelTextInput
                                        value={data.allowedFormats ? data.allowedFormats.join(', ') : ''}
                                        onChange={val => handleUpdate({ allowedFormats: val ? val.split(',').map(s => s.trim()).filter(Boolean) : [] })}
                                        placeholder="e.g. jpg, png (Leave empty for any)"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1 italic">Comma separated extensions. Leave empty to allow all supported formats.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. Retry Handling */}
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700 space-y-4">
                    <FieldRow label="Retry Logic" description="Handle invalid inputs."><ToggleSwitch checked={!!data.retryCount && data.retryCount > 0} onChange={c => handleUpdate({ retryCount: c ? 3 : 0 })} /></FieldRow>
                    {data.retryCount > 0 && (
                        <div className="space-y-3 animate-fade-in pl-2 border-l-2 border-slate-700">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Retry Attempts</label>
                                    <PanelNumberInput value={data.retryCount} onChange={val => handleUpdate({ retryCount: val })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Error Message (On Invalid)</label>
                                <PanelTextarea value={data.errorMessage || ''} onChange={val => handleUpdate({ errorMessage: val })} placeholder="Invalid input, please try again." rows={2} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Failure Message (Max Retries)</label>
                                <PanelTextarea value={data.retryMessage || ''} onChange={val => handleUpdate({ retryMessage: val })} placeholder="Maximum attempts reached." rows={2} />
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Timeout Handling */}
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700 space-y-4">
                    <FieldRow label="Timeout Logic" description="If user doesn't respond."><ToggleSwitch checked={data.ifUnresponsive} onChange={c => handleUpdate({ ifUnresponsive: c })} /></FieldRow>
                    {data.ifUnresponsive && (
                        <div className="space-y-3 animate-fade-in pl-2 border-l-2 border-slate-700">
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Duration</label>
                                    <PanelNumberInput value={data.timeout || 15} onChange={val => handleUpdate({ timeout: val })} />
                                </div>
                                <div className="w-32">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unit</label>
                                    <PanelSelect value={data.timeoutUnit || 'Minutes'} onChange={val => handleUpdate({ timeoutUnit: val as any })} options={['Minutes', 'Hours', 'Days']} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Timeout Message</label>
                                <PanelTextarea value={data.timeoutMessage || ''} onChange={val => handleUpdate({ timeoutMessage: val })} placeholder="Session timed out due to inactivity." rows={2} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </SettingsModal>
    );
};

const ManageGroupsSettingsPanel: React.FC<{ selectedNode: Node & { data: ManageGroupsData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<ManageGroupsData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [availableGroups, setAvailableGroups] = useState<ContactGroup[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [newGroupInput, setNewGroupInput] = useState('');

    React.useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        setIsLoading(true);
        try {
            const groups = await contactGroupService.getGroups();
            setAvailableGroups(groups);
        } catch (error) {
            console.error('Failed to load groups', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleGroup = (groupId: string) => {
        const currentGroups = data.groups || [];
        if (currentGroups.includes(groupId)) {
            handleUpdate({ groups: currentGroups.filter(g => g !== groupId) });
        } else {
            handleUpdate({ groups: [...currentGroups, groupId] });
        }
    };

    const handleCreateGroup = async () => {
        if (!newGroupInput.trim()) return;
        const groupName = newGroupInput.trim();

        try {
            const newGroup = await contactGroupService.saveGroup({ name: groupName } as any);
            if (newGroup) {
                const currentGroups = data.groups || [];
                handleUpdate({ groups: [...currentGroups, newGroup.id] });
                setNewGroupInput('');
                loadGroups();
            }
        } catch (e) {
            console.error('Failed to create group', e);
        }
    };

    const getGroupName = (id: string) => availableGroups.find(g => g.id === id)?.name || 'Unknown Group';

    return (
        <SettingsModal title="Manage Groups" onClose={onClose} icon={<UsersIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Action</label>
                    <PanelSelect
                        value={data.action || 'add'}
                        onChange={val => handleUpdate({ action: val as 'add' | 'remove' })}
                        options={[{ label: 'Add to Groups', value: 'add' }, { label: 'Remove from Groups', value: 'remove' }]}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Groups</label>

                    {/* Selected Groups Preview */}
                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-950 rounded-lg border border-slate-800 min-h-[42px]">
                        {data.groups && data.groups.length > 0 ? (
                            data.groups.map(groupId => (
                                <span key={groupId} className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    {getGroupName(groupId)}
                                    <button onClick={() => toggleGroup(groupId)} className="hover:text-white"><CloseIcon className="w-3 h-3" /></button>
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-500 text-xs italic">No groups selected</span>
                        )}
                    </div>

                    {/* Available Groups List */}
                    <div className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/20">
                        <div className="p-2 border-b border-slate-700 bg-slate-800/50">
                            <input
                                type="text"
                                placeholder="Search or create group..."
                                className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500"
                                value={newGroupInput}
                                onChange={e => setNewGroupInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCreateGroup();
                                    }
                                }}
                            />
                        </div>
                        <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                            {isLoading ? (
                                <p className="text-center text-slate-500 p-2 text-xs">Loading groups...</p>
                            ) : availableGroups
                                .filter(g => g.name.toLowerCase().includes(newGroupInput.toLowerCase()))
                                .map(group => (
                                    <div
                                        key={group.id}
                                        onClick={() => toggleGroup(group.id)}
                                        className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${data.groups?.includes(group.id) ? 'bg-blue-500/10 text-blue-300' : 'hover:bg-slate-700 text-slate-300'}`}
                                    >
                                        <span className="text-sm">{group.name}</span>
                                        {data.groups?.includes(group.id) && <span className="text-blue-400 text-xs">Selected</span>}
                                    </div>
                                ))}
                            {newGroupInput && !availableGroups.find(g => g.name.toLowerCase() === newGroupInput.toLowerCase()) && (
                                <div onClick={handleCreateGroup} className="p-2 text-sm text-brand-400 cursor-pointer hover:bg-brand-500/10 rounded font-medium">
                                    + Create "{newGroupInput}"
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bg-slate-800/30 p-3 rounded-lg border border-slate-700/50">
                    <p className="text-[10px] text-slate-400">
                        When this node is executed, the contact will be {data.action === 'remove' ? 'removed from' : 'added to'} the selected groups.
                    </p>
                </div>
            </div>
        </SettingsModal>
    );
};





import { pipelineService } from '../services/pipelineService';

const GsheetSettingsPanel: React.FC<{ selectedNode: Node & { data: GsheetData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const { showNotification } = React.useContext(SettingsContext);
    const handleUpdate = (update: Partial<GsheetData>) => onUpdateNode(selectedNode.id, { ...data, ...update });

    const [sheetOptions, setSheetOptions] = useState<{ label: string; value: string }[]>([]);
    const [columnOptions, setColumnOptions] = useState<{ label: string; value: string }[]>(
        Object.keys(data.rowData || {}).length > 0
            ? Object.keys(data.rowData || {}).map(k => ({ label: k, value: k }))
            : []
    );
    const [isLoadingSheets, setIsLoadingSheets] = useState(false);
    const [isLoadingColumns, setIsLoadingColumns] = useState(false);
    const [connections, setConnections] = useState<{ id: string, connection_name: string }[]>([]);

    React.useEffect(() => {
        integrationsService.getGoogleConnections().then(setConnections).catch(console.error);
    }, []);

    const handleSignIn = () => {
        if (!data.clientId || !data.clientSecret) {
            showNotification('Please enter Client ID and Client Secret first.', 'error');
            return;
        }

        const redirectUrl = `${window.location.origin}/rest/oauth2-credential/callback`;
        const scope = 'https://www.googleapis.com/auth/spreadsheets';
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${data.clientId}&redirect_uri=${encodeURIComponent(redirectUrl)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

        // Open Popup
        const width = 600;
        const height = 700;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        const popup = window.open(authUrl, 'Google Auth', `width=${width},height=${height},top=${top},left=${left}`);

        // Listen for message
        const messageHandler = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'GOOGLE_AUTH_CODE') {
                const code = event.data.code;
                if (popup) popup.close();
                window.removeEventListener('message', messageHandler);

                showNotification('Code received. Exchanging for valid connection...', 'success');

                try {
                    // Exchange Token
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch('/api/integrations/google/exchange', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`
                        },
                        body: JSON.stringify({
                            code,
                            clientId: data.clientId,
                            clientSecret: data.clientSecret,
                            redirectUrl
                        })
                    });

                    const resData = await res.json();
                    if (resData.tokens) {
                        handleUpdate({
                            credentialId: 'custom-oauth',
                            ...resData.tokens
                        });
                        showNotification('Google Account Connected Successfully!', 'success');
                    } else {
                        showNotification('Token exchange failed: ' + resData.error, 'error');
                    }
                } catch (e: any) {
                    showNotification('Connection Error: ' + e.message, 'error');
                }
            }
        };

        window.addEventListener('message', messageHandler);
        window.addEventListener('message', messageHandler);
    };

    const fetchSheets = async () => {
        if (!data.spreadsheetId) return showNotification('Please enter a Spreadsheet ID', 'error');

        const isStoredCredential = data.credentialId && !['new', 'custom-oauth'].includes(data.credentialId);
        if (!isStoredCredential && !data.access_token) return showNotification('Please sign in first', 'error');

        setIsLoadingSheets(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/integrations/google/sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({
                    spreadsheetId: data.spreadsheetId,
                    connectionId: (data.credentialId && !['new', 'custom-oauth'].includes(data.credentialId!)) ? data.credentialId : undefined,
                    tokens: (data.credentialId && !['new', 'custom-oauth'].includes(data.credentialId!)) ? undefined : {
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        scope: 'https://www.googleapis.com/auth/spreadsheets',
                        token_type: 'Bearer',
                        expiry_date: data.expiry_date
                    }
                })
            });
            const resData = await res.json();
            if (resData.sheets) {
                setSheetOptions(resData.sheets.map((s: string) => ({ label: s, value: s })));
                showNotification('Sheets loaded successfully', 'success');
            } else {
                showNotification('Failed to load sheets: ' + resData.error, 'error');
            }
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setIsLoadingSheets(false);
        }
    };

    // Auto-fetch columns when a sheet is selected (if we have a sheet name)
    // Refactored to accept argument to avoid stale state issues in event handlers
    const fetchColumns = async (overrideSheetName?: string) => {
        const sheetNameToUse = overrideSheetName || data.sheetName;

        if (!data.spreadsheetId || !sheetNameToUse) return showNotification('Please enter Spreadsheet ID and Sheet Name', 'error');

        const isStoredCredential = data.credentialId && !['new', 'custom-oauth'].includes(data.credentialId);
        if (!isStoredCredential && !data.access_token) return showNotification('Please sign in first', 'error');

        setIsLoadingColumns(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/integrations/google/columns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
                body: JSON.stringify({
                    spreadsheetId: data.spreadsheetId,
                    sheetName: sheetNameToUse,
                    connectionId: (data.credentialId && !['new', 'custom-oauth'].includes(data.credentialId!)) ? data.credentialId : undefined,
                    tokens: (data.credentialId && !['new', 'custom-oauth'].includes(data.credentialId!)) ? undefined : {
                        access_token: data.access_token,
                        refresh_token: data.refresh_token,
                        scope: 'https://www.googleapis.com/auth/spreadsheets',
                        token_type: 'Bearer',
                        expiry_date: data.expiry_date
                    }
                })
            });
            const resData = await res.json();
            if (resData.columns) {
                const newRowData = { ...data.rowData };
                resData.columns.forEach((col: string) => {
                    if (newRowData[col] === undefined) {
                        newRowData[col] = '';
                    }
                });

                // Set columns for dropdown
                setColumnOptions(resData.columns.map((c: string) => ({ label: c, value: c })));

                // Note: We use handleUpdate here. If this is called from onChange, 
                // we should be careful about batching, but for now this is fine.
                handleUpdate({ rowData: newRowData, sheetName: sheetNameToUse, columns: resData.columns });
                showNotification('Columns fetched successfully', 'success');
            } else {
                showNotification('Failed to load columns: ' + resData.error, 'error');
            }
        } catch (e: any) {
            showNotification(e.message, 'error');
        } finally {
            setIsLoadingColumns(false);
        }
    };

    return (
        <SettingsModal title="Google Sheets" onClose={onClose} icon={<GsheetIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Connection</label>
                        <a
                            href="https://console.cloud.google.com/apis/credentials"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] text-brand-400 hover:text-brand-300 transition-colors"
                        >
                            <InfoIcon className="w-4 h-4" />
                            <span>How to get credentials?</span>
                        </a>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Credential</label>
                            <PanelSelect
                                value={data.credentialId || ''}
                                onChange={val => handleUpdate({ credentialId: val })}
                                options={[{ label: 'Select Credential...', value: '' }, ...connections.map(c => ({ label: c.connection_name, value: c.id })), { label: 'New Credential', value: 'new' }, { label: 'Connected Account', value: 'custom-oauth' }]}
                            />
                        </div>

                        {['new', 'custom-oauth', ''].includes(data.credentialId || '') && (
                            <div className="space-y-3 pt-3 border-t border-slate-700/50">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">OAuth Redirect URL</label>
                                    <div className="bg-slate-900/50 border border-slate-800 rounded px-3 py-2 text-[10px] font-mono text-slate-400 break-all select-all">
                                        {window.location.origin}/rest/oauth2-credential/callback
                                    </div>
                                    <p className="text-[9px] text-slate-500 mt-1">Use this URL in Google Cloud Console.</p>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client ID</label>
                                    <PanelTextInput
                                        value={data.clientId || ''}
                                        onChange={val => handleUpdate({ clientId: val })}
                                        placeholder="Enter Client ID"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Client Secret</label>
                                    <PanelTextInput
                                        value={data.clientSecret || ''}
                                        onChange={val => handleUpdate({ clientSecret: val })}
                                        placeholder="Enter Client Secret"
                                        type="password"
                                    />
                                </div>
                                <button
                                    onClick={handleSignIn}
                                    className="w-full py-2 bg-white text-slate-900 font-bold text-xs rounded hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.64 2 12.2 2C6.42 2 2 6.5 2 12s4.42 10 10.2 10c5.31 0 9.14-3.5 9.14-9.1 0-.9-.08-1.72-.18-2.61z" /></svg>
                                    {data.credentialId === 'custom-oauth' ? 'Re-Connect Account' : 'Sign in with Google'}
                                </button>
                                {data.credentialId === 'custom-oauth' && (
                                    <p className="text-[10px] text-green-400 text-center font-bold">✓ Account Connected</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Resource</label>
                        <PanelSelect
                            value="sheet_within_document"
                            onChange={() => { }}
                            options={[{ label: 'Sheet Within Document', value: 'sheet_within_document' }]}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Operation</label>
                        <PanelSelect
                            value={data.operation || 'append'}
                            onChange={val => handleUpdate({ operation: val as any })}
                            options={[
                                { label: 'Append Row', value: 'append' },
                                { label: 'Read Row', value: 'read' },
                                { label: 'Update Row', value: 'update' },
                                { label: 'Clear Row', value: 'clear' }
                            ]}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Spreadsheet ID</label>
                        <PanelTextInput
                            value={data.spreadsheetId || ''}
                            onChange={val => handleUpdate({ spreadsheetId: val })}
                            placeholder="Spreadsheet ID (from URL)"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sheet Name</label>
                        <div className="flex gap-2">
                            {sheetOptions.length > 0 ? (
                                <PanelSelect
                                    value={data.sheetName || ''}
                                    onChange={val => {
                                        // handleUpdate({ sheetName: val }); // Handled inside fetchColumns now to ensure sync or just call here
                                        handleUpdate({ sheetName: val });
                                        fetchColumns(val);
                                    }}
                                    options={[{ label: 'Select Sheet...', value: '' }, ...sheetOptions]}
                                />
                            ) : (
                                <div className="flex-1">
                                    <PanelTextInput
                                        value={data.sheetName || ''}
                                        onChange={val => handleUpdate({ sheetName: val })}
                                        placeholder="Sheet1"
                                    />
                                </div>
                            )}
                            <button
                                onClick={fetchSheets}
                                disabled={isLoadingSheets}
                                className="px-3 py-2 bg-slate-700 text-white text-xs font-bold rounded hover:bg-slate-600 transition-colors whitespace-nowrap"
                            >
                                {isLoadingSheets ? '...' : 'Load Sheets'}
                            </button>
                        </div>
                    </div>

                    {data.operation === 'update' && (
                        <div className="space-y-4 pt-4 border-t border-slate-700/50">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lookup Column</label>
                                {columnOptions.length > 0 ? (
                                    <PanelSelect
                                        value={data.lookupColumn || ''}
                                        onChange={val => handleUpdate({ lookupColumn: val })}
                                        options={[{ label: 'Select Column...', value: '' }, ...columnOptions]}
                                    />
                                ) : (
                                    <PanelTextInput
                                        value={data.lookupColumn || ''}
                                        onChange={val => handleUpdate({ lookupColumn: val })}
                                        placeholder="e.g. A, Email, Phone (Header Name or Column Letter)"
                                    />
                                )}
                                <p className="text-[10px] text-slate-500 mt-1">Column to search in.</p>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lookup Value</label>
                                <PanelTextInput
                                    value={data.lookupValue || ''}
                                    onChange={val => handleUpdate({ lookupValue: val })}
                                    placeholder="Value to find"
                                />
                                <p className="text-[10px] text-slate-500 mt-1">Value to match in the lookup column.</p>
                            </div>
                        </div>
                    )}

                </div>

                {(data.operation === 'append' || data.operation === 'update' || !data.operation) && (
                    <div className="bg-slate-800/20 p-3 rounded-lg border border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Row Values</label>
                            <button
                                onClick={() => fetchColumns()}
                                disabled={isLoadingColumns}
                                className="text-[10px] bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors"
                            >
                                {isLoadingColumns ? 'Fetching...' : 'Fetch Columns'}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mb-2">Map sheet headers to values.</p>
                        <div className="space-y-2">
                            {Object.entries(data.rowData || {}).map(([key, val], idx) => (
                                <div key={idx} className="flex gap-2">
                                    <PanelTextInput value={key} onChange={k => {
                                        const newRow = { ...data.rowData };
                                        delete newRow[key];
                                        newRow[k] = val;
                                        handleUpdate({ rowData: newRow });
                                    }} placeholder="Header" />
                                    <PanelTextInput value={val} onChange={v => {
                                        handleUpdate({ rowData: { ...data.rowData, [key]: v } });
                                    }} placeholder="Value" disabled={data.operation === 'update' && key === data.lookupColumn} />
                                    <button onClick={() => {
                                        const newRow = { ...data.rowData };
                                        delete newRow[key];
                                        handleUpdate({ rowData: newRow });
                                    }} className="text-slate-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            ))}
                            <button onClick={() => handleUpdate({ rowData: { ...data.rowData, [`Column ${Object.keys(data.rowData || {}).length + 1}`]: '' } })} className="text-[10px] text-brand-400 font-bold uppercase hover:underline">+ Add Column</button>
                        </div>
                    </div>
                )}
            </div>
        </SettingsModal>
    );
};

const PipelineTriggerSettingsPanel: React.FC<{ selectedNode: Node & { data: PipelineTriggerData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<PipelineTriggerData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [pipelines, setPipelines] = useState<{ label: string, value: string }[]>([]);
    const [stages, setStages] = useState<{ label: string, value: string }[]>([]);
    const [loadingPipelines, setLoadingPipelines] = useState(false);
    const [loadingStages, setLoadingStages] = useState(false);

    // Load Pipelines on mount
    React.useEffect(() => {
        const loadPipelines = async () => {
            setLoadingPipelines(true);
            try {
                const items = await pipelineService.getPipelines();
                setPipelines(items.map(p => ({ label: p.name, value: p.id })));
            } catch (e) { console.error(e); }
            setLoadingPipelines(false);
        };
        loadPipelines();
    }, []);

    // Load Stages when pipelineId changes
    React.useEffect(() => {
        if (!data.pipelineId) {
            setStages([]);
            return;
        }
        const loadStages = async () => {
            setLoadingStages(true);
            try {
                const items = await pipelineService.getPipelineStages(data.pipelineId);
                setStages(items.map(s => ({ label: s.name, value: s.id })));
            } catch (e) { console.error(e); }
            setLoadingStages(false);
        };
        loadStages();
    }, [data.pipelineId]);

    return (
        <SettingsModal title="Added to Pipeline Trigger" onClose={onClose} icon={<BookmarkIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Pipeline</label>
                    {loadingPipelines ? <p className="text-xs text-slate-500">Loading pipelines...</p> :
                        <PanelSelect
                            value={data.pipelineId || ''}
                            onChange={(val) => handleUpdate({ pipelineId: val, stageId: '' })}
                            options={[{ label: 'Select Pipeline...', value: '' }, ...pipelines]}
                        />
                    }
                </div>

                {data.pipelineId && (
                    <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Stage (Optional)</label>
                        {loadingStages ? <p className="text-xs text-slate-500">Loading stages...</p> :
                            <PanelSelect
                                value={data.stageId || ''}
                                onChange={(val) => handleUpdate({ stageId: val })}
                                options={[{ label: 'Any Stage', value: '' }, ...stages]}
                            />
                        }
                        <p className="text-[10px] text-slate-500 mt-2">Leave empty to trigger on any stage in this pipeline.</p>
                    </div>
                )}
            </div>
        </SettingsModal>
    );
};

const ContactPipelineSettingsPanel: React.FC<{ selectedNode: Node & { data: ContactPipelineData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<ContactPipelineData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [pipelines, setPipelines] = useState<{ label: string, value: string }[]>([]);
    const [stages, setStages] = useState<{ label: string, value: string }[]>([]);
    const [loadingPipelines, setLoadingPipelines] = useState(false);
    const [loadingStages, setLoadingStages] = useState(false);

    // Load Pipelines on mount
    React.useEffect(() => {
        const loadPipelines = async () => {
            setLoadingPipelines(true);
            try {
                const items = await pipelineService.getPipelines();
                setPipelines(items.map(p => ({ label: p.name, value: p.id })));
            } catch (e) { console.error(e); }
            setLoadingPipelines(false);
        };
        loadPipelines();
    }, []);

    // Load Stages when pipelineId changes
    React.useEffect(() => {
        if (!data.pipelineId || data.pipelineId.includes('{{')) {
            setStages([]);
            if (data.pipelineId && !data.pipelineId.includes('{{')) {
                // If it's a direct ID, fetch stages, otherwise skip
                const loadStages = async () => {
                    setLoadingStages(true);
                    try {
                        const items = await pipelineService.getPipelineStages(data.pipelineId);
                        setStages(items.map(s => ({ label: s.name, value: s.id })));
                    } catch (e) { console.error(e); }
                    setLoadingStages(false);
                };
                loadStages();
            }
            return;
        }
        const loadStages = async () => {
            setLoadingStages(true);
            try {
                const items = await pipelineService.getPipelineStages(data.pipelineId);
                setStages(items.map(s => ({ label: s.name, value: s.id })));
            } catch (e) { console.error(e); }
            setLoadingStages(false);
        };
        loadStages();
    }, [data.pipelineId]);

    // Helper for toggle field
    const ToggleableField: React.FC<{
        label: string;
        value: string;
        field: keyof ContactPipelineData;
        options: { label: string, value: string }[];
        isLoading: boolean;
        placeholder?: string;
    }> = ({ label, value, field, options, isLoading, placeholder }) => {
        // Simple heuristic: if value contains '{{', assume text mode, else select mode
        // But user might want to switch manually.
        const [mode, setMode] = useState<'select' | 'text'>((value && value.includes('{{')) ? 'text' : 'select');

        return (
            <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                    <button
                        onClick={() => setMode(mode === 'select' ? 'text' : 'select')}
                        className="text-[10px] text-brand-400 hover:text-brand-300 underline decoration-dotted"
                    >
                        {mode === 'select' ? 'Use Variable' : 'Select List'}
                    </button>
                </div>
                {mode === 'select' ? (
                    isLoading ? <div className="text-xs text-slate-500 animate-pulse">Loading...</div> :
                        <PanelSelect value={value || ''} onChange={(val) => handleUpdate({ [field]: val } as any)} options={[{ label: 'Select...', value: '' }, ...options]} />
                ) : (
                    <PanelTextInput value={value || ''} onChange={(val) => handleUpdate({ [field]: val } as any)} placeholder={placeholder || "{{variable}}"} />
                )}
            </div>
        );
    };

    return (
        <SettingsModal title="Update Pipeline Stage" onClose={onClose} icon={<BookmarkIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <ToggleableField
                        label="Select Pipeline"
                        value={data.pipelineId}
                        field="pipelineId"
                        options={pipelines}
                        isLoading={loadingPipelines}
                    />
                    <ToggleableField
                        label="Target Stage"
                        value={data.stageId}
                        field="stageId"
                        options={stages}
                        isLoading={loadingStages}
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lead Details (Optional)</label>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Contact Name</label>
                            <PanelTextInput value={data.name || ''} onChange={val => handleUpdate({ name: val })} placeholder="{{trigger.name}} or Name" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
                            <PanelTextInput value={data.email || ''} onChange={val => handleUpdate({ email: val })} placeholder="{{trigger.email}} or Email" />
                        </div>

                        {/* Custom Fields Section */}
                        <div className="pt-2 border-t border-slate-800/50">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase">Additional Fields</label>
                                <button
                                    onClick={() => handleUpdate({ customFields: [...(data.customFields || []), { key: '', value: '' }] })}
                                    className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase flex items-center gap-1"
                                >
                                    <PlusIcon className="w-3 h-3" /> Add Field
                                </button>
                            </div>

                            {/* Helpful Examples */}
                            <div className="mb-3 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                <p className="text-[10px] text-blue-300 font-medium mb-1">💡 Common Field Names:</p>
                                <div className="flex flex-wrap gap-1">
                                    {['company', 'budget', 'source', 'notes', 'website', 'city', 'country'].map(fieldName => (
                                        <button
                                            key={fieldName}
                                            onClick={() => handleUpdate({ customFields: [...(data.customFields || []), { key: fieldName, value: '' }] })}
                                            className="text-[9px] px-2 py-0.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-200 rounded border border-blue-500/40 transition-colors"
                                        >
                                            {fieldName}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {data.customFields?.map((field, index) => (
                                    <div key={index} className="flex gap-2">
                                        <div className="flex-1">
                                            <PanelTextInput
                                                value={field.key}
                                                onChange={(val) => {
                                                    const newFields = [...(data.customFields || [])];
                                                    newFields[index].key = val;
                                                    handleUpdate({ customFields: newFields });
                                                }}
                                                placeholder="Field Name (e.g. company)"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <PanelTextInput
                                                value={field.value}
                                                onChange={(val) => {
                                                    const newFields = [...(data.customFields || [])];
                                                    newFields[index].value = val;
                                                    handleUpdate({ customFields: newFields });
                                                }}
                                                placeholder="Value"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const newFields = (data.customFields || []).filter((_, i) => i !== index);
                                                handleUpdate({ customFields: newFields });
                                            }}
                                            className="text-slate-500 hover:text-red-400 p-1"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {(!data.customFields || data.customFields.length === 0) && (
                                    <p className="text-[10px] text-slate-600 italic">No additional fields configured.</p>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2">
                                <strong>Note:</strong> Only fields that exist in your <code className="text-amber-400">leads</code> database table will be saved. Click the suggestions above to quickly add common fields.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Output</label>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Save Result to Variable</label>
                        <PanelTextInput value={data.outputVariableName || ''} onChange={val => handleUpdate({ outputVariableName: val })} placeholder="e.g. stage_result" />
                        <p className="text-[10px] text-slate-500 mt-1">Stores the executed pipelineName and stageName.</p>
                    </div>
                </div>
            </div>
        </SettingsModal>
    );
};

const OnMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: OnMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: Partial<OnMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...updated });

    return (
        <SettingsModal title="On Message (Trigger)" onClose={onClose} icon={<TriggerIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trigger Type</label>
                    <PanelSelect
                        value={data.messageType || 'Text'}
                        onChange={val => handleUpdate({ messageType: val as any })}
                        options={['Text', 'Image', 'Audio', 'Video', 'Document']}
                    />
                </div>
                {data.messageType === 'Text' && (
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Keywords (Exact Match)</label>
                        <p className="text-xs text-slate-500 mb-2">Enter keywords separated by comma. Leave empty for "Any Text".</p>
                        <PanelTextInput
                            value={data.keywords ? data.keywords.join(', ') : ''}
                            onChange={val => handleUpdate({ keywords: val.split(',').map(k => k.trim()).filter(k => k) })}
                            placeholder="e.g. hello, hi, start"
                        />
                    </div>
                )}
            </div>
        </SettingsModal>
    );
};

const TextMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: TextMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: Partial<TextMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...updated });
    return (
        <SettingsModal title="Send Text" onClose={onClose} icon={<MessageIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                <PanelTextarea
                    value={data.message}
                    onChange={val => handleUpdate({ message: val })}
                    placeholder="Type your message..."
                    rows={6}
                />
            </div>
        </SettingsModal>
    );
};

const WebhookSettingsPanel: React.FC<{ selectedNode: Node & { data: WebhookData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: Partial<WebhookData>) => onUpdateNode(selectedNode.id, { ...data, ...updated });
    return (
        <SettingsModal title="Webhook Event" onClose={onClose} icon={<WebhookIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Event Type</label>
                <PanelTextInput
                    value={data.eventType || ''}
                    onChange={val => handleUpdate({ eventType: val })}
                    placeholder="e.g. order_updated"
                />
            </div>
        </SettingsModal>
    );
};

const WriteAttributeSettingsPanel: React.FC<{ selectedNode: Node & { data: WriteAttributeData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: any) => onUpdateNode(selectedNode.id, { ...data, ...updated }); // Generic update for now
    return (
        <SettingsModal title="Write Attribute" onClose={onClose} icon={<EditIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attribute Name</label>
                    <PanelSelect value={data.key || 'Custom'} onChange={val => handleUpdate({ key: val })} options={['Name', 'Email', 'Phone', 'Custom']} />
                    {data.key === 'Custom' && <PanelTextInput value={data.customKey || ''} onChange={val => handleUpdate({ customKey: val })} placeholder="Attribute Key" className="mt-2" />}
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Value</label>
                    <PanelTextInput value={data.value || ''} onChange={val => handleUpdate({ value: val })} placeholder="Value to write" />
                </div>
            </div>
        </SettingsModal>
    );
};

const AskLocationSettingsPanel: React.FC<{ selectedNode: Node & { data: AskLocationData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: Partial<AskLocationData>) => onUpdateNode(selectedNode.id, { ...data, ...updated });
    return (
        <SettingsModal title="Ask Location" onClose={onClose} icon={<AskLocationIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label>
                <PanelTextarea value={data.text} onChange={val => handleUpdate({ text: val })} placeholder="Request location message..." rows={4} />
            </div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} allowSaveResponse={true} />
        </SettingsModal>
    );
};

const CodeSettingsPanel: React.FC<{ selectedNode: Node & { data: CodeData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (updated: Partial<CodeData>) => onUpdateNode(selectedNode.id, { ...data, ...updated });
    return (
        <SettingsModal title="Execute Code" onClose={onClose} icon={<CodeIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">JavaScript Code</label>
                <PanelTextarea value={data.code} onChange={val => handleUpdate({ code: val })} placeholder="// Write JS Code. return { key: value };" rows={12} className="font-mono text-xs" />
                <p className="text-[10px] text-slate-500 mt-2">Return a JSON object to set variables.</p>
            </div>
        </SettingsModal>
    );
};

const GmailSettingsPanel: React.FC<{ selectedNode: Node & { data: GmailData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const { showNotification } = React.useContext(SettingsContext);
    const handleUpdate = (updatedFields: Partial<GmailData>) => onUpdateNode(selectedNode.id, { ...data, ...updatedFields });
    const [connections, setConnections] = useState<{ id: string, connection_name: string, metadata?: any }[]>([]);
    const [isSending, setIsSending] = useState(false);

    React.useEffect(() => {
        integrationsService.getGmailConnections().then(setConnections).catch(console.error);
    }, []);

    const handleSendTest = async () => {
        if (!data.connectionId) return showNotification('Please select a Google Account first.', 'error');
        if (!data.to) return showNotification('Please enter a recipient.', 'error');

        // Check if recipient is a variable
        if (data.to.includes('{{')) return showNotification('Cannot test with variables. Please enter a real email address.', 'error');

        setIsSending(true);
        try {
            await integrationsService.sendGmailEmail(data.connectionId, data.to, data.subject || 'Test Subject', data.body || 'Test Body');
            showNotification('Test email sent successfully!', 'success');
        } catch (e: any) {
            showNotification('Failed to send test email: ' + e.message, 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SettingsModal title="Send Email (Gmail)" onClose={onClose} icon={<GmailIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Google Account</label>
                    {connections.length > 0 ? (
                        <PanelSelect
                            value={data.connectionId}
                            onChange={(val) => handleUpdate({ connectionId: val })}
                            options={[{ label: 'Select Account...', value: '' }, ...connections.map(c => ({
                                label: c.metadata?.email ? `${c.metadata.email} (${c.connection_name})` : c.connection_name,
                                value: c.id
                            }))]}
                        />
                    ) : (
                        <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                            No Gmail accounts connected. Please go to Integrations page.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">To (Recipient)</label>
                    <PanelTextInput
                        value={data.to}
                        onChange={val => handleUpdate({ to: val })}
                        placeholder="e.g. {{email}} or user@example.com"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
                    <PanelTextInput
                        value={data.subject}
                        onChange={val => handleUpdate({ subject: val })}
                        placeholder="Email Subject"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label>
                    <PanelTextarea
                        value={data.body}
                        onChange={val => handleUpdate({ body: val })}
                        placeholder="Email content..."
                        rows={6}
                    />
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <button
                        onClick={handleSendTest}
                        disabled={isSending}
                        className={`w-full py-2 flex items-center justify-center space-x-2 rounded-lg font-bold text-xs transition-colors ${isSending ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'}`}
                    >
                        {isSending ? (
                            <span>Sending...</span>
                        ) : (
                            <>
                                <GmailIcon className="w-4 h-4" />
                                <span>Send Test Email</span>
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-2">
                        Sends a test email to the address specified in "To". Variables (e.g. {'{{name}}'}) are not supported in test mode.
                    </p>
                </div>
            </div>
        </SettingsModal>
    );
};

const CalendarSettingsPanel: React.FC<{ selectedNode: Node & { data: CalendarData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<CalendarData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const { showNotification } = React.useContext(SettingsContext);

    const [connections, setConnections] = useState<{ id: string, connection_name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    React.useEffect(() => {
        const fetchConnections = async () => {
            setIsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;
                const res = await fetch('/api/integrations/calendar/connections', {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const json = await res.json();
                    setConnections(json || []);
                }
            } catch (e) {
                console.error("Failed to fetch calendar connections", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchConnections();
    }, []);

    // Listen for OAuth Success
    React.useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            if (event.data?.type === 'GOOGLE_AUTH_CODE') {
                const code = event.data.code;
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) return;
                    const res = await fetch('/api/integrations/calendar/exchange', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            code,
                            redirectUrl: window.location.origin + '/rest/oauth2-credential/callback'
                        })
                    });
                    const json = await res.json();
                    if (json.success) {
                        showNotification('Connected successfully!', 'success');
                        const freshRes = await fetch('/api/integrations/calendar/connections', {
                            headers: { 'Authorization': `Bearer ${session.access_token}` }
                        });
                        const freshJson = await freshRes.json();
                        setConnections(freshJson || []);
                    } else {
                        showNotification('Failed to connect: ' + json.error, 'error');
                    }
                } catch (e: any) {
                    showNotification('Connection error: ' + e.message, 'error');
                }
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [showNotification]);

    const handleAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/integrations/calendar/auth-url', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ redirectUrl: window.location.origin + '/rest/oauth2-credential/callback' })
            });
            const json = await res.json();
            if (json.url) {
                // Open popup
                const width = 600;
                const height = 700;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                window.open(json.url, 'Google Calendar Auth', `width=${width},height=${height},top=${top},left=${left}`);
            }
        } catch (e) {
            showNotification('Failed to start auth', 'error');
        }
    };

    return (
        <SettingsModal title="Google Calendar" onClose={onClose} icon={<CalendarIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Connection</label>
                        <button onClick={handleAuth} className="text-[10px] text-brand-400 font-bold uppercase hover:text-brand-300">+ Add Account</button>
                    </div>
                    {isLoading ? (
                        <p className="text-xs text-slate-500">Loading...</p>
                    ) : connections.length > 0 ? (
                        <PanelSelect
                            value={data.connectionId || ''}
                            onChange={val => handleUpdate({ connectionId: val })}
                            options={[{ label: 'Select Account...', value: '' }, ...connections.map(c => ({ label: c.connection_name, value: c.id }))]}
                        />
                    ) : (
                        <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                            No accounts connected. Click "+ Add Account" to connect Google Calendar.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Action</label>
                    <PanelSelect
                        value={data.action || 'create_event'}
                        onChange={val => handleUpdate({ action: val as any })}
                        options={[
                            { label: 'Create Event', value: 'create_event' },
                            { label: 'Check Availability', value: 'check_availability' },
                            { label: 'Get Available Slots', value: 'get_available_slots' }
                        ]}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            {data.action === 'get_available_slots' ? 'Search From' : 'Start Time'}
                        </label>
                        {data.action === 'get_available_slots' ? (
                            <div className="space-y-2">
                                <PanelSelect
                                    value={
                                        !data.startTime ? 'now' :
                                            data.startTime.toLowerCase() === 'tomorrow' ? 'tomorrow' :
                                                data.startTime.toLowerCase() === 'next monday' ? 'next_monday' :
                                                    'custom'
                                    }
                                    onChange={(val) => {
                                        if (val === 'now') handleUpdate({ startTime: '' });
                                        else if (val === 'tomorrow') handleUpdate({ startTime: 'Tomorrow' });
                                        else if (val === 'next_monday') handleUpdate({ startTime: 'Next Monday' });
                                        else if (val === 'custom') handleUpdate({ startTime: '{{}}' }); // Reset or keep? Let's just switch mode.
                                        // Actually if switching to custom, maybe we just leave it or set a placeholder.
                                        // Better: If they pick 'custom', we don't overwrite immediately if it's already custom.
                                    }}
                                    options={[
                                        { label: 'Now (Immediate)', value: 'now' },
                                        { label: 'Tomorrow Morning', value: 'tomorrow' },
                                        { label: 'Next Monday', value: 'next_monday' },
                                        { label: 'Custom / Variable', value: 'custom' }
                                    ]}
                                />
                                {(!data.startTime || (data.startTime.toLowerCase() !== 'tomorrow' && data.startTime.toLowerCase() !== 'next monday' && data.startTime !== '')) && (
                                    <PanelTextInput
                                        value={data.startTime || ''}
                                        onChange={val => handleUpdate({ startTime: val })}
                                        placeholder="ISO Date or {{date}}"
                                    />
                                )}
                            </div>
                        ) : (
                            <PanelTextInput
                                value={data.startTime || ''}
                                onChange={val => handleUpdate({ startTime: val })}
                                placeholder="ISO Date or {{date}}"
                            />
                        )}
                        <p className="text-[9px] text-slate-500 mt-1">Accepts ISO strings or natural text like "Tomorrow at 4pm".</p>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Timezone (Formatting)</label>
                    <PanelSelect
                        value={data.timezone || 'UTC'}
                        onChange={val => handleUpdate({ timezone: val })}
                        options={[
                            { label: 'UTC (Default)', value: 'UTC' },
                            { label: 'India (IST)', value: 'Asia/Kolkata' },
                            { label: 'USA (EST)', value: 'America/New_York' },
                            { label: 'USA (PST)', value: 'America/Los_Angeles' },
                            { label: 'UK (GMT)', value: 'Europe/London' },
                            { label: 'Europe (CET)', value: 'Europe/Paris' },
                            { label: 'Australia (AEST)', value: 'Australia/Sydney' }
                        ]}
                    />
                    <p className="text-[9px] text-slate-500 mt-1">Used to format displayed dates. Does not change ISO times.</p>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {data.endTime && !data.duration ? 'End Time' : 'Duration'}
                        </label>
                        <button
                            onClick={() => handleUpdate({ endTime: data.endTime ? '' : undefined, duration: data.endTime ? 60 : undefined })}
                            className="text-[9px] text-brand-400 hover:text-brand-300 underline"
                        >
                            {data.endTime && !data.duration ? 'Use Duration' : 'Use End Time'}
                        </button>
                    </div>

                    {data.endTime && !data.duration ? (
                        <PanelTextInput
                            value={data.endTime || ''}
                            onChange={val => handleUpdate({ endTime: val, duration: undefined })}
                            placeholder="ISO Date or {{date}}"
                        />
                    ) : (
                        <div className="flex space-x-2">
                            <PanelNumberInput
                                value={data.duration || 60}
                                onChange={val => handleUpdate({ duration: val, endTime: '' })}
                            />
                            <PanelSelect
                                value={data.durationUnit || 'minutes'}
                                onChange={val => handleUpdate({ durationUnit: val as any })}
                                options={[{ label: 'Minutes', value: 'minutes' }, { label: 'Hours', value: 'hours' }]}
                                className="w-24 min-w-[6rem]"
                            />
                        </div>
                    )}
                </div>


                {(data.action === 'create_event' || !data.action) && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Event Title (Summary)</label>
                            <PanelTextInput
                                value={data.summary || ''}
                                onChange={val => handleUpdate({ summary: val })}
                                placeholder="e.g. Meeting with {{name}}"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</label>
                            <PanelTextarea
                                value={data.description || ''}
                                onChange={val => handleUpdate({ description: val })}
                                placeholder="Event details..."
                                rows={3}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Attendees</label>
                            <PanelTextInput
                                value={data.attendees || ''}
                                onChange={val => handleUpdate({ attendees: val })}
                                placeholder="user@example.com, {{email}}"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Comma separated emails.</p>
                        </div>

                        <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                            <FieldRow label="Add Google Meet Link" description="Generate a meeting link.">
                                <ToggleSwitch checked={!!data.addMeetLink} onChange={checked => handleUpdate({ addMeetLink: checked })} />
                            </FieldRow>
                        </div>
                    </div>
                )}

                {data.action === 'check_availability' && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Save Result To Variable</label>
                            <PanelTextInput
                                value={data.outputVariableName || ''}
                                onChange={val => handleUpdate({ outputVariableName: val })}
                                placeholder="e.g. is_slot_free"
                            />
                            <p className="text-[10px] text-slate-500 mt-1">
                                Returns 'true' if free, 'false' if busy. Access via <code>{`{{${data.outputVariableName || 'variable'}}}`}</code>.
                            </p>
                        </div>
                    </div>
                )}

                {data.action === 'get_available_slots' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Work Start Hour (0-23)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={23}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={data.workStartHour || 9}
                                    onChange={e => handleUpdate({ workStartHour: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Work End Hour (0-23)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={23}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={data.workEndHour || 17}
                                    onChange={e => handleUpdate({ workEndHour: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Days to Look Ahead</label>
                            <input
                                type="number"
                                min={1}
                                max={30}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
                                value={data.daysToCheck || 3}
                                onChange={e => handleUpdate({ daysToCheck: parseInt(e.target.value) })}
                            />
                        </div>
                    </div>
                )}
            </div>
        </SettingsModal >
    );
};

const TaskReminderSettingsPanel: React.FC<{ selectedNode: Node & { data: TaskReminderData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<TaskReminderData>) => onUpdateNode(selectedNode.id, { ...data, ...update });

    return (
        <SettingsModal title="Task Trigger" onClose={onClose} icon={<TimingIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-4">
                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trigger Event</label>
                    <PanelSelect
                        value={data.triggerEvent || 'task_due'}
                        onChange={val => handleUpdate({ triggerEvent: val as any })}
                        options={[
                            { label: 'When Task is Due', value: 'task_due' },
                            { label: 'Upcoming (Before Due)', value: 'task_upcoming' },
                            { label: 'Overdue (Missed)', value: 'task_overdue' },
                            { label: 'When Task is Completed', value: 'task_completed' }
                        ]}
                    />

                    {(data.triggerEvent === 'task_upcoming' || data.triggerEvent === 'task_overdue') && (
                        <div className="mt-3 animate-fade-in p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                {data.triggerEvent === 'task_upcoming' ? 'Time Before Due' : 'Time After Due'}
                            </label>

                            {/* Logic to parse minutes into Value + Unit */}
                            {(() => {
                                const minutes = data.timeOffset || 60;
                                let initialUnit = 'minutes';
                                let initialVal = minutes;

                                if (minutes % 1440 === 0) { initialUnit = 'days'; initialVal = minutes / 1440; }
                                else if (minutes % 60 === 0) { initialUnit = 'hours'; initialVal = minutes / 60; }

                                return (
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none transition-all placeholder-slate-600"
                                                placeholder="Value"
                                                value={initialVal}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 0;
                                                    const multiplier = initialUnit === 'days' ? 1440 : (initialUnit === 'hours' ? 60 : 1);
                                                    handleUpdate({ timeOffset: val * multiplier });
                                                }}
                                            />
                                        </div>
                                        <div className="w-1/3">
                                            <select
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer"
                                                value={initialUnit}
                                                onChange={(e) => {
                                                    const newUnit = e.target.value;
                                                    const multiplier = newUnit === 'days' ? 1440 : (newUnit === 'hours' ? 60 : 1);
                                                    handleUpdate({ timeOffset: initialVal * multiplier });
                                                }}
                                            >
                                                <option value="minutes">Mins</option>
                                                <option value="hours">Hours</option>
                                                <option value="days">Days</option>
                                            </select>
                                        </div>
                                    </div>
                                );
                            })()}

                            <div className="mt-1 text-[10px] text-slate-500 text-right">
                                Total: {data.timeOffset || 60} minutes
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Filter by Task Title</label>
                    <PanelTextInput
                        value={data.titleFilter || ''}
                        onChange={val => handleUpdate({ titleFilter: val })}
                        placeholder="e.g. Follow up"
                    />
                    <p className="text-[10px] text-slate-500 mt-2">Trigger matches any task containing this text. Leave empty for ALL tasks.</p>
                </div>

                <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-amber-500">
                    {data.triggerEvent === 'task_completed'
                        ? <p><strong>Note:</strong> Triggers immediately when you mark a task as 'Done'.</p>
                        : data.triggerEvent === 'task_upcoming'
                            ? <p><strong>Note:</strong> Triggers {data.timeOffset ? data.timeOffset / 60 : 1} hour(s) before the due time.</p>
                            : data.triggerEvent === 'task_overdue'
                                ? <p><strong>Note:</strong> Triggers if task is still incomplete {data.timeOffset ? data.timeOffset / 60 : 1} hour(s) AFTER due time.</p>
                                : <p><strong>Note:</strong> Triggers automatically when a matching task hits its Due Date.</p>
                    }
                </div>
            </div>
        </SettingsModal >
    );
};

const AIAgentSettingsPanel: React.FC<{ selectedNode: Node & { data: AIAgentData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<AIAgentData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    const [agents, setAgents] = useState<{ id: string, name: string }[]>([]);

    // Ensure default values
    React.useEffect(() => {
        if (!data.outputVariableName) {
            handleUpdate({ outputVariableName: 'ai_response' });
        }
        // Fetch Agents
        aiAgentService.listAgents().then(setAgents).catch(err => console.error("Failed to fetch agents", err));
    }, []);

    return (
        <SettingsModal title="AI Agent" onClose={onClose} icon={<RobotIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-6">
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select AI Agent</label>
                    <PanelSelect
                        value={data.agentId || ''}
                        onChange={val => handleUpdate({ agentId: val })}
                        options={[
                            { label: 'Select an Agent...', value: '' },
                            ...agents.map(a => ({ label: a.name, value: a.id }))
                        ]}
                    />
                    <p className="text-[10px] text-slate-500 mt-2">
                        create agents in <span className="font-bold text-brand-400">AI Buddy</span> section.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">User Input / Query</label>
                    <PanelTextarea
                        value={data.userQuery || ''}
                        onChange={val => handleUpdate({ userQuery: val })}
                        placeholder="e.g. {{last_message_body}} or static text"
                        rows={3}
                    />
                    <p className="text-[10px] text-slate-500 mt-1">The text to send to the AI.</p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Output Variable</label>
                    <PanelTextInput
                        value={data.outputVariableName || ''}
                        onChange={val => handleUpdate({ outputVariableName: val })}
                        placeholder="e.g. ai_reply"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Variable to store the AI's response.</p>
                </div>

                {/* Legacy / Advanced Mode Support (Hidden if agent selected, or we can keep it for overrides) */}
                {/* For simplicity, we assume if agentId is set, we use that. If not, users might expect manual config but we are removing it to enforce Central Agent usage as requested. */}
            </div>
        </SettingsModal>
    );
};


const SmtpSettingsPanel: React.FC<{ selectedNode: Node & { data: SmtpData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; availableVariables: NodeVariables[] }> = ({ selectedNode, onUpdateNode, onClose, availableVariables }) => {
    const { data } = selectedNode;
    const { showNotification } = React.useContext(SettingsContext);
    const handleUpdate = (updatedFields: Partial<SmtpData>) => onUpdateNode(selectedNode.id, { ...data, ...updatedFields });
    const [connections, setConnections] = useState<{ id: string, connection_name: string, host: string, user: string, fromEmail?: string }[]>([]);
    const [isSending, setIsSending] = useState(false);

    React.useEffect(() => {
        integrationsService.getSmtpConnections().then(setConnections).catch(console.error);
    }, []);

    const handleSendTest = async () => {
        if (!data.connectionId) return showNotification('Please select an SMTP Account first.', 'error');
        if (!data.to) return showNotification('Please enter a recipient.', 'error');
        if (data.to.includes('{{')) return showNotification('Cannot test with variables.', 'error');

        setIsSending(true);
        try {
            await integrationsService.sendSmtpEmail(data.connectionId, data.to, data.subject || 'Test Subject', data.body || 'Test Body');
            showNotification('Test email sent successfully!', 'success');
        } catch (e: any) {
            showNotification('Failed to send test email: ' + e.message, 'error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <SettingsModal title="Send Email (SMTP)" onClose={onClose} icon={<MessageIcon />} availableVariables={availableVariables} canWrite={canWrite}>
            <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SMTP Account</label>
                    {connections.length > 0 ? (
                        <PanelSelect
                            value={data.connectionId}
                            onChange={(val) => handleUpdate({ connectionId: val })}
                            options={[{ label: 'Select Account...', value: '' }, ...connections.map(c => ({
                                label: `${c.connection_name} (${c.fromEmail || c.user})`,
                                value: c.id
                            }))]}
                        />
                    ) : (
                        <div className="text-xs text-amber-500 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                            No SMTP accounts connected. Please go to Integrations page.
                        </div>
                    )}
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">To (Recipient)</label>
                    <PanelTextInput
                        value={data.to}
                        onChange={val => handleUpdate({ to: val })}
                        placeholder="e.g. {{email}} or user@example.com"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Subject</label>
                    <PanelTextInput
                        value={data.subject}
                        onChange={val => handleUpdate({ subject: val })}
                        placeholder="Email Subject"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label>
                    <PanelTextarea
                        value={data.body}
                        onChange={val => handleUpdate({ body: val })}
                        placeholder="Email content (HTML supported)..."
                        rows={6}
                    />
                </div>

                <div className="border-t border-slate-800 pt-4">
                    <button
                        onClick={handleSendTest}
                        disabled={isSending}
                        className={`w-full py-2 flex items-center justify-center space-x-2 rounded-lg font-bold text-xs transition-colors ${isSending ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'}`}
                    >
                        {isSending ? (
                            <span>Sending...</span>
                        ) : (
                            <>
                                <GmailIcon className="w-4 h-4" />
                                <span>Send Test Email</span>
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-slate-500 text-center mt-2">
                        Sends to the address specified in "To". Variables are not supported in test mode.
                    </p>
                </div>
            </div>
        </SettingsModal>
    );
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ selectedNode, nodes, edges, onUpdateNode, onClose, onShowNotification, canWrite }) => {
    // ... (rest of SettingsPanel body, I need to ensure I don't overwrite it, wait view_file showed I am replacing SettingsPanel definition if I am not careful)
    // Actually, I should insert SmtpSettingsPanel BEFORE SettingsPanel, and then modify renderPanel inside.

    // I will use replace_file_content in 2 chunks? No, multi_replace.
    // Chunk 1: Insert SmtpSettingsPanel before SettingsPanel.
    // Chunk 2: Add Case to renderPanel.

    // I can't write the logic inside this tool call string easily.
    // I will do it in two separate calls or one multi_replace.
    // I will use multi_replace.

    const [activeInputSetter, setActiveInputSetter] = useState<((token: string) => void) | null>(null);
    const [activeInputId, setActiveInputId] = useState<string | null>(null);

    const availableVariables = useMemo(() => {
        if (!selectedNode) return [];
        return getAvailableVariables(nodes, edges, selectedNode.id);
    }, [selectedNode, nodes, edges]);

    if (!selectedNode) return null;

    const commonProps = {
        selectedNode: selectedNode as any,
        nodes,
        edges,
        onUpdateNode,
        onClose,
        onShowNotification,
        availableVariables,
        canWrite
    };

    const renderPanel = () => {
        switch (selectedNode.type) {
            case NodeType.OnMessage: return <OnMessageSettingsPanel {...commonProps} />;
            case NodeType.MediaMessage: return <MediaMessageSettingsPanel {...commonProps} />;
            case NodeType.SetWebhook: return <SetWebhookSettingsPanel {...commonProps} />;
            case NodeType.WriteAttribute: return <WriteAttributeSettingsPanel {...commonProps} />;
            case NodeType.AskAnything: return <AskAnythingSettingsPanel {...commonProps} />;
            case NodeType.AskInput: return <AskInputSettingsPanel {...commonProps} />;
            case NodeType.ListMessage: return <ListMessageSettingsPanel {...commonProps} />;
            case NodeType.CTAMessage: return <CTAMessageSettingsPanel {...commonProps} />;
            case NodeType.QuickReplyMessage: return <QuickReplySettingsPanel {...commonProps} />;
            case NodeType.CheckCondition: return <CheckConditionSettingsPanel {...commonProps} />;
            case NodeType.Switch: return <SwitchSettingsPanel {...commonProps} />;
            case NodeType.ManageTags: return <ManageTagsSettingsPanel {...commonProps} />;
            case NodeType.ManageGroups: return <ManageGroupsSettingsPanel {...commonProps} />;
            case NodeType.SendFlow: return <SendFlowSettingsPanel {...commonProps} />;
            case NodeType.CallApi: return <CallApiSettingsPanel {...commonProps} />;
            case NodeType.CarouselMessage: return <CarouselSettingsPanel {...commonProps} />;
            case NodeType.TemplateMessage: return <TemplateMessageSettingsPanel {...commonProps} />;
            case NodeType.ContactPipeline: return <ContactPipelineSettingsPanel {...commonProps} />;
            case NodeType.PipelineTrigger: return <PipelineTriggerSettingsPanel {...commonProps} />;
            case NodeType.Timing: return <TimingSettingsPanel {...commonProps} />;
            case NodeType.Webhook: return <WebhookSettingsPanel {...commonProps} />;
            case NodeType.AskLocation: return <AskLocationSettingsPanel {...commonProps} />;
            case NodeType.Gsheet: return <GsheetSettingsPanel {...commonProps} />;
            case NodeType.Gmail: return <GmailSettingsPanel {...commonProps} />;
            case NodeType.Smtp: return <SmtpSettingsPanel {...commonProps} />;
            case NodeType.Calendar: return <CalendarSettingsPanel {...commonProps} />;

            case NodeType.TaskReminder: return <TaskReminderSettingsPanel {...commonProps} />;
            case NodeType.Code: return <CodeSettingsPanel {...commonProps} />;
            case NodeType.SheetTrigger: return <SheetTriggerSettingsPanel {...commonProps} />;
            case NodeType.AIAgent: return <AIAgentSettingsPanel {...commonProps} />;
            case NodeType.Notify: return <NotifySettingsPanel {...commonProps} />;
            default: return <TextMessageSettingsPanel {...commonProps} />;
        }
    };

    return (
        <SettingsContext.Provider value={{ activeInputSetter, setActiveInputSetter, activeInputId, setActiveInputId, showNotification: onShowNotification }}>
            {renderPanel()}
        </SettingsContext.Provider>
    );
};

export default SettingsPanel;
// Force HMR Update for AskInput Node Settings


