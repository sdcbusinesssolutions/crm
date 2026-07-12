import React, { useEffect, useState, useRef } from 'react';
import { MicrophoneIcon, RobotIcon, PhoneIcon, TrashIcon, DocumentFileIcon as DocumentIcon } from '../icons';
import { aiAgentService, Agent } from '../../services/aiAgentService';
import CreateAgentModal from './CreateAgentModal';
import AgentChatModal from './AgentChatModal';
import AiAgentAnalytics from './AiAgentAnalytics';
import { format } from 'date-fns';
import { usePermissions, ACCESS_TYPES } from '../../modules/teamStaff/hooks/usePermissions';

const AiVoiceAgentView: React.FC = () => {
    const { hasAccess } = usePermissions();
    const canRead = hasAccess('AI Buddy', ACCESS_TYPES.READ);
    const canWrite = hasAccess('AI Buddy', ACCESS_TYPES.READ_WRITE);
    const canDelete = hasAccess('AI Buddy', ACCESS_TYPES.ALL_ACCESS);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [chattingWith, setChattingWith] = useState<Agent | null>(null);

    // Upload State
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    // Delete Modal State
    const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null);

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Create Modal State with Type
    const [createType, setCreateType] = useState<'chat' | 'voice' | null>(null);

    // Tab State for View Mode
    const [activeViewTab, setActiveViewTab] = useState<'agents' | 'analytics'>('agents');

    useEffect(() => {
        if (canRead) {
            loadAgents();
        }
    }, [refreshTrigger, canRead]);

    const loadAgents = async () => {
        setLoading(true);
        try {
            const data = await aiAgentService.listAgents();
            setAgents(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data: any) => {
        if (!canWrite) return;
        try {
            const { knowledgeFiles, ...agentData } = data;
            
            let targetAgentId = '';

            if (editingAgent) {
                const updated = await aiAgentService.updateAgent(editingAgent.id, agentData);
                targetAgentId = updated.id;
            } else {
                const newAgent = await aiAgentService.createAgent(agentData);
                targetAgentId = newAgent.id;
            }
            
            // Upload knowledge base files if any
            if (knowledgeFiles && knowledgeFiles.length > 0) {
                setUploadingFor(targetAgentId);
                for (const file of knowledgeFiles) {
                    try {
                        await aiAgentService.uploadKnowledge(targetAgentId, file);
                    } catch (err) {
                        console.error(`Failed to upload file ${file.name}:`, err);
                    }
                }
                setUploadingFor(null);
            }
            
            setRefreshTrigger(prev => prev + 1);
            setEditingAgent(null);
            setIsCreating(false);
            setCreateType(null);
        } catch (err: any) {
            console.error(err);
            alert('Failed to save agent: ' + (err.message || 'Unknown error'));
        }
    };

    const performDelete = async (id: string) => {
        if (!canDelete) return;
        try {
            await aiAgentService.deleteAgent(id);
            setRefreshTrigger(prev => prev + 1);
            setAgentToDelete(null);
        } catch (e) {
            alert('Failed to delete');
        }
    };

    const handleCreateDemoSalesAgent = async () => {
        if (!canWrite) return;
        try {
            setLoading(true);
            const agentData = {
                name: "Demo Sales Rep (Alex)",
                description: "An aggressive but polite B2B SDR that qualifies leads and books meetings.",
                system_prompt: "You are Alex, an expert Sales Development Representative. Your goal is to qualify the prospect and book a demo. Be extremely polite, very concise, and always drive the conversation toward a meeting. Use the 'book_demo' tool if they agree to a meeting.",
                type: "chat" as const,
                model_config: {
                    provider: "openai",
                    api_key: "",
                    model_id: "gpt-4o",
                    temperature: 0.7,
                    knowledge_urls: [],
                    faqs: [
                        { question: "How much does it cost?", answer: "Our pricing starts at $499/mo, but I'd love to set up a demo to get you a custom quote." },
                        { question: "What do you do?", answer: "We build advanced AI voice agents that automate customer service and sales." }
                    ],
                    webhook_url: "",
                    transfer_number: "+18005550199",
                    max_messages: 20,
                    stop_keywords: "stop, unsubscribe, cancel",
                    use_emojis: true,
                    use_bullet_points: true,
                    bot_tone: "professional",
                    response_length: "short",
                    bot_gender: "neutral",
                    custom_tools: [
                        {
                            name: "book_demo",
                            description: "Trigger this tool ONLY when the user explicitly agrees to book a meeting or a demo. Extract their requested time and send it as the payload.",
                            url: "https://webhook.site/demo-url"
                        },
                        {
                            name: "qualify_lead",
                            description: "Trigger this tool after you learn the user's budget and company size to log them into the CRM.",
                            url: "https://webhook.site/demo-url"
                        }
                    ]
                }
            };
            
            await aiAgentService.createAgent(agentData);
            setRefreshTrigger(prev => prev + 1);
            setShowSuccessModal(true);
        } catch (err: any) {
            console.error(err);
            alert('Failed to create demo agent: ' + (err.message || 'Unknown error'));
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, agentId: string) => {
        if (!canWrite) return;
        if (e.target.files && e.target.files[0]) {
            setUploadingFor(agentId);
            try {
                await aiAgentService.uploadKnowledge(agentId, e.target.files[0]);
                alert('Knowledge uploaded successfully!');
            } catch (err: any) {
                alert('Upload failed: ' + err.message);
            } finally {
                setUploadingFor(null);
            }
        }
    };
    const handleCopyEmbed = (agentId: string) => {
        const snippet = `<script src="${window.location.origin}/widget.js" async defer></script>\n<agent-widget id="${agentId}"></agent-widget>`;
        navigator.clipboard.writeText(snippet);
        alert('Widget embed code copied to clipboard! You can paste this into your website HTML.');
    };

    if (!canRead) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 h-full p-8 text-center bg-slate-50">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-6 border border-red-100 text-red-500">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-slate-900">Access Denied</h2>
                <p className="max-w-md mx-auto text-slate-500">You do not have permission to view or manage AI Buddy. Please contact your administrator if you believe this is an error.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 p-8 overflow-y-auto">
            <div className="max-w-[1800px] mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-slate-800">AI Buddy</h1>
                            {!canWrite && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                    Read Only Mode
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 mt-1">Create and manage your AI-powered assistants</p>
                    </div>
                    <div className="flex gap-3">
                        {canWrite && (
                            <div className="relative">
                                <div className="absolute -top-2.5 -right-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-md z-10 border border-white/20">NEW</div>
                                <button
                                    onClick={handleCreateDemoSalesAgent}
                                    className="relative px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-bold transition-colors shadow-sm flex items-center gap-2 overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
                                    <span>🪄</span> Demo Sales Agent
                                </button>
                            </div>
                        )}

                        {canWrite && (
                            <div className="relative">
                                <div className="absolute -top-2.5 -right-2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-bounce shadow-md z-10 border border-white/20" style={{ animationDelay: '0.2s' }}>NEW</div>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="relative px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-bold transition-colors shadow-sm shadow-brand-500/30 flex items-center gap-2 overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[shimmer_1.5s_infinite]" />
                                    <span>+</span> Create Agent
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6 mb-8 border-b border-slate-200">
                    <button 
                        onClick={() => setActiveViewTab('agents')}
                        className={`pb-4 font-bold text-sm transition-colors border-b-2 ${activeViewTab === 'agents' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Active Agents
                    </button>
                    <button 
                        onClick={() => setActiveViewTab('analytics')}
                        className={`pb-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${activeViewTab === 'analytics' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        Analytics & Leads
                        <span className="bg-brand-100 text-brand-700 text-[10px] px-2 py-0.5 rounded-full">New</span>
                    </button>
                </div>

                {activeViewTab === 'analytics' ? (
                    <AiAgentAnalytics />
                ) : (
                    <>
                        {/* Dashboard Stats / Types Info (Static for now) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div 
                        onClick={() => setCreateType('voice')}
                        className="bg-white p-6 rounded-2xl shadow-lg border-2 border-orange-400 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden"
                    >
                        <div className="w-40 h-40 mb-4 relative transition-transform group-hover:scale-110 duration-300 z-10 flex items-center justify-center">
                            <img
                                src="/assets/cute_orange_robot_voice.png"
                                alt="AI Voice Agent Robot"
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        </div>
                        <h3 className="font-black text-slate-800 mb-1 text-xl tracking-tight z-10">Ai Voice Agent</h3>
                        <p className="text-[11px] text-slate-500 font-medium z-10 max-w-[200px] leading-relaxed">
                            Requires 3rd-party voice platform. Clone realistic voices with external AI engines.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-orange-400 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden">
                        <div className="w-40 h-40 mb-4 relative transition-transform group-hover:scale-110 duration-300 z-10 flex items-center justify-center">
                            {/* 3rd Party Badge */}
                            <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 z-20">
                                External AI
                            </div>
                            <img
                                src="/assets/cute_orange_robot_chat.png"
                                alt="AI Chatbot Robot"
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        </div>
                        <h3 className="font-black text-slate-800 mb-1 text-xl tracking-tight z-10">Ai Chatbot</h3>
                        <p className="text-[11px] text-slate-500 font-medium z-10 max-w-[200px] leading-relaxed">
                            Connect your own NLP engine. Advanced conversations powered by your preferred 3rd-party API.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-orange-400 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden">
                        <div className="w-40 h-40 mb-4 relative transition-transform group-hover:scale-110 duration-300 z-10 flex items-center justify-center">
                            <img
                                src="/assets/cute_orange_robot_task.png"
                                alt="Task Management Robot"
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        </div>
                        <h3 className="font-black text-slate-800 mb-2 text-xl tracking-tight z-10">Task Management</h3>
                        <p className="text-sm text-slate-500 font-medium z-10 max-w-[200px]">Organize, track, and automate your daily tasks</p>
                    </div>
                </div>

                {/* Agent List */}
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Loading agents...</div>
                ) : agents.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center animate-fade-in">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🎙️</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">No Agents Created Yet</h2>
                        <p className="text-slate-500 max-w-md mx-auto mb-8">Get started by creating your first AI Agent. You can configure its personality, voice, and knowledge base.</p>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold transition-all shadow-lg shadow-brand-200"
                        >
                            Create Your First Agent
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                        {agents.map((agent, index) => (
                            <div key={agent.id} className={`group relative overflow-hidden rounded-3xl bg-white p-6 border-2 shadow-sm transition-all duration-300 ${['border-[#5b52e5]/70 hover:border-[#5b52e5] hover:shadow-[#5b52e5]/20', 'border-[#fe466a]/70 hover:border-[#fe466a] hover:shadow-[#fe466a]/20', 'border-[#fa9c05]/70 hover:border-[#fa9c05] hover:shadow-[#fa9c05]/20', 'border-[#00a3e0]/70 hover:border-[#00a3e0] hover:shadow-[#00a3e0]/20', 'border-[#10a37f]/70 hover:border-[#10a37f] hover:shadow-[#10a37f]/20'][index % 5]} hover:shadow-md`}>
                                
                                {canWrite && (
                                    <div className="absolute top-4 right-4 flex gap-2 z-50">
                                        <button
                                            onClick={() => setEditingAgent(agent)}
                                            className="p-2 text-brand-600 hover:text-brand-700 hover:bg-brand-100 bg-brand-50 border border-brand-100 rounded-xl transition-all shadow-sm flex items-center justify-center"
                                            title="Edit Agent"
                                        >
                                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        <button
                                            onClick={() => handleCopyEmbed(agent.id)}
                                            className="p-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100 bg-indigo-50 border border-indigo-100 rounded-xl transition-all shadow-sm flex items-center justify-center"
                                            title="Copy Embed Code"
                                        >
                                            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        </button>
                                        {canDelete && (
                                            <button
                                                onClick={() => setAgentToDelete(agent)}
                                                className="p-2 text-red-500 hover:text-red-600 hover:bg-red-100 bg-red-50 border border-red-100 rounded-xl transition-all shadow-sm flex items-center justify-center"
                                                title="Delete Agent"
                                            >
                                                <TrashIcon className="w-[18px] h-[18px]" />
                                            </button>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-5 mb-5 relative z-10">
                                    <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center ${
                                        agent.type === 'voice' ? 'bg-[#5b52e5] shadow-lg shadow-[#5b52e5]/40' :
                                        agent.type === 'call' ? 'bg-[#fe466a] shadow-lg shadow-[#fe466a]/40' : 
                                        ['bg-[#5b52e5] shadow-lg shadow-[#5b52e5]/40', 'bg-[#fe466a] shadow-lg shadow-[#fe466a]/40', 'bg-[#fa9c05] shadow-lg shadow-[#fa9c05]/40', 'bg-[#00a3e0] shadow-lg shadow-[#00a3e0]/40', 'bg-[#10a37f] shadow-lg shadow-[#10a37f]/40'][index % 5]
                                    }`}>
                                        {agent.type === 'voice' ? <MicrophoneIcon className="w-8 h-8 text-white" /> :
                                            agent.type === 'call' ? <PhoneIcon className="w-8 h-8 text-white" /> : 
                                            [
                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/></svg>,
                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 0-7 7v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V9a7 7 0 0 0-7-7z"/><path d="M9 12h.01M15 12h.01"/><path d="M12 16c-1.5 0-2-.5-2-.5s.5-.5 2-.5 2 .5 2 .5-.5.5-2 .5z"/></svg>,
                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M8 11h.01M16 11h.01"/><path d="M9 15h6"/></svg>,
                                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="5" y="5" rx="3"/><path d="M2 9h3v6H2zM19 9h3v6h-3z"/><path d="M9 11h.01M15 11h.01M10 15h4"/></svg>
                                            ][index % 5]}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-indigo-500 to-purple-600 text-[22px] tracking-tight mb-1">{agent.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="w-[7px] h-[7px] rounded-full bg-brand-500"></span>
                                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{agent.type} Agent</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-8 p-3.5 rounded-xl bg-gradient-to-r from-brand-50/80 to-indigo-50/80 border border-brand-100/50 relative z-10 shadow-sm">
                                    <p className="text-[13.5px] text-slate-700 font-medium leading-[1.6] line-clamp-2">
                                        {agent.description || 'No description provided.'}
                                    </p>
                                </div>

                                <div className="border-t border-slate-100/70 pt-5 relative z-10">
                                    <div className="flex justify-between items-center text-[12px] text-slate-400/90 mb-5 font-medium">
                                        <div className="flex items-center gap-1.5 text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg font-bold text-[11px] uppercase tracking-wide border border-brand-200 shadow-sm">
                                            <svg className="w-3.5 h-3.5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            <span>{format(new Date(agent.created_at), 'MMM d, yyyy')}</span>
                                        </div>
                                        <span className="font-mono bg-[#f8fafc] px-2 py-[3px] rounded-md flex items-center gap-1.5 text-slate-500">
                                            <span className="uppercase text-[10px] tracking-wider text-slate-400">ID:</span>
                                            <span className="font-semibold text-slate-700">{agent.id.slice(0, 8)}...</span>
                                        </span>
                                    </div>

                                    {canWrite && (
                                        <div className="flex gap-3">
                                            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-[11px] rounded-xl text-[14px] font-bold cursor-pointer transition-all shadow-sm ${[
                                                'bg-[#5b52e5]/10 hover:bg-[#5b52e5]/20 text-[#5b52e5] border border-[#5b52e5]/30',
                                                'bg-[#fe466a]/10 hover:bg-[#fe466a]/20 text-[#fe466a] border border-[#fe466a]/30',
                                                'bg-[#fa9c05]/10 hover:bg-[#fa9c05]/20 text-[#fa9c05] border border-[#fa9c05]/30',
                                                'bg-[#00a3e0]/10 hover:bg-[#00a3e0]/20 text-[#00a3e0] border border-[#00a3e0]/30',
                                                'bg-[#10a37f]/10 hover:bg-[#10a37f]/20 text-[#10a37f] border border-[#10a37f]/30'
                                            ][index % 5]} ${uploadingFor === agent.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                                <DocumentIcon className={`w-5 h-5 ${[
                                                    'text-[#5b52e5]', 'text-[#fe466a]', 'text-[#fa9c05]', 'text-[#00a3e0]', 'text-[#10a37f]'
                                                ][index % 5]}`} />
                                                <span>{uploadingFor === agent.id ? 'Uploading...' : 'Knowledge'}</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".pdf,.txt,.md,.csv,.docx"
                                                    onChange={(e) => handleFileUpload(e, agent.id)}
                                                />
                                            </label>
                                            <button 
                                                onClick={() => setChattingWith(agent)}
                                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-[11px] text-white rounded-xl text-[14px] font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 ${[
                                                    'bg-[#5b52e5] hover:bg-[#5b52e5]/90 shadow-[#5b52e5]/30',
                                                    'bg-[#fe466a] hover:bg-[#fe466a]/90 shadow-[#fe466a]/30',
                                                    'bg-[#fa9c05] hover:bg-[#fa9c05]/90 shadow-[#fa9c05]/30',
                                                    'bg-[#00a3e0] hover:bg-[#00a3e0]/90 shadow-[#00a3e0]/30',
                                                    'bg-[#10a37f] hover:bg-[#10a37f]/90 shadow-[#10a37f]/30'
                                                ][index % 5]}`}
                                            >
                                                <span>💬 Test Chat</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                    </>
                )}
            </div>

            {(isCreating || editingAgent || createType) && (
                <CreateAgentModal
                    onClose={() => {
                        setIsCreating(false);
                        setEditingAgent(null);
                        setCreateType(null);
                    }}
                    onSave={handleSave}
                    initialData={editingAgent || (createType ? { type: createType } : null)}
                />
            )}

            {chattingWith && (
                <AgentChatModal
                    agentId={chattingWith.id}
                    agentName={chattingWith.name}
                    onClose={() => setChattingWith(null)}
                />
            )}



            {/* Delete Confirmation Modal */}
            {agentToDelete && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 text-center border border-slate-100">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <TrashIcon className="w-10 h-10 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Delete this agent?</h3>
                        <p className="text-sm text-slate-500 mb-8 leading-relaxed">Are you sure you want to delete <strong className="text-slate-700">{agentToDelete.name}</strong>? This action cannot be undone.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setAgentToDelete(null)}
                                className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => performDelete(agentToDelete.id)}
                                className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-200"
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl scale-100 text-center border border-slate-100">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-4xl">🎉</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Agent Created!</h3>
                        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                            Your Demo Sales Agent is ready. Please click the <strong>Edit</strong> button on its card to add your <strong className="text-brand-600">OpenAI API Key</strong>.
                        </p>
                        <button
                            onClick={() => setShowSuccessModal(false)}
                            className="w-full py-3 px-4 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
                        >
                            Got it, thanks!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


export default AiVoiceAgentView;
