import React from 'react';
import { MicrophoneIcon, RobotIcon, PhoneIcon } from '../icons';

const AiVoiceAgentView: React.FC = () => {
    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">AI Buddy</h1>
                        <p className="text-slate-500 mt-1">Create and manage your AI-powered assistants</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition-colors shadow-sm">
                            Documentation
                        </button>
                        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 font-medium transition-colors shadow-lg shadow-brand-200">
                            + Create Agent
                        </button>
                    </div>
                </div>

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

                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-4xl">🎙️</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">No Agents Created Yet</h2>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">Get started by creating your first AI Agent. You can configure its personality, voice, and knowledge base.</p>
                    <button className="px-6 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 font-bold transition-all shadow-lg shadow-brand-200">
                        Create Your First Agent
                    </button>
                </div>
            </div>
        </div>
    );
};


export default AiVoiceAgentView;
