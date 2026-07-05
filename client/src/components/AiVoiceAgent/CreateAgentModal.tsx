import React, { useState, useRef } from 'react';

interface CreateAgentModalProps {
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
    initialData?: any;
}

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ onClose, onSave, initialData }) => {
    const [activeTab, setActiveTab] = useState<'identity' | 'model' | 'knowledge' | 'tools'>('identity');
    
    // Tab 1: Identity State
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [systemPrompt, setSystemPrompt] = useState(initialData?.system_prompt || 'You are a helpful AI assistant for customer support.');
    const [type, setType] = useState(initialData?.type || 'chat');
    
    // Tab 2: Model & AI
    const [provider, setProvider] = useState(initialData?.model_config?.provider || 'openai');
    const [apiKey, setApiKey] = useState(initialData?.model_config?.api_key || '');
    const [modelId, setModelId] = useState(initialData?.model_config?.model_id || '');
    const [temperature, setTemperature] = useState(initialData?.model_config?.temperature !== undefined ? initialData.model_config.temperature : 0.7);

    // Tab 3: Knowledge State
    const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([]);
    const [knowledgeUrls, setKnowledgeUrls] = useState<string[]>(initialData?.model_config?.knowledge_urls || []);
    const [urlInput, setUrlInput] = useState('');
    const [faqs, setFaqs] = useState<{question: string, answer: string}[]>(initialData?.model_config?.faqs || []);
    const [faqQuestion, setFaqQuestion] = useState('');
    const [faqAnswer, setFaqAnswer] = useState('');

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
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
                    faqs: faqs,
                    webhook_url: webhookUrl,
                    transfer_number: transferNumber,
                    custom_tools: customTools
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
        setKnowledgeUrls(prev => prev.filter((_, i) => i !== index));
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
        setFaqs(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-slate-900/60 transition-opacity">
            <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-fade-in ring-1 ring-slate-900/5">
                
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">{initialData ? 'Edit AI Agent' : 'Create AI Agent'}</h2>
                        <p className="text-slate-500 text-sm font-medium mt-1">Configure your autonomous assistant</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                    <div className="flex-1 overflow-y-auto p-8 bg-white relative">
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
                                                <option value="voice">🎙️ AI Voice Agent</option>
                                                <option value="call">📞 Call Management</option>
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
                                                <input
                                                    type="text"
                                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800"
                                                    placeholder={provider === 'openrouter' ? 'e.g. meta-llama/llama-3-8b-instruct' : (provider === 'gemini' ? 'e.g. gemini-2.5-flash' : 'e.g. gpt-4o-mini')}
                                                    value={modelId}
                                                    onChange={(e) => setModelId(e.target.value)}
                                                />
                                            </div>
                                            <p className="text-xs font-medium text-slate-400">Overrides the default model (OpenRouter defaults to openai/gpt-4o)</p>
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
