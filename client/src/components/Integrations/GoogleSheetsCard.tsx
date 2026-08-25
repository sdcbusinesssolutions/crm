import React, { useState, useEffect } from 'react';
import { integrationsService } from '../../services/integrationsService';
import Modal from '../Modal';
import VideoGuideButton from '../VideoGuideButton';

const GoogleSheetsIcon = () => (
    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600 font-bold text-xl">
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" /></svg>
    </div>
);

const GoogleSheetsCard: React.FC = () => {
    const [connections, setConnections] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);

    // Auth Modal State
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMethod, setAuthMethod] = useState<'oauth' | 'service_account'>('oauth');
    const [connectionName, setConnectionName] = useState('');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [serviceAccountJson, setServiceAccountJson] = useState('');

    // Notification State
    const [notification, setNotification] = useState<{ isOpen: boolean, title: string, message: string, type: 'success' | 'error' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    // Computed Redirect URL
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/google-callback` : '';

    useEffect(() => {
        loadConnections();
    }, []);

    const showNotification = (title: string, message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ isOpen: true, title, message, type });
    };

    const loadConnections = async () => {
        try {
            const data = await integrationsService.getGoogleConnections();
            setConnections(data);
        } catch (e) {
            console.error('Failed to load Google connections', e);
        } finally {
            setLoading(false);
        }
    };

    const initiateAuth = async () => {
        if (!connectionName) {
            showNotification('Validation Error', 'Please provide a Connection Name.', 'error');
            return;
        }

        setConnecting(true);

        // --- OPTION A: SERVICE ACCOUNT JSON ---
        if (authMethod === 'service_account') {
            try {
                if (!serviceAccountJson) throw new Error('Please paste your Service Account JSON.');

                // Validate JSON
                let saCreds;
                try {
                    saCreds = JSON.parse(serviceAccountJson);
                } catch (e) {
                    throw new Error('Invalid JSON format.');
                }

                if (!saCreds.private_key || !saCreds.client_email) {
                    throw new Error('Invalid Service Account JSON. Missing private_key or client_email.');
                }

                // Send to Backend directly
                // We re-use the exchange endpoint or create a new one? 
                // Let's modify the service to accept direct credentials save or handle it via a new call.
                // Or easier: Just save it directly via integrationsService if we add a method, 
                // OR hook into "exchange" with a special flag.

                // Let's assume we add a simplified save method or piggyback.
                // Piggybacking on `exchangeGoogleCode` might be confusing.
                // Let's just create a new specialized API call in integrationsService for Manual JSON.

                await integrationsService.saveServiceAccount({
                    connectionName,
                    credentials: saCreds
                });

                setShowAuthModal(false);
                setConnectionName('');
                setServiceAccountJson('');
                await loadConnections();
                showNotification('Success', 'Service Account Connected!', 'success');
                setConnecting(false);

            } catch (e: any) {
                showNotification('Connection Failed', e.message, 'error');
                setConnecting(false);
            }
            return;
        }

        // --- OPTION B: OAUTH2 ---
        if (!clientId || !clientSecret) {
            showNotification('Validation Error', 'Please fill in Client ID and Client Secret.', 'error');
            setConnecting(false);
            return;
        }

        try {
            // 1. Get Auth URL with custom Client ID
            const { url } = await integrationsService.getGoogleAuthUrl(clientId, redirectUrl);

            // 2. Open Popup
            const width = 500;
            const height = 600;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            const popup = window.open(
                url,
                'Google Auth',
                `width=${width},height=${height},top=${top},left=${left}`
            );

            // 3. Poll for Code
            const checkPopup = setInterval(async () => {
                if (!popup || popup.closed) {
                    clearInterval(checkPopup);
                    setConnecting(false);
                    return;
                }

                try {
                    const currentUrl = popup.location.href;
                    // Check if redirect has happened to our origin
                    if (currentUrl.startsWith(redirectUrl)) {
                        const urlParams = new URL(currentUrl).searchParams;
                        const code = urlParams.get('code');

                        if (code) {
                            clearInterval(checkPopup);
                            popup.close();

                            // 4. Exchange Code (Pass secrets to backend)
                            await integrationsService.exchangeGoogleCode({
                                code,
                                clientId,
                                clientSecret,
                                redirectUrl,
                                connectionName
                            });

                            setShowAuthModal(false);
                            setConnectionName('');
                            setClientId('');
                            setClientSecret('');

                            await loadConnections();
                            showNotification('Success', 'Google Account Connected Successfully!', 'success');
                            setConnecting(false); // Ensure this is reset!
                        }
                    }
                } catch (e) {
                    // Cross-origin errors are expected until redirect happens
                }
            }, 500);

        } catch (e: any) {
            console.error('Connect error:', e);
            if (e.message && (e.message.includes('Unauthorized') || e.message.includes('session'))) {
                showNotification('Session Expired', 'Your session has expired. Please refresh the page and log in again.', 'error');
            } else {
                showNotification('Connection Failed', 'Failed to start connection: ' + e.message, 'error');
            }
            setConnecting(false);
        }
    };

    const handleDelete = async (id: string) => {
        // Since we are moving away from confirm(), maybe use a small confirm modal or just simple notification logic
        // For now, let's just do it with a notification check or a direct action if we want to be fancy.
        // But native confirm is still often used for destructive actions. 
        // Let's stick to native confirm for DELETION to avoid complexity, or skip it.
        // User asked for "success or error popup" to align. Deletion confirmation is a pre-action check.

        if (!confirm('Are you sure you want to disconnect this account?')) return;

        try {
            await integrationsService.deleteGoogleConnection(id);
            await loadConnections();
            showNotification('Disconnected', 'Account removed successfully.', 'success');
        } catch (e: any) {
            showNotification('Error', 'Failed to disconnect: ' + e.message, 'error');
        }
    };

    return (
        <>
            <div className="bg-white p-6 rounded-2xl border-2 border-green-100 shadow-sm hover:shadow-md hover:border-green-300 transition-all flex flex-col items-start h-full">
                <div className="flex justify-between items-start w-full mb-4">
                    <GoogleSheetsIcon />
                    {connections.length > 0 && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            {connections.length} Connected
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-800">Google Sheets</h3>
                    <VideoGuideButton moduleName="Google Sheets Integration" label="VIEW" className="!bg-red-600 hover:!bg-red-700 !text-white !rounded-full !text-[10px] animate-pulse shadow-md hover:shadow-lg" />
                </div>
                <p className="text-slate-500 text-sm mb-6 flex-grow">
                    Connect your Google accounts to read and write data to Sheets directly from your flows.
                </p>

                <div className="flex gap-3 w-full mt-auto">
                    {connections.length > 0 ? (
                        <>
                            <button
                                onClick={() => setShowManageModal(true)}
                                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Manage
                            </button>
                            <button
                                onClick={() => setShowAuthModal(true)}
                                disabled={connecting}
                                className="flex-1 px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                            >
                                {connecting ? '...' : 'Add New'}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            disabled={connecting}
                            className="w-full px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2"
                        >
                            {connecting ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Connecting...
                                </>
                            ) : (
                                'Connect'
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Manage Modal - Using Themed Modal Component */}
            <Modal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                title="Google Sheets Connections"
                size="lg"
                footer={
                    <button
                        onClick={() => {
                            setShowManageModal(false);
                            setShowAuthModal(true);
                        }}
                        className="w-full py-3 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:shadow-md hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Add New Connection
                    </button>
                }
            >
                <div className="space-y-4">
                    {connections.map(conn => (
                        <div key={conn.id} className="flex items-center justify-between p-4 border border-[var(--color-border)] rounded-lg hover:bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                                    {conn.connection_name?.[0]?.toUpperCase() || 'G'}
                                </div>
                                <div>
                                    <p className="font-bold text-[var(--color-text)]">{conn.connection_name}</p>
                                    <p className="text-xs text-slate-400">Connected: {new Date(conn.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(conn.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Disconnect
                            </button>
                        </div>
                    ))}

                    {connections.length === 0 && !loading && (
                        <div className="text-center py-8 text-slate-500 italic">
                            No Google accounts connected yet.
                        </div>
                    )}
                </div>
            </Modal>

            {/* Auth Modal - Using Themed Modal Component */}
            <Modal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                title="Add Google Connection"
                size="md"
                footer={
                    <>
                        <button
                            onClick={() => setShowAuthModal(false)}
                            disabled={connecting}
                            className="px-4 py-2 text-[var(--color-text)] hover:opacity-80 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={initiateAuth}
                            disabled={connecting}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:opacity-90 flex items-center gap-2"
                        >
                            {connecting ? 'Connecting...' : (authMethod === 'oauth' ? 'Connect Google Account' : 'Save Service Account')}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800 mb-4">
                        <p className="font-bold mb-1">Configuration Required:</p>
                        <p>Please add this <strong>Authorized Redirect URI</strong> to your Google Cloud Console project:</p>
                        <div className="mt-2 bg-white p-2 rounded border border-blue-200 font-mono text-xs break-all select-all cursor-text">
                            {redirectUrl}
                        </div>
                    </div>

                    {/* Auth Method Toggle */}
                    <div className="flex border-b border-slate-200 mb-4">
                        <button
                            className={`flex-1 pb-2 text-sm font-bold ${authMethod === 'oauth' ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]' : 'text-slate-500'}`}
                            onClick={() => setAuthMethod('oauth')}
                        >
                            OAuth2 (Client ID)
                        </button>
                        <button
                            className={`flex-1 pb-2 text-sm font-bold ${authMethod === 'service_account' ? 'text-[var(--color-brand)] border-b-2 border-[var(--color-brand)]' : 'text-slate-500'}`}
                            onClick={() => setAuthMethod('service_account')}
                        >
                            Service Account (Bot)
                        </button>
                    </div>

                    {authMethod === 'service_account' && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-xs text-slate-600">
                            <p className="font-bold text-slate-800 mb-2">How to use Service Account (Recommended for Stability):</p>
                            <ol className="list-decimal pl-4 space-y-1.5">
                                <li>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a>.</li>
                                <li>Create a Service Account, go to <b>Keys</b> tab, and download a <b>JSON</b> key.</li>
                                <li>Paste the JSON content below.</li>
                                <li className="text-amber-700 font-bold border-l-2 border-amber-500 pl-2">
                                    CRITICAL: Open your Google Sheet, click 'Share', and add the <code>client_email</code> from your JSON file as an Editor.
                                </li>
                            </ol>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">
                            Connection Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none"
                            placeholder="e.g. My Sheet Integration"
                            value={connectionName}
                            onChange={e => setConnectionName(e.target.value)}
                        />
                    </div>

                    {authMethod === 'oauth' ? (
                        <>
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Google Client ID</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none"
                                    placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
                                    value={clientId}
                                    onChange={e => setClientId(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Google Client Secret</label>
                                <input
                                    type="password"
                                    className="w-full px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none"
                                    placeholder="GOCSPX-xxxxxxxxxxxx"
                                    value={clientSecret}
                                    onChange={e => setClientSecret(e.target.value)}
                                />
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Service Account JSON</label>
                            <textarea
                                className="w-full h-32 px-3 py-2 border border-[var(--color-border)] bg-[var(--color-input-bg)] rounded-lg focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent outline-none text-xs font-mono"
                                placeholder={`{ "type": "service_account", "project_id": "...", ... }`}
                                value={serviceAccountJson}
                                onChange={e => setServiceAccountJson(e.target.value)}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                                Paste the entire content of your JSON key file.
                            </p>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Notification Modal */}
            <Modal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                title={notification.title}
                size="sm"
                footer={
                    <button
                        onClick={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                        className="px-6 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg shadow hover:opacity-90"
                    >
                        OK
                    </button>
                }
            >
                <div className="flex flex-col items-center justify-center p-4 text-center">
                    {notification.type === 'success' && (
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                    )}
                    {notification.type === 'error' && (
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                    )}
                    <p className="text-[var(--color-text)]">{notification.message}</p>
                </div>
            </Modal>
        </>
    );
};

export default GoogleSheetsCard;
