import React, { useState, useEffect } from 'react';
import { authNotificationsService } from '../../services/authNotificationsService';

const OptInOutKeywords: React.FC<{ readOnly?: boolean }> = ({ readOnly }) => {
    const [settings, setSettings] = useState({
        opt_out_keywords: '',
        opt_in_keywords: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await authNotificationsService.getSettings(window.location.hostname);
            if (data) {
                setSettings({
                    opt_out_keywords: data.opt_out_keywords || '',
                    opt_in_keywords: data.opt_in_keywords || ''
                });
            }
        } catch (err) {
            console.error('Error loading keyword settings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (readOnly) return;
        setSaving(true);
        setMessage(null);
        try {
            await authNotificationsService.saveSettings({ ...settings, domain: window.location.hostname });
            setMessage({ type: 'success', text: 'Keywords saved successfully!' });
            setTimeout(() => setMessage(null), 3000);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to save keywords.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mt-6">
            <h3 className="text-md font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Opt-Out & Opt-In Keywords
            </h3>
            <p className="text-sm text-slate-600 mb-4">
                Define the keywords that will automatically opt contacts in or out of your marketing communications (Broadcasts, Drips, Flows).
            </p>

            {message && (
                <div className={`p-3 mb-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Opt-Out Keywords (Comma separated)</label>
                    <input
                        type="text"
                        disabled={readOnly || saving}
                        placeholder="stop, unsubscribe, cancel, optout"
                        className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:bg-slate-100"
                        value={settings.opt_out_keywords}
                        onChange={(e) => setSettings({ ...settings, opt_out_keywords: e.target.value })}
                    />
                    <p className="text-xs text-slate-500">System Defaults: stop, unsubscribe, cancel, optout</p>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">Opt-In Keywords (Comma separated)</label>
                    <input
                        type="text"
                        disabled={readOnly || saving}
                        placeholder="start, subscribe, resume, optin"
                        className="w-full bg-white border border-slate-300 text-slate-800 p-2.5 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none text-sm disabled:bg-slate-100"
                        value={settings.opt_in_keywords}
                        onChange={(e) => setSettings({ ...settings, opt_in_keywords: e.target.value })}
                    />
                    <p className="text-xs text-slate-500">System Defaults: start, subscribe, resume, optin</p>
                </div>
            </div>

            {!readOnly && (
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Keywords'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default OptInOutKeywords;
