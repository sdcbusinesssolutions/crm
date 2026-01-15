import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckIcon } from './icons';
import { useTheme } from '../contexts/ThemeContext';

const AuthPage: React.FC = () => {
    const { settings } = useTheme();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Parse URL params for redirect messages
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const reason = params.get('redirect_reason');
        const emailParam = params.get('email');
        const actualDomain = params.get('actual');

        if (emailParam) setEmail(emailParam);

        if (reason === 'domain_mismatch') {
            if (actualDomain && actualDomain !== window.location.hostname) {
                // Informational: They were moved here from somewhere else.
                setMessage(`Security Redirect: You were moved from ${actualDomain} to your assigned workspace.`);
            } else {
                setError('Please log in from your assigned workspace domain.');
            }
        } else if (reason === 'session_expired') {
            setError('Your session has expired. Please log in again.');
        }
    }, []);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        // Ideally: VITE_MASTER_URL should be 'https://clickube.com' (whitelisted in Supabase)
                        // If not set, it falls back to window.location.origin (only works if CURRENT domain is whitelisted)
                        // @ts-ignore
                        emailRedirectTo: (import.meta as any).env.VITE_MASTER_URL
                            ? `${(import.meta as any).env.VITE_MASTER_URL}/auth_callback?next=${window.location.origin}`
                            : window.location.origin,
                        data: {
                            signup_domain: window.location.hostname
                        }
                    }
                });
                if (error) throw error;
                setMessage('Registration successful! Please check your email to confirm your account.');
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;

                // --- TENANCY & REDIRECTION LOGIC ---
                // Fetch the authoritative domain from the profiles table
                // (User metadata might be stale or missing for older users)
                if (data.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('signup_domain, role')
                        .eq('id', data.user.id)
                        .single();

                    const assignedDomain = profile?.signup_domain;
                    const currentDomain = window.location.hostname;

                    // Normalize domains (ignore port for localhost)
                    const normalize = (d: string) => d.trim().toLowerCase()
                        .replace(/^https?:\/\//, '')
                        .replace(/^www\./, '');

                    const assigned = normalize(assignedDomain || '');
                    const current = normalize(currentDomain || '');

                    const isLocalhost = current.includes('localhost') || current.includes('127.0.0.1');

                    // CHECK 1: If user belongs to a domain, they should be ON that domain.
                    if (assigned && assigned !== current && !isLocalhost) {
                        // User is on the wrong domain (e.g., api@apiautomation.in on clickube.com)

                        // Action: Sign out and Redirect to the correct domain
                        await supabase.auth.signOut();

                        // Construct redirect URL
                        // Warning: This assumes https for production.
                        const protocol = window.location.protocol;
                        const targetUrl = `${protocol}//${assigned}/login?email=${encodeURIComponent(email)}&redirect_reason=domain_mismatch&expected=${assigned}&actual=${current}`;

                        alert(`You belong to ${assigned}. Redirecting you there...`);
                        window.location.href = targetUrl;
                        return; // Stop execution
                    }

                    // CHECK 2: Plan Status (Safeguarded)
                    try {
                        const { data: userCheck, error: planError } = await supabase.rpc('check_user_plan_status', {
                            target_user_id: data.user.id
                        });

                        // Treat plan check as non-blocking if RPC fails (e.g., function missing)
                        if (!planError && userCheck && (userCheck as any).length > 0) {
                            const status = (userCheck as any)[0];
                            if (status.is_allowed === false) {
                                await supabase.auth.signOut();
                                throw new Error(status.message || 'Subscription Plan Expired');
                            }
                            if (status.message === 'PLAN_EXPIRING_SOON') {
                                alert(`⚠️ Note: Your subscription expires in ${status.days_left} days.`);
                            }
                        }
                    } catch (e: any) {
                        // Only block if explicitly set to blocked. Log other errors.
                        if (e.message?.includes('Subscription Plan Expired')) throw e;
                        console.warn("Plan Check Skipped:", e.message);
                    }

                    // CHECK 3: Global Ban/Block Status (Safeguarded)
                    try {
                        const { data: adminCheck, error: adminRpcError } = await supabase.rpc('check_admin_status', {
                            check_domain: assignedDomain || currentDomain
                        });

                        if (!adminRpcError && adminCheck && (adminCheck as any).length > 0) {
                            const result = (adminCheck as any)[0];
                            if (result.is_banned) {
                                await supabase.auth.signOut();
                                throw new Error(result.fail_reason || 'This Workspace (Domain) access is blocked by Super Admin.');
                            }
                        }
                    } catch (e: any) {
                        if (e.message?.includes('blocked')) throw e;
                        console.warn("Admin Status Check Skipped:", e.message);
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden"
            style={{ '--brand-color': settings.primary_color } as React.CSSProperties} >

            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-brand-500/5 rounded-full blur-3xl" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-3xl" />
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 w-full max-w-md relative z-10 animate-slide-up">
                <div className="text-center mb-8">
                    {/* DYNAMIC LOGO */}
                    {settings.logo_url && (
                        <img src={settings.logo_url} alt={settings.brand_name} className="h-12 mx-auto mb-4" />
                    )}

                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                        {isSignUp ? `Join ${settings.brand_name}` : `Login to ${settings.brand_name}`}
                    </h1>
                    <p className="text-slate-500 text-sm mt-2">
                        {isSignUp ? 'Start building automated flows today.' : 'Sign in to continue to your workspace.'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg font-medium">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mb-6 p-3 bg-green-50 border border-green-100 text-green-600 text-sm rounded-lg font-medium flex items-center gap-2">
                        <CheckIcon className="w-4 h-4" /> {message}
                    </div>
                )}

                <form onSubmit={handleAuth} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email Address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-medium text-slate-900"
                            placeholder="name@company.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-medium text-slate-900"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-lg shadow-brand-200/50 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        style={{ backgroundColor: settings.primary_color }}
                    >
                        {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <p className="text-sm text-slate-500">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                        <button
                            onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
                            className="font-bold text-brand-600 hover:text-brand-700 transition-colors"
                            style={{ color: settings.primary_color }}
                        >
                            {isSignUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
