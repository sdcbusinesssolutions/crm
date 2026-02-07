// THIS IS THE WORKING VERSION FROM 2 DAYS AGO
// Reference file - DO NOT MODIFY
// This version works on desktop and mobile (except input box visibility on mobile)

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
    // ... (rest of the working code provided by user)
    // This is stored as reference only
};

export default Inbox;
