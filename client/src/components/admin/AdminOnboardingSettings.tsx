import React, { useState, useEffect } from 'react';
import { adminSettingsService } from '../../services/adminSettingsService';

const AdminOnboardingSettings = () => {
    const [manualEnabled, setManualEnabled] = useState(false);
    const [embeddedEnabled, setEmbeddedEnabled] = useState(false);

    // Config for Embedded
    const [signupConfig, setSignupConfig] = useState({
        appId: '',
        appSecret: '',
        configId: ''
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await adminSettingsService.getOnboardingSettings();
            if (data) {
                setManualEnabled(data.manual_enabled || false);
                setEmbeddedEnabled(data.embedded_enabled || false);
                setSignupConfig({
                    appId: data.embedded_app_id || '',
                    appSecret: data.embedded_app_secret || '',
                    configId: data.embedded_config_id || ''
                });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            showMessage('Failed to load current settings.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await adminSettingsService.saveOnboardingSettings({
                manual_enabled: manualEnabled,
                embedded_enabled: embeddedEnabled,
                embedded_app_id: signupConfig.appId,
                embedded_app_secret: signupConfig.appSecret,
                embedded_config_id: signupConfig.configId
            });
            showMessage('Onboarding settings saved successfully.', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            showMessage('Failed to save settings. Please try again.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const showMessage = (text: string, type: 'success' | 'error') => {
        setMessage({ text, type });
        setTimeout(() => setMessage(null), 3000);
    };

    const Toggle = ({ checked, onChange, label }: { checked: boolean, onChange: (val: boolean) => void, label: string }) => (
        <div className="flex items-center justify-between py-2">
            <span className="text-sm font-semibold text-gray-700">{label}</span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer 
                                peer-checked:after:translate-x-full peer-checked:after:border-white 
                                after:content-[''] after:absolute after:top-[2px] after:left-[2px] 
                                after:bg-white after:border-gray-300 after:border after:rounded-full 
                                after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--primary-color)]"></div>
            </label>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="w-8 h-8 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto animate-fade-in pb-10">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Onboarding Configuration</h2>
                    <p className="text-gray-500 text-sm mt-1">Configure how new users connect their WhatsApp accounts.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-6 py-2.5 bg-[#00A884] hover:bg-[#008f6f] text-white rounded-lg text-sm font-bold shadow-lg shadow-green-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSaving ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Saving...
                        </>
                    ) : (
                        'Save Changes'
                    )}
                </button>
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    } animate-slide-in`}>
                    <span className="text-lg">{message.type === 'success' ? '✅' : '⚠️'}</span>
                    <span className="font-medium text-sm">{message.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">

                {/* Manual Onboarding Card */}
                <div className={`relative group transition-all duration-300 rounded-2xl border p-6 bg-white overflow-hidden
                    ${manualEnabled ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)] shadow-md' : 'border-gray-200 hover:border-gray-300 shadow-sm'}
                `}>
                    <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors
                                ${manualEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}
                             `}>
                                📝
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Manual Onboarding</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                                    Allow users to manually enter their Phone ID and Access Token. Useful for custom setups or developers.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <Toggle checked={manualEnabled} onChange={setManualEnabled} label={manualEnabled ? 'Active' : 'Disabled'} />
                        </div>
                    </div>
                </div>

                {/* Embedded Signup Card */}
                <div className={`relative group transition-all duration-300 rounded-2xl border p-6 bg-white overflow-hidden
                    ${embeddedEnabled ? 'border-blue-500 ring-1 ring-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300 shadow-sm'}
                `}>
                    {/* Header */}
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-colors
                                ${embeddedEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}
                             `}>
                                🚀
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Embedded Signup (FBS)</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-md">
                                    The "Log in with Facebook" flow. Automatically creates WABA and retrieves tokens. Requires a verified Meta App.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center">
                            <Toggle checked={embeddedEnabled} onChange={setEmbeddedEnabled} label={embeddedEnabled ? 'Active' : 'Disabled'} />
                        </div>
                    </div>

                    {/* Configuration Form (Collapsible) */}
                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${embeddedEnabled ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-50'}`}>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Meta App ID</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1234567890"
                                        value={signupConfig.appId}
                                        onChange={(e) => setSignupConfig({ ...signupConfig, appId: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Config ID</label>
                                    <input
                                        type="text"
                                        placeholder="Obtained from Developer Portal"
                                        value={signupConfig.configId}
                                        onChange={(e) => setSignupConfig({ ...signupConfig, configId: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 font-mono text-sm"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">App Secret</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="••••••••••••••••••••••••"
                                        value={signupConfig.appSecret}
                                        onChange={(e) => setSignupConfig({ ...signupConfig, appSecret: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300 font-mono text-sm"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 text-right">Never share your App Secret.</p>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default AdminOnboardingSettings;
