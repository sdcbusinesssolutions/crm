import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    SearchIcon, FilterIcon, MoreVerticalIcon, PaperClipIcon, EmojiIcon,
    MicrophoneIcon, PaperAirplaneIcon, DoubleCheckIcon, CheckIcon, ClockIcon,
    UserCircleIcon, ChevronLeftIcon, PhoneIcon, EditIcon, CloseIcon,
    UsersIcon, DocumentFileIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon,
    DownloadIcon, TrashIcon, BadgeIcon, MapIcon, PlusIcon, MenuIcon
} from './icons';

import { inboxService } from '../services/inboxService';
import { themeService } from '../services/themeService';
import { tagService, Tag } from '../services/tagService';
import { supabase } from '../lib/supabase';
import { Conversation, Message } from '../types';

// Helper to format time
const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

interface InboxProps {
    onToggleSidebar?: () => void;
}

const Inbox: React.FC<InboxProps> = ({ onToggleSidebar }) => {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<'All' | 'Mine' | 'Unassigned'>('All');
    const [filterTag, setFilterTag] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    // Use ref for synchronous locking to prevent double-submit
    const isSendingRef = useRef(false);

    // Tags State
    const [availableTagsList, setAvailableTagsList] = useState<Tag[]>([]);
    const [isTagInputOpen, setIsTagInputOpen] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);

    const availableTags = availableTagsList.map(t => t.name); // Derived for filter
    const maxFileSize = 16; // MB

    // Create a map for fast color lookup
    const tagColorMap = useMemo(() => {
        return availableTagsList.reduce((acc, tag) => {
            acc[tag.name] = tag.color;
            return acc;
        }, {} as Record<string, string>);
    }, [availableTagsList]);

    // Load Conversations
    useEffect(() => {
        const loadConversations = async () => {
            try {
                const data = await inboxService.getConversations();
                // Deduplicate by id
                const unique = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                console.log('Loaded conversations:', unique.length);
                setConversations(unique);
            } catch (error) {
                console.error('Failed to load conversations:', error);
            }
        };
        loadConversations();

        // Load tags
        tagService.getTags().then(tags => setAvailableTagsList(tags || [])).catch(console.error);

        // Poll for new conversations
        const interval = setInterval(loadConversations, 5000);
        return () => clearInterval(interval);
    }, []);

    // Load Messages & Mark as Read
    useEffect(() => {
        if (!activeChatId) return;

        const loadMessages = async () => {
            setIsLoadingMessages(true);
            // Clear previous messages to avoid confusion
            setMessages([]);
            try {
                const data = await inboxService.getMessages(activeChatId);
                console.log('Loaded messages:', data.map(m => ({ id: m.id, status: m.status })));
                // Deduplicate messages on load
                const uniqueMessages = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                setMessages(uniqueMessages);
                // Mark as read only on initial load/switch
                await inboxService.markAsRead(activeChatId);
            } catch (error) {
                console.error('Failed to load messages:', error);
            } finally {
                setIsLoadingMessages(false);
            }
        };
        loadMessages();

        // Poll for new messages every 3s
        const interval = setInterval(async () => {
            try {
                const data = await inboxService.getMessages(activeChatId);

                // Deduplicate fetched data
                const uniqueServerData = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

                setMessages(prev => {
                    const serverIds = new Set(uniqueServerData.map(m => m.id));

                    // Filter out optimistic messages that match a server message (fuzzy match)
                    const pendingOptimistic = prev.filter(m => {
                        // 1. Must be optimistic
                        if (!m.id.startsWith('temp-')) return false;

                        // 2. Check if a "twin" exists in server data
                        // Relaxed logic: Same Type + Same Text/Filename/Caption + Same Direction
                        const hasMatch = uniqueServerData.some(serverMsg =>
                            serverMsg.direction === 'out' &&
                            serverMsg.type === m.type &&
                            (
                                serverMsg.text === m.text ||
                                (m.type !== 'text' && serverMsg.filename === m.text) ||
                                (serverMsg.media_url && m.media_url && serverMsg.text === m.text)
                            )
                        );

                        // Keep ONLY if NO match found in server data
                        return !hasMatch;
                    });

                    const combined = [...uniqueServerData, ...pendingOptimistic];

                    if (JSON.stringify(prev) !== JSON.stringify(combined)) {
                        return combined.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    }
                    return prev;
                });
            } catch (error) {
                console.error('Error polling messages:', error);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [activeChatId]);

    const activeChat = useMemo(() =>
        conversations.find(c => c.id === activeChatId),
        [conversations, activeChatId]
    );

    const filteredChats = useMemo(() => {
        return conversations.filter(chat => {
            const matchesSearch =
                (chat.contact_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                chat.contact_phone.includes(searchTerm) ||
                (chat.last_message || '').toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            if (quickFilter === 'Mine' && chat.assigned_to !== 'me') return false;
            if (quickFilter === 'Unassigned' && chat.assigned_to !== null) return false;

            if (filterTag && !chat.tags?.includes(filterTag)) return false;

            return true;
        });
    }, [conversations, searchTerm, quickFilter, filterTag]);

    const scrollToBottom = (instant = false) => {
        if (chatContainerRef.current) {
            const { scrollHeight, clientHeight } = chatContainerRef.current;
            const maxScrollTop = scrollHeight - clientHeight;

            if (instant) {
                chatContainerRef.current.scrollTop = maxScrollTop > 0 ? maxScrollTop : 0;
            } else {
                chatContainerRef.current.scrollTo({
                    top: maxScrollTop,
                    behavior: 'smooth'
                });
            }
        }
    };

    const handleScroll = () => {
        if (chatContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            // Increased threshold to 150px to be more forgiving
            isAtBottomRef.current = distanceToBottom < 150;
        }
    };

    // Scroll to bottom when chat changes
    useEffect(() => {
        isAtBottomRef.current = true;

        // Aggressive scrolling sequence to handle layout shifts and image loading
        const scrollSequence = () => {
            scrollToBottom(true);
            setTimeout(() => scrollToBottom(true), 50);
            setTimeout(() => scrollToBottom(true), 150);
            setTimeout(() => scrollToBottom(true), 300); // Late catch for initial paint
        };

        requestAnimationFrame(scrollSequence);
    }, [activeChatId]);

    // Smart scroll on new messages
    useEffect(() => {
        if (chatContainerRef.current && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const isMyMessage = lastMessage?.direction === 'out';

            // Should scroll if we are already at bottom OR if it's my own message
            if (isAtBottomRef.current || isMyMessage) {
                requestAnimationFrame(() => {
                    scrollToBottom(false); // Smooth scroll for new messages
                    // Backup forced scroll
                    setTimeout(() => scrollToBottom(false), 200);
                });
            }
        }
    }, [messages]);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || !activeChatId || isSendingRef.current) return;

        isSendingRef.current = true;
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMsg: Message = {
            id: tempId,
            conversation_id: activeChatId,
            text: messageInput,
            direction: 'out',
            type: 'text',
            status: 'sent',
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticMsg]);
        const textToSend = messageInput; // Capture current input
        setMessageInput('');

        try {
            const sentMsg = await inboxService.sendMessage(activeChatId, { text: textToSend, type: 'text' });
            if (sentMsg) {
                setMessages(prev => {
                    const updated = prev.map(m => m.id === tempId ? sentMsg : m);
                    // Critical Deduplication: Ensure no duplicate IDs exist
                    return updated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                });
            } else {
                console.error("Message send failed silently");
                setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove optimistic message on silent failure
            }
        } catch (error) {
            console.error("Error sending message:", error);
            setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove optimistic message on error
        } finally {
            isSendingRef.current = false;
        }
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

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && activeChatId && !isSendingRef.current) {
            isSendingRef.current = true;
            // File Size Limits (MB)
            const IMAGE_LIMIT = 5;
            const MEDIA_LIMIT = 16;
            const DOC_LIMIT = 100;

            const fileSizeMB = file.size / (1024 * 1024);
            let limit = DOC_LIMIT;
            let typeLabel = 'document';

            if (file.type.startsWith('image')) {
                limit = IMAGE_LIMIT;
                typeLabel = 'image';
            } else if (file.type.startsWith('video') || file.type.startsWith('audio')) {
                limit = MEDIA_LIMIT;
                typeLabel = 'video/audio';
            }

            if (fileSizeMB > limit) {
                // Show custom styled alert
                const alertDiv = document.createElement('div');
                alertDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg shadow-lg z-50 animate-fade-in flex items-center gap-2';
                alertDiv.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-sm font-medium">File size (${fileSizeMB.toFixed(1)}MB) exceeds ${limit}MB limit for ${typeLabel}. Please compress the file.</span>
                `;
                document.body.appendChild(alertDiv);
                setTimeout(() => alertDiv.remove(), 5000);

                // Reset input
                if (fileInputRef.current) fileInputRef.current.value = '';
                isSendingRef.current = false;
                return;
            }

            // Optimistic UI
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            let type = 'document';
            if (file.type.startsWith('image')) type = 'image';
            else if (file.type.startsWith('video')) type = 'video';
            else if (file.type.startsWith('audio')) type = 'audio';

            const optimisticMsg: Message = {
                id: tempId,
                conversation_id: activeChatId,
                type: type as any,
                text: file.name,
                direction: 'out',
                status: 'sent',
                created_at: new Date().toISOString(),
                media_url: URL.createObjectURL(file),
                filename: file.name,
                mime_type: file.type
            };
            setMessages(prev => [...prev, optimisticMsg]);

            try {
                // Upload
                const mediaUrl = await inboxService.uploadMedia(file);
                if (mediaUrl) {
                    // Send Message
                    const sentMsg = await inboxService.sendMessage(activeChatId, {
                        type: type,
                        media_url: mediaUrl,
                        text: file.name
                    });
                    if (sentMsg) {
                        setMessages(prev => {
                            const updated = prev.map(m => m.id === tempId ? sentMsg : m);
                            // Critical Deduplication: Ensure no duplicate IDs exist
                            return updated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                        });
                    }
                }
            } catch (error) {
                console.error("Error sending media:", error);
                setMessages(prev => prev.filter(m => m.id !== tempId)); // Remove optimistic message on error
            } finally {
                isSendingRef.current = false;
            }
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleExportContactList = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const exportData = filteredChats.map(c => ({
            name: c.contact_name || c.contact_phone,
            phone: c.contact_phone,
            status: c.status,
            tags: c.tags?.join(', '),
            assignedTo: c.assigned_to || 'Unassigned'
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
            name: activeChat.contact_name,
            phone: activeChat.contact_phone,
            tags: activeChat.tags,
            status: activeChat.status,
            exportedAt: new Date().toISOString()
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contactData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${(activeChat.contact_name || 'contact').replace(/\s+/g, '_')}_contact.json`);
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
            contact: activeChat.contact_name || activeChat.contact_phone,
            messages: messages
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(chatExport, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `chat_history_${(activeChat.contact_name || 'chat').replace(/\s+/g, '_')}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        setIsHeaderMenuOpen(false);
    };

    const handleAddTag = async (tag: string) => {
        if (!activeChat) return;
        const currentTags = activeChat.tags || [];
        if (currentTags.includes(tag)) return;

        const newTags = [...currentTags, tag];

        // 1. Update Local State
        setConversations(prev => prev.map(c =>
            c.id === activeChat.id ? { ...c, tags: newTags } : c
        ));

        // 2. Update Backend
        try {
            // Update conversation (immediate feedback)
            const { error: convError } = await (supabase
                .from('conversations') as any)
                .update({ tags: newTags })
                .eq('id', activeChat.id);

            if (convError) throw convError;

            // Update contact (source of truth)
            if (activeChat.contact_phone) {
                const { data: updatedContacts, error: contactError } = await (supabase
                    .from('contacts') as any)
                    .update({ tags: newTags })
                    .eq('phone', activeChat.contact_phone)
                    .select();

                if (contactError) throw contactError;

                // If no contact was updated, it means it doesn't exist. Create it.
                if (!updatedContacts || updatedContacts.length === 0) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        await (supabase
                            .from('contacts') as any)
                            .insert([{
                                user_id: user.id,
                                phone: activeChat.contact_phone,
                                name: activeChat.contact_name || activeChat.contact_phone,
                                tags: newTags,
                                status: 'New',
                                source: 'inbox'
                            }]);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to update tags:', error);
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!activeChat) return;
        const currentTags = activeChat.tags || [];
        const newTags = currentTags.filter(t => t !== tagToRemove);

        // 1. Update Local State
        setConversations(prev => prev.map(c =>
            c.id === activeChat.id ? { ...c, tags: newTags } : c
        ));

        // 2. Update Backend
        try {
            await (supabase
                .from('conversations') as any)
                .update({ tags: newTags })
                .eq('id', activeChat.id);

            if (activeChat.contact_phone) {
                await (supabase
                    .from('contacts') as any)
                    .update({ tags: newTags })
                    .eq('phone', activeChat.contact_phone);
            }
        } catch (error) {
            console.error('Failed to remove tag:', error);
        }
    };

    const handleCreateNewTag = async () => {
        if (!newTagInput.trim()) return;
        const tagName = newTagInput.trim();

        // Check if exists
        const existing = availableTagsList.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (existing) {
            handleAddTag(existing.name);
        } else {
            // Create New
            try {
                const newTag = await tagService.saveTag({ name: tagName });
                setAvailableTagsList(prev => [...prev, newTag]);
                handleAddTag(newTag.name);
            } catch (e) {
                console.error("Failed to create tag", e);
            }
        }
        setNewTagInput('');
        setIsTagInputOpen(false);
    };

    // Helper to format text with WhatsApp markdown
    const formatWhatsAppText = (text?: string | null) => {
        if (!text) return null;
        let formatted = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold
        formatted = formatted.replace(/\*(.*?)\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
        // Italic
        formatted = formatted.replace(/_(.*?)_/g, '<em class="italic">$1</em>');
        // Strike
        formatted = formatted.replace(/~(.*?)~/g, '<del class="line-through text-slate-500">$1</del>');
        // Code
        formatted = formatted.replace(/```(.*?)```/gs, '<code class="bg-slate-100 px-1 py-0.5 rounded font-mono text-xs">$1</code>');
        // Newlines
        formatted = formatted.replace(/\n/g, '<br/>');

        return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
    };

    const renderMessageContent = (msg: Message) => {
        const type = msg.type?.toLowerCase();

        // Helper to safely parse JSON content
        const safeParse = (str?: string) => {
            try {
                return str ? JSON.parse(str) : null;
            } catch (e) {
                return null;
            }
        };

        switch (type) {
            case 'text':
                return <p className="text-sm text-slate-800 leading-relaxed">{formatWhatsAppText(msg.text)}</p>;

            case 'image':
            case 'sticker':
                return (
                    <div className="mb-1">
                        {msg.media_url ? (
                            <img
                                src={msg.media_url}
                                alt={type}
                                className={`rounded-lg max-w-full cursor-pointer object-contain bg-slate-50 ${type === 'sticker' ? 'w-32' : 'max-h-80'}`}
                                onClick={() => window.open(msg.media_url, '_blank')}
                                onLoad={() => {
                                    if (isAtBottomRef.current) scrollToBottom();
                                }}
                            />
                        ) : (
                            <div className="w-full h-32 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                                <ImageFileIcon className="w-8 h-8 mb-2 opacity-50" />
                                <span>Media Unavailable</span>
                            </div>
                        )}
                        {msg.text && type !== 'sticker' && <p className="text-sm text-slate-800 mt-2">{formatWhatsAppText(msg.text)}</p>}
                    </div>
                );

            case 'video':
                return (
                    <div className="mb-1">
                        {msg.media_url ? (
                            <div className="rounded-lg overflow-hidden bg-black max-h-80 relative">
                                <video
                                    src={msg.media_url}
                                    controls
                                    className="w-full max-h-80 object-contain"
                                    onLoadedData={() => {
                                        if (isAtBottomRef.current) scrollToBottom();
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="w-full h-32 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                                <VideoFileIcon className="w-8 h-8 mb-2 opacity-50" />
                                <span>Video Unavailable</span>
                            </div>
                        )}
                        {msg.text && <p className="text-sm text-slate-800 mt-2">{formatWhatsAppText(msg.text)}</p>}
                    </div>
                );

            case 'audio':
                return (
                    <div className="mb-1 flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0">
                            <AudioFileIcon className="w-5 h-5" />
                        </div>
                        {msg.media_url ? (
                            <audio src={msg.media_url} controls className="max-w-[240px] h-8" />
                        ) : (
                            <div className="text-xs text-slate-500 italic">Audio Unavailable</div>
                        )}
                    </div>
                );

            case 'document':
                return (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors group/doc" onClick={() => msg.media_url && window.open(msg.media_url, '_blank')}>
                        <div className="w-10 h-10 bg-white border border-slate-200 text-red-500 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                            <DocumentFileIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{msg.filename || 'Document'}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-medium">{msg.mime_type?.split('/')[1] || 'FILE'} • {msg.media_url ? 'CLICK TO OPEN' : 'UNAVAILABLE'}</p>
                        </div>
                        {msg.media_url && <DownloadIcon className="w-5 h-5 text-slate-400 group-hover/doc:text-[#00a884]" />}
                    </div>
                );

            case 'location':
                return (
                    <div className="mb-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        <div className="w-full h-32 bg-slate-200 flex items-center justify-center relative">
                            <MapIcon className="w-10 h-10 text-slate-400 opacity-50" />
                            <div className="absolute inset-x-0 bottom-0 bg-white/90 p-2 backdrop-blur-sm">
                                <p className="text-xs font-bold text-slate-800 truncate">Location Pin</p>
                            </div>
                        </div>
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${msg.latitude},${msg.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="block p-3 text-sm text-[#00a884] hover:bg-slate-50 font-bold text-center border-t border-slate-200 transition-colors"
                        >
                            View on Google Maps
                        </a>
                    </div>
                );

            case 'contacts':
                return (
                    <div className="mb-1 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3 shadow-sm">
                        <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center shrink-0 text-slate-500">
                            <UserCircleIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">Contact Card</p>
                            <button className="text-xs text-[#00a884] font-bold mt-1 uppercase">View Contact</button>
                        </div>
                    </div>
                );

            case 'template': {
                const data = safeParse(msg.text);
                const isJson = !!data;
                const templateName = isJson ? data.name : msg.text?.replace('Template: ', '');

                if (!isJson) {
                    return (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 border-l-4 border-l-purple-500">
                            <p className="text-xs font-bold text-purple-600 uppercase mb-1">Template Message</p>
                            <p className="text-sm text-slate-800">{String(templateName)}</p>
                        </div>
                    );
                }

                // Helper to find component case-insensitively
                const getComp = (type: string) => data.components?.find((c: any) => c.type.toLowerCase() === type.toLowerCase());

                // 1. HEADER (Media or Text)
                const headerComp = getComp('header');
                const headerParam = headerComp?.parameters?.[0];
                let headerMedia = null;
                let headerText = data._rendered_header_text; // From backend or simple param extraction

                if (headerParam?.type === 'image') headerMedia = <img src={headerParam.image?.link} className="rounded-t-lg w-full max-h-48 object-cover bg-slate-100" alt="Header" />;
                else if (headerParam?.type === 'video') headerMedia = <video src={headerParam.video?.link} controls className="rounded-t-lg w-full max-h-48 object-cover bg-black" />;
                else if (headerParam?.type === 'document') headerMedia = <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-t-lg border-b border-slate-200"><DocumentFileIcon className="w-5 h-5 text-red-500" /> <span className="text-xs font-medium text-slate-700">Document Header</span></div>;

                // 2. BODY & FOOTER
                const bodyText = data._rendered_body;
                const footerText = data._footer_text;
                const bodyComp = getComp('body');
                const bodyParams = bodyComp?.parameters?.map((p: any) => p.text).filter(Boolean);

                // 3. CAROUSEL
                let carouselMedia = null;
                const carouselComp = getComp('carousel') || getComp('CAROUSEL');
                if (carouselComp && carouselComp.cards && Array.isArray(carouselComp.cards)) {
                    carouselMedia = (
                        <div className="w-full max-w-[480px] -mx-1 mt-2">
                            <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar snap-x px-1">
                                {carouselComp.cards.map((card: any, idx: number) => {
                                    // Robust component extraction (handle mixed case)
                                    const cardComponents = card.components || [];
                                    const getCardComp = (t: string) => cardComponents.find((c: any) => c.type?.toUpperCase() === t.toUpperCase());

                                    const renderedCard = data._rendered_cards?.[idx];

                                    // 1. Header (Image/Video)
                                    const headerComp = getCardComp('HEADER');
                                    const headerParam = headerComp?.parameters?.[0];
                                    const headerExample = headerComp?.example?.header_handle?.[0];

                                    let mediaUrl = renderedCard?.media_url
                                        || headerParam?.image?.link
                                        || headerParam?.video?.link
                                        || headerParam?.document?.link
                                        || (typeof headerExample === 'string' ? headerExample : null);

                                    let mediaType = renderedCard?.media_type
                                        || headerParam?.type?.toUpperCase()
                                        || (headerParam?.image ? 'IMAGE' : headerParam?.video ? 'VIDEO' : 'IMAGE');

                                    // 2. Body
                                    const bodyComp = getCardComp('BODY');
                                    let cardBodyText = renderedCard?.body || bodyComp?.text || `Card ${idx + 1}`;

                                    // 3. Buttons
                                    // Prioritize buttons from _rendered_cards (which includes static + dynamic), 
                                    // otherwise fallback to card components (only has param buttons)
                                    const buttons = renderedCard?.buttons || cardComponents.filter((c: any) => c.type?.toUpperCase() === 'BUTTON');

                                    return (
                                        <div key={idx} className="min-w-[220px] w-[220px] bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden snap-center flex-shrink-0 flex flex-col group transition-shadow hover:shadow-md">
                                            {/* Media Area */}
                                            <div className="h-36 bg-slate-100 overflow-hidden relative border-b border-slate-100">
                                                {mediaUrl ? (
                                                    mediaType === 'VIDEO' ? (
                                                        <video src={mediaUrl} className="w-full h-full object-cover bg-black" controls />
                                                    ) : (
                                                        <img
                                                            src={mediaUrl}
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                                                            alt={`Card ${idx + 1}`}
                                                            onClick={() => window.open(mediaUrl, '_blank')}
                                                        />
                                                    )
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2">
                                                        <ImageFileIcon className="w-8 h-8 opacity-50" />
                                                        <span className="text-[10px] uppercase font-bold opacity-50">No Media</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Content Area */}
                                            <div className="p-3 flex-1 flex flex-col">
                                                <div className="mb-3 flex-1">
                                                    <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-medium line-clamp-4">
                                                        {formatWhatsAppText(String(cardBodyText))}
                                                    </p>
                                                </div>

                                                {/* Buttons */}
                                                {buttons.length > 0 && (
                                                    <div className="space-y-2 pt-2 mt-auto border-t border-slate-100">
                                                        {buttons.map((btn: any, bIdx: number) => {
                                                            const subType = btn.sub_type?.toLowerCase() || 'quick_reply';
                                                            const btnText = btn.text || renderedCard?.buttons?.[bIdx]?.text || (subType === 'url' ? 'Visit Website' : 'Select');

                                                            return (
                                                                <button
                                                                    key={bIdx}
                                                                    className="w-full py-2 px-3 bg-white text-[#00a884] text-xs font-bold text-center rounded border border-slate-200 hover:bg-slate-50 hover:border-[#00a884]/30 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                                >
                                                                    {subType === 'url' && <span className="text-[10px]">🔗</span>}
                                                                    {subType === 'quick_reply' && <span className="text-[10px]">↩️</span>}
                                                                    <span className="truncate">{btnText}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="flex flex-col gap-2">
                        {/* Main Message Bubble */}
                        <div className="rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden min-w-[240px]">
                            {headerMedia}
                            {headerText && <div className="px-3 pt-3 pb-1 font-bold text-slate-900 leading-tight">{headerText}</div>}

                            <div className="p-3">
                                {bodyText ? (
                                    <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                                        {formatWhatsAppText(bodyText)}
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1">
                                        <div className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 opacity-80">
                                            <span>📄</span> {data.name}
                                        </div>
                                        {bodyParams && bodyParams.length > 0 && (
                                            <div className="text-sm text-slate-600 bg-slate-50 px-2 py-1.5 rounded-md border border-slate-100 italic">
                                                {bodyParams.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {footerText && (
                                    <p className="text-xs text-slate-400 mt-3 pt-2 border-t border-slate-50">{footerText}</p>
                                )}
                            </div>

                            {/* Standard Template Buttons (If NOT Carousel, or if main block has buttons) */}
                            {/* Usually Carousel templates don't have main buttons, but guarding just in case */}
                            {!carouselMedia && (data._rendered_buttons || data.components?.some((c: any) => c.type.toLowerCase() === 'button')) && (
                                <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                                    {(data._rendered_buttons || data.components.filter((c: any) => c.type.toLowerCase() === 'button')).map((btn: any, idx: number) => {
                                        const subType = btn.sub_type?.toLowerCase() || btn.type?.toLowerCase();
                                        // Use backend rendered text OR fallback
                                        let label = btn.text || 'Button';

                                        // Intelligent Fallbacks
                                        if (!btn.text) {
                                            if (subType === 'url') label = 'Open Link';
                                            else if (subType === 'flow') label = 'Open Form';
                                            else if (subType === 'quick_reply') label = 'Reply';
                                            else if (subType === 'phone_number') label = 'Call';
                                        }

                                        // Icons
                                        let icon = null;
                                        if (subType === 'url') icon = <span className="text-xs">🔗</span>;
                                        else if (subType === 'flow') icon = <span className="text-xs">📝</span>;
                                        else if (subType === 'quick_reply') icon = <span className="text-xs">↩️</span>;
                                        else if (subType === 'phone_number') icon = <span className="text-xs">📞</span>;

                                        return (
                                            <div key={idx} className="w-full py-2.5 px-4 text-[#00a884] text-sm font-bold text-center hover:bg-slate-100 cursor-pointer transition-colors flex items-center justify-center gap-2">
                                                {icon} {label}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Carousel Scroll View (Outside the main bubble) */}
                        {carouselMedia}
                    </div>
                );
            }

            case 'interactive': {
                const data = safeParse(msg.text);

                // If parsing fails or data is not structured as expected, try to display the raw text differently
                if (!data) {
                    return (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            {/* Display text directly if it is just a string (e.g. from webhook button reply text) */}
                            <p className="text-sm text-slate-800 font-medium">{msg.text || 'Interactive Message'}</p>
                        </div>
                    );
                }

                // Check for Incoming Reply (User selected a button) - Structure: { type: "button_reply", button_reply: { title: "..." } }
                if (data.type === 'button_reply' && data.button_reply) {
                    return (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-800 font-medium">{data.button_reply.title || msg.text}</p>
                        </div>
                    );
                }
                if (data.type === 'list_reply' && data.list_reply) {
                    return (
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-800 font-medium">{data.list_reply.title || data.list_reply.description || msg.text}</p>
                        </div>
                    );
                }

                // Check for Flow Response (Formatted Table)
                if (data.type === 'nfm_reply' && data.nfm_reply) {
                    let nodes = [];
                    try {
                        const responseJson = typeof data.nfm_reply.response_json === 'string'
                            ? JSON.parse(data.nfm_reply.response_json)
                            : data.nfm_reply.response_json;

                        if (responseJson && typeof responseJson === 'object') {
                            Object.entries(responseJson).forEach(([key, value]) => {
                                // Filter out system keys
                                if (key !== 'flow_token') {
                                    // Prettify Key: Remove 'screen_x_' prefix and trailing numbers
                                    // e.g. "screen_1_TASK_NAME_0" -> "TASK NAME"
                                    let displayKey = key.replace(/^screen_\d+_/, '').replace(/_\d+$/, '').replace(/_/g, ' ');
                                    nodes.push(
                                        <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                            <td className="py-2 pl-2 pr-4 text-xs font-semibold text-slate-500 uppercase tracking-wide w-1/3 align-top">{displayKey}</td>
                                            <td className="py-2 pr-2 text-sm text-slate-800 break-words align-top">{String(value)}</td>
                                        </tr>
                                    );
                                }
                            });
                        }
                    } catch (e) {
                        console.error('Failed to parse flow response for table', e);
                        nodes.push(
                            <tr key="error">
                                <td colSpan={2} className="py-2 text-sm text-red-500">Failed to parse form data</td>
                            </tr>
                        );
                    }

                    return (
                        <div className="rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden min-w-[280px]">
                            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase">📄 Form Submission</span>
                                <span className="text-[10px] text-slate-400">Flow</span>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-left">
                                    <tbody className="divide-y divide-slate-50">
                                        {nodes.length > 0 ? nodes : (
                                            <tr><td className="p-4 text-sm text-slate-500 italic">No data submitted</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {/* Optional: Show original body text if it makes sense, usually just says 'Sent' */}
                            {/* <div className="px-3 py-2 text-xs text-slate-400 border-t border-slate-100">{data.nfm_reply.body}</div> */}
                        </div>
                    );
                }

                // Check for Carousel Message (Multiple Cards)
                if (data.type === 'carousel' && Array.isArray(data.action?.cards)) {
                    // Extract Cards
                    const cards = data.action.cards;

                    // Render Main Message Bubble (Intro Text) + Horizontal Scroll for Cards
                    return (
                        <div className="flex flex-col gap-2 max-w-full">
                            {/* Main Intro Bubble */}
                            {data.body?.text && (
                                <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm self-start">
                                    <p className="text-sm text-slate-800">{data.body.text}</p>
                                </div>
                            )}

                            {/* Cards Horizontal Scroll */}
                            <div className="flex overflow-x-auto gap-3 py-2 px-1 max-w-[85vw] md:max-w-md lg:max-w-lg scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                                {cards.map((card: any, idx: number) => {
                                    // Resolve Media
                                    const headerType = card.header?.type?.toLowerCase();
                                    const mediaUrl = card.header?.[headerType]?.link || card.header?.[headerType]?.id; // simplified

                                    // Resolve Buttons (Usually 1 or 2 per card)
                                    // Structure: card.action.parameters.url / display_text
                                    const btnLabel = card.action?.parameters?.display_text;
                                    const btnUrl = card.action?.parameters?.url;

                                    return (
                                        <div key={idx} className="min-w-[200px] w-[200px] bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col shrink-0">
                                            {/* Media Header */}
                                            {headerType === 'image' && mediaUrl ? (
                                                <div className="w-full bg-slate-50 relative">
                                                    <img
                                                        src={mediaUrl}
                                                        alt="Card Header"
                                                        className="w-full h-auto max-h-[200px] object-contain"
                                                    />
                                                </div>
                                            ) : headerType === 'video' && mediaUrl ? (
                                                <div className="w-full bg-black">
                                                    <video src={mediaUrl} className="w-full h-auto max-h-[200px]" controls={false} />
                                                </div>
                                            ) : null}

                                            {/* Body */}
                                            <div className="p-3 flex-1 flex flex-col">
                                                <p className="text-sm text-slate-800 line-clamp-3 mb-2">{card.body?.text}</p>
                                            </div>

                                            {/* Buttons */}
                                            {btnLabel && (
                                                <div className="border-t border-slate-100">
                                                    <a
                                                        href={btnUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block w-full py-2.5 text-center text-sm font-bold text-[#00a884] hover:bg-slate-50 transition-colors"
                                                    >
                                                        {String(btnLabel)}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                // Normal Interactive Message (Sent by Business)
                // Normal Interactive Message (Sent by Business)
                const headerType = data.header?.type?.toLowerCase();
                let headerMediaUrl = null;
                let headerText = null;

                if (headerType === 'text') {
                    headerText = data.header?.text;
                } else if (headerType && data.header?.[headerType]) {
                    headerMediaUrl = data.header[headerType].link || data.header[headerType].id;
                }

                const bodyText = data.body?.text;
                const footerText = data.footer?.text;

                return (
                    <div className="rounded-lg bg-white border border-slate-200 shadow-sm overflow-hidden min-w-[240px]">
                        {/* Media Header */}
                        {headerType === 'image' && headerMediaUrl && (
                            <div className="w-full bg-slate-50 relative">
                                <img
                                    src={headerMediaUrl}
                                    alt="Header"
                                    className="w-full h-auto max-h-[500px] object-contain"
                                />
                            </div>
                        )}
                        {headerType === 'video' && headerMediaUrl && (
                            <div className="w-full bg-black relative">
                                <video src={headerMediaUrl} className="w-full h-auto max-h-[500px]" controls />
                            </div>
                        )}
                        {headerType === 'document' && headerMediaUrl && (
                            <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                                <span className="text-xl">📄</span>
                                <a href={headerMediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">
                                    {data.header?.document?.filename || 'Document'}
                                </a>
                            </div>
                        )}

                        {/* Text Header */}
                        {headerText && <div className="px-3 pt-3 pb-1 font-bold text-slate-900 border-b border-slate-50/50">{headerText}</div>}
                        <div className="p-3">
                            <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {formatWhatsAppText(bodyText)}
                            </div>
                        </div>
                        {footerText && <div className="px-3 pb-3 pt-0 text-[10px] text-slate-400">{footerText}</div>}

                        {/* Interactive Buttons / List */}
                        <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                            {/* CTA / Flow Actions */}
                            {data.action?.name === 'flow' && data.action.parameters?.flow_cta && (
                                <div className="w-full py-2.5 px-4 text-[#00a884] text-sm font-bold text-center hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-2">
                                    📝 {data.action.parameters.flow_cta}
                                </div>
                            )}

                            {/* CTA URL Actions */}
                            {data.action?.name === 'cta_url' && data.action.parameters && (
                                <a
                                    href={data.action.parameters.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 px-4 text-[#00a884] text-sm font-bold text-center hover:bg-slate-100 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    🔗 {data.action.parameters.display_text}
                                </a>
                            )}

                            {data.action?.buttons?.map((btn: any) => (
                                <div key={btn.reply?.id} className="w-full py-2.5 px-4 text-[#00a884] text-sm font-bold text-center hover:bg-slate-100 cursor-pointer">
                                    {btn.reply?.title}
                                </div>
                            ))}
                            {/* List Message Button (triggered by sections presence) */}
                            {data.action?.sections && data.action.button && (
                                <div className="w-full py-2.5 px-4 text-[#00a884] text-sm font-bold text-center hover:bg-slate-100 cursor-pointer">
                                    {data.action.button}
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            default:
                return (
                    <div className="p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">
                        Unsupported message type: {type}
                    </div>
                );
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 overflow-hidden animate-fade-in relative">
            {/* Left Sidebar: Conversation List */}
            <div className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-white z-[90] md:z-10 fixed md:static inset-0 transform transition-transform duration-300 ${activeChatId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Header & Search */}
                <div className="p-4 border-b border-slate-100 bg-white z-20">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            {/* Mobile Menu Button (Only if onToggleSidebar is provided) */}
                            {onToggleSidebar && (
                                <button onClick={onToggleSidebar} className="lg:hidden p-1 text-slate-500 hover:bg-slate-50 rounded-lg">
                                    <MenuIcon className="w-6 h-6" />
                                </button>
                            )}
                            <h2 className="text-xl font-bold text-slate-900">Inbox</h2>
                        </div>
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
                                        <div className={`w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                                            {(chat.contact_name || chat.contact_phone).substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-sm ${activeChatId === chat.id ? 'text-brand-900' : 'text-slate-800'}`}>{chat.contact_name || chat.contact_phone}</h3>
                                            <span className="text-[10px] text-slate-400 font-medium">{chat.contact_phone}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-slate-400 font-medium">{formatTime(chat.updated_at)}</span>
                                        {chat.unread_count > 0 && (
                                            <span className="mt-1 bg-brand-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">{chat.unread_count}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="pl-[3.25rem]">
                                    <p className="text-xs text-slate-500 truncate mb-2">
                                        {(() => {
                                            const txt = chat.last_message || '';
                                            if (txt.startsWith('{')) {
                                                try {
                                                    const parsed = JSON.parse(txt);
                                                    if (parsed.name) {
                                                        // Template with params
                                                        let preview = `📄 Template: ${parsed.name}`;
                                                        try {
                                                            const params: string[] = [];
                                                            if (parsed.components) {
                                                                parsed.components.forEach((c: any) => {
                                                                    if (c.type === 'body' && c.parameters) {
                                                                        c.parameters.forEach((p: any) => {
                                                                            if (p.type === 'text') params.push(p.text);
                                                                        });
                                                                    }
                                                                });
                                                            }
                                                            if (params.length > 0) preview += ` (${params.join(', ')})`;
                                                        } catch (e) { }
                                                        return preview;
                                                    }
                                                    if (parsed.type === 'list') return `📋 ${parsed.header?.text || parsed.body?.text || 'List Message'}`;
                                                    if (parsed.type === 'button') return `🔘 ${parsed.body?.text || 'Button Message'}`;
                                                    if (parsed.type === 'cta_url') return `🔗 ${parsed.body?.text || 'CTA Link'}`;
                                                    if (parsed.type === 'flow') return `⚡ ${parsed.header?.text || 'Flow Message'}`;

                                                    if (parsed.type === 'button_reply') return `↩️ ${parsed.button_reply?.title || 'Button Reply'}`;
                                                    if (parsed.type === 'list_reply') return `📜 ${parsed.list_reply?.title || 'List Reply'}`;

                                                    // Interactive Fallback
                                                    if (parsed.type === 'interactive') {
                                                        if (parsed.header?.type === 'image') return '📷 Interactive Image';
                                                        if (parsed.header?.type === 'video') return '🎥 Interactive Video';

                                                        // Fallback for deeply nested interactive types if structure differs
                                                        if (parsed.interactive?.button_reply?.title) return `↩️ ${parsed.interactive.button_reply.title}`;
                                                        if (parsed.interactive?.list_reply?.title) return `📜 ${parsed.interactive.list_reply.title}`;

                                                        return 'Interactive Message';
                                                    }

                                                    return 'Interactive Message';
                                                } catch (e) { return txt; }
                                            }
                                            return txt;
                                        })()}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                        {chat.tags?.map(tag => (
                                            <span
                                                key={tag}
                                                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border"
                                                style={{
                                                    backgroundColor: tagColorMap[tag] ? `${tagColorMap[tag]}15` : '#f1f5f9',
                                                    color: tagColorMap[tag] || '#64748b',
                                                    borderColor: tagColorMap[tag] ? `${tagColorMap[tag]}30` : '#e2e8f0'
                                                }}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className={`flex-1 flex flex-col bg-[#efeae2] fixed md:static inset-0 z-[200] md:z-auto transform transition-transform duration-300 ${activeChatId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <header className="bg-white px-3 py-2 border-b border-slate-200 flex justify-between items-center shadow-sm shrink-0 w-full relative z-30">
                            <div
                                className="flex-1 min-w-0 flex items-center gap-3 overflow-hidden mr-2 cursor-pointer hover:bg-slate-50 rounded-lg p-1 transition-colors"
                                onClick={() => setIsContactInfoOpen(!isContactInfoOpen)}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); setActiveChatId(null); }}
                                    className="md:hidden p-1 -ml-1 text-slate-500 hover:text-slate-800 shrink-0"
                                >
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <div className={`w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border-2 border-white`}>
                                    {(activeChat.contact_name || activeChat.contact_phone).substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">
                                        {activeChat.contact_name || activeChat.contact_phone}
                                    </h3>
                                    {(() => {
                                        const lastIncoming = [...messages].reverse().find(m => m.direction === 'in');
                                        let statusText = "Active now";
                                        let isSessionOpen = true;

                                        if (lastIncoming) {
                                            const diff = (new Date(lastIncoming.created_at).getTime() + 24 * 3600 * 1000) - Date.now();
                                            if (diff > 0) {
                                                const h = Math.floor(diff / 3600000);
                                                const m = Math.floor((diff % 3600000) / 60000);
                                                statusText = `${h}h ${m}m left`;
                                            } else {
                                                statusText = "Session Expired";
                                                isSessionOpen = false;
                                            }
                                        }

                                        return (
                                            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                                                {/* Always show phone number if name is present, then status */}
                                                {activeChat.contact_name && (
                                                    <span className="font-medium text-slate-400 mr-1">{activeChat.contact_phone} •</span>
                                                )}
                                                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${isSessionOpen ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                                {statusText}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {/* 24h Window Timer */}
                                {(() => {
                                    const lastIncoming = [...messages].reverse().find(m => m.direction === 'in');
                                    if (!lastIncoming) return null;

                                    const lastTime = new Date(lastIncoming.created_at).getTime();
                                    const now = Date.now();
                                    const windowDuration = 24 * 60 * 60 * 1000;
                                    const diff = (lastTime + windowDuration) - now;
                                    const isWindowOpen = diff > 0;
                                    const hours = Math.floor(diff / (1000 * 60 * 60));
                                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                                    return (
                                        <div className={`
                                            hidden md:flex w-8 h-8 rounded-full flex-col items-center justify-center text-[9px] font-bold border shrink-0
                                            ${isWindowOpen ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}
                                        `} title={isWindowOpen ? `${hours}h ${minutes}m left` : "Session Expired"}>
                                            {isWindowOpen ? (
                                                <div className="flex flex-col items-center -space-y-0.5">
                                                    {hours > 0 && <span>{hours}h</span>}
                                                    <span>{minutes}m</span>
                                                </div>
                                            ) : <ClockIcon className="w-3.5 h-3.5" />}
                                        </div>
                                    );
                                })()}

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
                        <div ref={chatContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}>
                            {/* Date Divider */}
                            <div className="flex justify-center my-4">
                                <span className="bg-white/90 shadow-sm px-3 py-1 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">Today</span>
                            </div>

                            {isLoadingMessages ? (
                                <div className="flex justify-center items-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                                </div>
                            ) : (
                                messages.map((msg) => (
                                    <div key={msg.id + (msg.status || '')} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] sm:max-w-[60%] rounded-lg px-3 py-2 shadow-sm relative group ${msg.direction === 'out' ? 'bg-brand-100 border border-brand-200 rounded-tr-none' : 'bg-white border border-slate-200 rounded-tl-none'}`}>

                                            {renderMessageContent(msg)}

                                            <div className="flex items-center justify-end gap-1 mt-1 select-none">
                                                <span className="text-[10px] text-slate-400">{formatTime(msg.created_at)}</span>
                                                {msg.direction === 'out' && (
                                                    <span className="flex items-center" title={`Status: ${msg.status}`}>
                                                        {msg.status === 'read' && <DoubleCheckIcon className="w-3.5 h-3.5 text-blue-500" />}
                                                        {msg.status === 'delivered' && <DoubleCheckIcon className="w-3.5 h-3.5 text-slate-400" />}
                                                        {msg.status === 'sent' && <CheckIcon className="w-3.5 h-3.5 text-slate-400" />}
                                                    </span>
                                                )}
                                            </div>
                                            <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 bg-black/10 rounded text-slate-600 hover:text-black"><MoreVerticalIcon className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
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
            {activeChat && isContactInfoOpen && (
                <div className="fixed inset-0 z-[240] bg-black/20 backdrop-blur-sm" onClick={() => setIsContactInfoOpen(false)}></div>
            )}

            {
                activeChat && (
                    <div className={`w-80 bg-white border-l border-slate-200 flex flex-col fixed right-0 inset-y-0 z-[250] shadow-2xl transform transition-transform duration-300 ${isContactInfoOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">Contact Info</h3>
                            <button onClick={() => setIsContactInfoOpen(false)} className="p-1 text-slate-400 hover:text-slate-600"><CloseIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            <div className="flex flex-col items-center mb-6">
                                <div className="w-20 h-20 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-2xl mb-3 shadow-sm border-4 border-white">
                                    {(activeChat.contact_name || activeChat.contact_phone).substring(0, 2).toUpperCase()}
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">{activeChat.contact_name || 'Unknown Contact'}</h2>
                                <p className="text-sm text-slate-500">{activeChat.contact_phone}</p>
                                {activeChat.assigned_to && (
                                    <span className="mt-1 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">
                                        Assigned to: {activeChat.assigned_to}
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

                                <div className="space-y-3 relative z-40">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tags</label>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {activeChat.tags?.map(tag => (
                                            <div
                                                key={tag}
                                                className="group/tag flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold border transition-colors relative"
                                                style={{
                                                    backgroundColor: tagColorMap[tag] ? `${tagColorMap[tag]}15` : '#f1f5f9',
                                                    color: tagColorMap[tag] || '#475569',
                                                    borderColor: tagColorMap[tag] ? `${tagColorMap[tag]}30` : '#e2e8f0'
                                                }}
                                            >
                                                <span>{tag}</span>
                                                <button onClick={() => handleRemoveTag(tag)} className="opacity-0 group-hover/tag:opacity-100 ml-1 hover:text-red-500 transition-opacity"><CloseIcon className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsTagInputOpen(!isTagInputOpen)}
                                                className="px-2.5 py-1 rounded-md text-xs font-bold bg-white border border-dashed border-slate-300 text-slate-400 hover:text-brand-600 hover:border-brand-300 transition-colors flex items-center gap-1"
                                            >
                                                <PlusIcon className="w-3 h-3" /> Add
                                            </button>

                                            {isTagInputOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setIsTagInputOpen(false)}></div>
                                                    <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-fade-in flex flex-col gap-1">
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            placeholder="New tag..."
                                                            className="w-full px-2 py-1 text-xs border border-slate-200 rounded mb-1 outline-none focus:border-brand-500"
                                                            value={newTagInput}
                                                            onChange={(e) => setNewTagInput(e.target.value)}
                                                            onKeyDown={(e) => e.key === 'Enter' && handleCreateNewTag()}
                                                        />
                                                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
                                                            {availableTagsList.filter(t => !activeChat.tags?.includes(t.name) && t.name.toLowerCase().includes(newTagInput.toLowerCase())).map(tag => (
                                                                <button
                                                                    key={tag.id}
                                                                    onClick={() => { handleAddTag(tag.name); setIsTagInputOpen(false); setNewTagInput(''); }}
                                                                    className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded text-xs text-slate-700 font-medium flex items-center gap-2"
                                                                >
                                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#ccc' }}></div>
                                                                    {tag.name}
                                                                </button>
                                                            ))}
                                                            {newTagInput && !availableTagsList.some(t => t.name.toLowerCase() === newTagInput.toLowerCase()) && (
                                                                <button
                                                                    onClick={handleCreateNewTag}
                                                                    className="w-full text-left px-2 py-1.5 hover:bg-brand-50 rounded text-xs text-brand-600 font-bold"
                                                                >
                                                                    Create "{newTagInput}"
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
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
                                            <span className="text-slate-500">Phone</span>
                                            <span className="font-medium text-slate-700">{activeChat.contact_phone}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Last Updated</span>
                                            <span className="font-medium text-slate-700">{new Date(activeChat.updated_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Status</span>
                                            <span className="font-medium text-slate-700 capitalize">{activeChat.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Inbox;
