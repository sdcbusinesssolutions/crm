import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import TemplatePreview from './TemplatePreview';
import Toast from '../Toast';
import { TrashIcon, PlusIcon, MessageIcon, ImageFileIcon, VideoFileIcon, DocumentFileIcon, MapIcon, CloseIcon, CtaIcon, QuickReplyIcon, CarouselIcon, CatalogueIcon, FormIcon, ZapIcon } from '../icons';

interface TemplateBuilderProps {
    templateId: string | null;
    onBack: () => void;
}

const SUPPORTED_LANGUAGES = [
    { code: 'af', name: 'Afrikaans' },
    { code: 'sq', name: 'Albanian' },
    { code: 'ar', name: 'Arabic' },
    { code: 'ar_EG', name: 'Arabic (EGY)' },
    { code: 'ar_AE', name: 'Arabic (UAE)' },
    { code: 'ar_LB', name: 'Arabic (LBN)' },
    { code: 'ar_MA', name: 'Arabic (MAR)' },
    { code: 'ar_QA', name: 'Arabic (QAT)' },
    { code: 'az', name: 'Azerbaijani' },
    { code: 'be_BY', name: 'Belarusian' },
    { code: 'bn', name: 'Bengali' },
    { code: 'bn_IN', name: 'Bengali (IND)' },
    { code: 'bg', name: 'Bulgarian' },
    { code: 'ca', name: 'Catalan' },
    { code: 'zh_CN', name: 'Chinese (CHN)' },
    { code: 'zh_HK', name: 'Chinese (HKG)' },
    { code: 'zh_TW', name: 'Chinese (TAI)' },
    { code: 'hr', name: 'Croatian' },
    { code: 'cs', name: 'Czech' },
    { code: 'da', name: 'Danish' },
    { code: 'prs_AF', name: 'Dari' },
    { code: 'nl', name: 'Dutch' },
    { code: 'nl_BE', name: 'Dutch (BEL)' },
    { code: 'en', name: 'English' },
    { code: 'en_GB', name: 'English (UK)' },
    { code: 'en_US', name: 'English (US)' },
    { code: 'en_AE', name: 'English (UAE)' },
    { code: 'en_AU', name: 'English (AUS)' },
    { code: 'en_CA', name: 'English (CAN)' },
    { code: 'en_GH', name: 'English (GHA)' },
    { code: 'en_IE', name: 'English (IRL)' },
    { code: 'en_IN', name: 'English (IND)' },
    { code: 'en_JM', name: 'English (JAM)' },
    { code: 'en_MY', name: 'English (MYS)' },
    { code: 'en_NZ', name: 'English (NZL)' },
    { code: 'en_QA', name: 'English (QAT)' },
    { code: 'en_SG', name: 'English (SGP)' },
    { code: 'en_UG', name: 'English (UGA)' },
    { code: 'en_ZA', name: 'English (ZAF)' },
    { code: 'et', name: 'Estonian' },
    { code: 'fil', name: 'Filipino' },
    { code: 'fi', name: 'Finnish' },
    { code: 'fr', name: 'French' },
    { code: 'fr_BE', name: 'French (BEL)' },
    { code: 'fr_CA', name: 'French (CAN)' },
    { code: 'fr_CH', name: 'French (CHE)' },
    { code: 'fr_CI', name: 'French (CIV)' },
    { code: 'fr_MA', name: 'French (MAR)' },
    { code: 'ka', name: 'Georgian' },
    { code: 'de', name: 'German' },
    { code: 'de_AT', name: 'German (AUT)' },
    { code: 'de_CH', name: 'German (CHE)' },
    { code: 'el', name: 'Greek' },
    { code: 'gu', name: 'Gujarati' },
    { code: 'ha', name: 'Hausa' },
    { code: 'he', name: 'Hebrew' },
    { code: 'hi', name: 'Hindi' },
    { code: 'hu', name: 'Hungarian' },
    { code: 'id', name: 'Indonesian' },
    { code: 'ga', name: 'Irish' },
    { code: 'it', name: 'Italian' },
    { code: 'ja', name: 'Japanese' },
    { code: 'kn', name: 'Kannada' },
    { code: 'kk', name: 'Kazakh' },
    { code: 'rw_RW', name: 'Kinyarwanda' },
    { code: 'ko', name: 'Korean' },
    { code: 'ky_KG', name: 'Kyrgyz (Kyrgyzstan)' },
    { code: 'lo', name: 'Lao' },
    { code: 'lv', name: 'Latvian' },
    { code: 'lt', name: 'Lithuanian' },
    { code: 'mk', name: 'Macedonian' },
    { code: 'ms', name: 'Malay' },
    { code: 'ml', name: 'Malayalam' },
    { code: 'mr', name: 'Marathi' },
    { code: 'nb', name: 'Norwegian' },
    { code: 'ps_AF', name: 'Pashto' },
    { code: 'fa', name: 'Persian' },
    { code: 'pl', name: 'Polish' },
    { code: 'pt_BR', name: 'Portuguese (BR)' },
    { code: 'pt_PT', name: 'Portuguese (POR)' },
    { code: 'pa', name: 'Punjabi' },
    { code: 'ro', name: 'Romanian' },
    { code: 'ru', name: 'Russian' },
    { code: 'sr', name: 'Serbian' },
    { code: 'si_LK', name: 'Sinhala' },
    { code: 'sk', name: 'Slovak' },
    { code: 'sl', name: 'Slovenian' },
    { code: 'es', name: 'Spanish' },
    { code: 'es_AR', name: 'Spanish (ARG)' },
    { code: 'es_CL', name: 'Spanish (CHL)' },
    { code: 'es_CO', name: 'Spanish (COL)' },
    { code: 'es_CR', name: 'Spanish (CRI)' },
    { code: 'es_DO', name: 'Spanish (DOM)' },
    { code: 'es_EC', name: 'Spanish (ECU)' },
    { code: 'es_HN', name: 'Spanish (HND)' },
    { code: 'es_MX', name: 'Spanish (MEX)' },
    { code: 'es_PA', name: 'Spanish (PAN)' },
    { code: 'es_PE', name: 'Spanish (PER)' },
    { code: 'es_ES', name: 'Spanish (SPA)' },
    { code: 'es_UY', name: 'Spanish (URY)' },
    { code: 'sw', name: 'Swahili' },
    { code: 'sv', name: 'Swedish' },
    { code: 'ta', name: 'Tamil' },
    { code: 'te', name: 'Telugu' },
    { code: 'th', name: 'Thai' },
    { code: 'tr', name: 'Turkish' },
    { code: 'uk', name: 'Ukrainian' },
    { code: 'ur', name: 'Urdu' },
    { code: 'uz', name: 'Uzbek' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'zu', name: 'Zulu' }
];

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({ templateId, onBack }) => {
    const [types, setTypes] = useState<any[]>([]);
    const [rules, setRules] = useState<any>({});
    const [actionTypes, setActionTypes] = useState<any[]>([]);

    // Form State
    const [name, setName] = useState('');
    const [language, setLanguage] = useState('en_US');
    const [category, setCategory] = useState('MARKETING');
    const [type, setType] = useState('TEXT');
    const [header, setHeader] = useState('');
    const [headerFile, setHeaderFile] = useState<File | null>(null);
    const [body, setBody] = useState('');
    const [footer, setFooter] = useState('');
    const [actionType, setActionType] = useState('NONE');
    const [buttons, setButtons] = useState<any[]>([]);

    // Media Preview URL
    const [previewMediaUrl, setPreviewMediaUrl] = useState<string | undefined>(undefined);
    const [carouselPreviewUrls, setCarouselPreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        if (headerFile) {
            const url = URL.createObjectURL(headerFile);
            setPreviewMediaUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewMediaUrl(undefined);
        }
    }, [headerFile]);


    const [availableForms, setAvailableForms] = useState<any[]>([]);
    const [companyName, setCompanyName] = useState('Business Name');

    // Parameter Format State
    const [paramFormat, setParamFormat] = useState<'positional' | 'named'>('positional');
    const [variableSamples, setVariableSamples] = useState<any[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error', title: string, message: string } | null>(null);

    const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
    const [cards, setCards] = useState<any[]>([]);

    // Handle Carousel Preview URLs
    useEffect(() => {
        const urls: string[] = [];
        const cleanups: (() => void)[] = [];

        cards.forEach(card => {
            if (card.headerFile) {
                const url = URL.createObjectURL(card.headerFile);
                urls.push(url);
                cleanups.push(() => URL.revokeObjectURL(url));
            } else {
                urls.push('');
            }
        });

        setCarouselPreviewUrls(urls);

        return () => {
            cleanups.forEach(c => c());
        };
    }, [cards]);

    useEffect(() => {
        fetchConfig();
        if (templateId) {
            fetchTemplateDetails();
        }
    }, [templateId]);

    const fetchTemplateDetails = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const response = await fetch(`/api/whatsapp/templates/${templateId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch template');
            const data = await response.json();

            setName(data.name);
            setLanguage(data.language);
            setCategory(data.category);

            // Map backend 'CAROUSEL' type to Builder's 'TEXT' type + Carousel Action
            if (data.template_type === 'CAROUSEL') {
                setType('TEXT');
            } else {
                setType(data.template_type);
            }

            setHeader(data.header_text || '');
            setBody(data.body_text);
            setFooter(data.footer_text || '');

            // Detect parameter format from existing data if possible? 
            // Meta API doesn't always explicitly return 'parameter_format' on GET unless we look at components structure.
            // But for now, we default/heuristic check could work, or just default to positional if unsure.
            // If body text has {{name}} vs {{1}}, we can guess.
            if (data.body_text && /{{[a-z_][a-z0-9_]*}}/.test(data.body_text) && !/{{\d+}}/.test(data.body_text)) {
                setParamFormat('named');
            }

            // Unified Action/Button Loading Logic
            let loadedActionType = 'NONE';
            let loadedButtons: any[] = [];
            let loadedCards: any[] = [];

            // PRIORITY 1: Reconstruct from Live Meta Components (Most Accurate)
            if (data.components) {
                const carouselComp = data.components.find((c: any) => c.type === 'CAROUSEL');
                const buttonsComp = data.components.find((c: any) => c.type === 'BUTTONS');

                if (carouselComp) {
                    console.log('TemplateBuilder: Found Component CAROUSEL, reconstructing cards...');
                    loadedActionType = 'MEDIA_CARD_CAROUSEL';
                    loadedCards = (carouselComp.cards || []).map((card: any) => {
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

                        // Fallback/Safety for header type
                        if (cardHeaderFormat === 'IMAGE' && card.header && (card.header.format === 'VIDEO' || card.header.type === 'VIDEO')) {
                            cardHeaderFormat = 'VIDEO';
                        }

                        return {
                            header: { type: cardHeaderFormat || 'IMAGE' },
                            body: cardBody,
                            buttons: cardButtons
                        };
                    });
                } else if (buttonsComp && buttonsComp.buttons && buttonsComp.buttons.length > 0) {
                    const btns = buttonsComp.buttons;
                    const hasQuickReply = btns.some((b: any) => b.type === 'QUICK_REPLY');
                    const hasCta = btns.some((b: any) => b.type === 'URL' || b.type === 'PHONE_NUMBER');
                    const hasFlow = btns.some((b: any) => b.type === 'FLOW');

                    if (hasQuickReply && hasCta) loadedActionType = 'ALL';
                    else if (hasQuickReply) loadedActionType = 'QUICK_REPLY';
                    else if (hasCta) loadedActionType = 'CALL_TO_ACTION';
                    else if (hasFlow) loadedActionType = 'FORM';

                    loadedButtons = btns;
                }
            }

            // PRIORITY 2: Fallback to Local DB 'buttons' if Components didn't yield an action
            if (loadedActionType === 'NONE' && data.buttons && data.buttons.type && data.buttons.type !== 'NONE') {
                loadedActionType = data.buttons.type;
                if (['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(loadedActionType)) {
                    loadedCards = data.buttons.cards || [];
                } else {
                    loadedButtons = data.buttons.buttons || [];
                }
            }

            setActionType(loadedActionType);
            setCards(loadedCards);
            setButtons(loadedButtons);
        } catch (error) {
            console.error('Error fetching template:', error);
            setToast({ type: 'error', title: 'Error', message: 'Failed to load template details' });
        }
    };

    const fetchConfig = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const headers = { 'Authorization': `Bearer ${session.access_token}` };

            const [typesRes, rulesRes, actionsRes] = await Promise.all([
                fetch('/api/whatsapp/templates/types', { headers }),
                fetch('/api/whatsapp/templates/rules', { headers }),
                fetch('/api/whatsapp/templates/actions', { headers })
            ]);

            setTypes(await typesRes.json());
            setRules(await rulesRes.json());
            setActionTypes(await actionsRes.json());

            try {
                const waRes = await fetch('/api/settings/whatsapp', { headers });
                if (waRes.ok) {
                    const waData = await waRes.json();
                    if (waData && waData.length > 0) {
                        setCompanyName(waData[0].name || 'Business Name');
                    }
                }
            } catch (e) {
                console.error('Error fetching company info', e);
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
    };

    const handleAddButton = () => {
        if (actionType === 'QUICK_REPLY') {
            if (buttons.length >= 10) return;
            setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
        } else if (actionType === 'CALL_TO_ACTION') {
            const urlCount = buttons.filter(b => b.type === 'URL').length;
            const phoneCount = buttons.filter(b => b.type === 'PHONE_NUMBER').length;
            if (urlCount >= 1 && phoneCount >= 1) return;
            if (urlCount === 0) {
                setButtons([...buttons, { type: 'URL', text: '', url: '' }]);
            } else {
                setButtons([...buttons, { type: 'PHONE_NUMBER', text: '', phone_number: '' }]);
            }
        } else if (actionType === 'ALL') {
            setButtons([...buttons, { type: 'QUICK_REPLY', text: '' }]);
        }
    };

    const fetchForms = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const response = await fetch('/api/whatsapp/forms', {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAvailableForms(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching forms:', error);
        }
    };

    useEffect(() => {
        if (actionType === 'FORM') {
            fetchForms();
            if (buttons.length === 0) {
                setButtons([{ type: 'FLOW', text: 'Fill Form', flow_id: '', navigate_screen: 'screen_start' }]);
            }
        }
    }, [actionType]);

    // Sync variable samples with body text based on Format
    useEffect(() => {
        if (paramFormat === 'positional') {
            const matches = body.match(/{{(\d+)}}/g);
            if (matches) {
                const maxVar = Math.max(...matches.map(m => parseInt(m.replace(/{{|}}/g, ''))));
                setVariableSamples(prev => {
                    // Filter prev to strings only if we switched from named
                    const prevStrings = prev.filter(p => typeof p === 'string');
                    const newSamples = [...prevStrings];
                    while (newSamples.length < maxVar) {
                        newSamples.push('');
                    }
                    return newSamples.slice(0, maxVar);
                });
            } else {
                setVariableSamples([]);
            }
        } else {
            // Named Format
            const matches = body.match(/{{([a-z0-9_]+)}}/g);
            if (matches) {
                const uniqueVars = Array.from(new Set(matches.map(m => m.replace(/{{|}}/g, ''))));
                setVariableSamples(prev => {
                    // Try to preserve existing examples for same-named vars
                    return uniqueVars.map(varName => {
                        const existing = prev.find(p => p.param_name === varName);
                        return existing || { param_name: varName, example: '' };
                    });
                });
            } else {
                setVariableSamples([]);
            }
        }
    }, [body, paramFormat]);

    const updateButton = (index: number, field: string, value: string) => {
        const newButtons = [...buttons];
        if (field === 'type') {
            if (actionType === 'CALL_TO_ACTION') {
                const existingType = newButtons.filter((_, i) => i !== index).find(b => b.type === value);
                if (existingType) {
                    setToast({ type: 'error', title: 'Invalid Action', message: `You can only have one ${value === 'URL' ? 'URL' : 'Phone'} button.` });
                    return;
                }
            }
            if (actionType === 'ALL') {
                const count = newButtons.filter((_, i) => i !== index && newButtons[i].type === value).length;
                if (value === 'URL' && count >= 2) {
                    setToast({ type: 'error', title: 'Limit Reached', message: 'Max 2 URL buttons allowed.' });
                    return;
                }
                if (value === 'PHONE_NUMBER' && count >= 1) {
                    setToast({ type: 'error', title: 'Limit Reached', message: 'Max 1 Phone button allowed.' });
                    return;
                }
                if (value === 'QUICK_REPLY' && count >= 10) {
                    setToast({ type: 'error', title: 'Limit Reached', message: 'Max 10 Quick Reply buttons allowed.' });
                    return;
                }
            }
        }
        newButtons[index] = { ...newButtons[index], [field]: value };
        setButtons(newButtons);
    };

    const handleAddCard = () => {
        if (cards.length >= 10) return;
        // Inherit button structure from the first card if it exists
        const initialButtons = cards.length > 0 ? cards[0].buttons.map((b: any) => ({ type: b.type, text: '', url: '', phone_number: '' })) : [];
        setCards([...cards, { header: { type: 'IMAGE' }, headerFile: null, body: '', buttons: initialButtons }]);
    };

    const updateCard = (index: number, field: string, value: any) => {
        const newCards = [...cards];
        newCards[index] = { ...newCards[index], [field]: value };
        setCards(newCards);
    };

    const handleCardFileChange = (index: number, file: File) => {
        const newCards = [...cards];
        newCards[index].headerFile = file;
        setCards(newCards);
    };

    const removeCard = (index: number) => {
        setCards(cards.filter((_, i) => i !== index));
    };

    const addCardButton = (cardIndex: number) => {
        // Enforce same structure: Add button to ALL cards
        // We use the clicked cardIndex just as a trigger, but operation applies to all.
        // Actually, to avoid confusion, let's look at the implementation. 
        // We should add a new button to every card's button array.

        // Validation: Check limit based on button type logic (ActionType ALL limits? Or just max 2 per card?)
        // Meta limit for carousel buttons is max 2.
        if (cards[0] && cards[0].buttons && cards[0].buttons.length >= 2) return;
        if (!cards[0] && cards.length > 0 && cards[0].buttons.length >= 2) return; // Fallback

        const newCards = cards.map(card => {
            const newButtons = [...(card.buttons || [])];
            // Default to QUICK_REPLY for new buttons
            newButtons.push({ type: 'QUICK_REPLY', text: '' });
            return { ...card, buttons: newButtons };
        });
        setCards(newCards);
    };

    const updateCardButton = (cardIndex: number, btnIndex: number, field: string, value: string) => {
        const newCards = [...cards];

        if (field === 'type') {
            // Apply TYPE change to ALL cards for this button index
            newCards.forEach(card => {
                if (card.buttons[btnIndex]) {
                    card.buttons[btnIndex] = { ...card.buttons[btnIndex], type: value };
                }
            });
        } else {
            // Apply Content change (text, url) ONLY to this card
            newCards[cardIndex].buttons[btnIndex] = { ...newCards[cardIndex].buttons[btnIndex], [field]: value };
        }

        setCards(newCards);
    };

    const removeCardButton = (cardIndex: number, btnIndex: number) => {
        // Enforce same structure: Remove button at btnIndex from ALL cards
        const newCards = cards.map(card => {
            const newButtons = card.buttons.filter((_: any, i: number) => i !== btnIndex);
            return { ...card, buttons: newButtons };
        });
        setCards(newCards);
    };


    const insertVariable = () => {
        if (paramFormat === 'positional') {
            const variableCount = (body.match(/{{/g) || []).length + 1;
            setBody(body + `{{${variableCount}}}`);
        } else {
            // Named
            setBody(body + `{{variable_name}}`);
        }
    };

    const insertFormat = (format: string) => {
        setBody(body + format);
    };

    const handleSubmit = async () => {
        // Basic Validation
        if (!name) {
            setToast({ type: 'error', title: 'Validation Error', message: 'Template Name is required.' });
            return;
        }
        if (!body) {
            setToast({ type: 'error', title: 'Validation Error', message: 'Body text is required.' });
            return;
        }

        // Meta Policy Validation: Variables at Start/End
        const trimmedBody = body.trim();

        const varRegex = paramFormat === 'positional' ? /{{\d+}}/g : /{{[a-z0-9_]+}}/g;

        // Start check
        // We match if the trimmed body starts with a variable pattern
        const startRegex = paramFormat === 'positional' ? /^{{\d+}}/ : /^{{[a-z0-9_]+}}/;
        if (startRegex.test(trimmedBody)) {
            setToast({ type: 'error', title: 'Meta Policy Error', message: 'Body text cannot start with a variable. Please add some text before the variable.' });
            return;
        }

        // End check
        const endRegex = paramFormat === 'positional' ? /{{\d+}}$/ : /{{[a-z0-9_]+}}$/;
        if (endRegex.test(trimmedBody)) {
            setToast({ type: 'error', title: 'Meta Policy Error', message: 'Body text cannot end with a variable. Please add some text or punctuation after the variable.' });
            return;
        }

        // Meta Policy Validation: Word Ratio (Heuristic)
        const variableCount = (trimmedBody.match(varRegex) || []).length;
        if (variableCount > 0) {
            // Remove variables to count actual words
            const textWithoutVars = trimmedBody.replace(varRegex, '').trim();
            const wordCount = textWithoutVars.length > 0 ? textWithoutVars.split(/\s+/).length : 0;

            // Recommend at least equal number of words as variables
            if (wordCount < variableCount) {
                setToast({ type: 'error', title: 'Meta Policy Error', message: 'Too many variables relative to text. Please add more descriptive text (words) to your message to avoid rejection.' });
                return;
            }
        }

        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const formData = new FormData();
            formData.append('name', name);
            formData.append('language', language);
            formData.append('category', category);
            formData.append('type', type);
            formData.append('header', header);
            formData.append('body', body);
            formData.append('footer', footer);
            formData.append('parameter_format', paramFormat);

            // Actions
            const actionsData = {
                type: actionType,
                buttons: ['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType) ? undefined : (actionType !== 'NONE' ? buttons : []),
                cards: ['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType) ? cards.map(c => ({ ...c, headerFile: undefined })) : undefined // Remove file obj from JSON
            };
            formData.append('actions', JSON.stringify(actionsData));
            formData.append('variableSamples', JSON.stringify(variableSamples));

            // Files
            if (headerFile) {
                formData.append('headerFile', headerFile);
            }

            if (actionType === 'MEDIA_CARD_CAROUSEL') {
                cards.forEach((card, idx) => {
                    if (card.headerFile) {
                        formData.append(`card_${idx}_headerFile`, card.headerFile);
                    }
                });
            }

            const url = templateId ? `/api/whatsapp/templates/${templateId}` : '/api/whatsapp/templates/create';
            const method = templateId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Failed to ${templateId ? 'update' : 'create'} template`);
            }

            setToast({ type: 'success', title: 'Success', message: `Template ${templateId ? 'updated' : 'created'} successfully!` });
            setTimeout(onBack, 1500);
        } catch (error: any) {
            console.error('Submit error:', error);
            setToast({ type: 'error', title: 'Error', message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getActionIcon = (id: string) => {
        switch (id) {
            case 'NONE': return '🚫';
            case 'CALL_TO_ACTION': return '🔗';
            case 'QUICK_REPLY': return '↩️';
            case 'MEDIA_CARD_CAROUSEL': return '🎠';
            case 'PRODUCT_CARD_CAROUSEL': return '🛍️';
            case 'FORM': return '📝';
            default: return '⚡';
        }
    };

    // Force TEXT type when Carousel is selected (Meta Limitation)
    useEffect(() => {
        if (['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType)) {
            if (type !== 'TEXT') setType('TEXT');
        }
    }, [actionType]);

    // Reset Action to NONE if switching to non-TEXT type while Carousel is active
    useEffect(() => {
        if (['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(type)) {
            if (['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType)) {
                setActionType('NONE');
                setToast({ type: 'success', title: 'Action Changed', message: 'Carousel actions are only supported with Text templates.' });
            }
        }
    }, [type]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-slate-50">
            {/* Mobile Tabs */}
            <div className="md:hidden flex border-b border-slate-200 bg-white shrink-0 z-30">
                <button onClick={() => setActiveTab('editor')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'editor' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500'}`}>Editor</button>
                <button onClick={() => setActiveTab('preview')} className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'preview' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-500'}`}>Preview</button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {/* Left Panel: Builder Form */}
                <div className={`
                    w-full md:w-3/5 lg:w-2/3 h-full overflow-y-auto custom-scrollbar p-0 border-r border-slate-200 bg-white shadow-xl z-20 absolute md:relative transition-transform duration-300
                    ${activeTab === 'editor' ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>
                    <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-100 px-5 py-4 mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={onBack} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none">{templateId ? 'Edit Template' : 'New Template'}</h1>
                            </div>
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="py-1.5 px-4 bg-[#00a884] text-white text-sm font-bold rounded-lg hover:bg-[#008f6f] shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                            {templateId ? 'Update' : 'Save'}
                        </button>
                    </div>

                    <div className="px-5 pb-20 space-y-6">
                        {/* Basic Info Card */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm font-medium disabled:opacity-60"
                                        placeholder="e.g., welcome_message"
                                        disabled={!!templateId}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm font-medium"
                                    >
                                        <option value="MARKETING">Marketing</option>
                                        <option value="UTILITY">Utility</option>
                                        <option value="AUTHENTICATION">Authentication</option>
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Language</label>
                                <select
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none text-sm font-medium disabled:opacity-60"
                                    disabled={!!templateId}
                                >
                                    {SUPPORTED_LANGUAGES.map((lang) => (
                                        <option key={lang.code} value={lang.code}>
                                            {lang.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Template Type */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Template Type</label>
                            <div className="grid grid-cols-5 gap-3">
                                {types.map((t) => {
                                    const isCarousel = ['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType);
                                    const isDisabled = isCarousel && t.id !== 'TEXT';

                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => !isDisabled && setType(t.id)}
                                            disabled={isDisabled}
                                            className={`group flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 
                                                ${type === t.id
                                                    ? 'bg-brand-600 border-brand-600 text-white shadow-md transform scale-[1.02]'
                                                    : isDisabled
                                                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed grayscale'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-brand-600 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`p-3 rounded-full mb-2 transition-colors duration-200 ${type === t.id
                                                ? 'bg-white/20 text-white'
                                                : 'bg-slate-100 text-slate-400 group-hover:bg-brand-50 group-hover:text-brand-600'
                                                }`}>
                                                {t.id === 'TEXT' && <MessageIcon className="w-8 h-8" />}
                                                {t.id === 'IMAGE' && <ImageFileIcon className="w-8 h-8" />}
                                                {t.id === 'VIDEO' && <VideoFileIcon className="w-8 h-8" />}
                                                {t.id === 'DOCUMENT' && <DocumentFileIcon className="w-8 h-8" />}
                                                {t.id === 'LOCATION' && <MapIcon className="w-8 h-8" />}
                                            </div>
                                            <span className={`text-xs font-bold uppercase tracking-wide ${type === t.id ? 'text-white' : 'text-slate-500 group-hover:text-brand-600'
                                                }`}>{t.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType) && (
                                <p className="text-[10px] text-blue-600 font-medium pl-1 mt-2 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Headers require Media (Image/Video) for Carousel templates.
                                </p>
                            )}
                        </div>

                        <hr className="border-slate-100" />

                        {/* Header */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                <span>Header <span className="text-slate-400 font-normal normal-case">{['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(actionType) ? '(Text Only)' : '(Optional)'}</span></span>
                                <span className={header.length > 60 ? "text-red-500 text-[9px]" : "text-[9px] text-slate-400"}>{header.length}/60</span>
                            </label>
                            {type === 'TEXT' ? (
                                <input
                                    type="text"
                                    value={header}
                                    onChange={(e) => setHeader(e.target.value)}
                                    maxLength={60}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none text-sm transition-all font-medium"
                                    placeholder="Enter header text..."
                                />
                            ) : (
                                <div className="space-y-2">
                                    <div className="px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-lg text-xs text-blue-700 flex items-center gap-2">
                                        <span className="text-base">ℹ️</span>
                                        <p>Upload {type.toLowerCase()} sample for approval.</p>
                                    </div>
                                    <input
                                        type="file"
                                        accept={type === 'IMAGE' ? 'image/*' : type === 'VIDEO' ? 'video/*' : '.pdf'}
                                        onChange={(e) => setHeaderFile(e.target.files ? e.target.files[0] : null)}
                                        className="text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Body */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-end">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Body Message <span className={`ml-1 font-normal ${body.length > 1024 ? "text-red-500" : "text-slate-400"}`}>({body.length}/1024)</span>
                                </label>
                                <div className="flex gap-2">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name="paramFormat" value="positional" checked={paramFormat === 'positional'} onChange={() => setParamFormat('positional')} className="text-brand-600 focus:ring-brand-500 h-3 w-3" />
                                        <span className="text-[10px] font-medium text-slate-600">Positional</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" name="paramFormat" value="named" checked={paramFormat === 'named'} onChange={() => setParamFormat('named')} className="text-brand-600 focus:ring-brand-500 h-3 w-3" />
                                        <span className="text-[10px] font-medium text-slate-600">Named</span>
                                    </label>
                                </div>
                            </div>

                            <div className="relative">
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    maxLength={1024}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none transition-all font-medium resize-none h-32 text-sm leading-relaxed"
                                    placeholder={paramFormat === 'positional' ? "Hi {{1}}, thanks for your order!" : "Hi {{first_name}}, thanks for your order!"}
                                />
                                <div className="absolute bottom-2 right-2 flex gap-1">
                                    <button onClick={insertVariable} className="text-[10px] font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded transition-colors">+ Var</button>
                                    <button onClick={() => insertFormat('*')} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded transition-colors">Bold</button>
                                    <button onClick={() => insertFormat('_')} className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded transition-colors">Italic</button>
                                </div>
                            </div>

                            {/* Variable Samples */}
                            {variableSamples.length > 0 && (
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Variable Samples</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {variableSamples.map((sample, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 font-mono min-w-[32px]">
                                                    {paramFormat === 'positional' ? `{{${idx + 1}}}` : `{{${sample.param_name}}}`}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={paramFormat === 'positional' ? sample : sample.example}
                                                    onChange={(e) => {
                                                        const newSamples = [...variableSamples];
                                                        if (paramFormat === 'positional') newSamples[idx] = e.target.value;
                                                        else newSamples[idx] = { ...newSamples[idx], example: e.target.value };
                                                        setVariableSamples(newSamples);
                                                    }}
                                                    className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                                    placeholder="Sample value..."
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                                <span>Footer <span className="text-slate-400 font-normal normal-case">(Optional)</span></span>
                                <span className={footer.length > 60 ? "text-red-500 text-[9px]" : "text-[9px] text-slate-400"}>{footer.length}/60</span>
                            </label>
                            <input
                                type="text"
                                value={footer}
                                onChange={(e) => setFooter(e.target.value)}
                                maxLength={60}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-brand-500 outline-none text-sm transition-all font-medium"
                                placeholder="Add a footer..."
                            />
                        </div>

                        <hr className="border-slate-100" />

                        {/* Actions */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buttons & Actions</label>
                            <div className="grid grid-cols-3 gap-3">
                                {actionTypes.map((at) => {
                                    const isCarousel = ['MEDIA_CARD_CAROUSEL', 'PRODUCT_CARD_CAROUSEL'].includes(at.id);
                                    const isDisabled = isCarousel && type !== 'TEXT';

                                    let Icon = ZapIcon;
                                    if (at.id === 'NONE') Icon = CloseIcon;
                                    else if (at.id === 'CALL_TO_ACTION') Icon = CtaIcon;
                                    else if (at.id === 'QUICK_REPLY') Icon = QuickReplyIcon;
                                    else if (at.id === 'MEDIA_CARD_CAROUSEL') Icon = CarouselIcon;
                                    else if (at.id === 'PRODUCT_CARD_CAROUSEL') Icon = CatalogueIcon;
                                    else if (at.id === 'FORM') Icon = FormIcon;
                                    else if (at.id === 'ALL') Icon = ZapIcon;

                                    return (
                                        <button
                                            key={at.id}
                                            onClick={() => {
                                                if (!isDisabled) {
                                                    setActionType(at.id);
                                                    setButtons([]);
                                                }
                                            }}
                                            disabled={isDisabled}
                                            className={`group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 
                                                ${actionType === at.id
                                                    ? 'bg-brand-600 border-brand-600 text-white shadow-md transform scale-[1.02]'
                                                    : isDisabled
                                                        ? 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed grayscale'
                                                        : 'border-slate-200 bg-white text-slate-500 hover:border-brand-600 hover:shadow-sm'
                                                }`}
                                        >
                                            <div className={`p-2.5 rounded-full mb-1.5 transition-colors duration-200 ${actionType === at.id
                                                ? 'bg-white/20 text-white'
                                                : isDisabled
                                                    ? 'bg-slate-100 text-slate-400'
                                                    : 'bg-slate-50 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600'
                                                }`}>
                                                <Icon className="w-6 h-6" />
                                            </div>
                                            <span className={`text-[10px] font-bold uppercase tracking-wide text-center leading-tight ${actionType === at.id ? 'text-white' : 'text-slate-500 group-hover:text-brand-600'
                                                }`}>{at.label.replace(' Carousel', '')}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Buttons Editor */}
                        {['QUICK_REPLY', 'CALL_TO_ACTION', 'ALL'].includes(actionType) && (
                            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {buttons.map((btn, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <select
                                            value={btn.type}
                                            onChange={(e) => updateButton(idx, 'type', e.target.value)}
                                            className="w-24 text-[10px] border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-brand-500"
                                        >
                                            {(actionType === 'QUICK_REPLY' || actionType === 'ALL') && <option value="QUICK_REPLY">Quick Reply</option>}
                                            {(actionType === 'CALL_TO_ACTION' || actionType === 'ALL') && (
                                                <>
                                                    <option value="URL">Website</option>
                                                    <option value="PHONE_NUMBER">Phone</option>
                                                </>
                                            )}
                                        </select>
                                        <input
                                            type="text"
                                            value={btn.text}
                                            onChange={(e) => updateButton(idx, 'text', e.target.value)}
                                            className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                            placeholder="Label"
                                        />
                                        {btn.type === 'URL' && (
                                            <input
                                                type="text"
                                                value={btn.url}
                                                onChange={(e) => updateButton(idx, 'url', e.target.value)}
                                                className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                                placeholder="https://..."
                                            />
                                        )}
                                        {btn.type === 'PHONE_NUMBER' && (
                                            <input
                                                type="text"
                                                value={btn.phone_number}
                                                onChange={(e) => updateButton(idx, 'phone_number', e.target.value)}
                                                className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded text-xs outline-none focus:ring-1 focus:ring-brand-500"
                                                placeholder="+1..."
                                            />
                                        )}
                                        <button onClick={() => {
                                            const newButtons = buttons.filter((_, i) => i !== idx);
                                            setButtons(newButtons);
                                        }} className="text-slate-400 hover:text-red-500 p-1">
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {buttons.length < 10 && (
                                    <button onClick={handleAddButton} className="text-xs font-bold text-brand-600 hover:underline px-1">+ Add Button</button>
                                )}
                            </div>
                        )}

                        {/* Form / Carousel Editors (Simplified for compactness) */}
                        {actionType === 'FORM' && (
                            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Button Text</label>
                                    <input
                                        type="text"
                                        value={buttons[0]?.text || ''}
                                        onChange={(e) => {
                                            const newButtons = [...buttons];
                                            if (!newButtons[0]) newButtons[0] = { type: 'FLOW', text: '', flow_id: '', navigate_screen: 'screen_start' };
                                            newButtons[0].text = e.target.value;
                                            setButtons(newButtons);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                        placeholder="e.g., Fill out form"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Flow ID</label>
                                    <select
                                        value={buttons[0]?.flow_id || ''}
                                        onChange={async (e) => {
                                            const flowId = e.target.value;
                                            const newButtons = [...buttons];
                                            if (!newButtons[0]) newButtons[0] = { type: 'FLOW', text: '', flow_id: '', navigate_screen: 'screen_start' };
                                            newButtons[0].flow_id = flowId;
                                            if (flowId) newButtons[0].navigate_screen = 'Loading...';
                                            else newButtons[0].navigate_screen = 'screen_start';
                                            setButtons(newButtons);

                                            if (flowId) {
                                                try {
                                                    const { data: { session } } = await supabase.auth.getSession();
                                                    if (!session) return;
                                                    const res = await fetch(`/api/whatsapp/forms/${flowId}/start_screen`, { headers: { 'Authorization': `Bearer ${session.access_token}` } });
                                                    const data = await res.json();
                                                    setButtons(prev => {
                                                        const updated = [...prev];
                                                        if (updated[0] && updated[0].flow_id === flowId) updated[0].navigate_screen = data.start_screen_id || 'screen_start';
                                                        return updated;
                                                    });
                                                } catch (err) {
                                                    setButtons(prev => { const updated = [...prev]; if (updated[0]) updated[0].navigate_screen = 'screen_start'; return updated; });
                                                }
                                            }
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                    >
                                        <option value="">Select Flow...</option>
                                        {availableForms.filter(form => form.status === 'PUBLISHED').map((form) => (<option key={form.id} value={form.id}>{form.name}</option>))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase">First Screen</label>
                                    <input
                                        type="text"
                                        value={buttons[0]?.navigate_screen || 'screen_start'}
                                        onChange={(e) => {
                                            const newButtons = [...buttons];
                                            if (!newButtons[0]) newButtons[0] = { type: 'FLOW', text: '', flow_id: '', navigate_screen: 'screen_start' };
                                            newButtons[0].navigate_screen = e.target.value;
                                            setButtons(newButtons);
                                        }}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none"
                                        placeholder="screen_start"
                                    />
                                </div>
                            </div>
                        )}

                        {actionType === 'MEDIA_CARD_CAROUSEL' && (
                            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                {cards.map((card, idx) => (
                                    <div key={idx} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Card {idx + 1}</span>
                                            <button onClick={() => removeCard(idx)} className="text-slate-300 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <select
                                                    value={card.header.type}
                                                    onChange={(e) => updateCard(idx, 'header', { ...card.header, type: e.target.value })}
                                                    className="w-20 text-[10px] border border-slate-200 rounded p-1"
                                                >
                                                    <option value="IMAGE">Img</option>
                                                    <option value="VIDEO">Vid</option>
                                                </select>
                                                <input
                                                    type="file"
                                                    accept={card.header.type === 'IMAGE' ? 'image/*' : 'video/*'}
                                                    onChange={(e) => { if (e.target.files && e.target.files[0]) handleCardFileChange(idx, e.target.files[0]); }}
                                                    className="flex-1 text-[10px] text-slate-500 file:mr-2 file:py-0.5 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:bg-slate-100"
                                                />
                                            </div>
                                            <textarea
                                                value={card.body}
                                                onChange={(e) => updateCard(idx, 'body', e.target.value)}
                                                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs resize-none"
                                                rows={2}
                                                placeholder="Card Text"
                                            />
                                            <div className="space-y-1 pt-1">
                                                {card.buttons?.map((btn: any, bIdx: number) => (
                                                    <div key={bIdx} className="flex gap-1 items-center">
                                                        <select
                                                            value={btn.type}
                                                            onChange={(e) => updateCardButton(idx, bIdx, 'type', e.target.value)}
                                                            className="w-20 text-[10px] border border-slate-200 rounded p-1 bg-white focus:ring-1 focus:ring-brand-500"
                                                        >
                                                            <option value="QUICK_REPLY">Quick Reply</option>
                                                            <option value="URL">Website</option>
                                                            <option value="PHONE_NUMBER">Phone</option>
                                                        </select>
                                                        <input
                                                            value={btn.text}
                                                            onChange={(e) => updateCardButton(idx, bIdx, 'text', e.target.value)}
                                                            className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] outline-none"
                                                            placeholder="Label"
                                                        />
                                                        {btn.type !== 'QUICK_REPLY' && (
                                                            <input
                                                                value={btn.type === 'URL' ? btn.url : btn.phone_number}
                                                                onChange={(e) => updateCardButton(idx, bIdx, btn.type === 'URL' ? 'url' : 'phone_number', e.target.value)}
                                                                className="flex-1 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] outline-none"
                                                                placeholder={btn.type === 'URL' ? 'https://...' : '+1...'}
                                                            />
                                                        )}
                                                        <button onClick={() => removeCardButton(idx, bIdx)} className="text-slate-300 hover:text-red-500 p-1"><TrashIcon className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                                {(card.buttons?.length || 0) < 2 && <button onClick={() => addCardButton(idx)} className="text-[10px] font-bold text-brand-600 hover:underline">+ Btn</button>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={handleAddCard} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-slate-400 font-bold text-xs hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all">+ Add Card</button>
                            </div>
                        )}

                        {/* Product Carousel Placeholder */}
                        {actionType === 'PRODUCT_CARD_CAROUSEL' && (
                            <div className="p-4 bg-brand-50 border border-brand-100 rounded-lg text-center flex items-center justify-center gap-4">
                                <div className="text-2xl">🛍️</div>
                                <div className="text-left">
                                    <h3 className="text-xs font-bold text-brand-800">Marketing Carousel</h3>
                                    <p className="text-[10px] text-brand-600 leading-tight">Displays products from your catalog. Configure products when sending.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel: Preview */}
                <div className={`
                    w-full md:w-2/5 lg:w-1/3 h-full bg-slate-100/50 p-3 md:p-4 flex items-center justify-center relative overflow-hidden transition-transform duration-300 absolute md:relative
                    ${activeTab === 'preview' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                `}>
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                    <div className="w-full h-full max-h-[850px] relative z-10">
                        <TemplatePreview
                            type={type}
                            header={header}
                            body={body}
                            footer={footer}
                            actions={{ type: actionType, buttons, cards }}
                            language={language}
                            companyName={companyName}
                            mediaUrl={previewMediaUrl}
                            carouselMediaUrls={carouselPreviewUrls}
                            variableSamples={variableSamples}
                        />
                    </div>
                </div>
            </div>
            {toast && <Toast type={toast.type} title={toast.title} message={toast.message} onClose={() => setToast(null)} />}
        </div>
    );
};

export default TemplateBuilder;
