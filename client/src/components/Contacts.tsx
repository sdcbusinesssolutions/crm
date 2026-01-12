
import React, { useState, useEffect } from 'react';
import ContactList from './ContactList';
import ContactGroups from './ContactGroups';
import InputFields from './InputFields';
import PipelineView from './PipelineView';
import FormBuilder from './FormBuilder';
import FollowUpManager from './FollowUpManager';
import LeadDashboard from './LeadDashboard';
import { getPipelines } from '../services/lead-management-api';
import { contactService } from '../services/contactService';
import { contactGroupService } from '../services/contactGroupService';
import { getForms, getTasks } from '../services/lead-management-api';
import { inputFieldService } from '../services/inputFieldService';
import { UsersIcon, BadgeIcon, HomeIcon } from './icons';

interface ContactsProps {
    initialTab?: 'dashboard' | 'contacts' | 'groups' | 'inputs' | 'pipelines' | 'follow-up' | 'forms';
    initialPipelineId?: string | null;
}

const Contacts: React.FC<ContactsProps> = ({ initialTab = 'dashboard', initialPipelineId }) => {
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
                const results = await Promise.allSettled([
                    contactService.getContacts(),
                    contactGroupService.getGroups(),
                    getPipelines(),
                    getForms(),
                    inputFieldService.getInputs(),
                    getTasks()
                ]);

                const getValue = (result: any) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value.length : 0;

                setCounts({
                    contacts: getValue(results[0]),
                    groups: getValue(results[1]),
                    pipelines: getValue(results[2]),
                    forms: getValue(results[3]),
                    inputs: getValue(results[4]),
                    followUps: getValue(results[5])
                }); // Update counts with 0 for failed requests instead of crashing entire setCounts
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
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <LeadDashboard onNavigate={(tab) => setActiveTab(tab)} totalContactsCount={counts.contacts} />;
            case 'contacts': return <ContactList initialGroupFilter={selectedGroupId} onClearGroupFilter={() => setSelectedGroupId(null)} onContactCountUpdate={handleContactCountUpdate} />;
            case 'groups': return <ContactGroups onGroupClick={handleGroupClick} onGroupCountUpdate={handleGroupCountUpdate} />;
            case 'inputs': return <InputFields />;
            case 'pipelines': return <PipelineView initialPipelineId={initialPipelineId} />;
            case 'follow-up': return <FollowUpManager />;
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

    const tabs = [
        {
            id: 'dashboard',
            label: 'Overview',
            icon: HomeIcon,
            activeClass: 'bg-slate-800 text-white shadow-lg shadow-slate-900/20',
            inactiveClass: 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200',
            count: null
        },
        {
            id: 'contacts',
            label: 'Contacts',
            icon: UsersIcon,
            activeClass: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
            inactiveClass: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100',
            count: counts.contacts
        },
        {
            id: 'groups',
            label: 'Groups',
            activeClass: 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/30',
            inactiveClass: 'bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 border border-fuchsia-100',
            count: counts.groups
        },
        {
            id: 'pipelines',
            label: 'Pipelines',
            activeClass: 'bg-violet-500 text-white shadow-lg shadow-violet-500/30',
            inactiveClass: 'bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-100',
            count: counts.pipelines
        },
        {
            id: 'forms',
            label: 'Form Builder',
            activeClass: 'bg-blue-500 text-white shadow-lg shadow-blue-500/30',
            inactiveClass: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100',
            count: counts.forms
        },
        {
            id: 'follow-up',
            label: 'Follow-up',
            activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/30',
            inactiveClass: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100',
            count: counts.followUps
        },
        {
            id: 'inputs',
            label: 'Custom Fields',
            activeClass: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30',
            inactiveClass: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100',
            count: counts.inputs
        },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden relative">
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 z-20 sticky top-0 shadow-sm">
                <div className="px-6 pt-6 pb-0 max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Lead CRM</h1>
                            <p className="text-slate-500 text-sm mt-1">Track, nurture, and convert your leads efficiently.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2 pb-4">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex items-center justify-center gap-2 min-w-[140px] shadow-sm transform hover:scale-[1.02]
                                    ${activeTab === tab.id ? tab.activeClass : tab.inactiveClass}
                                `}
                            >
                                {tab.icon && <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-white' : 'opacity-70'}`} />}
                                <span>{tab.label}</span>
                                {tab.count !== null && (
                                    <span className={`
                                        ml-1 px-2 py-0.5 rounded-md text-[10px] 
                                        ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-white/50 border border-black/5'}
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
                <div className="max-w-7xl mx-auto w-full min-h-full pb-10">{renderContent()}</div>
            </div>
        </div>
    );
};

export default Contacts;
