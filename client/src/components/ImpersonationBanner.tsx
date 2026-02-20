import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const ImpersonationBanner = () => {
    const [isImpersonating, setIsImpersonating] = useState(false);

    useEffect(() => {
        // Check for impersonation flag
        const checkImpersonation = () => {
            // 1. Check URL query params first (when landing from magic link)
            const params = new URLSearchParams(window.location.search);
            const isImpParam = params.get('impersonated');

            if (isImpParam === 'true') {
                sessionStorage.setItem('is_impersonating', 'true');
                // Clean URL
                const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                window.history.replaceState({ path: newUrl }, '', newUrl);
                setIsImpersonating(true);
            } else {
                // 2. Check session storage (persistence during session)
                const storedImp = sessionStorage.getItem('is_impersonating');
                if (storedImp === 'true') {
                    setIsImpersonating(true);
                }
            }
        };

        checkImpersonation();
    }, []);

    const stopImpersonation = async () => {
        try {
            await supabase.auth.signOut();
            sessionStorage.removeItem('is_impersonating');

            // AGGRESSIVE CLEANUP: Remove dashboard caches
            localStorage.removeItem('dashboard_stats_cache');
            localStorage.removeItem('lead_dashboard_cache');
            localStorage.removeItem('connection_cache');
            localStorage.removeItem('theme_cache');

            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
                    localStorage.removeItem(key);
                }
            });

            // Redirect to Admin Panel
            // Assuming Admin Panel is on the same domain under /admin
            window.location.href = '/admin/auth/login';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (!isImpersonating) return null;

    return (
        <div className="fixed top-0 left-0 right-0 h-10 bg-red-600 text-white z-[9999] flex items-center justify-center px-4 shadow-md animate-slide-in-down">
            <span className="text-sm font-semibold mr-4">
                ⚠️ You are impersonating this user.
            </span>
            <button
                onClick={stopImpersonation}
                className="bg-white text-red-600 px-3 py-1 rounded text-xs font-bold hover:bg-red-50 transition-colors uppercase"
            >
                Back to Admin
            </button>
        </div>
    );
};

export default ImpersonationBanner;
