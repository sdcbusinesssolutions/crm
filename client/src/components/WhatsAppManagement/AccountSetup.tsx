import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';
import { AppConfig } from '../../AppConfig';

/* eslint-disable no-undef */

interface WhatsAppAccount {
    id?: string;
    name: string;
    phone_number: string;
    phone_number_id: string;
    whatsapp_business_account_id: string;
    meta_app_id: string;
    meta_access_token: string;
}

const AccountSetup: React.FC = () => {
    const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<WhatsAppAccount | null>(null);
    const [formData, setFormData] = useState<WhatsAppAccount>({
        name: '',
        phone_number: '',
        phone_number_id: '',
        whatsapp_business_account_id: '',
        meta_app_id: '',
        meta_access_token: ''
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Embedded Signup State
    const [embeddedConfig, setEmbeddedConfig] = useState<{ appId: string, configId: string, isCustom?: boolean, bridgeDomain?: string } | null>(null);
    const [configError, setConfigError] = useState<string | null>(null);
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [isCoexistenceEnabled, setIsCoexistenceEnabled] = useState(false); // Coexistence Mode toggle

    useEffect(() => {
        loadAccounts();
        loadEmbeddedConfig();
    }, []);

    const loadAccounts = async () => {
        try {
            const data = await settingsService.getWhatsAppConfig();
            setAccounts(Array.isArray(data) ? data : (data && data.phone_number ? [data] : []));
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to load accounts' });
        } finally {
            setLoading(false);
        }
    };

    const loadEmbeddedConfig = async () => {
        try {
            setConfigError(null);
            const data = await settingsService.getEmbeddedSignupConfig();
            console.log('Embedded Config Loaded:', data);
            setEmbeddedConfig(data);

        } catch (error: any) {
            console.error('Failed to load embedded signup config', error);
            const msg = error.message || '';
            // Suppress "Disabled" error from UI
            if (msg.includes('Embedded signup is disabled')) {
                return;
            }
            setConfigError(msg || 'Failed to load configuration');
        }
    };



    // We need a separate message listener for the "WhatsApp Onboarding" events if they come via window message?
    // Actually, the FB.login callback handles the initial auth.
    // BUT, the WhatsApp selection (Phone number selection) keeps happening inside the popup.
    // When the user finishes, the popup closes and returns data?
    // According to Meta Docs:
    // The `response` object in the callback will contain `code`.
    // BUT we ALSO need the `waba_id` and `phone_number_id` which might come from a separate event like `message` event from the popup 
    // OR we have to fetch them using the token.
    // The PHP reference: receives `waba_id`, `phone_number_id` AND `code` in the `$request`.
    // So the Frontend MUST be gathering this.
    // 
    // The "FBS" (Facebook Business Extension) flow sends a `message` event to the opener.
    // Let's add a listener for that.

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            try {
                const data = event.data;
                if (!data) return;

                if (data.type === 'WA_BRIDGE_CODE') {
                    const { code, wabaId, phoneId } = data;
                    console.log('Received Code and IDs from Auth Bridge:', { code: '***', wabaId, phoneId });
                    registerEmbeddedAccount(code, wabaId, phoneId);
                }
            } catch (e) { }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const launchFacebookSignup = () => {
        if (!embeddedConfig) {
            console.error('Embedded config missing');
            return;
        }

        // Determine Bridge Domain based on Configuration Type
        // If Custom (User provided own ID), use own domain (window.location.origin)
        // If System (Provider), use the configured bridge domain (or default to cloudospire.in)
        const SYSTEM_BRIDGE_DOMAIN = embeddedConfig.bridgeDomain || AppConfig.VITE_BRIDGE_DOMAIN;
        const BRIDGE_DOMAIN = embeddedConfig.isCustom ? window.location.origin : SYSTEM_BRIDGE_DOMAIN;

        const bridgeUrl = new URL(`${BRIDGE_DOMAIN}/waba_auth_bridge`);

        bridgeUrl.searchParams.append('app_id', embeddedConfig.appId);
        bridgeUrl.searchParams.append('config_id', embeddedConfig.configId);
        bridgeUrl.searchParams.append('origin', window.location.origin);
        bridgeUrl.searchParams.append('is_coexistence', isCoexistenceEnabled ? 'true' : 'false');

        // Center the popup
        const width = 600;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        window.open(
            bridgeUrl.toString(),
            'WaAuthBridge',
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=no,resizable=yes`
        );
    };

    const handleFacebookLogin = () => {
        console.log('Connect with Facebook clicked.');
        launchFacebookSignup();
    };

    const registerEmbeddedAccount = async (code: string, wabaId?: string, phoneId?: string) => {
        setSaving(true);
        setMessage(null);
        try {
            await settingsService.connectEmbeddedAccount(code, wabaId || 'auto_detect', phoneId || 'auto_detect');
            setMessage({ type: 'success', text: 'Connected successfully!' });
            loadAccounts();
        } catch (error: any) {
            console.error('Embedded Signup Error:', error);
            setMessage({ type: 'error', text: error.message || 'Failed to connect.' });
        } finally {
            setSaving(false);
        }
    };


    const handleOpenModal = (account?: WhatsAppAccount) => {
        if (account) {
            setEditingAccount(account);
            setFormData(account);
        } else {
            setEditingAccount(null);
            setFormData({
                name: '',
                phone_number: '',
                phone_number_id: '',
                whatsapp_business_account_id: '',
                meta_app_id: '',
                meta_access_token: ''
            });
        }
        setMessage(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingAccount(null);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);
        try {
            if (editingAccount && editingAccount.id) {
                await settingsService.updateWhatsAppConfig(editingAccount.id, formData);
                setMessage({ type: 'success', text: 'Account updated successfully' });
            } else {
                await settingsService.saveWhatsAppConfig(formData);
                setMessage({ type: 'success', text: 'Account added successfully' });
            }
            await loadAccounts();
            handleCloseModal();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to save account' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this account?')) return;
        try {
            await settingsService.deleteWhatsAppConfig(id);
            setMessage({ type: 'success', text: 'Account deleted successfully' });
            loadAccounts();
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to delete account' });
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading accounts...</div>;

    return (
        <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-800">WhatsApp Accounts</h2>
                <button
                    onClick={() => handleOpenModal()}
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Account
                </button>
            </div>

            {/* Config Error Alert */}
            {configError && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                        <h4 className="font-bold">Setup Error</h4>
                        <p className="text-sm">{configError}</p>
                    </div>
                </div>
            )}

            {/* Embedded Signup Banner */}
            {embeddedConfig && (
                <div className="mb-8 p-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold mb-1">Connect with Facebook</h3>
                        <p className="text-blue-100 text-sm max-w-lg">
                            The easiest way to connect your WhatsApp Business Account. We'll automatically fetch your phone numbers and keys.
                        </p>
                        <div className="flex items-center gap-2 mt-4">
                            <input
                                type="checkbox"
                                id="coexistToggle"
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-100 cursor-pointer"
                                checked={isCoexistenceEnabled}
                                onChange={(e) => setIsCoexistenceEnabled(e.target.checked)}
                            />
                            <label htmlFor="coexistToggle" className="text-sm font-medium text-white/90 cursor-pointer hover:text-white">
                                Use existing WhatsApp Business App number (Coexistence Mode)
                            </label>
                        </div>
                    </div>
                    <button
                        onClick={handleFacebookLogin}
                        className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg shadow-md hover:bg-blue-50 transition-all flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                        Connect with Facebook
                    </button>
                </div>
            )}

            {message && (
                <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            {accounts.length === 0 ? (
                <div className="text-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <p className="text-slate-500">No WhatsApp accounts connected yet.</p>
                    <div className="flex gap-4 justify-center mt-4">
                        {embeddedConfig && (
                            <button onClick={handleFacebookLogin} className="text-blue-600 font-medium hover:underline">Connect with Facebook</button>
                        )}
                        <span className="text-slate-300">|</span>
                        <button onClick={() => handleOpenModal()} className="text-brand-600 font-medium hover:underline">Connect Manually</button>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {accounts.map((account) => (
                        <div key={account.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                            <div>
                                <h3 className="font-semibold text-slate-800">{account.name || 'WhatsApp Account'}</h3>
                                <p className="text-sm text-slate-500">{account.phone_number}</p>
                                <p className="text-xs text-slate-400 mt-1">ID: {account.phone_number_id}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenModal(account)}
                                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => account.id && handleDelete(account.id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">
                                {editingAccount ? 'Edit Account' : 'Add New Account'}
                            </h3>
                            <button onClick={handleCloseModal} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Account Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                    placeholder="e.g. Marketing Number"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                                    <input
                                        type="text"
                                        name="phone_number"
                                        value={formData.phone_number}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="+1234567890"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number ID</label>
                                    <input
                                        type="text"
                                        name="phone_number_id"
                                        value={formData.phone_number_id}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="Enter Phone Number ID"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">WABA ID</label>
                                    <input
                                        type="text"
                                        name="whatsapp_business_account_id"
                                        value={formData.whatsapp_business_account_id}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="Enter WABA ID"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Meta App ID</label>
                                    <input
                                        type="text"
                                        name="meta_app_id"
                                        value={formData.meta_app_id}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none"
                                        placeholder="Enter Meta App ID"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Meta Access Token</label>
                                <input
                                    type="password"
                                    name="meta_access_token"
                                    value={formData.meta_access_token}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none font-mono text-sm"
                                    placeholder="EAAG..."
                                    required
                                />
                                <p className="mt-1 text-xs text-slate-500">Permanent access token from Meta Business Manager.</p>
                            </div>

                            <div className="flex justify-end pt-4 gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={`px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    {saving ? 'Saving...' : (editingAccount ? 'Update Account' : 'Add Account')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountSetup;
