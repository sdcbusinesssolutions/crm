import React, { useEffect, useState } from 'react';

const GoogleCallbackPage = () => {
    const [status, setStatus] = useState('Processing...');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (code) {
            // Send back to opener
            if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_AUTH_CODE', code }, window.location.origin);
                setStatus('Success! You can close this window now.');
                setTimeout(() => window.close(), 1500);
            } else {
                setStatus('Error: No opening window found. Please try again.');
            }
        } else if (error) {
            setStatus('Error: ' + error);
        } else {
            setStatus('Invalid callback parameters.');
        }
    }, []);

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
            <div className="text-center p-8 bg-slate-800 rounded-xl border border-slate-700 shadow-xl">
                <div className="text-4xl mb-4">🔐</div>
                <h1 className="text-xl font-bold mb-2">Google Authentication</h1>
                <p className="text-slate-400">{status}</p>
            </div>
        </div>
    );
};

export default GoogleCallbackPage;
