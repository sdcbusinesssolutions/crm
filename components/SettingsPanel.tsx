
import React, { ReactNode, useState, useMemo } from 'react';
import { Node, QuickReplyMessageData, QuickReply, ListMessageData, ListSection, ListItem, CTAMessageData, AnyNodeData, NodeType, OnMessageData, MediaMessageData, SetWebhookData, AskAnythingData, CheckConditionData, ConditionGroup, ConditionRule, Edge, WriteAttributeData, TimingData } from '../types';
import { QuickReplyIcon, CloseIcon, EmojiIcon, ListIcon, TrashIcon, CtaIcon, PlusIcon, SettingsIcon, ConditionIcon, WebhookIcon, SetWebhookIcon, MessageIcon, ClockIcon } from './icons';

interface SettingsPanelProps {
    selectedNode: Node | null;
    nodes: Node[];
    edges: Edge[];
    onUpdateNode: (nodeId: string, data: any) => void;
    onClose: () => void;
}

type PanelTheme = 'light' | 'dark';

const textInputClasses: Record<PanelTheme, string> = {
    dark: "bg-slate-950 border-slate-700 text-slate-200 focus:ring-brand-500 focus:border-brand-500 placeholder-slate-600",
    light: "bg-white border-gray-300 text-gray-900 focus:ring-brand-500 focus:border-brand-500"
};
const selectClasses: Record<PanelTheme, string> = {
    dark: "bg-slate-950 border-slate-700 text-slate-200 focus:ring-brand-500 focus:border-brand-500",
    light: "bg-white border-gray-300 text-gray-900 focus:ring-brand-500 focus:border-brand-500"
}

const PanelTextInput: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string, maxLength?: number, className?: string, theme?: PanelTheme }> = ({ value, onChange, placeholder, maxLength, className, theme = 'dark' }) => (
    <div className={`relative ${className}`}>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} className={`w-full p-2.5 border rounded-lg shadow-sm text-sm outline-none transition-colors ${textInputClasses[theme]}`} />
        {maxLength && <span className="text-right text-[10px] mt-1 block text-slate-500">{maxLength - value.length} chars left</span>}
    </div>
);

const PanelNumberInput: React.FC<{ value: number, onChange: (val: number) => void, theme?: PanelTheme }> = ({ value, onChange, theme = 'dark' }) => (
    <input type="number" value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className={`w-full p-2.5 border rounded-lg shadow-sm text-sm outline-none transition-colors ${textInputClasses[theme]}`} />
);

const PanelTextarea: React.FC<{ value: string, onChange: (val: string) => void, placeholder?: string, rows?: number, maxLength?: number, theme?: PanelTheme, className?: string }> = ({ value, onChange, placeholder, rows = 3, maxLength, theme = 'dark', className }) => (
    <div className={`relative ${className || ''}`}>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} maxLength={maxLength} className={`w-full p-2.5 border rounded-lg shadow-sm text-sm outline-none transition-colors resize-none leading-relaxed ${textInputClasses[theme]}`} />
        <button className="absolute top-2 right-2 text-slate-500 hover:text-slate-300" aria-label="Add emoji"><EmojiIcon /></button>
        {maxLength && <div className="text-right text-[10px] mt-1 text-slate-500">{maxLength - value.length} chars left</div>}
    </div>
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

const SettingsModal: React.FC<{ children: ReactNode, title: string, onClose: () => void, icon?: ReactNode, footer?: ReactNode }> = ({ children, title, onClose, icon, footer }) => (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-slate-900 w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col border border-slate-800 animate-slide-up sm:animate-fade-in z-10">
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50 sm:rounded-t-2xl rounded-t-2xl shrink-0">
                <div className="flex items-center space-x-3 text-white">{icon && <span className="text-brand-500">{icon}</span>}<h2 className="text-lg font-bold tracking-tight">{title}</h2></div>
                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"><CloseIcon className="w-5 h-5" /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-900">{children}</div>
            <footer className="px-6 py-4 border-t border-slate-800 bg-slate-900 sm:rounded-b-2xl shrink-0 safe-pb">
                {footer || <button onClick={onClose} className="w-full px-4 py-3 bg-brand-600 text-white rounded-btn hover:bg-brand-700 text-sm font-bold shadow-lg shadow-brand-900/20 transition-all active:scale-95">Save & Close</button>}
            </footer>
        </div>
    </div>
);

const ATTRIBUTES = ['None', 'Name', 'Email', 'Phone Number', 'Gender', 'City', 'Create New Variable'];
const TIMEOUTS = ['1 min', '5 min', '10 min', '15 min', '1 hrs', '24 hrs'];

const ResponseHandlingFields: React.FC<{ data: any; onUpdate: (u: any) => void }> = ({ data, onUpdate }) => {
    const handleAttributeChange = (value: string) => { const update: any = { saveResponseAttribute: value }; if (value !== 'Create New Variable') update.saveResponseNewAttribute = ''; onUpdate(update); };
    return (
        <div className="border-t border-slate-800 pt-4 mt-2">
            <FieldRow label="Validate response" description="Check input against rules."><ToggleSwitch checked={data.validateResponse} onChange={checked => onUpdate({ validateResponse: checked })} /></FieldRow>
            <FieldRow label="Save response"><ToggleSwitch checked={data.saveResponse} onChange={checked => onUpdate({ saveResponse: checked })} /></FieldRow>
            {data.saveResponse && (
                <div className="pl-0 pb-3 space-y-2 bg-slate-800/30 p-3 rounded-lg border border-slate-800 mb-3 animate-fade-in">
                    <label className="text-xs text-slate-400 font-bold uppercase">Attribute</label>
                    <PanelSelect value={data.saveResponseAttribute || 'None'} onChange={handleAttributeChange} options={ATTRIBUTES} />
                    {data.saveResponseAttribute === 'Create New Variable' && <PanelTextInput value={data.saveResponseNewAttribute || ''} onChange={value => onUpdate({ saveResponseNewAttribute: value })} placeholder="Enter new variable name" />}
                </div>
            )}
            <FieldRow label="Unresponsive timeout"><ToggleSwitch checked={data.ifUnresponsive} onChange={checked => onUpdate({ ifUnresponsive: checked })} /></FieldRow>
            {data.ifUnresponsive && (<div className="pl-0 pb-3 bg-slate-800/30 p-3 rounded-lg border border-slate-800 animate-fade-in"><label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Wait Time</label><PanelSelect value={data.unresponsiveTimeout || '10 min'} onChange={value => onUpdate({ unresponsiveTimeout: value })} options={TIMEOUTS} /></div>)}
        </div>
    );
};

const CheckConditionSettingsPanel: React.FC<{ selectedNode: Node & { data: CheckConditionData }; nodes: Node[]; edges: Edge[]; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, nodes, edges, onUpdateNode, onClose }) => {
    const { data } = selectedNode;
    const handleUpdate = (updatedData: Partial<CheckConditionData>) => onUpdateNode(selectedNode.id, { ...data, ...updatedData });

    const addConditionBlock = () => handleUpdate({ conditions: [...data.conditions, { id: `cg-${Date.now()}`, name: `Block-${data.conditions.length + 1}`, rules: [{ id: `cr-${Date.now()}`, attribute: 'Name', operator: 'is', value: '' }] }] });
    const removeConditionBlock = (blockId: string) => handleUpdate({ conditions: data.conditions.filter(c => c.id !== blockId) });
    const addRule = (blockId: string) => handleUpdate({ conditions: data.conditions.map(c => c.id === blockId ? { ...c, rules: [...c.rules, { id: `cr-${Date.now()}`, logicalOperator: 'AND', attribute: 'Name', operator: 'is', value: '' }] } : c) });
    const removeRule = (blockId: string, ruleId: string) => handleUpdate({ conditions: data.conditions.map(c => c.id === blockId ? { ...c, rules: c.rules.filter(r => r.id !== ruleId) } : c) });
    const handleRuleChange = (blockId: string, ruleId: string, field: keyof ConditionRule, value: string) => handleUpdate({ conditions: data.conditions.map(c => c.id === blockId ? { ...c, rules: c.rules.map(r => r.id === ruleId ? { ...r, [field]: value } : r) } : c) });

    return (
        <SettingsModal title="Condition Block" onClose={onClose} icon={<ConditionIcon />}>
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
                                <PanelSelect value={rule.attribute} onChange={val => handleRuleChange(group.id, rule.id, 'attribute', val)} options={ATTRIBUTES.filter(a => a !== 'Create New Variable')} />
                                <PanelSelect value={rule.operator} onChange={val => handleRuleChange(group.id, rule.id, 'operator', val)} options={['is', 'is not', 'contains']} />
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

const AskAnythingSettingsPanel: React.FC<{ selectedNode: Node & { data: AskAnythingData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const data = selectedNode.data;
    const handleUpdate = (updatedFields: Partial<AskAnythingData>) => onUpdateNode(selectedNode.id, { ...data, ...updatedFields });
    return (
        <SettingsModal title="Ask Question" onClose={onClose} icon={<MessageIcon />}>
            <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Question Text</label><PanelTextarea value={data.text} onChange={val => handleUpdate({ text: val })} placeholder="Type your question here..." rows={4} maxLength={1024} /></div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} />
        </SettingsModal>
    );
}

const SetWebhookSettingsPanel: React.FC<{ selectedNode: Node & { data: SetWebhookData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const { data } = selectedNode;
    const handleDataChange = (key: keyof SetWebhookData, value: any) => onUpdateNode(selectedNode.id, { ...data, [key]: value });
    return (
        <SettingsModal title="Set Webhook" onClose={onClose} icon={<SetWebhookIcon />}>
            <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-1"><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Method</label><PanelSelect value={data.method} onChange={val => handleDataChange('method', val)} options={['GET', 'POST']} /></div>
                    <div className="col-span-3"><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">URL</label><PanelTextInput value={data.url} onChange={val => handleDataChange('url', val)} placeholder="https://api.example.com/endpoint" /></div>
                </div>
            </div>
        </SettingsModal>
    );
};

const ListMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: ListMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<ListMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    // Simplified logic for brevity - full implementation mimics previous but with 'brand' styles
    return (
        <SettingsModal title="List Message" onClose={onClose} icon={<ListIcon />}>
            <div className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label><PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} /></div>
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Button Text</label><PanelTextInput value={data.buttonText} onChange={val => handleUpdate({ buttonText: val })} placeholder="e.g., View Menu" /></div>
            </div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} />
        </SettingsModal>
    );
};

const CTAMessageSettingsPanel: React.FC<{ selectedNode: Node & { data: CTAMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<CTAMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    return (
        <SettingsModal title="CTA Message" onClose={onClose} icon={<CtaIcon />}>
            <div className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label><PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} /></div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700"><label className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2 block">Call To Action Button</label><div className="space-y-3"><div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Display Text</label><PanelTextInput value={data.displayText} onChange={val => handleUpdate({ displayText: val })} placeholder="e.g. Visit Website" /></div><div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">URL</label><PanelTextInput value={data.url} onChange={val => handleUpdate({ url: val })} placeholder="https://..." /></div></div></div>
            </div>
        </SettingsModal>
    );
};

const QuickReplySettingsPanel: React.FC<{ selectedNode: Node & { data: QuickReplyMessageData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<QuickReplyMessageData>) => onUpdateNode(selectedNode.id, { ...data, ...update });
    return (
        <SettingsModal title="Quick Reply" onClose={onClose} icon={<QuickReplyIcon />}>
            <div className="space-y-4">
                <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Body</label><PanelTextarea value={data.body} onChange={val => handleUpdate({ body: val })} placeholder="Message body..." rows={3} /></div>
            </div>
            <ResponseHandlingFields data={data} onUpdate={handleUpdate} />
        </SettingsModal>
    );
};

const TimingSettingsPanel: React.FC<{ selectedNode: Node & { data: TimingData }; onUpdateNode: (id: string, data: any) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const { data } = selectedNode;
    const handleUpdate = (update: Partial<TimingData>) => onUpdateNode(selectedNode.id, { ...data, ...update });

    React.useEffect(() => {
        if (data.delayValue === undefined || data.delayUnit === undefined) {
            handleUpdate({
                delayValue: data.delayValue ?? 1,
                delayUnit: data.delayUnit ?? 'Minutes'
            });
        }
    }, [data.delayValue, data.delayUnit]);

    return (
        <SettingsModal title="Delay Settings" onClose={onClose} icon={<ClockIcon />}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-700">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Value</label>
                        <PanelNumberInput value={data.delayValue || 1} onChange={val => handleUpdate({ delayValue: val })} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Unit</label>
                        <PanelSelect
                            value={data.delayUnit || 'Minutes'}
                            onChange={val => handleUpdate({ delayUnit: val as any })}
                            options={['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks']}
                        />
                    </div>
                </div>
                <p className="text-[10px] text-slate-500 italic text-center">
                    The flow execution will pause for the specified duration before moving to the next step.
                </p>
            </div>
        </SettingsModal>
    );
};

const GenericSettingsPanel: React.FC<{ selectedNode: Node; onUpdateNode: (id: string, data: AnyNodeData) => void; onClose: () => void; }> = ({ selectedNode, onUpdateNode, onClose }) => {
    const { data, type } = selectedNode;
    const handleDataChange = (key: string, value: any) => onUpdateNode(selectedNode.id, { ...data, [key]: value });
    return (
        <SettingsModal title={`${data.label} Settings`} onClose={onClose} icon={<SettingsIcon />}>
            {type === NodeType.TextMessage ? <div><label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Message</label><PanelTextarea value={(data as any).message} onChange={val => handleDataChange('message', val)} /></div> : <p className="text-slate-500 text-center py-8 italic">Settings available in specific panels.</p>}
        </SettingsModal>
    );
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ selectedNode, nodes, edges, onUpdateNode, onClose }) => {
    if (!selectedNode) return null;
    switch (selectedNode.type) {
        case 'listMessage': return <ListMessageSettingsPanel selectedNode={selectedNode as Node & { data: ListMessageData }} onUpdateNode={onUpdateNode} onClose={onClose} />;
        case 'ctaMessage': return <CTAMessageSettingsPanel selectedNode={selectedNode as Node & { data: CTAMessageData }} onUpdateNode={onUpdateNode} onClose={onClose} />;
        case 'quickReplyMessage': return <QuickReplySettingsPanel selectedNode={selectedNode as Node & { data: QuickReplyMessageData }} onUpdateNode={onUpdateNode} onClose={onClose} />;
        case 'askAnything': return <AskAnythingSettingsPanel selectedNode={selectedNode as Node & { data: AskAnythingData }} onUpdateNode={onUpdateNode} onClose={onClose} />;
        case 'checkCondition': return <CheckConditionSettingsPanel selectedNode={selectedNode as Node & { data: CheckConditionData }} nodes={nodes} edges={edges} onUpdateNode={onUpdateNode} onClose={onClose} />;
        case 'setWebhook': return <SetWebhookSettingsPanel selectedNode={selectedNode as Node & { data: SetWebhookData }} onUpdateNode={onUpdateNode} onClose={onClose} />;
        case 'timing': return <TimingSettingsPanel selectedNode={selectedNode as Node & { data: TimingData }} onUpdateNode={onUpdateNode} onClose={onClose} />;
        default: return <GenericSettingsPanel selectedNode={selectedNode} onUpdateNode={onUpdateNode} onClose={onClose} />;
    }
};

export default SettingsPanel;
