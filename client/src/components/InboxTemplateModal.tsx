import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CloseIcon, SearchIcon, ImageFileIcon, VideoFileIcon, DocumentFileIcon, CheckIcon, PlusIcon, BadgeIcon, UploadIcon } from './icons';
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
        setComponents([]); // Immediate reset to prevent UI splash/glitch
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
        // 5. Final State Update with micro-delay to ensure loading UI renders
        setTimeout(() => {
            setComponents(normalized);
        }, 100);
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
                const uploaded = await inboxService.uploadMedia(headerFile, 'template');
                if (uploaded) finalHeaderUrl = uploaded;
            }

            // 3. Upload Carousel Card Media
            const finalCardUrls: Record<number, string> = {};
            for (const idx in cardMedia) {
                const mediaObj = cardMedia[idx];
                if (mediaObj.file) {
                    const uploaded = await inboxService.uploadMedia(mediaObj.file, 'template');
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

            // 4. Construct Preview Text for UI (fallback for chat bubbles)
            const bodyComp = normalizedComps.find(c => (c.type || '').toUpperCase() === 'BODY');
            let previewText = bodyComp?.text || '';
            if (!previewText && selectedTemplate.name) {
                previewText = `Template: ${selectedTemplate.name}`;
            } else if (previewText) {
                const matches = previewText.match(/\{\{\d+\}\}/g);
                if (matches) {
                    matches.forEach(m => {
                        const num = m.replace(/[{}]/g, '');
                        previewText = previewText.replace(m, variables[num] || variables[`BODY_${num}`] || m);
                    });
                }
            }

            const templatePayload = {
                name: selectedTemplate.name,
                language: { code: selectedTemplate.language },
                components: payloadComp,
                text: previewText // Added for display preview
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-100/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up border border-slate-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#c0f7e7]/40 flex items-center justify-center border border-[#00684a]/20">
                            <BadgeIcon className="w-5 h-5 text-[#00684a]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Send WhatsApp Template</h2>
                            <p className="text-sm text-slate-600 font-medium tracking-wide">Select and configure your message for dispatch</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 hover:text-slate-800">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side: Template List */}
                    <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50">
                        <div className="p-6">
                            <div className="relative group">
                                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-[#00684a] transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search templates..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-[15px] text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 focus:border-[#00684a] transition-all outline-none"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 pb-6 h-[500px] custom-scrollbar">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-600 space-y-3">
                                    <div className="w-8 h-8 border-2 border-[#00684a] border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs font-bold uppercase tracking-widest">Loading Library...</span>
                                </div>
                            ) : filteredTemplates.length > 0 ? (
                                filteredTemplates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleSelectTemplate(t)}
                                        className={`w-full text-left p-4 rounded-2xl mb-2 transition-all duration-300 group relative border ${selectedTemplate?.id === t.id ? 'bg-[#c0f7e7] border-[#00684a]/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 'hover:bg-slate-100/40 border-transparent'}`}
                                    >
                                        {selectedTemplate?.id === t.id && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#00684a] rounded-r-full"></div>
                                        )}
                                        <div className="flex items-center justify-between mb-2">
                                            <span className={`text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${selectedTemplate?.id === t.id ? 'bg-[#00684a]/20 text-[#00684a]' : 'bg-slate-100 text-slate-600'}`}>
                                                {(t.category || 'OTHER').replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[11px] text-slate-600 font-mono font-bold">{t.language}</span>
                                        </div>
                                        <span className={`text-sm font-bold block truncate tracking-tight ${selectedTemplate?.id === t.id ? 'text-slate-800' : 'text-slate-600 group-hover:text-slate-200'}`}>
                                            {t.name}
                                        </span>
                                    </button>
                                ))
                            ) : (
                                <div className="text-center py-20 px-6">
                                    <SearchIcon className="w-10 h-10 text-slate-800 mx-auto mb-3" />
                                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">No matching templates found</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Side: Preview & Variables */}
                    <div className="flex-1 flex flex-col bg-white">
                        {selectedTemplate ? (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-white">
                                {/* Preview Card */}
                                {components.length > 0 ? (
                                    <div className="bg-white shadow-2xl rounded-[32px] p-6 border border-slate-200 max-w-sm mx-auto relative overflow-hidden group animate-fade-in">
                                        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-brand-500/5 to-transparent pointer-events-none"></div>
                                        <div className="bg-white rounded-2xl p-4 shadow-xl relative z-10">
                                            {/* Dynamic Header Preview */}
                                            {components.find(c => (c.type || '').toUpperCase() === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((c.format || '').toUpperCase())) && (
                                                <div className="aspect-video bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden border border-slate-200">
                                                    {headerFile ? (
                                                        headerFile.type.startsWith('image/') ? (
                                                            <img src={URL.createObjectURL(headerFile)} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2">
                                                                {headerFile.type.startsWith('video/') ? <VideoFileIcon className="w-8 h-8 text-[#00684a]" /> : <DocumentFileIcon className="w-8 h-8 text-red-500" />}
                                                                <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{headerFile.name}</span>
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
                                                                        <span className="text-xs font-bold">HEADER {format}</span>
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
                                                        <div key={cIdx} className="min-w-[180px] max-w-[180px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm snap-start">
                                                            <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-200">
                                                                {(() => {
                                                                    const h = (card.components || []).find((cc: any) => cc.type === 'HEADER');
                                                                    const mUrl = h?.example?.header_url?.[0] || h?.example?.header_handle?.[0];
                                                                    if (mUrl) return <img src={mUrl} className="w-full h-full object-cover opacity-80" />;
                                                                    return <ImageFileIcon className="w-8 h-8 text-slate-700" />;
                                                                })()}
                                                            </div>
                                                            <div className="p-2.5 space-y-1.5">
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
                                                                        return <div key={ccIdx} className="text-xs font-bold truncate leading-tight text-slate-800/90">{text}</div>;
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
                                                                        return <div key={ccIdx} className="text-[11px] text-slate-600 line-clamp-2 leading-snug">{text}</div>;
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
                                                    return <p key={idx} className="text-[15px] text-slate-600 whitespace-pre-wrap leading-relaxed">{text}</p>;
                                                }
                                                if (type === 'FOOTER') {
                                                    return <p key={idx} className="text-xs text-slate-600 mt-2 uppercase tracking-tighter">{String(comp.text || '')}</p>;
                                                }
                                                if (type === 'BUTTONS' && Array.isArray(comp.buttons)) {
                                                    return (
                                                        <div key={idx} className="mt-5 space-y-2 border-t border-slate-100 -mx-4 pt-1">
                                                            {comp.buttons.map((btn: any, bIdx: number) => (
                                                                <div key={bIdx} className="w-full py-2.5 text-center text-[#00684a] text-sm font-bold hover:bg-slate-50 transition-colors cursor-default">
                                                                    {btn.text}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })}
                                            
                                            <div className="absolute bottom-1.5 right-3">
                                                <span className="text-xs text-slate-300 font-medium tracking-tighter">12:00 PM</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white/50 rounded-3xl p-12 border border-slate-200/50 flex flex-col items-center justify-center text-center animate-pulse">
                                        <div className="w-12 h-12 border-2 border-[#00684a]/20 border-t-brand-500 rounded-full animate-spin"></div>
                                    </div>
                                )}

                                {/* Variable Inputs */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2 uppercase tracking-[0.2em] ml-1">
                                        <div className="w-1.5 h-4 bg-[#00684a] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
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
                                                <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                                                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-widest mb-2">Header Media ({hasMediaHeader.format})</label>
                                                    <div className="flex gap-3">
                                                        <input
                                                            type="file"
                                                            id="template-media"
                                                            className="hidden"
                                                            onChange={(e) => setHeaderFile(e.target.files?.[0] || null)}
                                                        />
                                                        <label htmlFor="template-media" className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00684a] text-white rounded-xl cursor-pointer hover:bg-[#005c42] transition-all text-xs font-bold shadow-lg shadow-brand-500/20 active:scale-95">
                                                            <UploadIcon className="w-3.5 h-3.5" />
                                                            Choose File
                                                        </label>
                                                        <div className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-600 truncate flex items-center">
                                                            {headerFile?.name || 'No file selected...'}
                                                        </div>
                                                    </div>

                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 focus:border-[#00684a] transition-all outline-none"
                                                        placeholder="Or paste direct media URL..."
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
                                                <div className="space-y-4 mt-6">
                                                    <h4 className="text-xs font-bold text-slate-600 uppercase tracking-[0.2em] ml-1">Carousel Cards Media</h4>
                                                    {carousel.cards.map((card: any, idx: number) => {
                                                        const cardIndex = idx + 1;
                                                        const h = (card.components || []).find((cc: any) => (cc.type || '').toUpperCase() === 'HEADER');
                                                        const format = (h?.format || card.header_type || 'IMAGE').toUpperCase();
                                                        
                                                        return (
                                                            <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-sm group/card">
                                                                <div className="flex justify-between items-center">
                                                                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest">Card {cardIndex} Content ({format})</label>
                                                                    <span className="text-[11px] bg-slate-100 text-[#00684a] px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">{format}</span>
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
                                                                    <label htmlFor={`card-media-${cardIndex}`} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00684a]/10 text-[#00684a] border border-[#00684a]/20 rounded-xl cursor-pointer hover:bg-[#00684a] hover:text-slate-800 transition-all text-xs font-bold active:scale-95">
                                                                        <UploadIcon className="w-3.5 h-3.5" />
                                                                        Upload
                                                                    </label>
                                                                    <div className="flex-1 bg-slate-100/50 border border-slate-300/50 rounded-xl px-4 py-2.5 text-xs text-slate-600 truncate flex items-center">
                                                                        {cardMedia[cardIndex]?.file?.name || 'No file selected'}
                                                                    </div>
                                                                </div>

                                                                <input
                                                                    type="text"
                                                                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500/20 focus:border-[#00684a] transition-all outline-none"
                                                                    placeholder={`Or Card ${cardIndex} Media URL...`}
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
                                            <div className="space-y-5 pt-4">
                                                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-[0.2em] ml-1">Variable mapping</h4>
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
                                                    <div key={key} className="space-y-2 group/var">
                                                        <label className="block text-[11px] font-bold text-slate-600 ml-1 transition-colors group-focus-within/var:text-[#00684a]">
                                                            {key.startsWith('CARD_') ? `Card ${key.split('_')[1]} {{${key.split('_').pop()}}}` : `{{${key}}}`}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl text-[15px] text-slate-800 focus:ring-2 focus:ring-brand-500/20 focus:border-[#00684a] transition-all outline-none placeholder:text-slate-700"
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
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-700 p-20 text-center">
                                <div className="w-24 h-24 rounded-[32px] bg-white flex items-center justify-center mb-6 border border-slate-200 shadow-xl overflow-hidden relative group">
                                    <div className="absolute inset-0 bg-[#c0f7e7]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <BadgeIcon className="w-10 h-10 text-slate-800 transition-transform group-hover:scale-110" />
                                </div>
                                <h3 className="text-[15px] font-bold text-slate-600 uppercase tracking-[0.3em] mb-3">Initialize Preview</h3>
                                <p className="text-[11px] text-slate-600 font-medium leading-relaxed max-w-[280px]">
                                    Select an approved WhatsApp template from the library to begin configuring your message.
                                </p>
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-slate-200 flex items-center justify-end gap-4 bg-white/40">
                            <button
                                onClick={onClose}
                                className="px-6 py-3 text-sm font-bold text-slate-600 hover:text-slate-800 transition-all uppercase tracking-widest"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={!selectedTemplate || uploading}
                                className={`px-10 py-3 rounded-2xl text-sm font-bold text-white shadow-xl transition-all flex items-center gap-2 group relative overflow-hidden ${!selectedTemplate || uploading ? 'bg-slate-100 text-slate-600 cursor-not-allowed border border-slate-300' : 'bg-[#00684a] hover:bg-[#005c42] active:scale-95 shadow-brand-500/20'}`}
                            >
                                {uploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        <span>Synchronizing...</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 -translate-x-full group-hover:translate-x-0 transition-transform duration-500"></div>
                                        <CheckIcon className="w-4 h-4" />
                                        <span className="uppercase tracking-widest">Send Message</span>
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
