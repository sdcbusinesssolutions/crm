import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';

const WebhookSetup: React.FC = () => {
    const [webhookUrls, setWebhookUrls] = useState<{ phoneNumberId: string, url: string }[]>([]);
    const [verifyToken, setVerifyToken] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await settingsService.getWebhookSettings();
            // Handle both old and new API response formats for robustness
            if (data.webhookUrls) {
                setWebhookUrls(data.webhookUrls);
            } else if (data.webhookUrl) {
                setWebhookUrls([{ phoneNumberId: 'Default', url: data.webhookUrl }]);
            }
            setVerifyToken(data.verifyToken || '');
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to load webhook settings' });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could show a small toast here
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            await settingsService.saveWebhookToken(verifyToken);
            setMessage({ type: 'success', text: 'Verify token updated successfully' });
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to update verify token' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Webhook Setup</h2>

            {message && (
                <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                    <p className="text-sm text-blue-800">
                        <strong>Important:</strong> Configure the webhook URL for each WhatsApp number in your Meta App Dashboard.
                    </p>
                </div>

                {webhookUrls.length > 0 ? (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700">Your Webhook URLs (Read-only)</label>
                        {webhookUrls.map((item, index) => (
                            <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Phone Number ID: {item.phoneNumberId}
                                    </span>
                                </div>
                                <div className="flex">
                                    <input
                                        type="text"
                                        value={item.url}
                                        readOnly
                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-l-lg bg-white text-slate-600 focus:outline-none text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(item.url)}
                                        className="px-4 py-2 bg-slate-100 border border-l-0 border-slate-300 rounded-r-lg text-slate-600 hover:bg-slate-200 font-medium text-sm"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        <p className="text-slate-500">No WhatsApp accounts configured. Please add an account first to generate a webhook URL.</p>
                    </div>
                )}

                {/* Connection Utility Section */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6">
                    <h3 className="text-md font-semibold text-slate-800 mb-2">Connection Status</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        If you are experiencing issues with receiving messages, you can force an update to the Webhook connection on Meta's servers.
                    </p>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={async () => {
                                setSaving(true);
                                setMessage(null);
                                try {
                                    await settingsService.updateWebhook();
                                    setMessage({ type: 'success', text: 'Webhook connection refreshed successfully!' });
                                } catch (err: any) {
                                    console.error(err);
                                    setMessage({ type: 'error', text: err.message || 'Failed to refresh connection' });
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving}
                            className={`px-4 py-2 bg-white border border-slate-300 shadow-sm text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-all ${saving ? 'opacity-70' : ''}`}
                        >
                            {saving ? 'Updating...' : 'Refresh Webhook Connection'}
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-8 pt-6 border-t border-slate-100">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Verify Token</label>
                        <input
                            type="text"
                            value={verifyToken}
                            onChange={(e) => setVerifyToken(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                            placeholder="Enter a secure verify token"
                            required
                        />
                        <p className="mt-1 text-xs text-slate-500">You must enter this same token in the Meta App Dashboard for all accounts.</p>
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 focus:ring-4 focus:ring-brand-200 transition-all ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {saving ? 'Saving...' : 'Update Verify Token'}
                        </button>
                    </div>

                </form>

                {/* Token Management Section */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6">
                    <h3 className="text-md font-semibold text-slate-800 mb-2">Access Token Management</h3>
                    <p className="text-sm text-slate-600 mb-4">
                        Manage the vitality of your connection to Meta. If your token expires, you will stop receiving messages.
                    </p>

                    <TokenManager />
                </div>
            </div >
        </div >
    );
};

const TokenManager: React.FC = () => {
    const [info, setInfo] = useState<{ isValid: boolean, expiresAt: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [extending, setExtending] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        checkToken();
    }, []);

    const checkToken = async () => {
        setLoading(true);
        try {
            const data = await settingsService.getDebugToken();
            setInfo(data);
        } catch (err: any) {
            // Silently ignore "No access token found" as it's normal for new users
            if (err.message && !err.message.includes('No access token found')) {
                console.error('Token check failed:', err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleExtend = async () => {
        setExtending(true);
        setMsg(null);
        try {
            await settingsService.extendToken();
            setMsg({ type: 'success', text: 'Token extended successfully!' });
            await checkToken(); // Refresh info
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message });
        } finally {
            setExtending(false);
        }
    };

    if (loading && !info) return <div className="text-sm text-slate-500">Checking token status...</div>;

    return (
        <div className="bg-white p-4 rounded border border-slate-200">
            {msg && <div className={`text-sm mb-3 ${msg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</div>}

            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-medium text-slate-700">Status</div>
                    <div className={`text-sm ${info?.isValid ? 'text-green-600' : 'text-red-600'}`}>
                        {info?.isValid ? 'Active' : 'Invalid / Expired'}
                    </div>
                </div>
                <div>
                    <div className="text-sm font-medium text-slate-700">Expires</div>
                    <div className="text-sm text-slate-600">
                        {info?.expiresAt === 0 ? 'Never (Permanent)' : (info?.expiresAt ? new Date(info.expiresAt * 1000).toLocaleString() : 'Unknown')}
                    </div>
                </div>
                <button
                    onClick={handleExtend}
                    disabled={extending}
                    className="px-3 py-1.5 bg-brand-100 text-brand-700 rounded hover:bg-brand-200 text-sm font-medium"
                >
                    {extending ? 'Extending...' : 'Extend Token'}
                </button>
            </div>
        </div>
    );
};

export default WebhookSetup;
