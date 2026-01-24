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
