import React, { useState, useEffect } from 'react';
import { adminSettingsService } from '../../services/adminSettingsService';

const AdminSignupNotifications: React.FC = () => {
    const [notificationSettings, setNotificationSettings] = useState({
        integration_user_email: '',
        whatsapp_waba_id: '',
        whatsapp_api_number_id: '',
        admin_whatsapp_number: '',
        admin_whatsapp_template_name: '',
        notify_admin_on_signup: false,
        send_welcome_whatsapp: false,
        welcome_template_name: '',
        welcome_template_params: [] as any[],
        welcome_template_media_url: '',
        notify_admin_via_email: false,
        admin_email_address: '',
        send_welcome_email: false,
        welcome_email_subject: '',
        welcome_email_body: '',
        admin_whatsapp_template_params: [] as any[],
        admin_whatsapp_media_url: '',
        trigger_webhook_on_signup: false,
        admin_webhook_url: ''
    });

    const [isSavingNotifications, setIsSavingNotifications] = useState(false);
    const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'webhook'>('whatsapp');

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await adminSettingsService.getSignupNotifications();
                setNotificationSettings({
                    integration_user_email: data.integration_user_email || '',
                    whatsapp_waba_id: data.whatsapp_waba_id || '',
                    whatsapp_api_number_id: data.whatsapp_api_number_id || '',
                    admin_whatsapp_number: data.admin_whatsapp_number || '',
                    admin_whatsapp_template_name: data.admin_whatsapp_template_name || '',
                    notify_admin_on_signup: data.notify_admin_on_signup || false,
                    send_welcome_whatsapp: data.send_welcome_whatsapp || false,
                    welcome_template_name: data.welcome_template_name || '',
                    welcome_template_params: data.welcome_template_params || [],
                    welcome_template_media_url: data.welcome_template_media_url || '',
                    notify_admin_via_email: data.notify_admin_via_email || false,
                    admin_email_address: data.admin_email_address || '',
                    send_welcome_email: data.send_welcome_email || false,
                    welcome_email_subject: data.welcome_email_subject || '',
                    welcome_email_body: data.welcome_email_body || '',
                    admin_whatsapp_template_params: data.admin_whatsapp_template_params || [],
                    admin_whatsapp_media_url: data.admin_whatsapp_media_url || '',
                    trigger_webhook_on_signup: data.trigger_webhook_on_signup || false,
                    admin_webhook_url: data.admin_webhook_url || ''
                });
            } catch (err) {
                console.error('Failed to load signup notification settings:', err);
            }
        };
        loadSettings();
    }, []);

    const handleAddParam = (type: 'welcome' | 'admin') => {
        const key = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const currentParams = notificationSettings[key] || [];
        setNotificationSettings({ ...notificationSettings, [key]: [...currentParams, { type: 'field', value: 'name' }] });
    };

    const handleRemoveParam = (type: 'welcome' | 'admin', index: number) => {
        const key = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const currentParams = [...(notificationSettings[key] || [])];
        currentParams.splice(index, 1);
        setNotificationSettings({ ...notificationSettings, [key]: currentParams });
    };

    const handleUpdateParam = (type: 'welcome' | 'admin', index: number, field: string, value: string) => {
        const key = type === 'welcome' ? 'welcome_template_params' : 'admin_whatsapp_template_params';
        const currentParams = [...(notificationSettings[key] || [])];
        currentParams[index] = { ...currentParams[index], [field]: value };
        setNotificationSettings({ ...notificationSettings, [key]: currentParams });
    };

    const handleSaveNotificationSettings = async () => {
        try {
            setIsSavingNotifications(true);
            await adminSettingsService.saveSignupNotifications(notificationSettings);
            alert('Signup Notification settings saved successfully!');
        } catch (error: any) {
            console.error('Error saving notification settings:', error);
            alert('Failed to save settings: ' + error.message);
        } finally {
            setIsSavingNotifications(false);
        }
    };

    return (
        <div className="bg-[var(--sidebar-bg)] rounded-2xl shadow-xl shadow-slate-200/40 border border-[var(--border-color)] overflow-hidden transition-all duration-300">
            <div className="px-8 py-6 border-b border-[var(--border-color)] flex justify-between items-center bg-gradient-to-r from-[var(--sidebar-bg)] to-slate-50/50">
                <div>
                    <h3 className="text-2xl font-black bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent tracking-tight">Platform Signup Notifications</h3>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Configure automated WhatsApp, Email, & Webhook alerts for new user signups.</p>
                </div>
                <button
                    onClick={handleSaveNotificationSettings}
                    disabled={isSavingNotifications}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSavingNotifications ? (
                        <><span className="animate-spin text-lg leading-none">⚙</span> Saving...</>
                    ) : (
                        <><span className="text-lg leading-none">💾</span> Save Settings</>
                    )}
                </button>
            </div>
            
            {/* TABS HEADER */}
            <div className="px-8 py-4 border-b border-[var(--border-color)] bg-slate-50/50 flex gap-4">
                <button
                    onClick={() => setActiveTab('whatsapp')}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border ${activeTab === 'whatsapp' ? 'bg-[#25D366]/10 border-[#25D366]/50 text-[#25D366] shadow-[0_0_15px_rgba(37,211,102,0.15)]' : 'bg-white border-[var(--border-color)] text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                >
                    <span className="text-base">💬</span> WhatsApp Alerts
                </button>
                <button
                    onClick={() => setActiveTab('email')}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border ${activeTab === 'email' ? 'bg-blue-500/10 border-blue-500/50 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'bg-white border-[var(--border-color)] text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                >
                    <span className="text-base">📧</span> Email Alerts
                </button>
                <button
                    onClick={() => setActiveTab('webhook')}
                    className={`px-5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-2 border ${activeTab === 'webhook' ? 'bg-purple-500/10 border-purple-500/50 text-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'bg-white border-[var(--border-color)] text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                >
                    <span className="text-base">🔗</span> Webhook Alerts
                </button>
            </div>

            <div className="p-8 space-y-8">
                
                {/* Integration User Context - Always visible as it's a shared prerequisite */}
                <div className="relative bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border border-[var(--border-color)] shadow-sm overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-500 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative z-10">
                        <h4 className="text-sm font-extrabold text-[var(--text-color)] mb-2 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs shadow-inner">1</span>
                            Integration User Details
                        </h4>
                        <p className="text-xs text-slate-500 mb-5 font-medium">Provide the email of the Platform Admin who owns the WhatsApp and SMTP Integrations.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Integration User Email</label>
                                <input
                                    type="email"
                                    value={notificationSettings.integration_user_email}
                                    onChange={(e) => setNotificationSettings({ ...notificationSettings, integration_user_email: e.target.value })}
                                    className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all shadow-inner"
                                    placeholder="superadmin@yourplatform.com"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                        {/* --- WHATSAPP SECTION --- */}
                        {activeTab === 'whatsapp' && (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all">
                                    <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center pb-4 border-b border-slate-100">
                                        <span className="mr-3 text-[#25D366] text-2xl drop-shadow-sm">💬</span>
                                        <span className="tracking-tight">WhatsApp Settings</span>
                                    </h4>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp WABA ID</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.whatsapp_waba_id}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsapp_waba_id: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-[#25D366]/50 focus:border-[#25D366] outline-none transition-all shadow-inner"
                                        placeholder="1234567890"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">WhatsApp API Number ID</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.whatsapp_api_number_id}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, whatsapp_api_number_id: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-[#25D366]/50 focus:border-[#25D366] outline-none transition-all shadow-inner"
                                        placeholder="10987654321"
                                    />
                                </div>
                            </div>
                        
                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label className="block text-sm font-bold text-slate-800">Notify Admin via WhatsApp</label>
                                <p className="text-xs text-slate-500">Receive a message when a new user signs up on the platform.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.notify_admin_on_signup} onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_admin_on_signup: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366] shadow-inner peer-checked:shadow-[0_0_10px_rgba(37,211,102,0.4)]"></div>
                            </label>
                        </div>

                        {notificationSettings.notify_admin_on_signup && (
                            <div className="space-y-4 mt-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Admin WhatsApp Number</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.admin_whatsapp_number}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_whatsapp_number: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-[#25D366] outline-none transition-all"
                                        placeholder="+1234567890"
                                    />
                                    <p className="text-xs text-slate-400 mt-2">Include country code (e.g., +1 for US).</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Admin Template Name (Optional)</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.admin_whatsapp_template_name}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_whatsapp_template_name: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-[#25D366] outline-none transition-all"
                                        placeholder="admin_alert_template"
                                    />
                                    <p className="text-xs text-slate-400 mt-2">
                                        Must exactly match the template name approved in your Meta Developer Dashboard. Leave blank to send a standard text message.
                                        <br/><br/>
                                        <strong className="text-slate-500">Sample Template Body in Meta:</strong><br/>
                                        <span className="font-mono bg-slate-100 px-2 py-1 rounded text-[10px] mt-1 inline-block text-slate-600">
                                            🚨 New Signup! Name: {'{{1}}'}, Email: {'{{2}}'}, Phone: {'{{3}}'}
                                        </span>
                                    </p>
                                </div>
                                {notificationSettings.admin_whatsapp_template_name && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Header Media URL (Optional)</label>
                                            <input
                                                type="text"
                                                value={notificationSettings.admin_whatsapp_media_url}
                                                onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_whatsapp_media_url: e.target.value })}
                                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-[#25D366] outline-none transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex justify-between items-center">
                                                <span>Template Parameters</span>
                                                <button onClick={() => handleAddParam('admin')} className="text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs">Add Param</button>
                                            </label>
                                            <p className="text-xs text-slate-400 mb-3">
                                                Map the {'{{1}}'}, {'{{2}}'} slots from your Meta template to the user's data below.
                                            </p>
                                            <div className="space-y-2">
                                                {notificationSettings.admin_whatsapp_template_params.map((param, idx) => (
                                                    <div key={idx} className="flex gap-2 items-center bg-[var(--sidebar-bg)] p-2 rounded-lg border border-[var(--border-color)]">
                                                        <span className="text-xs font-bold text-slate-400 w-8">{`{{${idx + 1}}}`}</span>
                                                        <select
                                                            value={param.type}
                                                            onChange={(e) => handleUpdateParam('admin', idx, 'type', e.target.value)}
                                                            className="px-2 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-xs font-bold focus:outline-none"
                                                        >
                                                            <option value="field">Dynamic Field</option>
                                                            <option value="custom">Static Text</option>
                                                        </select>
                                                        {param.type === 'field' ? (
                                                            <select
                                                                value={param.value}
                                                                onChange={(e) => handleUpdateParam('admin', idx, 'value', e.target.value)}
                                                                className="flex-1 px-2 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-xs font-bold focus:outline-none"
                                                            >
                                                                <option value="name">User Name</option>
                                                                <option value="email">User Email</option>
                                                                <option value="contact">User Contact</option>
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={param.value}
                                                                onChange={(e) => handleUpdateParam('admin', idx, 'value', e.target.value)}
                                                                className="flex-1 px-2 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-xs font-bold focus:outline-none"
                                                                placeholder="Custom text"
                                                            />
                                                        )}
                                                        <button onClick={() => handleRemoveParam('admin', idx)} className="text-red-500 hover:text-red-700 p-1">✕</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 mt-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800">Send Welcome WhatsApp Message</label>
                                <p className="text-xs text-slate-500">Automatically send a welcome message template to new users.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.send_welcome_whatsapp} onChange={(e) => setNotificationSettings({ ...notificationSettings, send_welcome_whatsapp: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#25D366] shadow-inner peer-checked:shadow-[0_0_10px_rgba(37,211,102,0.4)]"></div>
                            </label>
                        </div>

                        {notificationSettings.send_welcome_whatsapp && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border border-slate-100 mt-4 shadow-sm">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Welcome Template Name</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.welcome_template_name}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, welcome_template_name: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-[#25D366]/50 focus:border-[#25D366] outline-none transition-all shadow-inner"
                                        placeholder="welcome_template_name"
                                    />
                                    <p className="text-xs text-slate-400 mt-2">
                                        Must exactly match the template name approved in your Meta Developer Dashboard.
                                        <br/><br/>
                                        <strong className="text-slate-500">Sample Template Body in Meta:</strong><br/>
                                        <span className="font-mono bg-slate-100 px-2 py-1 rounded text-[10px] mt-1 inline-block text-slate-600">
                                            Hello {'{{1}}'}! Welcome to our platform. Your registered email is {'{{2}}'}.
                                        </span>
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex justify-between items-center">
                                        <span>Template Parameters</span>
                                        <button onClick={() => handleAddParam('welcome')} className="text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs">Add Param</button>
                                    </label>
                                    <p className="text-xs text-slate-400 mb-3">
                                        Map the {'{{1}}'}, {'{{2}}'} slots from your Meta template to the user's data below.
                                    </p>
                                    <div className="space-y-2">
                                        {notificationSettings.welcome_template_params.map((param, idx) => (
                                            <div key={idx} className="flex gap-2 items-center bg-[var(--sidebar-bg)] p-2 rounded-lg border border-[var(--border-color)]">
                                                <span className="text-xs font-bold text-slate-400 w-8">{`{{${idx + 1}}}`}</span>
                                                <select
                                                    value={param.type}
                                                    onChange={(e) => handleUpdateParam('welcome', idx, 'type', e.target.value)}
                                                    className="px-2 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-xs font-bold focus:outline-none"
                                                >
                                                    <option value="field">Dynamic Field</option>
                                                    <option value="custom">Static Text</option>
                                                </select>
                                                {param.type === 'field' ? (
                                                    <select
                                                        value={param.value}
                                                        onChange={(e) => handleUpdateParam('welcome', idx, 'value', e.target.value)}
                                                        className="flex-1 px-2 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-xs font-bold focus:outline-none"
                                                    >
                                                        <option value="name">User Name</option>
                                                        <option value="email">User Email</option>
                                                        <option value="contact">User Contact</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={param.value}
                                                        onChange={(e) => handleUpdateParam('welcome', idx, 'value', e.target.value)}
                                                        className="flex-1 px-2 py-1.5 bg-[var(--bg-color)] border border-[var(--border-color)] rounded-md text-xs font-bold focus:outline-none"
                                                        placeholder="Custom text"
                                                    />
                                                )}
                                                <button onClick={() => handleRemoveParam('welcome', idx)} className="text-red-500 hover:text-red-700 p-1">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                )}
                {/* --- EMAIL SECTION --- */}
                {activeTab === 'email' && (
                    <div className="bg-white p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all space-y-6">
                        <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center pb-4 border-b border-slate-100">
                            <span className="mr-3 text-blue-500 text-2xl drop-shadow-sm">📧</span>
                            <span className="tracking-tight">Email Settings</span>
                        </h4>

                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label className="block text-sm font-bold text-slate-800">Notify Admin via Email</label>
                                <p className="text-xs text-slate-500">Receive an email when a new user signs up.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.notify_admin_via_email} onChange={(e) => setNotificationSettings({ ...notificationSettings, notify_admin_via_email: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 shadow-inner peer-checked:shadow-[0_0_10px_rgba(59,130,246,0.4)]"></div>
                            </label>
                        </div>

                        {notificationSettings.notify_admin_via_email && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border border-slate-100 shadow-sm mt-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin Email Address</label>
                                    <input
                                        type="email"
                                        value={notificationSettings.admin_email_address}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_email_address: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-inner"
                                        placeholder="admin@example.com"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 mt-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-800">Send Welcome Email</label>
                                <p className="text-xs text-slate-500">Automatically send an HTML welcome email to new users.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.send_welcome_email} onChange={(e) => setNotificationSettings({ ...notificationSettings, send_welcome_email: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 shadow-inner peer-checked:shadow-[0_0_10px_rgba(59,130,246,0.4)]"></div>
                            </label>
                        </div>

                        {notificationSettings.send_welcome_email && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border border-slate-100 shadow-sm mt-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Welcome Email Subject</label>
                                    <input
                                        type="text"
                                        value={notificationSettings.welcome_email_subject}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, welcome_email_subject: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-inner"
                                        placeholder="Welcome to our platform!"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Welcome Email HTML Body</label>
                                    <textarea
                                        value={notificationSettings.welcome_email_body}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, welcome_email_body: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-mono text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all h-32 shadow-inner"
                                        placeholder="<h1>Welcome!</h1><p>We are glad to have you here.</p>"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* --- WEBHOOK SECTION --- */}
                {activeTab === 'webhook' && (
                    <div className="bg-white p-6 rounded-2xl border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all space-y-6">
                        <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center pb-4 border-b border-slate-100">
                            <span className="mr-3 text-purple-500 text-2xl drop-shadow-sm">🔗</span>
                            <span className="tracking-tight">Webhook Settings</span>
                        </h4>

                        <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <div>
                                <label className="block text-sm font-bold text-slate-800">Trigger Webhook on Signup</label>
                                <p className="text-xs text-slate-500">Send an HTTP POST request to a custom webhook URL when a new user signs up.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={notificationSettings.trigger_webhook_on_signup} onChange={(e) => setNotificationSettings({ ...notificationSettings, trigger_webhook_on_signup: e.target.checked })} />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500 shadow-inner peer-checked:shadow-[0_0_10px_rgba(168,85,247,0.4)]"></div>
                            </label>
                        </div>

                        {notificationSettings.trigger_webhook_on_signup && (
                            <div className="space-y-4 bg-slate-50/80 p-5 rounded-xl border border-slate-100 shadow-sm mt-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Admin Webhook URL</label>
                                    <input
                                        type="url"
                                        value={notificationSettings.admin_webhook_url}
                                        onChange={(e) => setNotificationSettings({ ...notificationSettings, admin_webhook_url: e.target.value })}
                                        className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all shadow-inner"
                                        placeholder="https://hooks.zapier.com/hooks/catch/..."
                                    />
                                </div>
                                <p className="text-xs text-slate-400 mt-3">
                                    The webhook will receive a POST request with the following JSON format:
                                    <pre className="mt-2 p-3 bg-slate-800 text-slate-300 rounded-lg text-[10px] overflow-x-auto">
{`{
  "event": "new_user_signup",
  "domain": "yourtenantdomain.com",
  "admin": {
    "email": "admin@example.com",
    "whatsapp_number": "+1234567890"
  },
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "contact_number": "1234567890"
  },
  "timestamp": "2026-06-11T12:00:00.000Z"
}`}
                                    </pre>
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminSignupNotifications;
