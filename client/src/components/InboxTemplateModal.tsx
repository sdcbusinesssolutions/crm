import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CloseIcon, SearchIcon, ImageFileIcon, VideoFileIcon, DocumentFileIcon, CheckIcon, PlusIcon, BadgeIcon } from './icons';
import { inboxService } from '../services/inboxService';

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    components?: any[] | string;
    header_text?: string;
    body_text?: string;
    footer_text?: string;
    template_type?: string;
    cards?: any[];
    image_url?: string;
    video_url?: string;
    document_url?: string;
    header_url?: string;
    buttons?: any;
    status: string;
}

interface InboxTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (templateData: any) => void;
}

const InboxTemplateModal: React.FC<InboxTemplateModalProps> = ({ isOpen, onClose, onSend }) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [headerFile, setHeaderFile] = useState<File | null>(null);
    const [headerUrl, setHeaderUrlState] = useState('');
    const [cardMedia, setCardMedia] = useState<Record<number, { file: File | null; url: string }>>({});
    const [uploading, setUploading] = useState(false);
    const [components, setComponents] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchTemplates();
        }
    }, [isOpen]);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('whatsapp_templates')
                .select('*')
                .eq('status', 'APPROVED')
                .order('name', { ascending: true });

            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.error('Error fetching templates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setVariables({});
        setHeaderFile(null);
        setHeaderUrlState('');
        setCardMedia({});
        
        // 1. Normalize Components (Handle Array or Stringified JSON)
        let normalized: any[] = [];
        if (Array.isArray(template?.components)) {
            normalized = JSON.parse(JSON.stringify(template.components)); // Deep copy to avoid mutations
        } else if (typeof template?.components === 'string') {
            try { normalized = JSON.parse(template.components); } catch (e) { normalized = []; }
        }

        // 2. Comprehensive Additive Bridge
        const upperType = (template.template_type || '').toUpperCase();
        
        // Header Bridge (Additive)
        if (!normalized.some(c => (c.type || '').toUpperCase() === 'HEADER')) {
            const mediaUrl = template.image_url || template.video_url || template.document_url || template.header_url;
            let format = upperType;
            // Robust format identification
            if (!['IMAGE', 'VIDEO', 'DOCUMENT', 'TEXT'].includes(format)) {
                if (template.image_url) format = 'IMAGE';
                else if (template.video_url) format = 'VIDEO';
                else if (template.document_url) format = 'DOCUMENT';
                else if (template.header_text) format = 'TEXT';
                else format = 'TEXT'; // Default fallback
            }
            
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
                normalized.unshift({ 
                    type: 'HEADER', 
                    format: format,
                    example: mediaUrl ? { header_url: [mediaUrl] } : undefined
                });
            } else if (template.header_text) {
                normalized.unshift({ type: 'HEADER', format: 'TEXT', text: template.header_text });
            }
        }
        
        // Carousel Bridge (Additive)
        const hasCarousel = normalized.some(c => (c.type || '').toUpperCase() === 'CAROUSEL');
        const carouselCards = template.cards || (template.buttons?.type === 'MEDIA_CARD_CAROUSEL' ? template.buttons.cards : null) || (typeof template.buttons === 'object' && template.buttons?.cards);
        
        if (!hasCarousel && (upperType.includes('CAROUSEL') || Array.isArray(carouselCards))) {
            const cards = Array.isArray(carouselCards) ? carouselCards : [];
            if (cards.length > 0) {
                normalized.push({ 
                    type: 'CAROUSEL', 
                    cards: cards.map(card => {
                        const cardMediaUrl = card.image_url || card.video_url || card.header_url;
                        return {
                            components: [
                                { 
                                    type: 'HEADER', 
                                    format: (card.header_type || card.header?.format || card.header_format || 'IMAGE').toUpperCase(),
                                    text: card.header_text || card.header?.text || '',
                                    example: cardMediaUrl ? { header_url: [cardMediaUrl] } : undefined
                                },
                                { type: 'BODY', text: card.body || card.body_text || '' },
                                ...(Array.isArray(card.buttons) ? [{ type: 'BUTTONS', buttons: card.buttons }] : [])
                            ]
                        };
                    })
                });
            }
        }

        // Body & Footer Bridge (Additive)
        if (!normalized.some(c => (c.type || '').toUpperCase() === 'BODY') && template.body_text) {
            normalized.push({ type: 'BODY', text: template.body_text });
        }
        if (!normalized.some(c => (c.type || '').toUpperCase() === 'FOOTER') && template.footer_text) {
            normalized.push({ type: 'FOOTER', text: template.footer_text });
        }
        if (!normalized.some(c => (c.type || '').toUpperCase() === 'BUTTONS') && template.buttons) {
            const btns = template.buttons.buttons || (Array.isArray(template.buttons) ? template.buttons : []);
            if (btns.length > 0) normalized.push({ type: 'BUTTONS', buttons: btns });
        }

        const vars: Record<string, string> = {};
        
        // 3. Robust Variable Discovery
        const discoverVars = (obj: any, prefix = '') => {
            if (!obj) return;
            if (typeof obj === 'string') {
                const matches = obj.match(/\{\{(\d+)\}\}/g);
                if (matches) {
                    matches.forEach(m => {
                        const num = m.replace(/[{}]/g, '');
                        const key = prefix ? `${prefix}_${num}` : num;
                        if (!vars[key]) vars[key] = '';
                    });
                }
            } else if (Array.isArray(obj)) {
                obj.forEach((item, i) => {
                    discoverVars(item, prefix);
                });
            } else if (typeof obj === 'object') {
                // Special handling for Carousel cards to add CARD_N prefix
                if (obj.type === 'CAROUSEL' && Array.isArray(obj.cards)) {
                    obj.cards.forEach((card: any, i: number) => {
                        discoverVars(card.components, `CARD_${i + 1}`);
                    });
                } else {
                    Object.entries(obj).forEach(([key, value]) => {
                        let newPrefix = prefix;
                        const upperKey = key.toUpperCase();
                        if (['HEADER', 'BODY', 'FOOTER'].includes(upperKey)) {
                            newPrefix = prefix ? `${prefix}_${upperKey}` : (prefix.startsWith('CARD_') ? `${prefix}_${upperKey}` : upperKey);
                        }
                        discoverVars(value, newPrefix);
                    });
                }
            }
        };

        discoverVars(normalized);
        setVariables(vars);
        setComponents(normalized);
    };

    const handleVariableChange = (key: string, value: string) => {
        setVariables(prev => ({ ...prev, [key]: value }));
    };

    const handleSend = async () => {
        if (!selectedTemplate) return;

        setUploading(true);
        try {
            const normalizedComps = components;
            const upperType = (selectedTemplate.template_type || '').toUpperCase();

            // 2. Upload Header Media if present
            let finalHeaderUrl = headerUrl;
            if (headerFile) {
                const uploaded = await inboxService.uploadMedia(headerFile);
                if (uploaded) finalHeaderUrl = uploaded;
            }

            // 3. Upload Carousel Card Media
            const finalCardUrls: Record<number, string> = {};
            for (const idx in cardMedia) {
                const mediaObj = cardMedia[idx];
                if (mediaObj.file) {
                    const uploaded = await inboxService.uploadMedia(mediaObj.file);
                    if (uploaded) finalCardUrls[idx] = uploaded;
                } else if (mediaObj.url) {
                    finalCardUrls[idx] = mediaObj.url;
                }
            }

            // Construct template payload for Meta API
            const payloadComp: any[] = [];
            
            // Handle Header
            const headerComp = normalizedComps.find(c => (c.type || '').toUpperCase() === 'HEADER');
            if (headerComp) {
                const format = (headerComp.format || '').toUpperCase();
                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
                    if (finalHeaderUrl) {
                        payloadComp.push({
                            type: 'header',
                            parameters: [{
                                type: format.toLowerCase(),
                                [format.toLowerCase()]: { link: finalHeaderUrl }
                            }]
                        });
                    }
                } else if (format === 'TEXT') {
                    const headerVars = Object.keys(variables)
                        .filter(k => k.startsWith('HEADER_') || (!isNaN(Number(k)) && headerComp.text?.includes(`{{${k}}}`)))
                        .sort((a, b) => {
                            const numA = parseInt(a.replace('HEADER_', ''));
                            const numB = parseInt(b.replace('HEADER_', ''));
                            return numA - numB;
                        })
                        .map(k => ({ type: 'text', text: variables[k] }));

                    if (headerVars.length > 0) {
                        payloadComp.push({ type: 'header', parameters: headerVars });
                    }
                }
            }

            // Handle Body variables
            const bodyVars = Object.keys(variables)
                .filter(k => (!isNaN(Number(k)) && !k.includes('_')) || k.startsWith('BODY_'))
                .sort((a, b) => parseInt(a.replace('BODY_', '')) - parseInt(b.replace('BODY_', '')))
                .map(k => ({ type: 'text', text: variables[k] }));

            if (bodyVars.length > 0) {
                payloadComp.push({ type: 'body', parameters: bodyVars });
            }

            // Handle Carousel
            const carouselComp = normalizedComps.find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
            if (carouselComp && Array.isArray(carouselComp.cards)) {
                const cards = carouselComp.cards.map((card, i) => {
                    const cardComponents: any[] = [];
                    const cardIndex = i + 1;
                    const cardPrefix = `CARD_${cardIndex}`;

                    // Card Header Media
                    const cardH = (card.components || []).find((cc: any) => (cc.type || '').toUpperCase() === 'HEADER');
                    const cardHFormat = (cardH?.format || 'IMAGE').toLowerCase();
                    const cardHUrl = finalCardUrls[cardIndex];

                    if (cardHUrl) {
                        cardComponents.push({
                            type: 'header',
                            parameters: [{
                                type: cardHFormat,
                                [cardHFormat]: { link: cardHUrl }
                            }]
                        });
                    }

                    // Card Header variables (if text)
                    const cardHeaderVars = Object.keys(variables)
                        .filter(k => k.startsWith(`${cardPrefix}_HEADER_`))
                        .sort((a, b) => parseInt(a.split('_')[3]) - parseInt(b.split('_')[3]))
                        .map(k => ({ type: 'text', text: variables[k] }));

                    if (cardHeaderVars.length > 0) {
                        const existingHeader = cardComponents.find(c => c.type === 'header');
                        if (existingHeader) existingHeader.parameters.push(...cardHeaderVars);
                        else cardComponents.push({ type: 'header', parameters: cardHeaderVars });
                    }

                    // Card Body variables
                    const cardBodyVars = Object.keys(variables)
                        .filter(k => k.startsWith(`${cardPrefix}_BODY_`) || (k.startsWith(`${cardPrefix}_`) && !k.includes('HEADER')))
                        .sort((a, b) => {
                            const parts = a.split('_');
                            return parseInt(parts[parts.length - 1]);
                        })
                        .map(k => ({ type: 'text', text: variables[k] }));

                    if (cardBodyVars.length > 0) {
                        cardComponents.push({ type: 'body', parameters: cardBodyVars });
                    }

                    return {
                        card_index: i,
                        components: cardComponents
                    };
                });
                
                if (cards.length > 0) {
                    payloadComp.push({ type: 'carousel', cards });
                }
            }

            const templatePayload = {
                name: selectedTemplate.name,
                language: { code: selectedTemplate.language },
                components: payloadComp
            };

            onSend(templatePayload);
            onClose();
        } catch (error) {
            console.error('Error in handleSend:', error);
        } finally {
            setUploading(false);
        }
    };

    const filteredTemplates = (templates || []).filter(t => 
        (t.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Send WhatsApp Template</h2>
                        <p className="text-xs text-slate-500 font-medium">Select a pre-approved template to start a conversation</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side: Template List */}
                    <div className="w-1/3 border-r border-slate-100 flex flex-col bg-slate-50/30">
                        <div className="p-4">
                            <div className="relative">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-2 pb-4 h-[500px] custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-10 text-slate-400 space-y-2">
                                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-medium">Loading...</span>
                                </div>
                            ) : filteredTemplates.length > 0 ? (
                                filteredTemplates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelectTemplate(t)}
                                        className={`w-full text-left p-3 rounded-2xl mb-1 transition-all duration-200 group ${selectedTemplate?.id === t.id ? 'bg-brand-50 border-brand-100 shadow-sm' : 'hover:bg-slate-100 border-transparent border'}`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${selectedTemplate?.id === t.id ? 'bg-brand-100 text-brand-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {(t.category || 'OTHER').replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">{t.language}</span>
                                        </div>
                                        <span className={`text-sm font-bold block truncate ${selectedTemplate?.id === t.id ? 'text-brand-700' : 'text-slate-700'}`}>
                                            {t.name}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-10 text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                                    No templates found
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Preview & Variables */}
                    <div className="flex-1 flex flex-col bg-white">
                        {selectedTemplate ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                                {/* Preview Card */}
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 max-w-sm mx-auto shadow-inner">
                                    <div className="bg-white rounded-xl p-4 shadow-sm relative overflow-hidden">
                                        {components.length > 0 && (() => {
                                            return (
                                                <>
                                                    {/* Dynamic Header Preview */}
                                                    {components.find(c => (c.type || '').toUpperCase() === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((c.format || '').toUpperCase())) && (
                                                        <div className="aspect-video bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-slate-200">
                                                            {headerFile ? (
                                                                headerFile.type.startsWith('image/') ? (
                                                                    <img src={URL.createObjectURL(headerFile)} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-2">
                                                                        {headerFile.type.startsWith('video/') ? <VideoFileIcon className="w-8 h-8 text-brand-500" /> : <DocumentFileIcon className="w-8 h-8 text-red-500" />}
                                                                        <span className="text-[10px] font-bold text-slate-500 truncate max-w-[150px]">{headerFile.name}</span>
                                                                    </div>
                                                                )
                                                            ) : (
                                                                <div className="flex flex-col items-center gap-1 opacity-40">
                                                                    {(() => {
                                                                        const hComp = components.find(c => (c.type || '').toUpperCase() === 'HEADER');
                                                                        const mediaUrl = hComp?.example?.header_url?.[0] || hComp?.example?.header_handle?.[0];
                                                                        const format = hComp?.format?.toUpperCase();
                                                                        
                                                                        if (mediaUrl && format === 'IMAGE') return <img src={mediaUrl} className="w-full h-full object-cover" />;
                                                                        
                                                                        return (
                                                                            <>
                                                                                {format === 'IMAGE' ? <ImageFileIcon className="w-8 h-8" /> : 
                                                                                 format === 'VIDEO' ? <VideoFileIcon className="w-8 h-8" /> : 
                                                                                 <DocumentFileIcon className="w-8 h-8" />}
                                                                                <span className="text-[10px] font-bold">HEADER {format}</span>
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Carousel Preview */}
                                                    {components.find(c => (c.type || '').toUpperCase() === 'CAROUSEL') && (
                                                        <div className="flex gap-3 overflow-x-auto pb-4 px-1 -mx-1 custom-scrollbar-horizontal mb-2 snap-x">
                                                            {(components.find(c => (c.type || '').toUpperCase() === 'CAROUSEL')?.cards || []).map((card: any, cIdx: number) => (
                                                                <div key={cIdx} className="min-w-[180px] max-w-[180px] bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm snap-start">
                                                                    <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                                                                        {(() => {
                                                                            const h = (card.components || []).find((cc: any) => cc.type === 'HEADER');
                                                                            const mUrl = h?.example?.header_url?.[0] || h?.example?.header_handle?.[0];
                                                                            if (mUrl) return <img src={mUrl} className="w-full h-full object-cover" />;
                                                                            return <ImageFileIcon className="w-8 h-8 text-slate-300" />;
                                                                        })()}
                                                                    </div>
                                                                    <div className="p-2 space-y-1">
                                                                        {(card.components || []).map((cc: any, ccIdx: number) => {
                                                                            const type = cc.type.toUpperCase();
                                                                            if (type === 'HEADER' && cc.format === 'TEXT') {
                                                                                let text = String(cc.text || '');
                                                                                const matches = text.match(/\{\{\d+\}\}/g);
                                                                                if (matches) {
                                                                                    matches.forEach((m: string) => {
                                                                                        const num = m.replace(/[{}]/g, '');
                                                                                        text = text.replace(m, variables[`CARD_${cIdx + 1}_HEADER_${num}`] || `[V${num}]`);
                                                                                    });
                                                                                }
                                                                                return <div key={ccIdx} className="text-[11px] font-bold truncate leading-tight text-slate-800">{text}</div>;
                                                                            }
                                                                            if (type === 'BODY') {
                                                                                let text = String(cc.text || '');
                                                                                const matches = text.match(/\{\{\d+\}\}/g);
                                                                                if (matches) {
                                                                                    matches.forEach((m: string) => {
                                                                                        const num = m.replace(/[{}]/g, '');
                                                                                        text = text.replace(m, variables[`CARD_${cIdx + 1}_BODY_${num}`] || `[V${num}]`);
                                                                                    });
                                                                                }
                                                                                return <div key={ccIdx} className="text-[10px] text-slate-600 line-clamp-2 leading-snug">{text}</div>;
                                                                            }
                                                                            return null;
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {components.map((comp, idx) => {
                                                        const type = (comp.type || '').toUpperCase();
                                                        const format = (comp.format || '').toUpperCase();

                                                        if (type === 'HEADER' && format === 'TEXT') {
                                                            let text = String(comp.text || '');
                                                            const matches = text.match(/\{\{\d+\}\}/g);
                                                            if (matches) {
                                                                matches.forEach((match: string) => {
                                                                    const num = match.replace(/[{}]/g, '');
                                                                    text = text.replace(match, variables[`HEADER_${num}`] || `[Variable ${num}]`);
                                                                });
                                                            }
                                                            return <h4 key={idx} className="font-bold text-slate-800 mb-2">{text}</h4>;
                                                        }
                                                        if (type === 'BODY') {
                                                            let text = String(comp.text || '');
                                                            const matches = text.match(/\{\{\d+\}\}/g);
                                                            if (matches) {
                                                                matches.forEach((match: string) => {
                                                                    const num = match.replace(/[{}]/g, '');
                                                                    text = text.replace(match, variables[`BODY_${num}`] || `[Variable ${num}]`);
                                                                });
                                                            }
                                                            return <p key={idx} className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{text}</p>;
                                                        }
                                                        if (type === 'FOOTER') {
                                                            return <p key={idx} className="text-[10px] text-slate-400 mt-2 uppercase tracking-tighter">{String(comp.text || '')}</p>;
                                                        }
                                                        if (type === 'BUTTONS' && Array.isArray(comp.buttons)) {
                                                            return (
                                                                <div key={idx} className="mt-5 space-y-2 border-t border-slate-100 -mx-4 pt-1">
                                                                    {comp.buttons.map((btn: any, bIdx: number) => (
                                                                        <div key={bIdx} className="w-full py-2.5 text-center text-brand-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-default">
                                                                            {btn.text}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </>
                                            );
                                        })()}
                                        
                                        <div className="absolute bottom-1.5 right-3">
                                            <span className="text-[10px] text-slate-300 font-medium tracking-tighter">12:00 PM</span>
                                        </div>
                                    </div>
                                </div>
 
                                {/* Variable Inputs */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <div className="w-1.5 h-4 bg-brand-500 rounded-full"></div>
                                        Fill Variables
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 gap-4">
                                        {(() => {
                                            const comps = components;
                                            const hasMediaHeader = comps.find((c: any) => (c.type || '').toUpperCase() === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((c.format || '').toUpperCase()));
                                            
                                            // Hide if carousel media exists (usually carousels have card headers, not main header media)
                                            const hasCarousel = comps.find((c: any) => (c.type || '').toUpperCase() === 'CAROUSEL');
                                            if (!hasMediaHeader || hasCarousel) return null;
                                            
                                            return (
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 mt-4">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Header Media ({hasMediaHeader.format})</label>
                                                    <div className="flex gap-3">
                                                        <input
                                                            type="file"
                                                            id="template-media"
                                                            className="hidden"
                                                            onChange={(e) => setHeaderFile(e.target.files?.[0] || null)}
                                                        />
                                                        <label htmlFor="template-media" className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg cursor-pointer hover:bg-brand-700 transition-colors text-[10px] font-bold">
                                                            Choose File
                                                        </label>
                                                        <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-400 truncate">
                                                            {headerFile?.name || 'No file chosen'}
                                                        </div>
                                                    </div>

                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                                        placeholder="Or enter direct URL for header..."
                                                        value={headerUrl}
                                                        onChange={(e) => setHeaderUrlState(e.target.value)}
                                                    />
                                                </div>
                                            );
                                        })()}

                                        {(() => {
                                            const comps = components;
                                            const carousel = comps.find((c: any) => (c.type || '').toUpperCase() === 'CAROUSEL');
                                            if (!carousel || !Array.isArray(carousel.cards)) return null;

                                            return (
                                                <div className="space-y-4 mt-4">
                                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Carousel Cards Media</h4>
                                                    {carousel.cards.map((card: any, idx: number) => {
                                                        const cardIndex = idx + 1;
                                                        const h = (card.components || []).find((cc: any) => (cc.type || '').toUpperCase() === 'HEADER');
                                                        const format = (h?.format || card.header_type || 'IMAGE').toUpperCase();
                                                        
                                                        return (
                                                            <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                                                <div className="flex justify-between items-center">
                                                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Card {cardIndex} Media ({format})</label>
                                                                    <span className="text-[9px] text-slate-300 font-bold uppercase">{format}</span>
                                                                </div>
                                                                
                                                                <div className="flex gap-3">
                                                                    <input
                                                                        type="file"
                                                                        id={`card-media-${cardIndex}`}
                                                                        className="hidden"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0] || null;
                                                                            setCardMedia(prev => ({ ...prev, [cardIndex]: { ...prev[cardIndex], file } }));
                                                                        }}
                                                                    />
                                                                    <label htmlFor={`card-media-${cardIndex}`} className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg cursor-pointer hover:bg-brand-700 transition-colors text-[10px] font-bold">
                                                                        Choose File
                                                                    </label>
                                                                    <div className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] text-slate-400 truncate">
                                                                        {cardMedia[cardIndex]?.file?.name || 'No file chosen'}
                                                                    </div>
                                                                </div>

                                                                <input
                                                                    type="text"
                                                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                                                    placeholder={`Or enter direct URL for Card ${cardIndex}...`}
                                                                    value={cardMedia[cardIndex]?.url || ''}
                                                                    onChange={(e) => setCardMedia(prev => ({ ...prev, [cardIndex]: { ...prev[cardIndex], url: e.target.value } }))}
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}

                                        {/* Variable Mapping Section (Reference Style) */}
                                        {Object.keys(variables).length > 0 && (
                                            <div className="space-y-4 pt-2">
                                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Variable mapping</h4>
                                                {Object.keys(variables).sort((a, b) => {
                                                    const partsA = a.split('_');
                                                    const partsB = b.split('_');
                                                    
                                                    // Card variables
                                                    if (partsA[0] === 'CARD' && partsB[0] === 'CARD') {
                                                        if (partsA[1] !== partsB[1]) return parseInt(partsA[1]) - parseInt(partsB[1]);
                                                        return partsA[partsA.length - 1].localeCompare(partsB[partsB.length - 1]);
                                                    }
                                                    if (partsA[0] === 'CARD') return 1;
                                                    if (partsB[0] === 'CARD') return -1;

                                                    // Standard positional variables {{1}}, {{2}}...
                                                    if (!isNaN(Number(a)) && !isNaN(Number(b))) return Number(a) - Number(b);
                                                    
                                                    return a.localeCompare(b);
                                                }).map(key => (
                                                    <div key={key} className="space-y-1.5">
                                                        <label className="block text-[11px] font-bold text-slate-600 ml-1">
                                                            {key.startsWith('CARD_') ? `Card ${key.split('_')[1]} {{${key.split('_').pop()}}}` : `{{${key}}}`}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                                            placeholder={`Value for ${key.startsWith('CARD_') ? `{{${key.split('_').pop()}}}` : `{{${key}}}`}`}
                                                            value={variables[key]}
                                                            onChange={(e) => handleVariableChange(key, e.target.value)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <BadgeIcon className="w-10 h-10 opacity-20" />
                                </div>
                                <p className="text-sm font-bold uppercase tracking-widest">Select a template to preview</p>
                                <p className="text-xs mt-2 max-w-[200px]">Approved templates by Meta will appear in the list on the left.</p>
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/20">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!selectedTemplate || uploading}
                                className={`px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2 ${!selectedTemplate || uploading ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 active:scale-95'}`}
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <CheckIcon className="w-4 h-4" />
                                        Send Message
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InboxTemplateModal;
