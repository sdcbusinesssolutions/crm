import React, { useState, useEffect } from 'react';
import { adminSettingsService } from '../../services/adminSettingsService';

const AdminEmailSettings: React.FC = () => {
    const [smtpSettings, setSmtpSettings] = useState({
        host: '',
        port: '',
        user: '',
        pass: '',
        encryption: 'tls', // 'ssl', 'tls', 'none'
        fromEmail: ''
    });

    const [testEmail, setTestEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await adminSettingsService.getSmtpSettings();
                if (data && Object.keys(data).length > 0) {
                    setSmtpSettings({
                        host: data.host || '',
                        port: data.port || '',
                        user: data.user || '',
                        pass: data.pass || '',
                        encryption: data.encryption || 'tls',
                        fromEmail: data.fromEmail || ''
                    });
                }
            } catch (err) {
                console.error('Failed to load SMTP settings:', err);
            }
        };
        loadSettings();
    }, []);

    const handleSave = async () => {
        try {
            setIsSaving(true);
            await adminSettingsService.saveSmtpSettings(smtpSettings);
            alert('SMTP settings saved successfully!');
        } catch (error: any) {
            console.error('Error saving SMTP settings:', error);
            alert('Failed to save settings: ' + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!testEmail) {
            alert('Please enter an email address to send the test email to.');
            return;
        }
        if (!smtpSettings.host || !smtpSettings.port || !smtpSettings.user || !smtpSettings.pass) {
            alert('Please fill out the SMTP host, port, user, and password before testing.');
            return;
        }

        try {
            setIsTesting(true);
            await adminSettingsService.testSmtpSettings(smtpSettings, testEmail);
            alert('Test email sent successfully! Please check your inbox.');
        } catch (error: any) {
            console.error('Error testing SMTP connection:', error);
            alert('Test failed: ' + error.message);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="bg-[var(--sidebar-bg)] rounded-2xl shadow-xl shadow-slate-200/40 border border-[var(--border-color)] overflow-hidden transition-all duration-300">
            <div className="px-8 py-6 border-b border-[var(--border-color)] flex justify-between items-center bg-gradient-to-r from-[var(--sidebar-bg)] to-slate-50/50">
                <div>
                    <h3 className="text-2xl font-black bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent tracking-tight">Email / SMTP Server</h3>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Configure your custom SMTP server for sending out emails to users.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <><span className="animate-spin text-lg leading-none">⚙</span> Saving...</>
                    ) : (
                        <><span className="text-lg leading-none">💾</span> Save Settings</>
                    )}
                </button>
            </div>

            <div className="p-8 space-y-8">
                <div className="bg-white p-6 rounded-2xl border border-[var(--border-color)] shadow-sm">
                    <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center pb-4 border-b border-slate-100">
                        <span className="mr-3 text-blue-500 text-2xl drop-shadow-sm">⚙️</span>
                        <span className="tracking-tight">SMTP Configuration</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMTP Host</label>
                            <input
                                type="text"
                                value={smtpSettings.host}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="smtp.example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMTP Port</label>
                            <input
                                type="number"
                                value={smtpSettings.port}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="587"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMTP Username</label>
                            <input
                                type="text"
                                value={smtpSettings.user}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="user@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">SMTP Password</label>
                            <input
                                type="password"
                                value={smtpSettings.pass}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Encryption</label>
                            <select
                                value={smtpSettings.encryption}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, encryption: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                            >
                                <option value="tls">TLS (Recommended)</option>
                                <option value="ssl">SSL</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">From Email Address</label>
                            <input
                                type="email"
                                value={smtpSettings.fromEmail}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                                className="w-full px-4 py-3 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-xl text-[var(--text-color)] font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                                placeholder="noreply@example.com"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                        <span className="mr-2">🧪</span> Test Connection
                    </h4>
                    <p className="text-sm text-slate-600 mb-4">Send a test email to verify that your SMTP configuration is correct.</p>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Test Email Address</label>
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl text-slate-800 font-bold focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all shadow-inner"
                                placeholder="you@example.com"
                            />
                        </div>
                        <button
                            onClick={handleTestConnection}
                            disabled={isTesting || !testEmail}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isTesting ? (
                                <><span className="animate-spin text-lg leading-none">⚙</span> Testing...</>
                            ) : (
                                <>Send Test Email</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminEmailSettings;
