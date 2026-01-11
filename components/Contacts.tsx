
import React, { useState, useEffect } from 'react';
import ContactList from './ContactList';
import ContactGroups from './ContactGroups';
import InputFields from './InputFields';
import { UsersIcon, BadgeIcon } from './icons';

interface ContactsProps {
    initialTab?: 'contacts' | 'groups' | 'inputs' | 'crm' | 'followup' | 'meta-leads';
}

const Contacts: React.FC<ContactsProps> = ({ initialTab = 'contacts' }) => {
    const [activeTab, setActiveTab] = useState<string>(initialTab);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const renderContent = () => {
        switch (activeTab) {
            case 'contacts': return <ContactList />;
            case 'groups': return <ContactGroups />;
            case 'inputs': return <InputFields />;
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
        { id: 'contacts', label: 'Contacts' },
        { id: 'groups', label: 'Groups' },
        { id: 'inputs', label: 'Input Fields' },
        { id: 'crm', label: 'CRM', icon: true },
        { id: 'followup', label: 'Follow-up' },
        { id: 'meta-leads', label: 'Meta Leads' },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden relative">
            <div className="bg-white/80 backdrop-blur-md border-b border-slate-200 z-20 sticky top-0 shadow-sm">
                <div className="px-6 pt-6 pb-0 max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Contacts Manager</h1>
                            <p className="text-slate-500 text-sm mt-1">Manage leads, organize groups, and configure data.</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-6 overflow-x-auto no-scrollbar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    group relative pb-3 text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border-b-2
                                    ${activeTab === tab.id 
                                        ? 'text-brand-600 border-brand-600' 
                                        : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'}
                                `}
                            >
                                {tab.icon && <BadgeIcon className={`w-4 h-4 ${activeTab === tab.id ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`} />}
                                {tab.label}
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
