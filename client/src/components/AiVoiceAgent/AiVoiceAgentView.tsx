import React, { useEffect, useState } from 'react';
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

                {/* Dashboard Stats / Types Info (Static for now) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <MicrophoneIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">Ai Voice agent</h3>
                        <p className="text-sm text-slate-400">Clone realistic voices for your agents</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                            <RobotIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">Ai Chatbot</h3>
                        <p className="text-sm text-slate-400">Advanced NLP for natural conversations</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                            <PhoneIcon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-slate-800 mb-1">Call Management</h3>
                        <p className="text-sm text-slate-400">Handle inbound and outbound calls</p>
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
