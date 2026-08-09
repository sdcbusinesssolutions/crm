import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import {
    SearchIcon, FilterIcon, MoreVerticalIcon, PaperClipIcon, EmojiIcon,
    MicrophoneIcon, PaperAirplaneIcon, DoubleCheckIcon, CheckIcon, ClockIcon,
    UserCircleIcon, ChevronLeftIcon, PhoneIcon, EditIcon, CloseIcon,
    UsersIcon, DocumentFileIcon, ImageFileIcon, VideoFileIcon, AudioFileIcon,
    DownloadIcon, TrashIcon, BadgeIcon, MapIcon, PlusIcon, MenuIcon, QuickReplyIcon, MessageIcon,
    EyeIcon, EyeOffIcon
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
import Toast from './Toast';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';
import { getStaffList, getLeads, createLead, getLead } from '../services/lead-management-api';
import LeadAssignment from '../modules/teamStaff/components/LeadAssignment';
import PermissionGate from '../modules/teamStaff/components/PermissionGate';
import { contactService } from '../services/contactService';
import { tokenService } from '../services/tokenService';
import { aiAgentService, Agent } from '../services/aiAgentService';
import { reminderManager } from '../utils/reminderManager';
import { followUpService } from '../services/followUpService';

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
    const { hasAccess, isStaff } = usePermissions();
    const canWrite = hasAccess('Inbox', ACCESS_TYPES.READ_WRITE);
    const isOwner = !isStaff;

    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [quickFilter, setQuickFilter] = useState<string>('All');
    const [filterTag, setFilterTag] = useState('');
    const [messageInput, setMessageInput] = useState('');
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [hasOpenedEmoji, setHasOpenedEmoji] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const [isNumberMasked, setIsNumberMasked] = useState(true);
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

    // Toast State
    const [toastConfig, setToastConfig] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

    // --- CACHE OPTIMIZATION: Memory Buffer for Recent Conversations ---
    // Stores the last 100 messages for recently visited chats to make switching instant.
    const messageCacheRef = useRef<Record<string, Message[]>>({});

    // Quick Replies State
    const [quickReplies, setQuickReplies] = useState<Flow[]>([]);
    const [isQuickReplyOpen, setIsQuickReplyOpen] = useState(false);
    const [quickReplySearch, setQuickReplySearch] = useState('');
    const [isOptedOut, setIsOptedOut] = useState(false);
    const [selectedQuickReplyIndex, setSelectedQuickReplyIndex] = useState(0);
    const [staffMembers, setStaffMembers] = useState<any[]>([]);
    const [activeLeadId, setActiveLeadId] = useState<string | null>(null);
    const [assignedStaffNames, setAssignedStaffNames] = useState<string[]>([]);
    const [contactNotes, setContactNotes] = useState('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);
    const [aiAgents, setAiAgents] = useState<Agent[]>([]);
    
    // Reminder state
    const [showLocalReminder, setShowLocalReminder] = useState(false);
    const [localReminderTime, setLocalReminderTime] = useState('');
    const [localReminderMessage, setLocalReminderMessage] = useState('');
    const activeChat = useMemo(() =>
        conversations.find(c => c.id === activeChatId),
        [conversations, activeChatId]
    );

    const formatPhone = (phone: string | undefined | null) => {
        if (!phone) return '';
        if (!isNumberMasked) return phone;
        if (phone.length <= 4) return '****';
        return phone.substring(0, phone.length - 4).replace(/./g, '*') + phone.substring(phone.length - 4);
    };

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
        // Both Owners and Staff need the staff list to map IDs to Names in the Inbox
        getStaffList().then(setStaffMembers).catch(console.error);
    }, []);

    // Fetch lead ID for the active chat
    useEffect(() => {
        if (activeChat) {
            getLeads(undefined, undefined, 1, 10, { search: activeChat.contact_phone }).then(res => {
                // Handle both paginated { data: [] } and direct array [] responses
                const leadsData = (res as any).data || res;
                const leads = Array.isArray(leadsData) ? leadsData : [];

                if (leads && leads.length > 0) {
                    const leadWithAssignment = leads.find(l => Array.isArray(l.assigned_staff_ids) && l.assigned_staff_ids.length > 0) || leads[0];
                    setActiveLeadId(leadWithAssignment.id);
                    // Resolve assigned staff names
                    const ids: string[] = leadWithAssignment.assigned_staff_ids || [];
                    
                    // Only update names if we actually have staff members loaded to compare against
                    // This prevents "flicker" where names disappear during a refresh
                    if (staffMembers.length > 0) {
                        const names = ids.map((sid: string) => staffMembers.find((s: any) => s.id === sid)?.name).filter(Boolean);
                        setAssignedStaffNames(names);
                    } else if (ids.length === 0) {
                        setAssignedStaffNames([]);
                    }
                    // If ids.length > 0 but staffMembers is empty, we wait for the next run of this effect
                } else {
                    setActiveLeadId(null);
                    setAssignedStaffNames([]);
                }
            }).catch(console.error);
        } else {
            setActiveLeadId(null);
            setAssignedStaffNames([]);
        }
    }, [activeChat?.contact_phone, staffMembers]);

    useEffect(() => {
        if (activeChat) {
            const loadNotes = async () => {
                try {
                    const res = await contactService.getContactsPaginated(1, 1, { search: activeChat.contact_phone });
                    if (res?.data && res.data.length > 0) {
                        setContactNotes(res.data[0].customData?.notes || '');
                        setIsOptedOut(res.data[0].customData?.opted_out === true);
                    } else {
                        setContactNotes('');
                        setIsOptedOut(false);
                    }
                } catch (e) {
                    console.error("Failed to load notes", e);
                    setContactNotes('');
                }
            };
            loadNotes();
        } else {
            setContactNotes('');
            setIsOptedOut(false);
        }
    }, [activeChat?.contact_phone]);

    const handleSaveNotes = async () => {
        if (!activeChat) return;
        setIsSavingNotes(true);
        try {
            await contactService.saveContact({
                phone: activeChat.contact_phone,
                name: activeChat.contact_name || 'Unknown',
                status: 'Contacted',
                tags: activeChat.tags || [],
                customData: { notes: contactNotes }
            } as any);
        } catch (err) {
            console.error("Failed to save notes", err);
        } finally {
            setIsSavingNotes(false);
        }
    };

    useEffect(() => {
        setConvPage(1);
        setHasMoreConvs(true);
        loadConversations(1, false, searchTerm, quickFilter, filterTag);

        // --- REALTIME OPTIMIZATION: Replacement for 10s Polling ---
        // Instead of polling, we subscribe to the 'conversations' table for updates.
        // This makes the sidebar refresh instantly when a new message arrives.
        const channel = supabase
            .channel('conversations-channel')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen for ALL events (insert, update, delete)
                    schema: 'public',
                    table: 'conversations'
                },
                (payload) => {
                    // Only process if it belongs to the current view/filter context
                    // For simplicity, we just trigger a fresh first-page load to keep it consistent
                    console.log('[Realtime] Conversation update detected:', payload.eventType);
                    loadConversations(1, false, searchTerm, quickFilter, filterTag, true);
                }
            )
            .subscribe();

        // --- TEMPORARY FALLBACK POLLING ---
        // Added back so you don't have to refresh the page right now.
        // NOTE: Please switch to Supabase Custom Domains before scaling to 1 Lakh users!
        const fallbackInterval = setInterval(() => {
            loadConversations(1, false, searchTerm, quickFilter, filterTag, true);
        }, 8000); // 8 seconds

        return () => {
            supabase.removeChannel(channel);
            clearInterval(fallbackInterval);
        };
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
            // --- CACHE OPTIMIZATION: Instant Hydration ---
            if (messageCacheRef.current[activeChatId]) {
                console.log(`[Cache] Instant Hydration for ${activeChatId}`);
                setMessages(messageCacheRef.current[activeChatId]);
                setIsLoadingMessages(false); // No spinner needed if we have cache
            } else {
                setIsLoadingMessages(true);
                setMessages([]);
            }

            setHasMoreMessages(true);
            setMessageOffset(0);

            try {
                const data = await inboxService.getMessages(activeChatId, MESSAGE_BATCH_SIZE, 0);
                const uniqueMessages = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

                // Update Cache and State
                messageCacheRef.current[activeChatId] = uniqueMessages;
                setMessages(uniqueMessages);

                if (data.length < MESSAGE_BATCH_SIZE) {
                    setHasMoreMessages(false);
                }

                await inboxService.markAsRead(activeChatId);
                
                // --- OPTIMISTIC UI UPDATE ---
                // Instantly clear the unread badge locally without waiting for the realtime DB event
                setConversations(prev => prev.map(c => c.id === activeChatId ? { ...c, unread_count: 0 } : c));

            } catch (error) {
                console.error('Failed to load messages:', error);
            } finally {
                setIsLoadingMessages(false);
            }
        };
        loadMessages();

        // --- REALTIME OPTIMIZATION: Replacement for 3s Polling ---
        // We subscribe to messages specifically for THIS conversation.
        // This is 100x more efficient than polling.
        const channel = supabase
            .channel(`chat:${activeChatId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${activeChatId}`
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    console.log('[Realtime] New message received:', newMessage.id);

                    setMessages(prev => {
                        // Avoid duplicates if we already have it (e.g. from optimistic UI)
                        if (prev.some(m => m.id === newMessage.id)) return prev;

                        // Deduplicate optimistic "twins" (same text/type/direction)
                        const filtered = prev.filter(m => {
                            if (!m.id.startsWith('temp-')) return true;
                            const isMatch = m.type === newMessage.type &&
                                m.direction === newMessage.direction &&
                                (m.text === newMessage.text || m.media_url === newMessage.media_url);
                            return !isMatch;
                        });

                        return [...filtered, newMessage].sort((a, b) =>
                            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                        );
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${activeChatId}`
                },
                (payload) => {
                    // Handle status updates (Sent -> Delivered -> Read)
                    const updatedMsg = payload.new as Message;
                    setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
                }
            )
            .subscribe();

        // --- TEMPORARY FALLBACK POLLING ---
        const fallbackInterval = setInterval(() => {
            setMessages(currentMessages => {
                if (currentMessages.length > 50) return currentMessages; 
                
                inboxService.getMessages(activeChatId, 50, 0).then(data => {
                    const uniqueMessages = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                    setMessages(prev => {
                        if (prev.length === uniqueMessages.length && prev[0]?.id === uniqueMessages[0]?.id) return prev;
                        return uniqueMessages;
                    });
                }).catch(e => console.error("Polling error:", e));
                
                return currentMessages;
            });
        }, 5000); // 5 seconds for fast chat updates

        return () => {
            supabase.removeChannel(channel);
            clearInterval(fallbackInterval);
        };
    }, [activeChatId]);


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

    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const agents = await aiAgentService.listAgents();
                setAiAgents(agents);
            } catch (err) {
                console.error("Failed to fetch AI agents", err);
            }
        };
        fetchAgents();
    }, []);

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

    const toggleAiPause = async () => {
        if (!activeChatId) return;
        const isPaused = !!activeChat?.bot_paused_until && new Date(activeChat.bot_paused_until) > new Date();
        const newState = !isPaused;
        const previousState = activeChat?.bot_paused_until;
        
        // Optimistic UI update
        const pauseUntil = newState ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null;
        setConversations(prev => prev.map(c => c.id === activeChatId ? { ...c, bot_paused_until: pauseUntil } : c));
        
        try {
            const response = await fetch(`/api/inbox/messages/${activeChatId}/toggle-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenService.getAccessToken()}` },
                body: JSON.stringify({ paused: newState })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        } catch (e) {
            console.error('Failed to toggle AI state', e);
            // Revert on failure
            setConversations(prev => prev.map(c => c.id === activeChatId ? { ...c, bot_paused_until: previousState } : c));
            alert('Failed to toggle AI state. Please try again.');
        }
    };

    const handleAssignAi = async (agentId: string) => {
        if (!activeChatId) return;
        
        const previousAgentId = activeChat?.assigned_ai_agent_id;
        
        // Optimistic UI update
        setConversations(prev => prev.map(c => c.id === activeChatId ? { ...c, assigned_ai_agent_id: agentId || null } : c));
        
        try {
            const response = await fetch(`/api/inbox/messages/${activeChatId}/assign-ai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenService.getAccessToken()}` },
                body: JSON.stringify({ agentId })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        } catch (e) {
            console.error('Failed to assign AI agent', e);
            // Revert on failure
            setConversations(prev => prev.map(c => c.id === activeChatId ? { ...c, assigned_ai_agent_id: previousAgentId } : c));
            alert('Failed to assign AI agent. Please try again.');
        }
    };

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
            name: c.contact_name || formatPhone(c.contact_phone),
            phone: formatPhone(c.contact_phone),
            status: c.status,
            tags: c.tags?.join(', '),
            assignedTo: c.assigned_to || 'Unassigned'
        }));

        const headers = ['Name', 'Phone', 'Status', 'Tags', 'Assigned To'];
        const csvContent = [
            headers.join(','),
            ...exportData.map(row => 
                [
                    `"${(row.name || '').replace(/"/g, '""')}"`,
                    `"${(row.phone || '').replace(/"/g, '""')}"`,
                    `"${(row.status || '').replace(/"/g, '""')}"`,
                    `"${(row.tags || '').replace(/"/g, '""')}"`,
                    `"${(row.assignedTo || '').replace(/"/g, '""')}"`
                ].join(',')
            )
        ].join('\n');

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `contact_list_export_${new Date().toISOString().split('T')[0]}.csv`);
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
            phone: formatPhone(activeChat.contact_phone),
            tags: activeChat.tags,
            status: activeChat.status,
            exportedAt: new Date().toISOString()
        };

        const headers = ['ID', 'Name', 'Phone', 'Tags', 'Status', 'Exported At'];
        const csvContent = [
            headers.join(','),
            [
                `"${(contactData.id || '').replace(/"/g, '""')}"`,
                `"${(contactData.name || '').replace(/"/g, '""')}"`,
                `"${(contactData.phone || '').replace(/"/g, '""')}"`,
                `"${(contactData.tags?.join(', ') || '').replace(/"/g, '""')}"`,
                `"${(contactData.status || '').replace(/"/g, '""')}"`,
                `"${(contactData.exportedAt || '').replace(/"/g, '""')}"`
            ].join(',')
        ].join('\n');

        const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `${(activeChat.contact_name || 'contact').replace(/\s+/g, '_')}_contact.csv`);
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
            const sender = msg.direction === 'out' ? 'Business' : (activeChat.contact_name || formatPhone(activeChat.contact_phone));
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
                                className={`rounded-xl border border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all max-w-full cursor-pointer object-contain bg-slate-50 ${type === 'sticker' ? 'w-32' : 'max-h-80'}`}
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
                    <div className="mb-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-300">
                        {/* Map Background Area */}
                        <div className="w-full h-36 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex flex-col items-center justify-center relative overflow-hidden group/map cursor-pointer"
                             onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${msg.text ? encodeURIComponent(msg.text) : `${msg.latitude},${msg.longitude}`}`, '_blank')}
                        >
                            
                            {/* SVG Grid Pattern */}
                            <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik0wIDBoNDB2NDBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTAgMTBoNDBNMTAgMHY0ME0wIDIwaDQwTTIwIDB2NDBNMCAzMGg0ME0zMCAwdjQwIiBzdHJva2U9IiMzM2NjOTkiIHN0cm9rZS13aWR0aD0iMSIvPgo8L3N2Zz4=')]"></div>

                            {/* Animated Pin */}
                            <div className="relative z-10 flex flex-col items-center transform group-hover/map:scale-110 group-hover/map:-translate-y-1 transition-all duration-300">
                                {/* Pulse Effect */}
                                <div className="absolute w-12 h-12 bg-red-500 rounded-full animate-ping opacity-30 top-1"></div>
                                
                                {/* Pin Body */}
                                <div className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center mb-1 border-2 border-red-50 relative z-20">
                                    <MapIcon className="w-7 h-7 text-red-500" />
                                </div>
                                {/* Pin Shadow/Dot */}
                                <div className="w-2 h-1 bg-black/20 rounded-full blur-[1px]"></div>
                            </div>
                            
                            {/* Glassmorphic Address Overlay */}
                            <div className="absolute inset-x-0 bottom-0 bg-white/70 backdrop-blur-md p-2.5 border-t border-white/60">
                                <p className="text-[11px] font-bold text-slate-800 line-clamp-2 leading-tight drop-shadow-sm text-center">
                                    {msg.text || 'Pinned Location'}
                                </p>
                            </div>
                        </div>
                        
                        {/* Action Bar */}
                        <a
                            href={`https://www.google.com/maps/search/?api=1&query=${msg.text ? encodeURIComponent(msg.text) : `${msg.latitude},${msg.longitude}`}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 text-[13px] text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 font-bold text-center transition-colors"
                        >
                            <span>Open in Google Maps</span>
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
                            {hasAccess('can_unmask_numbers', ACCESS_TYPES.ALL_ACCESS) && (
                                <button
                                    onClick={() => setIsNumberMasked(!isNumberMasked)}
                                    className={`p-2.5 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 ${isNumberMasked ? 'bg-slate-100 text-slate-600' : 'bg-[#00684a] text-white shadow-emerald-200'}`}
                                    title={isNumberMasked ? "Show Numbers" : "Mask Numbers"}
                                >
                                    {isNumberMasked ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                </button>
                            )}
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
                                    className={`p-2.5 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 ${isFilterMenuOpen || filterTag || quickFilter.startsWith('staff:') ? 'bg-brand-600 text-white shadow-brand-200' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
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
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">By Staff</label>
                                                    <select
                                                        value={quickFilter.startsWith('staff:') ? quickFilter : ''}
                                                        onChange={(e) => {
                                                            if (e.target.value) {
                                                                setQuickFilter(e.target.value);
                                                            } else {
                                                                // Only reset to 'All' if current filter was staff-based
                                                                if (quickFilter.startsWith('staff:')) setQuickFilter('All');
                                                            }
                                                        }}
                                                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                                    >
                                                        <option value="">All Staff</option>
                                                        {staffMembers.map((s: any) => (
                                                            <option key={s.id} value={`staff:${s.id}`}>
                                                                {s.name || s.email}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="pt-2 border-t border-slate-100 flex justify-end">
                                                    <button
                                                        onClick={() => { setFilterTag(''); if (quickFilter.startsWith('staff:')) setQuickFilter('All'); setIsFilterMenuOpen(false); }}
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
                        {['All', 'AI Chats', 'Quick Reply'].map(f => {
                            const isActive = quickFilter === f;

                            if (f === 'AI Chats') {
                                return (
                                    <button
                                        key={f}
                                        onClick={() => window.location.href = '/?view=AI+Buddy'}
                                        className="relative inline-flex h-7 overflow-hidden rounded-full p-[1.5px] hover:scale-105 transition-transform shadow-sm group"
                                    >
                                        <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#FF61D2_0%,#393BB2_50%,#FF61D2_100%)]" />
                                        <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-white px-4 text-[11px] font-black text-slate-800 backdrop-blur-3xl gap-1.5 transition-colors group-hover:bg-slate-50">
                                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" fill="url(#ai-gradient)" />
                                                <defs>
                                                    <linearGradient id="ai-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                                                        <stop stopColor="#FF61D2" />
                                                        <stop offset="1" stopColor="#393BB2" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            AI Chats
                                        </span>
                                    </button>
                                );
                            }

                            return (
                                <button
                                    key={f}
                                    onClick={() => setQuickFilter(f as any)}
                                    className={`px-4 py-1.5 rounded-full text-[11px] font-black transition-all duration-300 whitespace-nowrap flex items-center gap-2 shadow-sm ${isActive
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
                                onClick={() => { setActiveChatId(chat.id); if (quickFilter === 'Quick Reply') setQuickFilter('All'); }}
                                className={`p-4 border-b border-emerald-200 cursor-pointer hover:bg-slate-50 transition-colors group animate-fade-in ${activeChatId === chat.id ? 'bg-brand-50/50 border-brand-100' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center space-x-3">
                                        <div className={`w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm shrink-0`}>
                                            {(chat.contact_name || formatPhone(chat.contact_phone)).substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-sm ${activeChatId === chat.id ? 'text-brand-900' : 'text-slate-800'}`}>{chat.contact_name || formatPhone(chat.contact_phone)}</h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[11px] text-slate-500 font-medium leading-none tracking-wide translate-y-[1px]">{formatPhone(chat.contact_phone)}</span>
                                                <div onClick={(e) => e.stopPropagation()} className="flex items-center shrink-0">
                                                    <LeadAssignment 
                                                        contact={{ ...chat, assigned_staff_ids: chat.assigned_to ? [chat.assigned_to] : [] }} 
                                                        leadId={chat.id} 
                                                        showNames={false}
                                                        isConversationId={true}
                                                        onAssigned={() => loadConversations(1, false, searchTerm, quickFilter, filterTag, true)}
                                                        className="p-1 rounded-full transition-all group/btn relative hover:bg-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm hover:shadow [&>svg]:w-4 [&>svg]:h-4 flex items-center justify-center"
                                                    />
                                                </div>
                                            </div>
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
                                    {(activeChat.contact_name || formatPhone(activeChat.contact_phone)).substring(0, 2).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-black text-sm truncate leading-tight">
                                        {activeChat.contact_name || formatPhone(activeChat.contact_phone)}
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
                                                    <span className="font-medium text-black mr-1">{formatPhone(activeChat.contact_phone)} •</span>
                                                )}
                                                <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${isSessionOpen ? 'bg-green-500' : 'bg-slate-400'}`}></span>
                                                {statusText}
                                            </p>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 lg:mr-24">
                                {/* AI Pause Toggle */}
                                {(() => {
                                    const isPaused = !!activeChat.bot_paused_until && new Date(activeChat.bot_paused_until) > new Date();
                                    return (
                                        <div 
                                            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer text-xs font-bold border-2 transition-all shadow-sm ${
                                                isPaused 
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                                                    : 'bg-white border-purple-200 hover:border-purple-300 hover:shadow-md'
                                            }`}
                                            onClick={toggleAiPause}
                                        >
                                            {isPaused ? (
                                                <>
                                                    <span className="text-[14px]">⏸️</span>
                                                    <span>AI Paused</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-fuchsia-500 to-orange-500">AI Active</span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })()}
                                
                                {/* Assign AI Dropdown */}
                                <div className="hidden md:flex items-center">
                                    <select
                                        value={activeChat.assigned_ai_agent_id || ''}
                                        onChange={(e) => handleAssignAi(e.target.value)}
                                        className="text-xs font-medium border-2 border-slate-200 rounded-full px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 shadow-sm transition-all cursor-pointer"
                                    >
                                        <option value="">No AI Assigned</option>
                                        {aiAgents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
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

                                <button 
                                    onClick={() => setIsContactInfoOpen(!isContactInfoOpen)} 
                                    className={`p-2 rounded-lg transition-colors ${isContactInfoOpen ? 'bg-slate-100 text-brand-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <UsersIcon className="w-5 h-5" />
                                </button>
                                <button className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg">
                                    <SearchIcon className="w-5 h-5" />
                                </button>
                                <LeadAssignment 
                                    leadId={activeLeadId || activeChat.id} 
                                    contact={{ ...activeChat, assigned_staff_ids: activeChat.assigned_to ? [activeChat.assigned_to] : [] }}
                                    showNames={true}
                                    isConversationId={!activeLeadId}
                                    className="p-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 relative"
                                    onAssigned={() => {
                                        loadConversations(1, false, searchTerm, quickFilter, filterTag, true);
                                        // Refresh assigned staff names
                                        const actualLeadId = activeLeadId || activeChat.id;
                                        if (!activeLeadId) {
                                            // Trigger a re-fetch of the active lead since one might have been created
                                            getLeads(undefined, undefined, 1, 10, { search: activeChat.contact_phone })
                                                .then((res: any) => {
                                                    const leads = res.data || res;
                                                    if (Array.isArray(leads) && leads.length > 0) {
                                                        const leadWithAssignment = leads.find(l => Array.isArray(l.assigned_staff_ids) && l.assigned_staff_ids.length > 0) || leads[0];
                                                        setActiveLeadId(leadWithAssignment.id);
                                                    }
                                                }).catch(console.error);
                                        }
                                        
                                        // Only attempt to fetch lead if it's a real lead ID
                                        if (activeLeadId || (actualLeadId && actualLeadId.startsWith('ld-'))) {
                                            getLead(activeLeadId || actualLeadId).then((lead: any) => {
                                                const ids: string[] = lead?.assigned_staff_ids || [];
                                                if (ids.length > 0 && staffMembers.length > 0) {
                                                    setAssignedStaffNames(ids.map((sid: string) => staffMembers.find((s: any) => s.id === sid)?.name).filter(Boolean));
                                                } else {
                                                    setAssignedStaffNames([]);
                                                }
    
                                                // Sync with conversation table so "Mine" filter works
                                                if (activeChatId && ids.length > 0) {
                                                    inboxService.assignConversation(activeChatId, ids[0]).catch(console.error);
                                                }
                                            }).catch(console.error);
                                        } else {
                                            // Fallback refresh for conversations where lead hasn't been fetched yet
                                            setTimeout(() => {
                                                if (activeChatId) {
                                                    inboxService.getConversations(1, 10, 'all', undefined, activeChat.contact_phone)
                                                        .then((res: any) => {
                                                            const conv = res.data?.[0];
                                                            if (conv?.assigned_to) {
                                                                const staff = staffMembers.find((s: any) => s.id === conv.assigned_to);
                                                                if (staff) setAssignedStaffNames([staff.name]);
                                                            }
                                                        }).catch(console.error);
                                                }
                                            }, 500);
                                        }
                                    }}
                                />
                                {canWrite && (
                                    <button
                                        onClick={() => setIsClearChatModalOpen(true)}
                                        className="p-2 text-red-500 bg-red-50 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors border border-red-100"
                                        title="Clear Chat History"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                )}

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
                                                {canWrite && (
                                                    <>
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
                                                                setIsClearChatModalOpen(true);
                                                            }}
                                                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
                                                        >
                                                            <TrashIcon className="w-4 h-4" /> Clear Chat
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </header>

                        {/* Opted Out Alert Banner */}
                        {isOptedOut && (
                            <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-center shadow-sm relative z-20 w-full animate-fade-in shrink-0">
                                <span className="text-red-700 text-xs md:text-sm font-bold flex items-center gap-2 text-center">
                                    <span className="text-base">🛑</span> This user has opted out. Messaging is paused.
                                </span>
                            </div>
                        )}

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
                                                <div className={`max-w-[80%] sm:max-w-[60%] rounded-xl px-3 py-2 shadow-sm relative group transition-colors duration-300 ${msg.direction === 'out' ? 'bg-emerald-50/80 border border-emerald-200 hover:border-emerald-300 rounded-tr-none' : 'bg-white border border-emerald-200 hover:border-emerald-300 rounded-tl-none'}`}>

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
                        {canWrite ? (
                            <>
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
                                            } else if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
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
                                                                className={`w-full text-left px-5 py-5 flex items-center justify-between transition-all border-b border-slate-100 last:border-0 ${index === selectedQuickReplyIndex
                                                                        ? 'bg-white text-[#00684a] border-l-[6px] border-l-[#00684a] pl-[14px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)] scale-[1.01] z-10 relative'
                                                                        : 'hover:bg-white/50 border-l-[6px] border-l-transparent'
                                                                    }`}
                                                            >
                                                                <div className="flex items-center gap-4 min-w-0">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${index === selectedQuickReplyIndex
                                                                            ? 'bg-[#00684a] border-[#00684a] text-white rotate-3 shadow-md'
                                                                            : 'bg-white border-slate-100 text-slate-300'
                                                                        }`}>
                                                                        <span className="text-sm font-black">/</span>
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className={`text-[14px] font-semibold truncate tracking-tight mb-0.5 ${index === selectedQuickReplyIndex ? 'text-[#00684a]' : 'text-slate-900'
                                                                            }`}>{reply.name}</p>
                                                                        <p className={`text-[12px] truncate max-w-[200px] leading-tight ${index === selectedQuickReplyIndex ? 'text-[#00684a]/70 font-medium' : 'text-slate-500 font-normal'
                                                                            }`}>
                                                                            {reply.nodes?.[0]?.data?.message || reply.nodes?.[0]?.data?.body || reply.nodes?.[0]?.data?.caption || 'Ready to send...'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-1.5 shrink-0 ml-3">
                                                                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${index === selectedQuickReplyIndex ? 'bg-[#00684a]/10 text-[#00684a]' : 'bg-slate-100 text-slate-400'
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
                    <div className="bg-amber-50 px-6 py-3 border border-amber-200 rounded-xl flex items-center gap-3 m-3 shadow-sm z-50">
                        <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="text-sm text-amber-800 font-medium">You have read-only access to this conversation.</p>
                    </div>
                )}
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
                                    <span className="mt-1 text-[10px] font-bold text-brand-600 bg-brand-50 px-3 py-1 rounded-full border border-brand-100">
                                        Chat Agent: {activeChat.assigned_to}
                                    </span>
                                )}

                                            {!activeLeadId && (
                                                <div className="flex flex-col items-center gap-2 mt-6 w-full border-t border-slate-100 pt-6 px-6">
                                                    <p className="text-[10px] text-slate-400 italic text-center">
                                                        This contact is not a Lead yet. Convert to enable team assignments.
                                                    </p>
                                                    <button 
                                                        onClick={async () => {
                                                            try {
                                                                // 1. Double check if lead exists by phone
                                                                const existingLeads = await getLeads(undefined, undefined, 1, 5, { search: activeChat.contact_phone });
                                                                if (existingLeads && existingLeads.length > 0) {
                                                                    console.log('Lead already exists:', existingLeads[0].id);
                                                                    setActiveLeadId(existingLeads[0].id);
                                                                    return;
                                                                }

                                                                // 2. Create if not found
                                                                const newLead = await createLead({
                                                                    name: activeChat.contact_name || 'Contact',
                                                                    phone: activeChat.contact_phone,
                                                                    status: 'new'
                                                                });
                                                                if (newLead && newLead.id) {
                                                                    setActiveLeadId(newLead.id);
                                                                }
                                                            } catch (err) {
                                                                console.error('Failed to create/resolve lead', err);
                                                                alert('Failed to initialize Lead. Please try again or check if this contact is already a Lead.');
                                                            }
                                                        }}
                                                        className="bg-brand-50 text-brand-600 px-4 py-2 rounded-xl text-[11px] font-bold border border-brand-100 hover:bg-brand-100 transition-all active:scale-95 flex items-center gap-1.5"
                                                    >
                                                        <PlusIcon className="w-3.5 h-3.5" />
                                                        Enable Team Assignment
                                                    </button>
                                                </div>
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
                                    
                                    <button 
                                        onClick={() => setShowLocalReminder(!showLocalReminder)}
                                        className="w-full flex items-center justify-center space-x-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-colors"
                                    >
                                        <ClockIcon className="w-4 h-4" /> <span>⏰ Custom Reminder</span>
                                    </button>

                                    {showLocalReminder && (
                                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-2 animate-fade-in shadow-sm relative z-50">
                                            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                                Custom Reminder
                                            </p>
                                            <input 
                                                type="text" 
                                                placeholder="Reminder message (e.g. Call back)"
                                                value={localReminderMessage}
                                                onChange={(e) => setLocalReminderMessage(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs border border-amber-200 rounded outline-none focus:border-amber-500 bg-white"
                                            />
                                            <input 
                                                type="datetime-local" 
                                                value={localReminderTime}
                                                onChange={(e) => setLocalReminderTime(e.target.value)}
                                                className="w-full px-3 py-1.5 text-xs border border-amber-200 rounded outline-none focus:border-amber-500 bg-white"
                                            />
                                            <div className="flex gap-2 mt-1">
                                                <button 
                                                    onClick={() => setShowLocalReminder(false)}
                                                    className="flex-1 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-amber-100 rounded transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        if (!activeLeadId) {
                                                            setToastConfig({
                                                                type: 'error',
                                                                title: 'Cannot Set Alarm',
                                                                message: 'Please click "Enable Team Assignment" above to register this contact before setting an alarm.'
                                                            });
                                                            return;
                                                        }
                                                        if (localReminderTime) {
                                                            // Ask for desktop notification permission right when they set the alarm
                                                            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                                                                Notification.requestPermission();
                                                            }

                                                            try {
                                                                const targetTime = new Date(localReminderTime).getTime();
                                                                await followUpService.createFollowUp({
                                                                    contact_id: activeLeadId,
                                                                    title: `[QUICK_ALARM] Reminder: ${activeChat.contact_name || 'Contact'}`,
                                                                    description: localReminderMessage,
                                                                    scheduled_at: new Date(targetTime).toISOString(),
                                                                    type: 'TASK'
                                                                });
                                                                setShowLocalReminder(false);
                                                                setLocalReminderMessage('');
                                                                setLocalReminderTime('');
                                                                setToastConfig({
                                                                    type: 'success',
                                                                    title: 'Reminder Set',
                                                                    message: 'Reminder saved successfully!'
                                                                });
                                                            } catch (err) {
                                                                console.error('Failed to create quick alarm', err);
                                                                setToastConfig({
                                                                    type: 'error',
                                                                    title: 'Error',
                                                                    message: 'Failed to save reminder'
                                                                });
                                                            }
                                                        } else {
                                                            setToastConfig({
                                                                type: 'warning',
                                                                title: 'Time Required',
                                                                message: 'Please select a time'
                                                            });
                                                        }
                                                    }}
                                                    className="flex-1 py-1.5 text-[11px] font-bold bg-amber-500 text-white hover:bg-amber-600 rounded transition-colors shadow-sm"
                                                >
                                                    Save Alarm
                                                </button>
                                            </div>
                                        </div>
                                    )}
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
                                        value={contactNotes}
                                        onChange={(e) => setContactNotes(e.target.value)}
                                        disabled={isSavingNotes}
                                    ></textarea>
                                    <div className="flex justify-end">
                                        <button 
                                            onClick={handleSaveNotes} 
                                            disabled={isSavingNotes}
                                            className="px-4 py-2 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                                        >
                                            {isSavingNotes ? 'Saving...' : 'Save Notes'}
                                        </button>
                                    </div>
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
                                    onClick={confirmClearChat}
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
            {toastConfig && (
                <Toast
                    type={toastConfig.type}
                    title={toastConfig.title}
                    message={toastConfig.message}
                    onClose={() => setToastConfig(null)}
                />
            )}
        </div>
    );
};

export default Inbox;
