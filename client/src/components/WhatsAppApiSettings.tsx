
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CodeIcon, MessageIcon, CopyIcon, ChevronDownIcon, ChevronRightIcon } from './icons';

interface TemplateComponent {
    type: string;
    format?: string;
    text?: string;
    buttons?: any[];
    cards?: {
        components: TemplateComponent[];
    }[];
}

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    status: string;
    components: TemplateComponent[];
    buttons?: any[];
    template_type?: string;
    header_text?: string;
    body_text?: string;
}

// Helper types for our form state
interface ParamField {
    id: string;
    type: 'text' | 'image' | 'video' | 'document' | 'audio' | 'payload';
    label: string;
    value: string;
    // Context mapping
    componentType: 'HEADER' | 'BODY' | 'BUTTON' | 'CAROUSEL';
    cardIndex?: number; // For carousel cards
    buttonIndex?: number;
    subType?: string; // url, quick_reply, etc.
}

const WhatsAppApiSettings: React.FC = () => {
    // ... rest of the file

    const [mode, setMode] = useState<'transactional' | 'campaign'>('transactional');

    // Data
    const [templates, setTemplates] = useState<Template[]>([]);
    const [groups, setGroups] = useState<{ id: string, name: string }[]>([]);

    // Shared State
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [params, setParams] = useState<ParamField[]>([]);
    const [token, setToken] = useState('');

    // Transactional Specific
    const [phoneNumber, setPhoneNumber] = useState('');

    // Campaign Specific
    const [campaignTitle, setCampaignTitle] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [sendNow, setSendNow] = useState(true);
    const [scheduledAt, setScheduledAt] = useState('');

    // UI State
    const [activeTab, setActiveTab] = useState<'curl' | 'python' | 'java' | 'csharp'>('curl');
    const [showTestCode, setShowTestCode] = useState(false); // Toggle to show test payload in campaign mode
    const [sending, setSending] = useState(false);
    const [response, setResponse] = useState<any>(null);
    const [mobileTab, setMobileTab] = useState<'builder' | 'code'>('builder'); // New mobile tab state

    const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        details: true,
        template: true,
        header: true,
        body: true,
        carousel: false, // Collapsed by default to save space
        buttons: true
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const renderCollapsibleHeader = (title: string, sectionKey: string, count?: number) => (
        <button
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center justify-between w-full px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors border-b border-slate-200 first:rounded-t-lg group"
        >
            <div className="flex items-center gap-2">
                <span className={`transform transition-transform duration-200 text-slate-400 group-hover:text-slate-600 ${expandedSections[sectionKey] ? 'rotate-90' : ''}`}>
                    <ChevronRightIcon className="w-3 h-3" />
                </span>
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{title}</span>
                {count !== undefined && count > 0 && (
                    <span className="ml-1 bg-slate-200 text-slate-600 text-[9px] font-bold px-1.5 rounded-full">{count}</span>
                )}
            </div>
        </button>
    );

    useEffect(() => {
        fetchTemplates();
        fetchGroups();
        fetchSession();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, paramId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingState(prev => ({ ...prev, [paramId]: true }));
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
                updateParam(paramId, data.url);
            } else {
                setResponse({ error: data.error || 'Upload failed' });
            }
        } catch (error: any) {
            setResponse({ error: error.message });
        } finally {
            setUploadingState(prev => ({ ...prev, [paramId]: false }));
        }
    };

    const fetchSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setToken(session.access_token);
    }

    const fetchTemplates = async () => {
        const { data, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('status', 'APPROVED')
            .order('name');

        if (data) setTemplates(data);
    };

    const fetchGroups = async () => {
        const { data, error } = await supabase.from('contact_groups').select('id, name');
        if (data) setGroups(data);
    };

    const handleTemplateSelect = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tmplId = e.target.value;
        if (!tmplId) {
            setSelectedTemplate(null);
            setParams([]);
            return;
        }

        // 1. Initial set from local list (fast feedback)
        let tmpl = templates.find(t => t.id === tmplId);
        if (tmpl) setSelectedTemplate(tmpl);

        // 2. Fetch Full Details from Backend (Accurate Components from Meta)
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const res = await fetch(`/api/whatsapp/templates/${tmplId}`, {
                    headers: { 'Authorization': `Bearer ${session.access_token}` }
                });
                if (res.ok) {
                    const fullData = await res.json();
                    if (fullData && fullData.components) {
                        console.log('[Playground] Fetched live components for:', fullData.name);
                        tmpl = fullData;
                        setSelectedTemplate(fullData);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching template details:', err);
        }

        console.log('[Playground] Selected Template (Final):', tmpl);
        if (tmpl) parseTemplateParams(tmpl);
        else setParams([]);
    };
    const parseTemplateParams = (tmpl: Template) => {
        const newParams: ParamField[] = [];
        // Distinguish between empty array (valid, no components) and undefined (legacy/missing)
        const componentsRaw = tmpl.components;
        const components: any[] = componentsRaw || [];

        // --- 1. HEADER PARSING ---
        // Try finding HEADER component first
        const headerComp = components.find((c: any) => c.type === 'HEADER');
        let headerFormat = headerComp?.format;

        // Fallback: If no component format, check top-level properties (handling legacy structures)
        // STRICT CHECK: Only fall back to template_type if components property is MISSING (undefined/null).
        // If it sends an empty array [], we assume it's a standard template with no parameters.
        if (!headerFormat && !componentsRaw && (tmpl as any).template_type && ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes((tmpl as any).template_type.toUpperCase())) {
            headerFormat = (tmpl as any).template_type.toUpperCase();
        }

        // Check if template is a Carousel/MPM
        const isCarousel = components.some((c: any) => c.type === 'CAROUSEL' || c.type === 'MPM') || (tmpl as any).buttons?.type === 'MEDIA_CARD_CAROUSEL';

        if (headerFormat) {
            headerFormat = headerFormat.toUpperCase();

            if (['IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO'].includes(headerFormat)) {
                newParams.push({
                    id: `header-media`,
                    type: headerFormat.toLowerCase() as any,
                    label: `Header ${headerFormat} URL`,
                    value: '',
                    componentType: 'HEADER'
                });
            } else if (headerFormat === 'TEXT' && headerComp?.text) {
                const matches = headerComp.text.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                if (matches) {
                    const vars = Array.from(new Set(matches)) as string[];
                    vars.forEach((v) => {
                        const cleanV = v.replace(/{{|}}/g, '');
                        newParams.push({
                            id: `header-text-${cleanV}`,
                            type: 'text',
                            label: `Header Variable {{${cleanV}}}`,
                            value: '',
                            componentType: 'HEADER'
                        });
                    });
                }
            }
        }

        // --- 2. BODY PARSING ---
        const bodyComp = components.find((c: any) => c.type === 'BODY');
        if (bodyComp?.text) {
            const matches = bodyComp.text.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
            if (matches) {
                const vars = Array.from(new Set(matches)) as string[];
                vars.forEach((v) => {
                    const cleanV = v.replace(/{{|}}/g, '');
                    newParams.push({
                        id: `body-${cleanV}`,
                        type: 'text',
                        label: `Body Variable {{${cleanV}}}`,
                        value: '',
                        componentType: 'BODY'
                    });
                });
            }
        } else if ((tmpl as any).body_text) {
            // Fallback to top-level body_text
            const matches = (tmpl as any).body_text.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
            if (matches) {
                const vars = Array.from(new Set(matches)) as string[];
                vars.forEach((v) => {
                    const cleanV = v.replace(/{{|}}/g, '');
                    newParams.push({
                        id: `body-${cleanV}`,
                        type: 'text',
                        label: `Body Variable {{${cleanV}}}`,
                        value: '',
                        componentType: 'BODY'
                    });
                });
            }
        }

        // --- 3. BUTTONS PARSING ---
        let buttonsComp = components.find((c: any) => c.type === 'BUTTONS');
        let buttonsToParse = buttonsComp?.buttons;

        // Fallback to local 'buttons' column if not found in components
        if (!buttonsToParse && (tmpl as any).buttons && Array.isArray((tmpl as any).buttons)) {
            buttonsToParse = (tmpl as any).buttons;
        }

        if (buttonsToParse) {
            buttonsToParse.forEach((btn: any, idx: number) => {
                if (btn.type === 'URL' && btn.url) {
                    const matches = btn.url.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                    if (matches) {
                        newParams.push({
                            id: `btn-${idx}`,
                            type: 'text',
                            label: `Button ${idx + 1} (URL Suffix)`,
                            value: '',
                            componentType: 'BUTTON',
                            buttonIndex: idx,
                            subType: 'url'
                        });
                    }
                }
                if (btn.type === 'QUICK_REPLY') {
                    // Still optional for standard, but allow payload
                    newParams.push({
                        id: `btn-payload-${idx}`,
                        type: 'payload',
                        label: `Button ${idx + 1} (Payload - Optional)`,
                        value: '',
                        componentType: 'BUTTON',
                        buttonIndex: idx,
                        subType: 'quick_reply'
                    });
                }
                if (btn.type === 'FLOW') {
                    newParams.push({
                        id: `btn-flow-${idx}`,
                        type: 'text',
                        label: `Button ${idx + 1} (Flow Token)`,
                        value: btn.flow_id || 'unused_token',
                        componentType: 'BUTTON',
                        buttonIndex: idx,
                        subType: 'flow_token'
                    });
                }
            });
        }

        // --- 4. CAROUSEL PARSING ---
        // Enhanced detection for legacy & variable structures
        let carouselCards: any[] = [];
        const carouselComp = components.find((c: any) => c.type === 'CAROUSEL' || c.type === 'MPM');

        if (carouselComp && carouselComp.cards) {
            carouselCards = carouselComp.cards;
        } else if ((tmpl as any).buttons?.type === 'MEDIA_CARD_CAROUSEL') {
            // Legacy Carousel support
            carouselCards = (tmpl as any).buttons.cards || [];
        }

        if (carouselCards.length > 0) {
            carouselCards.forEach((card: any, cardIndex: number) => {
                const cardComponents = card.components || [];

                // 1. Detect Media Header
                const cardHeader = cardComponents.find((c: any) => c.type === 'HEADER');
                // Robust check: component format -> header obj format -> header obj type -> default IMAGE
                let cardFormat = cardHeader?.format || card.header?.format || card.header?.type || 'IMAGE';

                if (cardFormat && ['IMAGE', 'VIDEO'].includes(cardFormat.toUpperCase())) {
                    newParams.push({
                        id: `card-${cardIndex}-header`,
                        type: cardFormat.toLowerCase() as any,
                        label: `Card ${cardIndex + 1} Header (${cardFormat})`,
                        value: '',
                        componentType: 'CAROUSEL',
                        cardIndex: cardIndex,
                        subType: 'header'
                    });
                }

                // 2. Detect Body Variables
                const cardBody = cardComponents.find((c: any) => c.type === 'BODY');
                if (cardBody && cardBody.text) {
                    const matches = cardBody.text.match(/{{(\d+|[a-zA-Z0-9_]+)}}/g);
                    if (matches) {
                        const vars = Array.from(new Set(matches)) as string[];
                        vars.forEach((v) => {
                            const cleanV = v.replace(/{{|}}/g, '');
                            newParams.push({
                                id: `card-${cardIndex}-body-${cleanV}`,
                                type: 'text',
                                label: `Card ${cardIndex + 1} Body {{${cleanV}}}`,
                                value: '',
                                componentType: 'CAROUSEL',
                                cardIndex: cardIndex,
                                subType: 'body'
                            });
                        });
                    }
                }

                // 3. Detect Buttons
                const cardButtonsComp = cardComponents.find((c: any) => c.type === 'BUTTONS');
                const buttonsToParse = cardButtonsComp?.buttons || card.buttons || [];

                buttonsToParse.forEach((btn: any, btnIdx: number) => {
                    const btnType = (btn.type || 'QUICK_REPLY').toUpperCase();

                    if (btnType === 'URL' && btn.url && /\{\{\d+\}\}/.test(btn.url)) {
                        newParams.push({
                            id: `card-${cardIndex}-btn-${btnIdx}`,
                            type: 'text',
                            label: `Card ${cardIndex + 1} Button ${btnIdx + 1} (URL Suffix)`,
                            value: '',
                            componentType: 'CAROUSEL',
                            cardIndex: cardIndex,
                            buttonIndex: btnIdx,
                            subType: 'button_url'
                        });
                    } else if (btnType === 'QUICK_REPLY') {
                        newParams.push({
                            id: `card-${cardIndex}-btn-payload-${btnIdx}`,
                            type: 'payload',
                            label: `Card ${cardIndex + 1} Button ${btnIdx + 1} (Payload)`,
                            value: '',
                            componentType: 'CAROUSEL',
                            cardIndex: cardIndex,
                            buttonIndex: btnIdx,
                            subType: 'button_payload'
                        });
                    }
                });
            });
        }

        setParams(newParams);
    };

    const updateParam = (id: string, val: string) => {
        setParams(prev => prev.map(p => p.id === id ? { ...p, value: val } : p));
    };

    /**
     * Generates payload for Transactional (Single Message)
     * REFACTORED: Adopts 'CampaignWorker' logic to robustly construct components 
     * based on local DB columns (template_type, buttons) when standard components are missing.
     */
    const generateTransactionalPayload = () => {
        if (!selectedTemplate) return {};

        const components: any[] = [];
        const tmpl = selectedTemplate as any;

        // 1. HEADER CONSTRUCTION
        // Strategy: Trust 'template_type' from DB, just like CampaignWorker
        const isMediaTemplate = ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(tmpl.template_type?.toUpperCase());
        const headerMediaParam = params.find(p => p.componentType === 'HEADER' && p.type !== 'text');

        if (isMediaTemplate && headerMediaParam && headerMediaParam.value) {
            components.push({
                type: 'header',
                parameters: [
                    {
                        type: headerMediaParam.type,
                        [headerMediaParam.type]: { link: headerMediaParam.value }
                    }
                ]
            });
        } else if (tmpl.template_type === 'TEXT' || tmpl.header_text) {
            const headerTextParams = params.filter(p => p.componentType === 'HEADER' && p.type === 'text');
            if (headerTextParams.length > 0) {
                components.push({
                    type: 'header',
                    parameters: headerTextParams.map(p => ({
                        type: 'text',
                        text: p.value
                    }))
                });
            }
        }

        // 2. BODY CONSTRUCTION
        const bodyVars = params.filter(p => p.componentType === 'BODY');
        if (bodyVars.length > 0) {
            components.push({ type: 'body', parameters: bodyVars.map(p => ({ type: 'text', text: p.value })) });
        }

        // 3. BUTTONS CONSTRUCTION
        // Strategy: Iterate LOCAL BUTTONS definition (tmpl.buttons) to ensure structure compliance
        // This fixes missing FLOW buttons and ensures correct indexing
        let buttonsDef = tmpl.buttons;

        // If buttons not in top-level, try components (fallback)
        if (!buttonsDef || !Array.isArray(buttonsDef)) {
            const buttonsComp = tmpl.components?.find((c: any) => c.type === 'BUTTONS');
            if (buttonsComp) buttonsDef = buttonsComp.buttons;
        }

        if (buttonsDef && Array.isArray(buttonsDef)) {
            buttonsDef.forEach((btn: any, index: number) => {
                const btnType = (btn.type || 'QUICK_REPLY').toUpperCase();

                if (btnType === 'FLOW') {
                    // Always add FLOW button, use param value if exists, else default from definition
                    const flowParam = params.find(p => p.componentType === 'BUTTON' && p.buttonIndex === index && p.subType === 'flow_token');
                    components.push({
                        type: "button",
                        sub_type: "flow",
                        index: index,
                        parameters: [
                            {
                                type: "action",
                                action: {
                                    flow_token: flowParam?.value || btn.flow_id || 'unused_token'
                                }
                            }
                        ]
                    });
                } else if (btnType === 'URL') {
                    const urlParam = params.find(p => p.componentType === 'BUTTON' && p.buttonIndex === index && p.subType === 'url');
                    if (urlParam && urlParam.value) {
                        components.push({ type: 'button', sub_type: 'url', index: index, parameters: [{ type: 'text', text: urlParam.value }] });
                    }
                } else if (btnType === 'QUICK_REPLY') {
                    const qrParam = params.find(p => p.componentType === 'BUTTON' && p.buttonIndex === index && p.subType === 'quick_reply');
                    if (qrParam && qrParam.value) {
                        components.push({ type: 'button', sub_type: 'quick_reply', index: index, parameters: [{ type: 'payload', payload: qrParam.value }] });
                    }
                }
            });
        }

        // 4. CAROUSEL (Simplified Transfer)
        const carouselCards = params.filter(p => p.componentType === 'CAROUSEL');
        if (carouselCards.length > 0) {
            const cards: any[] = [];
            // Logic simplified: we group params by card index
            const uniqueIndices = Array.from(new Set(carouselCards.map(p => p.cardIndex)));
            uniqueIndices.forEach((idx: any) => {
                const cardComp: any = { card_index: idx, components: [] };

                // Header
                const h = carouselCards.find(p => p.cardIndex === idx && p.subType === 'header');
                if (h) cardComp.components.push({ type: 'header', parameters: [{ type: h.type, [h.type]: { link: h.value } }] });

                // Body
                const b = carouselCards.filter(p => p.cardIndex === idx && p.subType === 'body');
                if (b.length) cardComp.components.push({ type: 'body', parameters: b.map(v => ({ type: 'text', text: v.value })) });

                // Buttons (We should really check definitions here too, but trusting params for now for legacy compat)
                // Ideally we'd iterate definitions likr above.
                const btns = carouselCards.filter(p => p.cardIndex === idx && (p.subType === 'button_url' || p.subType === 'button_payload'));
                btns.forEach(bp => {
                    if (bp.subType === 'button_url') cardComp.components.push({ type: 'button', sub_type: 'url', index: bp.buttonIndex, parameters: [{ type: 'text', text: bp.value }] });
                    if (bp.subType === 'button_payload') cardComp.components.push({ type: 'button', sub_type: 'quick_reply', index: bp.buttonIndex, parameters: [{ type: 'payload', payload: bp.value }] });
                });

                cards.push(cardComp);
            });
            components.push({ type: 'carousel', cards });
        }

        return {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneNumber,
            type: "template",
            template: {
                name: selectedTemplate.name,
                language: { code: selectedTemplate.language },
                components: components
            }
        };
    };

    /**
     * Generates payload for Campaign Creation
     * Maps the 'params' extracted from template to the specific 'variableMapping' format required by the Campaigns API
     */
    const generateCampaignPayload = () => {
        if (!selectedTemplate) return {};

        const variableMapping: any = {};

        // Body Vars (e.g. {{1}}, {{2}})
        const bodyVars = params.filter(p => p.componentType === 'BODY');
        bodyVars.forEach((p, idx) => {
            variableMapping[(idx + 1).toString()] = p.value; // Maps "1": "value", "2": "value"
        });

        // Header Text
        const headerText = params.find(p => p.componentType === 'HEADER' && p.type === 'text');
        if (headerText) {
            variableMapping['header_text_1'] = headerText.value;
        }

        // Button URL vars
        const btnUrlVars = params.filter(p => p.componentType === 'BUTTON' && p.subType === 'url');
        btnUrlVars.forEach((p, idx) => {
            // The Campaign API expects button variables often as mapped by index or specific naming convention
            // Assuming standard convention: button_url_{index}
            variableMapping[`button_url_${p.buttonIndex}`] = p.value;
        });

        // Carousel Medias require special array
        const carouselHeaders = params.filter(p => p.componentType === 'CAROUSEL' && p.subType === 'header');
        let carouselMediaUrls: string[] = [];
        if (carouselHeaders.length > 0) {
            // Sort by card index
            carouselMediaUrls = carouselHeaders.sort((a, b) => (a.cardIndex || 0) - (b.cardIndex || 0)).map(p => p.value);
        }

        const payload: any = {
            title: campaignTitle,
            templateId: selectedTemplate.id,
            templateName: selectedTemplate.name,
            languageCode: selectedTemplate.language,
            contactGroupId: selectedGroupId || 'all',
            sendNow: sendNow,
            scheduledAt: sendNow ? null : scheduledAt,
            variableMapping: variableMapping, // Simple key-value map
        };

        // Header Media
        const headerMedia = params.find(p => p.componentType === 'HEADER' && p.type !== 'text');
        if (headerMedia) {
            payload.mediaUrl = headerMedia.value;
            payload.mediaType = headerMedia.type.toUpperCase();
        }

        if (carouselMediaUrls.length > 0) {
            payload.carouselMediaUrls = carouselMediaUrls;
        }

        return payload;
    };


    const getCodeSnippet = (lang: string) => {
        // If showTestCode is true, we show transactional payload even in campaign mode
        const isCampaign = mode === 'campaign' && !showTestCode;
        const url = isCampaign
            ? `${window.location.origin}/api/campaigns/create`
            : `${window.location.origin}/api/external/send-template`;

        const jsonPayload = isCampaign ? generateCampaignPayload() : generateTransactionalPayload();
        const jsonString = JSON.stringify(jsonPayload, null, 2);

        if (lang === 'curl') {
            return `curl -X POST "${url}" \\
  -H "Authorization: Bearer ${token}" \\
  -H "Content-Type: application/json" \\
  -d '${jsonString}'`;
        }
        if (lang === 'python') {
            return `import requests\n\nurl = "${url}"\nheaders = {\n    "Authorization": "Bearer ${token}",\n    "Content-Type": "application/json"\n}\ndata = ${jsonString}\n\nresponse = requests.post(url, headers=headers, json=data)\nprint(response.json())`;
        }
        if (lang === 'java') {
            return `// Java example using HttpClient (Java 11+)\nimport java.net.URI;\nimport java.net.http.HttpClient;\nimport java.net.http.HttpRequest;\nimport java.net.http.HttpResponse;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        String json = ${JSON.stringify(jsonString)};\n        \n        HttpClient client = HttpClient.newHttpClient();\n        HttpRequest request = HttpRequest.newBuilder()\n            .uri(URI.create("${url}"))\n            .header("Authorization", "Bearer ${token}")\n            .header("Content-Type", "application/json")\n            .POST(HttpRequest.BodyPublishers.ofString(json))\n            .build();\n\n        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\n        System.out.println(response.body());\n    }\n}`;
        }
        if (lang === 'csharp') {
            return `using System;\nusing System.Net.Http;\nusing System.Text;\nusing System.Threading.Tasks;\n\nclass Program {\n    static async Task Main(String[] args) {\n        using (var client = new HttpClient()) {\n            client.DefaultRequestHeaders.Add("Authorization", "Bearer ${token}");\n            \n            var json = ${JSON.stringify(jsonString)};\n            var content = new StringContent(json, Encoding.UTF8, "application/json");\n            \n            var response = await client.PostAsync("${url}", content);\n            var result = await response.Content.ReadAsStringAsync();\n            Console.WriteLine(result);\n        }\n    }\n}`;
        }
        return '';
    };

    const sendTestRequest = async (forceTransactional = false) => {
        setSending(true);
        setResponse(null);
        try {
            const isCampaign = mode === 'campaign' && !forceTransactional;
            const endpoint = isCampaign ? '/api/campaigns/create' : '/api/external/send-template';
            let payload: any = isCampaign ? generateCampaignPayload() : generateTransactionalPayload();

            // Adapt payload for internal /api/external/send-template endpoint which expects specific flat fields
            if (!isCampaign && payload.template) {
                payload = {
                    to: payload.to,
                    templateName: payload.template.name,
                    language: payload.template.language?.code,
                    components: payload.template.components || []
                };
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setResponse(data);
        } catch (e: any) {
            setResponse({ error: e.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex-1 h-full bg-slate-50/30 overflow-hidden flex flex-col">
            {/* Ultra Compact Header */}
            <div className="flex-none px-4 py-3 border-b border-slate-200 bg-white shadow-sm z-20 sticky top-0">
                <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center border border-brand-100/50">
                            <span className="text-base">✨</span>
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-sm font-black text-slate-800 uppercase tracking-wide leading-none">WhatsApp Playground</h1>
                            <p className="text-[10px] font-medium text-slate-400 mt-0.5">Build & Generate Payloads</p>
                        </div>
                    </div>

                    {/* Desktop Mode Switcher */}
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-100 p-0.5 rounded flex border border-slate-200">
                            <button
                                onClick={() => { setMode('transactional'); setResponse(null); }}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-[3px] transition-all ${mode === 'transactional' ? 'bg-white text-brand-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Transactional
                            </button>
                            <button
                                onClick={() => { setMode('campaign'); setResponse(null); }}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-[3px] transition-all ${mode === 'campaign' ? 'bg-white text-brand-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                Campaigns
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Tab Switcher (Builder / Code) */}
                <div className="mt-2 flex lg:hidden bg-slate-100 p-0.5 rounded-lg border border-slate-200 max-w-[1800px] mx-auto">
                    <button
                        onClick={() => setMobileTab('builder')}
                        className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'builder' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
                    >
                        <span>🔨 Config</span>
                    </button>
                    <button
                        onClick={() => setMobileTab('code')}
                        className={`flex-1 py-1 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-1.5 ${mobileTab === 'code' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}
                    >
                        <span>⚡ Code</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8 pb-24">
                <div className="max-w-[1800px] mx-auto lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start h-full">

                    {/* LEFT COLUMN: BUILDER */}
                    <div className={`lg:col-span-7 space-y-3 ${mobileTab === 'builder' ? 'block' : 'hidden lg:block'}`}>
                        {/* 1. Configuration Card */}
                        <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50/80 px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <MessageIcon className="w-3 h-3 text-brand-500" />
                                    <h3 className="font-bold text-slate-700 text-[10px] uppercase tracking-wide">
                                        {mode === 'campaign' ? 'Configuration' : 'Msg Details'}
                                    </h3>
                                </div>
                            </div>

                            <div className="p-3 space-y-2">
                                {mode === 'campaign' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Campaign Title</label>
                                            <input
                                                type="text"
                                                value={campaignTitle}
                                                onChange={(e) => setCampaignTitle(e.target.value)}
                                                placeholder="Newsletter..."
                                                className="w-full px-2 py-1 h-7 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 font-medium placeholder:text-slate-300"
                                            />
                                        </div>
                                        <div className="space-y-0.5">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Group</label>
                                            <div className="relative">
                                                <select
                                                    className="w-full px-2 py-1 h-7 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 appearance-none font-medium cursor-pointer"
                                                    value={selectedGroupId}
                                                    onChange={(e) => setSelectedGroupId(e.target.value)}
                                                >
                                                    <option value="" disabled>Select...</option>
                                                    <option value="all">All Contacts</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div className="space-y-0.5 sm:col-span-2 lg:col-span-1">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Timing</label>
                                            <div className="flex items-center gap-1 h-7">
                                                <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 h-full">
                                                    <button
                                                        onClick={() => setSendNow(true)}
                                                        className={`px-2 h-full rounded-[2px] text-[9px] font-bold whitespace-nowrap transition-all ${sendNow ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400'}`}
                                                    >
                                                        Now
                                                    </button>
                                                    <button
                                                        onClick={() => setSendNow(false)}
                                                        className={`px-2 h-full rounded-[2px] text-[9px] font-bold whitespace-nowrap transition-all ${!sendNow ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-400'}`}
                                                    >
                                                        Later
                                                    </button>
                                                </div>
                                                {!sendNow && (
                                                    <input
                                                        type="datetime-local"
                                                        value={scheduledAt}
                                                        onChange={(e) => setScheduledAt(e.target.value)}
                                                        className="flex-1 px-1 h-full bg-white border border-slate-200 rounded text-[10px] outline-none focus:border-brand-500 min-w-0"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {mode === 'transactional' && (
                                    <div className="space-y-0.5">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Recipient Phone</label>
                                        <input
                                            type="text"
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value)}
                                            placeholder="e.g. 15550000000"
                                            className="w-full px-2 py-1 h-7 bg-white border border-slate-200 rounded text-[11px] outline-none focus:border-brand-500 min-w-0 font-mono"
                                        />
                                    </div>
                                )}

                                <div className="space-y-0.5 pt-1">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Template</label>
                                    <div className="relative">
                                        <select
                                            className="w-full px-2 py-1.5 h-8 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold focus:border-brand-500 outline-none appearance-none cursor-pointer hover:border-slate-300 transition-colors text-slate-700"
                                            onChange={handleTemplateSelect}
                                            value={selectedTemplate?.id || ""}
                                        >
                                            <option value="" disabled>-- Select Template --</option>
                                            {templates.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                                            ))}
                                        </select>
                                        <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Parameters */}
                        {selectedTemplate && (
                            <div className="animate-fade-in space-y-2">
                                {params.length === 0 ? (
                                    <div className="bg-white rounded-lg border border-dashed border-slate-300 p-3 text-center">
                                        <p className="text-slate-400 font-medium text-[10px]">No parameters needed</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Header Accordion */}
                                        {params.some(p => p.componentType === 'HEADER') && (
                                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                                {renderCollapsibleHeader("Header", "header", params.filter(p => p.componentType === 'HEADER').length)}
                                                {expandedSections.header && (
                                                    <div className="p-2 space-y-2 bg-white">
                                                        {params.filter(p => p.componentType === 'HEADER').map(p => (
                                                            <div key={p.id} className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-center gap-2">
                                                                <label className="text-[10px] font-bold text-slate-500 text-right truncate" title={p.label}>{p.label}</label>
                                                                {['image', 'video', 'document'].includes(p.type) ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 h-7 flex items-center justify-center rounded border border-slate-200 transition-colors flex-shrink-0">
                                                                            <input
                                                                                type="file"
                                                                                accept={p.type === 'image' ? 'image/*' : p.type === 'video' ? 'video/*' : '.pdf'}
                                                                                onChange={(e) => handleFileUpload(e, p.id)}
                                                                                className="hidden"
                                                                            />
                                                                            <span className="text-[9px] font-bold">{uploadingState[p.id] ? '...' : 'Upload'}</span>
                                                                        </label>
                                                                        <input
                                                                            type="text"
                                                                            value={p.value}
                                                                            onChange={(e) => updateParam(p.id, e.target.value)}
                                                                            placeholder={`${p.type} URL...`}
                                                                            className="flex-1 px-2 h-7 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:border-brand-500 placeholder:text-slate-400 min-w-0"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <input
                                                                        type="text"
                                                                        value={p.value}
                                                                        onChange={(e) => updateParam(p.id, e.target.value)}
                                                                        className="w-full px-2 h-7 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:bg-white focus:border-brand-500 transition-colors"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Body Accordion */}
                                        {params.some(p => p.componentType === 'BODY') && (
                                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                                {renderCollapsibleHeader("Body Variables", "body", params.filter(p => p.componentType === 'BODY').length)}
                                                {expandedSections.body && (
                                                    <div className="p-2 bg-white space-y-1.5">
                                                        {params.filter(p => p.componentType === 'BODY').map(p => (
                                                            <div key={p.id} className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-center gap-2">
                                                                <label className="text-[10px] font-bold text-slate-500 text-right truncate" title={p.label}>{p.label}</label>
                                                                <input
                                                                    type="text"
                                                                    value={p.value}
                                                                    onChange={(e) => updateParam(p.id, e.target.value)}
                                                                    className="w-full px-2 h-7 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:bg-white focus:border-brand-500 transition-all"
                                                                    placeholder="Value..."
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Carousel Accordion - Ultra Compact Grid */}
                                        {params.some(p => p.componentType === 'CAROUSEL') && (
                                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                                {renderCollapsibleHeader("Carousel Cards", "carousel", new Set(params.filter(p => p.componentType === 'CAROUSEL').map(p => p.cardIndex)).size)}
                                                {expandedSections.carousel && (
                                                    <div className="p-2 bg-slate-50/50">
                                                        {/* Responsive grid for cards */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {Array.from(new Set(params.filter(p => p.componentType === 'CAROUSEL').map(p => p.cardIndex))).sort().map((cardIdx: any) => (
                                                                <div key={cardIdx} className="p-2 bg-white rounded border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.03)] space-y-1.5">
                                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Card {cardIdx + 1}</span>
                                                                    </div>

                                                                    {params.filter(p => p.componentType === 'CAROUSEL' && p.cardIndex === cardIdx).map(p => (
                                                                        <div key={p.id} className="space-y-0.5">
                                                                            <label className="block text-[9px] font-bold text-slate-500">{p.label}</label>
                                                                            {['image', 'video'].includes(p.type) ? (
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-500 h-6 w-8 rounded border border-slate-200 transition-colors flex items-center justify-center flex-shrink-0">
                                                                                        <span className="text-[10px]">{uploadingState[p.id] ? '...' : '📁'}</span>
                                                                                        <input
                                                                                            type="file"
                                                                                            accept={p.type === 'image' ? 'image/*' : 'video/*'}
                                                                                            onChange={(e) => handleFileUpload(e, p.id)}
                                                                                            className="hidden"
                                                                                        />
                                                                                    </label>
                                                                                    <input
                                                                                        type="text"
                                                                                        value={p.value}
                                                                                        onChange={(e) => updateParam(p.id, e.target.value)}
                                                                                        placeholder="URL..."
                                                                                        className="flex-1 px-1.5 h-6 bg-white border border-slate-200 rounded text-[10px] outline-none focus:border-brand-500 min-w-0"
                                                                                    />
                                                                                </div>
                                                                            ) : (
                                                                                <input
                                                                                    type="text"
                                                                                    value={p.value}
                                                                                    onChange={(e) => updateParam(p.id, e.target.value)}
                                                                                    className="w-full px-1.5 h-6 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:bg-white focus:border-brand-500 transition-colors"
                                                                                />
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Buttons Accordion */}
                                        {params.some(p => p.componentType === 'BUTTON') && (
                                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                                                {renderCollapsibleHeader("Buttons", "buttons", params.filter(p => p.componentType === 'BUTTON').length)}
                                                {expandedSections.buttons && (
                                                    <div className="p-2 bg-white space-y-1.5">
                                                        {params.filter(p => p.componentType === 'BUTTON').map(p => (
                                                            <div key={p.id} className="grid grid-cols-[80px_1fr] sm:grid-cols-[100px_1fr] items-center gap-2">
                                                                <label className="text-[10px] font-bold text-slate-500 text-right truncate" title={p.label}>{p.label}</label>
                                                                <input
                                                                    type="text"
                                                                    value={p.value}
                                                                    onChange={(e) => updateParam(p.id, e.target.value)}
                                                                    className="w-full px-2 h-7 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none focus:bg-white focus:border-brand-500 transition-all"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Compact Submit */}
                                <div className="pt-2 pb-6 space-y-2">
                                    {/* Test Button for Campaigns */}
                                    {mode === 'campaign' && (
                                        <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 rounded-lg border border-slate-100">
                                            <input
                                                type="text"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                placeholder="Test Phone..."
                                                className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] outline-none focus:border-brand-500 font-mono text-slate-600"
                                            />
                                            <button
                                                onClick={() => sendTestRequest(true)}
                                                disabled={sending || !phoneNumber}
                                                className={`px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[9px] font-bold uppercase transition-all shadow-sm ${!phoneNumber ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-300 hover:text-brand-600 hover:shadow'}`}
                                            >
                                                Test
                                            </button>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => sendTestRequest(false)}
                                        disabled={sending || (mode === 'transactional' ? !phoneNumber : !campaignTitle)}
                                        className={`w-full py-2 rounded-lg font-black text-xs tracking-wide uppercase text-white shadow-sm transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${sending || (mode === 'transactional' ? !phoneNumber : !campaignTitle) ? 'bg-slate-300 cursor-not-allowed shadow-none' : 'bg-brand-600 hover:bg-brand-700 shadow-brand-500/20'}`}
                                    >
                                        {sending ? 'Processing...' : (mode === 'campaign' ? '🚀 Launch Campaign' : '📨 Send Message')}
                                    </button>

                                    {response && (
                                        <div className={`mt-2 p-2 rounded-lg border text-[10px] font-mono whitespace-pre-wrap break-all ${response.success || response.campaignId ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                            {JSON.stringify(response, null, 2)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: CODE PREVIEW */}
                    <div className={`lg:col-span-5 relative h-full flex flex-col ${mobileTab === 'code' ? 'block' : 'hidden lg:block'}`}>
                        <div className="lg:sticky lg:top-4 space-y-3 h-full lg:h-auto">
                            <div className="bg-slate-900 rounded-lg shadow-lg border border-slate-800 flex flex-col overflow-hidden h-[calc(100vh-140px)] lg:h-auto lg:max-h-[85vh]">
                                <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <CodeIcon className="w-3 h-3 text-emerald-400" />
                                        <span className="font-bold text-slate-200 text-[9px] tracking-wide uppercase">Payload</span>

                                        {/* Toggle Test Code in Campaign Mode */}
                                        {mode === 'campaign' && (
                                            <button
                                                onClick={() => setShowTestCode(!showTestCode)}
                                                className={`ml-2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all border ${showTestCode ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'}`}
                                            >
                                                {showTestCode ? 'Test Mode' : 'Campaign Mode'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex bg-slate-950 p-0.5 rounded-md border border-slate-800">
                                        {(['curl', 'python', 'java', 'csharp'] as const).map(lang => (
                                            <button
                                                key={lang}
                                                onClick={() => setActiveTab(lang)}
                                                className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-[2px] transition-all ${activeTab === lang ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="relative flex-1 bg-slate-900 p-3 overflow-auto custom-scrollbar group min-h-[300px]">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(getCodeSnippet(activeTab));
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-slate-800/80 hover:bg-slate-700 backdrop-blur rounded text-slate-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 z-10 border border-slate-700"
                                        title="Copy"
                                    >
                                        <CopyIcon className="w-3 h-3" />
                                    </button>
                                    <pre className="font-mono text-[10px] leading-relaxed">
                                        <code className="block text-emerald-400/90 whitespace-pre-wrap font-medium">
                                            {getCodeSnippet(activeTab)}
                                        </code>
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppApiSettings;
