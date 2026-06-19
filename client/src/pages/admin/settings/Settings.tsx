import React, { useState, useEffect } from 'react';
import AdminThemeSettings from '../../../components/admin/AdminThemeSettings';
import AdminOnboardingSettings from '../../../components/admin/AdminOnboardingSettings';
import AdminSignupNotifications from '../../../components/admin/AdminSignupNotifications';
import AdminEmailSettings from '../../../components/admin/AdminEmailSettings';
import { adminSettingsService } from '../../../services/adminSettingsService';

const Settings = () => {
    const [activeSection, setActiveSection] = useState('general');

    const sections = [
        { id: 'general', label: 'General', icon: '⚙️' },
        { id: 'appearance', label: 'Appearance', icon: '🎨' },
        { id: 'onboarding', label: 'Onboarding', icon: '🚀' },
        { id: 'payments', label: 'Payments', icon: '💳' },
        { id: 'notifications', label: 'Notifications', icon: '🔔' },
        { id: 'email', label: 'Email', icon: '✉️' },
        { id: 'logins', label: 'Logins/Auth', icon: '🔒' },
    ];



    return (
        <div className="max-w-6xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-extrabold text-[var(--text-color)] mb-8 tracking-tight">Settings</h1>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full lg:w-64 flex-shrink-0">
                    <div className="bg-[var(--sidebar-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden p-2 space-y-1">
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => setActiveSection(section.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeSection === section.id
                                    ? 'bg-[var(--primary-color)] text-white shadow-md shadow-[var(--primary-color)]/20'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <span className="text-lg">{section.icon}</span>
                                {section.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {activeSection === 'appearance' && <AdminThemeSettings />}

                    {activeSection === 'general' && (
                        <div className="bg-[var(--sidebar-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm p-8">
                            <h2 className="text-xl font-bold mb-4">General Settings</h2>
                            <p className="text-slate-500">Platform-wide settings and configuration.</p>
                            {/* Placeholders */}
                        </div>
                    )}

                    {activeSection === 'onboarding' && (
                        <AdminOnboardingSettings />
                    )}

                    {activeSection === 'payments' && (
                        <div className="space-y-6">
                            <div className="bg-[var(--sidebar-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm p-8">
                                <h2 className="text-xl font-bold mb-6">Payment Gateways</h2>
                                <div className="space-y-4">
                                    <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-color)] flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">S</div>
                                            <div>
                                                <h3 className="font-bold">Stripe</h3>
                                                <p className="text-xs text-slate-500">Credit card processing</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" defaultChecked className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-color)]"></div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === 'notifications' && (
                        <AdminSignupNotifications />
                    )}

                    {activeSection === 'email' && (
                        <AdminEmailSettings />
                    )}

                    {/* Fallback for other sections */}
                    {['logins'].includes(activeSection) && (
                        <div className="bg-[var(--sidebar-bg)] rounded-2xl border border-[var(--border-color)] shadow-sm p-8 flex flex-col items-center justify-center text-center py-20">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mb-4">Construction</div>
                            <h3 className="text-lg font-bold text-slate-900">Coming Soon</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mt-2">This module is correctly under development.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
