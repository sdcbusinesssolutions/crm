
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    SearchIcon, FilterIcon, MoreVerticalIcon, PaperClipIcon, EmojiIcon, 
    MicrophoneIcon, PaperAirplaneIcon, DoubleCheckIcon, CheckIcon, ClockIcon,
    UserCircleIcon, ChevronLeftIcon, PhoneIcon, EditIcon, CloseIcon,
    UsersIcon, DocumentFileIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon,
    DownloadIcon, TrashIcon, BadgeIcon
} from './icons';

// Mock Data for UI Display
const MOCK_CHATS = [
    { id: '1', name: 'Alice Johnson', phone: '+1 (555) 123-4567', email: 'alice@example.com', lastMessage: 'Hey, can you send me the catalog?', time: '10:30 AM', unread: 2, status: 'Open', tags: ['New Lead'], avatarColor: 'bg-blue-500', assignedTo: 'me' },
    { id: '2', name: 'Bob Smith', phone: '+1 (555) 987-2222', email: 'bob@test.com', lastMessage: 'Thanks for the info!', time: 'Yesterday', unread: 0, status: 'Resolved', tags: ['Customer'], avatarColor: 'bg-green-500', assignedTo: 'agent2' },
    { id: '3', name: 'Charlie Davis', phone: '+1 (555) 444-3333', email: 'charlie@sample.net', lastMessage: 'Is this available in red?', time: 'Mon', unread: 1, status: 'Pending', tags: ['Inquiry', 'Urgent'], avatarColor: 'bg-purple-500', assignedTo: 'me' },
    { id: '4', name: 'Diana Prince', phone: '+1 (555) 111-0000', email: 'diana@wonder.com', lastMessage: 'I would like to book a demo.', time: 'Sun', unread: 0, status: 'Open', tags: ['High Priority'], avatarColor: 'bg-pink-500', assignedTo: null },
    { id: '5', name: 'Ethan Hunt', phone: '+1 (555) 666-7777', email: 'ethan@imf.org', lastMessage: 'Mission accomplished.', time: 'Last Week', unread: 0, status: 'Closed', tags: [], avatarColor: 'bg-amber-500', assignedTo: 'agent3' },
];

const INITIAL_MESSAGES = [
    { id: 'm1', text: 'Hello! How can I help you today?', sender: 'me', time: '10:00 AM', status: 'read' },
    { id: 'm2', text: 'Hi, I am interested in your premium plan.', sender: 'them', time: '10:05 AM' },
    { id: 'm3', text: 'That\'s great! Our premium plan offers advanced automation and analytics.', sender: 'me', time: '10:06 AM', status: 'read' },
    { id: 'm4', text: 'Do you have a catalog or brochure?', sender: 'them', time: '10:08 AM' },
    { id: 'm5', text: 'Sure, let me send that to you right now.', sender: 'me', time: '10:10 AM', status: 'delivered' },
];

const Inbox: React.FC = () => {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState(INITIAL_MESSAGES);
    const [messageInput, setMessageInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(true);
    
    // Filter States
    const [quickFilter, setQuickFilter] = useState<'All' | 'Mine' | 'Unassigned'>('All');
    const [filterTag, setFilterTag] = useState<string>('');
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    
    // Menu States
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const activeChat = MOCK_CHATS.find(c => c.id === activeChatId);

    // Extract unique tags for filter dropdown
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        MOCK_CHATS.forEach(chat => chat.tags.forEach(tag => tags.add(tag)));
        return Array.from(tags);
    }, []);

    // Filter Logic
    const filteredChats = useMemo(() => {
        return MOCK_CHATS.filter(chat => {
            // 1. Search Term
            const matchesSearch = 
                chat.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                chat.phone.includes(searchTerm) ||
                chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
            
            if (!matchesSearch) return false;

            // 2. Quick Filters (Tabs)
            if (quickFilter === 'Mine' && chat.assignedTo !== 'me') return false;
            if (quickFilter === 'Unassigned' && chat.assignedTo !== null) return false;

            // 3. Advanced Tag Filter
            if (filterTag && !chat.tags.includes(filterTag)) return false;

            return true;
        });
    }, [searchTerm, quickFilter, filterTag]);

    // Scroll to bottom on new message
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages, activeChatId]);

    const handleSendMessage = () => {
        if (!messageInput.trim()) return;
        const newMsg = {
            id: `m-${Date.now()}`,
            text: messageInput,
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'sent'
        };
        setMessages([...messages, newMsg]);
        setMessageInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleAttachmentClick = (type: string) => {
        if (fileInputRef.current) {
            // In a real app, you might restrict accept types based on 'type'
            fileInputRef.current.click();
        }
        setIsAttachmentOpen(false);
    };

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const newMsg = {
                id: `m-${Date.now()}`,
                text: `Sent attachment: ${file.name}`,
                sender: 'me',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                status: 'sent'
            };
            setMessages([...messages, newMsg]);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportContactList = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const exportData = filteredChats.map(c => ({
            name: c.name,
            phone: c.phone,
            email: c.email,
            status: c.status,
            tags: c.tags.join(', '),
            assignedTo: c.assignedTo || 'Unassigned'
        }));

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `contact_list_export_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const handleExportContact = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeChat) return;
        const contactData = {
            id: activeChat.id,
            name: activeChat.name,
            phone: activeChat.phone,
            email: activeChat.email,
            tags: activeChat.tags,
            status: activeChat.status,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contactData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${activeChat.name.replace(/\s+/g, '_')}_contact.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setIsHeaderMenuOpen(false);
    };

    const handleExportChat = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeChat) return;
        const chatExport = {
            contact: activeChat.name,
            messages: messages
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chatExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `chat_history_${activeChat.name.replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setIsHeaderMenuOpen(false);
    };

    return (
        <div className="flex h-full w-full bg-white overflow-hidden animate-fade-in relative">
            {/* Left Sidebar: Conversation List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-white z-10 absolute md:static inset-0 transform transition-transform duration-300 ${activeChatId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Header & Search */}
                <div className="p-4 border-b border-slate-100 bg-white z-20">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-900">Inbox</h2>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handleExportContactList}
                                className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                title="Export Contact List"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                            <div className="relative">
                                <button 
                                    onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                    className={`p-2 rounded-lg transition-colors ${isFilterMenuOpen || filterTag ? 'bg-brand-50 text-brand-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                    title="Filter"
                                >
                                    <FilterIcon className="w-5 h-5" />
                                </button>
                                {isFilterMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-30" onClick={() => setIsFilterMenuOpen(false)}></div>
                                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-40 p-4 animate-fade-in">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Filter Chats</h4>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">By Tag</label>
                                                    <select 
                                                        value={filterTag}
                                                        onChange={(e) => setFilterTag(e.target.value)}
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                                    >
                                                        <option value="">All Tags</option>
                                                        {availableTags.map(tag => (
                                                            <option key={tag} value={tag}>{tag}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {/* Additional filters can go here */}
                                                <div className="pt-2 border-t border-slate-100 flex justify-end">
                                                    <button 
                                                        onClick={() => { setFilterTag(''); setIsFilterMenuOpen(false); }}
                                                        className="text-xs text-slate-500 hover:text-brand-600 font-medium"
                                                    >
                                                        Clear Filters
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 mb-4 overflow-x-auto no-scrollbar">
                        {['All', 'Mine', 'Unassigned'].map(f => (
                            <button 
                                key={f}
                                onClick={() => setQuickFilter(f as any)}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap ${quickFilter === f ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400"><SearchIcon /></div>
                        <input 
                            type="text" 
                            placeholder="Search chats..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-brand-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredChats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center p-4">
                            <SearchIcon className="w-8 h-8 mb-2 opacity-50" />
                            <p className="text-sm font-medium">No conversations found.</p>
                            <p className="text-xs mt-1">Try adjusting your filters or search.</p>
                        </div>
                    ) : (
                        filteredChats.map(chat => (
                            <div 
                                key={chat.id}
                                onClick={() => setActiveChatId(chat.id)}
                                className={`p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors group ${activeChatId === chat.id ? 'bg-brand-50/50 border-brand-100' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-full ${chat.avatarColor} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                                            {chat.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-sm ${activeChatId === chat.id ? 'text-brand-900' : 'text-slate-800'}`}>{chat.name}</h3>
                                            <span className="text-[10px] text-slate-400 font-medium">{chat.phone}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-slate-400 font-medium">{chat.time}</span>
                                        {chat.unread > 0 && (
                                            <span className="mt-1 bg-brand-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">{chat.unread}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="pl-[3.25rem]">
                                    <p className="text-xs text-slate-500 truncate mb-2">{chat.lastMessage}</p>
                                    <div className="flex flex-wrap gap-1">
                                        {chat.tags.map(tag => (
                                            <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-500 uppercase tracking-wide border border-slate-200">{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col bg-[#efeae2] absolute md:static inset-0 transform transition-transform duration-300 z-20 ${activeChatId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <header className="bg-white px-4 py-3 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0 relative z-30">
                            <div className="flex items-center space-x-3">
                                <button onClick={() => setActiveChatId(null)} className="md:hidden p-1 text-slate-500 hover:text-slate-800"><ChevronLeftIcon className="w-6 h-6" /></button>
                                <div className={`w-9 h-9 rounded-full ${activeChat.avatarColor} text-white flex items-center justify-center font-bold text-xs`}>
                                    {activeChat.name.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 text-sm">{activeChat.name}</h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block"></span> Active now
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button onClick={() => setIsContactInfoOpen(!isContactInfoOpen)} className={`p-2 rounded-lg transition-colors ${isContactInfoOpen ? 'bg-slate-100 text-brand-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                                    <UsersIcon className="w-5 h-5" />
                                </button>
                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><SearchIcon className="w-5 h-5" /></button>
                                
                                {/* 3 Dot Menu Trigger */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)} 
                                        className={`p-2 rounded-lg transition-colors ${isHeaderMenuOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <MoreVerticalIcon className="w-5 h-5" />
                                    </button>

                                    {/* 3 Dot Menu Dropdown */}
                                    {isHeaderMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsHeaderMenuOpen(false)}></div>
                                            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in">
                                                <button onClick={handleExportContact} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors flex items-center gap-2 font-medium">
                                                    <UsersIcon className="w-4 h-4" /> Export Contact Info
                                                </button>
                                                <button onClick={handleExportChat} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-600 transition-colors flex items-center gap-2 font-medium">
                                                    <DownloadIcon className="w-4 h-4" /> Export Chat
                                                </button>
                                                <div className="h-px bg-slate-100 my-1"></div>
                                                <button className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium">
                                                    <CloseIcon className="w-4 h-4" /> Block Contact
                                                </button>
                                                <button className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium">
                                                    <TrashIcon className="w-4 h-4" /> Clear Chat
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </header>

                        {/* Messages Area */}
                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}>
                            {/* Date Divider */}
                            <div className="flex justify-center my-4">
                                <span className="bg-white/90 shadow-sm px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today</span>
                            </div>

                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] sm:max-w-[60%] rounded-lg px-3 py-2 shadow-sm relative group ${msg.sender === 'me' ? 'bg-brand-100 border border-brand-200 rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>
                                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                        <div className="flex items-center justify-end gap-1 mt-1 select-none">
                                            <span className="text-[10px] text-slate-400">{msg.time}</span>
                                            {msg.sender === 'me' && (
                                                <span>
                                                    {msg.status === 'read' && <DoubleCheckIcon className="w-3 h-3 text-blue-500" />}
                                                    {msg.status === 'delivered' && <DoubleCheckIcon className="w-3 h-3 text-slate-400" />}
                                                    {msg.status === 'sent' && <CheckIcon className="w-3 h-3 text-slate-400" />}
                                                </span>
                                            )}
                                        </div>
                                        <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-black/10 rounded text-slate-600 hover:text-black"><MoreVerticalIcon className="w-3 h-3" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="bg-white px-4 py-3 border-t border-slate-200 flex items-end space-x-2 shrink-0 relative">
                             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelected} />
                             
                             {/* Attachment Menu */}
                             {isAttachmentOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setIsAttachmentOpen(false)}></div>
                                    <div className="absolute bottom-16 left-4 z-40 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 flex flex-col gap-1 w-48 animate-slide-up">
                                        <button onClick={() => handleAttachmentClick('document')} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors w-full text-left">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><DocumentFileIcon className="w-4 h-4" /></div> Document
                                        </button>
                                        <button onClick={() => handleAttachmentClick('image')} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors w-full text-left">
                                            <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center"><ImageFileIcon className="w-4 h-4" /></div> Image
                                        </button>
                                        <button onClick={() => handleAttachmentClick('video')} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors w-full text-left">
                                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center"><VideoFileIcon className="w-4 h-4" /></div> Video
                                        </button>
                                        <button onClick={() => handleAttachmentClick('audio')} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors w-full text-left">
                                            <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><AudioFileIcon className="w-4 h-4" /></div> Audio
                                        </button>
                                    </div>
                                </>
                            )}

                            <button className="p-2 text-slate-400 hover:text-brand-600 transition-colors"><EmojiIcon className="w-6 h-6" /></button>
                            
                            <button 
                                onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                                className={`p-2 transition-colors ${isAttachmentOpen ? 'text-brand-600 bg-brand-50 rounded-full' : 'text-slate-400 hover:text-brand-600'}`}
                            >
                                <PaperClipIcon className="w-6 h-6" />
                            </button>
                            
                            <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-400 transition-all flex items-center px-3 py-2">
                                <textarea 
                                    rows={1} 
                                    placeholder="Type a message..." 
                                    value={messageInput}
                                    onChange={(e) => setMessageInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="bg-transparent w-full border-none focus:ring-0 p-0 text-sm text-slate-800 placeholder-slate-400 resize-none max-h-32 outline-none"
                                />
                            </div>
                            {messageInput.trim() ? (
                                <button onClick={handleSendMessage} className="p-2.5 bg-brand-600 text-white rounded-full shadow-md hover:bg-brand-700 transition-transform active:scale-95">
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            ) : (
                                <button className="p-2.5 bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors">
                                    <MicrophoneIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
                        <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                            <PaperAirplaneIcon className="w-10 h-10 text-slate-300 -rotate-12" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">No Chat Selected</h3>
                        <p className="text-sm">Select a conversation to start messaging.</p>
                    </div>
                )}
            </div>

            {/* Right Sidebar: Contact Info */}
            {activeChat && (
                <div className={`w-80 bg-white border-l border-slate-200 flex flex-col absolute right-0 inset-y-0 z-30 shadow-xl transform transition-transform duration-300 ${isContactInfoOpen ? 'translate-x-0' : 'translate-x-full'} lg:static lg:shadow-none`}>
                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900">Contact Info</h3>
                        <button onClick={() => setIsContactInfoOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 lg:hidden"><CloseIcon className="w-5 h-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="flex flex-col items-center mb-6">
                            <div className={`w-20 h-20 rounded-full ${activeChat.avatarColor} text-white flex items-center justify-center font-bold text-2xl mb-3 shadow-sm border-4 border-white`}>
                                {activeChat.name.substring(0, 2).toUpperCase()}
                            </div>
                            <h2 className="text-lg font-bold text-slate-900">{activeChat.name}</h2>
                            <p className="text-sm text-slate-500">{activeChat.phone}</p>
                            {activeChat.assignedTo && (
                                <span className="mt-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                                    Assigned to: {activeChat.assignedTo}
                                </span>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Actions</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="flex items-center justify-center space-x-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors">
                                        <PhoneIcon className="w-4 h-4" /> <span>Call</span>
                                    </button>
                                    <button onClick={handleExportContact} className="flex items-center justify-center space-x-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-colors">
                                        <DownloadIcon className="w-4 h-4" /> <span>Export</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Labels</label>
                                    <button className="text-xs text-brand-600 font-bold hover:underline">Edit</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {activeChat.tags.map(tag => (
                                        <span key={tag} className="px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">{tag}</span>
                                    ))}
                                    <button className="px-2.5 py-1 rounded-md text-xs font-bold bg-white border border-dashed border-slate-300 text-slate-400 hover:text-brand-600 hover:border-brand-300 transition-colors">+ Add</button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notes</label>
                                </div>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                                    rows={4}
                                    placeholder="Add a note about this contact..."
                                ></textarea>
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Information</label>
                                <div className="bg-slate-50 rounded-lg border border-slate-100 p-3 space-y-2">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Email</span>
                                        <span className="font-medium text-slate-700">{activeChat.email}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Created</span>
                                        <span className="font-medium text-slate-700">Oct 24, 2023</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500">Source</span>
                                        <span className="font-medium text-slate-700">Web Form</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Inbox;
