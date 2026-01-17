import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Toast from '../Toast';
import { ChevronLeftIcon, ChevronDownIcon } from '../icons';
import TemplatePreview from '../WhatsAppTemplates/TemplatePreview';
import { themeService } from '../../services/themeService';
import { inputFieldService } from '../../services/inputFieldService';

interface CreateCampaignProps {
    onBack: () => void;
    initialData?: {
        templateId?: string;
        manualNumbers?: string[];
        title?: string;
    }
}

const DEFAULT_CONTACT_FIELDS = [
    { label: 'Contact Name', value: 'name' },
    { label: 'Phone Number', value: 'phone' },
    { label: 'Email Address', value: 'email' },
    { label: 'Status', value: 'status' },
    { label: 'Source', value: 'source' },
    { label: 'Tags', value: 'tags' },
];

// Helper component for variable input
const VariableInput = ({ variable, value, onChange, options }: { variable: string, value: string, onChange: (val: string) => void, options: { label: string, value: string }[] }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-3 bg-[var(--color-bg)] p-2 rounded-lg border border-[var(--color-border)] relative">
            <span className="text-sm font-mono bg-[var(--color-surface)] px-2 py-1 rounded text-[var(--color-text)] w-16 text-center border border-[var(--color-border)]">{`{{${variable}}}`}</span>
            <span className="text-[var(--color-text)] opacity-40">→</span>

            <div className="flex-1 relative flex items-center">
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Type value or select field..."
                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)] text-[var(--color-text)] pr-8"
                />
                <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="absolute right-2 text-[var(--color-text)] opacity-50 hover:opacity-100 p-1"
                >
                    <ChevronDownIcon className="w-4 h-4" />
                </button>

                {showDropdown && (
                    <div ref={dropdownRef} className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col">
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase sticky top-0">
                            Insert Contact Field
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {options.map(field => (
                                <button
                                    key={field.value}
                                    onClick={() => {
                                        onChange(field.value);
                                        setShowDropdown(false);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-[var(--color-brand)] transition-colors border-b border-slate-50 last:border-0"
                                >
                                    <div className="font-medium">{field.label}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{field.value}</div>
                                </button>
                            ))}
                            {options.length === 0 && (
                                <div className="px-4 py-3 text-xs text-slate-400 text-center italic">
                                    No fields available
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CreateCampaign: React.FC<CreateCampaignProps> = ({ onBack, initialData }) => {
    const [templates, setTemplates] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [phoneNumbers, setPhoneNumbers] = useState<any[]>([]);
    const [availableFields, setAvailableFields] = useState<any[]>(DEFAULT_CONTACT_FIELDS);

    // Form State
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [campaignTitle, setCampaignTitle] = useState(initialData?.title || '');
    const [selectedGroup, setSelectedGroup] = useState('');
    const [restrictLanguage, setRestrictLanguage] = useState(false);
    const [sendNow, setSendNow] = useState(true);
    const [scheduledAt, setScheduledAt] = useState('');
    const [selectedPhoneNumber, setSelectedPhoneNumber] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [headerType, setHeaderType] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [locationHeader, setLocationHeader] = useState({ latitude: '', longitude: '', name: '', address: '' });

    // Carousel State
    const [carouselCards, setCarouselCards] = useState<any[]>([]);
    const [carouselMediaUrls, setCarouselMediaUrls] = useState<string[]>([]);

    // Variable Mapping State
    const [variableMapping, setVariableMapping] = useState<Record<string, string>>({});
    const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error', title: string, message: string } | null>(null);

    // Business Profile
    const [businessProfile, setBusinessProfile] = useState({ name: 'Your Business', logoUrl: '' });

    // Mobile Tab State
    const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

    const [recipientType, setRecipientType] = useState<'group' | 'manual'>('group');
    const [manualInput, setManualInput] = useState('');

    useEffect(() => {
        fetchData();
        loadBusinessProfile();
    }, []);

    // Handle Initial Data (Retargeting)
    useEffect(() => {
        if (initialData && templates.length > 0) {
            if (initialData.templateId) {
                const tpl = templates.find(t => t.id === initialData.templateId);
                if (tpl) setSelectedTemplate(tpl);
            }
            if (initialData.manualNumbers && initialData.manualNumbers.length > 0) {
                setRecipientType('manual');
                setManualInput(initialData.manualNumbers.join(', '));
            }
            if (initialData.title) {
                setCampaignTitle(initialData.title);
            }
        }
    }, [initialData, templates]);

    const loadBusinessProfile = async () => {
        try {
            const theme = await themeService.getTheme();
            setBusinessProfile(prev => ({
                ...prev,
                name: theme.appName || prev.name, // Keep existing if not in theme, or update if in theme
                logoUrl: theme.logoUrl || prev.logoUrl
            }));
        } catch (error) {
            console.error('Error loading business profile:', error);
        }
    };

    // Update business name from selected phone number if no custom branding
    useEffect(() => {
        if (selectedPhoneNumber && phoneNumbers.length > 0) {
            const account = phoneNumbers.find(p => p.phone_number_id === selectedPhoneNumber);
            if (account) {
                setBusinessProfile(prev => {
                    // Only update if the current name is generic or empty, OR if we want to prioritize the account name when no theme name exists.
                    // Better strategy: Check if theme has a name. If not, use account name.
                    // Since we can't easily check theme source here, we'll assume if it's "Your Business" or empty, we can override.
                    if (!prev.name || prev.name === 'Your Business') {
                        return { ...prev, name: account.name || 'Your Business' };
                    }
                    return prev;
                });
            }
        }
    }, [selectedPhoneNumber, phoneNumbers]);

    // Detect variables when template changes
    useEffect(() => {
        const vars = new Set<string>();

        if (selectedTemplate) {
            const components = selectedTemplate.components || [];

            // 1. Main Body
            const mainBodyComp = components.find((c: any) => c.type === 'BODY');
            const mainText = mainBodyComp?.text || selectedTemplate.body_text;

            if (mainText) {
                const matches = mainText.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                if (matches) matches.forEach((m: string) => vars.add(m.replace(/{{|}}/g, '')));
            }

            // 2. Standard Buttons (URL type)
            const buttonsComp = components.find((c: any) => c.type === 'BUTTONS');
            if (buttonsComp && buttonsComp.buttons) {
                buttonsComp.buttons.forEach((btn: any) => {
                    if (btn.type === 'URL' && btn.url) {
                        const matches = btn.url.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                        if (matches) matches.forEach((m: string) => vars.add(m.replace(/{{|}}/g, '')));
                    }
                });
            }

            // 3. Carousel Component (Body & Buttons)
            const carouselComp = components.find((c: any) => c.type === 'CAROUSEL');
            if (carouselComp && carouselComp.cards) {
                carouselComp.cards.forEach((card: any) => {
                    // Card Body
                    const bodyComp = card.components?.find((c: any) => c.type === 'BODY');
                    if (bodyComp && bodyComp.text) {
                        const matches = bodyComp.text.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                        if (matches) matches.forEach((m: string) => vars.add(m.replace(/{{|}}/g, '')));
                    }
                    // Card Buttons
                    const cardButtons = card.components?.find((c: any) => c.type === 'BUTTONS');
                    if (cardButtons && cardButtons.buttons) {
                        cardButtons.buttons.forEach((btn: any) => {
                            if (btn.type === 'URL' && btn.url) {
                                const matches = btn.url.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                                if (matches) matches.forEach((m: string) => vars.add(m.replace(/{{|}}/g, '')));
                            }
                        });
                    }
                });
            }
        }

        if (vars.size > 0) {
            const sortedVars = Array.from(vars).sort((a, b) => {
                const numA = parseInt(a) || 0;
                const numB = parseInt(b) || 0;
                return numA - numB;
            });
            setDetectedVariables(sortedVars);

            // Initialize mapping, preserving existing values
            setVariableMapping(prev => {
                const next: Record<string, string> = {};
                sortedVars.forEach(v => {
                    next[v] = prev[v] || '';
                });
                return next;
            });
        } else {
            setDetectedVariables([]);
            setVariableMapping({});
        }
    }, [selectedTemplate]);

    // Detect Header Type & Carousel Cards
    useEffect(() => {
        if (selectedTemplate) {
            let mainHeader = null;
            let cards: any[] = [];

            // Access Raw Components (live from Meta via my backend fix) or parsed local components
            const components = selectedTemplate.components || [];

            // 1. Detect Main Header
            const headerComp = components.find((c: any) => c.type === 'HEADER');
            if (headerComp && ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerComp.format?.toUpperCase())) {
                mainHeader = headerComp.format.toUpperCase();
            } else if (!components.length && selectedTemplate.template_type && ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(selectedTemplate.template_type.toUpperCase())) {
                mainHeader = selectedTemplate.template_type.toUpperCase();
            }

            // 2. Detect Carousel
            const carouselComp = components.find((c: any) => c.type === 'CAROUSEL' || c.type === 'MPM');
            if (carouselComp && carouselComp.cards) {
                cards = carouselComp.cards;
            } else if (selectedTemplate.buttons && selectedTemplate.buttons.type === 'MEDIA_CARD_CAROUSEL') {
                cards = selectedTemplate.buttons.cards || [];
            }

            // Set States
            setHeaderType(mainHeader);

            if (cards.length > 0) {
                setCarouselCards(cards);
                // Reset URLs only if length changes to avoid wiping inputs on re-render
                if (carouselMediaUrls.length !== cards.length) {
                    setCarouselMediaUrls(new Array(cards.length).fill(''));
                }
            } else {
                setCarouselCards([]);
                setCarouselMediaUrls([]);
            }

            // Reset generic media if header type changes
            if (!mainHeader) setMediaUrl('');

        } else {
            setHeaderType(null);
            setMediaUrl('');
            setCarouselCards([]);
            setCarouselMediaUrls([]);
        }
    }, [selectedTemplate]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                if (index !== undefined) {
                    setCarouselMediaUrls(prev => {
                        const newUrls = [...prev];
                        newUrls[index] = data.url;
                        return newUrls;
                    });
                } else {
                    setMediaUrl(data.url);
                }
                setToast({ type: 'success', title: 'Upload Success', message: 'File uploaded successfully' });
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            setToast({ type: 'error', title: 'Upload Failed', message: error.message });
        } finally {
            setUploading(false);
        }
    };

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const headers = { 'Authorization': `Bearer ${session.access_token}` };

            const [tplRes, grpRes, phRes, customFields] = await Promise.all([
                fetch('/api/whatsapp/templates', { headers }),
                fetch('/api/groups', { headers }),
                fetch('/api/settings/whatsapp', { headers }),
                inputFieldService.getInputs()
            ]);

            if (tplRes.ok) {
                const data = await tplRes.json();
                setTemplates(data.data || []);
            }
            if (grpRes.ok) {
                const data = await grpRes.json();
                setGroups(data || []);
            }
            if (phRes.ok) {
                const data = await phRes.json();
                setPhoneNumbers(data || []);
                if (data.length > 0) setSelectedPhoneNumber(data[0].phone_number_id);
            }

            // Merge Custom Fields (Always running to ensure even if empty we get defaults)
            const standardKeys = DEFAULT_CONTACT_FIELDS.map(d => d.value);
            const formattedCustom = (customFields || [])
                .filter((f: any) => !standardKeys.includes(f.name.toLowerCase()) && !['name', 'email', 'phone'].includes(f.name.toLowerCase()))
                .map((f: any) => ({
                    label: f.name,
                    value: f.is_implicit ? `custom_data.${f.name}` : `custom_data.${f.name}`
                }));

            // Deduplicate if needed (though map uses IDs generally, here we rely on value str)
            setAvailableFields([...DEFAULT_CONTACT_FIELDS, ...formattedCustom]);

        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedTemplate || !campaignTitle) {
            setToast({ type: 'error', title: 'Validation Error', message: 'Please fill in required fields.' });
            return;
        }

        if (recipientType === 'group' && !selectedGroup) {
            setToast({ type: 'error', title: 'Validation Error', message: 'Please select an audience group.' });
            return;
        }

        let processedManualNumbers: string[] = [];
        if (recipientType === 'manual') {
            if (!manualInput.trim()) {
                setToast({ type: 'error', title: 'Validation Error', message: 'Please paste at least one phone number.' });
                return;
            }
            // Split by comma or newline, trim, filter empty
            processedManualNumbers = manualInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

            // Validate: Must start with 91 and be 12 digits total
            // User requirement: "validate 91 ithere and 10 digight number validation"
            const invalidNumbers = processedManualNumbers.filter(num => !/^91\d{10}$/.test(num));

            if (invalidNumbers.length > 0) {
                setToast({
                    type: 'error',
                    title: 'Invalid Numbers',
                    message: `Found ${invalidNumbers.length} invalid numbers (e.g. ${invalidNumbers[0]}). Must start with 91 and be 12 digits.`
                });
                return;
            }
        }

        // Validate Carousel Media
        if (carouselCards.length > 0) {
            const missingMedia = carouselCards.some((_, idx) => !carouselMediaUrls[idx] || carouselMediaUrls[idx].trim() === '');
            if (missingMedia) {
                setToast({ type: 'error', title: 'Validation Error', message: 'Please upload media for all carousel cards.' });
                return;
            }
        }
        // Validate Main Header Media
        if (headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && !mediaUrl) {
            setToast({ type: 'error', title: 'Validation Error', message: `Please upload the ${headerType.toLowerCase()} for the header.` });
            return;
        }

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const payload = {
                title: campaignTitle,
                templateId: selectedTemplate.id,
                templateName: selectedTemplate.name,
                languageCode: selectedTemplate.language,

                recipientType, // 'group' or 'manual'
                contactGroupId: recipientType === 'group' ? selectedGroup : null,
                manualNumbers: recipientType === 'manual' ? processedManualNumbers : [],

                scheduledAt: sendNow ? null : scheduledAt,
                sendNow,
                phoneNumberId: selectedPhoneNumber,

                variableMapping,
                mediaUrl: headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) ? mediaUrl : null,
                carouselMediaUrls: carouselCards.length > 0 ? carouselMediaUrls : null,
                mediaType: headerType,
                locationHeader: headerType === 'LOCATION' ? locationHeader : null
            };

            const response = await fetch('/api/campaigns/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create campaign');
            }

            setToast({ type: 'success', title: 'Success', message: result.message });
            setTimeout(onBack, 2000);

        } catch (error: any) {
            setToast({ type: 'error', title: 'Error', message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-[var(--color-bg)] transition-colors duration-300">
            {/* Header */}
            <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-6 py-4 flex items-center gap-4 shrink-0 shadow-sm z-10">
                <button onClick={onBack} className="p-2 hover:bg-[var(--color-bg)] rounded-full text-[var(--color-text)] opacity-60 hover:opacity-100 transition-colors">
                    <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <h1 className="text-xl font-bold text-[var(--color-text)]">Create New Campaign</h1>
            </div>

            {/* Mobile Tabs */}
            <div className="md:hidden flex border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 z-10">
                <button
                    onClick={() => setActiveTab('form')}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'form' ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]' : 'text-[var(--color-text)] opacity-50'}`}
                >
                    Details
                </button>
                <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'preview' ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]' : 'text-[var(--color-text)] opacity-50'}`}
                >
                    Preview
                </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative">
                {/* Left Panel: Form */}
                <div className={`
                    w-full md:w-1/2 lg:w-3/5 h-full overflow-y-auto custom-scrollbar p-6 md:p-10 space-y-8 bg-[var(--color-bg)] transition-transform duration-300 absolute md:relative z-20
                    ${activeTab === 'form' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>

                    {/* Step 1: Template */}
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-brand)] text-white text-xs font-bold">1</span>
                            <h2 className="text-lg font-bold text-[var(--color-text)]">Select Template</h2>
                        </div>

                        <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-btn)] border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider mb-2">Template</label>
                                    {selectedTemplate ? (
                                        <div className="bg-[var(--color-bg)] p-3 rounded-lg border border-[var(--color-border)]">
                                            <p className="font-bold text-[var(--color-text)] text-lg">{selectedTemplate.name}</p>
                                            <div className="flex gap-4 mt-1">
                                                <p className="text-xs text-[var(--color-text)] opacity-60">Lang: <span className="font-mono">{selectedTemplate.language}</span></p>
                                                <p className="text-xs text-[var(--color-text)] opacity-60">Cat: <span className="font-bold">{selectedTemplate.category}</span></p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[var(--color-text)] opacity-40 italic py-2">No template selected</p>
                                    )}
                                </div>
                                <div className="w-full md:w-auto">
                                    <select
                                        className="w-full md:w-auto px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bold rounded-[var(--radius-btn)] hover:border-[var(--color-brand)] transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-[var(--color-brand)]/20"
                                        onChange={(e) => {
                                            const tpl = templates.find(t => t.id === e.target.value);
                                            setSelectedTemplate(tpl);
                                        }}
                                        value={selectedTemplate?.id || ''}
                                    >
                                        <option value="">Change Template</option>
                                        {templates.filter(t => t.status === 'APPROVED').map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Variable Mapping */}
                            {detectedVariables.length > 0 && (
                                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                                    <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider mb-4">Map Variables</label>
                                    <div className="grid grid-cols-1 gap-3">
                                        {detectedVariables.map(v => (
                                            <VariableInput
                                                key={v}
                                                variable={v}
                                                value={variableMapping[v] || ''}
                                                onChange={(val) => setVariableMapping(prev => ({ ...prev, [v]: val }))}
                                                options={availableFields}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Media Header & Carousel Card Inputs */}
                            {((headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType)) || carouselCards.length > 0) && (
                                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                                    <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider mb-4">
                                        Media Configuration
                                    </label>
                                    <div className="space-y-4">
                                        {/* Main Template Header Media */}
                                        {headerType && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerType) && (
                                            <div className="bg-[var(--color-bg)] p-4 rounded-lg border border-[var(--color-border)]">
                                                <label className="block text-xs font-bold text-[var(--color-text)] mb-2">
                                                    Header {headerType} <span className="text-red-500">*</span>
                                                </label>

                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="file"
                                                        accept={headerType === 'IMAGE' ? 'image/*' : headerType === 'VIDEO' ? 'video/*' : '.pdf'}
                                                        onChange={(e) => handleFileUpload(e)}
                                                        className="block w-full text-sm text-[var(--color-text)]
                                                        file:mr-4 file:py-2 file:px-4
                                                        file:rounded-full file:border-0
                                                        file:text-xs file:font-semibold
                                                        file:bg-[var(--color-brand)] file:text-white
                                                        hover:file:bg-[var(--color-brand)]/90
                                                        cursor-pointer"
                                                    />
                                                </div>
                                                {uploading && <p className="text-xs text-[var(--color-brand)] animate-pulse">Uploading...</p>}

                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={mediaUrl}
                                                        onChange={(e) => setMediaUrl(e.target.value)}
                                                        className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)] text-[var(--color-text)]"
                                                        placeholder={`Or enter direct URL...`}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Carousel Cards Media */}
                                        {carouselCards.length > 0 && (
                                            <div className="space-y-3">
                                                <p className="text-xs font-bold text-[var(--color-text)] opacity-70">Carousel Cards Media</p>
                                                {carouselCards.map((card, idx) => {
                                                    const headerComp = card.components?.find((c: any) => c.type === 'HEADER');
                                                    const cardFormat = headerComp?.format || card.header?.format || card.header?.type || 'IMAGE';

                                                    return (
                                                        <div key={idx} className="bg-[var(--color-bg)] p-4 rounded-lg border border-[var(--color-border)]">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <label className="block text-xs font-bold text-[var(--color-text)]">
                                                                    Card {idx + 1} Media <span className="text-red-500">*</span>
                                                                </label>
                                                                <span className="text-[10px] uppercase font-bold text-[var(--color-text)] opacity-50 bg-[var(--color-surface)] px-2 py-0.5 rounded">
                                                                    {cardFormat}
                                                                </span>
                                                            </div>

                                                            <div className="flex gap-2 mb-2">
                                                                <input
                                                                    type="file"
                                                                    accept={cardFormat === 'VIDEO' ? 'video/*' : 'image/*'}
                                                                    onChange={(e) => handleFileUpload(e, idx)}
                                                                    className="block w-full text-sm text-[var(--color-text)]
                                                                    file:mr-4 file:py-2 file:px-4
                                                                    file:rounded-full file:border-0
                                                                    file:text-xs file:font-semibold
                                                                    file:bg-[var(--color-brand)] file:text-white
                                                                    hover:file:bg-[var(--color-brand)]/90
                                                                    cursor-pointer"
                                                                />
                                                            </div>

                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={carouselMediaUrls[idx] || ''}
                                                                    onChange={(e) => {
                                                                        const val = e.target.value;
                                                                        setCarouselMediaUrls(prev => {
                                                                            const newUrls = [...prev];
                                                                            newUrls[idx] = val;
                                                                            return newUrls;
                                                                        });
                                                                    }}
                                                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)] text-[var(--color-text)]"
                                                                    placeholder={`Or enter direct URL for Card ${idx + 1}...`}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Location Header Input */}
                            {headerType === 'LOCATION' && (
                                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                                    <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider mb-4">
                                        Location Header
                                    </label>
                                    <div className="bg-[var(--color-bg)] p-4 rounded-lg border border-[var(--color-border)] space-y-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Latitude</label>
                                                <input
                                                    type="text"
                                                    value={locationHeader.latitude}
                                                    onChange={(e) => setLocationHeader(prev => ({ ...prev, latitude: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)]"
                                                    placeholder="e.g. 37.7749"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Longitude</label>
                                                <input
                                                    type="text"
                                                    value={locationHeader.longitude}
                                                    onChange={(e) => setLocationHeader(prev => ({ ...prev, longitude: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)]"
                                                    placeholder="e.g. -122.4194"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Location Name</label>
                                            <input
                                                type="text"
                                                value={locationHeader.name}
                                                onChange={(e) => setLocationHeader(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)]"
                                                placeholder="e.g. Meta HQ"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Address</label>
                                            <input
                                                type="text"
                                                value={locationHeader.address}
                                                onChange={(e) => setLocationHeader(prev => ({ ...prev, address: e.target.value }))}
                                                className="w-full px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm outline-none focus:border-[var(--color-brand)]"
                                                placeholder="e.g. 1 Hacker Way, Menlo Park, CA"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Contacts & Schedule */}
                    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-brand)] text-white text-xs font-bold">2</span>
                            <h2 className="text-lg font-bold text-[var(--color-text)]">Campaign Details</h2>
                        </div>

                        <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-btn)] border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow space-y-6">
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Campaign Title</label>
                                <input
                                    type="text"
                                    value={campaignTitle}
                                    onChange={(e) => setCampaignTitle(e.target.value)}
                                    className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-btn)] focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none transition-all text-[var(--color-text)] placeholder-[var(--color-text)]/30"
                                    placeholder="Enter campaign title..."
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Recipients</label>

                                <div className="flex items-center gap-6 mb-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${recipientType === 'group' ? 'border-[var(--color-brand)]' : 'border-[var(--color-text)] opacity-40'}`}>
                                            {recipientType === 'group' && <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
                                        </div>
                                        <input
                                            type="radio"
                                            checked={recipientType === 'group'}
                                            onChange={() => setRecipientType('group')}
                                            className="hidden"
                                        />
                                        <span className={`text-sm font-bold ${recipientType === 'group' ? 'text-[var(--color-brand)]' : 'text-[var(--color-text)] opacity-60'} group-hover:opacity-100 transition-opacity`}>Select Group</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${recipientType === 'manual' ? 'border-[var(--color-brand)]' : 'border-[var(--color-text)] opacity-40'}`}>
                                            {recipientType === 'manual' && <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
                                        </div>
                                        <input
                                            type="radio"
                                            checked={recipientType === 'manual'}
                                            onChange={() => setRecipientType('manual')}
                                            className="hidden"
                                        />
                                        <span className={`text-sm font-bold ${recipientType === 'manual' ? 'text-[var(--color-brand)]' : 'text-[var(--color-text)] opacity-60'} group-hover:opacity-100 transition-opacity`}>Paste Numbers</span>
                                    </label>
                                </div>

                                {recipientType === 'group' ? (
                                    <div className="space-y-1">
                                        <select
                                            value={selectedGroup}
                                            onChange={(e) => setSelectedGroup(e.target.value)}
                                            className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-btn)] focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none transition-all appearance-none text-[var(--color-text)]"
                                        >
                                            <option value="">Select Contacts Group</option>
                                            <option value="all">All Contacts</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <textarea
                                            value={manualInput}
                                            onChange={(e) => setManualInput(e.target.value)}
                                            placeholder="e.g. 919876543210, 918888888888"
                                            rows={4}
                                            className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-btn)] focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none transition-all text-sm font-mono text-[var(--color-text)] placeholder-[var(--color-text)]/30 resize-none"
                                        />
                                        <p className="text-xs text-[var(--color-text)] opacity-50">
                                            Enter comma separated numbers. Must include 91 prefix (12 digits total).
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-[var(--color-bg)] rounded-[var(--radius-btn)] border border-[var(--color-border)]">
                                <input
                                    type="checkbox"
                                    id="restrictLang"
                                    checked={restrictLanguage}
                                    onChange={(e) => setRestrictLanguage(e.target.checked)}
                                    className="w-4 h-4 text-[var(--color-brand)] rounded focus:ring-[var(--color-brand)] border-[var(--color-border)]"
                                />
                                <label htmlFor="restrictLang" className="text-sm text-[var(--color-text)] opacity-80 cursor-pointer select-none">Restrict by Language Code (Send only to matching contacts)</label>
                            </div>

                            <div className="space-y-3 p-4 bg-[var(--color-bg)] rounded-[var(--radius-btn)] border border-[var(--color-border)]">
                                <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Schedule</label>
                                <div className="flex items-center gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${sendNow ? 'border-[var(--color-brand)]' : 'border-[var(--color-text)] opacity-40'}`}>
                                            {sendNow && <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
                                        </div>
                                        <input
                                            type="radio"
                                            checked={sendNow}
                                            onChange={() => setSendNow(true)}
                                            className="hidden"
                                        />
                                        <span className={`text-sm font-bold ${sendNow ? 'text-[var(--color-brand)]' : 'text-[var(--color-text)] opacity-60'} group-hover:opacity-100 transition-opacity`}>Send Now</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!sendNow ? 'border-[var(--color-brand)]' : 'border-[var(--color-text)] opacity-40'}`}>
                                            {!sendNow && <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />}
                                        </div>
                                        <input
                                            type="radio"
                                            checked={!sendNow}
                                            onChange={() => setSendNow(false)}
                                            className="hidden"
                                        />
                                        <span className={`text-sm font-bold ${!sendNow ? 'text-[var(--color-brand)]' : 'text-[var(--color-text)] opacity-60'} group-hover:opacity-100 transition-opacity`}>Schedule for Later</span>
                                    </label>
                                </div>
                                {!sendNow && (
                                    <input
                                        type="datetime-local"
                                        value={scheduledAt}
                                        onChange={(e) => setScheduledAt(e.target.value)}
                                        className="w-full px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[calc(var(--radius-btn)-4px)] text-sm mt-2 text-[var(--color-text)] focus:border-[var(--color-brand)] outline-none"
                                    />
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-[var(--color-text)] opacity-50 uppercase tracking-wider">Sender Phone Number</label>
                                <select
                                    value={selectedPhoneNumber}
                                    onChange={(e) => setSelectedPhoneNumber(e.target.value)}
                                    className="w-full px-4 py-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-btn)] focus:ring-2 focus:ring-[var(--color-brand)]/20 focus:border-[var(--color-brand)] outline-none transition-all appearance-none text-[var(--color-text)]"
                                >
                                    {phoneNumbers.map(p => (
                                        <option key={p.id} value={p.phone_number_id}>{p.phone_number || p.phone_number_id}</option>
                                    ))}
                                    {phoneNumbers.length === 0 && <option value="">No connected numbers</option>}
                                </select>
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`w-full py-4 bg-[var(--color-brand)] hover:opacity-90 text-white rounded-[var(--radius-btn)] font-bold shadow-lg shadow-[var(--color-brand)]/30 transition-all transform hover:-translate-y-0.5 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSubmitting ? 'Processing...' : (sendNow ? '🚀 Launch Campaign' : '📅 Schedule Campaign')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className={`
                    w-full md:w-1/2 lg:w-2/5 bg-[var(--color-surface)] border-l border-[var(--color-border)] p-6 md:flex flex-col items-center justify-center absolute md:relative h-full z-20 transition-transform duration-300
                    ${activeTab === 'preview' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}>
                    <div className="mb-6 text-center">
                        <span className="px-4 py-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-bold rounded-full shadow-sm">
                            Live Preview
                        </span>
                    </div>

                    <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                        {selectedTemplate ? (
                            (() => {
                                // Dynamic Preview Action Reconstruction
                                let previewActions = selectedTemplate.buttons;
                                const components = selectedTemplate.components || [];

                                try {
                                    const carouselComp = components.find((c: any) => c.type === 'CAROUSEL');
                                    const buttonsComp = components.find((c: any) => c.type === 'BUTTONS');

                                    if (carouselComp) {
                                        const cards = (carouselComp.cards || []).map((card: any) => {
                                            let cardBody = '';
                                            let cardButtons: any[] = [];
                                            let cardHeaderFormat = 'IMAGE';

                                            if (Array.isArray(card.components)) {
                                                const b = card.components.find((cc: any) => cc.type === 'BODY');
                                                if (b) cardBody = b.text;
                                                const h = card.components.find((cc: any) => cc.type === 'HEADER');
                                                if (h) cardHeaderFormat = h.format;
                                                const btns = card.components.find((cc: any) => cc.type === 'BUTTONS');
                                                if (btns && btns.buttons) {
                                                    cardButtons = btns.buttons.map((btn: any) => ({
                                                        type: btn.type,
                                                        text: btn.text,
                                                        url: btn.url,
                                                        phone_number: btn.phone_number
                                                    }));
                                                }
                                            }
                                            // Fallback for header format
                                            if (cardHeaderFormat === 'IMAGE' && card.header?.format === 'VIDEO') cardHeaderFormat = 'VIDEO';

                                            return {
                                                header: { format: cardHeaderFormat },
                                                body: cardBody,
                                                buttons: cardButtons
                                            };
                                        });
                                        previewActions = { type: 'MEDIA_CARD_CAROUSEL', cards };
                                    } else if (buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0) {
                                        const btns = buttonsComp.buttons;
                                        const hasQuickReply = btns.some((b: any) => b.type === 'QUICK_REPLY');
                                        const hasCta = btns.some((b: any) => b.type === 'URL' || b.type === 'PHONE_NUMBER');
                                        const hasFlow = btns.some((b: any) => b.type === 'FLOW');

                                        if (hasQuickReply && hasCta) previewActions = { type: 'ALL', buttons: btns };
                                        else if (hasQuickReply) previewActions = { type: 'QUICK_REPLY', buttons: btns };
                                        else if (hasCta) previewActions = { type: 'CALL_TO_ACTION', buttons: btns };
                                        else if (hasFlow) previewActions = { type: 'FORM', buttons: btns };
                                    }
                                } catch (e) {
                                    console.error('Error reconstructing preview actions:', e);
                                }

                                return (
                                    <TemplatePreview
                                        type={selectedTemplate.template_type || 'TEXT'}
                                        header={selectedTemplate.header_text}
                                        body={selectedTemplate.body_text}
                                        footer={selectedTemplate.footer_text}
                                        actions={previewActions}
                                        language={selectedTemplate.language}
                                        companyName={businessProfile.name}
                                        logoUrl={businessProfile.logoUrl}
                                        mediaUrl={mediaUrl}
                                        carouselMediaUrls={carouselMediaUrls}
                                        locationHeader={locationHeader}
                                    />
                                );
                            })()
                        ) : (
                            <div className="flex flex-col items-center justify-center text-[var(--color-text)] opacity-40">
                                <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg)] border-2 border-dashed border-[var(--color-border)] flex items-center justify-center mb-4">
                                    <span className="text-2xl">📱</span>
                                </div>
                                <p className="text-sm font-medium">Select a template to preview</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 p-4 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] text-xs rounded-[var(--radius-btn)] max-w-sm text-center opacity-70">
                        <p><strong>Note:</strong> Variables like <span className="font-mono bg-[var(--color-surface)] px-1 rounded">{'{{1}}'}</span> will be replaced with actual contact data when sent.</p>
                    </div>
                </div>
            </div>
            {toast && <Toast type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(null)} />}
        </div >
    );
};

export default CreateCampaign;
