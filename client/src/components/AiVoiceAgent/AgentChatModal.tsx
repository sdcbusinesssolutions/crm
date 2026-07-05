import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { aiAgentService } from '../../services/aiAgentService';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AgentChatModalProps {
    agentId: string;
    agentName: string;
    onClose: () => void;
}

const AgentChatModal: React.FC<AgentChatModalProps> = ({ agentId, agentName, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: `Hi! I am ${agentName}. How can I help you today?` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        const text = input.trim();
        if (!text || isLoading) return;

        const userMsg: Message = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const token = await aiAgentService.getSessionToken();
            // Extract history without the very first hardcoded welcome message, or keep it all
            const history = messages.filter((m, i) => i !== 0 || m.role !== 'assistant');

            const res = await axios.post(`/api/ai-agents/${agentId}/chat`, {
                message: text,
                history: history
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
        } catch (error: any) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${error.response?.data?.error || 'Failed to connect to agent.'}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-slate-900/60 transition-opacity">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[80vh] animate-fade-in ring-1 ring-slate-900/5">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-brand-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl text-white">
                            🤖
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">{agentName}</h2>
                            <p className="text-brand-100 text-xs font-medium flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Online (Testing Mode)
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${msg.role === 'user' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">{msg.content}</p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm flex gap-1.5 items-center">
                                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"></span>
                                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <form onSubmit={handleSend} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a message to test your agent..."
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white outline-none transition-all font-medium text-slate-800 text-sm"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="w-12 h-12 flex items-center justify-center bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:hover:bg-brand-600 transition-colors shadow-sm shrink-0"
                        >
                            <svg className="w-5 h-5 -mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default AgentChatModal;
