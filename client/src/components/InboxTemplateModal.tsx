import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CloseIcon, SearchIcon, ImageFileIcon, VideoFileIcon, DocumentFileIcon, CheckIcon, PlusIcon, BadgeIcon } from './icons';
import { inboxService } from '../services/inboxService';

interface Template {
    id: string;
    name: string;
    language: string;
    category: string;
    components: any[];
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
        
        // Extract variables from components
        const vars: Record<string, string> = {};
        template.components.forEach(comp => {
            if (comp.text) {
                const matches = comp.text.match(/\{\{\d+\}\}/g);
                if (matches) {
                    matches.forEach((match: string) => {
                        const num = match.replace(/[{}]/g, '');
                        vars[${comp.type}_] = '';
                    });
                }
            }
        });
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

            // Construct template payload for Meta API
            const components: any[] = [];
            
            // Handle Header variables or media
            const headerComp = selectedTemplate.components.find(c => c.type === 'HEADER');
            if (headerComp) {
                if (headerComp.format === 'IMAGE' || headerComp.format === 'VIDEO' || headerComp.format === 'DOCUMENT') {
                    components.push({
                        type: 'header',
                        parameters: [{
                            type: headerComp.format.toLowerCase(),
                            [headerComp.format.toLowerCase()]: { link: headerUrl }
                        }]
                    });
                } else if (headerComp.format === 'TEXT') {
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
                .sort((a, b) => {
                    const numA = parseInt(a.split('_')[1]);
                    const numB = parseInt(b.split('_')[1]);
                    return numA - numB;
                })
                .map(k => ({ type: 'text', text: variables[k] }));

            if (bodyVars.length > 0) {
                components.push({ type: 'body', parameters: bodyVars });
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

    const filteredTemplates = templates.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase())
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
                                        className={w-full text-left p-3 rounded-2xl mb-1 transition-all duration-200 group }
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={	ext-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded }>
                                                {t.category.replace(/_/g, ' ')}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">{t.language}</span>
                                        </div>
                                        <span className={	ext-sm font-bold block truncate }>
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
                                        {/* Dynamic Header Preview */}
                                        {selectedTemplate.components.find(c => c.type === 'HEADER')?.format === 'IMAGE' && (
                                            <div className="aspect-video bg-slate-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                                                {headerFile ? (
                                                    <img src={URL.createObjectURL(headerFile)} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ImageFileIcon className="w-8 h-8 text-slate-300" />
                                                )}
                                            </div>
                                        )}
                                        
                                        {selectedTemplate.components.map((comp, idx) => {
                                            if (comp.type === 'HEADER' && comp.format === 'TEXT') {
                                                let text = comp.text;
                                                const matches = text.match(/\{\{\d+\}\}/g);
                                                if (matches) {
                                                    matches.forEach((match: string) => {
                                                        const num = match.replace(/[{}]/g, '');
                                                        text = text.replace(match, variables[HEADER_] || [Variable ]);
                                                    });
                                                }
                                                return <h4 key={idx} className="font-bold text-slate-800 mb-2">{text}</h4>;
                                            }
                                            if (comp.type === 'BODY') {
                                                let text = comp.text;
                                                const matches = text.match(/\{\{\d+\}\}/g);
                                                if (matches) {
                                                    matches.forEach((match: string) => {
                                                        const num = match.replace(/[{}]/g, '');
                                                        text = text.replace(match, variables[BODY_] || [Variable ]);
                                                    });
                                                }
                                                return <p key={idx} className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{text}</p>;
                                            }
                                            if (comp.type === 'FOOTER') {
                                                return <p key={idx} className="text-[10px] text-slate-400 mt-2 uppercase tracking-tighter">{comp.text}</p>;
                                            }
                                            return null;
                                        })}
                                        <div className="absolute bottom-1 right-2">
                                            <span className="text-[9px] text-slate-300">12:00 PM</span>
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
                                        {selectedTemplate.components.find(c => c.type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(c.format)) && (
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
                                                            <span className="text-xs font-bold text-slate-500">Choose Media File</span>
                                                        </>
                                                    )}
                                                </label>
                                            </div>
                                        )}

                                        {Object.keys(variables).sort((a, b) => {
                                            const typeA = a.split('_')[0];
                                            const typeB = b.split('_')[0];
                                            if (typeA !== typeB) return typeA === 'HEADER' ? -1 : 1;
                                            return parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]);
                                        }).map(key => (
                                            <div key={key}>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1 tracking-widest">
                                                    {key.replace('_', ' ')}
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
                                                    placeholder={Enter value for }
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
                                className={px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all flex items-center gap-2
                                    }
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
