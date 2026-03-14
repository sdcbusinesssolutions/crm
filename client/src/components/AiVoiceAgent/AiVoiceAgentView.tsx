import React, { useEffect, useState, useRef } from 'react';
import { MicrophoneIcon, RobotIcon, PhoneIcon, TrashIcon, DocumentFileIcon as DocumentIcon } from '../icons';
import { aiAgentService, Agent } from '../../services/aiAgentService';
import CreateAgentModal from './CreateAgentModal';
import { format } from 'date-fns';

const AiVoiceAgentView: React.FC = () => {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Upload State
    const [uploadingFor, setUploadingFor] = useState<string | null>(null);

    // Demo State
    const [selectedDemo, setSelectedDemo] = useState('Appointment Booking');
    const [isPlayingDemo, setIsPlayingDemo] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const audioFiles: Record<string, string> = {
        'EMI Collections': '/assets/demo_emi.wav',
        'Appointment Booking': '/assets/demo_appointment.wav',
        'Online Banking': '/assets/demo_banking.wav',
        'Customer Support': '/assets/demo_support.wav',
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
        loadAgents();
    }, [refreshTrigger]);

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
        await aiAgentService.createAgent(data);
        setRefreshTrigger(prev => prev + 1);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this agent?')) return;
        try {
            await aiAgentService.deleteAgent(id);
            setRefreshTrigger(prev => prev + 1);
        } catch (e) {
            alert('Failed to delete');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, agentId: string) => {
        if (e.target.files && e.target.files[0]) {
            setUploadingFor(agentId);
            try {
                await aiAgentService.uploadKnowledge(agentId, e.target.files[0]);
                alert('Knowledge uploaded successfully!');
                // Could refresh knowledge list here
            } catch (err: any) {
                alert('Upload failed: ' + err.message);
            } finally {
                setUploadingFor(null);
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">AI Buddy</h1>
                        <p className="text-slate-500 mt-1">Create and manage your AI-powered assistants</p>
                    </div>
                    <div className="flex gap-3">
                        <a href="#" className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm flex items-center gap-2">
                            <span>📚</span> Documentation
                        </a>
                        <button
                            onClick={() => setIsCreating(true)}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-lg shadow-brand-200 flex items-center gap-2"
                        >
                            <span>+</span> Create Agent
                        </button>
                    </div>
                </div>

                {/* Voice Experience Section */}
                <div className="bg-slate-900 text-white p-10 rounded-[2rem] mb-8 border border-slate-700/50 shadow-xl shadow-brand-900/10 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                    {/* Background glows - customized to brand colors */}
                    <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-500/10 blur-[100px] rounded-full pointer-events-none"></div>
                    
                    <div className="text-center mb-10 relative z-10">
                        <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold tracking-wider mb-4 border border-emerald-500/30">LIVE DEMO</span>
                        <h2 className="text-3xl font-extrabold mb-3 text-white tracking-tight">Experience Our Voice AI Agents</h2>
                        <p className="text-slate-300 max-w-2xl mx-auto text-sm leading-relaxed">
                            Discover how our advanced conversational models handle real-world challenges fluidly. From appointment bookings to complex customer support, hear the future of automated interaction.
                        </p>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-16 max-w-4xl mx-auto relative z-10 p-6 rounded-3xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-xl">
                        <div className="flex flex-col gap-3 w-full md:w-5/12">
                            {['EMI Collections', 'Appointment Booking', 'Online Banking', 'Customer Support'].map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setSelectedDemo(option)}
                                    className={`px-6 py-4 rounded-xl text-sm font-semibold transition-all duration-300 text-left flex items-center justify-between group ${selectedDemo === option 
                                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400' 
                                        : 'bg-slate-800/80 border-transparent text-slate-300 hover:bg-slate-700 hover:text-white'}`}
                                >
                                    <span>{option}</span>
                                    {selectedDemo === option && (
                                        <div className="w-2 h-2 rounded-full bg-slate-950 animate-pulse"></div>
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="relative group cursor-pointer mb-8" onClick={handlePlayDemo}>
                                {/* Microphone button glowing background */}
                                <div className={`absolute inset-0 bg-white/10 rounded-full blur-2xl transition-all duration-500 ${isPlayingDemo ? 'scale-[2.5] animate-pulse bg-emerald-500/20' : 'group-hover:scale-150 group-hover:bg-brand-500/20'}`}></div>
                                
                                {/* Inner concentric ring */}
                                <div className={`absolute -inset-4 rounded-full border border-slate-700 transition-all duration-700 ${isPlayingDemo ? 'border-emerald-500/50 scale-110 rotate-180' : ''}`}></div>

                                {/* Microphone button circle */}
                                <div className={`w-28 h-28 rounded-full flex items-center justify-center relative shadow-2xl z-10 transition-all duration-300 group-hover:scale-105 active:scale-95 ${isPlayingDemo ? 'bg-emerald-500 text-slate-900 border-4 border-emerald-300' : 'bg-slate-800 text-slate-200 border border-slate-600'}`}>
                                    {isPlayingDemo ? (
                                        <div className="flex gap-1.5 items-end justify-center h-10 w-10">
                                            {/* Audio bars animation */}
                                            <span className="w-1.5 bg-slate-900 rounded-full animate-audio-bar-1 h-3"></span>
                                            <span className="w-1.5 bg-slate-900 rounded-full animate-audio-bar-2 h-6"></span>
                                            <span className="w-1.5 bg-slate-900 rounded-full animate-audio-bar-3 h-10"></span>
                                            <span className="w-1.5 bg-slate-900 rounded-full animate-audio-bar-1 h-5"></span>
                                        </div>
                                    ) : (
                                        <MicrophoneIcon className="w-10 h-10" />
                                    )}
                                </div>
                            </div>
                            <div className="text-slate-300 font-medium tracking-wide h-6 flex items-center justify-center">
                                {isPlayingDemo ? (
                                    <span className="text-emerald-400 flex items-center gap-3">
                                        Agent speaks: "{selectedDemo}"
                                    </span>
                                ) : (
                                    "Tap to hear the demonstration"
                                )}
                            </div>
                        </div>
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
                        <h3 className="font-black text-slate-800 mb-2 text-xl tracking-tight z-10">Ai Voice Agent</h3>
                        <p className="text-sm text-slate-500 font-medium z-10 max-w-[200px]">Clone realistic voices for your agents</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex flex-col items-center text-center hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group relative overflow-hidden">
                        <div className="w-40 h-40 mb-4 relative transition-transform group-hover:scale-110 duration-300 z-10 flex items-center justify-center">
                            <img
                                src="/assets/cute_orange_robot_chat.png"
                                alt="AI Chatbot Robot"
                                className="w-full h-full object-contain drop-shadow-xl"
                            />
                        </div>
                        <h3 className="font-black text-slate-800 mb-2 text-xl tracking-tight z-10">Ai Chatbot</h3>
                        <p className="text-sm text-slate-500 font-medium z-10 max-w-[200px]">Advanced NLP for natural conversations</p>
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
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button
                                        onClick={() => handleDelete(agent.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        title="Delete"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>

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
