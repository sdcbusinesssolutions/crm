import React, { useEffect, useState } from 'react';
import { integrationsService } from '../../services/integrationsService';
import { RobotIcon, GmailIcon, TrashIcon } from '../icons';

const OpenAIIntegrationCard: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [savedKeyMask, setSavedKeyMask] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            // Check if key exists (We won't get the full key back for security normally, but for MVP we might or just a mask)
            const config = await integrationsService.getOpenAIConfig();
            if (config && config.apiKey) {
                // Mask it: sk-....XyZ
                const k = config.apiKey;
                const mask = k.substring(0, 3) + '...' + k.substring(k.length - 4);
                setSavedKeyMask(mask);
            }
        } catch (e) {
            console.error("Failed to load OpenAI config", e);
        }
    };

    const handleSave = async () => {
        if (!apiKey) return;
        setIsLoading(true);
        try {
            await integrationsService.saveOpenAIConfig(apiKey);
            setSavedKeyMask(apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4));
            setApiKey('');
            setIsEditing(false);
            alert('OpenAI Key Saved Successfully');
        } catch (e) {
            alert('Failed to save API Key');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Disconnect OpenAI? Agents will stop working.')) return;
        try {
            await integrationsService.deleteOpenAIConfig();
            setSavedKeyMask(null);
            setIsEditing(false);
        } catch (e) {
            alert('Failed to disconnect');
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col h-full group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {savedKeyMask && (
                    <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${savedKeyMask ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                <RobotIcon className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-1">OpenAI</h3>
            <p className="text-slate-500 text-sm mb-4 flex-grow">
                Connect your OpenAI account to power AI Agents and auto-responses.
            </p>

            <div className="mt-auto">
                {savedKeyMask && !isEditing ? (
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-100">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span>Connected</span>
                            <span className="ml-auto text-xs opacity-70 font-mono">{savedKeyMask}</span>
                        </div>
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-full px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 text-sm transition-colors"
                        >
                            Update Key
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <input
                            type="password"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                            placeholder="sk-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                        />
                        <div className="flex gap-2">
                            {isEditing && (
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 text-sm"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={isLoading || !apiKey}
                                className={`flex-1 px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 text-sm transition-all shadow-lg shadow-slate-200 ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                            >
                                {isLoading ? 'Saving...' : 'Connect'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OpenAIIntegrationCard;
