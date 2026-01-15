import React, { useEffect, useState } from 'react';

const AuthCentralCallback: React.FC = () => {
    const [status, setStatus] = useState('Processing secure redirect...');

    useEffect(() => {
        const handleRedirect = () => {
            // 1. Get the Hash (Tokens from Supabase)
            // Supabase puts access_token, etc. in the URL fragment (#)
            const hash = window.location.hash;

            // 2. Get the Target (Next) from Query Param
            // The logic is: User signs up on chatmat.in -> Redirects to clickube.com/auth_callback?next=https://chatmat.in
            const params = new URLSearchParams(window.location.search);
            const next = params.get('next');

            if (!next) {
                // If no next param, usually means we are on the master domain itself
                // or the user opened the link directly without the query param (rare if flow is correct)
                setStatus('Redirecting to dashboard...');
                // If we have a hash, preserve it
                if (hash) {
                    window.location.href = '/' + hash;
                } else {
                    window.location.href = '/';
                }
                return;
            }

            try {
                // Validate URL structure
                const nextUrl = new URL(next);

                // Construct the final destination: Target Domain + Root Path + Hash
                // We strip the leading '#' from hash if exists to ensure clean construction, 
                // but usually hash includes it.
                // Example: https://chatmat.in/#access_token=...

                // Security Note: In a strict environment, you might want to whitelist domains here.
                // But specifically requested "generic solution for 100+ domains", so we allow any valid URL.

                let finalUrl = nextUrl.origin;

                if (hash) {
                    finalUrl += '/' + hash;
                } else {
                    finalUrl += '/'; // Just land on homepage if no tokens (e.g. email verified only?)
                }

                console.log('Bouncing to:', finalUrl);
                setStatus(`Redirecting to ${nextUrl.hostname}...`);

                // Execute Redirect
                window.location.href = finalUrl;
            } catch (e) {
                setStatus('Error: Invalid redirect target.');
                console.error(e);
            }
        };

        handleRedirect();
    }, []);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 font-medium">{status}</p>
            <p className="text-xs text-slate-400 mt-2">Secure Auth Broker</p>
        </div>
    );
};

export default AuthCentralCallback;
