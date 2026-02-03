import React, { useState, useEffect } from 'react';
import { themeService } from '../services/themeService';
import {
    HomeIcon, MessageIcon, UsersIcon, MegaphoneIcon, PuzzleIcon, SettingsIcon,
    SparklesIcon, ChevronDownIcon, TriggerIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon,
    ListIcon, ClockIcon, TagIcon, EditIcon, AppointmentIcon, PhoneIcon, CatalogueIcon,
    CheckSquareIcon, WebhookIcon, CodeIcon, BriefcaseIcon, BadgeIcon, EyeIcon, ConditionIcon,
    LinkIcon, GalleryIcon, MicrophoneIcon
} from './icons';

export type MenuItem =
    | 'Dashboard'
    | 'Inbox'
    | 'Contacts'
    | 'Overview'
    | 'Contact List'
    | 'Contact Groups'
    | 'Form Contact'
    | 'Form Builder'
    | 'Input Fields'
    | 'Campaigns'
    | 'Integrations'
    | 'Manage'
    | 'Whatsapp Templates'
    | 'Whatsapp Forms'
    | 'Tags'
    | 'Columns'
    | 'Opts Management'
    | 'Webhook Events'
    | 'Gallery'
    | 'FAQ Bot'
    | 'FAQ Bot'
    | 'AI Buddy'
    | 'Flows'
    | 'Pipelines'
    | 'Follow-up'
    | 'Projects'
    | 'Tasks'
    | 'Settings'
    | 'Branding & Appearance'
    | 'WhatsApp Management'
    | 'Knowledge Base'
    | 'Developers'
    | 'WhatsApp API'
    | 'My Plan'
    | 'Sheet Automation'
    | 'AI Buddy';

interface SidebarProps {
    activeItem: MenuItem;
    onNavigate: (item: MenuItem) => void;
    isOpen: boolean;
    onClose: () => void;
    userEmail?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate, isOpen, onClose, userEmail }) => {
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isContactsOpen, setIsContactsOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
    const [appName, setAppName] = useState<string>('');
    const [appNameImageUrl, setAppNameImageUrl] = useState<string | undefined>(undefined);
    const [appNameType, setAppNameType] = useState<'text' | 'image'>('text');
    const [sidebarDisplay, setSidebarDisplay] = useState<'both' | 'logo_only' | 'name_only'>('both');
    const [isThemeLoaded, setIsThemeLoaded] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    // LOGIC UPDATE: DETERMINE COLLAPSED STATE
    // If the sidebar is technically "collapsed" (user preference on desktop), 
    // but it is currently "open" as a mobile drawer (isOpen=true), 
    // WE MUST RENDER THE EXPANDED VIEW.
    const showCollapsed = isCollapsed && !isOpen;

    // Poll for theme changes
    useEffect(() => {
        const loadTheme = async () => {
            const theme = await themeService.getTheme();
            setLogoUrl(theme.logoUrl);
            setAppName(theme.appName || 'CRM');
            setAppNameImageUrl(theme.appNameImageUrl);
            setAppNameType(theme.appNameType || 'text');
            setSidebarDisplay(theme.sidebarDisplay || 'both');
            setIsThemeLoaded(true);
        };

        loadTheme(); // Load immediately
        const interval = setInterval(loadTheme, 2000);
        return () => clearInterval(interval);
    }, []);

    const manageSubItems: MenuItem[] = ['Whatsapp Templates', 'Whatsapp Forms', 'Columns', 'Opts Management', 'Webhook Events'];
    const settingsSubItems: MenuItem[] = ['Branding & Appearance', 'WhatsApp API', 'WhatsApp Management', 'My Plan'];
    const contactSubItems: MenuItem[] = ['Overview', 'Contact List', 'Contact Groups', 'Pipelines', 'Follow-up', 'Form Builder', 'Tags', 'Input Fields', 'Form Contact'];

    useEffect(() => {
        if (manageSubItems.includes(activeItem)) setIsManageOpen(true);
        if (settingsSubItems.includes(activeItem) || activeItem === 'Settings') setIsSettingsOpen(true);
        if (contactSubItems.includes(activeItem)) setIsContactsOpen(true);
    }, [activeItem]);

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
        if (!isCollapsed) {
            setIsManageOpen(false); setIsSettingsOpen(false); setIsContactsOpen(false);
        }
    };

    const handleItemClick = (item: MenuItem, hasSubmenu: boolean) => {
        // Interaction Update: Click only navigates, does NOT expand sidebar (User Request)
        if (isCollapsed) {
            if (item !== 'Manage') onNavigate(item);
            return;
        }

        if (item === 'Manage') setIsManageOpen(!isManageOpen);
        else if (item === 'Settings') { setIsSettingsOpen(!isSettingsOpen); onNavigate(item); }
        else if (item === 'Contacts') { setIsContactsOpen(!isContactsOpen); onNavigate(item); }
        else onNavigate(item);
    };

    const getSubItemIcon = (item: MenuItem, isActive: boolean) => {
        // In expanded mode, we use colors. In collapsed mode, we override this in renderItem.
        // Hover: Vibrant brand color instead of dull slate
        const baseClass = `w-5 h-5 transition-all duration-300 ${isActive ? 'text-brand-600 drop-shadow-sm' : 'text-[var(--color-brand)]'}`;

        switch (item) {
            case 'Overview': return <HomeIcon className={baseClass} />;
            case 'Contact List': return <ListIcon className={baseClass} />;
            case 'Contact Groups': return <UsersIcon className={baseClass} />;
            case 'Pipelines': return <ConditionIcon className={baseClass} />;
            case 'Follow-up': return <ClockIcon className={baseClass} />;
            case 'Tags': return <TagIcon className={baseClass} />;
            case 'Input Fields': return <EditIcon className={baseClass} />;
            case 'Form Contact': return <AppointmentIcon className={baseClass} />;
            case 'Form Builder': return <CatalogueIcon className={baseClass} />;


            case 'Whatsapp Templates': return <MessageIcon className={baseClass} />;
            case 'Whatsapp Forms': return <CatalogueIcon className={baseClass} />;
            case 'Columns': return <ListIcon className={baseClass} />;
            case 'Opts Management': return <CheckSquareIcon className={baseClass} />;
            case 'Webhook Events': return <WebhookIcon className={baseClass} />;
            case 'Sheet Automation': return <ListIcon className={baseClass} />;

            case 'Branding & Appearance': return <EyeIcon className={baseClass} />;
            case 'WhatsApp API': return <CodeIcon className={baseClass} />;
            case 'WhatsApp Management': return <BriefcaseIcon className={baseClass} />;
            case 'My Plan': return <BadgeIcon className={baseClass} />;
            case 'Integrations': return <LinkIcon className={baseClass} />;
            case 'Gallery': return <GalleryIcon className={baseClass} />;
            case 'AI Buddy': return <SparklesIcon className={baseClass} />;
            default: return null;
        }
    };

    const renderItem = (item: MenuItem, icon: React.ReactNode, hasSubmenu: boolean = false, isSubItem: boolean = false, isBeta: boolean = false) => {
        let isActive = activeItem === item;

        // Parent Active State Logic:
        // A parent menu should appear active if one of its children is currently selected.
        if (item === 'Manage' && manageSubItems.includes(activeItem)) isActive = true;
        else if (item === 'Settings' && (settingsSubItems.includes(activeItem) || activeItem === 'Settings')) isActive = true;
        else if (item === 'Contacts' && (contactSubItems.includes(activeItem) || activeItem === 'Contacts')) isActive = true;

        const displayLabel = item === 'Contacts' ? 'Lead CRM' : item;

        // Resolve icon for subitems
        let finalIcon = icon;
        if (isSubItem && !finalIcon) {
            finalIcon = getSubItemIcon(item, isActive);
        }

        // --- LOGIC UPDATE: Use component-level 'showCollapsed' variable ---

        // --- COLLAPSED STATE STYLING (Applies to both Main and Sub items) ---
        if (showCollapsed) {
            // Visual Styling Updates:
            // Active: Brand Color Background, White Text.
            // Inactive: White Text, Brand Color on Hover.

            const collapsedIconClass = `transition-transform duration-300 w-6 h-6 mb-1`;

            const styledCollapsedIcon = React.isValidElement(finalIcon)
                ? React.cloneElement(finalIcon as React.ReactElement, {
                    // Remove existing size and text colors so it inherits from parent div
                    className: `${(finalIcon.props as any).className || ''} ${collapsedIconClass}`
                        .replace(/w-5 h-5/g, '')
                        .replace(/text-[\w-]+/g, '')
                })
                : finalIcon;

            return (
                <div
                    key={item}
                    onClick={() => handleItemClick(item, hasSubmenu)}
                    className={`group flex flex-col items-center justify-center py-2 mx-1 rounded-xl cursor-pointer transition-all duration-200 mb-1 relative
             ${isActive
                            ? 'bg-brand-600 text-white shadow-lg'
                            : 'text-white hover:text-brand-300 hover:bg-white/10'}`}
                    title={displayLabel}
                >
                    <div className="relative">
                        {isBeta && (
                            <span className="absolute -top-3 -right-3 bg-amber-400 text-slate-900 text-[7px] font-bold px-1 py-0 rounded-sm rotate-12 shadow-sm z-10 border border-slate-900/10 pointer-events-none">
                                Beta
                            </span>
                        )}
                        {styledCollapsedIcon}
                    </div>
                    <span className="text-[9px] font-medium text-center leading-3 tracking-wide">{displayLabel}</span>
                </div>
            );
        }

        let isExpanded = false;
        if (item === 'Manage') isExpanded = isManageOpen;
        if (item === 'Settings') isExpanded = isSettingsOpen;
        if (item === 'Contacts') isExpanded = isContactsOpen;

        // Visual Update: Expanded parents appear active (dark brand color)
        const showActiveStyle = isActive || (isExpanded && hasSubmenu);

        // --- EXPANDED STATE STYLING ---
        // Update: Hovering now triggers brand-600 color for icons and brand-50 bg
        const mainIconClass = `transition-transform duration-300 w-5 h-5 ${showActiveStyle ? 'text-white' : 'text-[var(--color-brand)]'}`;
        const styledMainIcon = React.isValidElement(finalIcon)
            ? React.cloneElement(finalIcon as React.ReactElement, {
                className: `${(finalIcon.props as any).className || ''} ${mainIconClass}`.replace(/w-5 h-5/g, '')
            })
            : finalIcon;

        if (isSubItem) {
            return (
                <div
                    key={item}
                    onClick={() => {
                        onNavigate(item);
                    }}
                    className={`group flex items-center pl-11 pr-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out relative overflow-hidden ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:text-brand-600 hover:bg-brand-50'
                        }`}
                >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-600 rounded-r-md"></div>}
                    <span className="mr-3 transition-colors duration-200">
                        {styledMainIcon}
                    </span>
                    <span className="relative z-10 truncate text-[14px] leading-5 font-medium">{displayLabel}</span>
                </div>
            );
        }

        return (
            <div
                key={item}
                onClick={() => {
                    // Interaction Update: Text Body always selects/navigates.
                    // Expansion is strictly handled by the chevron/arrow.
                    onNavigate(item);
                }}
                title={showCollapsed ? displayLabel : ''}
                className={`group flex items-center justify-between px-4 py-3 mx-3 rounded-lg cursor-pointer transition-all duration-200 ease-out mb-1 relative overflow-visible ${showActiveStyle ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-600'
                    }`}
            >
                <div className={`flex items-center space-x-3 relative z-10`}>
                    <div className="relative">
                        {styledMainIcon}
                        {isBeta && (
                            <span className="absolute -top-2 -right-3 bg-amber-400 text-slate-900 text-[8px] font-bold px-1 rounded-sm -rotate-12 shadow-sm">
                                Beta
                            </span>
                        )}
                    </div>
                    <span className={`text-[14px] leading-5 font-medium ${showActiveStyle ? 'text-white' : 'text-slate-600 group-hover:text-brand-600'}`}>{displayLabel}</span>
                </div>
                {hasSubmenu && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            // Expanded State Toggle Logic
                            if (item === 'Manage') setIsManageOpen(!isManageOpen);
                            else if (item === 'Settings') setIsSettingsOpen(!isSettingsOpen);
                            else if (item === 'Contacts') setIsContactsOpen(!isContactsOpen);
                        }}
                        className="p-1 -mr-2 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'text-white/80' : 'text-slate-400 group-hover:text-brand-600'} ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                )}
            </div>
        );
    };

    const handleSignOut = async () => {
        const { error } = await import('../lib/supabase').then(m => m.supabase.auth.signOut());
        if (!error) window.location.reload();
    };

    // Rendering Helpers
    const showLogo = sidebarDisplay !== 'name_only' || showCollapsed;
    const showName = !showCollapsed && sidebarDisplay !== 'logo_only';

    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-slate-900/40 z-[290] lg:hidden backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />}
            <div
                className={`fixed inset-y-0 left-0 z-[300] flex flex-col shadow-2xl lg:shadow-none transform transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:h-full 
        w-64 bg-canvas-surface border-r border-slate-200 
        ${isCollapsed ? 'lg:w-24 lg:bg-[#064A3A] lg:border-none' : ''}`}
            >
                <div className={`px-4 py-5 flex items-center ${showCollapsed ? 'lg:flex-col lg:justify-center lg:gap-4 justify-between' : 'justify-between'} border-b ${showCollapsed ? 'lg:border-white/10 border-slate-100' : 'border-slate-100'}`}>
                    <div className={`flex items-center ${showCollapsed ? 'lg:justify-center' : 'space-x-2.5'} overflow-hidden`}>
                        {showLogo && (
                            <div className={`relative flex items-center justify-center shadow-md text-white overflow-hidden shrink-0 ${showCollapsed ? 'lg:w-10 lg:h-10 lg:bg-white/10' : ''} w-9 h-9 bg-brand-500 rounded-xl`}>
                                {!isThemeLoaded ? (
                                    <div className="animate-pulse bg-white/20 w-full h-full" />
                                ) : logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-lg">{appName ? appName[0].toUpperCase() : 'C'}</span>
                                )}
                            </div>
                        )}
                        {showName && (
                            !isThemeLoaded ? (
                                <div className="h-6 w-32 bg-slate-200 rounded animate-pulse" />
                            ) : (
                                appNameType === 'image' && appNameImageUrl ? (
                                    <img src={appNameImageUrl} alt={appName} className="h-14 w-auto max-w-[140px] md:max-w-[170px] object-contain object-left shrink" />
                                ) : (
                                    <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none truncate">{appName}</h1>
                                )
                            )
                        )}
                    </div>
                    <button onClick={onClose} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><CloseIcon className="w-5 h-5" /></button>
                    <button onClick={toggleSidebar} className={`hidden lg:flex items-center justify-center p-1.5 rounded-lg transition-colors ${isCollapsed ? 'text-white/70 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}>
                        {isCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                    </button>
                </div>

                <div className="flex-1 py-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
                    <div className="px-2 mb-2">{renderItem('Dashboard', <HomeIcon className="w-5 h-5" />)}</div>
                    <div className="space-y-1">
                        {!showCollapsed && <p className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 mt-6">Communication</p>}
                        {renderItem('Inbox', <MessageIcon className="w-5 h-5" />)}

                        {renderItem('Contacts', <UsersIcon className="w-5 h-5" />, true)}
                        {/* Only show submenus when physically expanded to avoid icon clutter */}
                        {!showCollapsed && isContactsOpen && <div className="space-y-1 mt-1 mb-2">{contactSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}

                        {renderItem('Campaigns', <MegaphoneIcon className="w-5 h-5" />)}

                        {!showCollapsed && <p className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 mt-6">Automation</p>}
                        {renderItem('Flows', <TriggerIcon className="w-5 h-5" />)}
                        {renderItem('Sheet Automation', <ListIcon className="w-5 h-5" />)}
                        {renderItem('Manage', <BriefcaseIcon className="w-5 h-5" />, true)}
                        {!showCollapsed && isManageOpen && <div className="space-y-1 mt-1 mb-2">{manageSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}
                        {renderItem('Integrations', <LinkIcon className="w-5 h-5" />, false, false, false)}

                        {!showCollapsed && <p className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 mt-6">AI & Tools</p>}
                        {renderItem('AI Buddy', <SparklesIcon className="w-5 h-5" />, false, false, true)}

                        {renderItem('Gallery', <GalleryIcon className="w-5 h-5" />, false, false, true)}

                        {!showCollapsed && <p className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 mt-6">Workspace</p>}
                        {renderItem('Settings', <SettingsIcon className="w-5 h-5" />, true)}
                        {!showCollapsed && isSettingsOpen && <div className="space-y-1 mt-1 mb-2">{settingsSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}
                    </div>
                </div>

                <div className={`p-4 relative ${showCollapsed ? 'flex justify-center border-t border-white/10' : 'border-t border-slate-100'}`}>
                    {/* Sign Out Popover */}
                    {isUserMenuOpen && (
                        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 overflow-hidden animate-fade-in-up z-50">
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
                                className="w-full flex items-center gap-2 p-2 hover:bg-slate-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors text-sm font-bold"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Sign Out
                            </button>
                        </div>
                    )}

                    <div
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={`flex items-center gap-3 cursor-pointer p-2 rounded-xl transition-colors
              ${isUserMenuOpen ? 'bg-slate-100' : 'hover:bg-slate-50'}
              ${showCollapsed ? 'justify-center' : ''}`}
                    >
                        <div className="w-9 h-9 min-w-[36px] bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm ring-1 ring-brand-200">
                            {userEmail ? userEmail[0].toUpperCase() : 'U'}
                        </div>
                        {!showCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">{userEmail || 'User'}</p>
                                <p className="text-xs text-slate-500 font-medium truncate">My Workspace</p>
                            </div>
                        )}
                        {!showCollapsed && <ChevronDownIcon className="w-4 h-4 text-slate-400" />}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
