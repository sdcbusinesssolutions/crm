import React, { useState, useEffect } from 'react';
import { integrationsService } from '../../services/integrationsService';

const FacebookIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48px" height="48px">
        <path fill="#1877F2" d="M24,4C12.954,4,4,12.954,4,24c0,9.961,7.209,18.26,16.636,19.742V29.773h-5.008V24h5.008v-4.346 c0-4.939,2.946-7.669,7.436-7.669c2.151,0,4.406,0.18,4.406,0.18v4.839h-2.482c-2.439,0-3.2,1.521-3.2,3.083V24h5.454l-0.872,5.773 h-4.582v13.969C36.791,42.26,44,33.961,44,24C44,12.954,35.046,4,24,4z" />
    </svg>
);

const FacebookLeadAdsCard: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);
    const [connecting, setConnecting] = useState(false);
    const [configId, setConfigId] = useState<string | null>(null);

    const [configError, setConfigError] = useState<string | null>(null);

    useEffect(() => {
        loadStatus();
        initFacebook();
    }, []);

    const initFacebook = async () => {
        const config = await integrationsService.getFacebookConfig();
        if (config && config.appId) {
            // Priority: Hardcoded Lead Config > API (which returns WhatsApp Config)
            // ID: 799224023176669 (User specified for Lead/Page Access)
            const LEAD_CONFIG_ID = '799224023176669';

            // The API returns the WhatsApp config from onboarding_settings, so we override it for this specific component
            const finalConfigId = LEAD_CONFIG_ID;

            setConfigId(finalConfigId);
            console.log('[FacebookCard] Using Config ID:', finalConfigId);

            loadFacebookSdk(config.appId);
        } else {
            console.warn('Facebook App ID not configured via API.');
            setConfigError('Missing FACEBOOK_APP_ID in server environment');
        }
    };

    const loadStatus = async () => {
        try {
            const status = await integrationsService.getFacebookStatus();
            setIsConnected(status.connected);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadFacebookSdk = (appId: string) => {
        if ((window as any).FB) {
            console.log('[FacebookCard] SDK already loaded.');
            return;
        }

        console.log('[FacebookCard] Loading Facebook SDK...');
        (window as any).fbAsyncInit = function () {
            console.log('[FacebookCard] fbAsyncInit called.');
            (window as any).FB.init({
                appId: appId,
                cookie: true,
                xfbml: true,
                version: 'v20.0'
            });
            console.log('[FacebookCard] FB.init completed.');
        };

        const existingScript = document.getElementById('facebook-jssdk');
        if (existingScript) {
            console.log('[FacebookCard] Script tag already exists.');
            return;
        }

        const js = document.createElement('script');
        js.id = 'facebook-jssdk';
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        js.onload = () => console.log('[FacebookCard] SDK Script Loaded successfully.');
        js.onerror = (e) => console.error('[FacebookCard] SDK Script Load Error:', e);

        const fjs = document.getElementsByTagName('script')[0];
        fjs?.parentNode?.insertBefore(js, fjs);
    };

    const waitForFB = async (retries = 10, interval = 500): Promise<boolean> => {
        for (let i = 0; i < retries; i++) {
            if ((window as any).FB) return true;
            console.log(`[FacebookCard] Waiting for FB SDK... (${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, interval));
        }
        return false;
    };

    const handleConnect = async () => {
        if (configError) {
            alert(`Configuration Error: ${configError}. Please check your server .env file.`);
            return;
        }

        console.log('[FacebookCard] Starting Connection Flow...');
        setConnecting(true);

        const isReady = await waitForFB();
        if (!isReady) {
            console.error('[FacebookCard] FB SDK failed to initialize after 5 seconds.');
            alert('Facebook SDK failed to load. This block is likely caused by an Ad Blocker or Network Policy preventing "connect.facebook.net" from loading. Please disable ad blockers for this site and refresh.');
            setConnecting(false);
            return;
        }

        try {
            const loginOptions: any = {
                return_scopes: true,
                auth_type: 'rerequest'
            };

            if (configId) {
                console.log('[FacebookCard] Logging in with Config ID:', configId);
                loginOptions.config_id = configId;
                loginOptions.response_type = 'code';
                loginOptions.override_default_response_type = true;
            } else {
                console.log('[FacebookCard] Logging in with deprecated scopes');
                loginOptions.scope = 'public_profile,email,pages_show_list,leads_retrieval,pages_read_engagement,pages_manage_metadata';
            }

            (window as any).FB.login((response: any) => {
                (async () => {
                    console.log('[FacebookCard] FB.login raw response:', JSON.stringify(response));

                    if (response?.authResponse || response?.code) {

                        // Try to find the code in multiple places
                        const code = response.code || response.authResponse?.code;

                        if (code) {
                            console.log('[FacebookCard] Code received:', code);
                            try {
                                console.log('[FacebookCard] Calling connectFacebook with code...');
                                const result = await integrationsService.connectFacebook(undefined, code);
                                console.log('[FacebookCard] Connected:', result);
                                setIsConnected(true);
                                alert('Connected successfully!');
                            } catch (err: any) {
                                console.error('[FacebookCard] Exchange Failed:', err);
                                alert('Connection failed: ' + (err.message || 'Unknown server error'));
                            }
                        } else {
                            // Legacy Token Flow
                            const token = response.authResponse?.accessToken;
                            console.log('[FacebookCard] Token received:', token);

                            if (!token) {
                                console.error('[FacebookCard] No code and no token found!', response);
                                alert('Facebook Login Error: No access token or code received.');
                                setConnecting(false);
                                return;
                            }

                            try {
                                console.log('[FacebookCard] Calling connectFacebook with token...');
                                const result = await integrationsService.connectFacebook(token);
                                setIsConnected(true);
                                alert('Connected successfully!');
                            } catch (err: any) {
                                console.error('[FacebookCard] Exchange Failed:', err);
                                alert('Connection failed: ' + (err.message || 'Unknown server error'));
                            }
                        }
                    } else {
                        console.warn('[FacebookCard] Login cancelled/failed', response);
                    }
                    setConnecting(false);
                })();
            }, loginOptions);
        } catch (e: any) {
            console.error('[FacebookCard] FB.login Exception:', e);
            setConnecting(false);
            alert('Facebook Login Error: ' + e.message);
        }
    };

    // Manage Modal States
    const [showManageModal, setShowManageModal] = useState(false);
    const [pages, setPages] = useState<any[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string>('');
    const [forms, setForms] = useState<any[]>([]);
    const [selectedFormId, setSelectedFormId] = useState<string>('');
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<any>(null);

    const handleManage = async () => {
        setLoading(true);
        try {
            const fetchedPages = await integrationsService.getFacebookPages();
            setPages(fetchedPages);
            if (fetchedPages.length > 0) {
                // Default to first page if available
                setSelectedPageId(fetchedPages[0].page_id);
            }
            setShowManageModal(true);
        } catch (e) {
            console.error(e);
            alert('Failed to load pages');
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch forms when page selection changes
    useEffect(() => {
        if (!selectedPageId || !showManageModal) return;

        const fetchForms = async () => {
            setForms([]);
            setSelectedFormId('');
            try {
                const fetchedForms = await integrationsService.getLeadForms(selectedPageId);
                setForms(fetchedForms);
                if (fetchedForms.length > 0) {
                    setSelectedFormId(fetchedForms[0].id);
                }
            } catch (e) {
                console.error('Failed to fetch forms', e);
            }
        };

        fetchForms();
    }, [selectedPageId, showManageModal]);

    const handleSync = async () => {
        if (!selectedPageId || !selectedFormId) return;
        setSyncing(true);
        setSyncResult(null);
        try {
            const result = await integrationsService.syncLeads(selectedPageId, selectedFormId);
            setSyncResult(result);
            // alert(`Sync Successful! Found ${result.count} leads.`);
        } catch (e: any) {
            console.error(e);
            alert('Sync Failed: ' + e.message);
        } finally {
            setSyncing(false);
        }
    };

    // Helper to find selected page name
    // const selectedPageName = pages.find(p => p.page_id === selectedPageId)?.page_name || 'Unknown Page';

    // Helper to extract field values from Facebook's field_data array
    const parseLeadData = (lead: any) => {
        const data: any = { created_time: lead.created_time, id: lead.id };
        if (lead.field_data) {
            lead.field_data.forEach((field: any) => {
                data[field.name] = field.values ? field.values[0] : '';
            });
        }
        return data;
    };

    const downloadCsv = () => {
        if (!syncResult || !syncResult.leads) return;

        const leads = syncResult.leads.map(parseLeadData);
        if (leads.length === 0) return;

        // Get headers from first lead (dynamic) or fixed set
        const headers = ['id', 'created_time', 'full_name', 'email', 'phone_number'];
        // Also include any other keys found in the first lead that aren't in standard headers
        const extraKeys = Object.keys(leads[0]).filter(k => !headers.includes(k));
        const allHeaders = [...headers, ...extraKeys];

        const csvContent = [
            allHeaders.join(','),
            ...leads.map((lead: any) => allHeaders.map(header => `"${lead[header] || ''}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `facebook_leads_${selectedFormId}_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col items-start h-full">
                <div className="flex justify-between items-start w-full mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50">
                        <FacebookIcon />
                    </div>
                    {isConnected && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Connected
                        </span>
                    )}
                </div>

                <h3 className="text-lg font-bold text-slate-800 mb-2">Facebook Lead Ads</h3>
                <p className="text-slate-500 text-sm mb-6 flex-grow">
                    Automate lead generation and manage customer inquiries directly from Facebook. Capture leads seamlessly.
                </p>

                <div className="flex gap-3 w-full mt-auto">
                    {isConnected ? (
                        <button
                            onClick={handleManage}
                            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
                            Manage
                        </button>
                    ) : (
                        <button
                            onClick={handleConnect}
                            disabled={connecting}
                            className="flex-1 px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2"
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
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                    </svg>
                                    Connect
                                </>
                            )}
                        </button>
                    )}

                    {isConnected && (
                        <button
                            onClick={handleConnect}
                            className="px-4 py-2 bg-[var(--color-brand)] text-white font-bold rounded-lg hover:opacity-90 transition-colors flex-1">
                            Reconnect
                        </button>
                    )}
                </div>
            </div>

            {/* Manage Modal */}
            {showManageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50 rounded-t-xl">
                            <div>
                                <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">Facebook Lead Ads</h3>
                                <p className="text-sm text-slate-500">Configure and manage your integration</p>
                            </div>
                            <button onClick={() => setShowManageModal(false)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-all">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Page Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">Facebook Page</label>
                                    <div className="relative">
                                        <select
                                            value={selectedPageId}
                                            onChange={(e) => setSelectedPageId(e.target.value)}
                                            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent text-slate-700 font-medium transition-shadow shadow-sm hover:shadow"
                                            disabled={pages.length === 0}
                                        >
                                            {pages.length === 0 && <option value="">No pages found</option>}
                                            {pages.map(page => (
                                                <option key={page.page_id} value={page.page_id}>{page.page_name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                                            <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                </div>

                                {/* Form Selection */}
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">Facebook Form</label>
                                    <div className="relative">
                                        <select
                                            value={selectedFormId}
                                            onChange={(e) => setSelectedFormId(e.target.value)}
                                            className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] focus:border-transparent text-slate-700 font-medium transition-shadow shadow-sm hover:shadow"
                                            disabled={forms.length === 0}
                                        >
                                            {forms.length === 0 ? <option>No forms found</option> : null}
                                            {forms.map(form => (
                                                <option key={form.id} value={form.id}>{form.name}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500">
                                            <svg className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats/Status */}
                            {selectedFormId && (
                                <div className="flex items-center justify-center space-x-6 py-4 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="text-sm font-medium text-slate-600 flex items-center">
                                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                        Total Leads: <span className="ml-1 font-bold text-slate-800">{forms.find(f => f.id === selectedFormId)?.leads_count ?? '-'}</span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-600 flex items-center">
                                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                        Status: <span className="ml-1 font-bold text-slate-800 uppercase">{forms.find(f => f.id === selectedFormId)?.status ?? 'ACTIVE'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Action Button */}
                            <button
                                onClick={handleSync}
                                disabled={syncing || !selectedFormId}
                                className="w-full py-3.5 bg-gradient-to-r from-[#16A34A] to-emerald-600 hover:from-emerald-600 hover:to-[#16A34A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-3 text-lg transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                {syncing ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Syncing Leads...
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Sync Facebook Leads
                                    </>
                                )}
                            </button>

                            {/* Sync Results & Table */}
                            {syncResult && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex justify-between items-center mb-4 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200">
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            <div>
                                                <p className="font-bold">Sync Successful!</p>
                                                <p className="text-sm">Processed {syncResult.count} leads.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={downloadCsv}
                                            className="px-4 py-2 bg-white text-green-700 border border-green-300 font-semibold rounded-lg hover:bg-green-50 transition-colors flex items-center shadow-sm"
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Download CSV
                                        </button>
                                    </div>

                                    {/* Table View */}
                                    {syncResult.leads && syncResult.leads.length > 0 && (
                                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto max-h-[300px]">
                                                <table className="min-w-full divide-y divide-slate-200">
                                                    <thead className="bg-slate-50 sticky top-0">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-slate-200">
                                                        {syncResult.leads.map((lead: any) => {
                                                            const parsed = parseLeadData(lead);
                                                            return (
                                                                <tr key={parsed.id} className="hover:bg-slate-50 transition-colors">
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                                        {new Date(parsed.created_time).toLocaleDateString()}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                                                        {parsed.full_name || parsed['Full Name'] || '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                                        {parsed.email || parsed['work_email'] || parsed['Email'] || '-'}
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                                        {parsed.phone_number || parsed['phone'] || parsed['Phone'] || '-'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

class MockErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }

    componentDidCatch(error: any, errorInfo: any) {
        console.error("FacebookCard Crash:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                    <h3 className="font-bold">Component Error</h3>
                    <p>{this.state.error?.message || 'Unknown error'}</p>
                </div>
            );
        }

        return this.props.children;
    }
}

export default function WrappedFacebookCard() {
    return (
        <MockErrorBoundary>
            <FacebookLeadAdsCard />
        </MockErrorBoundary>
    );
}
