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
        <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden transition-all duration-300">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white">
                <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Email / SMTP Server</h3>
                    <p className="text-slate-500 text-sm mt-1 font-bold">Configure your custom SMTP server for sending out emails to users.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-3 bg-[#006B4D] hover:bg-[#00563e] text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2 transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <><span className="animate-spin text-lg leading-none">⚙</span> Saving...</>
                    ) : (
                        <><span className="text-lg leading-none">💾</span> Save Settings</>
                    )}
                </button>
            </div>

            <div className="p-8 space-y-8">
                
                <div className="bg-white">
                    <h4 className="text-lg font-bold text-slate-800 mb-6 flex items-center pb-4 border-b border-slate-100">
                        <span className="mr-3 text-slate-400 text-2xl drop-shadow-sm">⚙️</span>
                        <span className="tracking-tight">SMTP Configuration</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">SMTP Host</label>
                            <input
                                type="text"
                                value={smtpSettings.host}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, host: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                placeholder="smtp.example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">SMTP Port</label>
                            <input
                                type="number"
                                value={smtpSettings.port}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, port: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                placeholder="587"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">SMTP Username</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                </span>
                                <input
                                    type="text"
                                    value={smtpSettings.user}
                                    onChange={(e) => setSmtpSettings({ ...smtpSettings, user: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                    placeholder="user@example.com"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">SMTP Password</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                </span>
                                <input
                                    type="password"
                                    value={smtpSettings.pass}
                                    onChange={(e) => setSmtpSettings({ ...smtpSettings, pass: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-[#EEF2F6] border border-[#E2E8F0] rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">Encryption</label>
                            <select
                                value={smtpSettings.encryption}
                                onChange={(e) => setSmtpSettings({ ...smtpSettings, encryption: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all appearance-none cursor-pointer"
                                style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2394a3b8%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '0.65em auto' }}
                            >
                                <option value="tls">TLS (Recommended)</option>
                                <option value="ssl">SSL</option>
                                <option value="none">None</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">From Email Address</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                </span>
                                <input
                                    type="email"
                                    value={smtpSettings.fromEmail}
                                    onChange={(e) => setSmtpSettings({ ...smtpSettings, fromEmail: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-[#EEF2F6] border border-[#E2E8F0] rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/20 focus:border-[#006B4D] outline-none transition-all"
                                    placeholder="noreply@example.com"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-[#EEF2F6] p-8 rounded-2xl border border-[#E2E8F0]">
                    <div className="relative z-10">
                        <h4 className="text-lg font-bold text-slate-800 mb-2 flex items-center">
                            <span className="mr-3 text-slate-400">🧪</span> 
                            <span>Test Connection</span>
                        </h4>
                        <p className="text-sm font-bold text-slate-500 mb-6 pl-9">Send a test email to verify that your SMTP configuration is correct and ready to use.</p>
                        
                        <div className="flex flex-col md:flex-row gap-4 items-end pl-9">
                            <div className="flex-1 w-full">
                                <label className="block text-[11px] font-black text-slate-500 uppercase tracking-[0.08em] mb-2">Test Email Address</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                    </span>
                                    <input
                                        type="email"
                                        value={testEmail}
                                        onChange={(e) => setTestEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-[#006B4D]/30 focus:border-[#006B4D] outline-none transition-all"
                                        placeholder="you@example.com"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={handleTestConnection}
                                disabled={isTesting || !testEmail}
                                className="px-8 py-3 bg-[#006B4D] hover:bg-[#00563e] text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                                {isTesting ? (
                                    <><span className="animate-spin text-lg leading-none">⚙</span> Sending...</>
                                ) : (
                                    <><span className="text-lg leading-none">🚀</span> Send Test Email</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminEmailSettings;
