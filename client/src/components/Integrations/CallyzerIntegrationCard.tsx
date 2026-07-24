import React, { useEffect, useState } from 'react';
import { integrationsService } from '../../services/integrationsService';
import { TrashIcon, CheckIcon } from '../icons';

const CallyzerIntegrationCard: React.FC = () => {
    const [baseUrl, setBaseUrl] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [savedKeyMask, setSavedKeyMask] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const config = await integrationsService.getCallyzerConfig();
            if (config && config.apiToken) {
                const k = config.apiToken;
                const mask = k.length > 8 ? k.substring(0, 4) + '...' + k.substring(k.length - 4) : '***';
                setSavedKeyMask(mask);
                setBaseUrl(config.baseUrl || '');
            }
        } catch (e) {
            console.error("Failed to load Callyzer config", e);
        }
    };

    const handleSave = async () => {
        if (!baseUrl || !apiToken) return;
        setIsLoading(true);
        try {
            await integrationsService.saveCallyzerConfig(baseUrl, apiToken);
            const mask = apiToken.length > 8 ? apiToken.substring(0, 4) + '...' + apiToken.substring(apiToken.length - 4) : '***';
            setSavedKeyMask(mask);
            setApiToken('');
            setIsEditing(false);
            setShowForm(false);
            alert('Callyzer Configuration Saved Successfully');
        } catch (e: any) {
            alert(e.message || 'Failed to save Callyzer configuration');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Disconnect Callyzer? Your call logs will no longer be fetched.')) return;
        try {
            await integrationsService.deleteCallyzerConfig();
            setSavedKeyMask(null);
            setBaseUrl('');
            setApiToken('');
            setIsEditing(false);
            setShowForm(false);
        } catch (e) {
            alert('Failed to disconnect');
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm relative overflow-hidden flex flex-col h-full group hover:shadow-md hover:border-orange-200 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {savedKeyMask && (
                    <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${savedKeyMask ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-900'}`}>
                {/* Fallback to a phone icon if we don't have a Callyzer logo */}
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2">Callyzer</h3>
            <p className="text-slate-500 text-sm mb-6 flex-grow">
                Connect Callyzer to automatically sync your team's call logs and recordings.
            </p>

            <div className="mt-auto w-full">
                {savedKeyMask && !isEditing ? (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-2 rounded-lg text-sm font-medium border border-orange-100">
                            <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center">
                                <CheckIcon className="w-3 h-3 text-orange-700" />
                            </div>
                            <span>Connected</span>
                            <span className="ml-auto text-xs opacity-70 font-mono">{savedKeyMask}</span>
                        </div>
                        <button
                            onClick={() => { setIsEditing(true); setShowForm(true); }}
                            className="w-full px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 text-sm transition-colors"
                        >
                            Update Config
                        </button>
                    </div>
                ) : (
                    <>
                        {!showForm ? (
                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-all shadow-md hover:shadow-lg"
                            >
                                Connect
                            </button>
                        ) : (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Base URL</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        placeholder="https://api1.callyzer.co"
                                        value={baseUrl}
                                        onChange={(e) => setBaseUrl(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">API Token</label>
                                    <input
                                        type="password"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        placeholder="Enter API Token..."
                                        value={apiToken}
                                        onChange={(e) => setApiToken(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => { setShowForm(false); setIsEditing(false); }}
                                        className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={isLoading || !baseUrl || !apiToken}
                                        className={`flex-1 px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 text-sm transition-all shadow-md ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                                    >
                                        {isLoading ? 'Saving...' : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CallyzerIntegrationCard;
