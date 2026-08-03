import React, { useState, useRef } from 'react';

interface CreateAgentModalProps {
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ onClose, onSave, initialData }) => {
    const [activeTab, setActiveTab] = useState<'identity' | 'settings' | 'model' | 'knowledge' | 'tools'>('identity');
    
    // Tab 1: Identity State
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const defaultPrompt = '';
    const [systemPrompt, setSystemPrompt] = useState(initialData?.system_prompt || defaultPrompt);
    const [type, setType] = useState(initialData?.type || 'chat');
    
    // Tab 2: Model & AI
    const [provider, setProvider] = useState(initialData?.model_config?.provider || 'openai');
    const [apiKey, setApiKey] = useState(initialData?.model_config?.api_key || '');
    const [modelId, setModelId] = useState(initialData?.model_config?.model_id || '');
    const [temperature, setTemperature] = useState(initialData?.model_config?.temperature !== undefined ? initialData.model_config.temperature : 0.7);
    const [sttProvider, setSttProvider] = useState(initialData?.model_config?.stt_provider || 'whisper');
    const [ttsProvider, setTtsProvider] = useState(initialData?.model_config?.tts_provider || 'elevenlabs');
    const [ttsVoice, setTtsVoice] = useState(initialData?.model_config?.tts_voice || 'rachel');

    // Tab 3: Knowledge State
    const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
    const [knowledgeUrls, setKnowledgeUrls] = useState<string[]>(initialData?.model_config?.knowledge_urls || []);
    const [urlInput, setUrlInput] = useState('');
    const [faqs, setFaqs] = useState<{question: string, answer: string}[]>(initialData?.model_config?.faqs || []);
    const [faqQuestion, setFaqQuestion] = useState('');
    const [faqAnswer, setFaqAnswer] = useState('');

    // Bot Settings (Formatting & Identity)
    const [responseLength, setResponseLength] = useState(initialData?.model_config?.response_length || 'short');
    const [botTone, setBotTone] = useState(initialData?.model_config?.bot_tone || 'professional');
    const [botGender, setBotGender] = useState(initialData?.model_config?.bot_gender || 'neutral');
    const [showMaxMessages, setShowMaxMessages] = useState(initialData?.model_config?.max_messages !== undefined && initialData?.model_config?.max_messages !== null);
    const [maxMessages, setMaxMessages] = useState(initialData?.model_config?.max_messages || 20);
    const [contextLimit, setContextLimit] = useState(initialData?.model_config?.context_limit || 10);
    const [enableWorkingHours, setEnableWorkingHours] = useState(initialData?.model_config?.working_hours?.enabled || false);
    const [whStart, setWhStart] = useState(initialData?.model_config?.working_hours?.start || '09:00');
    const [whEnd, setWhEnd] = useState(initialData?.model_config?.working_hours?.end || '18:00');
    const [oooMessage, setOooMessage] = useState(initialData?.model_config?.working_hours?.ooo_message || 'We are currently offline. Please leave a message and we will get back to you during our working hours.');
    const [useEmojis, setUseEmojis] = useState(initialData?.model_config?.use_emojis !== undefined ? initialData.model_config.use_emojis : true);
    const [useBulletPoints, setUseBulletPoints] = useState(initialData?.model_config?.use_bullet_points !== undefined ? initialData.model_config.use_bullet_points : true);
    const [headerMessage, setHeaderMessage] = useState(initialData?.model_config?.header_message || '');
    const [footerMessage, setFooterMessage] = useState(initialData?.model_config?.footer_message || '');
    const [fallbackMessage, setFallbackMessage] = useState(initialData?.model_config?.fallback_message || '');
    const [stopKeywords, setStopKeywords] = useState(initialData?.model_config?.stop_keywords || '');
    const [retryAttempt, setRetryAttempt] = useState(initialData?.model_config?.retry_attempt || '');
    const [showHeaderMsg, setShowHeaderMsg] = useState(!!initialData?.model_config?.header_message);
    const [showFooterMsg, setShowFooterMsg] = useState(!!initialData?.model_config?.footer_message);
    const [showFallbackMsg, setShowFallbackMsg] = useState(!!initialData?.model_config?.fallback_message);
    const [showStopKeywords, setShowStopKeywords] = useState(!!initialData?.model_config?.stop_keywords);
    const [showRetryAttempt, setShowRetryAttempt] = useState(!!initialData?.model_config?.retry_attempt);

    // Tab 4: Tools & Actions
    const [webhookUrl, setWebhookUrl] = useState(initialData?.model_config?.webhook_url || '');
    const [transferNumber, setTransferNumber] = useState(initialData?.model_config?.transfer_number || '');
    const [customTools, setCustomTools] = useState<{name: string, description: string, url: string}[]>(initialData?.model_config?.custom_tools || []);
    
    const handleAddCustomTool = () => {
        setCustomTools([...customTools, { name: '', description: '', url: '' }]);
    };
    
    const handleCustomToolChange = (index: number, field: string, value: string) => {
        const newTools = [...customTools];
        newTools[index] = { ...newTools[index], [field]: value };
        setCustomTools(newTools);
    };

    const handleRemoveCustomTool = (index: number) => {
        setCustomTools(customTools.filter((_, i) => i !== index));
    };
    
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Audio Demo State
    const [selectedDemo, setSelectedDemo] = useState('Admission Operation');
    const [isPlayingDemo, setIsPlayingDemo] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const audioFiles: Record<string, string> = {
        'Admission Operation': '/assets/1007073305828481-1773854364318.mp4',
        'Ecommerce': '/assets/ecommerse.m4a',
        'Customer Support': '/assets/demo_support.mp3',
    };

    const handlePlayDemo = () => {
        if (isPlayingDemo) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setIsPlayingDemo(false);
            return;
        }

        const audioSrc = audioFiles[selectedDemo];
        if (audioSrc) {
            const audio = new Audio(audioSrc);
            audioRef.current = audio;
            audio.play();
            setIsPlayingDemo(true);

            audio.onended = () => {
                setIsPlayingDemo(false);
            };
        }
    };

    React.useEffect(() => {
        if (audioRef.current && isPlayingDemo) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingDemo(false);
        }
    }, [selectedDemo]);

    React.useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Auto-append any typed FAQ that hasn't been added yet
            let finalFaqs = [...faqs];
            if (faqQuestion.trim() && faqAnswer.trim()) {
                finalFaqs.push({ question: faqQuestion.trim(), answer: faqAnswer.trim() });
            }

            await onSave({
                name,
                description,
                system_prompt: systemPrompt,
                type,
                model_config: {
                    provider,
                    api_key: apiKey,
                    model_id: modelId,
                    temperature,
                    knowledge_urls: knowledgeUrls,
                    faqs: finalFaqs,
                    webhook_url: webhookUrl,
                    transfer_number: transferNumber,
                    custom_tools: customTools,
                    response_length: responseLength,
                    bot_tone: botTone,
                    bot_gender: botGender,
                    use_emojis: useEmojis,
                    use_bullet_points: useBulletPoints,
                    header_message: showHeaderMsg ? headerMessage : '',
                    footer_message: showFooterMsg ? footerMessage : '',
                    max_messages: showMaxMessages ? maxMessages : null,
                    context_limit: contextLimit,
                    working_hours: {
                        enabled: enableWorkingHours,
                        start: whStart,
                        end: whEnd,
                        timezone: 'Asia/Kolkata',
                        ooo_message: oooMessage
                    },
                    fallback_message: showFallbackMsg ? fallbackMessage : null,
                    stop_keywords: showStopKeywords ? stopKeywords : '',
                    retry_attempt: showRetryAttempt ? retryAttempt : '',
                    stt_provider: type === 'voice' ? sttProvider : undefined,
                    tts_provider: type === 'voice' ? ttsProvider : undefined,
                    tts_voice: type === 'voice' ? ttsVoice : undefined
                },
                knowledgeFiles // processed by parent
            });
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save agent');
        } finally {
            setIsLoading(false);
        }
    };

    // File Handlers
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            setKnowledgeFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    };
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setKnowledgeFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };
    const removeFile = (index: number) => {
        setKnowledgeFiles(prev => prev.filter((_, i) => i !== index));
    };

    // URL Handlers
    const addUrl = () => {
        if (urlInput.trim() && !knowledgeUrls.includes(urlInput.trim())) {
            setKnowledgeUrls(prev => [...prev, urlInput.trim()]);
            setUrlInput('');
        }
    };
    const removeUrl = (index: number) => {
        setKnowledgeUrls(prev => knowledgeUrls.filter((_, i) => i !== index));
    };

    // FAQ Handlers
    const addFaq = () => {
        if (faqQuestion.trim() && faqAnswer.trim()) {
            setFaqs(prev => [...prev, { question: faqQuestion.trim(), answer: faqAnswer.trim() }]);
            setFaqQuestion('');
            setFaqAnswer('');
        }
    };
    const removeFaq = (index: number) => {
        setFaqs(prev => faqs.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-slate-900/60 transition-opacity">
            <div className="bg-white rounded-2xl w-full max-w-6xl xl:max-w-7xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fade-in ring-1 ring-slate-900/5">
                
                {/* Header */}
                <div className="px-8 py-6 border-b-2 border-orange-200 flex justify-between items-center bg-gradient-to-r from-orange-50 to-orange-100/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30 text-white">
                            <span className="text-2xl">🤖</span>
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-orange-950 tracking-tight">{initialData ? 'Edit AI Agent' : 'Create AI Agent'}</h2>
                            <p className="text-orange-700 text-sm font-bold mt-1">Configure your autonomous assistant</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2.5 bg-white border-2 border-orange-200 rounded-xl text-orange-600 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-64 bg-slate-50 border-r border-slate-100 p-6 flex flex-col gap-2 shrink-0 overflow-y-auto">
                        <button 
                            type="button"
                            onClick={() => setActiveTab('identity')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'identity' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                            <span className="text-lg">🤖</span> Identity
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('settings')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'settings' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                            <span className="text-lg">⚙️</span> Bot Settings
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('model')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'model' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                            <span className="text-lg">🧠</span> Model & AI
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('knowledge')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'knowledge' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                            <span className="text-lg">📚</span> Knowledge Base
                        </button>
                        <button 
                            type="button"
                            onClick={() => setActiveTab('tools')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'tools' ? 'bg-white text-brand-600 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                        >
                            <span className="text-lg">🛠️</span> Tools & Actions
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 pt-5 md:p-8 md:pt-6 bg-white relative">
                        <form id="create-agent-form" onSubmit={handleSubmit} className="space-y-8">
                            
                            {/* ----------------- TAB: IDENTITY ----------------- */}
                            <div className={activeTab === 'identity' ? 'block animate-fade-in' : 'hidden'}>
                                <div className="space-y-6">
                                    <div className="flex gap-6">
                                        <div className="flex-1 space-y-2">
                                            <label className="block text-sm font-bold text-slate-700">Agent Name <span className="text-red-500">*</span></label>
                                            <input
                                                required
                                                type="text"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                placeholder="e.g. Support Assistant"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <label className="block text-sm font-bold text-slate-700">Agent Type</label>
                                            <select
                                                value={type}
                                                onChange={(e) => setType(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 cursor-pointer appearance-none"
                                            >
                                                <option value="chat">💬 AI Chatbot</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-700">Short Description</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                            placeholder="What does this agent do?"
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-sm font-bold text-slate-700">System Prompt <span className="text-red-500">*</span></label>
                                            <button type="button" className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 bg-brand-50 px-2 py-1 rounded-md">
                                                ✨ Enhance Prompt
                                            </button>
                                        </div>
                                        <textarea
                                            required
                                            rows={8}
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-mono text-sm text-green-400 shadow-inner resize-none leading-relaxed"
                                            placeholder="You are a helpful assistant..."
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                        />
                                        <p className="text-xs font-medium text-slate-400 mt-2">Define the core identity, rules, and behavioral guidelines for the agent.</p>
                                    </div>

                                    {type === 'voice' && (
                                        <div className="pt-6 border-t border-slate-100">
                                            <div className="bg-[#0f0f13] p-8 rounded-[2rem] shadow-2xl relative overflow-hidden animate-fade-in mt-4">
                                                <div className="text-center mb-8 relative z-10">
                                                    <h2 className="text-2xl font-black text-white mb-2">Voicebot Experience Zone</h2>
                                                    <p className="text-slate-400 max-w-2xl mx-auto font-medium text-sm">Experience how the Voicebot handles real conversations across sectors and languages.</p>
                                                </div>

                                                <div className="flex flex-col md:flex-row gap-8 relative z-10 max-w-5xl mx-auto">
                                                    <div className="w-full md:w-1/3 flex flex-col gap-3">
                                                        <button 
                                                            type="button"
                                                            onClick={() => setSelectedDemo('Admission Operation')}
                                                            className={`py-3 px-4 rounded-xl font-bold transition-all border text-sm ${selectedDemo === 'Admission Operation' ? 'bg-[#9333ea] border-[#9333ea] text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' : 'bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800/50'}`}
                                                        >
                                                            Admission Operation
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setSelectedDemo('Ecommerce')}
                                                            className={`py-3 px-4 rounded-xl font-bold transition-all border text-sm ${selectedDemo === 'Ecommerce' ? 'bg-[#9333ea] border-[#9333ea] text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' : 'bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800/50'}`}
                                                        >
                                                            Ecommerce
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setSelectedDemo('Customer Support')}
                                                            className={`py-3 px-4 rounded-xl font-bold transition-all border text-sm ${selectedDemo === 'Customer Support' ? 'bg-[#9333ea] border-[#9333ea] text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' : 'bg-transparent border-slate-800 text-slate-300 hover:bg-slate-800/50'}`}
                                                        >
                                                            Customer Support
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="flex-1 bg-slate-900/50 rounded-3xl border border-slate-800/50 p-6 flex items-center justify-center relative">
                                                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1">
                                                            {[...Array(16)].map((_, i) => (
                                                                <div key={i} className={`w-1 h-2 rounded-full ${isPlayingDemo ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} style={{ animationDelay: `${i * 0.1}s` }} />
                                                            ))}
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-8 w-full justify-center pb-4">
                                                            <div className="flex flex-col items-center gap-3 relative">
                                                                <div className={`w-20 h-20 rounded-full overflow-hidden border-2 transition-colors ${isPlayingDemo ? 'border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.5)]' : 'border-slate-700'} relative`}>
                                                                    <img src="/assets/professional_calling_bot.png" alt="AI Assistant" className="w-full h-full object-cover" />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-slate-500 tracking-[0.1em] uppercase">AI Assistant</span>
                                                            </div>

                                                            <button 
                                                                type="button"
                                                                onClick={handlePlayDemo}
                                                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isPlayingDemo ? 'bg-indigo-600 text-white shadow-[0_0_30px_rgba(79,70,229,0.5)] scale-110' : 'bg-white text-slate-900 hover:scale-105'}`}
                                                            >
                                                                {isPlayingDemo ? (
                                                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                                                                ) : (
                                                                    <svg className="w-6 h-6 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                                )}
                                                            </button>

                                                            <div className="flex flex-col items-center gap-3 relative">
                                                                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-700 grayscale brightness-75">
                                                                    <img src="/assets/indian_customer_avatar.png" alt="Customer" className="w-full h-full object-cover" />
                                                                </div>
                                                                <span className="text-[9px] font-bold text-slate-500 tracking-[0.1em] uppercase">Customer</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ----------------- TAB: MODEL & AI ----------------- */}
                            <div className={activeTab === 'model' ? 'block animate-fade-in' : 'hidden'}>
                                <div className="space-y-8">
                                    <div className="space-y-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-800 mb-1">AI Provider Configuration</h3>
                                            <p className="text-sm text-slate-500 font-medium">Select the NLP engine to power your agent.</p>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <label className="block text-sm font-bold text-slate-700">Select Provider</label>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider('openai');
                                                        setModelId('gpt-4o');
                                                    }}
                                                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${provider === 'openai' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                                >
                                                    <span className="text-2xl">🤖</span>
                                                    <span className={`font-bold text-sm ${provider === 'openai' ? 'text-brand-700' : 'text-slate-600'}`}>OpenAI</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider('gemini');
                                                        setModelId('gemini-2.5-flash');
                                                    }}
                                                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${provider === 'gemini' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                                >
                                                    <span className="text-2xl">✨</span>
                                                    <span className={`font-bold text-sm ${provider === 'gemini' ? 'text-brand-700' : 'text-slate-600'}`}>Google Gemini</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider('claude');
                                                        setModelId('claude-3-5-sonnet-20240620');
                                                    }}
                                                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${provider === 'claude' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                                >
                                                    <span className="text-2xl">🧠</span>
                                                    <span className={`font-bold text-sm ${provider === 'claude' ? 'text-brand-700' : 'text-slate-600'}`}>Anthropic Claude</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setProvider('openrouter');
                                                        setModelId('');
                                                    }}
                                                    className={`p-4 border rounded-xl flex flex-col items-center gap-2 transition-all ${provider === 'openrouter' ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                                >
                                                    <span className="text-2xl">⚡</span>
                                                    <span className={`font-bold text-sm ${provider === 'openrouter' ? 'text-brand-700' : 'text-slate-600'}`}>OpenRouter</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <label className="block text-sm font-bold text-slate-700">Provider API Key</label>
                                            <div className="relative">
                                                <input
                                                    type="password"
                                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                    placeholder="sk-..."
                                                    value={apiKey}
                                                    onChange={(e) => setApiKey(e.target.value)}
                                                />
                                                <svg className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                                            </div>
                                            <p className="text-xs font-medium text-slate-400">Your key is stored securely and never shared.</p>
                                        </div>

                                        <div className="space-y-2 pt-2">
                                            <label className="block text-sm font-bold text-slate-700">Specific Model ID (Optional)</label>
                                            <div className="relative">
                                                {provider === 'openrouter' ? (
                                                    <select
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 appearance-none"
                                                        value={modelId || 'openai/gpt-4o-mini'}
                                                        onChange={(e) => setModelId(e.target.value)}
                                                    >
                                                        <option value="openai/gpt-4o">OpenAI: GPT-4o</option>
                                                        <option value="openai/gpt-4o-mini">OpenAI: GPT-4o Mini</option>
                                                        <option value="openai/gpt-4.1-nano">OpenAI: GPT-4.1 Nano</option>
                                                        <option value="openai/gpt-oss-20b:free">OpenAI: GPT-OSS 20B (Free)</option>
                                                        <option value="google/gemini-2.5-flash">Google: Gemini 2.5 Flash</option>
                                                        <option value="google/gemini-2.5-flash-lite">Google: Gemini 2.5 Flash Lite</option>
                                                        <option value="anthropic/claude-3.5-sonnet">Anthropic: Claude 3.5 Sonnet</option>
                                                        <option value="tencent/hy3:free">Tencent: Hunyuan 3 (Free)</option>
                                                        <option value="poolside/laguna-xs-2.1:free">Poolside: Laguna XS (Free)</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                        placeholder={provider === 'gemini' ? 'e.g. gemini-2.5-flash' : 'e.g. gpt-4o-mini'}
                                                        value={modelId}
                                                        onChange={(e) => setModelId(e.target.value)}
                                                    />
                                                )}
                                                {provider === 'openrouter' && (
                                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                                        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs font-medium text-slate-400">
                                                {provider === 'openrouter' ? 'Select a model. Ensure the model supports tool calling for webhooks.' : 'Overrides the default model'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-4 border-t border-slate-100">
                                        <div className="flex justify-between">
                                            <label className="block text-sm font-bold text-slate-700">Creativity (Temperature)</label>
                                            <span className="text-sm font-bold text-brand-600">{temperature}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" 
                                            max="1" 
                                            step="0.1" 
                                            value={temperature}
                                            onChange={(e) => setTemperature(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-600 mt-2 mb-2"
                                        />
                                        <div className="flex justify-between text-xs font-medium text-slate-400">
                                            <span>0.0 (Precise & Factual)</span>
                                            <span>1.0 (Creative & Loose)</span>
                                        </div>
                                    </div>
                                    
                                    {type === 'voice' && (
                                        <div className="space-y-6 pt-6 border-t border-slate-100">
                                            <h3 className="text-lg font-bold text-slate-800">Voice Configuration (STT/TTS)</h3>
                                            <div className="flex gap-6">
                                                <div className="flex-1 space-y-2">
                                                    <label className="block text-sm font-bold text-slate-700">Speech-to-Text (STT) Provider</label>
                                                    <select
                                                        value={sttProvider}
                                                        onChange={(e) => setSttProvider(e.target.value)}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 appearance-none"
                                                    >
                                                        <option value="whisper">OpenAI Whisper</option>
                                                        <option value="deepgram">Deepgram (Fast)</option>
                                                        <option value="google">Google Cloud STT</option>
                                                    </select>
                                                </div>
                                                <div className="flex-1 space-y-2">
                                                    <label className="block text-sm font-bold text-slate-700">Text-to-Speech (TTS) Provider</label>
                                                    <select
                                                        value={ttsProvider}
                                                        onChange={(e) => setTtsProvider(e.target.value)}
                                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 appearance-none"
                                                    >
                                                        <option value="elevenlabs">ElevenLabs</option>
                                                        <option value="openai">OpenAI TTS</option>
                                                        <option value="playht">PlayHT</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-bold text-slate-700">Voice Selection (TTS Voice)</label>
                                                <select
                                                    value={ttsVoice}
                                                    onChange={(e) => setTtsVoice(e.target.value)}
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 appearance-none"
                                                >
                                                    <option value="rachel">Rachel (Female - ElevenLabs)</option>
                                                    <option value="adam">Adam (Male - ElevenLabs)</option>
                                                    <option value="alloy">Alloy (Neutral - OpenAI)</option>
                                                    <option value="shimmer">Shimmer (Female - OpenAI)</option>
                                                    <option value="william">William (Male - PlayHT)</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ----------------- TAB: KNOWLEDGE BASE ----------------- */}
                            <div className={activeTab === 'knowledge' ? 'block animate-fade-in' : 'hidden'}>
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-slate-800">Train Your Agent</h3>
                                    <p className="text-sm text-slate-500 font-medium">Upload documents or link URLs to build the agent's contextual knowledge.</p>
                                </div>

                                <div className="space-y-6">
                                    {/* Web Scraping Input */}
                                    <div className="space-y-2">
                                        <label className="block text-sm font-bold text-slate-700">Add Website URL for Scraping</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                placeholder="https://example.com/docs"
                                                value={urlInput}
                                                onChange={(e) => setUrlInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                                            />
                                            <button 
                                                type="button"
                                                onClick={addUrl}
                                                className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors"
                                            >
                                                Add URL
                                            </button>
                                        </div>
                                    </div>

                                    {/* URL List */}
                                    {knowledgeUrls.length > 0 && (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Websites to Crawl</h4>
                                            {knowledgeUrls.map((url, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white p-2.5 px-4 rounded-lg border border-slate-100 shadow-sm">
                                                    <span className="text-sm font-medium text-slate-700 truncate flex-1 flex items-center gap-2">
                                                        <span className="text-blue-500">🌐</span> {url}
                                                    </span>
                                                    <button type="button" onClick={() => removeUrl(i)} className="text-slate-400 hover:text-red-500 ml-3">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Manual Q&A / FAQs */}
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-700">Manual Q&A (FAQs)</h4>
                                        <div className="flex flex-col gap-2">
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 text-sm"
                                                placeholder="Question (e.g., What are your hours?)"
                                                value={faqQuestion}
                                                onChange={(e) => setFaqQuestion(e.target.value)}
                                            />
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 text-sm"
                                                    placeholder="Answer (e.g., We are open 9AM to 5PM)"
                                                    value={faqAnswer}
                                                    onChange={(e) => setFaqAnswer(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFaq())}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={addFaq}
                                                    className="px-5 py-2.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-colors text-sm shrink-0"
                                                >
                                                    Add FAQ
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* FAQ List */}
                                    {faqs.length > 0 && (
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom FAQs</h4>
                                            {faqs.map((faq, i) => (
                                                <div key={i} className="flex items-start justify-between bg-white p-3 px-4 rounded-lg border border-slate-100 shadow-sm gap-4">
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="text-sm font-bold text-slate-700 truncate"><span className="text-brand-500 mr-1">Q:</span> {faq.question}</p>
                                                        <p className="text-xs text-slate-500 truncate mt-0.5"><span className="text-slate-400 mr-1">A:</span> {faq.answer}</p>
                                                    </div>
                                                    <button type="button" onClick={() => removeFaq(i)} className="text-slate-400 hover:text-red-500 shrink-0">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* File Uploader */}
                                    <div 
                                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleFileDrop}
                                        className={`relative w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all mt-4 ${isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-slate-400'} cursor-pointer`}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input 
                                            type="file" 
                                            multiple 
                                            className="hidden" 
                                            ref={fileInputRef}
                                            onChange={handleFileSelect}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                                            <svg className={`w-8 h-8 ${isDragging ? 'text-brand-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                        </div>
                                        <p className="font-bold text-slate-700">Click to upload documents or drag & drop</p>
                                        <p className="text-xs text-slate-500 mt-1 font-medium">PDF, TXT, DOCX, CSV (Max 10MB)</p>
                                    </div>

                                    {/* File List */}
                                    {knowledgeFiles.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Staged Documents</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-40 overflow-y-auto pr-2">
                                                {knowledgeFiles.map((file, i) => (
                                                    <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="text-sm font-bold text-slate-700 truncate">{file.name}</p>
                                                                <p className="text-xs text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                                            </div>
                                                        </div>
                                                        <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ----------------- TAB: TOOLS & ACTIONS ----------------- */}
                            <div className={activeTab === 'tools' ? 'block animate-fade-in' : 'hidden'}>
                                <div className="space-y-6">
                                    <div className="mb-6">
                                        <h3 className="text-lg font-bold text-slate-800">Agent Capabilities</h3>
                                        <p className="text-sm text-slate-500 font-medium">Equip your agent with tools to perform actions during a conversation.</p>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Dynamic Custom Webhook Tools */}
                                        <div className="flex items-center justify-between mt-4">
                                            <div>
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <span className="text-xl">🛠️</span> Custom Webhook Tools
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-1">Teach the AI to perform custom actions by calling your APIs.</p>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={handleAddCustomTool}
                                                className="px-3 py-1.5 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                            >
                                                <span>+ Add Custom Tool</span>
                                            </button>
                                        </div>
                                        
                                        {customTools.length === 0 && (
                                            <div className="p-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center gap-3">
                                                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-2xl">🪄</div>
                                                <div>
                                                    <h5 className="font-bold text-slate-700">No Custom Tools Yet</h5>
                                                    <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                                                        Add tools like <strong>check_inventory</strong> or <strong>book_meeting</strong>. The AI will read your prompt and automatically hit your webhook when needed!
                                                    </p>
                                                </div>
                                                <button type="button" onClick={handleAddCustomTool} className="mt-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 shadow-sm transition-colors">
                                                    Create First Tool
                                                </button>
                                            </div>
                                        )}

                                        {customTools.map((tool, index) => (
                                            <div key={index} className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col gap-4 relative group">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveCustomTool(index)}
                                                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-8">
                                                    <div>
                                                        <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">Tool Name (snake_case)</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-sm text-slate-800"
                                                            placeholder="e.g., check_inventory"
                                                            value={tool.name}
                                                            onChange={(e) => handleCustomToolChange(index, 'name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">Webhook URL</label>
                                                        <input
                                                            type="url"
                                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-sm text-slate-800"
                                                            placeholder="https://api.yourdomain.com/webhook"
                                                            value={tool.url}
                                                            onChange={(e) => handleCustomToolChange(index, 'url', e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="md:col-span-2">
                                                        <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block flex items-center gap-2">
                                                            Tool Prompt / Instructions 
                                                            <span className="text-brand-500 normal-case tracking-normal font-normal text-[10px] bg-brand-50 px-2 py-0.5 rounded-full">AI reads this</span>
                                                        </label>
                                                        <textarea
                                                            rows={2}
                                                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-sm text-slate-800 resize-none"
                                                            placeholder="Example: Trigger this tool to check stock levels. ONLY call this when the user asks if an item is available."
                                                            value={tool.description}
                                                            onChange={(e) => handleCustomToolChange(index, 'description', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <hr className="border-slate-100 my-4" />

                                        {/* Transfer Call Tool */}
                                        <div className="p-5 border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                                                    <span className="text-xl">📞</span>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800">Transfer to Human</h4>
                                                    <p className="text-xs text-slate-500 font-medium">Agent will transfer the call/chat to this number if it gets stuck.</p>
                                                </div>
                                            </div>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 text-sm"
                                                placeholder="+1 (555) 000-0000"
                                                value={transferNumber}
                                                onChange={(e) => setTransferNumber(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ----------------- TAB: SETTINGS ----------------- */}
                            <div className={activeTab === 'settings' ? 'block animate-fade-in' : 'hidden'}>
                                <div className="space-y-5">
                                    <div className="mb-2">
                                        <h3 className="text-lg font-bold text-slate-800">Bot Settings</h3>
                                        <p className="text-sm text-slate-500 font-medium">Configure answer formatting and bot identity.</p>
                                    </div>

                                    {/* Answer Formatting */}
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold text-slate-700 border-b pb-2">Answer formatting</h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700">Length of responses</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['descriptive', 'medium', 'short'].map(len => (
                                                        <button
                                                            key={len}
                                                            type="button"
                                                            onClick={() => setResponseLength(len)}
                                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${responseLength === len ? 'bg-slate-100 text-slate-800 border-2 border-slate-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            {responseLength === len && '✓ '} {len.charAt(0).toUpperCase() + len.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700">Formatting toggles</label>
                                                <div className="flex flex-row flex-wrap gap-5 pt-1">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={useEmojis} onChange={(e) => setUseEmojis(e.target.checked)} className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500" />
                                                        <span className="text-sm font-bold text-slate-700">Use emojis</span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" checked={useBulletPoints} onChange={(e) => setUseBulletPoints(e.target.checked)} className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500" />
                                                        <span className="text-sm font-bold text-slate-700">Use bullet points</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bot Identity */}
                                    <div className="space-y-3 pt-3 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-700 border-b pb-2">Bot Identity</h4>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700">Chatbot tone</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['matter_of_fact', 'friendly', 'humorous', 'neutral', 'professional'].map(t => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => setBotTone(t)}
                                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${botTone === t ? 'bg-slate-100 text-slate-800 border-2 border-slate-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            {botTone === t && '✓ '} {t.replace('_', ' ').charAt(0).toUpperCase() + t.replace('_', ' ').slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <label className="block text-sm font-bold text-slate-700">Chatbot gender</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {['female', 'male', 'neutral'].map(g => (
                                                        <button
                                                            key={g}
                                                            type="button"
                                                            onClick={() => setBotGender(g)}
                                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${botGender === g ? 'bg-slate-100 text-slate-800 border-2 border-slate-300' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                                                        >
                                                            {botGender === g && '✓ '} {g.charAt(0).toUpperCase() + g.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advanced Settings */}
                                    <div className="space-y-3 pt-3 border-t border-slate-100">
                                        <h4 className="text-sm font-bold text-slate-700 border-b pb-2">Advanced settings</h4>
                                        
                                        <div className="space-y-2">
                                            {/* Header Item */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${showHeaderMsg ? 'bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowHeaderMsg(!showHeaderMsg)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showHeaderMsg ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">⬆️</span>
                                                        </div>
                                                        <div>
                                                            <h5 className={`text-sm font-bold transition-colors ${showHeaderMsg ? 'text-brand-900' : 'text-slate-700'}`}>Header Message</h5>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Automatically add a message to the beginning of every response.</p>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-3 cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                        <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${showHeaderMsg ? 'bg-brand-500' : 'bg-slate-300'}`}>
                                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${showHeaderMsg ? 'translate-x-6' : ''}`} />
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={showHeaderMsg} onChange={(e) => setShowHeaderMsg(e.target.checked)} />
                                                    </label>
                                                </div>
                                                {showHeaderMsg && (
                                                    <div className="p-4 pt-0 bg-white animate-fade-in">
                                                        <div className="mt-2 relative">
                                                            <input type="text" value={headerMessage} onChange={(e) => setHeaderMessage(e.target.value)} placeholder="e.g. *Auto-Reply:*" className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 focus:bg-slate-50 hover:border-slate-300 shadow-sm transition-all" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer Item */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${showFooterMsg ? 'bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowFooterMsg(!showFooterMsg)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showFooterMsg ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">⬇️</span>
                                                        </div>
                                                        <div>
                                                            <h5 className={`text-sm font-bold transition-colors ${showFooterMsg ? 'text-brand-900' : 'text-slate-700'}`}>Footer Message</h5>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Automatically append a message to the end of every response.</p>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-3 cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                        <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${showFooterMsg ? 'bg-brand-500' : 'bg-slate-300'}`}>
                                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${showFooterMsg ? 'translate-x-6' : ''}`} />
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={showFooterMsg} onChange={(e) => setShowFooterMsg(e.target.checked)} />
                                                    </label>
                                                </div>
                                                {showFooterMsg && (
                                                    <div className="p-4 pt-0 bg-white animate-fade-in">
                                                        <div className="mt-2 relative">
                                                            <input type="text" value={footerMessage} onChange={(e) => setFooterMessage(e.target.value)} placeholder="e.g. Reply STOP to unsubscribe." className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 focus:bg-slate-50 hover:border-slate-300 shadow-sm transition-all" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stop Keywords */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${showStopKeywords ? 'bg-white border-red-400 ring-4 ring-red-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowStopKeywords(!showStopKeywords)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showStopKeywords ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">🛑</span>
                                                        </div>
                                                        <div>
                                                            <h4 className={`text-sm font-bold transition-colors ${showStopKeywords ? 'text-red-900' : 'text-slate-700'}`}>Stop Keywords</h4>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Mute the AI automatically if the user sends these specific words.</p>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-3 cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                        <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${showStopKeywords ? 'bg-red-500' : 'bg-slate-300'}`}>
                                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${showStopKeywords ? 'translate-x-6' : ''}`} />
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={showStopKeywords} onChange={(e) => setShowStopKeywords(e.target.checked)} />
                                                    </label>
                                                </div>
                                                {showStopKeywords && (
                                                    <div className="p-4 pt-0 bg-white animate-fade-in">
                                                        <div className="mt-2 relative">
                                                            <input type="text" value={stopKeywords} onChange={(e) => setStopKeywords(e.target.value)} placeholder="e.g. STOP, UNSUBSCRIBE, HALT (comma separated)" className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-red-500 focus:bg-slate-50 hover:border-slate-300 shadow-sm transition-all" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Max Messages Limit */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${showMaxMessages ? 'bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowMaxMessages(!showMaxMessages)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showMaxMessages ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">💬</span>
                                                        </div>
                                                        <div>
                                                            <h4 className={`text-sm font-bold transition-colors ${showMaxMessages ? 'text-brand-900' : 'text-slate-700'}`}>Max Messages Limit</h4>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Stop AI after the user sends a certain number of messages.</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-11 h-6 rounded-full transition-colors relative ${showMaxMessages ? 'bg-brand-500' : 'bg-slate-300'}`}>
                                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${showMaxMessages ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                </div>
                                                
                                                {showMaxMessages && (
                                                    <div className="p-4 pt-0 border-t border-slate-100 bg-white">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-0">Session Message Limit</label>
                                                            <input 
                                                                type="number" 
                                                                value={maxMessages} 
                                                                onChange={(e) => setMaxMessages(parseInt(e.target.value) || 20)} 
                                                                min="1"
                                                                max="100"
                                                                className="w-24 px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/20 focus:border-brand-400 focus:bg-white outline-none transition-all font-bold text-sm text-slate-800 text-center"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Context Limit */}
                                            <div className="rounded-xl border bg-slate-50 border-slate-200 overflow-hidden">
                                                <div className="p-4 flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center shrink-0">
                                                            <span className="text-lg">🧠</span>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-700">Context Memory Limit</h4>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Number of previous messages the AI remembers.</p>
                                                        </div>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        value={contextLimit} 
                                                        onChange={(e) => setContextLimit(parseInt(e.target.value) || 10)} 
                                                        min="1"
                                                        max="50"
                                                        className="w-24 px-3 py-2 bg-white border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-brand-500/20 focus:border-brand-400 outline-none font-bold text-sm text-slate-800 text-center"
                                                    />
                                                </div>
                                            </div>

                                            {/* Working Hours */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${enableWorkingHours ? 'bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setEnableWorkingHours(!enableWorkingHours)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${enableWorkingHours ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">🕒</span>
                                                        </div>
                                                        <div>
                                                            <h4 className={`text-sm font-bold transition-colors ${enableWorkingHours ? 'text-brand-900' : 'text-slate-700'}`}>Working Hours (IST)</h4>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Restrict AI responses to business hours.</p>
                                                        </div>
                                                    </div>
                                                    <div className={`w-11 h-6 rounded-full transition-colors relative ${enableWorkingHours ? 'bg-brand-500' : 'bg-slate-300'}`}>
                                                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${enableWorkingHours ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                                    </div>
                                                </div>
                                                
                                                {enableWorkingHours && (
                                                    <div className="p-4 pt-0 border-t border-slate-100 bg-white grid grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-2">Start Time</label>
                                                            <input 
                                                                type="time" 
                                                                value={whStart} 
                                                                onChange={(e) => setWhStart(e.target.value)} 
                                                                className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-brand-400 outline-none font-bold text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-2">End Time</label>
                                                            <input 
                                                                type="time" 
                                                                value={whEnd} 
                                                                onChange={(e) => setWhEnd(e.target.value)} 
                                                                className="w-full px-3 py-2 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-brand-400 outline-none font-bold text-sm"
                                                            />
                                                        </div>
                                                        <div className="col-span-2 mt-2">
                                                            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-2">Out of Office Message</label>
                                                            <textarea 
                                                                value={oooMessage} 
                                                                onChange={(e) => setOooMessage(e.target.value)} 
                                                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-brand-400 outline-none font-medium text-sm text-slate-800"
                                                                rows={2}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Retry Attempt */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${showRetryAttempt ? 'bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowRetryAttempt(!showRetryAttempt)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showRetryAttempt ? 'bg-brand-100 text-brand-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">🔄</span>
                                                        </div>
                                                        <div>
                                                            <h5 className={`text-sm font-bold transition-colors ${showRetryAttempt ? 'text-brand-900' : 'text-slate-700'}`}>Retry Attempts</h5>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Number of automatic retries if the AI API fails.</p>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-3 cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                        <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${showRetryAttempt ? 'bg-brand-500' : 'bg-slate-300'}`}>
                                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${showRetryAttempt ? 'translate-x-6' : ''}`} />
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={showRetryAttempt} onChange={(e) => setShowRetryAttempt(e.target.checked)} />
                                                    </label>
                                                </div>
                                                {showRetryAttempt && (
                                                    <div className="p-4 pt-0 bg-white animate-fade-in">
                                                        <div className="mt-2 relative">
                                                            <input type="number" min="0" max="5" value={retryAttempt} onChange={(e) => setRetryAttempt(e.target.value)} placeholder="e.g. 3" className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-brand-500 focus:bg-slate-50 hover:border-slate-300 shadow-sm transition-all" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Fallback Message */}
                                            <div className={`rounded-xl border transition-all overflow-hidden ${showFallbackMsg ? 'bg-white border-brand-400 ring-4 ring-brand-500/10 shadow-md' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setShowFallbackMsg(!showFallbackMsg)}>
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${showFallbackMsg ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            <span className="text-lg">⚠️</span>
                                                        </div>
                                                        <div>
                                                            <h5 className={`text-sm font-bold transition-colors ${showFallbackMsg ? 'text-amber-900' : 'text-slate-700'}`}>Fallback Message</h5>
                                                            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Custom message sent when the AI encounters an unrecoverable error.</p>
                                                        </div>
                                                    </div>
                                                    <label className="flex items-center gap-3 cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                        <div className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${showFallbackMsg ? 'bg-amber-500' : 'bg-slate-300'}`}>
                                                            <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${showFallbackMsg ? 'translate-x-6' : ''}`} />
                                                        </div>
                                                        <input type="checkbox" className="hidden" checked={showFallbackMsg} onChange={(e) => setShowFallbackMsg(e.target.checked)} />
                                                    </label>
                                                </div>
                                                {showFallbackMsg && (
                                                    <div className="p-4 pt-0 bg-white animate-fade-in">
                                                        <div className="mt-2 relative">
                                                            <input type="text" value={fallbackMessage} onChange={(e) => setFallbackMessage(e.target.value)} placeholder="I'm sorry, I cannot help right now." className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-amber-500 focus:bg-slate-50 hover:border-slate-300 shadow-sm transition-all" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </form>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                    <p className="text-xs text-slate-400 font-medium flex items-center gap-1">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        All configuration is encrypted at rest
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-bold transition-colors shadow-sm"
                        >
                            Cancel
                        </button>
                        <button
                            form="create-agent-form"
                            type="submit"
                            disabled={isLoading}
                            className="px-6 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold shadow-lg shadow-brand-200 disabled:opacity-70 flex items-center gap-2 transition-all hover:-translate-y-0.5"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Saving...
                                </>
                            ) : (initialData ? '💾 Save Changes' : '🚀 Deploy Agent')}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CreateAgentModal;
