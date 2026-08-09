import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    CloseIcon, PaperClipIcon, EmojiIcon, MicrophoneIcon, PaperAirplaneIcon,
    QuickReplyIcon, DocumentFileIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon,
    CheckIcon, DoubleCheckIcon, ClockIcon, SearchIcon, TrashIcon, PlusIcon
} from './icons';
import { inboxService } from '../services/inboxService';
import { tokenService } from '../services/tokenService';
import { Conversation, Message, Flow } from '../types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import InboxTemplateModal from './InboxTemplateModal';
import { quickReplyService } from '../services/quickReplyService';
import { tagService, Tag } from '../services/tagService';
import { supabase } from '../lib/supabase';
import { contactService } from '../services/contactService';
import { socket } from '../lib/socket';


const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const showErrorToast = (message: string) => {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg shadow-lg z-[9999] animate-fade-in flex items-center gap-2';
    alertDiv.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span class="text-sm font-medium">${message}</span>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 5000);
};

const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const MemoizedEmojiPicker = React.memo(({ onEmojiClick }: { onEmojiClick: (emojiData: EmojiClickData) => void }) => (
    <EmojiPicker
        onEmojiClick={onEmojiClick}
        width={350}
        height={400}
        lazyLoadEmojis={true}
        previewConfig={{ showPreview: false }}
        skinTonesDisabled
        searchDisabled={false}
    />
));
MemoizedEmojiPicker.displayName = 'MemoizedEmojiPicker';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    contactPhone: string;
    contactName?: string;
}

const SendWhatsAppMessageModal: React.FC<Props> = ({ isOpen, onClose, contactPhone, contactName }) => {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [messageInput, setMessageInput] = useState('');
    
    // UI State
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isOptedOut, setIsOptedOut] = useState(false);
    

    // Tags
    const [availableTagsList, setAvailableTagsList] = useState<Tag[]>([]);
    const [isTagInputOpen, setIsTagInputOpen] = useState(false);
    const [newTagInput, setNewTagInput] = useState('');

    const tagColorMap = useMemo(() => {
        return availableTagsList.reduce((acc, tag) => {
            acc[tag.name] = tag.color;
            return acc;
        }, {} as Record<string, string>);
    }, [availableTagsList]);

    useEffect(() => {
        if (!isOpen) return;
        tagService.getTags().then(tags => setAvailableTagsList(tags || [])).catch(console.error);
    }, [isOpen]);

    const handleAddTag = async (tag: string) => {
        if (!conversation) return;
        const currentTags = conversation.tags || [];
        if (currentTags.includes(tag)) return;

        const newTags = [...currentTags, tag];
        setConversation({ ...conversation, tags: newTags });

        try {
            await (supabase.from('conversations') as any).update({ tags: newTags }).eq('id', conversation.id);
            if (conversation.contact_phone) {
                await (supabase.from('contacts') as any).update({ tags: newTags }).eq('phone', conversation.contact_phone);
            }
        } catch (error: any) {
            console.error('Failed to update tags:', error);
            showErrorToast(`Failed to update tags: ${error.message}`);
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!conversation) return;
        const currentTags = conversation.tags || [];
        const newTags = currentTags.filter(t => t !== tagToRemove);
        setConversation({ ...conversation, tags: newTags });

        try {
            await (supabase.from('conversations') as any).update({ tags: newTags }).eq('id', conversation.id);
            if (conversation.contact_phone) {
                await (supabase.from('contacts') as any).update({ tags: newTags }).eq('phone', conversation.contact_phone);
            }
        } catch (error: any) {
            console.error('Failed to remove tag:', error);
            showErrorToast(`Failed to remove tag: ${error.message}`);
        }
    };

    const handleCreateNewTag = async () => {
        const tagName = newTagInput.trim();
        if (!tagName) return;

        const existing = availableTagsList.find(t => t.name.toLowerCase() === tagName.toLowerCase());
        if (existing) {
            handleAddTag(existing.name);
        } else {
            try {
                const newTag = await tagService.saveTag({ name: tagName });
                if (newTag) {
                    setAvailableTagsList(prev => [...prev, newTag]);
                    handleAddTag(newTag.name);
                }
            } catch (e) {
                console.error("Failed to create tag", e);
                showErrorToast("Failed to create tag.");
            }
        }
        setIsTagInputOpen(false);
        setNewTagInput('');
    };

    // Quick Replies
    const [quickReplies, setQuickReplies] = useState<Flow[]>([]);
    const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
    const [quickReplySearch, setQuickReplySearch] = useState('');
    const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const attachmentTypeRef = useRef<string>('document');
    const isSendingRef = useRef(false);

    // Initial Load
    useEffect(() => {
        if (!isOpen || !contactPhone) return;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const qrs = await quickReplyService.getQuickReplies();
                setQuickReplies(qrs);

                const cleanPhone = contactPhone.replace(/\D/g, '');
                
                const contactRes = await contactService.getContactsPaginated(1, 1, { search: cleanPhone });
                if (contactRes?.data && contactRes.data.length > 0) {
                    setIsOptedOut(contactRes.data[0].customData?.opted_out === true);
                } else {
                    setIsOptedOut(false);
                }

                const result = await inboxService.getConversations(1, 10, cleanPhone);
                const match = result.find(c => c.contact_phone.includes(cleanPhone) || cleanPhone.includes(c.contact_phone));
                
                if (match) {
                    setConversation(match);
                    const msgs = await inboxService.getMessages(match.id);
                    setMessages(msgs);
                    setTimeout(() => scrollToBottom(), 100);
                } else {
                    setConversation(null);
                    setMessages([]);
                }
            } catch (err) {
                console.error("Error loading chat data", err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [isOpen, contactPhone]);

    // Cleanup recording if closed
    useEffect(() => {
        if (!isOpen && isRecording) {
            handleCancelRecording();
        }
    }, [isOpen]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    };

    // Socket.IO Room Join
    useEffect(() => {
        if (!isOpen) return;

        const joinSocketRoom = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && socket) {
                socket.emit('join_room', user.id);
            }
        };

        if (socket.connected) {
            joinSocketRoom();
        }
        socket.on('connect', joinSocketRoom);

        return () => {
            socket.off('connect', joinSocketRoom);
        };
    }, [isOpen]);

    // Socket.IO Real-time Updates
    useEffect(() => {
        if (!isOpen || !conversation?.id) return;

        const handleMessageUpdate = (payload: any) => {
            if (payload.eventType === 'INSERT') {
                const newMessage = payload.new as Message;
                if (newMessage.conversation_id !== conversation.id) return;

                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;

                    const filtered = prev.filter(m => {
                        if (!String(m.id).startsWith('temp-')) return true;
                        let isMatch = m.type === newMessage.type && m.direction === newMessage.direction;
                        if (isMatch) {
                            if (m.type === 'template' as any) {
                                const mName = (m as any).template_name || (m as any).template?.name;
                                const newName = (newMessage as any).template_name || (newMessage as any).template?.name;
                                isMatch = mName === newName;
                            } else {
                                isMatch = (m.text === newMessage.text || m.media_url === newMessage.media_url);
                            }
                        }
                        return !isMatch;
                    });

                    return [...filtered, newMessage].sort((a, b) =>
                        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                });
                setTimeout(scrollToBottom, 100);
            } else if (payload.eventType === 'UPDATE') {
                const updatedMsg = payload.new as Message;
                if (updatedMsg.conversation_id !== conversation.id) return;
                setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
            }
        };

        socket.on('postgres_changes_messages', handleMessageUpdate);

        return () => {
            socket.off('postgres_changes_messages', handleMessageUpdate);
        };
    }, [isOpen, conversation?.id]);

    const filteredQuickReplies = useMemo(() => {
        if (!quickReplySearch.trim()) return quickReplies;
        const search = quickReplySearch.toLowerCase();
        return quickReplies.filter(qr => 
            qr.name.toLowerCase().includes(search) || 
            (qr.nodes?.[0]?.data?.message || qr.nodes?.[0]?.data?.body || '')?.toLowerCase().includes(search)
        );
    }, [quickReplies, quickReplySearch]);

    const handleSendMessage = async () => {
        if (!messageInput.trim() || isSendingRef.current) return;
        
        let targetConversationId = conversation?.id;
        const cleanPhone = contactPhone.replace(/\D/g, '');

        isSendingRef.current = true;
        const tempId = 'temp-' + Date.now();
        const newMessage: Message = {
            id: tempId,
            conversation_id: targetConversationId || 'temp',
            direction: 'out' as any,
            type: 'text',
            text: messageInput.trim(),
            status: 'sending' as any,
            created_at: new Date().toISOString()
        } as Message;

        setMessages(prev => [...prev, newMessage]);
        setMessageInput('');
        setTimeout(scrollToBottom, 100);

        try {
            if (!targetConversationId) {
                const newConv = await inboxService.createConversation(cleanPhone);
                if (newConv) {
                    targetConversationId = newConv.id;
                    setConversation(newConv);
                } else {
                    throw new Error("Could not create conversation");
                }
            }

            const sent = await inboxService.sendMessage(targetConversationId, { type: 'text', text: newMessage.text });
            if (sent) {
                setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
            }
        } catch (error) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
        } finally {
            isSendingRef.current = false;
        }
    };

    const handleSendTemplate = async (template: any) => {
        setIsTemplateModalOpen(false);
        if (isSendingRef.current) return;
        
        const cleanPhone = contactPhone.replace(/\D/g, '');
        let targetConversationId = conversation?.id;

        isSendingRef.current = true;
        const tempId = 'temp-' + Date.now();
        const newMessage: Message = {
            id: tempId,
            conversation_id: targetConversationId || 'temp',
            direction: 'out' as any,
            type: 'template' as any,
            template_name: template.name,
            status: 'sending' as any,
            created_at: new Date().toISOString()
        } as any;
        setMessages(prev => [...prev, newMessage]);
        setTimeout(scrollToBottom, 100);

        try {
            if (!targetConversationId) {
                const newConv = await inboxService.createConversation(cleanPhone);
                if (newConv) {
                    targetConversationId = newConv.id;
                    setConversation(newConv);
                } else {
                    throw new Error("Could not create conversation");
                }
            }

            const { text, ...metaPayload } = template;
            const sent = await inboxService.sendMessage(targetConversationId, {
                type: 'template',
                template: metaPayload,
                text: text
            });

            if (sent) {
                setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
            }
        } catch (error) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
        } finally {
            isSendingRef.current = false;
        }
    };

    const handleSendQuickReply = async (reply: Flow) => {
        setIsQuickReplyOpen(false);
        setMessageInput('');
        if (isSendingRef.current) return;
        
        const cleanPhone = contactPhone.replace(/\D/g, '');
        let targetConversationId = conversation?.id;

        isSendingRef.current = true;
        const firstNode = reply.nodes?.[0];
        const tempId = `temp-${Date.now()}`;

        // Optimistic UI for text-based quick replies
        if (firstNode?.type === 'textMessage') {
            const msg: Message = {
                id: tempId,
                conversation_id: targetConversationId || 'temp',
                text: firstNode.data.message || firstNode.data.body || '',
                direction: 'out',
                type: 'text',
                status: 'sending',
                created_at: new Date().toISOString()
            } as any;
            setMessages(prev => [...prev, msg]);
            setTimeout(scrollToBottom, 100);
        }

        try {
            if (!targetConversationId) {
                const newConv = await inboxService.createConversation(cleanPhone);
                if (newConv) {
                    targetConversationId = newConv.id;
                    setConversation(newConv);
                } else {
                    throw new Error("Could not create conversation");
                }
            }

            const success = await quickReplyService.sendQuickReply(reply.id, cleanPhone);
            if (success) {
                // If it was a text message, the backend would have sent it. We can optionally fetch to refresh,
                // but the standard Inbox just relies on optimistic UI and polling. 
                // We will manually update the status of the optimistic message here for immediate feedback.
                if (firstNode?.type === 'textMessage') {
                    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' as any } : m));
                } else {
                    // For non-text quick replies, fetch the latest messages so it shows up
                    setTimeout(async () => {
                        const msgs = await inboxService.getMessages(targetConversationId as string);
                        setMessages(msgs);
                        scrollToBottom();
                    }, 1000);
                }
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
            }
        } catch (error) {
            console.error("Error sending quick reply:", error);
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
        } finally {
            isSendingRef.current = false;
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsAttachmentOpen(false);
        if (file.size > 16 * 1024 * 1024) {
            alert("File size must be less than 16MB.");
            return;
        }

        if (!conversation?.id) {
            alert("Please send a regular text message first to establish the conversation before sending files.");
            return;
        }

        const tempId = 'temp-' + Date.now();
        const newMessage: Message = {
            id: tempId,
            conversation_id: conversation.id,
            direction: 'out' as any,
            type: attachmentTypeRef.current as any,
            media_url: URL.createObjectURL(file),
            status: 'sending' as any,
            created_at: new Date().toISOString()
        } as Message;
        setMessages(prev => [...prev, newMessage]);
        setTimeout(scrollToBottom, 100);

        try {
            const uploadedUrl = await inboxService.uploadMedia(file, 'outbound');
            if (uploadedUrl) {
                const sent = await inboxService.sendMessage(conversation.id, {
                    type: attachmentTypeRef.current,
                    media_url: uploadedUrl
                });
                if (sent) {
                    setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
                } else {
                    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
                }
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
            }
        } catch (err) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
        }
    };

    // Voice Recording Logic
    const handleStartRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks: BlobPart[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(track => track.stop());
            };

            // @ts-ignore
            mediaRecorder.getBlob = () => new Blob(chunks, { type: 'audio/webm' });

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingDuration(0);

            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please ensure permissions are granted.");
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            const recorder = mediaRecorderRef.current;

            recorder.addEventListener('stop', () => {
                // @ts-ignore
                const blob = recorder.getBlob();
                sendVoiceMessage(blob);
            }, { once: true });

            recorder.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const handleCancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const sendVoiceMessage = async (blob: Blob) => {
        if (!conversation?.id) {
            alert("Please send a regular text message first to establish the conversation before sending voice notes.");
            return;
        }

        const file = new File([blob], 'voice-message.webm', { type: 'audio/webm' });
        
        const tempId = 'temp-' + Date.now();
        const newMessage: Message = {
            id: tempId,
            conversation_id: conversation.id,
            direction: 'out' as any,
            type: 'audio' as any,
            media_url: URL.createObjectURL(file),
            status: 'sending' as any,
            created_at: new Date().toISOString()
        } as Message;
        
        setMessages(prev => [...prev, newMessage]);
        setTimeout(scrollToBottom, 100);

        try {
            const uploadedUrl = await inboxService.uploadMedia(file, 'outbound');
            if (uploadedUrl) {
                const sent = await inboxService.sendMessage(conversation.id, {
                    type: 'audio',
                    media_url: uploadedUrl
                });
                if (sent) {
                    setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
                } else {
                    setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
                }
            } else {
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
            }
        } catch (err) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' as any } : m));
        }
    };


    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
                {/* Center Modal Panel - Wider Layout */}
            <div 
                className="w-full max-w-4xl h-[85vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 bg-[#00684a] text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6 flex-1 min-w-0">
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                                <span className="font-bold text-lg">{contactName ? contactName.charAt(0).toUpperCase() : '#'}</span>
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-base truncate max-w-[200px]">{contactName || contactPhone}</h3>
                                <p className="text-sm text-white/80 truncate max-w-[200px]">{contactPhone}</p>
                            </div>
                        </div>
                        
                        {/* Tags */}
                        <div className="flex items-center gap-2 overflow-x-auto min-w-0 flex-nowrap scrollbar-hide">
                            {conversation?.tags?.map(tag => (
                                    <div
                                        key={tag}
                                        className="group/tag flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors relative shrink-0 whitespace-nowrap"
                                        style={{
                                            backgroundColor: tagColorMap[tag] ? `${tagColorMap[tag]}30` : 'rgba(255,255,255,0.1)',
                                            color: '#fff',
                                            borderColor: tagColorMap[tag] ? `${tagColorMap[tag]}60` : 'rgba(255,255,255,0.2)'
                                        }}
                                    >
                                        <span>{tag}</span>
                                        <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} className="opacity-0 group-hover/tag:opacity-100 ml-1 hover:text-white/80 transition-opacity"><CloseIcon className="w-3 h-3" /></button>
                                    </div>
                                ))}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsTagInputOpen(!isTagInputOpen)}
                                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-white/10 border border-dashed border-white/30 text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 shrink-0 whitespace-nowrap"
                                    >
                                        <PlusIcon className="w-3 h-3" /> Add Tag
                                    </button>

                                    {isTagInputOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsTagInputOpen(false)}></div>
                                            <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-in fade-in flex flex-col gap-1 text-slate-800">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="New tag..."
                                                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded mb-1 outline-none focus:border-[#00684a]"
                                                    value={newTagInput}
                                                    onChange={(e) => setNewTagInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleCreateNewTag()}
                                                />
                                                <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-0.5">
                                                    {availableTagsList.filter(t => !conversation.tags?.includes(t.name) && t.name.toLowerCase().includes(newTagInput.toLowerCase())).map(tag => (
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
                                                            className="w-full text-left px-2 py-1.5 hover:bg-slate-50 rounded text-xs text-[#00684a] font-bold flex items-center gap-2"
                                                        >
                                                            <PlusIcon className="w-3 h-3" /> Create "{newTagInput}"
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                    </div>
                    <div className="flex items-center gap-3 self-start">
                        {(() => {
                            let isWindowOpen = false;
                            let hours = 0;
                            let minutes = 0;

                            if (messages && messages.length > 0) {
                                const lastIncoming = [...messages].reverse().find(m => m.direction === 'in' || (m.direction as string) === 'inbound');
                                if (lastIncoming) {
                                    const lastTime = new Date(lastIncoming.created_at).getTime();
                                    const now = Date.now();
                                    const windowDuration = 24 * 60 * 60 * 1000;
                                    const diff = (lastTime + windowDuration) - now;
                                    isWindowOpen = diff > 0;
                                    hours = Math.floor(diff / (1000 * 60 * 60));
                                    minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                }
                            }

                            return (
                                <div className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold border shrink-0 transition-colors shadow-sm
                                    ${isWindowOpen ? (hours < 2 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : 'bg-amber-500 text-white border-amber-600'}
                                `} title={isWindowOpen ? `Customer Service Window: ${hours}h ${minutes}m left` : "Customer Service Session Expired"}>
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    <span className="tracking-wide whitespace-nowrap">
                                        {isWindowOpen ? `${hours}h ${minutes}m` : 'Expired'}
                                    </span>
                                </div>
                            );
                        })()}
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Opted Out Alert Banner */}
                {isOptedOut && (
                    <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-center shadow-sm relative z-20 w-full shrink-0">
                        <span className="text-red-700 text-xs md:text-sm font-bold flex items-center gap-2 text-center">
                            <span className="text-base">🛑</span> This user has opted out. Messaging is paused.
                        </span>
                    </div>
                )}

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto bg-[#efeae2] p-6 flex flex-col gap-2 custom-scrollbar relative" 
                     style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: '400px', backgroundBlendMode: 'overlay', backgroundColor: 'rgba(239,234,226,0.95)' }}>
                    
                    {isLoading && messages.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-8 h-8 border-3 border-[#00684a] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70">
                            <div className="w-20 h-20 bg-[#00684a]/10 rounded-full flex items-center justify-center mb-5">
                                <span className="text-3xl">👋</span>
                            </div>
                            <p className="text-base font-semibold text-slate-700">No previous conversation.</p>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">Send a message or template to start chatting.</p>
                        </div>
                    ) : (
                        messages.map((msg: any, index) => {
                            const isOutbound = msg.direction === 'outbound' || msg.direction === 'out';
                            const showDate = index === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();
                            
                            return (
                                <React.Fragment key={msg.id}>
                                    {showDate && (
                                        <div className="flex justify-center my-4">
                                            <span className="px-4 py-1.5 bg-white/90 text-xs font-semibold text-slate-500 rounded-lg shadow-sm border border-slate-100 uppercase tracking-wider backdrop-blur-sm">
                                                {new Date(msg.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} group max-w-full animate-in fade-in slide-in-from-bottom-1 duration-200`}>
                                        <div className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                            isOutbound 
                                                ? 'bg-[#E7FFDB] text-slate-800 rounded-tr-sm border border-[#D1F4C9]' 
                                                : 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'
                                        }`}>
                                            {/* Media Content */}
                                            {msg.type === 'image' && (
                                                <div className="mb-2 -mx-1 -mt-1 relative group/img overflow-hidden rounded-xl">
                                                    {msg.media_url ? (
                                                        <img src={msg.media_url} alt="Image" className="w-full h-auto max-h-80 object-cover" />
                                                    ) : (
                                                        <div className="w-full h-32 bg-slate-100/50 rounded-lg flex flex-col items-center justify-center text-slate-400 text-xs animate-pulse border border-slate-100">
                                                            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2"></div>
                                                            <span className="font-medium">Loading Media...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {msg.type === 'document' && (
                                                <div className="mb-2">
                                                    {msg.media_url ? (
                                                        <a href={msg.media_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-black/5 rounded-xl hover:bg-black/10 transition-colors">
                                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shrink-0 shadow-sm"><DocumentFileIcon className="w-5 h-5 text-red-500" /></div>
                                                            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-700 truncate">Document</p></div>
                                                        </a>
                                                    ) : (
                                                        <div className="flex items-center gap-2 animate-pulse mb-1 mt-1">
                                                            <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                            <span className="text-xs font-semibold text-emerald-600">DOWNLOADING...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {msg.type === 'audio' && (
                                                <div className="mb-1 mt-1 flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100 w-max">
                                                    <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white shrink-0">
                                                        <AudioFileIcon className="w-5 h-5" />
                                                    </div>
                                                    {msg.media_url ? (
                                                        <audio src={msg.media_url} controls className="max-w-[240px] h-8" />
                                                    ) : (
                                                        <div className="flex items-center gap-2 px-4 py-1">
                                                            <div className="w-4 h-4 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                                                            <span className="text-xs font-bold text-slate-500">Downloading...</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {msg.type === 'template' && (
                                                <div className="text-xs bg-[#00684a]/10 text-[#00684a] font-bold px-2.5 py-1.5 rounded-md mb-2 w-max border border-[#00684a]/20">TEMPLATE: {msg.template_name}</div>
                                            )}

                                            {/* Text Content */}
                                            {msg.type !== 'interactive' && msg.text && (
                                                <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</div>
                                            )}
                                            {msg.type === 'interactive' && msg.text && (() => {
                                                try {
                                                    const interactive = JSON.parse(msg.text);
                                                    return (
                                                        <div className="flex flex-col gap-2 min-w-[200px]">
                                                            {interactive.body?.text && (
                                                                <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                                                                    {interactive.body.text}
                                                                </div>
                                                            )}
                                                            {interactive.footer?.text && (
                                                                <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wide">
                                                                    {interactive.footer.text}
                                                                </div>
                                                            )}
                                                            {interactive.action?.buttons && (
                                                                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                                                    {interactive.action.buttons.map((btn: any, i: number) => (
                                                                        <div key={i} className="px-4 py-2 bg-[#00684a]/10 hover:bg-[#00684a]/15 transition-colors text-[#00684a] font-semibold text-sm rounded-lg text-center cursor-default">
                                                                            {btn.reply?.title || 'Button'}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                            {interactive.action?.sections && (
                                                                <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                                                    <div className="px-4 py-2 bg-[#00684a]/10 hover:bg-[#00684a]/15 transition-colors text-[#00684a] font-semibold text-sm rounded-lg text-center flex items-center justify-center gap-2 cursor-default">
                                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                                                        </svg>
                                                                        {interactive.action.button || 'View List'}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                } catch (e) {
                                                    return <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{msg.text}</div>;
                                                }
                                            })()}

                                            {/* Metadata */}
                                            <div className="flex items-center justify-end gap-1.5 mt-1.5 -mb-0.5">
                                                <span className="text-[11px] text-slate-400 font-medium">{formatTime(msg.created_at)}</span>
                                                {isOutbound && (
                                                    <span className="flex items-center">
                                                        {msg.status === 'sending' && <ClockIcon className="w-3.5 h-3.5 text-slate-400" />}
                                                        {msg.status === 'sent' && <CheckIcon className="w-3.5 h-3.5 text-slate-400" />}
                                                        {msg.status === 'delivered' && <DoubleCheckIcon className="w-3.5 h-3.5 text-slate-400" />}
                                                        {msg.status === 'read' && <DoubleCheckIcon className="w-3.5 h-3.5 text-blue-500" />}
                                                        {msg.status === 'failed' && <ClockIcon className="w-3.5 h-3.5 text-red-500" />}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} className="h-6" />
                </div>

                {/* Input Area */}
                <div className="bg-white p-4 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] border-t border-slate-200 z-10 shrink-0">
                    {isOptedOut ? (
                        <div className="flex items-center justify-center py-2">
                            <span className="text-red-600 font-semibold text-sm flex items-center gap-2">
                                <CloseIcon className="w-4 h-4" /> Cannot send messages (User Opted Out)
                            </span>
                        </div>
                    ) : (
                        <div className="flex items-end gap-3 relative">
                        {/* Attachments & Templates */}
                        <div className="flex items-center gap-1.5 shrink-0 pb-1">
                            <div className="relative">
                                <button onClick={() => setIsAttachmentOpen(!isAttachmentOpen)} className="p-2.5 text-slate-500 hover:text-[#00684a] hover:bg-slate-100 rounded-full transition-colors"><PaperClipIcon className="w-6 h-6" /></button>
                                {isAttachmentOpen && (
                                    <div className="absolute bottom-full left-0 mb-4 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 animate-in zoom-in-95">
                                        <button onClick={() => { attachmentTypeRef.current = 'document'; fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"><DocumentFileIcon className="w-5 h-5 text-[#7F66FF]" /><span className="text-sm font-semibold text-slate-700">Document</span></button>
                                        <button onClick={() => { attachmentTypeRef.current = 'image'; fileInputRef.current?.click(); }} className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors"><ImageFileIcon className="w-5 h-5 text-[#00A884]" /><span className="text-sm font-semibold text-slate-700">Photo</span></button>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setIsTemplateModalOpen(true)} className="p-2.5 text-[#00684a] bg-[#00684a]/10 hover:bg-[#00684a]/20 rounded-full transition-colors" title="Send Template">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                            </button>
                        </div>

                        {/* Input Box / Recording Area */}
                        <div className="flex-1 bg-slate-100/80 rounded-2xl border border-slate-200 focus-within:border-[#00684a]/40 focus-within:ring-4 focus-within:ring-[#00684a]/10 flex items-center px-4 py-2 transition-all relative min-h-[52px]">
                            {isRecording ? (
                                <div className="flex items-center gap-4 w-full h-full text-[#ef4444] animate-in fade-in">
                                    <div className="w-3 h-3 bg-[#ef4444] rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />
                                    <span className="font-mono font-medium tracking-widest text-[15px]">{formatDuration(recordingDuration)}</span>
                                    <div className="flex-1" />
                                    <button onClick={handleCancelRecording} className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors" title="Cancel Recording">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)} className="p-1 text-slate-400 hover:text-[#00684a] rounded-full transition-colors mr-2"><EmojiIcon className="w-6 h-6" /></button>
                                    
                                    <textarea
                                        rows={1}
                                        placeholder="Type a message or '/' for Quick Replies..."
                                        value={messageInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMessageInput(val);
                                            const lastSlashIndex = val.lastIndexOf('/');
                                            if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || val[lastSlashIndex - 1] === ' ')) {
                                                setIsQuickReplyOpen(true);
                                                setQuickReplySearch(val.substring(lastSlashIndex + 1));
                                            } else {
                                                setIsQuickReplyOpen(false);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (isQuickReplyOpen) {
                                                if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedQuickReplyIndex(prev => (prev + 1) % filteredQuickReplies.length); }
                                                else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedQuickReplyIndex(prev => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length); }
                                                else if (e.key === 'Enter') { e.preventDefault(); if (filteredQuickReplies[selectedQuickReplyIndex]) handleSendQuickReply(filteredQuickReplies[selectedQuickReplyIndex]); }
                                                else if (e.key === 'Escape') setIsQuickReplyOpen(false);
                                            } else if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        className="bg-transparent w-full border-none focus:ring-0 p-1 text-[15px] text-slate-800 placeholder-slate-400 resize-none max-h-40 outline-none leading-relaxed"
                                    />
                                </>
                            )}

                            {/* Emoji Picker */}
                            {isEmojiPickerOpen && !isRecording && (
                                <div className="absolute bottom-full left-0 mb-4 z-[110] shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                                    <MemoizedEmojiPicker onEmojiClick={(e) => { setMessageInput(prev => prev + e.emoji); }} />
                                </div>
                            )}

                            {/* Quick Replies Dropdown */}
                            {isQuickReplyOpen && !isRecording && (
                                <div className="absolute bottom-full left-0 mb-4 w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,104,74,0.3)] border-2 border-[#00684a] overflow-hidden z-[110] animate-in slide-in-from-bottom-2 ring-1 ring-black/10">
                                    <div className="px-4 py-3 bg-[#00684a] flex items-center gap-2 relative overflow-hidden">
                                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: '200px' }} />
                                        <QuickReplyIcon className="w-4 h-4 text-white relative z-10" />
                                        <span className="text-[13px] font-bold text-white tracking-wide relative z-10">Quick Library</span>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto custom-scrollbar bg-slate-50">
                                        {filteredQuickReplies.length > 0 ? (
                                            filteredQuickReplies.map((reply, index) => (
                                                <button
                                                    key={reply.id}
                                                    onClick={() => handleSendQuickReply(reply)}
                                                    onMouseEnter={() => setSelectedQuickReplyIndex(index)}
                                                    className={`w-full text-left px-5 py-4 flex items-center justify-between border-b border-slate-100 last:border-0 transition-all ${index === selectedQuickReplyIndex ? 'bg-white text-[#00684a] border-l-[4px] border-l-[#00684a] shadow-sm' : 'hover:bg-white border-l-[4px] border-l-transparent'}`}
                                                >
                                                    <div className="min-w-0 pr-3">
                                                        <p className={`text-[14px] font-bold truncate mb-0.5 ${index === selectedQuickReplyIndex ? 'text-[#00684a]' : 'text-slate-800'}`}>{reply.name}</p>
                                                        <p className="text-[12px] text-slate-500 truncate">{reply.nodes?.[0]?.data?.message || 'Ready to send...'}</p>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-8 text-center">
                                                <SearchIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                                <p className="text-[13px] font-bold text-slate-400">No matches found</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Send/Record Button */}
                        <div className="pb-1 shrink-0">
                            {isRecording ? (
                                <button onClick={handleStopRecording} className="p-3.5 bg-[#ef4444] text-white rounded-full shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:bg-[#dc2626] transition-transform active:scale-95 animate-in zoom-in duration-200">
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            ) : messageInput.trim() ? (
                                <button onClick={handleSendMessage} className="p-3.5 bg-[#00684a] text-white rounded-full shadow-[0_4px_12px_rgba(0,104,74,0.3)] hover:bg-[#005c42] transition-transform active:scale-95 animate-in zoom-in duration-200">
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            ) : (
                                <button onClick={handleStartRecording} className="p-3.5 bg-[#00684a] text-white rounded-full shadow-md hover:bg-[#005c42] transition-transform active:scale-95 animate-in zoom-in duration-200">
                                    <MicrophoneIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        </div>
                    )}
                </div>
            </div>
            </div>

            {/* Template Modal */}
            <InboxTemplateModal 
                isOpen={isTemplateModalOpen} 
                onClose={() => setIsTemplateModalOpen(false)} 
                onSend={handleSendTemplate} 
            />
        </>
    );
};

export default SendWhatsAppMessageModal;
