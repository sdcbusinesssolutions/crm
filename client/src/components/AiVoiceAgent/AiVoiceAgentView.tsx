import React, { useEffect, useState, useRef } from 'react';
import { MicrophoneIcon, RobotIcon, PhoneIcon, TrashIcon, DocumentFileIcon as DocumentIcon } from '../icons';
import { aiAgentService, Agent } from '../../services/aiAgentService';
import CreateAgentModal from './CreateAgentModal';
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
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Upload State
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    // Demo State
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

    useEffect(() => {
        if (audioRef.current && isPlayingDemo) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlayingDemo(false);
        }
    }, [selectedDemo]);

    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = "";
            }
        };
    }, []);

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

    const handleCreate = async (data: any) => {
        if (!canWrite) return;
        await aiAgentService.createAgent(data);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleDelete = async (id: string) => {
        if (!canDelete) return;
        if (!confirm('Delete this agent?')) return;
        try {
            await aiAgentService.deleteAgent(id);
            setRefreshTrigger(prev => prev + 1);
        } catch (e) {
            alert('Failed to delete');
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
            <div className="max-w-6xl mx-auto w-full">
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
                        <a href="#" className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm flex items-center gap-2">
                            <span>📚</span> Documentation
                        </a>
                        {canWrite && (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-lg shadow-brand-200 flex items-center gap-2"
                            >
                                <span>+</span> Create Agent
                            </button>
                        )}
                    </div>
                </div>

                {/* Dashboard Stats / Types Info (Static for now) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden">
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

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden">
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

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden">
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

                {/* Automation & Integration Info Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 p-6 rounded-2xl mb-8 border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent"></div>
                    </div>
                    
                    <div className="flex-1 relative z-10 text-center md:text-left">
                        <h2 className="text-xl font-bold text-white mb-2 flex items-center justify-center md:justify-start gap-2">
                            <span className="p-1.5 bg-red-500/20 rounded-lg">🛡️</span>
                            Dependency Notice
                        </h2>
                        <p className="text-slate-300 text-sm leading-relaxed max-w-2xl font-medium">
                            Please note: We provide the integration interface. <span className="text-red-400 font-bold underline">You must bring your own 3rd-party tools or website subscriptions</span> (e.g., N8N, OpenAI, or Voice APIs). We do not provide these underlying services — they must be configured independently to work within this dashboard.
                        </p>
                    </div>

                    <div className="flex shrink-0 gap-3 relative z-10">
                        <div className="flex flex-col items-center gap-1.5 p-3 px-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                            </div>
                            <span className="text-[10px] font-bold text-orange-400 tracking-tighter uppercase whitespace-nowrap">N8N External</span>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 p-3 px-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
                            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-xs">🛠️</div>
                            <span className="text-[10px] font-bold text-red-400 tracking-tighter uppercase whitespace-nowrap">User Provided</span>
                        </div>
                    </div>
                </div>

                {/* Voice Experience Zone - Enhanced with Calling Indicators and Premium Border */}
                <div className="bg-black text-white p-12 rounded-[3.5rem] mb-12 border-[6px] border-slate-900/80 shadow-[0_0_60px_rgba(147,51,234,0.2)] relative overflow-hidden ring-1 ring-white/5">
                    {/* Atmospheric lighting */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/5 blur-[100px] rounded-full pointer-events-none"></div>

                    <div className="text-center mb-12 relative z-10">
                        <h2 className="text-4xl font-extrabold mb-4 text-white tracking-tight">Step Into The Voicebot Experience Zone</h2>
                        <p className="text-slate-400 max-w-3xl mx-auto text-base leading-relaxed font-medium">
                            From sales to support – experience how Smartping's GenAI Voicebot handles real conversations across sectors and languages with precision and ease.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-stretch gap-12 max-w-5xl mx-auto relative z-10">
                        <div className="flex flex-col gap-4 w-full md:w-4/12">
                            {['Admission Operation', 'Ecommerce', 'Customer Support'].map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setSelectedDemo(option)}
                                    className={`px-8 py-4 rounded-full text-sm font-bold transition-all duration-300 text-center border-2 ${selectedDemo === option 
                                        ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_25px_rgba(147,51,234,0.4)] scale-105' 
                                        : 'bg-transparent border-white/20 text-white hover:border-white hover:bg-white/5'}`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        {/* Right: Interaction Panel */}
                        <div className="flex-1 bg-slate-900/30 rounded-[2.5rem] p-10 border border-white/10 flex flex-col items-center justify-between relative overflow-hidden backdrop-blur-xl">
                            <div className="flex items-center justify-between w-full relative z-10">
                                {/* Professional Enterprise AI Assistant */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className={`w-28 h-28 rounded-full border-[3px] transition-all duration-700 flex items-center justify-center p-0.5 bg-gradient-to-b from-slate-800 to-black relative overflow-hidden ${isPlayingDemo ? 'border-purple-400 shadow-[0_0_50px_rgba(147,51,234,0.6)] scale-110' : 'border-white/20 hover:border-white/40 shadow-inner'}`}>
                                        <div className="absolute inset-0 bg-purple-500/5 backdrop-blur-3xl"></div>
                                        <img src="/assets/professional_calling_bot.png" alt="AI Agent" className={`w-full h-full object-cover relative z-10 transition-all duration-700 ${isPlayingDemo ? 'scale-105 saturate-100' : 'opacity-60 saturate-50'}`} />
                                        
                                        {isPlayingDemo && (
                                            <div className="absolute top-0 right-0 bg-purple-600 text-white p-2 rounded-full border-2 border-black animate-pulse shadow-xl z-20">
                                                <PhoneIcon className="w-4 h-4 relative z-10" />
                                                <div className="absolute inset-0 bg-white/40 rounded-full animate-ping"></div>
                                            </div>
                                        )}
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-[0.25em] transition-all duration-700 ${isPlayingDemo ? 'text-purple-300' : 'text-slate-500'}`}>
                                        {isPlayingDemo ? 'VOICE CONNECTED' : 'AI ASSISTANT'}
                                    </span>
                                </div>

                                {/* Central Action Control */}
                                <div className="flex flex-col items-center gap-6">
                                    <button 
                                        onClick={handlePlayDemo}
                                        className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative group ${isPlayingDemo ? 'bg-red-500/20 border-4 border-red-500/50 text-red-500' : 'bg-slate-100 text-black hover:bg-white'}`}
                                    >
                                        {isPlayingDemo ? (
                                            <PhoneIcon className="w-12 h-12 rotate-[135deg]" />
                                        ) : (
                                            <MicrophoneIcon className="w-12 h-12 transition-transform group-hover:scale-110" />
                                        )}
                                        {isPlayingDemo && <div className="absolute -inset-6 border-2 border-purple-500/30 rounded-full animate-ping"></div>}
                                    </button>
                                    <span className={`text-xs font-black tracking-[0.2em] uppercase transition-all ${isPlayingDemo ? 'text-purple-400 animate-pulse' : 'text-slate-500'}`}>
                                        {isPlayingDemo ? 'Simulation Active' : 'Tap To Experience'}
                                    </span>
                                </div>

                                {/* Customer Portrait */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className={`w-28 h-28 rounded-full border-4 transition-all duration-500 overflow-hidden bg-slate-900 relative ${isPlayingDemo ? 'border-purple-500 scale-110 shadow-[0_0_30px_rgba(147,51,234,0.3)]' : 'border-white/10 opacity-40'}`}>
                                        <img src="/assets/indian_customer_avatar.png" alt="User" className={`w-full h-full object-cover transition-all duration-700 ${isPlayingDemo ? 'grayscale-0' : 'grayscale'}`} />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Customer</span>
                                </div>
                            </div>

                            {/* Audio Waveform Visualization */}
                            <div className="w-full h-16 flex items-center justify-center gap-[4px] mt-10 px-6">
                                {[...Array(28)].map((_, i) => (
                                    <div 
                                        key={i}
                                        className={`w-1 rounded-full transition-all duration-300 ${isPlayingDemo ? 'bg-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.6)] animate-audio-bar-' + ((i % 3) + 1) : 'h-1.5 bg-white/10'}`}
                                        style={{ height: isPlayingDemo ? `${15 + Math.random() * 85}%` : '8px' }}
                                    ></div>
                                ))}
                            </div>
                        </div>
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
                        {agents.map(agent => (
                            <div key={agent.id} className="bg-white border border-slate-200 rounded-xl p-6 hover:shadow-md transition-shadow relative group">
                                {canDelete && (
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={() => handleDelete(agent.id)}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            title="Delete"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${agent.type === 'voice' ? 'bg-blue-100 text-blue-600' :
                                        agent.type === 'call' ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'
                                        }`}>
                                        {agent.type === 'voice' ? <MicrophoneIcon className="w-6 h-6" /> :
                                            agent.type === 'call' ? <PhoneIcon className="w-6 h-6" /> : <RobotIcon className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{agent.name}</h3>
                                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full capitalize">{agent.type} Agent</span>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-500 mb-4 line-clamp-2 h-10">
                                    {agent.description || 'No description provided.'}
                                </p>

                                <div className="border-t border-slate-100 pt-4 mt-2">
                                    <div className="flex justify-between items-center text-xs text-slate-400 mb-3">
                                        <span>Created {format(new Date(agent.created_at), 'MMM d, yyyy')}</span>
                                        <span className="font-mono bg-slate-50 px-1 rounded flex items-center gap-1">
                                            <span>ID:</span>
                                            <span className="select-all">{agent.id.slice(0, 8)}...</span>
                                        </span>
                                    </div>

                                    {canWrite && (
                                        <div className="flex gap-2">
                                            <label className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors ${uploadingFor === agent.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                                <DocumentIcon className="w-4 h-4 text-slate-500" />
                                                <span>{uploadingFor === agent.id ? 'Uploading...' : 'Add Knowledge'}</span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept=".pdf,.txt,.md,.csv,.docx"
                                                    onChange={(e) => handleFileUpload(e, agent.id)}
                                                />
                                            </label>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {isCreating && (
                <CreateAgentModal
                    onClose={() => setIsCreating(false)}
                    onSave={handleCreate}
                />
            )}
        </div>
    );
};


export default AiVoiceAgentView;
