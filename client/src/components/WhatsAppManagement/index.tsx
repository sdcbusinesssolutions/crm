import React, { useState } from 'react';
import AccountSetup from './AccountSetup';
import WebhookSetup from './WebhookSetup';
import ChangePassword from './ChangePassword';
import TwoFactorAuth from './TwoFactorAuth';
import MMLiteOnboarding from './MMLiteOnboarding';

type Tab = 'account' | 'webhook' | 'marketing' | 'password' | '2fa';

const WhatsAppManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('account');

    const renderContent = () => {
        switch (activeTab) {
            case 'account':
                return <AccountSetup />;
            case 'webhook':
                return <WebhookSetup />;
            case 'marketing':
                return <MMLiteOnboarding />;
            case 'password':
                return <ChangePassword />;
            case '2fa':
                return <TwoFactorAuth />;
            default:
                return <AccountSetup />;
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <h1 className="text-2xl font-bold text-slate-800">WhatsApp Management</h1>
                <p className="text-slate-500 mt-1">Manage your WhatsApp Business API connection and security settings.</p>
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
