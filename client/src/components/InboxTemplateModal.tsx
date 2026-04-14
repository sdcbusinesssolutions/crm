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
    const [uploading, setUploading] = useState(false);

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
        
        // 1. Normalize Components (Handle Array or Stringified JSON)
        let components: any[] = [];
        if (Array.isArray(template?.components)) {
            components = template.components;
        } else if (typeof template?.components === 'string') {
            try { components = JSON.parse(template.components); } catch (e) { components = []; }
        }

        // 2. Legacy/Top-level Field Bridge (If components array is missing or empty)
        const upperType = (template.template_type || '').toUpperCase();
        if (components.length === 0) {
            // Handle Media Header from template_type or mapping fields
            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(upperType)) {
                const mediaUrl = template.image_url || template.video_url || template.document_url || template.header_url;
                components.push({ 
                    type: 'HEADER', 
                    format: upperType,
                    example: mediaUrl ? { header_url: [mediaUrl] } : undefined
                });
            } else if (template.header_text) {
                components.push({ type: 'HEADER', format: 'TEXT', text: template.header_text });
            }
            
            // Handle Carousel Bridge
            if (upperType.includes('CAROUSEL') || Array.isArray(template.cards)) {
                const cards = Array.isArray(template.cards) ? template.cards : [];
                if (cards.length > 0) {
                    components.push({ 
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

            if (template.body_text) components.push({ type: 'BODY', text: template.body_text });
            if (template.footer_text) components.push({ type: 'FOOTER', text: template.footer_text });
            
            // Handle Top-level Buttons
            if (template.buttons) {
                const btns = template.buttons.buttons || (Array.isArray(template.buttons) ? template.buttons : []);
                if (btns.length > 0) components.push({ type: 'BUTTONS', buttons: btns });
            }
        }

        const vars: Record<string, string> = {};
        
        // 3. Robust Variable Discovery
        const discoverVars = (obj: any, prefix = '') => {
            if (!obj) return;
            if (typeof obj === 'string') {
                const matches = obj.match(/\{\{\d+\}\}/g);
                if (matches) {
                    matches.forEach(m => {
                        const num = m.replace(/[{}]/g, '');
                        const key = prefix ? `${prefix}_${num}` : `BODY_${num}`; // Default to BODY if no prefix
                        if (!vars[key]) vars[key] = '';
                    });
                }
            } else if (Array.isArray(obj)) {
                obj.forEach((item, i) => {
                    // Special handling for carousel cards to give better labels
                    const newPrefix = prefix.startsWith('CARD_') ? prefix : (obj === template.cards ? `CARD_${i + 1}` : prefix);
                    discoverVars(item, newPrefix);
                });
            } else if (typeof obj === 'object') {
                Object.entries(obj).forEach(([key, value]) => {
                    let newPrefix = prefix;
                    const upperKey = key.toUpperCase();
                    if (['HEADER', 'BODY', 'FOOTER'].includes(upperKey)) {
                        newPrefix = prefix ? `${prefix}_${upperKey}` : upperKey;
                    }
                    discoverVars(value, newPrefix);
                });
            }
        };

        // Start discovery from components and top-level fields
        discoverVars(components);
        if (components.length === 0) {
            discoverVars(template.header_text, 'HEADER');
            discoverVars(template.body_text, 'BODY');
        }

        setVariables(vars);
    };

    const handleVariableChange = (key: string, value: string) => {
        setVariables(prev => ({ ...prev, [key]: value }));
    };

    const handleSend = async () => {
        if (!selectedTemplate) return;

        setUploading(true);
        try {
            let headerUrl = '';
            if (headerFile) {
                headerUrl = await inboxService.uploadMedia(headerFile) || '';
            }

            // 1. Normalize Components for Payload Generation
            let normalizedComps: any[] = [];
            if (Array.isArray(selectedTemplate?.components)) {
                normalizedComps = selectedTemplate.components;
            } else if (typeof selectedTemplate?.components === 'string') {
                try { normalizedComps = JSON.parse(selectedTemplate.components); } catch (e) { normalizedComps = []; }
            }
            if (normalizedComps.length === 0) {
                if (selectedTemplate.header_text) normalizedComps.push({ type: 'HEADER', format: 'TEXT', text: selectedTemplate.header_text });
                if (selectedTemplate.body_text) normalizedComps.push({ type: 'BODY', text: selectedTemplate.body_text });
                if (selectedTemplate.footer_text) normalizedComps.push({ type: 'FOOTER', text: selectedTemplate.footer_text });
            }

            // Construct template payload for Meta API
            const components: any[] = [];
            
            // Handle Header variables or media
            const headerComp = normalizedComps.find(c => (c.type || '').toUpperCase() === 'HEADER');
            if (headerComp) {
                const format = (headerComp.format || '').toUpperCase();
                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
                    components.push({
                        type: 'header',
                        parameters: [{
                            type: format.toLowerCase(),
                            [format.toLowerCase()]: { link: headerUrl }
                        }]
                    });
                } else if (format === 'TEXT') {
                    const headerVars = Object.keys(variables)
                        .filter(k => k.startsWith('HEADER_'))
                        .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
                        .map(k => ({ type: 'text', text: variables[k] }));
                    
                    if (headerVars.length > 0) {
                        components.push({ type: 'header', parameters: headerVars });
                    }
                }
            }

            // Handle Body variables
            const bodyVars = Object.keys(variables)
                .filter(k => k.startsWith('BODY_'))
                .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
                .map(k => ({ type: 'text', text: variables[k] }));

            if (bodyVars.length > 0) {
                components.push({ type: 'body', parameters: bodyVars });
            }

            // Handle Carousel
            const carouselComp = normalizedComps.find(c => (c.type || '').toUpperCase() === 'CAROUSEL');
            if (carouselComp && Array.isArray(carouselComp.cards)) {
                const cards = carouselComp.cards.map((card, i) => {
                    const cardComponents: any[] = [];
                    const cardIndex = i + 1;

                    // Header variables for this card
                    const cardHeaderVars = Object.keys(variables)
                        .filter(k => k.startsWith(`CARD_${cardIndex}_HEADER_`))
                        .sort((a, b) => parseInt(a.split('_')[3]) - parseInt(b.split('_')[3]))
                        .map(k => ({ type: 'text', text: variables[k] }));

                    if (cardHeaderVars.length > 0) {
                        cardComponents.push({ type: 'header', parameters: cardHeaderVars });
                    }

                    // Body variables for this card
                    const cardBodyVars = Object.keys(variables)
                        .filter(k => k.startsWith(`CARD_${cardIndex}_BODY_`))
                        .sort((a, b) => parseInt(a.split('_')[3]) - parseInt(b.split('_')[3]))
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
                    components.push({ type: 'carousel', cards });
                }
            }

            const templatePayload = {
                name: selectedTemplate.name,
                language: { code: selectedTemplate.language },
                components
            };

            onSend(templatePayload);
            onClose();
        } catch (error) {
            console.error('Error sending template:', error);
            alert('Failed to process template variables');
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
                                        {/* Normalize Components for Preview */}
                                        {(() => {
                                            let components: any[] = [];
                                            if (Array.isArray(selectedTemplate?.components)) {
                                                components = selectedTemplate.components;
                                            } else if (typeof selectedTemplate?.components === 'string') {
                                                try { components = JSON.parse(selectedTemplate.components); } catch (e) { components = []; }
                                            }

                                            if (components.length === 0 && selectedTemplate) {
                                                const upperType = (selectedTemplate.template_type || '').toUpperCase();
                                                
                                                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(upperType)) {
                                                    components.push({ type: 'HEADER', format: upperType });
                                                } else if (selectedTemplate.header_text) {
                                                    components.push({ type: 'HEADER', format: 'TEXT', text: selectedTemplate.header_text });
                                                }

                                                if (upperType === 'CAROUSEL' || upperType === 'MEDIA_CARD_CAROUSEL' || Array.isArray(selectedTemplate.cards)) {
                                                    const cards = Array.isArray(selectedTemplate.cards) ? selectedTemplate.cards : [];
                                                    if (cards.length > 0) {
                                                        components.push({ 
                                                            type: 'CAROUSEL', 
                                                            cards: cards.map(card => ({
                                                                components: [
                                                                    ...(card.header ? [card.header] : []),
                                                                    { type: 'BODY', text: card.body || card.body_text || '' },
                                                                    ...(Array.isArray(card.buttons) ? [{ type: 'BUTTONS', buttons: card.buttons }] : [])
                                                                ]
                                                            }))
                                                        });
                                                    }
                                                }

                                                if (selectedTemplate.body_text) components.push({ type: 'BODY', text: selectedTemplate.body_text });
                                                if (selectedTemplate.footer_text) components.push({ type: 'FOOTER', text: selectedTemplate.footer_text });
                                                if (selectedTemplate.buttons) components.push({ type: 'BUTTONS', buttons: selectedTemplate.buttons.buttons || selectedTemplate.buttons });
                                            }

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
                                        {/* Media Selector */}
                                        {(() => {
                                            let comps: any[] = [];
                                            if (Array.isArray(selectedTemplate?.components)) {
                                                comps = selectedTemplate.components;
                                            } else if (typeof selectedTemplate?.components === 'string') {
                                                try { comps = JSON.parse(selectedTemplate.components); } catch (e) { comps = []; }
                                            }
                                            if (comps.length === 0 && selectedTemplate) {
                                                const upperType = (selectedTemplate.template_type || '').toUpperCase();
                                                if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(upperType)) {
                                                    comps.push({ type: 'HEADER', format: upperType });
                                                }
                                            }
                                            
                                            const hasMediaHeader = comps.find(c => (c.type || '').toUpperCase() === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes((c.format || '').toUpperCase()));
                                            
                                            if (!hasMediaHeader) return null;
                                            
                                            return (
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Header Media</label>
                                                    <input
                                                        type="file"
                                                        id="template-media"
                                                        className="hidden"
                                                        onChange={(e) => setHeaderFile(e.target.files?.[0] || null)}
                                                    />
                                                    <label htmlFor="template-media" className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                                                        {headerFile ? (
                                                            <span className="text-xs font-bold text-brand-600 truncate max-w-[200px]">{headerFile.name}</span>
                                                        ) : (
                                                            <>
                                                                <PlusIcon className="w-4 h-4 text-slate-400" />
                                                                <span className="text-xs font-bold text-slate-500">Choose {hasMediaHeader.format} File</span>
                                                            </>
                                                        )}
                                                    </label>
                                                </div>
                                            );
                                        })()}

                                        {Object.keys(variables).sort((a, b) => {
                                            const partsA = a.split('_');
                                            const partsB = b.split('_');
                                            
                                            // Handle CARD_X format
                                            if (partsA[0] === 'CARD' && partsB[0] === 'CARD') {
                                                if (partsA[1] !== partsB[1]) return parseInt(partsA[1]) - parseInt(partsB[1]);
                                                return (partsA[2] === 'HEADER' ? -1 : 1);
                                            }
                                            if (partsA[0] === 'CARD') return 1;
                                            if (partsB[0] === 'CARD') return -1;

                                            const typeOrder: Record<string, number> = { 'HEADER': 1, 'BODY': 2, 'FOOTER': 3 };
                                            if (partsA[0] !== partsB[0]) return (typeOrder[partsA[0]] || 99) - (typeOrder[partsB[0]] || 99);
                                            return parseInt(partsA[1] || '0') - parseInt(partsB[1] || '0');
                                        }).map(key => (
                                            <div key={key}>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 tracking-widest">
                                                    {key.replace(/_/g, ' ')}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                                    placeholder={`Enter value for ${key.replace(/_/g, ' ')}`}
                                                    value={variables[key]}
                                                    onChange={(e) => handleVariableChange(key, e.target.value)}
                                                />
                                            </div>
                                        ))}
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
