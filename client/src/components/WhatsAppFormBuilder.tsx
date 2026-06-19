import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
    PlusIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon,
    EditIcon, CheckSquareIcon, ListIcon, CtaIcon, MenuIcon,
    ArrowLeftIcon
} from './icons';
import Modal from './Modal';
import Toast from './Toast';

interface WhatsAppFlowBuilderProps {
    onBack?: () => void;
    flowId?: string | null;
}

// --- Types ---

type ComponentType =
    | 'TextHeading' | 'TextSubheading' | 'TextBody' | 'TextCaption'
    | 'ShortAnswer' | 'Paragraph' | 'DatePicker'
    | 'SingleChoice' | 'MultipleChoice' | 'Dropdown' | 'OptIn';

interface FlowComponent {
    id: string;
    type: ComponentType;
    label?: string;
    text?: string;
    name?: string;
    required?: boolean;
    options?: { id: string; title: string }[];
    inputType?: 'text' | 'email' | 'number' | 'phone'; // For ShortAnswer
    helperText?: string;
}

interface FlowScreen {
    id: string;
    title: string;
    terminal: boolean;
    children: FlowComponent[];
    footerLabel?: string;
}

// --- Constants ---

const COMPONENT_TYPES: { [key: string]: { label: string, icon: any } } = {
    TextHeading: { label: 'Large Heading', icon: MenuIcon },
    TextSubheading: { label: 'Small Heading', icon: MenuIcon },
    TextBody: { label: 'Body', icon: MenuIcon },
    TextCaption: { label: 'Caption', icon: MenuIcon },
    ShortAnswer: { label: 'Short Answer', icon: EditIcon },
    Paragraph: { label: 'Paragraph', icon: EditIcon },
    DatePicker: { label: 'Date Picker', icon: EditIcon },
    SingleChoice: { label: 'Single Choice', icon: ListIcon },
    MultipleChoice: { label: 'Multiple Choice', icon: CheckSquareIcon },
    Dropdown: { label: 'Dropdown', icon: ListIcon },
    OptIn: { label: 'Opt-in', icon: CheckSquareIcon },
};


const generateRandomId = () => Array(6).fill(0).map(() => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');

import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

const WhatsAppFormBuilder: React.FC<WhatsAppFlowBuilderProps> = ({ onBack, flowId }) => {
    const { hasAccess } = usePermissions();
    const canWrite = hasAccess('Whatsapp Forms', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('Whatsapp Forms', ACCESS_TYPES.ALL_ACCESS);

    // --- State ---
    // Initialize with a random ID for the first screen
    const [initialScreenId] = useState(() => `screen_${generateRandomId()}`);
    const [screens, setScreens] = useState<FlowScreen[]>([
        {
            id: initialScreenId,
            title: 'Screen 1',
            terminal: false,
            children: [],
            footerLabel: 'Continue'
        }
    ]);
    const [activeScreenId, setActiveScreenId] = useState<string>(initialScreenId);
    const [expandedComponentId, setExpandedComponentId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showPreviewLink, setShowPreviewLink] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning', title: string, message: string } | null>(null);
    const addMenuRef = useRef<HTMLDivElement>(null);

    // --- Derived State ---
    const activeScreen = screens.find(s => s.id === activeScreenId) || screens[0];

    // --- Effects ---
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
                setShowAddMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        // Fetch Flow Details (for Preview URL)
        if (flowId) {
            fetchFlowDetails();
        }

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [flowId]);

    const fetchFlowDetails = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/whatsapp/forms/${flowId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.preview && data.preview.preview_url) {
                    setPreviewUrl(data.preview.preview_url);
                }
            }
        } catch (error) {
            console.error("Error fetching flow details:", error);
        }
    };

    // --- Actions ---

    const addScreen = () => {
        if (screens.length >= 8) {
            setToast({ type: 'warning', title: 'Limit Reached', message: 'Maximum 8 screens allowed.' });
            return;
        }

        // Generate random alphabetic string (6 chars)
        const idSuffix = generateRandomId();

        const newScreen: FlowScreen = {
            id: `screen_${idSuffix}`,
            title: `Screen ${screens.length + 1}`,
            children: [],
            terminal: false,
            footerLabel: 'Continue'
        };
        setScreens([...screens, newScreen]);
        setActiveScreenId(newScreen.id);
    };

    const deleteScreen = (screenId: string) => {
        if (screens.length <= 1) return;
        const newScreens = screens.filter(s => s.id !== screenId);
        setScreens(newScreens);
        if (activeScreenId === screenId) {
            setActiveScreenId(newScreens[0].id);
        }
    };

    const addComponent = (type: ComponentType) => {
        const idSuffix = generateRandomId();

        // Helper to get a clean prefix from type
        const getPrefix = (t: ComponentType) => {
            switch (t) {
                case 'ShortAnswer': return 'question';
                case 'Paragraph': return 'paragraph';
                case 'DatePicker': return 'date';
                case 'SingleChoice': return 'choice';
                case 'MultipleChoice': return 'multichoice';
                case 'Dropdown': return 'dropdown';
                case 'OptIn': return 'optin';
                default: return 'field';
            }
        };

        const newComponent: FlowComponent = {
            id: `cmp_${idSuffix}`,
            type,
            text: type.startsWith('Text') ? 'Text' : undefined,
            label: !type.startsWith('Text') ? 'Label' : undefined,
            name: !type.startsWith('Text') ? `${getPrefix(type)}_${idSuffix}` : undefined,
            required: !type.startsWith('Text'),
            options: ['SingleChoice', 'MultipleChoice', 'Dropdown'].includes(type)
                ? [{ id: '0_Option_1', title: 'Option 1' }, { id: '1_Option_2', title: 'Option 2' }]
                : undefined,
            inputType: type === 'ShortAnswer' ? 'text' : undefined,
            helperText: type === 'ShortAnswer' ? 'Helper text' : undefined
        };

        const updatedChildren = [...activeScreen.children, newComponent];
        updateScreen(activeScreenId, { children: updatedChildren });
        setExpandedComponentId(newComponent.id);
        setShowAddMenu(false);
    };

    const updateScreen = (screenId: string, updates: Partial<FlowScreen>) => {
        setScreens(prev => prev.map(s => s.id === screenId ? { ...s, ...updates } : s));
    };

    const updateComponent = (componentId: string, updates: Partial<FlowComponent>) => {
        const updatedChildren = activeScreen.children.map(c =>
            c.id === componentId ? { ...c, ...updates } : c
        );
        updateScreen(activeScreenId, { children: updatedChildren });
    };

    const deleteComponent = (componentId: string) => {
        const updatedChildren = activeScreen.children.filter(c => c.id !== componentId);
        updateScreen(activeScreenId, { children: updatedChildren });
    };

    // --- JSON Generation ---

    const generateMetaJson = () => {


        // Helper to sanitize IDs to be Meta-friendly (Lowercase, no spaces, alphanumeric + underscore)
        const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');

        const metaScreens = screens.map((screen, index) => {
            const screenId = sanitizeId(screen.id);
            const isLastScreen = index === screens.length - 1;
            const nextScreen = screens[index + 1];
            const nextScreenId = nextScreen ? sanitizeId(nextScreen.id) : undefined;



            // 1. Generate Data Binding (Inputs for this screen)
            // We pass ALL data from ALL previous screens
            const data: any = {};

            // Collect all fields from previous screens
            for (let i = 0; i < index; i++) {
                const prevScreen = screens[i];
                const prevScreenId = sanitizeId(prevScreen.id);
                prevScreen.children.forEach(child => {
                    if (child.name) {
                        const key = `${prevScreenId}_${child.name}`;
                        let type = 'string';
                        if (child.type === 'MultipleChoice') type = 'array';
                        if (child.type === 'OptIn') type = 'boolean';

                        data[key] = {
                            type: type,
                            __example__: type === 'array' ? [] : (type === 'boolean' ? false : 'Example')
                        };

                        if (type === 'array') {
                            data[key].items = { type: 'string' };
                        }
                    }
                });
            }

            // 2. Generate Children (Components)
            const children = screen.children.map(c => {
                const base: any = {};

                // Map Type
                switch (c.type) {
                    case 'TextHeading': base.type = 'TextHeading'; base.text = c.text; break;
                    case 'TextSubheading': base.type = 'TextSubheading'; base.text = c.text; break;
                    case 'TextBody': base.type = 'TextBody'; base.text = c.text; break;
                    case 'TextCaption': base.type = 'TextCaption'; base.text = c.text; break;

                    case 'ShortAnswer':
                        base.type = 'TextInput';
                        base['input-type'] = c.inputType || 'text';
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        if (c.helperText) base['helper-text'] = c.helperText;
                        break;
                    case 'Paragraph':
                        base.type = 'TextArea';
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        break;
                    case 'DatePicker':
                        base.type = 'DatePicker';
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        break;

                    case 'SingleChoice':
                        base.type = 'RadioButtonsGroup';
                        base['data-source'] = c.options;
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        break;
                    case 'MultipleChoice':
                        base.type = 'CheckboxGroup';
                        base['data-source'] = c.options;
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        break;
                    case 'Dropdown':
                        base.type = 'Dropdown';
                        base['data-source'] = c.options;
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        break;

                    case 'OptIn':
                        base.type = 'OptIn';
                        base.label = c.label;
                        base.name = c.name;
                        base.required = c.required;
                        break;
                }
                return base;
            });

            // 3. Generate Footer (Navigation)
            const payload: any = {};

            // Add current screen's form data to payload
            screen.children.forEach(child => {
                if (child.name) {
                    const key = `${screenId}_${child.name}`;
                    payload[key] = `\${form.${child.name}}`;
                }
            });

            // Pass through data from previous screens
            for (let i = 0; i < index; i++) {
                const prevScreen = screens[i];
                const prevScreenId = sanitizeId(prevScreen.id);
                prevScreen.children.forEach(child => {
                    if (child.name) {
                        const key = `${prevScreenId}_${child.name}`;
                        payload[key] = `\${data.${key}}`;
                    }
                });
            }

            const footer = {
                type: 'Footer',
                label: screen.footerLabel || 'Continue',
                'on-click-action': {
                    name: isLastScreen ? 'complete' : 'navigate',
                    ...(isLastScreen ? {} : {
                        next: {
                            type: 'screen',
                            name: nextScreenId
                        }
                    }),
                    payload: payload
                }
            };

            children.push(footer);

            return {
                id: screenId,
                title: screen.title,
                terminal: isLastScreen ? true : undefined,
                data: data,
                layout: {
                    type: "SingleColumnLayout",
                    children: [
                        {
                            type: "Form",
                            name: "flow_path",
                            children: children
                        }
                    ]
                }
            };
        });

        return {
            version: "7.2",
            screens: metaScreens
        };
    };

    const handleSave = async (publish: boolean = false) => {
        if (!flowId) return;
        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const flowJson = generateMetaJson();
            console.log("Generated JSON:", JSON.stringify(flowJson, null, 2));

            // 1. Update Flow JSON on Server
            const updateResponse = await fetch(`/api/whatsapp/forms/${flowId}/json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ flow_json: flowJson })
            });

            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(errorData.error || 'Failed to update flow JSON');
            }

            // 2. Publish if requested
            if (publish) {
                const publishResponse = await fetch(`/api/whatsapp/forms/${flowId}/publish`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });

                if (!publishResponse.ok) {
                    const errorData = await publishResponse.json();
                    throw new Error(errorData.error || 'Failed to publish flow');
                }

                setToast({ type: 'success', title: 'Success', message: 'Flow saved and published successfully!' });
            } else {
                setToast({ type: 'success', title: 'Success', message: 'Flow saved successfully!' });
            }

        } catch (error: any) {
            console.error("Error saving flow:", error);
            setToast({ type: 'error', title: 'Save Failed', message: error.message });
        } finally {
            setIsSaving(false);
        }
    };




    const handleDelete = async () => {
        if (!flowId || !canDelete) return;
        if (!window.confirm('Are you sure you want to delete this flow? This action cannot be undone.')) {
            return;
        }

        setIsSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const response = await fetch(`/api/whatsapp/forms/${flowId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete flow');
            }

            if (onBack) onBack();
        } catch (error: any) {
            console.error('Error deleting flow:', error);
            setToast({ type: 'error', title: 'Delete Failed', message: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadJson = () => {
        const flowJson = generateMetaJson();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(flowJson, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `flow_${flowId || 'draft'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // --- Renderers ---

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Top Bar */}
            <div className="min-h-[4rem] bg-white border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between px-4 sm:px-6 py-3 sm:py-0 shadow-sm z-10 shrink-0 gap-3 sm:gap-0">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
                        <ArrowLeftIcon className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">WhatsApp Form Builder</h1>
                        <p className="text-xs text-slate-500">Designing Form: {flowId || 'New Form'}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
                    {flowId && canDelete && (
                        <button onClick={handleDelete} disabled={isSaving} className="px-3 py-2 text-sm font-bold text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2 mr-2">
                            <TrashIcon className="w-4 h-4" />
                            Delete
                        </button>
                    )}
                    <button onClick={handleDownloadJson} className="px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        JSON
                    </button>
                    <button onClick={() => setShowPreviewLink(true)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                        Preview Link
                    </button>
                    {canWrite && (
                        <>
                            <button onClick={() => handleSave(false)} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                Save
                            </button>
                            <button onClick={() => handleSave(true)} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-md shadow-brand-200 transition-colors">
                                {isSaving ? 'Publishing...' : 'Publish'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
                {/* Left Panel: Screens */}
                <div className="w-full lg:w-64 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-800">Screens</h2>
                    </div>
                    <div className="flex-none lg:flex-1 overflow-y-auto p-2 space-y-1 max-h-48 lg:max-h-none">
                        {screens.map(screen => (
                            <button
                                key={screen.id}
                                onClick={() => setActiveScreenId(screen.id)}
                                className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${activeScreenId === screen.id ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded text-xs font-bold text-slate-500">
                                        ::
                                    </span>
                                    <span>{screen.title}</span>
                                </div>
                                 {screens.length > 1 && canWrite && (
                                    <span onClick={(e) => { e.stopPropagation(); deleteScreen(screen.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1">
                                        <TrashIcon className="w-4 h-4" />
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                     {canWrite && (
                        <div className="p-3 border-t border-slate-100">
                            <button onClick={addScreen} className="w-full py-2 flex items-center justify-center gap-2 text-sm font-bold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <PlusIcon className="w-4 h-4" /> Add new
                            </button>
                        </div>
                    )}
                </div>

                {/* Middle Panel: Edit Contents */}
                <div className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col shrink-0">
                    <div className="p-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-800">Edit Contents</h2>
                    </div>

                    <div className="flex-none lg:flex-1 overflow-y-auto p-4 space-y-6">
                        <fieldset disabled={!canWrite} className="space-y-6 contents">
                            {/* Screen Title */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Screen title</label>
                                <input
                                    type="text"
                                    value={activeScreen.title}
                                    onChange={(e) => updateScreen(activeScreenId, { title: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>

                            {/* Footer Button Label */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Button Label</label>
                                <input
                                    type="text"
                                    value={activeScreen.footerLabel || 'Continue'}
                                    onChange={(e) => updateScreen(activeScreenId, { footerLabel: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                />
                            </div>
                        </fieldset>

                        {canWrite && (
                            <div className="relative" ref={addMenuRef}>
                                <button
                                    onClick={() => setShowAddMenu(!showAddMenu)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 flex items-center gap-2 hover:bg-slate-100 transition-colors"
                                >
                                    + Add Content <ChevronDownIcon className="w-4 h-4" />
                                </button>

                                {showAddMenu && (
                                    <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden animate-fade-in">
                                        <div className="py-1">
                                            <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Aa Text</div>
                                            <button onClick={() => addComponent('TextHeading')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Large Heading</button>
                                            <button onClick={() => addComponent('TextSubheading')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Small Heading</button>
                                            <button onClick={() => addComponent('TextBody')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Body</button>
                                            <button onClick={() => addComponent('TextCaption')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Caption</button>

                                            <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Text Answer</div>
                                            <button onClick={() => addComponent('ShortAnswer')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Short Answer</button>
                                            <button onClick={() => addComponent('Paragraph')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Paragraph</button>
                                            <button onClick={() => addComponent('DatePicker')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Date Picker</button>

                                            <div className="px-3 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider mt-2">Selection</div>
                                            <button onClick={() => addComponent('SingleChoice')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Single Choice</button>
                                            <button onClick={() => addComponent('MultipleChoice')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Multiple Choice</button>
                                            <button onClick={() => addComponent('Dropdown')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Dropdown</button>
                                            <button onClick={() => addComponent('OptIn')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600">Opt-in</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>

                        {/* Components List */}
                        <div className="space-y-3">
                            {activeScreen.children.map((child) => (
                                <div key={child.id} className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                                    {/* Header */}
                                    <div
                                        className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => setExpandedComponentId(expandedComponentId === child.id ? null : child.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-slate-400">
                                                {React.createElement(COMPONENT_TYPES[child.type].icon, { className: "w-4 h-4" })}
                                            </div>
                                            <span className="text-sm font-bold text-slate-700">{COMPONENT_TYPES[child.type].label}</span>
                                        </div>
                                         <div className="flex items-center gap-2">
                                            {canWrite && (
                                                <button onClick={(e) => { e.stopPropagation(); deleteComponent(child.id); }} className="p-1 text-slate-400 hover:text-red-500">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                            {expandedComponentId === child.id ? <ChevronDownIcon className="w-4 h-4 text-slate-400" /> : <ChevronRightIcon className="w-4 h-4 text-slate-400" />}
                                        </div>
                                    </div>

                                     {/* Body (Expanded) */}
                                    {expandedComponentId === child.id && (
                                        <div className="p-4 space-y-4 border-t border-slate-100 animate-fade-in">
                                            <fieldset disabled={!canWrite} className="space-y-4 contents">
                                                {child.type.startsWith('Text') ? (
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 mb-1">Text</label>
                                                    <textarea
                                                        value={child.text}
                                                        onChange={(e) => updateComponent(child.id, { text: e.target.value })}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                        rows={3}
                                                        maxLength={child.type === 'TextBody' || child.type === 'TextCaption' ? 4096 : 80}
                                                    />
                                                    <div className="text-xs text-slate-400 text-right mt-1">
                                                        {child.text?.length || 0}/{child.type === 'TextBody' || child.type === 'TextCaption' ? 4096 : 80}
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <label className="block text-xs font-bold text-slate-500 mb-1">Label</label>
                                                        <input
                                                            type="text"
                                                            value={child.label}
                                                            onChange={(e) => updateComponent(child.id, { label: e.target.value })}
                                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                            maxLength={
                                                                child.type === 'ShortAnswer' ? 20 :
                                                                    child.type === 'SingleChoice' || child.type === 'MultipleChoice' ? 30 :
                                                                        child.type === 'Dropdown' ? 20 :
                                                                            child.type === 'OptIn' ? 300 :
                                                                                100 // Default
                                                            }
                                                        />
                                                        <div className="text-xs text-slate-400 text-right mt-1">
                                                            {child.label?.length || 0}/{
                                                                child.type === 'ShortAnswer' ? 20 :
                                                                    child.type === 'SingleChoice' || child.type === 'MultipleChoice' ? 30 :
                                                                        child.type === 'Dropdown' ? 20 :
                                                                            child.type === 'OptIn' ? 300 :
                                                                                100
                                                            }
                                                        </div>
                                                    </div>

                                                    {child.type === 'ShortAnswer' && (
                                                        <>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 mb-1">Input Type</label>
                                                                <select
                                                                    value={child.inputType}
                                                                    onChange={(e) => updateComponent(child.id, { inputType: e.target.value as any })}
                                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                                >
                                                                    <option value="text">Text</option>
                                                                    <option value="email">Email</option>
                                                                    <option value="number">Number</option>
                                                                    <option value="phone">Phone</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-slate-500 mb-1">Helper Text</label>
                                                                <input
                                                                    type="text"
                                                                    value={child.helperText || ''}
                                                                    onChange={(e) => updateComponent(child.id, { helperText: e.target.value })}
                                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                                    placeholder="Optional helper text"
                                                                    maxLength={80}
                                                                />
                                                                <div className="text-xs text-slate-400 text-right mt-1">
                                                                    {child.helperText?.length || 0}/80
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}

                                                    {child.options && (
                                                        <div>
                                                            <label className="block text-xs font-bold text-slate-500 mb-2">Options</label>
                                                            <div className="space-y-2">
                                                                {child.options.map((opt, idx) => (
                                                                    <div key={idx} className="flex gap-2">
                                                                        <input
                                                                            type="text"
                                                                            value={opt.id}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...(child.options || [])];
                                                                                newOpts[idx] = { ...opt, id: e.target.value };
                                                                                updateComponent(child.id, { options: newOpts });
                                                                            }}
                                                                            className="w-1/3 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded"
                                                                            placeholder="ID"
                                                                        />
                                                                        <input
                                                                            type="text"
                                                                            value={opt.title}
                                                                            onChange={(e) => {
                                                                                const newOpts = [...(child.options || [])];
                                                                                newOpts[idx] = { ...opt, title: e.target.value };
                                                                                updateComponent(child.id, { options: newOpts });
                                                                            }}
                                                                            className="flex-1 px-2 py-1 text-xs bg-white border border-slate-200 rounded"
                                                                            placeholder="Label"
                                                                            maxLength={child.type === 'Dropdown' ? 80 : 30}
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const newOpts = child.options?.filter((_, i) => i !== idx);
                                                                                updateComponent(child.id, { options: newOpts });
                                                                            }}
                                                                            className="text-slate-400 hover:text-red-500"
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                                <button
                                                                    onClick={() => {
                                                                        const newOpts = [...(child.options || []), { id: `opt_${Date.now()}`, title: 'New Option' }];
                                                                        updateComponent(child.id, { options: newOpts });
                                                                    }}
                                                                    className="text-xs text-brand-600 font-bold hover:underline"
                                                                >
                                                                    + Add Option
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="pt-2 border-t border-slate-100 mt-2">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={child.required}
                                                                    onChange={(e) => updateComponent(child.id, { required: e.target.checked })}
                                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                                                />
                                                                <label className="text-xs font-bold text-slate-500">Required</label>
                                                            </div>
                                                            <div className="flex-1">
                                                                <input
                                                                    type="text"
                                                                    value={child.name}
                                                                    onChange={(e) => updateComponent(child.id, { name: e.target.value })}
                                                                    className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-500"
                                                                    placeholder="Field ID"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                                )}
                                            </fieldset>
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className="w-full lg:flex-1 bg-slate-100 flex items-center justify-center p-4 lg:p-8 overflow-hidden lg:overflow-y-auto min-h-[750px] lg:min-h-0">
                    <div className="w-full max-w-[375px] h-[667px] shrink-0 bg-white rounded-[3rem] shadow-2xl border-8 border-slate-800 relative overflow-hidden flex flex-col mx-auto">
                        {/* Phone Notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20"></div>

                        {/* Status Bar */}
                        <div className="h-12 bg-slate-100 flex items-end justify-between px-6 pb-2 text-xs font-bold text-slate-500">
                            <span>9:41</span>
                            <div className="flex gap-1">
                                <span className="w-3 h-3 bg-slate-800 rounded-full opacity-20"></span>
                                <span className="w-3 h-3 bg-slate-800 rounded-full opacity-20"></span>
                                <span className="w-3 h-3 bg-slate-800 rounded-full opacity-20"></span>
                            </div>
                        </div>

                        {/* App Header */}
                        <div className="h-14 bg-white border-b border-slate-100 flex items-center px-4 gap-3">
                            <button className="text-slate-400">←</button>
                            <div className="flex-1">
                                <div className="text-sm font-bold text-slate-800">{activeScreen.title}</div>
                            </div>
                            <button className="text-slate-400">⋮</button>
                        </div>

                        {/* Screen Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                            {activeScreen.children.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
                                    <span className="text-4xl mb-2">+</span>
                                    <span className="text-sm">Add content from panel</span>
                                </div>
                            ) : (
                                activeScreen.children.map((child) => (
                                    <div key={child.id} className="pointer-events-none">
                                        {child.type === 'TextHeading' && <h2 className="text-xl font-bold text-slate-900">{child.text}</h2>}
                                        {child.type === 'TextSubheading' && <h3 className="text-lg font-bold text-slate-800">{child.text}</h3>}
                                        {child.type === 'TextBody' && <p className="text-sm text-slate-600 leading-relaxed">{child.text}</p>}
                                        {child.type === 'TextCaption' && <p className="text-xs text-slate-400">{child.text}</p>}

                                        {(child.type === 'ShortAnswer' || child.type === 'DatePicker') && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">{child.label} {child.required && '*'}</label>
                                                <div className="w-full h-10 border border-slate-300 rounded-lg bg-white flex items-center px-3 text-slate-400 text-sm">
                                                    {child.type === 'DatePicker' ? 'DD/MM/YYYY' : ''}
                                                </div>
                                                {child.helperText && <p className="text-xs text-slate-400 mt-1">{child.helperText}</p>}
                                            </div>
                                        )}
                                        {child.type === 'Paragraph' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">{child.label} {child.required && '*'}</label>
                                                <div className="w-full h-20 border border-slate-300 rounded-lg bg-white"></div>
                                            </div>
                                        )}
                                        {child.type === 'Dropdown' && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">{child.label} {child.required && '*'}</label>
                                                <div className="w-full h-10 border border-slate-300 rounded-lg bg-white flex items-center justify-between px-3 text-slate-400 text-sm">
                                                    <span>Select option</span>
                                                    <span>▼</span>
                                                </div>
                                            </div>
                                        )}
                                        {(child.type === 'SingleChoice' || child.type === 'MultipleChoice') && (
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-2">{child.label} {child.required && '*'}</label>
                                                <div className="space-y-2">
                                                    {child.options?.map((opt, i) => (
                                                        <div key={i} className="flex items-center gap-2">
                                                            <div className={`w-4 h-4 border border-slate-300 ${child.type === 'SingleChoice' ? 'rounded-full' : 'rounded'}`}></div>
                                                            <span className="text-sm text-slate-700">{opt.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {child.type === 'OptIn' && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border border-slate-300 rounded"></div>
                                                <label className="text-sm text-slate-700">{child.label} {child.required && '*'}</label>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-white border-t border-slate-100">
                            <button className="w-full py-3 bg-brand-600 text-white font-bold rounded-full shadow-lg shadow-brand-200">
                                {activeScreen.footerLabel || 'Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <Modal
                isOpen={showPreviewLink}
                onClose={() => setShowPreviewLink(false)}
                title="Preview Link"
                size="md"
                footer={
                    <div className="flex justify-end">
                        <button onClick={() => setShowPreviewLink(false)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors">
                            Close
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">
                        Use this link to preview the flow in WhatsApp. You must have the Meta testing environment set up.
                    </p>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg font-mono text-xs text-slate-600 break-all select-all">
                        whatsapp://flow?id={flowId || 'FLOW_ID'}&mode=draft
                    </div>

                    {previewUrl && (
                        <div>
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block w-full text-center py-2 bg-brand-50 text-brand-700 font-bold rounded-lg hover:bg-brand-100 transition-colors border border-brand-200"
                            >
                                Open Web Preview ↗
                            </a>
                            <p className="text-xs text-slate-400 mt-2 text-center">
                                Opens Meta's official flow preview tool.
                            </p>
                        </div>
                    )}
                </div>
            </Modal>

            {toast && (
                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default WhatsAppFormBuilder;
