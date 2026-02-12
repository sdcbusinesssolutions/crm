import React, { useEffect, useState } from 'react';
import { integrationsService } from '../../services/integrationsService';
import { OpenAIIcon, TrashIcon, CheckIcon } from '../icons';

const OpenAIIntegrationCard: React.FC = () => {
    const [apiKey, setApiKey] = useState('');
    const [apiName, setApiName] = useState('');
    const [savedKeyMask, setSavedKeyMask] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showForm, setShowForm] = useState(false);

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
            await integrationsService.saveOpenAIConfig(apiKey, apiName);
            setSavedKeyMask(apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 4));
            setApiKey('');
            setApiName('');
            setIsEditing(false);
            setShowForm(false);
            alert('OpenAI Key Saved Successfully');
        } catch (e: any) {
            alert(e.message || 'Failed to save API Key');
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
            setShowForm(false);
        } catch (e) {
            alert('Failed to disconnect');
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col h-full group hover:shadow-md transition-shadow">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                {savedKeyMask && (
                    <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-lg transition-colors">
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Icon Container: keeping it dark as per screenshot preference often seen for OpenAI, or match general style. 
                User asked: "this is open ai icon use" and provided black icon on white/transparent background.
                Facebook uses: bg-slate-50 (neutral?). Wait, line 311 in FB card is bg-slate-50.
                Google uses: bg-green-100 text-green-600.
                Let's use a black container for OpenAI to be distinct, or white if plain. 
                Actually, Facebook is plain slate-50.
                Let's try a dark container for OpenAI to make the white icon pop, OR a neutral container with black icon.
                The uploaded image 0 shows black icon. So background should be light.
            */}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${savedKeyMask ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-900'}`}>
                <img src="/assets/openai.png" alt="OpenAI" className="w-8 h-8 object-contain" />
            </div>

            <h3 className="text-lg font-bold text-slate-800 mb-2">OpenAI</h3>
            <p className="text-slate-500 text-sm mb-6 flex-grow">
                Connect your OpenAI account to power AI Agents and auto-responses.
            </p>

            <div className="mt-auto w-full">
                {savedKeyMask && !isEditing ? (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-100">
                            <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center">
                                <CheckIcon className="w-3 h-3 text-emerald-700" />
                            </div>
                            <span>Connected</span>
                            <span className="ml-auto text-xs opacity-70 font-mono">{savedKeyMask}</span>
                        </div>
                        <button
                            onClick={() => { setIsEditing(true); setShowForm(true); }}
                            className="w-full px-4 py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 text-sm transition-colors"
                        >
                            Update Key
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
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">API Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        placeholder="My OpenAI Key"
                                        value={apiName}
                                        onChange={(e) => setApiName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">API Secret Key</label>
                                    <input
                                        type="password"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-brand)] outline-none"
                                        placeholder="sk-..."
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
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
                                        disabled={isLoading || !apiKey}
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

export default OpenAIIntegrationCard;
