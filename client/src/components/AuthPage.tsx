import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckIcon, EyeIcon, EyeOffIcon } from './icons';
import { useTheme } from '../contexts/ThemeContext';

const AuthPage: React.FC = () => {
    const { settings } = useTheme();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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

    // Handle Magic Link / Impersonation Token
    React.useEffect(() => {
        const autoLogin = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('token');
            const emailParam = params.get('email');

            if (token && emailParam) {
                setLoading(true);
                setMessage('Authenticating via Magic Link...');

                // Attempt Supabase Magic Link Verification
                const { error } = await supabase.auth.verifyOtp({
                    email: emailParam,
                    token: token,
                    type: 'magiclink'
                });

                if (error) {
                    console.error("Magic Link Failed:", error);
                    setError('Magic link is invalid or expired. Please allow the popup or try again.');
                    setLoading(false);
                    setMessage(null);
                } else {
                    // Success! The onAuthStateChange in App.tsx will handle the rest (user is now signed in)
                    // converting from 'magiclink' to 'session'
                    setMessage('Success! Redirecting...');

                    // Clear URL params to avoid loops
                    window.history.replaceState(null, '', window.location.pathname);
                }
            }
        };
        autoLogin();
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
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });
                    
                    if (error) {
                        // Fallback: Check if it's a staff member
                        console.log('🔄 Owner login failed (Supabase). Attempting staff fallback for:', email);
                        try {
                            const { staffApi } = await import('../modules/teamStaff/api/staffApi');
                            console.log('📦 Staff API module loaded. Calling login...');
                            const staffData = await staffApi.login({ email, password });
                            
                            console.log('🎉 Staff login SUCCESS:', staffData.staff.name);
                            
                            // Success! Store staff tokens
                            localStorage.setItem('staffToken', staffData.token);
                            localStorage.setItem('staffData', JSON.stringify(staffData.staff));
                            
                            setMessage(`Welcome back, ${staffData.staff.name}! Redirecting...`);
                            setTimeout(() => window.location.href = '/dashboard', 1000);
                            return;
                        } catch (staffErr: any) {
                            console.warn('❌ Staff fallback failed:', staffErr.response?.data || staffErr.message);
                            // If staff login also fails, throw the original Supabase error
                            throw error;
                        }
                    }

                    // --- TENANCY & REDIRECTION LOGIC (Existing Owner Logic) ---
                    if (data.user) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('signup_domain, role')
                            .eq('id', data.user.id)
                            .single();

                        const assignedDomain = profile?.signup_domain;
                        const currentDomain = window.location.hostname;

                        const normalize = (d: string) => d.trim().toLowerCase()
                            .replace(/^https?:\/\//, '')
                            .replace(/^www\./, '');

                        const assigned = normalize(assignedDomain || '');
                        const current = normalize(currentDomain || '');
                        const isLocalhost = current.includes('localhost') || current.includes('127.0.0.1');

                        if (assigned && assigned !== current && !isLocalhost) {
                            await supabase.auth.signOut();
                            const protocol = window.location.protocol;
                            const targetUrl = `${protocol}//${assigned}/login?email=${encodeURIComponent(email)}&redirect_reason=domain_mismatch&expected=${assigned}&actual=${current}`;
                            alert(`You belong to ${assigned}. Redirecting you there...`);
                            window.location.href = targetUrl;
                            return;
                        }

                        // Plan Check
                        try {
                            const { data: userCheck, error: planError } = await supabase.rpc('check_user_plan_status', {
                                target_user_id: data.user.id
                            });
                            if (!planError && userCheck && (userCheck as any).length > 0) {
                                const status = (userCheck as any)[0];
                                if (status.is_allowed === false) {
                                    await supabase.auth.signOut();
                                    throw new Error(status.message || 'Subscription Plan Expired');
                                }
                            }
                        } catch (e: any) {
                            if (e.message?.includes('Plan Expired')) throw e;
                        }
                    }
                } catch (e: any) {
                    throw e;
                }
            }
        } catch (err: any) {
            let errorMsg = err.message || 'An unexpected error occurred';
            if (errorMsg.includes('Database error saving new user')) {
                errorMsg = 'Signup Failed: This workspace has reached its user limit.';
            }
            setError(errorMsg);
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
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all font-medium text-slate-900 pr-12"
                                placeholder="••••••••"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 text-slate-400 hover:text-brand-600 focus:outline-none"
                            >
                                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
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
