import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import {
    SearchIcon, FilterIcon, MoreVerticalIcon, PaperClipIcon, EmojiIcon,
    MicrophoneIcon, PaperAirplaneIcon, DoubleCheckIcon, CheckIcon, ClockIcon,
    UserCircleIcon, ChevronLeftIcon, PhoneIcon, EditIcon, CloseIcon,
    UsersIcon, DocumentFileIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon,
    DownloadIcon, TrashIcon, BadgeIcon, MapIcon, PlusIcon, MenuIcon, QuickReplyIcon, MessageIcon
} from './icons';

import { inboxService } from '../services/inboxService';
import { quickReplyService } from '../services/quickReplyService';
import { themeService } from '../services/themeService';
import { tagService, Tag } from '../services/tagService';
import { supabase } from '../lib/supabase';
import { Conversation, Message, Flow } from '../types';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import QuickReply from './QuickReply';
import InboxTemplateModal from './InboxTemplateModal';

// Helper to format time
const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Optimized Emoji Picker to prevent "hang" on re-renders
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

interface InboxProps {
    onToggleSidebar?: () => void;
}

const Inbox: React.FC<InboxProps> = ({ onToggleSidebar }) => {
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<'All' | 'Mine' | 'Unassigned' | 'Quick Reply'>('All');
    const [filterTag, setFilterTag] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [hasOpenedEmoji, setHasOpenedEmoji] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [convPage, setConvPage] = useState(1);
    const [hasMoreConvs, setHasMoreConvs] = useState(true);
    const [isLoadingMoreConvs, setIsLoadingMoreConvs] = useState(false);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    // Track user intent for attachment type (e.g. sending image as 'document')
    const attachmentTypeRef = useRef<string>('document');
    const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [isInitialScrollDone, setIsInitialScrollDone] = useState(true);
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
    const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);
    const [contactStatus, setContactStatus] = useState<string | null>(null);

    // Quick Replies State
    const [quickReplies, setQuickReplies] = useState<Flow[]>([]);
    const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
    const [quickReplySearch, setQuickReplySearch] = useState('');
    const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);

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
    const loadConversations = async (page = 1, append = false, sTerm = searchTerm, qFilter = quickFilter, fTag = filterTag, isPoll = false) => {
        if (isLoadingMoreConvs || (!hasMoreConvs && append && !isPoll)) return;
        
        if (append) setIsLoadingMoreConvs(true);
        try {
            const result = await inboxService.getConversations(page, 20, sTerm, qFilter, fTag);
            const newData = result || [];
            
            // Only update hasMoreConvs if we are NOT polling
            if (!isPoll) {
                if (newData.length < 20) {
                    setHasMoreConvs(false);
                } else {
                    setHasMoreConvs(true);
                }
            }

            setConversations(prev => {
                if (append) {
                    // Loading next page: Append and deduplicate, but DO NOT SORT globally
                    // Sorting globally causes items to jump to the top if they are newer,
                    // which breaks scroll position stability during infinite scroll.
                    const combined = [...prev, ...newData];
                    return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                }

                if (isPoll || (convPage > 1 && !sTerm && qFilter === 'All' && !fTag)) {
                    // Polling or background refresh: Merge with existing to avoid losing deep items
                    const combined = [...newData, ...prev];
                    const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                    // For polling, we DO sort because we want new/updated items at the top,
                    // but we expect most items to stay in place or move slightly.
                    return unique.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
                }

                // Fresh load (search/filter change): Replace
                return newData;
            });
            
            if (!append && page === 1) {
                // Load tags only on initial load
                tagService.getTags().then(tags => setAvailableTagsList(tags || [])).catch(console.error);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        } finally {
            if (append) setIsLoadingMoreConvs(false);
        }
    };

    useEffect(() => {
        setConvPage(1);
        setHasMoreConvs(true);
        loadConversations(1, false, searchTerm, quickFilter, filterTag);

        // Poll for new conversations (only if NOT searching/filtering AND user is at the top)
        let interval: any;
        if (!searchTerm && quickFilter === 'All' && !filterTag) {
            interval = setInterval(() => {
                // Only poll if the user is on the first page or near the top
                // This prevents the "reset to top" bug while scrolling deep
                loadConversations(1, false, '', 'All', '', true);
            }, 10000); // Increased to 10s for stability
        }
        return () => { if (interval) clearInterval(interval); };
    }, [quickFilter, filterTag, searchTerm]); // Reload when filters OR search change

    const handleConvScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight < 200 && hasMoreConvs && !isLoadingMoreConvs) {
            const nextPage = convPage + 1;
            setConvPage(nextPage);
            loadConversations(nextPage, true, searchTerm, quickFilter, filterTag);
        }
    };

    // Load Quick Replies
    useEffect(() => {
        quickReplyService.getQuickReplies().then(setQuickReplies).catch(console.error);
    }, [quickFilter]);

    // Force refresh when dropdown is opened to catch new one immediately
    useEffect(() => {
        if (isQuickReplyOpen) {
            quickReplyService.getQuickReplies().then(setQuickReplies).catch(console.error);
        }
    }, [isQuickReplyOpen]);

    // Load Messages & Mark as Read
    useEffect(() => {
        if (!activeChatId) return;

        const loadMessages = async () => {
            setIsLoadingMessages(true);
            // Clear previous messages to avoid confusion
            setMessages([]);
            // Reset pagination state for new conversation
            setHasMoreMessages(true);
            setMessageOffset(0);

            try {
                // Load initial batch of messages (most recent)
                const data = await inboxService.getMessages(activeChatId, MESSAGE_BATCH_SIZE, 0);
                console.log('Loaded messages:', data.map(m => ({ id: m.id, status: m.status })));
                // Deduplicate messages on load
                const uniqueMessages = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                setMessages(uniqueMessages);

                // If we got fewer messages than batch size, there are no more
                if (data.length < MESSAGE_BATCH_SIZE) {
                    setHasMoreMessages(false);
                }

                // Mark as read only on initial load/switch
                await inboxService.markAsRead(activeChatId);
            } catch (error) {
                console.error('Failed to load messages:', error);
            } finally {
                setIsLoadingMessages(false);
            }
        };
        loadMessages();

        // Poll for new messages every 3s - Only fetch recent messages for efficiency
        const interval = setInterval(async () => {
            try {
                // Only fetch the most recent 20 messages for polling (not all messages)
                const data = await inboxService.getMessages(activeChatId, 20, 0);

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

    // Load contact status when active chat changes
    useEffect(() => {
        if (!activeChat) {
            setContactStatus(null);
            return;
        }

        const loadContactStatus = async () => {
            try {
                const phone = activeChat.contact_phone;
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                const { data: contact } = await (supabase
                    .from('contacts') as any)
                    .select('status')
                    .eq('phone', phone)
                    .eq('user_id', user.id)
                    .maybeSingle();

                setContactStatus(contact?.status || 'Active');
            } catch (error) {
                console.error('Failed to load contact status:', error);
                setContactStatus('Active');
            }
        };
        loadContactStatus();
    }, [activeChat]);

    // Now that we have server-side filtering, filteredChats is just conversations
    const filteredChats = conversations;

    const filteredQuickReplies = useMemo(() => {
        if (!quickReplySearch) return quickReplies;
        return quickReplies.filter(r =>
            r.name.toLowerCase().includes(quickReplySearch.toLowerCase()) ||
            (r.nodes?.[0]?.data?.message || '').toLowerCase().includes(quickReplySearch.toLowerCase())
        );
    }, [quickReplies, quickReplySearch]);

    const handleSendQuickReply = async (reply: Flow) => {
        if (!activeChat || isSendingRef.current) return;

        setIsQuickReplyOpen(false);
        setMessageInput('');
        isSendingRef.current = true;

        // Optimistic UI for text-based quick replies
        const node = reply.nodes?.[0];
        const tempId = `temp-${Date.now()}`;
        
        if (node?.type === 'textMessage') {
            const msg: Message = {
                id: tempId,
                conversation_id: activeChat.id,
                text: node.data.message,
                direction: 'out',
                type: 'text',
                status: 'sent',
                created_at: new Date().toISOString()
            };
            setMessages(prev => [...prev, msg]);
        }

        try {
            const success = await quickReplyService.sendQuickReply(reply.id, activeChat.contact_phone);
            if (success) {
                // If it was a text message, the poller will eventually replace the tempId
                // For interactive messages, we wait for the poller
                console.log("Quick reply sent successfully");
            } else {
                alert("Failed to send quick reply");
                if (node?.type === 'textMessage') {
                    setMessages(prev => prev.filter(m => m.id !== tempId));
                }
            }
        } catch (error) {
            console.error("Error sending quick reply:", error);
            if (node?.type === 'textMessage') {
                setMessages(prev => prev.filter(m => m.id !== tempId));
            }
        } finally {
            isSendingRef.current = false;
        }
    };


    // Track if we are in the middle of switching chats to force scroll
    const shouldForceScrollRef = useRef(false);

    // Pagination state
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [messageOffset, setMessageOffset] = useState(0);
    const MESSAGE_BATCH_SIZE = 50; // Load 50 messages at a time for smooth scrolling

    const scrollToBottom = (instant = false) => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({
                behavior: instant ? 'auto' : 'smooth',
                block: 'end'
            });
        }
    };

    const loadMoreMessages = async () => {
        if (!activeChatId || isLoadingMore || !hasMoreMessages) return;

        setIsLoadingMore(true);
        const container = chatContainerRef.current;
        const previousScrollHeight = container?.scrollHeight || 0;
        const previousScrollTop = container?.scrollTop || 0;

        try {
            // Calculate next offset
            const nextOffset = messages.length;

            // Fetch older messages
            const olderMessages = await inboxService.getMessages(activeChatId, MESSAGE_BATCH_SIZE, nextOffset);

            if (olderMessages.length === 0) {
                setHasMoreMessages(false);
                return;
            }

            // Prepend older messages
            setMessages(prev => {
                const combined = [...olderMessages, ...prev];
                return combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            });

            // Restore scroll position after new messages are added
            // Using requestAnimationFrame ensures the DOM has updated before we measure
            requestAnimationFrame(() => {
                if (container) {
                    const newScrollHeight = container.scrollHeight;
                    const scrollDiff = newScrollHeight - previousScrollHeight;
                    
                    // Temporarily disable smooth scroll for the jump to prevent jitter
                    const originalScrollBehavior = container.style.scrollBehavior;
                    container.style.scrollBehavior = 'auto';
                    container.scrollTop = previousScrollTop + scrollDiff;
                    // Restore original behavior after the jump
                    setTimeout(() => {
                        if (container) container.style.scrollBehavior = originalScrollBehavior;
                    }, 50);
                }
            });

        } catch (error) {
            console.error('Failed to load more messages:', error);
        } finally {
            setIsLoadingMore(false);
        }
    };

    const handleScroll = useMemo(() => {
        // Debounce scroll handler to prevent excessive calls (performance optimization)
        let scrollTimeout: NodeJS.Timeout | null = null;

        return () => {
            if (!chatContainerRef.current) return;

            const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
            const distanceToBottom = scrollHeight - scrollTop - clientHeight;
            isAtBottomRef.current = distanceToBottom < 150;

            // Debounce infinite scroll trigger to prevent rapid API calls
            if (scrollTimeout) clearTimeout(scrollTimeout);

            scrollTimeout = setTimeout(() => {
                // Infinite scroll: Load more when user scrolls near the top
                const distanceToTop = scrollTop;
                if (distanceToTop < 200 && !isLoadingMore && hasMoreMessages) {
                    loadMoreMessages();
                }
            }, 100); // 100ms debounce - smooth but responsive
        };
    }, [isLoadingMore, hasMoreMessages]); // Only recreate if these change



    // Scroll to bottom when chat changes
    useEffect(() => {
        shouldForceScrollRef.current = true;
        isAtBottomRef.current = true;
        setIsInitialScrollDone(false); // Hide chat until scrolled
    }, [activeChatId]);

    // Use LayoutEffect for the "Instant Snap" before the browser paints
    useLayoutEffect(() => {
        if (activeChatId && shouldForceScrollRef.current) {
            const container = chatContainerRef.current;
            
            // If we are still loading, wait
            if (isLoadingMessages) return;

            // If no messages yet after loading, just show the UI
            if (messages.length === 0) {
                setIsInitialScrollDone(true);
                shouldForceScrollRef.current = false;
                return;
            }

            if (container) {
                // Initial snap using double requestAnimationFrame to ensure layout is ready
                const performScroll = () => {
                    if (!container) return;
                    
                    const originalScrollBehavior = container.style.scrollBehavior;
                    container.style.scrollBehavior = 'auto';
                    container.scrollTop = container.scrollHeight;
                    
                    // Small timeout to allow heavy assets (images/avatars) to take up space
                    setTimeout(() => {
                        if (container) {
                            container.scrollTop = container.scrollHeight;
                            container.style.scrollBehavior = originalScrollBehavior;
                            setIsInitialScrollDone(true);
                            shouldForceScrollRef.current = false;
                        }
                    }, 150);
                };

                requestAnimationFrame(() => {
                    requestAnimationFrame(performScroll);
                });
            }
        }
    }, [activeChatId, messages, isLoadingMessages]);

    // Secondary effect for media loading and new incoming messages
    useEffect(() => {
        if (messages.length === 0 || shouldForceScrollRef.current) return;

        // Normal behavior for new incoming messages (smooth scroll)
        const lastMessage = messages[messages.length - 1];
        const isMyMessage = lastMessage?.direction === 'out';

        if (isAtBottomRef.current || isMyMessage) {
            scrollToBottom(false);
        }
    }, [messages.length]);

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

    const handleSendTemplate = async (templatePayload: any) => {
        if (!activeChatId || isSendingRef.current) return;

        isSendingRef.current = true;
        try {
            const { text, ...metaPayload } = templatePayload;
            const sentMsg = await inboxService.sendMessage(activeChatId, { 
                type: 'template', 
                template: metaPayload,
                text: text
            });
            if (sentMsg) {
                setMessages(prev => {
                    const updated = [...prev, sentMsg];
                    // Critical Deduplication: Ensure no duplicate IDs exist
                    return updated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                });
            }
        } catch (error) {
            console.error("Error sending template:", error);
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
            // Reset value to ensure onChange triggers even if same file selected
            fileInputRef.current.value = '';

            attachmentTypeRef.current = type;
            let accept = '*/*';
            switch (type) {
                case 'image': accept = 'image/*'; break;
                case 'video': accept = 'video/*'; break;
                case 'audio': accept = 'audio/*'; break;
                case 'document': accept = '*/*'; break;
            }
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
        setIsAttachmentOpen(false);
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file && !activeChatId) {
            alert("Please select a chat to send media.");
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

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

            // Determine type: Use user selection if 'document', otherwise auto-detect to ensure consistency
            let type = attachmentTypeRef.current;

            // If user clicked 'document', keep it as document (even if it's an image)
            // If user clicked media types, verify/force the detected type matches
            if (type !== 'document') {
                if (file.type.startsWith('image')) type = 'image';
                else if (file.type.startsWith('video')) type = 'video';
                else if (file.type.startsWith('audio')) type = 'audio';
                else type = 'document'; // Fallback if they picked a file not matching the requested media
            } else {
                type = 'document';
            }

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

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const sendVoiceMessage = async (audioBlob: Blob) => {
        // We use .webm because that is the actual format produced by MediaRecorder in most browsers.
        // The server will handle converting/downgrading this to a 'Document' if WhatsApp doesn't support the audio format.
        const file = new File([audioBlob], `voice_message_${Date.now()}.webm`, { type: 'audio/webm' });

        // Optimistic UI
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const optimisticMsg: Message = {
            id: tempId,
            conversation_id: activeChatId,
            type: 'audio',
            text: 'Voice Message',
            direction: 'out',
            status: 'sent',
            created_at: new Date().toISOString(),
            media_url: URL.createObjectURL(file), // Local preview
            filename: file.name,
            mime_type: file.type
        };
        setMessages(prev => [...prev, optimisticMsg]);
        isSendingRef.current = true;

        try {
            const mediaUrl = await inboxService.uploadMedia(file);
            if (mediaUrl) {
                const sentMsg = await inboxService.sendMessage(activeChatId, {
                    type: 'audio',
                    media_url: mediaUrl,
                    text: 'Voice Message'
                });
                if (sentMsg) {
                    setMessages(prev => {
                        const updated = prev.map(m => m.id === tempId ? sentMsg : m);
                        return updated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                    });
                }
            }
        } catch (error) {
            console.error("Error sending voice message:", error);
            setMessages(prev => prev.filter(m => m.id !== tempId));
        } finally {
            isSendingRef.current = false;
        }
    };

    const handleStartRecording = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Microphone access not supported. Please ensure you are using HTTPS.");
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks: BlobPart[] = [];

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.push(e.data);
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                // Only send if it wasn't cancelled (checked via state in caller, but safely handled here)
                // We'll rely on handleStopRecording to trigger the send if appropriate
                stream.getTracks().forEach(track => track.stop());
            };

            // Custom method attached to the recorder to access chunks later if needed
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
            mediaRecorderRef.current.stop(); // Stops stream but we don't handle data
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setMessageInput((prev) => prev + emojiData.emoji);
    };

    const handleClearChat = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!activeChatId) return;
        setIsClearChatModalOpen(true);
    };

    const confirmClearChat = async () => {
        if (!activeChatId) return;

        try {
            await inboxService.clearChat(activeChatId);

            setMessages([]);
            // Also update the last message in the conversation list locally if needed
            setConversations(prev => prev.map(c =>
                c.id === activeChatId ? { ...c, last_message: null, updated_at: new Date().toISOString() } : c
            ));
            setIsClearChatModalOpen(false);
        } catch (error: any) {
            console.error("Error clearing chat:", error);
            alert(`Failed to clear chat history: ${error.message || "Unknown error"}`);
            setIsClearChatModalOpen(false);
        }
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

    const handleBlockContact = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeChatId) return;

        if (window.confirm("Are you sure you want to block this contact? They will be marked as 'Blocked'.")) {
            try {
                await inboxService.blockContact(activeChatId);
                setContactStatus('Blocked'); // Update local state
                alert("Contact blocked successfully.");
                setIsHeaderMenuOpen(false);
            } catch (error: any) {
                console.error("Error blocking contact:", error);
                alert(`Failed to block contact: ${error.message || "Unknown error"}`);
            }
        }
    };

    const handleUnblockContact = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeChatId) return;

        if (window.confirm("Are you sure you want to unblock this contact? They will be marked as 'Active'.")) {
            try {
                await inboxService.unblockContact(activeChatId);
                setContactStatus('Active'); // Update local state
                alert("Contact unblocked successfully.");
                setIsHeaderMenuOpen(false);
            } catch (error: any) {
                console.error("Error unblocking contact:", error);
                alert(`Failed to unblock contact: ${error.message || "Unknown error"}`);
            }
        }
    };

    const handleExportChat = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!activeChat) return;

        // Define CSV Headers
        const headers = ['Date', 'Time', 'Sender', 'Type', 'Content', 'Status'];

        // Map messages to rows
        const rows = messages.map(msg => {
            const date = new Date(msg.created_at);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString();
            const sender = msg.direction === 'out' ? 'Business' : (activeChat.contact_name || activeChat.contact_phone);
            const content = msg.text ? `"${msg.text.replace(/"/g, '""')}"` : (msg.media_url || '[Media]');
            const status = msg.status;

            return [
                dateStr,
                timeStr,
                sender,
                msg.type,
                content,
                status
            ].join(',');
        });

        // Combine headers and rows
        const csvContent = [headers.join(','), ...rows].join('\n');

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `chat_history_${(activeChat.contact_name || 'chat').replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(downloadAnchorNode);
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

                if (headerParam?.type === 'image') {
                    const imgSrc = headerParam.image?.link || msg.media_url;
                    if (imgSrc) {
                        headerMedia = <img src={imgSrc} className="rounded-t-lg w-full max-h-48 object-cover bg-slate-100" alt="Header" onLoad={() => (isAtBottomRef.current || shouldForceScrollRef.current) && scrollToBottom(shouldForceScrollRef.current)} />;
                    }
                }
                else if (headerParam?.type === 'video') {
                    const videoSrc = headerParam.video?.link || msg.media_url;
                    if (videoSrc) {
                        headerMedia = <video src={videoSrc} controls className="rounded-t-lg w-full max-h-48 object-cover bg-black" onLoadedData={() => (isAtBottomRef.current || shouldForceScrollRef.current) && scrollToBottom(shouldForceScrollRef.current)} />;
                    }
                }
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
                                                        <video src={mediaUrl} className="w-full h-full object-cover bg-black" controls onLoadedData={() => (isAtBottomRef.current || shouldForceScrollRef.current) && scrollToBottom(shouldForceScrollRef.current)} />
                                                    ) : (
                                                        <img
                                                            src={mediaUrl}
                                                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-500"
                                                            alt={`Card ${idx + 1}`}
                                                            onClick={() => window.open(mediaUrl, '_blank')}
                                                            onLoad={() => (isAtBottomRef.current || shouldForceScrollRef.current) && scrollToBottom(shouldForceScrollRef.current)}
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
                            <div className="flex overflow-x-auto gap-3 py-2 px-1 max-w-[85vw] md:max-w-md lg:max-w-lg custom-scrollbar snap-x">
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
                    // Fallback to msg.media_url if link is missing
                    headerMediaUrl = data.header[headerType].link || msg.media_url;
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
            } // Closing brace for the 'interactive' case

            case 'button': {
                return (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-800 font-medium">{msg.text}</p>
                    </div>
                );
            }

            default:
                if (type === 'unsupported') {
                    return (
                        <div className="flex flex-col gap-1 p-3 bg-slate-50 border border-slate-200 rounded-lg max-w-[280px]">
                            <div className="flex items-center gap-2 text-slate-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-xs font-bold uppercase tracking-wider">Message Hidden</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                                The user sent a format not supported by the WhatsApp Business API (e.g., a Poll, View-Once Media, or Live Location).
                            </p>
                        </div>
                    );
                }

                return (
                    <div className="p-2 bg-slate-50 text-slate-400 text-xs rounded border border-slate-100 italic">
                        [System: Unrecognized format - {type}]
                    </div>
                );
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 overflow-hidden animate-fade-in relative">
            {/* Left Sidebar: Conversation List */}
            <div className={`shrink-0 w-full md:w-72 lg:w-80 border-r border-[#00684a] flex flex-col bg-white z-[90] md:z-10 fixed md:static inset-0 transform transition-transform duration-300 ${activeChatId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}`}>
                {/* Header & Search */}
                <div className="p-4 bg-white z-20">
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
                                className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95"
                                title="Export Contact List"
                            >
                                <DownloadIcon className="w-5 h-5" />
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                                    className={`p-2.5 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 ${isFilterMenuOpen || filterTag ? 'bg-brand-600 text-white shadow-brand-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
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

                    <div className="flex items-center space-x-2 mb-4 overflow-x-auto no-scrollbar pb-1">
                        {['All', 'Unassigned', 'Quick Reply'].map(f => {
                            const isActive = quickFilter === f;
                            
                            return (
                                <button
                                    key={f}
                                    onClick={() => setQuickFilter(f as any)}
                                    className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all duration-300 whitespace-nowrap flex items-center gap-2 shadow-sm ${
                                        isActive 
                                            ? 'bg-[#00684a] text-white shadow-lg shadow-emerald-200 scale-105 translate-y-[-1px] border border-[#00684a]' 
                                            : 'bg-emerald-50 text-[#00684a] border border-emerald-100 hover:bg-emerald-100 hover:scale-105'
                                    }`}
                                >
                                    {f}
                                </button>
                            );
                        })}
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
                <div className="flex-1 overflow-y-auto custom-scrollbar" onScroll={handleConvScroll}>
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
                                onClick={() => { setActiveChatId(chat.id); if(quickFilter === 'Quick Reply') setQuickFilter('All'); }}
                                className={`p-4 border-b border-emerald-200 cursor-pointer hover:bg-slate-50 transition-colors group animate-fade-in ${activeChatId === chat.id ? 'bg-brand-50/50 border-brand-100' : ''}`}
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
                    {isLoadingMoreConvs && (
                        <div className="p-4 flex justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-600"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div
                className={`flex-1 min-w-0 flex flex-col fixed md:relative inset-0 z-[200] md:z-auto transform transition-transform duration-300 h-[100dvh] md:h-auto ${activeChatId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}
                style={{
                    backgroundColor: '#333333',
                }}
            >
                {/* Background Pattern */}
                <div
                    className="absolute inset-0 pointer-events-none z-0"
                    style={{
                        backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                        backgroundSize: '400px',
                        backgroundRepeat: 'repeat',
                        opacity: 1
                    }}
                />
                {quickFilter === 'Quick Reply' ? (
                    <div className="flex-1 h-full overflow-hidden relative z-10 bg-[#F8FAFC] animate-fade-in border-4 border-[#00684a] m-3 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,104,74,0.15)] ring-1 ring-black/5">
                        <QuickReply onToggleSidebar={onToggleSidebar} />
                    </div>
                ) : activeChat ? (
                    <>
                        {/* Chat Header */}
                        <header className="bg-white px-3 py-2 border-b border-[#0D9668] flex justify-between items-center shadow-sm shrink-0 w-full relative z-30">
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
                                    <h3 className="font-bold text-black text-sm truncate leading-tight">
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
                                            <p className="text-xs text-black flex items-center gap-1 truncate">
                                                {/* Always show phone number if name is present, then status */}
                                                {activeChat.contact_name && (
                                                    <span className="font-medium text-black mr-1">{activeChat.contact_phone} •</span>
                                                )}
                                                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${isSessionOpen ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                                {statusText}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 lg:mr-24">
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

                                <button onClick={() => setIsContactInfoOpen(!isContactInfoOpen)} className={`p-2 rounded-lg transition-colors ${isContactInfoOpen ? 'bg-slate-100 text-brand-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <UsersIcon className="w-5 h-5" />
                                </button>
                                <button className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg"><SearchIcon className="w-5 h-5" /></button>
                                <button
                                    onClick={handleClearChat}
                                    className="p-2 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors border border-red-100"
                                    title="Clear Chat History"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>

                                {/* 3 Dot Menu Trigger */}
                                <div className="relative">
                                    <button
                                        onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                                        className={`p-2 rounded-lg transition-colors ${isHeaderMenuOpen ? 'bg-brand-50 text-brand-600' : 'text-slate-600 hover:text-brand-600 hover:bg-slate-50'}`}
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
                                                {contactStatus === 'Blocked' ? (
                                                    <button onClick={handleUnblockContact} className="w-full text-left px-4 py-3 text-sm text-green-600 hover:bg-green-50 transition-colors flex items-center gap-2 font-medium">
                                                        <CheckIcon className="w-4 h-4" /> Unblock Contact
                                                    </button>
                                                ) : (
                                                    <button onClick={handleBlockContact} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium">
                                                        <CloseIcon className="w-4 h-4" /> Block Contact
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        setIsHeaderMenuOpen(false);
                                                        handleClearChat();
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
                                                >
                                                    <TrashIcon className="w-4 h-4" /> Clear Chat
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </header>

                        {/* Messages Area */}
                        <div
                            ref={chatContainerRef}
                            onScroll={handleScroll}
                            className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar relative z-10"
                            style={{
                                opacity: (isLoadingMessages || !isInitialScrollDone) ? 0 : 1,
                                transition: 'opacity 0.1s ease-in',
                                willChange: 'scroll-position',
                                transform: 'translateZ(0)',
                                backfaceVisibility: 'hidden' as const,
                                WebkitOverflowScrolling: 'touch' as const
                            }}
                        >
                            {/* Loading More Indicator at Top */}
                            {isLoadingMore && (
                                <div className="flex justify-center items-center py-3">
                                    <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-600"></div>
                                        <span className="text-xs font-medium text-slate-600">Loading older messages...</span>
                                    </div>
                                </div>
                            )}

                            {isLoadingMessages ? (
                                <div className="flex justify-center items-center h-full">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                                </div>
                            ) : (
                                messages.map((msg, index) => {
                                    const prevMsg = messages[index - 1];
                                    const isNewDay = !prevMsg || new Date(msg.created_at).toDateString() !== new Date(prevMsg.created_at).toDateString();

                                    const dateLabel = (() => {
                                        const date = new Date(msg.created_at);
                                        const today = new Date();
                                        const yesterday = new Date(today);
                                        yesterday.setDate(yesterday.getDate() - 1);

                                        if (date.toDateString() === today.toDateString()) return 'Today';
                                        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
                                        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                                    })();

                                    return (
                                        <React.Fragment key={msg.id + (msg.status || '')}>
                                            {isNewDay && (
                                                <div className="flex justify-center my-4 z-10 pointer-events-none">
                                                    <span className="bg-white/90 shadow-sm px-3 py-1 rounded-lg text-[10px] font-bold text-black uppercase tracking-wider backdrop-blur-sm border border-slate-100 font-outfit">
                                                        {dateLabel}
                                                    </span>
                                                </div>
                                            )}
                                            <div className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
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
                                        </React.Fragment>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="bg-white px-2 py-2 border border-[#00684a] rounded-3xl flex items-end space-x-2 shrink-0 relative m-3 shadow-md z-50" style={{ paddingBottom: 'max(0.25rem, env(safe-area-inset-bottom))' }}>
                            <input type="file" ref={fileInputRef} style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0 }} onChange={handleFileSelected} />

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
                                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                                        <button 
                                            onClick={() => { setQuickFilter('Quick Reply'); setIsAttachmentOpen(false); }} 
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-green-50 rounded-lg text-sm text-[#0D9668] font-bold transition-colors w-full text-left"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-green-100 text-[#0D9668] flex items-center justify-center"><QuickReplyIcon className="w-4 h-4" /></div> Quick Reply
                                        </button>
                                        <button 
                                            onClick={() => { setIsTemplateModalOpen(true); setIsAttachmentOpen(false); }} 
                                            className="flex items-center gap-3 px-3 py-2 hover:bg-brand-50 rounded-lg text-sm text-brand-600 font-bold transition-colors w-full text-left"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center"><MessageIcon className="w-4 h-4" /></div> Template
                                        </button>
                                    </div>
                                </>
                            )}

                            <button
                                onClick={() => {
                                    setIsEmojiPickerOpen(!isEmojiPickerOpen);
                                    setHasOpenedEmoji(true);
                                    setIsAttachmentOpen(false);
                                    setIsQuickReplyOpen(false);
                                }}
                                className={`p-2 transition-all duration-300 relative z-[60] active:scale-95 ${isEmojiPickerOpen ? 'text-brand-600 bg-brand-50 rounded-full' : 'text-slate-600 hover:text-brand-600'}`}
                                title="Emojis"
                            >
                                <EmojiIcon className="w-6 h-6" />
                            </button>

                            {/* Emoji Picker - Mounted once after first open for performance */}
                            {(isEmojiPickerOpen || hasOpenedEmoji) && (
                                <div 
                                    className={`absolute bottom-16 left-0 z-40 transition-all duration-200 ${isEmojiPickerOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}
                                >
                                    <div className="fixed inset-0 z-[-1]" onClick={() => setIsEmojiPickerOpen(false)}></div>
                                    <div className="shadow-2xl rounded-2xl overflow-hidden border border-brand-100 bg-white">
                                        <MemoizedEmojiPicker onEmojiClick={handleEmojiClick} />
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => {
                                    setIsAttachmentOpen(!isAttachmentOpen);
                                    setIsEmojiPickerOpen(false);
                                    setIsQuickReplyOpen(false);
                                }}
                                className={`p-2 transition-all duration-300 relative z-[60] active:scale-95 ${isAttachmentOpen ? 'text-brand-600 bg-brand-50 rounded-full' : 'text-slate-600 hover:text-brand-600'}`}
                                title="Attachments"
                            >
                                <PaperClipIcon className="w-6 h-6" />
                            </button>

                            {isRecording ? (
                                <div className="flex-1 bg-slate-100 rounded-3xl border border-red-500/30 flex items-center justify-between px-4 py-2 animate-pulse-subtle">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                        <span className="text-slate-700 font-mono font-medium min-w-[3rem]">{formatDuration(recordingDuration)}</span>
                                        <span className="text-xs text-slate-400">Recording...</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleCancelRecording}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors tooltip hover:bg-red-50 rounded-full"
                                            title="Cancel recording"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={handleStopRecording}
                                            className="p-2 bg-[#00684a] text-white rounded-full shadow-md hover:bg-[#005c42] transition-transform active:scale-95 flex items-center justify-center"
                                            title="Send voice message"
                                        >
                                            <PaperAirplaneIcon className="w-4 h-4 ml-0.5" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 bg-slate-100 rounded-2xl border border-[#00684a] focus-within:ring-1 focus-within:ring-[#00684a] flex items-center px-4 py-2">
                                    <textarea
                                        rows={1}
                                        placeholder="Type a message or '/' for Quick Replies..."
                                        value={messageInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMessageInput(val);

                                            // Trigger quick reply dropdown on '/'
                                            const lastSlashIndex = val.lastIndexOf('/');
                                            if (lastSlashIndex !== -1 && (lastSlashIndex === 0 || val[lastSlashIndex - 1] === ' ')) {
                                                setIsQuickReplyOpen(true);
                                                setQuickReplySearch(val.substring(lastSlashIndex + 1));
                                                setSelectedQuickReplyIndex(0);
                                            } else {
                                                setIsQuickReplyOpen(false);
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                            if (isQuickReplyOpen) {
                                                if (e.key === 'ArrowDown') {
                                                    e.preventDefault();
                                                    setSelectedQuickReplyIndex(prev => (prev + 1) % filteredQuickReplies.length);
                                                } else if (e.key === 'ArrowUp') {
                                                    e.preventDefault();
                                                    setSelectedQuickReplyIndex(prev => (prev - 1 + filteredQuickReplies.length) % filteredQuickReplies.length);
                                                } else if (e.key === 'Enter' || e.key === 'Tab') {
                                                    e.preventDefault();
                                                    if (filteredQuickReplies[selectedQuickReplyIndex]) {
                                                        handleSendQuickReply(filteredQuickReplies[selectedQuickReplyIndex]);
                                                    }
                                                } else if (e.key === 'Escape') {
                                                    setIsQuickReplyOpen(false);
                                                }
                                            }
                                        }}
                                        className="bg-transparent w-full border-none focus:ring-0 p-0 text-sm text-slate-800 placeholder-slate-400 resize-none max-h-32 outline-none"
                                    />

                                    {/* Quick Replies Dropdown */}
                                    {isQuickReplyOpen && (
                                        <div className="absolute bottom-full left-0 mb-4 w-full max-w-sm bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,104,74,0.3)] border-2 border-[#00684a] overflow-hidden z-[100] animate-slide-up ring-1 ring-black/10">
                                            {/* Header */}
                                            <div className="px-5 py-4 bg-[#00684a] flex justify-between items-center relative overflow-hidden">
                                                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: '200px' }} />
                                                <div className="flex items-center gap-2.5 relative z-10">
                                                    <div className="w-6 h-6 bg-white/10 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                                        <QuickReplyIcon className="w-3.5 h-3.5 text-white" />
                                                    </div>
                                                    <span className="text-[12px] font-bold text-white tracking-wide">Quick Library</span>
                                                </div>
                                                <div className="px-2.5 py-1 bg-white/15 rounded-lg backdrop-blur-sm relative z-10 border border-white/10">
                                                    <span className="text-[9px] text-white/90 font-bold tracking-wider uppercase">Navigate: ↑↓ • Send: Enter</span>
                                                </div>
                                            </div>
                                            
                                            <div className="max-h-80 overflow-y-auto custom-scrollbar relative bg-slate-50/50">
                                                {/* Subtle Pattern Overlay */}
                                                <div className="absolute inset-0 pointer-events-none opacity-[0.03] z-0" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: '300px' }} />
                                                
                                                <div className="relative z-10">
                                                    {filteredQuickReplies.length > 0 ? (
                                                        filteredQuickReplies.map((reply, index) => (
                                                            <button
                                                                key={reply.id}
                                                                onClick={() => handleSendQuickReply(reply)}
                                                                onMouseEnter={() => setSelectedQuickReplyIndex(index)}
                                                                className={`w-full text-left px-5 py-5 flex items-center justify-between transition-all border-b border-slate-100 last:border-0 ${
                                                                    index === selectedQuickReplyIndex 
                                                                        ? 'bg-white text-[#00684a] border-l-[6px] border-l-[#00684a] pl-[14px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] scale-[1.01] z-10 relative' 
                                                                        : 'hover:bg-white/50 border-l-[6px] border-l-transparent'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-4 min-w-0">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${
                                                                        index === selectedQuickReplyIndex 
                                                                            ? 'bg-[#00684a] border-[#00684a] text-white rotate-3 shadow-md' 
                                                                            : 'bg-white border-slate-100 text-slate-300'
                                                                    }`}>
                                                                        <span className="text-sm font-black">/</span>
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className={`text-[14px] font-semibold truncate tracking-tight mb-0.5 ${
                                                                            index === selectedQuickReplyIndex ? 'text-[#00684a]' : 'text-slate-900'
                                                                        }`}>{reply.name}</p>
                                                                        <p className={`text-[12px] truncate max-w-[200px] leading-tight ${
                                                                            index === selectedQuickReplyIndex ? 'text-[#00684a]/70 font-medium' : 'text-slate-500 font-normal'
                                                                        }`}>
                                                                            {reply.nodes?.[0]?.data?.message || reply.nodes?.[0]?.data?.body || reply.nodes?.[0]?.data?.caption || 'Ready to send...'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                                                                        index === selectedQuickReplyIndex ? 'bg-[#00684a]/10 text-[#00684a]' : 'bg-slate-100 text-slate-400'
                                                                    }`}>
                                                                        {reply.nodes?.[0]?.type?.replace('Message', '') || 'Reply'}
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="p-16 text-center">
                                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                                                                <SearchIcon className="w-8 h-8 text-slate-200" />
                                                            </div>
                                                            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No Matches</p>
                                                            <p className="text-[10px] text-slate-400 font-bold mt-1">Try a different keyword</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Footer */}
                                            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-center shadow-[inset_0_4px_12px_rgba(0,0,0,0.03)]">
                                                <button
                                                    onClick={() => { setQuickFilter('Quick Reply'); setIsQuickReplyOpen(false); }}
                                                    className="group flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-[12px] font-bold text-white bg-[#00684a] hover:bg-[#005c42] hover:shadow-xl hover:shadow-[#00684a]/20 transition-all active:scale-95 border border-[#00684a]"
                                                >
                                                    <PlusIcon className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" />
                                                    <span>Manage Full Library</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {!isRecording && (messageInput.trim() ? (
                                <button onClick={handleSendMessage} className="p-2.5 bg-[#00684a] text-white rounded-full shadow-md hover:bg-[#005c42] transition-transform active:scale-95">
                                    <PaperAirplaneIcon className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleStartRecording}
                                    className="p-2.5 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors active:scale-95"
                                >
                                    <MicrophoneIcon className="w-5 h-5" />
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 relative z-10">
                        <div className="w-24 h-24 bg-[#202c33] rounded-full shadow-sm flex items-center justify-center mb-4 border border-[#2a3942]">
                            <svg viewBox="0 0 24 24" fill="#00a884" className="w-12 h-12">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-black">Welcome to WhatsApp Business API</h3>
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

            {isClearChatModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <TrashIcon className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-2">Clear Chat History?</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Are you sure you want to delete all messages in this conversation? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setIsClearChatModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleClearChat}
                                    className="flex-1 px-4 py-2 bg-red-600 rounded-lg text-sm font-bold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                                >
                                    Clear History
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <InboxTemplateModal 
                isOpen={isTemplateModalOpen}
                onClose={() => setIsTemplateModalOpen(false)}
                onSend={handleSendTemplate}
            />
        </div>
    );
};
export default Inbox;
