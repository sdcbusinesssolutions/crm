
import React, { useState, useEffect } from 'react';
import ContactList from './ContactList';
import ContactGroups from './ContactGroups';
import InputFields from './InputFields';
import PipelineView from './PipelineView';
import FormBuilder from './FormBuilder';
import FollowUpManager from './FollowUps/FollowUpManager';
import LeadDashboard from './LeadDashboard';
import { getPipelines } from '../services/lead-management-api';
import { contactService } from '../services/contactService';
import { contactGroupService } from '../services/contactGroupService';
import { getForms, getTasks } from '../services/lead-management-api';
import { inputFieldService } from '../services/inputFieldService';
import { UsersIcon, BadgeIcon, HomeIcon, MenuIcon } from './icons';
import { usePermissions, ACCESS_TYPES } from '../modules/teamStaff/hooks/usePermissions';

interface ContactsProps {
    initialTab?: 'dashboard' | 'contacts' | 'groups' | 'inputs' | 'pipelines' | 'follow-up' | 'forms';
    initialPipelineId?: string | null;
    followUpInitialView?: 'list' | 'form';
    onToggleSidebar?: () => void;
    onNavigate?: (item: any) => void;
}

const Contacts: React.FC<ContactsProps> = ({ initialTab = 'dashboard', initialPipelineId, followUpInitialView = 'list', onToggleSidebar, onNavigate }) => {
    const { hasAccess } = usePermissions();
    const [activeTab, setActiveTab] = useState<string>(initialTab);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [counts, setCounts] = useState<{
        contacts: number | null;
        groups: number | null;
        pipelines: number | null;
        forms: number | null;
        inputs: number | null;
        followUps: number | null;
    }>({
        contacts: null,
        groups: null,
        pipelines: null,
        forms: null,
        inputs: null,
        followUps: null
    });

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                // Fetch counts safely
                // NOTE: Use getContactsPaginated(1,1) to get the real total count from the server
                // instead of getContacts() which only returns the first page (~5 items)
                const results = await Promise.allSettled([
                    contactService.getContactsPaginated(1, 1), // returns { data, total }
                    contactGroupService.getGroups(),
                    getPipelines(),
                    getForms(),
                    inputFieldService.getInputs(),
                    getTasks()
                ]);

                // For contacts, use the real total from the paginated response
                const contactsResult = results[0];
                const contactsTotal = contactsResult.status === 'fulfilled'
                    ? (contactsResult.value as { data: any[], total: number }).total
                    : 0;

                const getValue = (result: any) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.length : 0;

                setCounts({
                    contacts: contactsTotal,
                    groups: getValue(results[1]),
                    pipelines: getValue(results[2]),
                    forms: getValue(results[3]),
                    inputs: getValue(results[4]),
                    followUps: getValue(results[5])
                });
            } catch (error) {
                console.error("Failed to fetch tab counts", error);
            }
        };
        fetchCounts();
    }, []);

    const handleContactCountUpdate = (count: number) => {
        setCounts(prev => {
            if (prev.contacts === count) return prev;
            return { ...prev, contacts: count };
        });
    };

    const handleGroupCountUpdate = (count: number) => {
        setCounts(prev => {
            if (prev.groups === count) return prev;
            return { ...prev, groups: count };
        });
    };

    const handleGroupClick = (groupId: string) => {
        setSelectedGroupId(groupId);
        setActiveTab('contacts');
        if (onNavigate) onNavigate('Contact List');
    };

    const tabToMenuItem: Record<string, string> = {
        'dashboard': 'Overview',
        'contacts': 'Contact List',
        'groups': 'Contact Groups',
        'pipelines': 'Pipelines',
        'forms': 'Form Builder',
        'follow-up': 'Follow-up',
        'inputs': 'Input Fields'
    };

    const handleTabClick = (tabId: string) => {
        setActiveTab(tabId);
        if (onNavigate && tabToMenuItem[tabId]) {
            onNavigate(tabToMenuItem[tabId]);
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <LeadDashboard onNavigate={(tab) => setActiveTab(tab)} totalContactsCount={counts.contacts} />;
            case 'contacts': return <ContactList initialGroupFilter={selectedGroupId} onClearGroupFilter={() => setSelectedGroupId(null)} onContactCountUpdate={handleContactCountUpdate} />;
            case 'groups': return <ContactGroups onGroupClick={handleGroupClick} onGroupCountUpdate={handleGroupCountUpdate} />;
            case 'inputs': return <InputFields />;
            case 'pipelines': return <PipelineView initialPipelineId={initialPipelineId} />;
            case 'follow-up': return <FollowUpManager onNavigate={onNavigate} initialView={followUpInitialView} />;
            case 'forms': return <FormBuilder />;
            default: return (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-2xl border border-slate-200 shadow-sm m-4 animate-fade-in">
                    <div className="p-8 text-center max-w-md">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-50 mb-6">
                            <UsersIcon className="w-10 h-10 text-brand-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Coming Soon</h3>
                        <p className="text-slate-500 leading-relaxed">The <span className="font-semibold capitalize text-slate-700">{activeTab.replace('-', ' ')}</span> module is currently under active development.</p>
                    </div>
                </div>
            );
        }
    };

    const tabs = React.useMemo(() => {
        const tabInactiveClass = 'bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700 transition-all shadow-md';
        
        return [
            {
                id: 'dashboard',
                label: 'Overview',
                icon: HomeIcon,
                activeClass: 'bg-slate-800 text-white shadow-lg shadow-slate-900/20',
                inactiveClass: tabInactiveClass,
                count: null
            },
            {
                id: 'contacts',
                label: 'Contacts',
                icon: UsersIcon,
                activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-600/20',
                inactiveClass: tabInactiveClass,
                count: counts.contacts
            },
            {
                id: 'groups',
                label: 'Groups',
                activeClass: 'bg-amber-600 text-white shadow-lg shadow-amber-600/20',
                inactiveClass: tabInactiveClass,
                count: counts.groups
            },
            {
                id: 'pipelines',
                label: 'Pipelines',
                activeClass: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20',
                inactiveClass: tabInactiveClass,
                count: counts.pipelines
            },
            {
                id: 'forms',
                label: 'Form Builder',
                activeClass: 'bg-violet-600 text-white shadow-lg shadow-violet-600/20',
                inactiveClass: tabInactiveClass,
                count: counts.forms
            },
            {
                id: 'follow-up',
                label: 'Follow-up',
                activeClass: 'bg-rose-600 text-white shadow-lg shadow-rose-600/20',
                inactiveClass: tabInactiveClass,
                count: counts.followUps
            },
            {
                id: 'inputs',
                label: 'Custom Fields',
                activeClass: 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20',
                inactiveClass: tabInactiveClass,
                count: counts.inputs
            },
        ].filter(tab => {
            const moduleMap: Record<string, string> = {
                'dashboard': 'Overview',
                'contacts': 'Contact List',
                'groups': 'Contact Groups',
                'pipelines': 'Pipelines',
                'forms': 'Form Builder',
                'follow-up': 'Follow-up',
                'inputs': 'Input Fields'
            };
            return hasAccess(moduleMap[tab.id], ACCESS_TYPES.READ);
        });
    }, [counts, hasAccess]);

    useEffect(() => {
        // Fallback to first accessible tab if activeTab is not allowed
        const isAllowed = tabs.some(tab => tab.id === activeTab);
        if (!isAllowed && tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    }, [tabs, activeTab]);

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden relative container-mobile-fix">
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 z-20 sticky top-0 shadow-sm">
                <div className="px-4 sm:px-8 pt-3 pb-0 max-w-[1800px] mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-2">
                        <div className="flex items-center gap-3">
                            {onToggleSidebar && (
                                <button
                                    onClick={onToggleSidebar}
                                    className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <MenuIcon className="w-6 h-6" />
                                </button>
                            )}
                            <div>
                                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Lead CRM</h1>
                                <p className="text-slate-500 text-sm mt-1">Track, nurture, and convert your leads efficiently.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 pb-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab.id)}
                                className={`
                                    px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[7rem] md:min-w-[9rem] shadow-sm transform hover:scale-[1.02] shrink-0
                                    ${activeTab === tab.id ? tab.activeClass : tab.inactiveClass}
                                `}
                            >
                                {tab.icon && <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'opacity-70'}`} />}
                                <span>{tab.label}</span>
                                {tab.count !== null && (
                                    <span className={`
                                        ml-1 px-2 py-0.5 rounded-md text-[10px] 
                                        ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white text-brand-600 shadow-sm'}
                                    `}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-slate-50 custom-scrollbar">
                <div className="max-w-[1800px] mx-auto w-full min-h-full pb-10">{renderContent()}</div>
            </div>
        </div>
    );
};

export default Contacts;
