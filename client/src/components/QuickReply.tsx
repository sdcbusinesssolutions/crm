import React, { useState, useEffect, ReactNode } from 'react';
import { QuickReplyIcon, PlusIcon, SearchIcon, TrashIcon, EditIcon, CloseIcon, MessageIcon, ListIcon, CtaIcon, FlowIcon, ImageFileIcon, GmailIcon, MenuIcon } from './icons';
import { quickReplyService } from '../services/quickReplyService';
import { Flow, NodeType, MediaType } from '../types';
import { supabase } from '../lib/supabase';
import Modal from './Modal';

// --- Local UI Components (Decoupled from SettingsPanel) ---

const BuilderTextInput: React.FC<{ value: string; onChange: (val: string) => void; placeholder?: string; maxLength?: number; className?: string; disabled?: boolean }> = ({ value, onChange, placeholder, maxLength, className, disabled }) => (
    <div className={`relative ${className || ''}`}>
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            className={`w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all ${disabled ? 'opacity-50' : ''}`}
        />
        {maxLength && (
            <div className="absolute right-2 bottom-[-14px] text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                {value.length}/{maxLength}
            </div>
        )}
    </div>
);

const BuilderTextarea: React.FC<{ value: string; onChange: (val: string) => void; placeholder?: string; rows?: number; maxLength?: number; className?: string }> = ({ value, onChange, placeholder, rows = 3, maxLength, className }) => (
    <div className={`relative ${className || ''}`}>
        <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            maxLength={maxLength}
            className="w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all resize-none"
        />
        {maxLength && (
            <div className="absolute right-2 bottom-[-14px] text-[9px] text-slate-500 font-bold uppercase tracking-wider">
                {value.length}/{maxLength}
            </div>
        )}
    </div>
);

const BuilderSelect: React.FC<{ value: string, onChange: (val: string) => void, options: (string | { label: string, value: string })[], className?: string }> = ({ value, onChange, options, className }) => (
    <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className={`w-full p-2.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all cursor-pointer ${className || ''}`}
    >
        {options.map(opt => (typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>))}
    </select>
);

const BuilderSection: React.FC<{ title: string; children: ReactNode; action?: ReactNode }> = ({ title, children, action }) => (
    <div className="space-y-3">
        <div className="flex items-center justify-between">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</label>
            {action}
        </div>
        {children}
    </div>
);

// --- Main Component ---

interface QuickReplyProps {
    onToggleSidebar?: () => void;
}

const QuickReply: React.FC<QuickReplyProps> = ({ onToggleSidebar }) => {
    const [replies, setReplies] = useState<Flow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editingReply, setEditingReply] = useState<Flow | null>(null);
    const [selectedType, setSelectedType] = useState<NodeType | null>(null);
    const [tempData, setTempData] = useState<any>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [nameError, setNameError] = useState<string>('');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [testPhone, setTestPhone] = useState<string>(() => localStorage.getItem('qr_test_phone_v3') || '');
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const [isTestSending, setIsTestSending] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
    const [flows, setFlows] = useState<{ id: string, name: string }[]>([]);
    const [whatsappForms, setWhatsappForms] = useState<{ id: string, name: string }[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(6);

    useEffect(() => {
        loadReplies();
        fetchWhatsappForms();
    }, []);

    const loadReplies = async () => {
        setIsLoading(true);
        const data = await quickReplyService.getQuickReplies();
        setReplies(data);
        setIsLoading(false);
    };

    const fetchWhatsappForms = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/whatsapp/forms', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            const data = await res.json();
            // In some environments the response is { data: [...] } and in others it's { flows: [...] }
            // Based on SendFlowSettingsPanel, it expects json.data
            if (data.data) {
                setWhatsappForms(data.data.filter((f: any) => f.status === 'PUBLISHED' || f.status === 'published'));
            } else if (data.flows) {
                 setWhatsappForms(data.flows.filter((f: any) => f.status === 'PUBLISHED' || f.status === 'published'));
            }
        } catch (error) {
            console.error('Failed to fetch whatsapp forms:', error);
        }
    };

    const handleCreateNewClick = () => {
        setIsTypeModalOpen(true);
    };

    const handleUpdate = (update: any) => setTempData({ ...tempData, ...update });

    const handleTypeSelect = (type: NodeType) => {
        setSelectedType(type);
        let baseData: any = { label: 'New Reply' };
        switch (type) {
            case NodeType.TextMessage: baseData.message = ''; break;
            case NodeType.MediaMessage: Object.assign(baseData, { mediaType: 'Image', url: '', caption: '' }); break;
            case NodeType.ListMessage: Object.assign(baseData, { header: '', body: '', footer: '', buttonText: 'Menu', sections: [{ id: `sec-${Date.now()}`, title: 'Options', items: [{ id: `item-${Date.now()}`, title: 'Item 1', description: '' }] }] }); break;
            case NodeType.QuickReplyMessage: Object.assign(baseData, { headerType: 'None', body: '', footer: '', buttons: [{ id: `btn-${Date.now()}`, title: 'Button 1' }] }); break;
            case NodeType.CTAMessage: Object.assign(baseData, { headerType: 'None', body: '', displayText: '', url: '', footer: '' }); break;
            case NodeType.SendFlow: Object.assign(baseData, { flowId: '', flowName: '', bodyText: 'Click below to start', isForm: false }); break;
        }
        setTempData(baseData);
        setIsTypeModalOpen(false);
        setIsBuilderOpen(true);
        setEditingReply(null);
    };

    const handleEditClick = (reply: Flow) => {
        setEditingReply(reply);
        setTempData(reply.nodes[0].data);
        setSelectedType(reply.nodes[0].type);
        setIsBuilderOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setDeleteTargetId(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteTargetId) return;
        setIsDeleting(true);
        try {
            await quickReplyService.deleteQuickReply(deleteTargetId);
            loadReplies();
        } finally {
            setIsDeleting(false);
            setDeleteTargetId(null);
        }
    };

    const handleTestSend = async () => {
        const phone = testPhone.replace(/\D/g, '');
        
        if (!phone || phone.length < 10) {
            setTestResult({ ok: false, msg: '❌ Please enter a valid 10+ digit phone number.' });
            return;
        }

        setIsTestSending(true);
        setTestResult(null);
        localStorage.setItem('qr_test_phone_v3', testPhone);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            
            // ALWAYS use test-direct to ensure we test the current in-editor state (tempData)
            // Even if the reply is saved, we want to test the LATEST unsaved changes.
            const url = `/api/quick-replies/test-direct`;
            const body = { 
                to: phone, 
                node: { type: selectedType, data: tempData } 
            };

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            // Guard: if server returned HTML (not restarted / route missing), give clear error
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                setTestResult({ ok: false, msg: `❌ Server error (${res.status}): Backend may need a restart to load the new route.` });
                return;
            }

            const json = await res.json();
            if (json.success) {
                setTestResult({ ok: true, msg: `✅ Sent to +${phone}! Check your WhatsApp.` });
                // Auto-clear success after 5s
                setTimeout(() => setTestResult(null), 5000);
            } else {
                setTestResult({ ok: false, msg: `❌ ${json.error || 'Send failed'}` });
            }
        } catch (e: any) {
            setTestResult({ ok: false, msg: `❌ Network error: ${e.message}` });
        } finally {
            setIsTestSending(false);
        }
    };




    const checkDuplicateName = (label: string): string => {
        const trimmed = label.trim().toLowerCase();
        if (!trimmed) return 'Name is required.';
        const isDupe = replies.some(
            r => r.name.trim().toLowerCase() === trimmed && r.id !== editingReply?.id
        );
        return isDupe ? `"${label.trim()}" is already used. Please choose a unique name.` : '';
    };

    const handleLabelChange = (val: string) => {
        handleUpdate({ label: val });
        setNameError(checkDuplicateName(val));
    };

    const handleSave = async () => {
        const name = tempData?.label || '';
        const err = checkDuplicateName(name);
        if (err) {
            setNameError(err);
            return;
        }
        setNameError('');
        setIsSaving(true);
        try {
            const finalData = { ...tempData, triggerName: name };
            if (editingReply) {
                await quickReplyService.updateQuickReply(editingReply.id, name, finalData);
            } else if (selectedType) {
                await quickReplyService.createQuickReply(name, selectedType, finalData);
            }
            setIsBuilderOpen(false);
            setEditingReply(null);
            setSelectedType(null);
            setTempData(null);
            setNameError('');
            loadReplies();
        } catch (error) {
            console.error('Save failed:', error);
            alert('Failed to save Quick Reply.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'outbound');
        setIsUploading(true);
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
                // Map to both headerUrl (for WhatsApp) and url (for internal tracking)
                handleUpdate({ url: data.url, headerUrl: data.url });
            } else {
                alert('Upload failed: ' + (data.error || 'Unknown error') + '\nPlease ensure "campaign-media" bucket exists and is Public.');
            }
        } catch (err: any) {
            alert('Upload error: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const filteredReplies = replies.filter(reply =>
        reply.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (reply.nodes[0]?.data?.body || reply.nodes[0]?.data?.message || reply.nodes[0]?.data?.caption || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // --- Specific Builder Snippets ---

    const renderSpecificBuilder = () => {
        if (!selectedType || !tempData) return null;

        switch (selectedType) {
            case NodeType.TextMessage:
                return (
                    <BuilderSection title="Message Content">
                        <BuilderTextarea value={tempData.message} onChange={val => handleUpdate({ message: val })} placeholder="Type your message..." rows={8} maxLength={4096} />
                    </BuilderSection>
                );

            case NodeType.MediaMessage:
                return (
                    <div className="space-y-6">
                        <BuilderSection title="Media Type">
                            <BuilderSelect value={tempData.mediaType} onChange={val => handleUpdate({ mediaType: val })} options={['Image', 'Video', 'Document', 'Audio']} />
                        </BuilderSection>
                        <BuilderSection title="Media File">
                            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="relative">
                                        <input type="file" id="media-main-upload" onChange={handleFileUpload} className="hidden" />
                                        <label htmlFor="media-main-upload" className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-[11px] font-extrabold rounded-lg cursor-pointer transition-all flex items-center gap-2 shadow-lg shadow-brand-600/10">
                                            <PlusIcon className="w-4 h-4" />
                                            Choose File
                                        </label>
                                    </div>
                                    <div className="text-xs text-slate-500 truncate max-w-[240px] font-medium italic">
                                        {tempData.url ? 'File ready' : 'No file uploaded yet'}
                                    </div>
                                </div>
                                <div className="mt-3">
                                    <BuilderTextInput value={tempData.url} onChange={val => handleUpdate({ url: val })} placeholder="Or paste direct URL here..." />
                                </div>
                                {isUploading && <p className="text-[11px] text-brand-400 animate-pulse mt-3 font-bold uppercase tracking-widest">Uploading to secure storage...</p>}
                            </div>
                        </BuilderSection>
                        <BuilderSection title="Caption (Optional)">
                            <BuilderTextarea value={tempData.caption} onChange={val => handleUpdate({ caption: val })} placeholder="Add a caption..." maxLength={1024} />
                        </BuilderSection>
                    </div>
                );

            case NodeType.QuickReplyMessage:
                return (
                    <div className="space-y-6">
                        <BuilderSection title="Header (Optional)">
                            <BuilderSelect value={tempData.headerType} onChange={val => handleUpdate({ headerType: val as any })} options={['None', 'Text', 'Image', 'Video', 'Document']} />
                            {tempData.headerType === 'Text' && <BuilderTextInput value={tempData.headerText || ''} onChange={val => handleUpdate({ headerText: val })} placeholder="Header text..." className="mt-2" maxLength={60} />}
                            {['Image', 'Video', 'Document'].includes(tempData.headerType) && (
                                <div className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="relative">
                                            <input type="file" onChange={handleFileUpload} id="qr-header-upload" className="hidden" />
                                            <label htmlFor="qr-header-upload" className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-2">
                                                <PlusIcon className="w-3 h-3" />
                                                Choose File
                                            </label>
                                        </div>
                                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                                            {tempData.headerUrl ? 'File selected' : 'No file chosen'}
                                        </div>
                                    </div>
                                    <BuilderTextInput value={tempData.headerUrl || ''} onChange={val => handleUpdate({ headerUrl: val })} placeholder="Or paste Media URL..." />
                                    {isUploading && <p className="text-[10px] text-brand-400 animate-pulse mt-2 font-bold uppercase tracking-wider">Uploading...</p>}
                                </div>
                            )}
                        </BuilderSection>
                        <BuilderSection title="Body Content">
                            <BuilderTextarea value={tempData.body} onChange={val => handleUpdate({ body: val })} placeholder="Body message..." maxLength={1024} />
                        </BuilderSection>
                        <BuilderSection title="Footer (Optional)">
                            <BuilderTextInput value={tempData.footer} onChange={val => handleUpdate({ footer: val })} placeholder="Footer text..." maxLength={60} />
                        </BuilderSection>
                        <BuilderSection 
                            title={`Buttons (${tempData.buttons?.length || 0}/3)`}
                            action={tempData.buttons?.length < 3 && <button onClick={() => handleUpdate({ buttons: [...(tempData.buttons || []), { id: `btn-${Date.now()}`, title: 'New Button' }] })} className="text-[10px] bg-brand-600/10 text-brand-400 px-2 py-1 rounded hover:bg-brand-600/20 transition-colors">+ Add</button>}
                        >
                            <div className="space-y-3">
                                {tempData.buttons?.map((btn: any) => (
                                    <div key={btn.id} className="bg-slate-900/50 p-3 rounded-lg border border-slate-800 flex items-center gap-3">
                                        <div className="flex-1">
                                            <BuilderTextInput value={btn.title} onChange={val => handleUpdate({ buttons: tempData.buttons.map((b: any) => b.id === btn.id ? { ...b, title: val } : b) })} placeholder="Button title" maxLength={20} />
                                        </div>
                                        <button onClick={() => handleUpdate({ buttons: tempData.buttons.filter((b: any) => b.id !== btn.id) })} className="p-2 text-slate-500 hover:text-red-500 bg-slate-950 rounded-lg"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </BuilderSection>
                    </div>
                );

            case NodeType.ListMessage:
                return (
                    <div className="space-y-6">
                        <BuilderSection title="Header & Body">
                            <BuilderTextInput value={tempData.header} onChange={val => handleUpdate({ header: val })} placeholder="Header (optional)" maxLength={60} className="mb-3" />
                            <BuilderTextarea value={tempData.body} onChange={val => handleUpdate({ body: val })} placeholder="Body text (required)" maxLength={1024} />
                            <BuilderTextInput value={tempData.footer} onChange={val => handleUpdate({ footer: val })} placeholder="Footer (optional)" maxLength={60} className="mt-3" />
                        </BuilderSection>
                        <BuilderSection title="Menu Button Label">
                            <BuilderTextInput value={tempData.buttonText} onChange={val => handleUpdate({ buttonText: val })} placeholder="e.g. Choose Option" maxLength={20} />
                        </BuilderSection>
                        <BuilderSection 
                             title="Sections and Items"
                             action={tempData.sections?.length < 10 && <button onClick={() => handleUpdate({ sections: [...(tempData.sections || []), { id: `sec-${Date.now()}`, title: 'New Section', items: [{ id: `item-${Date.now()}`, title: 'New Item', description: '' }] }] })} className="text-[10px] bg-brand-600/10 text-brand-400 px-2 py-1 rounded hover:bg-brand-600/20 transition-colors">+ Add Section</button>}
                        >
                            <div className="space-y-4">
                                {tempData.sections?.map((sec: any) => (
                                    <div key={sec.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <BuilderTextInput value={sec.title} onChange={val => handleUpdate({ sections: tempData.sections.map((s: any) => s.id === sec.id ? { ...s, title: val } : s) })} placeholder="Section title" className="flex-1" />
                                            <button onClick={() => handleUpdate({ sections: tempData.sections.filter((s: any) => s.id !== sec.id) })} className="p-2 text-slate-500 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button>
                                        </div>
                                        <div className="pl-6 space-y-2">
                                            {sec.items?.map((item: any) => (
                                                <div key={item.id} className="bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                                                    <div className="flex-1 space-y-1">
                                                        <BuilderTextInput value={item.title} onChange={val => handleUpdate({ sections: tempData.sections.map((s: any) => s.id === sec.id ? { ...s, items: s.items.map((i: any) => i.id === item.id ? { ...i, title: val } : i) } : s) })} placeholder="Item title" maxLength={24} />
                                                        <BuilderTextInput value={item.description} onChange={val => handleUpdate({ sections: tempData.sections.map((s: any) => s.id === sec.id ? { ...s, items: s.items.map((i: any) => i.id === item.id ? { ...i, description: val } : i) } : s) })} placeholder="Description (optional)" maxLength={72} className="opacity-80" />
                                                    </div>
                                                    <button onClick={() => handleUpdate({ sections: tempData.sections.map((s: any) => s.id === sec.id ? { ...s, items: s.items.filter((i: any) => i.id !== item.id) } : s) })} className="p-1 text-slate-600 hover:text-red-500"><CloseIcon className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                            {sec.items?.length < 10 && (
                                                <button onClick={() => handleUpdate({ sections: tempData.sections.map((s: any) => s.id === sec.id ? { ...s, items: [...s.items, { id: `it-${Date.now()}`, title: 'New Item', description: '' }] } : s) })} className="text-[9px] text-brand-400 font-bold uppercase">+ Add Item</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </BuilderSection>
                    </div>
                );

            case NodeType.CTAMessage:
                return (
                    <div className="space-y-6">
                        <BuilderSection title="Content Layout">
                            <BuilderSelect value={tempData.headerType} onChange={val => handleUpdate({ headerType: val as any })} options={['None', 'Text', 'Image', 'Video', 'Document']} className="mb-3" />
                            {tempData.headerType === 'Text' && <BuilderTextInput value={tempData.headerText || ''} onChange={val => handleUpdate({ headerText: val })} placeholder="Header text..." className="mb-3" maxLength={60} />}
                            {['Image', 'Video', 'Document'].includes(tempData.headerType) && (
                                <div className="mb-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="relative">
                                            <input type="file" onChange={handleFileUpload} id="cta-header-upload" className="hidden" />
                                            <label htmlFor="cta-header-upload" className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-2">
                                                <PlusIcon className="w-3 h-3" />
                                                Choose File
                                            </label>
                                        </div>
                                        <div className="text-[10px] text-slate-500 truncate max-w-[200px]">
                                            {tempData.headerUrl ? 'File selected' : 'No file chosen'}
                                        </div>
                                    </div>
                                    <BuilderTextInput value={tempData.headerUrl || ''} onChange={val => handleUpdate({ headerUrl: val })} placeholder="Or paste Media URL..." />
                                    {isUploading && <p className="text-[10px] text-brand-400 animate-pulse mt-2 font-bold uppercase tracking-wider">Uploading...</p>}
                                </div>
                            )}
                            <BuilderTextarea value={tempData.body} onChange={val => handleUpdate({ body: val })} placeholder="Body content message..." maxLength={1024} />
                        </BuilderSection>
                        <BuilderSection title="Call to Action Button">
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="text-[9px] text-slate-500 font-bold uppercase mb-1 block">Display Text</label><BuilderTextInput value={tempData.displayText} onChange={val => handleUpdate({ displayText: val })} placeholder="e.g. Visit Website" maxLength={20} /></div>
                                <div><label className="text-[9px] text-slate-500 font-bold uppercase mb-1 block">URL / Payload</label><BuilderTextInput value={tempData.url} onChange={val => handleUpdate({ url: val })} placeholder="https://..." /></div>
                            </div>
                        </BuilderSection>
                        <BuilderSection title="Footer">
                            <BuilderTextInput value={tempData.footer} onChange={val => handleUpdate({ footer: val })} placeholder="Footer (optional)" maxLength={60} />
                        </BuilderSection>
                    </div>
                );

            case NodeType.SendFlow:
                return (
                    <div className="space-y-6">
                        <BuilderSection title="Select WhatsApp Form">
                            <BuilderSelect 
                                value={tempData.flowId} 
                                onChange={val => {
                                    const item = whatsappForms.find(i => i.id === val);
                                    handleUpdate({ flowId: val, flowName: item?.name || '' });
                                }} 
                                options={[{ label: 'Select Form...', value: '' }, ...whatsappForms.map(f => ({ label: f.name, value: f.id }))]} 
                            />
                            {whatsappForms.length === 0 && (
                                <p className="text-[10px] text-amber-500 mt-2 italic">No published WhatsApp Forms found. Make sure yours are published in the Meta Flows dashboard.</p>
                            )}
                        </BuilderSection>
                        <BuilderSection title="Body Content">
                            <BuilderTextarea value={tempData.bodyText} onChange={val => handleUpdate({ bodyText: val })} placeholder="e.g. Please fill out the details below" maxLength={1024} />
                        </BuilderSection>
                        <BuilderSection title="Button Text">
                            <BuilderTextInput value={tempData.ctaText || 'Open Form'} onChange={val => handleUpdate({ ctaText: val })} placeholder="e.g. Open Form" maxLength={20} />
                        </BuilderSection>
                    </div>
                );

            default:
                return <p className="text-slate-500 text-sm italic">Config settings for {selectedType} are coming soon.</p>;
        }
    };

    const builderSidebarContent = filteredReplies.filter(r => r.id !== editingReply?.id);

    // --- Main Rendering ---

    if (isBuilderOpen && selectedType) {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-md">
                <div className="relative bg-slate-900 w-full h-full sm:h-[85vh] sm:max-w-4xl sm:rounded-2xl shadow-2xl flex flex-col border border-slate-800 animate-slide-up sm:animate-fade-in overflow-hidden">
                    {/* Builder Header */}
                    <header className="px-6 py-5 border-b border-slate-800 bg-slate-900/80 backdrop-blur shrink-0 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-brand-600/10 text-brand-500 rounded-xl flex items-center justify-center border border-brand-500/20 shadow-inner">
                                {selectedType === NodeType.TextMessage && <MessageIcon className="w-5 h-5" />}
                                {selectedType === NodeType.MediaMessage && <ImageFileIcon className="w-5 h-5" />}
                                {selectedType === NodeType.ListMessage && <ListIcon className="w-5 h-5" />}
                                {selectedType === NodeType.QuickReplyMessage && <QuickReplyIcon className="w-5 h-5" />}
                                {selectedType === NodeType.CTAMessage && <CtaIcon className="w-5 h-5" />}
                                {selectedType === NodeType.SendFlow && <FlowIcon className="w-5 h-5" />}
                            </div>
                            <div>
                                <input 
                                    value={tempData.label} 
                                    onChange={e => handleLabelChange(e.target.value)} 
                                    className={`bg-transparent border-none focus:ring-0 font-bold text-lg p-0 w-64 placeholder-slate-700 ${
                                        nameError ? 'text-red-400' : 'text-white'
                                    }`}
                                    placeholder="Untitled Response"
                                />
                                {nameError ? (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <svg className="w-3 h-3 text-red-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M18 10c0 4.418-3.582 8-8 8S2 14.418 2 10 5.582 2 10 2s8 3.582 8 8zm-8-3a1 1 0 00-1 1v2a1 1 0 002 0V8a1 1 0 00-1-1zm0 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                        </svg>
                                        <span className="text-[10px] text-red-400 font-semibold leading-tight">{nameError}</span>
                                    </div>
                                ) : (
                                    <div className="text-[10px] font-bold text-brand-400 uppercase tracking-widest mt-0.5">
                                        {selectedType.replace('Message', '')} Builder
                                    </div>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setIsBuilderOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors bg-slate-800/50 rounded-lg">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </header>

                    {/* Builder Content */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-8">
                        <div className="max-w-2xl mx-auto">
                            {renderSpecificBuilder()}
                        </div>
                    </div>

                    {/* Builder Footer */}
                    <footer className="px-8 py-5 border-t border-slate-800 bg-slate-900/80 backdrop-blur shrink-0 flex items-center justify-between gap-3">
                        {/* Test Send — left side, always available in builder */}
                        <div className="flex flex-col gap-1">
                            <button
                                onClick={() => { setTestResult(null); setIsTestModalOpen(true); }}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-amber-400 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all group"
                            >
                                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Test on WhatsApp
                            </button>
                            {!editingReply?.id && (
                                <span className="text-[9px] text-slate-500 font-bold uppercase ml-1 animate-pulse tracking-tight">Test your design live</span>
                            )}
                        </div>

                        {/* Right side: Cancel + Save */}
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setIsBuilderOpen(false)} 
                                className="px-6 py-2.5 text-slate-400 hover:text-white font-bold text-sm transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving || !!nameError}
                                className={`relative px-8 py-2.5 rounded-xl font-bold text-sm text-white overflow-hidden
                                    transition-all duration-200 ease-out
                                    ${
                                        isSaving
                                            ? 'bg-brand-700 cursor-not-allowed opacity-80 scale-[0.98]'
                                            : nameError
                                            ? 'bg-slate-700 cursor-not-allowed opacity-50'
                                            : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 hover:-translate-y-[1px] active:translate-y-0 active:scale-95 shadow-lg shadow-brand-600/30 hover:shadow-xl hover:shadow-brand-500/40'
                                    }`
                                }
                            >
                                {/* Shimmer overlay */}
                                {!isSaving && (
                                    <span className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-xl" />
                                )}
                                <span className="relative flex items-center gap-2">
                                    {isSaving ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                            </svg>
                                            Saving…
                                        </>
                                    ) : (
                                        'Save & Close'
                                    )}
                                </span>
                            </button>
                        </div>
                    </footer>

                </div>

                {/* ── Test Send Modal (inside builder context) ── */}
                {isTestModalOpen && (
                    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !isTestSending && setIsTestModalOpen(false)}>
                        <div
                            className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Icon */}
                            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 mx-auto mb-5">
                                <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            </div>

                            <h3 className="text-center text-white font-bold text-lg mb-1">Test on WhatsApp</h3>
                            <p className="text-center text-slate-400 text-sm mb-5 leading-relaxed">
                                Enter the phone number to receive the <span className="text-amber-400 font-semibold">live WhatsApp message</span>.
                            </p>

                            {/* Phone Input */}
                            <div className="mb-4">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Number (No + sign)</label>
                                <input
                                    type="tel"
                                    value={testPhone}
                                    onChange={e => { 
                                        const val = e.target.value;
                                        setTestPhone(val); 
                                        if (val !== '919373393645') {
                                            localStorage.setItem('qr_test_phone_v3', val);
                                        }
                                        setTestResult(null); 
                                    }}
                                    placeholder="Country Code + Phone (e.g. 910000000000)"
                                    disabled={isTestSending}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all disabled:opacity-60"
                                />
                            </div>

                            {/* Result feedback */}
                            {testResult && (
                                <div className={`mb-4 p-3 rounded-xl text-sm font-semibold text-center ${testResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                    {testResult.msg}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setIsTestModalOpen(false)}
                                    disabled={isTestSending}
                                    className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-50"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleTestSend}
                                    disabled={isTestSending}
                                    className={`relative flex-1 py-3 rounded-xl font-bold text-sm text-white overflow-hidden transition-all duration-300 active:scale-95 
                                        ${isTestSending 
                                            ? 'bg-amber-700/50 cursor-wait' 
                                            : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-600/30 hover:shadow-amber-500/40 hover:-translate-y-[1px]'
                                        }`}
                                >
                                    {/* Shimmer animation */}
                                    {!isTestSending && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />}
                                    
                                    <span className="relative flex items-center justify-center gap-2">
                                        {isTestSending ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                <span>Sending...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                                </svg>
                                                Send Test
                                            </>
                                        )}
                                    </span>
                                </button>

                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden relative">
            {/* Background Pattern Overlay */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-[0.06] z-0" 
                style={{ 
                    backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                    backgroundSize: '400px',
                    backgroundRepeat: 'repeat'
                }} 
            />
            
            <div className="flex-1 flex flex-col h-full relative z-10 overflow-hidden">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 px-8 py-4 shrink-0 transition-all">
                    <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <button onClick={onToggleSidebar} className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors mr-1">
                                    <MenuIcon className="w-5 h-5" />
                                </button>
                                <div className="w-10 h-10 bg-[#00684a]/10 text-[#00684a] rounded-xl flex items-center justify-center border border-[#00684a]/20 shadow-sm">
                                    <QuickReplyIcon className="w-6 h-6" />
                                </div>
                                <h1 className="text-2xl font-extrabold text-[#00684a] tracking-tight">Quick Replies</h1>
                            </div>
                            <p className="text-slate-500 text-sm mt-1 font-medium hidden sm:block">Manage separate interactive messages for fast responses.</p>
                        </div>

                        <button 
                            onClick={handleCreateNewClick}
                            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#00684a] hover:bg-[#005c42] text-white rounded-xl font-bold shadow-lg shadow-[#00684a]/20 transition-all active:scale-[0.98] text-sm"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span>New Quick Reply</span>
                        </button>
                    </div>
                </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar">
                <div className="max-w-[1600px] mx-auto space-y-8">
                    
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-300 border-l-[6px] border-l-slate-800 shadow-md hover:shadow-lg transition-all">
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Replies</div>
                            <div className="text-4xl font-black text-slate-900">{replies.length}</div>
                            <div className="text-xs text-slate-400 mt-2 font-bold uppercase">All Platform Templates</div>
                        </div>
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 border-l-[6px] border-l-[#0D9668] shadow-md hover:shadow-lg transition-all">
                            <div className="text-[10px] font-black text-[#0D9668] uppercase tracking-widest mb-1">Status: Active</div>
                            <div className="text-4xl font-black text-[#0D9668]">{replies.length}</div>
                            <div className="text-xs text-[#0D9668] mt-2 font-bold uppercase tracking-tight">System Ready for automation</div>
                        </div>
                        <div className="bg-violet-50 p-6 rounded-2xl border border-violet-200 border-l-[6px] border-l-violet-600 shadow-md hover:shadow-lg transition-all">
                            <div className="text-[10px] font-black text-violet-600 uppercase tracking-widest mb-1">Interactive Type</div>
                            <div className="text-4xl font-black text-violet-700">{filteredReplies.filter(r => r.nodes[0]?.type !== NodeType.TextMessage).length}</div>
                            <div className="text-xs text-violet-600 mt-2 font-bold uppercase tracking-tight">Buttons / Lists / Flows</div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="relative w-full md:max-w-md group">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-600" />
                            <input
                                type="text"
                                placeholder="Search replies by name or trigger..."
                        value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white border border-brand-200 rounded-2xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-600 transition-all outline-none shadow-sm font-medium placeholder-slate-400"
                            />
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-2xl shadow-lg border-x border-b border-[#0D9668]/30 overflow-hidden">
                        {isLoading ? (
                            <div className="flex flex-col justify-center items-center py-24 text-slate-400 font-bold italic">
                                <div className="w-8 h-8 border-4 border-[#0D9668]/20 border-t-[#0D9668] rounded-full animate-spin mb-4"></div>
                                Fetching replies...
                            </div>
                        ) : (() => {
                            const filteredReplies = replies.filter(r => 
                                r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                r.nodes[0]?.data?.triggerName?.toLowerCase().includes(searchQuery.toLowerCase())
                            );
                            
                            const totalPages = Math.ceil(filteredReplies.length / itemsPerPage);
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const currentReplies = filteredReplies.slice(startIndex, startIndex + itemsPerPage);

                            if (filteredReplies.length === 0) {
                                return (
                                    <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 m-4">
                                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4 shadow-sm"><QuickReplyIcon className="w-8 h-8" /></div>
                                        <p className="text-slate-500 font-medium mb-4">No Quick Replies found</p>
                                        <button onClick={handleCreateNewClick} className="text-[#0D9668] font-bold hover:underline text-sm">+ Create New Reply</button>
                                    </div>
                                );
                            }

                            return (
                                <>
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="min-w-full divide-y divide-slate-100">
                                            <thead className="bg-[#0D9668] text-white shadow-md">
                                                <tr>
                                                    <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-[#0D9668] whitespace-nowrap">Name</th>
                                                    <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-[#0D9668] whitespace-nowrap">Trigger</th>
                                                    <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-[#0D9668] whitespace-nowrap">Status</th>
                                                    <th className="px-6 py-5 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-[#0D9668] whitespace-nowrap">Last Updated</th>
                                                    <th className="px-6 py-5 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-[#0D9668] whitespace-nowrap">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {currentReplies.map((reply) => {
                                                    const type = reply.nodes[0]?.type || NodeType.TextMessage;
                                                    const trigger = reply.nodes[0]?.data?.triggerName || reply.name;
                                                    
                                                    return (
                                                        <tr key={reply.id} className="hover:bg-slate-50 transition-colors group cursor-default">
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <div className="flex items-center">
                                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#0D9668] flex items-center justify-center mr-3 border border-emerald-100 transition-all group-hover:scale-110 group-hover:shadow-sm group-hover:bg-[#0D9668]/10">
                                                                        {type === NodeType.QuickReplyMessage && <QuickReplyIcon className="w-5 h-5" />}
                                                                        {type === NodeType.MediaMessage && <ImageFileIcon className="w-5 h-5" />}
                                                                        {type === NodeType.ListMessage && <ListIcon className="w-5 h-5" />}
                                                                        {type === NodeType.CTAMessage && <CtaIcon className="w-5 h-5" />}
                                                                        {type === NodeType.SendFlow && <FlowIcon className="w-5 h-5" />}
                                                                        {type === NodeType.TextMessage && <MessageIcon className="w-5 h-5" />}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span className="text-sm font-bold text-slate-800">{reply.name}</span>
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{type.replace('Message', '')}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[11px] font-bold border border-slate-200 font-mono">
                                                                    {trigger || 'None'}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap">
                                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border bg-emerald-100 text-[#0D9668] border-emerald-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-[#0D9668] animate-pulse"></span>
                                                                    Active
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-medium">
                                                                {new Date(reply.updatedAt).toLocaleDateString()}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                <div className="flex items-center justify-end gap-1">
                                                                    <button onClick={() => handleEditClick(reply)} className="p-2 text-slate-400 hover:text-[#0D9668] hover:bg-[#0D9668]/5 rounded-lg transition-all" title="Edit Template"><EditIcon className="w-4 h-4" /></button>
                                                                    <button onClick={() => handleDeleteClick(reply.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete Template"><TrashIcon className="w-4 h-4" /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile cards view integrated into pagination logic */}
                                    <div className="md:hidden divide-y divide-slate-100">
                                        {currentReplies.map((reply) => (
                                            <div key={reply.id} className="p-4 bg-white active:bg-slate-50 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center border border-slate-200 font-bold text-xs uppercase">
                                                            {reply.nodes[0]?.type?.[0] || 'T'}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-bold text-slate-900 text-sm leading-tight">{reply.name}</h4>
                                                            <div className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded uppercase mt-1 inline-block">
                                                                {reply.nodes[0]?.data?.triggerName || 'None'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="w-2 h-2 rounded-full bg-[#0D9668]"></span>
                                                </div>
                                                <div className="flex justify-end gap-3 mt-3">
                                                    <button onClick={() => handleEditClick(reply)} className="text-xs font-bold text-[#0D9668] uppercase">Edit</button>
                                                    <button onClick={() => handleDeleteClick(reply.id)} className="text-xs font-bold text-red-500 uppercase">Delete</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pagination Controls */}
                                    {totalPages > 1 && (
                                        <div className="px-6 py-5 flex items-center justify-between bg-slate-50/80 border-t-2 border-slate-100 backdrop-blur-sm">
                                            <div className="flex-1 flex justify-between sm:hidden">
                                                <button
                                                    onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    disabled={currentPage === 1}
                                                    className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-black rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 shadow-sm"
                                                >
                                                    Previous
                                                </button>
                                                <button
                                                    onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                    disabled={currentPage === totalPages}
                                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-black rounded-xl text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 shadow-sm"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm text-slate-600 font-medium">
                                                        Showing <span className="font-black text-[#0D9668]">{startIndex + 1}</span> to <span className="font-black text-[#0D9668]">{Math.min(startIndex + itemsPerPage, filteredReplies.length)}</span> of <span className="font-bold text-slate-800">{filteredReplies.length}</span> results
                                                    </p>
                                                </div>
                                                <div>
                                                    <nav className="relative z-0 inline-flex rounded-xl shadow-md -space-x-px bg-white border border-slate-200 overflow-hidden" aria-label="Pagination">
                                                        <button
                                                            onClick={() => { setCurrentPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                            disabled={currentPage === 1}
                                                            className="relative inline-flex items-center px-3 py-2 border-r border-slate-200 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                                        >
                                                            <span className="sr-only">Previous</span>
                                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                        {[...Array(totalPages)].map((_, i) => (
                                                            <button
                                                                key={i + 1}
                                                                onClick={() => { setCurrentPage(i + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                                className={`relative inline-flex items-center px-4 py-2 border-r border-slate-200 text-sm font-extrabold transition-all ${currentPage === i + 1 ? 'z-10 bg-[#0D9668] text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                                                            >
                                                                {i + 1}
                                                            </button>
                                                        ))}
                                                        <button
                                                            onClick={() => { setCurrentPage(prev => Math.min(prev + 1, totalPages)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                                                            disabled={currentPage === totalPages}
                                                            className="relative inline-flex items-center px-3 py-2 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                                                        >
                                                            <span className="sr-only">Next</span>
                                                            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    </nav>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Type Selector Modal */}
            <Modal isOpen={isTypeModalOpen} onClose={() => setIsTypeModalOpen(false)} title="Choose Message Type" size="2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-2">
                    {[
                        { type: NodeType.QuickReplyMessage, label: 'Quick Reply', icon: <QuickReplyIcon />, description: 'Buttons (max 3) for quick actions' },
                        { type: NodeType.ListMessage, label: 'List Message', icon: <ListIcon />, description: 'Menu with up to 10 options' },
                        { type: NodeType.CTAMessage, label: 'CTA Message', icon: <CtaIcon />, description: 'Web site or call button' },
                        { type: NodeType.MediaMessage, label: 'Media', icon: <ImageFileIcon />, description: 'Images, videos or documents' },
                        { type: NodeType.TextMessage, label: 'Plain Text', icon: <MessageIcon />, description: 'Simple text-only message' },
                        { type: NodeType.SendFlow, label: 'Send Flow', icon: <FlowIcon />, description: 'Chain another interaction flow' }
                    ].map((item) => (
                        <button key={item.type} onClick={() => handleTypeSelect(item.type as any)} className="flex items-start gap-4 p-5 rounded-2xl border border-slate-100 bg-white hover:bg-[#F1FDF9] hover:border-[#0D9668] hover:shadow-xl hover:shadow-[#0D9668]/5 transition-all text-left group">
                            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-[#0D9668] shadow-sm shrink-0 border border-emerald-100 group-hover:bg-[#0D9668] group-hover:text-white transition-all">
                                {React.cloneElement(item.icon as any, { className: 'w-6 h-6' })}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 mb-1 group-hover:text-[#0D9668]">{item.label}</h4>
                                <p className="text-[11px] text-slate-500 leading-tight">{item.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
            </Modal>

            {/* ── Test Send Modal ── */}
            {isTestModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !isTestSending && setIsTestModalOpen(false)}>
                    <div
                        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 mx-auto mb-5">
                            <svg className="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>

                        <h3 className="text-center text-white font-bold text-lg mb-1">Test on WhatsApp</h3>
                        <p className="text-center text-slate-400 text-sm mb-5 leading-relaxed">
                            Enter the phone number to receive the <span className="text-amber-400 font-semibold">live WhatsApp message</span>.
                        </p>

                        <div className="mb-4">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">WhatsApp Number (No + sign)</label>
                            <input
                                type="tel"
                                value={testPhone}
                                onChange={e => { 
                                    const val = e.target.value;
                                    setTestPhone(val); 
                                    localStorage.setItem('qr_test_phone_v3', val);
                                    setTestResult(null); 
                                }}
                                placeholder="Country Code + Phone (e.g. 910000000000)"
                                disabled={isTestSending}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 transition-all disabled:opacity-60"
                            />
                        </div>

                        {/* Result feedback */}
                        {testResult && (
                            <div className={`mb-4 p-3 rounded-xl text-sm font-semibold text-center ${testResult.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                {testResult.msg}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsTestModalOpen(false)}
                                disabled={isTestSending}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-50"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleTestSend}
                                disabled={isTestSending}
                                className={`relative flex-1 py-3 rounded-xl font-bold text-sm text-white overflow-hidden transition-all duration-300 active:scale-95 
                                    ${isTestSending 
                                        ? 'bg-amber-700/50 cursor-wait' 
                                        : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-lg shadow-amber-600/30 hover:shadow-amber-500/40 hover:-translate-y-[1px]'
                                    }`}
                            >
                                {/* Shimmer animation only while not sending or briefly on click? Let's add it for a premium feel */}
                                {!isTestSending && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer" />}
                                
                                <span className="relative flex items-center justify-center gap-2">
                                    {isTestSending ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                            Send Test
                                        </>
                                    )}
                                </span>
                            </button>

                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}

            {deleteTargetId && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => !isDeleting && setDeleteTargetId(null)}>
                    <div
                        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Icon */}
                        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-5">
                            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>

                        {/* Text */}
                        <h3 className="text-center text-white font-bold text-lg mb-1">Delete Quick Reply?</h3>
                        <p className="text-center text-slate-400 text-sm mb-6 leading-relaxed">
                            This action is <span className="text-red-400 font-semibold">permanent</span> and cannot be undone.
                            The reply will be removed immediately.
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setDeleteTargetId(null)}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 shadow-lg shadow-red-600/30 hover:shadow-red-500/40 hover:-translate-y-[1px] active:scale-95 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                        </svg>
                                        Deleting…
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Yes, Delete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default QuickReply;
