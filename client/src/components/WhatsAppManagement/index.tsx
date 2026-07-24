import React, { useState } from 'react';
import AccountSetup from './AccountSetup';
import WebhookSetup from './WebhookSetup';
import ChangePassword from './ChangePassword';
import TwoFactorAuth from './TwoFactorAuth';
import MMLiteOnboarding from './MMLiteOnboarding';
import { usePermissions, ACCESS_TYPES } from '../../modules/teamStaff/hooks/usePermissions';

import OptInOutKeywords from './OptInOutKeywords';

type Tab = 'account' | 'webhook' | 'marketing' | 'keywords' | 'password' | '2fa';

const WhatsAppManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('account');
    const { hasAccess, canWrite, isStaff } = usePermissions();

    // Check READ access
    if (isStaff && !hasAccess('WhatsApp Management', ACCESS_TYPES.READ)) {
        return (
            <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
                <div className="text-center bg-white p-10 rounded-3xl border border-slate-200 shadow-xl max-w-md animate-fade-in">
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 shadow-inner">
                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0-6v2m0-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Access Denied</h2>
                    <p className="text-slate-500 mt-3 text-sm leading-relaxed">
                        You do not have permission to access the WhatsApp Management Panel. Please contact your administrator.
                    </p>
                </div>
            </div>
        );
    }

    const showReadOnlyBadge = isStaff && !canWrite('WhatsApp Management');

    const renderContent = () => {
        switch (activeTab) {
            case 'account':
                return <AccountSetup readOnly={showReadOnlyBadge} />;
            case 'webhook':
                return <WebhookSetup readOnly={showReadOnlyBadge} />;
            case 'marketing':
                return <MMLiteOnboarding readOnly={showReadOnlyBadge} />;
            case 'keywords':
                return <OptInOutKeywords readOnly={showReadOnlyBadge} />;
            case 'password':
                return <ChangePassword readOnly={showReadOnlyBadge} />;
            case '2fa':
                return <TwoFactorAuth readOnly={showReadOnlyBadge} />;
            default:
                return <AccountSetup readOnly={showReadOnlyBadge} />;
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        WhatsApp Management
                        {showReadOnlyBadge && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 shadow-sm animate-pulse">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Read Only Mode
                            </span>
                        )}
                    </h1>
                    <p className="text-slate-500 mt-1">Manage your WhatsApp Business API connection and security settings.</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-5xl mx-auto">
                    {/* Tabs */}
                    <div className="flex space-x-1 bg-slate-200/50 p-1 rounded-xl mb-8 w-fit">
                        <button
                            onClick={() => setActiveTab('account')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'account'
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                                }`}
                        >
                            Account Setup
                        </button>
                        <button
                            onClick={() => setActiveTab('webhook')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'webhook'
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                                }`}
                        >
                            Webhook Setup
                        </button>
                        <button
                            onClick={() => setActiveTab('marketing')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'marketing'
                                    ? 'bg-white text-pink-600 shadow-sm font-bold'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                                }`}
                        >
                            Marketing (MM Lite)
                        </button>
                        <button
                            onClick={() => setActiveTab('keywords')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'keywords'
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                                }`}
                        >
                            Opt-In/Out Keywords
                        </button>
                        <button
                            onClick={() => setActiveTab('password')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'password'
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                                }`}
                        >
                            Change Password
                        </button>
                        <button
                            onClick={() => setActiveTab('2fa')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === '2fa'
                                    ? 'bg-white text-brand-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/50'
                                }`}
                        >
                            Two-Factor Auth
                        </button>
                    </div>

                    {/* Content */}
                    <div className="animate-fade-in">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppManagement;
