
import React, { useEffect, useState } from 'react';

const AuthBridge: React.FC = () => {
    const [status, setStatus] = useState('Initializing...');
    const [error, setError] = useState<string | null>(null);

    // Parse query params
    const searchParams = new URLSearchParams(window.location.search);
    const appId = searchParams.get('app_id');
    const configId = searchParams.get('config_id');
    const origin = searchParams.get('origin');
    const state = searchParams.get('state') || '';
    const isCoexistence = searchParams.get('is_coexistence') === 'true';

    const logToServer = async (level: string, message: string, details?: any) => {
        try {
            // Fire and forget log
            fetch('/api/client-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level, message, details, timestamp: new Date().toISOString() })
            }).catch(e => console.error('Log failed', e));
        } catch (e) { }
    };

    useEffect(() => {
        if (!appId || !configId) {
            const err = 'Missing configuration parameters (app_id or config_id).';
            setError(err);
            logToServer('ERROR', 'Initialization Failed', { appId, configId, error: err });
            return;
        }

        // Load Facebook SDK
        logToServer('INFO', 'Loading Facebook SDK', { appId });
        loadFacebookSdk(appId);
    }, [appId, configId]);

    const loadFacebookSdk = (appId: string) => {
        if ((window as any).FB) {
            initFacebook(appId);
            return;
        }

        (window as any).fbAsyncInit = function () {
            initFacebook(appId);
        };

        (function (d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) { return; }
            js = d.createElement(s) as HTMLScriptElement; js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode?.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    };

    const initFacebook = (appId: string) => {
        logToServer('INFO', 'Initializing FB SDK');
        (window as any).FB.init({
            appId: appId,
            cookie: true,
            xfbml: true,
            version: 'v20.0'
        });
        setStatus('Ready to connect.');
        // Auto-redirect removed to prevent popup blocking.
        // User must click "Continue with Facebook".
    };

    const handleLogin = () => {
        if (!configId) return;

        console.log('Starting FB Login flow on Bridge...');
        logToServer('INFO', 'Starting FB Login Flow');
        setStatus('Redirecting to Facebook...');

        (window as any).FB.login((response: any) => {
            console.log('Bridge FB Response:', response);
            if (response.authResponse) {
                const code = response.authResponse.code;
                logToServer('SUCCESS', 'FB Login Successful', { codePrefix: code?.substring(0, 5) });
                sendBack(code);
            } else {
                setStatus('User cancelled login.');
                logToServer('WARN', 'User Cancelled Login', { response });
                console.log('User cancelled login or did not fully authorize.');
            }
        }, {
            config_id: configId,
            response_type: 'code',
            override_default_response_type: true,
            extras: isCoexistence ? {
                setup: {},
                featureType: 'whatsapp_business_app_onboarding',
                sessionInfoVersion: '3'
            } : undefined
        });
    };

    const sendBack = (code: string) => {
        if (!window.opener) {
            const err = 'Error: No parent window found.';
            setStatus(err);
            logToServer('ERROR', 'No Parent Window', { origin: window.location.origin });
            return;
        }

        const message = {
            type: 'WA_BRIDGE_CODE',
            code: code,
            state: state
        };

        logToServer('INFO', 'Sending Code to Parent', { targetOrigin: origin || '*' });

        // We use '*' to allow the child to send to the parent even if domains differ.
        // In a strict environment, we should validation 'origin' param matches trusted list.
        // For white-labeling, we trust whom we opened.
        if (origin) {
            window.opener.postMessage(message, origin);
        } else {
            window.opener.postMessage(message, '*');
        }

        setStatus('Success! Redirecting you back...');
        setTimeout(() => {
            window.close();
        }, 1500);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center font-sans">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="white">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                </div>

                <h2 className="text-xl font-bold text-slate-800 mb-2">Connect WhatsApp</h2>
                <p className="text-slate-500 mb-8 text-sm">
                    Click the button below to securely connect your WhatsApp Business Account.
                </p>

                {error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm mb-4">
                        {error}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center w-full">
                        <button
                            onClick={handleLogin}
                            className="w-full px-6 py-3 bg-[#1877F2] text-white font-bold rounded-lg shadow-md hover:bg-[#166fe5] transition-colors flex items-center justify-center gap-3"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.791-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            Continue with Facebook
                        </button>
                        <p className="text-xs text-slate-400 mt-4">
                            Click above to open the secure login window.
                        </p>
                    </div>
                )}
            </div>
            <p className="mt-8 text-xs text-slate-400">
                Secure Bridge • {window.location.hostname}
            </p>
        </div>
    );
};

export default AuthBridge;
