import React, { useState, useEffect } from 'react';
import {
    getForms,
    createForm,
    updateForm,
    deleteForm,
    getPipelines,
    getPipelineStages,
    getFormPublicUrl
} from '../services/lead-management-api';
import { FormDefinition, Pipeline, PipelineStage, FormField, ContactGroup } from '../types/lead-management';
import { supabase } from '../lib/supabase';
import { themeService } from '../services/themeService';
import Modal from './Modal';
import DatabaseSetup from './DatabaseSetup';
import PhoneInputWithCountry from './PhoneInputWithCountry';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

const FormBuilder: React.FC = () => {
    const { hasAccess } = usePermissions();
    const canRead = hasAccess('Form Builder', ACCESS_TYPES.READ);
    const canWrite = hasAccess('Form Builder', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('Form Builder', ACCESS_TYPES.ALL_ACCESS);

    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentForm, setCurrentForm] = useState<Partial<FormDefinition>>({});
    const [pipelines, setPipelines] = useState<Pipeline[]>([]);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [theme, setTheme] = useState(themeService.getTheme());
    const [showDbSetup, setShowDbSetup] = useState(false);
    const [activeTab, setActiveTab] = useState('content');

    // Modal State
    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        isError: false
    });

    const [embedConfig, setEmbedConfig] = useState({
        isOpen: false,
        token: '',
        name: ''
    });

    // Load initial data
    useEffect(() => {
        if (canRead) {
            loadForms();
            loadPipelines();
            loadGroups();
        }
    }, [canRead]);

    // Load stages when pipeline changes
    useEffect(() => {
        if (currentForm.pipeline_id) {
            loadStages(currentForm.pipeline_id);
        } else {
            setStages([]);
        }
    }, [currentForm.pipeline_id]);

    const loadForms = async () => {
        try {
            const data = await getForms();
            setForms(data);
        } catch (error: any) {
            console.error('Failed to load forms', error);
            // Check for 500 error which usually indicates RLS recursion
            if (error.code === 500 || error.status === 500 || error.message?.includes('recursion')) {
                setShowDbSetup(true);
            }
        }
    };

    const loadPipelines = async () => {
        try {
            const data = await getPipelines();
            setPipelines(data);
        } catch (error) {
            console.error('Failed to load pipelines', error);
        }
    };

    const loadGroups = async () => {
        try {
            const { data, error } = await supabase.from('contact_groups').select('*');
            if (error) throw error;
            setGroups(data || []);
        } catch (error) {
            console.error('Failed to load groups', error);
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

    const handleCreateNew = () => {
        if (!canWrite) return;
        setCurrentForm({
            name: '',
            fields: [
                { type: 'text', label: 'NAME', name: 'name', required: true, placeholder: 'Enter your name' },
                { type: 'email', label: 'EMAIL', name: 'email', required: true, placeholder: 'Enter your email' },
                { type: 'phone', label: 'PHONE', name: 'phone', required: false, placeholder: 'Enter your phone' }
            ],
            styling: {
                primaryColor: '#0f172a',
                buttonText: 'Enquire Now',
                backgroundColor: '#ffffff',
                buttonTextColor: '#ffffff'
            },
            settings: {
                declaration: {
                    enabled: false,
                    title: '',
                    link: ''
                }
            }
        });
        setIsEditing(true);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) return;
        if (!confirm('Are you sure you want to delete this form?')) return;
        try {
            await deleteForm(id);
            loadForms();
        } catch (error) {
            console.error('Failed to delete form', error);
            setModalConfig({
                isOpen: true,
                title: 'Error',
                message: 'Failed to delete form',
                isError: true
            });
        }
    };

    const [copiedId, setCopiedId] = useState<string | null>(null);

    const copyLink = async (token: string, id: string) => {
        const url = `${window.location.origin}/forms/${token}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy link', err);
            setModalConfig({
                isOpen: true,
                title: 'Error',
                message: 'Failed to copy link to clipboard.',
                isError: true
            });
        }
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        const newFields = [...(currentForm.fields || [])];
        newFields[index] = { ...newFields[index], ...updates };
        setCurrentForm({ ...currentForm, fields: newFields });
    };

    const addField = (type: string) => {
        let name = `field_${Date.now()}`;
        if (type === 'email') name = 'email';
        if (type === 'phone') name = 'phone';

        const newField: FormField = {
            type: type as any,
            label: `New ${type} field`,
            name: name,
            required: false,
            placeholder: ''
        };
        setCurrentForm({
            ...currentForm,
            fields: [...(currentForm.fields || []), newField]
        });
    };

    const removeField = (index: number) => {
        const newFields = [...(currentForm.fields || [])];
        newFields.splice(index, 1);
        setCurrentForm({ ...currentForm, fields: newFields });
    };

    const handleSave = async () => {
        if (!canWrite) return;
        setLoading(true);
        try {
            // Normalize field names for standard fields
            const normalizedFields = (currentForm.fields || []).map(field => {
                const label = field.label.toLowerCase().trim();
                // Only override name if it's a standard field label and not already set correctly
                if ((label === 'name' || label === 'full name') && field.name !== 'name') return { ...field, name: 'name' };
                if ((label === 'email' || label === 'email address') && field.name !== 'email') return { ...field, name: 'email' };
                if ((label === 'phone' || label === 'phone number') && field.name !== 'phone') return { ...field, name: 'phone' };
                if ((label === 'company' || label === 'company name') && field.name !== 'company') return { ...field, name: 'company' };
                return field;
            });

            const formData = {
                ...currentForm,
                fields: normalizedFields,
                styling: currentForm.styling || {},
                settings: currentForm.settings || {}
            };

            if (currentForm.id) {
                await updateForm(currentForm.id, formData);
            } else {
                await createForm(formData as any);
            }
            setIsEditing(false);
            loadForms();
            setModalConfig({
                isOpen: true,
                title: 'Success',
                message: 'Form saved successfully!',
                isError: false
            });
        } catch (error: any) {
            console.error('Failed to save form', error);
            const isRlsError = error.code === 500 || error.status === 500 || error.message?.includes('infinite recursion') || error.message?.includes('policy');

            if (isRlsError) {
                setShowDbSetup(true);
            } else {
                setModalConfig({
                    isOpen: true,
                    title: 'Error',
                    message: error.message || 'Failed to save form. Please try again.',
                    isError: true
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Render Helpers ---

    const renderPreview = () => {
        const style = currentForm.styling || {};
        const isTransparent = style.backgroundColor === 'transparent';
        const isMobile = previewMode === 'mobile';

        return (
            <div className="bg-[var(--color-surface)]/50 border border-slate-200/50 p-4 lg:p-8 rounded-xl h-full overflow-hidden flex flex-col backdrop-blur-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-700">Preview</h3>
                    <div className="bg-white rounded-lg border border-slate-200 p-1 flex gap-1">
                        <button
                            onClick={() => setPreviewMode('desktop')}
                            className={`p-2 rounded ${!isMobile ? 'bg-[var(--color-brand)] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Desktop View"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </button>
                        <button
                            onClick={() => setPreviewMode('mobile')}
                            className={`p-2 rounded ${isMobile ? 'bg-[var(--color-brand)] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                            title="Mobile View"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto flex justify-center items-start">
                    <div
                        className={`transition-all duration-300 ease-in-out ${isMobile ? 'w-[375px] min-h-[667px] my-4 border-8 border-slate-800 rounded-[3rem] overflow-hidden bg-white shadow-xl' : 'w-full max-w-md rounded-lg shadow-sm border border-slate-200'}`}
                        style={{
                            backgroundColor: isTransparent ? 'transparent' : (style.backgroundColor || '#ffffff'),
                            color: style.inputStyle?.color || '#000000'
                        }}
                    >
                        {isMobile && <div className="h-6 bg-slate-800 w-full absolute top-0 left-0 z-10"></div>}
                        <div className={`p-8 ${isMobile ? 'pt-12 h-full overflow-y-auto' : ''}`}>
                            <div className="space-y-4">
                                {currentForm.fields?.map((field, idx) => (
                                    <div key={idx}>
                                        <label className="block text-xs font-bold mb-1 opacity-80">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                placeholder={field.placeholder}
                                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white/50"
                                                rows={3}
                                                disabled
                                            />
                                        ) : field.type === 'phone' ? (
                                            <PhoneInputWithCountry
                                                placeholder={field.placeholder}
                                                required={field.required}
                                                disabled={true}
                                                className="bg-white/50"
                                            />
                                        ) : (
                                            <input
                                                type={field.type}
                                                placeholder={field.placeholder}
                                                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white/50"
                                                disabled
                                            />
                                        )}
                                    </div>
                                ))}

                                {currentForm.settings?.declaration?.enabled && (
                                    <div className="flex items-start gap-2 mt-4 text-xs">
                                        <input type="checkbox" className="mt-0.5" disabled />
                                        <span>
                                            I agree to the <span className="text-blue-600 underline">{currentForm.settings.declaration.title || 'Terms'}</span>
                                        </span>
                                    </div>
                                )}

                                <button
                                    className="w-full py-2.5 rounded font-bold text-sm mt-4 transition-opacity hover:opacity-90"
                                    style={{
                                        backgroundColor: style.primaryColor || '#0f172a',
                                        color: style.buttonTextColor || '#ffffff'
                                    }}
                                >
                                    {style.buttonText || 'Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!canRead && !loading) {
        return (
            <div className="flex flex-col w-full h-full bg-slate-50 font-sans text-slate-900 justify-center items-center p-8 min-h-[400px]">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 shadow-sm">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-1">Access Denied</h3>
                    <p className="text-sm text-slate-500 mb-4">You do not have the required permissions to view Form Builder. Please contact your administrator.</p>
                </div>
            </div>
        );
    }

    if (isEditing) {
        return (
            <div className="flex flex-col lg:flex-row h-full bg-slate-50 overflow-hidden">
                {/* Left Column: Editor Settings */}
                <div className="w-full lg:w-[420px] xl:w-[480px] flex-shrink-0 flex flex-col bg-white border-r border-slate-200 h-full shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-10 relative">

                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white z-20">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-extrabold text-slate-800 tracking-tight">Edit Form</h2>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditing(false)} className="px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold transition-all">
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={loading} className="px-4 py-1.5 bg-[var(--color-brand)] text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all flex items-center gap-2">
                                {loading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex border-b border-slate-100 px-6 gap-6 sticky top-0 bg-white z-10">
                        {['Content', 'Design', 'Automation', 'Settings'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase())}
                                className={`py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${activeTab === tab.toLowerCase()
                                    ? 'border-[var(--color-brand)] text-[var(--color-brand)]'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Settings Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                        {activeTab === 'content' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Form Identity */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Form Name</label>
                                    <input
                                        type="text"
                                        value={currentForm.name || ''}
                                        onChange={e => setCurrentForm({ ...currentForm, name: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] text-slate-900 font-bold outline-none transition-all placeholder:font-normal"
                                        placeholder="e.g. Website Lead Capture"
                                    />
                                </div>

                                {/* Form Fields */}
                                <div className="bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center">
                                        <h3 className="text-sm font-bold text-slate-800">Fields</h3>
                                        <span className="text-xs text-slate-400 font-medium">{currentForm.fields?.length || 0} fields</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        {currentForm.fields?.map((field, idx) => (
                                            <div key={idx} className="group flex flex-col gap-3 p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-all relative">
                                                <button
                                                    onClick={() => removeField(idx)}
                                                    className="absolute -top-2 -right-2 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 p-1 rounded-full shadow border border-slate-100 opacity-0 group-hover:opacity-100 transition-all z-10"
                                                    title="Delete Field"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>

                                                <div className="flex items-center gap-2">
                                                    <span className="bg-slate-100 text-slate-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">{field.type}</span>
                                                    <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.required}
                                                            onChange={e => updateField(idx, { required: e.target.checked })}
                                                            className="w-3.5 h-3.5 text-[var(--color-brand)] rounded border-slate-300 focus:ring-[var(--color-brand)]"
                                                        />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Required</span>
                                                    </label>
                                                </div>

                                                <div className="grid grid-cols-1 gap-2">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={e => updateField(idx, { label: e.target.value })}
                                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:bg-white focus:border-[var(--color-brand)] outline-none transition-colors"
                                                        placeholder="Label (e.g. Email)"
                                                    />
                                                    <input
                                                        type="text"
                                                        value={field.placeholder || ''}
                                                        onChange={e => updateField(idx, { placeholder: e.target.value })}
                                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:bg-white focus:border-[var(--color-brand)] outline-none transition-colors"
                                                        placeholder="Placeholder text..."
                                                    />
                                                </div>
                                            </div>
                                        ))}

                                        <div className="mt-4 pt-4 border-t border-slate-100">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Add New Field</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {['text', 'email', 'phone', 'number', 'textarea'].map(type => (
                                                    <button
                                                        key={type}
                                                        onClick={() => addField(type)}
                                                        className="px-3 py-2.5 bg-slate-50 hover:bg-[var(--color-brand)] hover:text-white border border-slate-200 hover:border-[var(--color-brand)] text-slate-600 rounded-lg text-xs font-bold transition-all capitalize flex items-center justify-center gap-1"
                                                    >
                                                        <span>+</span> {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'design' && (
                            <div className="space-y-6 animate-fade-in">
                                {/* Appearance */}
                                <div className="bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-50">
                                        <h3 className="text-sm font-bold text-slate-800">Color & Style</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                            <span className="text-sm font-bold text-slate-700">Transparent Background</span>
                                            <div className="relative inline-block w-10 h-6 align-middle select-none transition duration-200 ease-in">
                                                <input
                                                    type="checkbox"
                                                    checked={currentForm.styling?.backgroundColor === 'transparent'}
                                                    onChange={e => setCurrentForm({
                                                        ...currentForm,
                                                        styling: { ...currentForm.styling, backgroundColor: e.target.checked ? 'transparent' : '#ffffff' }
                                                    })}
                                                    className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-2 border-[var(--color-brand)] appearance-none cursor-pointer transition-transform duration-200 text-[var(--color-brand)] focus:ring-0 checked:right-0 checked:border-[var(--color-brand)]"
                                                    style={{ right: currentForm.styling?.backgroundColor === 'transparent' ? '0' : 'auto', left: currentForm.styling?.backgroundColor === 'transparent' ? 'auto' : '0' }}
                                                />
                                                <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer ${currentForm.styling?.backgroundColor === 'transparent' ? 'bg-[var(--color-brand)]' : 'bg-slate-200'}`}></label>
                                            </div>
                                        </div>

                                        {currentForm.styling?.backgroundColor !== 'transparent' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Background Color</label>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-slate-200 shadow-sm group cursor-pointer hover:scale-105 transition-transform">
                                                        <input
                                                            type="color"
                                                            value={currentForm.styling?.backgroundColor || '#ffffff'}
                                                            onChange={e => setCurrentForm({ ...currentForm, styling: { ...currentForm.styling, backgroundColor: e.target.value } })}
                                                            className="absolute -top-4 -left-4 w-20 h-20 cursor-pointer p-0 border-0"
                                                        />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={currentForm.styling?.backgroundColor || '#ffffff'}
                                                        onChange={e => setCurrentForm({ ...currentForm, styling: { ...currentForm.styling, backgroundColor: e.target.value } })}
                                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-600 outline-none uppercase"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Button Styling */}
                                <div className="bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-50">
                                        <h3 className="text-sm font-bold text-slate-800">Button Styling</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Button Text</label>
                                            <input
                                                type="text"
                                                value={currentForm.styling?.buttonText || ''}
                                                onChange={e => setCurrentForm({ ...currentForm, styling: { ...currentForm.styling, buttonText: e.target.value } })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:border-[var(--color-brand)] outline-none"
                                                placeholder="Submit Button Text"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'automation' && (
                            <div className="animate-fade-in">
                                <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100 p-1 mb-6">
                                    <div className="px-4 py-3 border-b border-indigo-100/50 flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-indigo-900">CRM Pipeline</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider mb-1.5">Target Pipeline</label>
                                                <select
                                                    value={currentForm.pipeline_id || ''}
                                                    onChange={e => setCurrentForm({ ...currentForm, pipeline_id: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-300 outline-none shadow-sm"
                                                >
                                                    <option value="">Select Pipeline...</option>
                                                    {pipelines.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider mb-1.5">Initial Stage</label>
                                                <select
                                                    value={currentForm.stage_id || ''}
                                                    onChange={e => setCurrentForm({ ...currentForm, stage_id: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white border border-indigo-100 rounded-xl text-sm font-bold text-slate-700 focus:border-indigo-300 outline-none shadow-sm"
                                                    disabled={!currentForm.pipeline_id}
                                                >
                                                    <option value="">Select Stage...</option>
                                                    {stages.map(s => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-50">
                                        <h3 className="text-sm font-bold text-slate-800">Organization</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Add to Contacts Group</label>
                                            <select
                                                value={currentForm.default_group_ids?.[0] || ''}
                                                onChange={e => setCurrentForm({ ...currentForm, default_group_ids: e.target.value ? [e.target.value] : [] })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:border-[var(--color-brand)] outline-none"
                                            >
                                                <option value="">Select Group...</option>
                                                {groups.map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Apply Tags</label>
                                            <input
                                                type="text"
                                                placeholder="leads, website, promo..."
                                                value={currentForm.default_tags?.join(', ') || ''}
                                                onChange={e => setCurrentForm({ ...currentForm, default_tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:border-[var(--color-brand)] outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="bg-white rounded-2xl border border-slate-100 p-1 shadow-sm">
                                    <div className="px-4 py-3 border-b border-slate-50">
                                        <h3 className="text-sm font-bold text-slate-800">Post-Submission</h3>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Redirect URL <span className="text-slate-300 font-normal lowercase">(optional)</span></label>
                                            <input
                                                type="text"
                                                value={currentForm.success_redirect_url || ''}
                                                onChange={e => setCurrentForm({ ...currentForm, success_redirect_url: e.target.value })}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 focus:border-[var(--color-brand)] outline-none"
                                                placeholder="https://example.com/thank-you"
                                            />
                                            <p className="mt-1.5 text-[11px] text-slate-400">If left empty, users will see the default success message.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="checkbox"
                                            checked={currentForm.settings?.declaration?.enabled || false}
                                            onChange={e => setCurrentForm({
                                                ...currentForm,
                                                settings: {
                                                    ...currentForm.settings,
                                                    declaration: {
                                                        ...(currentForm.settings?.declaration || { title: '', link: '' }),
                                                        enabled: e.target.checked
                                                    }
                                                }
                                            })}
                                            className="w-5 h-5 text-[var(--color-brand)] rounded border-slate-300 focus:ring-[var(--color-brand)]"
                                        />
                                        <label className="text-sm font-bold text-slate-700">Require Consent Checkbox</label>
                                    </div>

                                    {currentForm.settings?.declaration?.enabled && (
                                        <div className="ml-8 animate-fade-in-down">
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Declaration Text</label>
                                            <input
                                                type="text"
                                                value={currentForm.settings.declaration.title || ''}
                                                onChange={e => setCurrentForm({ ...currentForm, settings: { ...currentForm.settings, declaration: { ...currentForm.settings!.declaration!, title: e.target.value } } })}
                                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:border-[var(--color-brand)] outline-none"
                                                placeholder="I agree to the Terms of Service"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="w-full lg:w-1/2 p-6 bg-[var(--color-bg)] flex flex-col h-full overflow-hidden">
                    {renderPreview()}
                </div>

                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
                    title={modalConfig.title}
                    footer={
                        <button
                            onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
                        >
                            Close
                        </button>
                    }
                >
                    <p className={`text-sm ${modalConfig.isError ? 'text-red-600' : 'text-[var(--color-text)] opacity-80'}`}>
                        {modalConfig.message}
                    </p>
                </Modal>

                {/* Database Setup Modal */}
                <DatabaseSetup isOpen={showDbSetup} onClose={() => setShowDbSetup(false)} />

                {/* Embed Code Modal */}
                <Modal
                    isOpen={embedConfig.isOpen}
                    onClose={() => setEmbedConfig({ ...embedConfig, isOpen: false })}
                    title="Embed Form"
                    footer={
                        <button
                            onClick={() => setEmbedConfig({ ...embedConfig, isOpen: false })}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:opacity-90"
                        >
                            Done
                        </button>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">Copy the code below and paste it into your website's HTML to embed the form.</p>

                        <div className="relative group">
                            <div className="absolute top-2 right-2 flex gap-1">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(`<iframe src="${window.location.origin}/forms/${embedConfig.token}" width="100%" height="600" frameborder="0" style="border:none; overflow:hidden; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></iframe>`);
                                        // Simple visual feedback could be added here
                                    }}
                                    className="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-500 shadow-sm"
                                    title="Copy Code"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                </button>
                            </div>
                            <textarea
                                readOnly
                                className="w-full h-32 p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 resize-none"
                                value={`<iframe src="${window.location.origin}/forms/${embedConfig.token}" width="100%" height="600" frameborder="0" style="border:none; overflow:hidden; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></iframe>`}
                            />
                        </div>
                        <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-start gap-2">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p>You can adjust the <code>width</code> and <code>height</code> attributes in the code to fit your page layout.</p>
                        </div>
                    </div>
                </Modal>
                <DatabaseSetup isOpen={showDbSetup} onClose={() => setShowDbSetup(false)} />
            </div>
        );
    }

    // List View
    return (
        <div className="p-6 w-full animate-fade-in">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Form Builder</h1>
                    <p className="text-[var(--color-text)] opacity-60">Create and manage lead capture forms.</p>
                </div>
                {canWrite ? (
                    <button
                        onClick={handleCreateNew}
                        className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-[var(--radius-btn)] font-bold shadow-lg shadow-brand-200 transition-all active:scale-95"
                    >
                        + Create Form
                    </button>
                ) : (
                    <div className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Read Only Mode
                    </div>
                )}
            </div>

            {/* Table Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {forms.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No Forms Created Yet</h3>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto">Create your first form to start capturing leads directly into your pipeline.</p>
                        {canWrite ? (
                            <button onClick={handleCreateNew} className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold shadow-md hover:bg-brand-700 transition-colors">Create First Form</button>
                        ) : (
                            <div className="px-4 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl border border-slate-200 shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto">
                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                Read Only Mode
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100">
                            <thead className="bg-brand-600 text-white shadow-md">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Form Name</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 hidden sm:table-cell">Pipeline</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 hidden md:table-cell">Group</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Submissions</th>
                                    <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Last Updated</th>
                                    <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {forms.map((form) => {
                                    const pipelineName = pipelines.find(p => p.id === form.pipeline_id)?.name || '-';
                                    const groupIds = form.default_group_ids?.length ? form.default_group_ids : (form.settings as any)?.default_group_ids;
                                    const groupName = groupIds?.length
                                        ? groups.find(g => g.id === groupIds[0])?.name || '-'
                                        : '-';

                                    const lastUpdatedDate = form.last_submission_at
                                        ? new Date(form.last_submission_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                                        : '-';

                                    return (
                                        <tr key={form.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 text-sm">{form.name}</div>
                                                        <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{form.description || 'No description'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 hidden sm:table-cell">
                                                <span className="text-sm font-medium text-slate-600">{pipelineName}</span>
                                            </td>
                                            <td className="px-6 py-4 hidden md:table-cell">
                                                <span className="text-sm font-medium text-slate-600">{groupName}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${form.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                                    {form.is_active !== false ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 text-slate-600 border border-slate-100 text-xs font-bold">
                                                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138z" /></svg>
                                                    {form.submission_count || 0}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-sm font-medium text-slate-600">{lastUpdatedDate}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => copyLink(form.form_token, form.id!)}
                                                        className={`p-2 rounded-lg transition-colors ${copiedId === form.id ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50'}`}
                                                        title={copiedId === form.id ? 'Copied!' : 'Copy Public Link'}
                                                    >
                                                        {copiedId === form.id ? (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => setEmbedConfig({ isOpen: true, token: form.form_token, name: form.name })}
                                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Get Embed Code"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                                    </button>
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => {
                                                                setCurrentForm({
                                                                    ...form,
                                                                    default_group_ids: form.default_group_ids?.length ? form.default_group_ids : (form.settings as any)?.default_group_ids,
                                                                    default_tags: form.default_tags?.length ? form.default_tags : (form.settings as any)?.default_tags,
                                                                    success_redirect_url: form.success_redirect_url || (form.settings as any)?.success_redirect_url
                                                                });
                                                                setIsEditing(true);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="Edit Form"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button onClick={() => handleDelete(form.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete Form">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Database Setup Modal for List View */}
            <DatabaseSetup isOpen={showDbSetup} onClose={() => setShowDbSetup(false)} />

            {/* Embed Code Modal */}
            <Modal
                isOpen={embedConfig.isOpen}
                onClose={() => setEmbedConfig({ ...embedConfig, isOpen: false })}
                title="Embed Form"
                footer={
                    <button
                        onClick={() => setEmbedConfig({ ...embedConfig, isOpen: false })}
                        className="px-4 py-2 bg-[var(--color-brand)] text-white rounded-lg font-medium hover:opacity-90"
                    >
                        Done
                    </button>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Copy the code below and paste it into your website's HTML to embed the form.</p>

                    <div className="relative group">
                        <div className="absolute top-2 right-2 flex gap-1">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`<iframe src="${window.location.origin}/forms/${embedConfig.token}" width="100%" height="600" frameborder="0" style="border:none; overflow:hidden; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></iframe>`);
                                }}
                                className="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-500 shadow-sm"
                                title="Copy Code"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                            </button>
                        </div>
                        <textarea
                            readOnly
                            className="w-full h-32 p-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20 resize-none"
                            value={`<iframe src="${window.location.origin}/forms/${embedConfig.token}" width="100%" height="600" frameborder="0" style="border:none; overflow:hidden; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"></iframe>`}
                        />
                    </div>
                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-start gap-2">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p>You can adjust the <code>width</code> and <code>height</code> attributes in the code to fit your page layout.</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default FormBuilder;
