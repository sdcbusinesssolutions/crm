import React, { useState, useEffect } from 'react';
import { themeService } from '../services/themeService';
import { 
  HomeIcon, MessageIcon, UsersIcon, MegaphoneIcon, PuzzleIcon, SettingsIcon, 
  SparklesIcon, ChevronDownIcon, TriggerIcon, CloseIcon, ChevronLeftIcon, ChevronRightIcon
} from './icons';

export type MenuItem = 
  | 'Dashboard' 
  | 'Inbox' 
  | 'Contacts' 
  | 'Contact List'
  | 'Contact Groups'
  | 'Input Fields'
  | 'Campaigns' 
  | 'Integrations' 
  | 'Manage' 
  | 'WhatsApp Numbers'
  | 'Whatsapp Templates'
  | 'Whatsapp Forms'
  | 'Tags' 
  | 'Columns'
  | 'Opts Management'
  | 'Webhook Events'
  | 'Gallery' 
  | 'FAQ Bot' 
  | 'Chatbot' 
  | 'Ai assistant' 
  | 'Flows' 
  | 'Projects' 
  | 'Tasks' 
  | 'Settings' 
  | 'Branding & Appearance'
  | 'Knowledge Base' 
  | 'Developers';

interface SidebarProps {
  activeItem: MenuItem;
  onNavigate: (item: MenuItem) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate, isOpen, onClose }) => {
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [appName, setAppName] = useState<string>('UpShpoi');

  // Poll for theme changes
  useEffect(() => {
      const interval = setInterval(() => {
          const theme = themeService.getTheme();
          setLogoUrl(theme.logoUrl);
          setAppName(theme.appName || 'UpShpoi');
      }, 1000);
      return () => clearInterval(interval);
  }, []);

  const manageSubItems: MenuItem[] = ['WhatsApp Numbers', 'Whatsapp Templates', 'Whatsapp Forms', 'Tags', 'Columns', 'Opts Management', 'Webhook Events'];
  const contactSubItems: MenuItem[] = ['Contact List', 'Contact Groups', 'Input Fields'];
  const settingsSubItems: MenuItem[] = ['Branding & Appearance'];

  useEffect(() => {
    if (manageSubItems.includes(activeItem)) setIsManageOpen(true);
    if (contactSubItems.includes(activeItem)) setIsContactsOpen(true);
    if (settingsSubItems.includes(activeItem) || activeItem === 'Settings') setIsSettingsOpen(true);
  }, [activeItem]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
    if (!isCollapsed) {
        setIsManageOpen(false); setIsContactsOpen(false); setIsSettingsOpen(false);
    }
  };

  const handleItemClick = (item: MenuItem, hasSubmenu: boolean) => {
      if (isCollapsed && hasSubmenu) {
          setIsCollapsed(false);
          setTimeout(() => {
            if (item === 'Manage') setIsManageOpen(true);
            else if (item === 'Contacts') setIsContactsOpen(true);
            else if (item === 'Settings') setIsSettingsOpen(true);
          }, 50);
          return;
      }
      if (item === 'Manage') setIsManageOpen(!isManageOpen);
      else if (item === 'Contacts') setIsContactsOpen(!isContactsOpen);
      else if (item === 'Settings') { setIsSettingsOpen(!isSettingsOpen); onNavigate(item); }
      else onNavigate(item);
  };
  
  const renderItem = (item: MenuItem, icon: React.ReactNode, hasSubmenu: boolean = false, isSubItem: boolean = false) => {
    const isActive = activeItem === item;
    if (isSubItem) {
        return (
            <div 
                key={item}
                onClick={() => onNavigate(item)}
                className={`group flex items-center pl-10 pr-3 py-2.5 mx-2 rounded-lg cursor-pointer transition-all duration-200 ease-in-out text-sm font-medium relative overflow-hidden ${
                isActive ? 'bg-brand-50 text-brand-600 font-semibold' : 'text-sidebar-text hover:text-brand-600 hover:bg-brand-50/50'
                }`}
            >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-500 rounded-r-md"></div>}
                <span className="relative z-10 truncate text-xs">{item}</span>
            </div>
        );
    }

    let isExpanded = false;
    if (item === 'Manage') isExpanded = isManageOpen;
    if (item === 'Contacts') isExpanded = isContactsOpen;
    if (item === 'Settings') isExpanded = isSettingsOpen;

    return (
      <div 
        key={item}
        onClick={() => handleItemClick(item, hasSubmenu)}
        title={isCollapsed ? item : ''}
        className={`group flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'} py-2.5 mx-3 rounded-xl cursor-pointer transition-all duration-200 ease-out mb-1 relative ${
          isActive ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'text-sidebar-text hover:bg-brand-50 hover:text-brand-600'
        }`}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} relative z-10`}>
          <span className={`transition-transform duration-300 ${isCollapsed ? 'scale-110' : ''} ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-600'}`}>{icon}</span>
          {!isCollapsed && <span className="font-medium text-sm tracking-normal">{item}</span>}
        </div>
        {!isCollapsed && hasSubmenu && <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'text-white/80' : 'text-slate-400 group-hover:text-brand-600'} ${isExpanded ? 'rotate-180' : ''}`} />}
      </div>
    );
  };

  return (
    <>
        {isOpen && <div className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-sm transition-opacity duration-300" onClick={onClose} />}
        <div className={`fixed inset-y-0 left-0 z-50 bg-canvas-surface border-r border-slate-200 flex flex-col shadow-2xl md:shadow-none transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:h-full ${isCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`px-4 py-5 flex items-center ${isCollapsed ? 'flex-col justify-center gap-4' : 'justify-between'} border-b border-slate-100`}>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5'} overflow-hidden`}>
                    <div className="w-9 h-9 relative bg-brand-500 rounded-xl flex items-center justify-center shadow-md text-white overflow-hidden">
                        {logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" /> : <span className="font-bold text-lg">V</span>}
                    </div>
                    {!isCollapsed && <h1 className="text-lg font-extrabold text-slate-800 tracking-tight leading-none truncate">{appName}</h1>}
                </div>
                <button onClick={onClose} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"><CloseIcon className="w-5 h-5" /></button>
                <button onClick={toggleSidebar} className="hidden md:flex items-center justify-center p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                    {isCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeftIcon className="w-4 h-4" />}
                </button>
            </div>

            <div className="flex-1 py-4 overflow-y-auto custom-scrollbar overflow-x-hidden">
                <div className="px-3 mb-2">{renderItem('Dashboard', <HomeIcon />)}</div>
                <div className="space-y-1">
                    {!isCollapsed && <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Communication</p>}
                    {renderItem('Inbox', <MessageIcon />)}
                    {renderItem('Contacts', <UsersIcon />, true)}
                    {isContactsOpen && !isCollapsed && <div className="space-y-0.5 mt-1 mb-2">{contactSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}
                    {renderItem('Campaigns', <MegaphoneIcon />)}
                    
                    {!isCollapsed && <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Automation</p>}
                    {renderItem('Flows', <TriggerIcon />)}
                    {renderItem('Manage', <SettingsIcon />, true)}
                    {isManageOpen && !isCollapsed && <div className="space-y-0.5 mt-1 mb-2">{manageSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}

                    {!isCollapsed && <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">AI & Tools</p>}
                    {renderItem('Chatbot', <PuzzleIcon />)}
                    {renderItem('Ai assistant', <SparklesIcon />)}
                    
                    {!isCollapsed && <p className="px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6">Workspace</p>}
                    {renderItem('Settings', <SettingsIcon />, true)}
                    {isSettingsOpen && !isCollapsed && <div className="space-y-0.5 mt-1 mb-2">{settingsSubItems.map(subItem => renderItem(subItem, null, false, true))}</div>}
                </div>
            </div>
            
            <div className={`p-4 border-t border-slate-100 ${isCollapsed ? 'flex justify-center' : ''}`}>
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group`}>
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white shadow-sm shrink-0">US</div>
                    {!isCollapsed && (
                        <>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800 truncate">User Account</p>
                                <p className="text-xs text-slate-500 truncate">admin@upshpoi.com</p>
                            </div>
                            <SettingsIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                        </>
                    )}
                </div>
            </div>
        </div>
    </>
  );
};

export default Sidebar;