import React, { useState, useEffect } from 'react';
import { themeService } from '../services/themeService';
import {
    HomeIcon, MessageIcon, UsersIcon, MegaphoneIcon, PuzzleIcon, SettingsIcon,
    SparklesIcon, ChevronDownIcon, TriggerIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon,
    ListIcon, ClockIcon, TagIcon, EditIcon, AppointmentIcon, PhoneIcon, CatalogueIcon,
    CheckSquareIcon, WebhookIcon, CodeIcon, BriefcaseIcon, BadgeIcon, EyeIcon, ConditionIcon,
    LinkIcon, GalleryIcon, MicrophoneIcon, QuickReplyIcon
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
    | 'G Automation'
    | 'AI Buddy'
    | 'Drip Campaigns';

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

    const manageSubItems: MenuItem[] = ['Whatsapp Templates', 'Whatsapp Forms'];
    const settingsSubItems: MenuItem[] = ['Branding & Appearance', 'WhatsApp API', 'WhatsApp Management', 'My Plan'];
    const contactSubItems: MenuItem[] = ['Overview', 'Contact List', 'Contact Groups', 'Pipelines', 'Follow-up', 'Form Builder', 'Tags', 'Input Fields', 'Form Contact'];

    useEffect(() => {
        // if (manageSubItems.includes(activeItem)) setIsManageOpen(true);
        if (settingsSubItems.includes(activeItem)) setIsSettingsOpen(true);
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
            if (item === 'Manage') {
                onNavigate(manageSubItems[0]);
            } else {
                onNavigate(item);
            }
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
            case 'G Automation': return <ListIcon className={baseClass} />;

            case 'Branding & Appearance': return <EyeIcon className={baseClass} />;
            case 'WhatsApp API': return <CodeIcon className={baseClass} />;
            case 'WhatsApp Management': return <BriefcaseIcon className={baseClass} />;
            case 'My Plan': return <BadgeIcon className={baseClass} />;
            case 'Integrations': return <LinkIcon className={baseClass} />;
            case 'Gallery': return <GalleryIcon className={baseClass} />;
            case 'AI Buddy': return <SparklesIcon className={baseClass} />;
            case 'Drip Campaigns': return <TriggerIcon className={baseClass} />;
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

        const displayLabel = item === 'Contacts' ? 'Lead CRM' : item === 'Manage' ? 'Template' : item;

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

            const collapsedIconClass = `transition-transform duration-300 w-5 h-5 mb-[1px]`;

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
                    className={`group flex flex-col items-center justify-center py-2 mx-1 rounded-lg cursor-pointer transition-all duration-200 mb-1 relative
             ${isActive
                            ? 'bg-brand-600 text-white shadow-md'
                            : 'text-white hover:text-brand-300 hover:bg-white/5'}`}
                    title={displayLabel}
                >
                    <div className="relative">
                        {isBeta && (
                            <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-slate-900 text-[6px] font-bold px-0.5 rounded-sm shadow-sm z-10 border border-slate-900/10 pointer-events-none">
                                Beta
                            </span>
                        )}
                        {styledCollapsedIcon}
                    </div>
                    <span className="text-[9px] font-medium text-center leading-tight tracking-wide relative z-10">{displayLabel}</span>
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
        const mainIconClass = `transition-transform duration-300 w-5 h-5 ${showActiveStyle ? 'text-white' : 'text-white'}`;
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
                    className={`group flex items-center pl-11 pr-3 py-2 mx-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out relative overflow-hidden ${isActive ? 'bg-white/10 text-white' : 'text-white hover:bg-white/5'
                        }`}
                >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-brand-500 rounded-r-md"></div>}
                    <span className="mr-2.5 transition-colors duration-200">
                        {styledMainIcon}
                    </span>
                    <span className="relative z-10 truncate text-[14.5px] leading-snug tracking-wide font-medium">{displayLabel}</span>
                </div>
            );
        }

        return (
            <div
                key={item}
                onClick={() => {
                    // Interaction Update: Text Body always selects/navigates.
                    // Expansion is strictly handled by the chevron/arrow.
                    if (item === 'Manage') {
                        onNavigate(manageSubItems[0]);
                    } else {
                        onNavigate(item);
                    }
                }}
                title={showCollapsed ? displayLabel : ''}
                className={`group flex items-center justify-between px-3.5 py-2 mx-2.5 rounded-lg cursor-pointer transition-all duration-200 ease-out mb-1 relative overflow-visible ${showActiveStyle ? 'bg-brand-600 text-white shadow-md shadow-brand-200' : 'text-white hover:bg-white/10'
                    }`}
            >
                <div className={`flex items-center space-x-2.5 relative z-10`}>
                    <div className="relative">
                        {styledMainIcon}
                        {isBeta && (
                            <span className="absolute -top-1.5 -right-2.5 bg-amber-400 text-slate-900 text-[7.5px] font-bold px-0.5 rounded-sm -rotate-12 shadow-sm">
                                Beta
                            </span>
                        )}
                    </div>
                    <span className={`text-[14.5px] leading-snug tracking-wide font-medium ${showActiveStyle ? 'text-white' : 'text-white'}`}>{displayLabel}</span>
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
                        className="p-0.5 -mr-1.5 rounded-md hover:bg-white/10 transition-colors"
                    >
                        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-300 ${isActive ? 'text-white' : 'text-white'} ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                )}
            </div>
        );
    };

    const handleSignOut = async () => {
        try {
            await import('../lib/supabase').then(m => m.supabase.auth.signOut());
        } catch (error) {
            console.error("Sign out error:", error);
        }

        // AGGRESSIVE CLEANUP: Remove all Supabase tokens and dashboard caches from Local Storage
        localStorage.removeItem('dashboard_stats_cache');
        localStorage.removeItem('lead_dashboard_cache');
        localStorage.removeItem('connection_cache');
        localStorage.removeItem('theme_cache'); // Also clear theme to avoid flashing old brand colors

        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                localStorage.removeItem(key);
            }
        });

        // Also remove legacy or admin tokens if present
        localStorage.removeItem('adminToken');

        // Reload to force App.tsx to re-evaluate session state
        window.location.reload();
    };

    // Rendering Helpers
    const showLogo = sidebarDisplay !== 'name_only' || showCollapsed;
    const showName = !showCollapsed && sidebarDisplay !== 'logo_only';

    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-slate-900/40 z-[290] lg:hidden backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />}
            <div
                className={`shrink-0 fixed inset-y-0 left-0 z-[300] flex flex-col shadow-2xl lg:shadow-none transform transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:h-full 
        w-64 bg-[#00684a] border-r border-slate-700 
        ${isCollapsed ? 'lg:w-20 lg:bg-[#00684a] lg:border-none' : ''}`}
            >
                <div className={`px-2 py-3 flex items-center ${showCollapsed ? 'lg:flex-col lg:justify-center lg:gap-2 justify-between' : 'justify-between'} border-b ${showCollapsed ? 'lg:border-white/10 border-white/10' : 'border-white/10'}`}>
                    <div className={`flex items-center ${showCollapsed ? 'lg:justify-center' : 'space-x-2.5'} overflow-hidden`}>
                        {showLogo && (
                            <div className={`relative flex items-center justify-center shadow-md text-white overflow-hidden shrink-0 ${showCollapsed ? 'lg:w-7 lg:h-7 lg:bg-white/10' : ''} w-8 h-8 bg-brand-500 rounded-xl`}>
                                {!isThemeLoaded ? (
                                    <div className="animate-pulse bg-white/20 w-full h-full" />
                                ) : logoUrl ? (
                                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-base">{appName ? appName[0].toUpperCase() : 'C'}</span>
                                )}
                            </div>
                        )}
                        {showName && (
                            !isThemeLoaded ? (
                                <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
                            ) : (
                                appNameType === 'image' && appNameImageUrl ? (
                                    <img src={appNameImageUrl} alt={appName} className="h-12 w-auto max-w-[140px] md:max-w-[170px] object-contain object-left shrink" />
                                ) : (
                                    <h1 className="text-base font-extrabold text-white tracking-tight leading-none truncate">{appName}</h1>
                                )
                            )
                        )}
                    </div>
                    <button onClick={onClose} className="lg:hidden p-1.5 text-white hover:text-white rounded-lg transition-colors"><CloseIcon className="w-4 h-4" /></button>
                    <button onClick={toggleSidebar} className={`hidden lg:flex items-center justify-center p-1 rounded-lg transition-colors ${isCollapsed ? 'text-white hover:bg-white/20 hover:text-white' : 'text-white hover:text-white hover:bg-white/10'}`}>
                        {isCollapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronLeftIcon className="w-3.5 h-3.5" />}
                    </button>
                </div>

                <div className="flex-1 py-1 overflow-y-auto no-scrollbar overflow-x-hidden">
                    <div className={`px-2 ${showCollapsed ? 'mb-3' : 'mb-3'}`}>{renderItem('Dashboard', <HomeIcon className="w-5 h-5" />)}</div>
                    <div className={showCollapsed ? 'space-y-1' : 'space-y-1'}>
                        {!showCollapsed && <p className="px-5 text-[9px] font-bold text-white uppercase tracking-widest mb-2 mt-4 truncate">Communication</p>}
                        {renderItem('Inbox', <MessageIcon className="w-5 h-5" />)}

                        {renderItem('Contacts', <UsersIcon className="w-5 h-5" />, true)}
                        {/* Only show submenus when physically expanded to avoid icon clutter */}
                        {!showCollapsed && isContactsOpen && <div className="space-y-1 mt-2 mb-2.5">{contactSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}

                        {renderItem('Campaigns', <MegaphoneIcon className="w-5 h-5" />)}

                        {!showCollapsed && <p className="px-5 text-[9px] font-bold text-white uppercase tracking-widest mb-2 mt-4.5 truncate">Automation</p>}
                        {renderItem('Flows', <TriggerIcon className="w-5 h-5" />)}
                        {renderItem('Drip Campaigns', <ClockIcon className="w-5 h-5" />)}

                        {renderItem('G Automation', <ListIcon className="w-5 h-5" />)}
                        {renderItem('Manage', <BriefcaseIcon className="w-5 h-5" />, true)}
                        {!showCollapsed && isManageOpen && <div className="space-y-1 mt-2 mb-2.5">{manageSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}
                        {renderItem('Integrations', <LinkIcon className="w-5 h-5" />, false, false, false)}

                        {!showCollapsed && <p className="px-5 text-[9px] font-bold text-white uppercase tracking-widest mb-2 mt-4.5 truncate">AI & Tools</p>}
                        {renderItem('AI Buddy', <SparklesIcon className="w-5 h-5" />, false, false, true)}

                        {renderItem('Gallery', <GalleryIcon className="w-5 h-5" />, false, false, true)}

                        {!showCollapsed && <p className="px-5 text-[9px] font-bold text-white uppercase tracking-widest mb-2 mt-4.5 truncate">Workspace</p>}
                        {renderItem('Settings', <SettingsIcon className="w-5 h-5" />, true)}
                        {!showCollapsed && isSettingsOpen && <div className="space-y-1 mt-2 mb-2.5">{settingsSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}
                    </div>
                </div>

                <div className={`py-3 relative ${showCollapsed ? 'flex flex-col items-center justify-center gap-2 border-t border-white/10' : 'border-t border-white/10'}`}>
                    {/* Sign Out Popover */}
                    {isUserMenuOpen && (
                        <div className={`absolute bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 overflow-hidden animate-fade-in-up z-[100] transition-all duration-200
                            ${showCollapsed
                                ? 'left-full bottom-2 ml-2 w-36 origin-bottom-left'
                                : 'bottom-full left-4 right-4 mb-2 origin-bottom'}`}
                        >
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSignOut(); }}
                                className="w-full flex items-center gap-2 p-1.5 hover:bg-slate-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors text-sm font-bold"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                Sign Out
                            </button>
                        </div>
                    )}

                    <div
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={`flex items-center gap-2.5 cursor-pointer p-1.5 mx-2.5 rounded-xl transition-colors
              ${isUserMenuOpen ? 'bg-white/20' : 'hover:bg-white/10'}
              ${showCollapsed ? 'justify-center' : ''}`}
                    >
                        <div className="w-8 h-8 min-w-[32px] bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-sm ring-1 ring-brand-200">
                            {userEmail ? userEmail[0].toUpperCase() : 'U'}
                        </div>
                        {!showCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-[14.5px] font-medium tracking-wide text-white truncate">{userEmail || 'User'}</p>
                                <p className="text-[10.5px] text-white font-medium truncate">My Workspace</p>
                            </div>
                        )}
                        {!showCollapsed && <ChevronDownIcon className="w-3.5 h-3.5 text-white" />}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
