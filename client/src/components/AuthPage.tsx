import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckIcon, EyeIcon, EyeOffIcon } from './icons';
import { useTheme } from '../contexts/ThemeContext';

const AuthPage: React.FC = () => {
    const { settings } = useTheme();

    // Automatic Domain-Based Brand Name
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    let cleanHost = hostname.replace(/^(app|api|wapi|crm|www)\./i, '');
    cleanHost = cleanHost.split('.')[0] || 'MarketingPlatform';

    const displayBrandName = (settings?.brand_name && settings.brand_name.toLowerCase() !== 'app') 
        ? settings.brand_name 
        : (cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1));

    const [view, setView] = useState<'login' | 'signup' | 'forgot-password' | 'verify-reset'>('login');
    const isSignUp = view === 'signup';
    
    const [name, setName] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
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

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            const apiUrl = (import.meta as any).env.VITE_API_URL || '/api';
            const res = await fetch(`${apiUrl}/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, domain: window.location.hostname })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send reset email');
            setMessage(data.message || 'If an account exists, a reset code was sent.');
            setView('verify-reset');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        try {
            if (password !== confirmPassword) {
                throw new Error('Passwords do not match');
            }
            const apiUrl = (import.meta as any).env.VITE_API_URL || '/api';
            const res = await fetch(`${apiUrl}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, domain: window.location.hostname, otp, newPassword: password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');
            setMessage('Password successfully reset! You can now log in.');
            setView('login');
            setPassword('');
            setConfirmPassword('');
            setOtp('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isSignUp) {
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                const { data, error } = await supabase.auth.signUp({
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
                            signup_domain: window.location.hostname,
                            name: name,
                            contact_number: contactNumber
                        }
                    }
                });
                if (error) throw error;
                
                // Trigger backend WhatsApp notifications
                try {
                    const apiUrl = (import.meta as any).env.VITE_API_URL || '/api';
                    const token = data?.session?.access_token || ''; // might not have session if email confirmation required
                    
                    await fetch(`${apiUrl}/auth-notifications/trigger-signup-notifications`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({
                            email,
                            name,
                            contact_number: contactNumber,
                            domain: window.location.hostname
                        })
                    });
                } catch (notificationError) {
                    console.error('Failed to trigger signup notifications:', notificationError);
                }

                setMessage('Registration successful! Please check your email to confirm your account.');
            } else {
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });
                    
                    if (error) {
                        // If Supabase login fails, check if it's a staff member
                        // But only if it's an "Invalid login credentials" error (most common case for mixed login)
                        const isInvalidCreds = error.message?.toLowerCase().includes('invalid');
                        
                        if (isInvalidCreds) {
                            console.log('🔄 Owner login failed (Supabase). Attempting staff fallback for:', email);
                            try {
                                const { staffApi } = await import('../modules/teamStaff/api/staffApi');
                                const staffData = await staffApi.login({ email, password });
                                
                                console.log('🎉 Staff login SUCCESS:', staffData.staff.name);
                                
                                // Success! Store staff tokens
                                localStorage.setItem('staffToken', staffData.token);
                                localStorage.setItem('staffData', JSON.stringify(staffData.staff));
                                
                                setMessage(`Welcome back, ${staffData.staff.name}! Redirecting...`);
                                setTimeout(() => window.location.href = '/dashboard', 1000);
                                return;
                            } catch (staffErr: any) {
                                console.warn('❌ Staff fallback failed:', staffErr.message);
                                // Always show the original Supabase error when standard login fails
                                throw error;
                            }
                        } else {
                            // If it's another error (like "Email not confirmed" or "Unexpected token"), throw it
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
            
            // Handle common technical errors gracefully
            if (errorMsg.includes('Unexpected token') || errorMsg.includes('valid JSON')) {
                errorMsg = 'Connection Error: The server returned an invalid response. Please refresh (Ctrl+F5) and try again.';
            } else if (errorMsg.includes('Database error saving new user')) {
                errorMsg = 'Signup Failed: This workspace has reached its user limit.';
            } else if (errorMsg.includes('fetch')) {
                errorMsg = 'Network Error: Cannot reach the authentication server. Please check your internet.';
            }
            
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex w-full font-sans bg-white relative overflow-hidden" style={{ '--brand-color': settings.primary_color } as React.CSSProperties}>
            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px) scale(1) rotate(0deg); }
                    33% { transform: translateY(-30px) scale(1.1) rotate(5deg); }
                    66% { transform: translateY(20px) scale(0.9) rotate(-5deg); }
                    100% { transform: translateY(0px) scale(1) rotate(0deg); }
                }
                @keyframes float-reverse {
                    0% { transform: translateY(0px) scale(1) rotate(0deg); }
                    33% { transform: translateY(30px) scale(0.9) rotate(-5deg); }
                    66% { transform: translateY(-20px) scale(1.1) rotate(5deg); }
                    100% { transform: translateY(0px) scale(1) rotate(0deg); }
                }
                @keyframes slide-dots {
                    0% { background-position: 0px 0px; }
                    100% { background-position: 32px 32px; }
                }
                .animate-float {
                    animation: float 20s ease-in-out infinite;
                }
                .animate-float-delayed {
                    animation: float-reverse 25s ease-in-out infinite;
                }
                .animate-dots {
                    animation: slide-dots 4s linear infinite;
                }
                @keyframes icon-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }
                .animate-icon-float {
                    animation: icon-float 3s ease-in-out infinite;
                }
                @keyframes pulse-ring {
                    0% { transform: scale(0.9); opacity: 0.8; }
                    100% { transform: scale(1.3); opacity: 0; }
                }
                .animate-pulse-ring {
                    animation: pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                /* 3D Flip Utilities */
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }

                /* Automatic Popup Animation */
                @keyframes auto-popup {
                    0%, 100% { opacity: 0; transform: scale(0.9) translateX(-10px); }
                    15%, 85% { opacity: 1; transform: scale(1) translateX(0); }
                }
                .animate-popup-0 { animation: auto-popup 15s cubic-bezier(0.4, 0, 0.2, 1) infinite 0s; }
                .animate-popup-1 { animation: auto-popup 15s cubic-bezier(0.4, 0, 0.2, 1) infinite 3s; }
                .animate-popup-2 { animation: auto-popup 15s cubic-bezier(0.4, 0, 0.2, 1) infinite 6s; }
                .animate-popup-3 { animation: auto-popup 15s cubic-bezier(0.4, 0, 0.2, 1) infinite 9s; }
                .animate-popup-4 { animation: auto-popup 15s cubic-bezier(0.4, 0, 0.2, 1) infinite 12s; }

                /* Brand Name Shimmer Animations */
                @keyframes text-shimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .animate-brand-light {
                    background: linear-gradient(90deg, #ffffff, #25D366, #ffffff);
                    background-size: 200% auto;
                    color: transparent;
                    -webkit-background-clip: text;
                    background-clip: text;
                    animation: text-shimmer 4s ease infinite;
                }
                .animate-brand-dark {
                    background: linear-gradient(90deg, #0f172a, #25D366, #0f172a);
                    background-size: 200% auto;
                    color: transparent;
                    -webkit-background-clip: text;
                    background-clip: text;
                    animation: text-shimmer 4s ease infinite;
                }
            `}</style>
            
            {/* Left Side - Brand Visuals (Always Left) */}
            {/* Left Side - Brand Visuals (Always Left) */}
            <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-[#0a1e16] via-[#153e28] to-[#21b859] overflow-hidden flex-col justify-between p-12">
                {/* Dynamic Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full blur-[120px] bg-[#128C7E]/50 animate-float"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full blur-[140px] bg-[#25D366]/70 animate-float-delayed"></div>
                    
                    {/* Simulated Chat Pattern Overlay */}
                    <div className="absolute inset-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1.5px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                </div>



                {/* Top Brand Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    {settings.logo_url ? (
                        <img src={settings.logo_url} alt={settings.brand_name} className="h-10 object-contain drop-shadow-sm" />
                    ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-xl flex items-center justify-center shadow-lg shadow-[#25D366]/20">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                            </svg>
                        </div>
                    )}
                    <span className="text-xl font-bold tracking-tight animate-brand-light drop-shadow-sm truncate max-w-[180px] sm:max-w-[250px] lg:max-w-[300px]">{displayBrandName}</span>
                </div>

                {/* Massive Animated WhatsApp Icon Setup */}
                <div className="relative z-10 w-full flex-1 flex items-center justify-center min-h-[400px] perspective-1000 mt-8 mb-4">
                    {/* Glowing Backdrop */}
                    <div className={`absolute w-[450px] h-[450px] rounded-full blur-[100px] transition-all duration-1000 ${isSignUp ? 'bg-[#128C7E]/30 scale-110' : 'bg-[#25D366]/20'} animate-pulse`}></div>

                    {/* Animated Circles & Orbiting Use Cases */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        
                        {/* Track 1 - Inner (Inbox) */}
                        <div className="w-[240px] h-[240px] absolute animate-[spin_12s_linear_infinite]">
                            <div className="w-full h-full rounded-full border border-dashed border-white/20 absolute"></div>
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2" style={{ animation: 'spin 12s linear infinite reverse' }}>
                                <div className="w-12 h-12 bg-[#0B141A] rounded-full shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-500/40 flex items-center justify-center relative">
                                    <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Track 2 - Middle (CRM & Flows) */}
                        <div className="w-[340px] h-[340px] absolute animate-[spin_20s_linear_infinite_reverse]">
                            <div className="w-full h-full rounded-full border border-dashed border-[#128C7E]/30 absolute"></div>
                            {/* CRM */}
                            <div className="absolute top-1/2 -left-6 -translate-y-1/2" style={{ animation: 'spin 20s linear infinite' }}>
                                <div className="w-12 h-12 bg-[#0B141A] rounded-full shadow-[0_0_15px_rgba(168,85,247,0.3)] border border-purple-500/40 flex items-center justify-center relative">
                                    <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </div>
                            </div>
                            {/* Flows */}
                            <div className="absolute top-1/2 -right-6 -translate-y-1/2" style={{ animation: 'spin 20s linear infinite' }}>
                                <div className="w-12 h-12 bg-[#0B141A] rounded-full shadow-[0_0_15px_rgba(245,158,11,0.3)] border border-amber-500/40 flex items-center justify-center relative">
                                    <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Track 3 - Outer (Campaigns) */}
                        <div className="w-[440px] h-[440px] absolute animate-[spin_30s_linear_infinite]">
                            <div className="w-full h-full rounded-full border border-dashed border-white/10 absolute"></div>
                            {/* Campaigns */}
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2" style={{ animation: 'spin 30s linear infinite reverse' }}>
                                <div className="w-14 h-14 bg-[#0B141A] rounded-full shadow-[0_0_15px_rgba(244,63,94,0.3)] border border-rose-500/40 flex items-center justify-center relative">
                                    <svg className="w-7 h-7 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Random Place Background Popups */}
                    <div className="absolute inset-0 pointer-events-none z-0">
                        <div className="absolute top-[15%] left-[10%] bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 animate-popup-0">
                            <span className="text-sm font-bold text-white drop-shadow-md tracking-wide">Inbox</span>
                        </div>
                        <div className="absolute bottom-[25%] left-[15%] bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 animate-popup-1">
                            <span className="text-sm font-bold text-white drop-shadow-md tracking-wide">Lead CRM</span>
                        </div>
                        <div className="absolute top-[20%] right-[15%] bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 animate-popup-2">
                            <span className="text-sm font-bold text-white drop-shadow-md tracking-wide">Flows</span>
                        </div>
                        <div className="absolute bottom-[20%] right-[10%] bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 animate-popup-3">
                            <span className="text-sm font-bold text-white drop-shadow-md tracking-wide">Campaigns</span>
                        </div>
                    </div>

                    {/* Center Icon */}
                    <div className={`relative z-20 w-32 h-32 bg-gradient-to-br from-[#25D366] to-[#128C7E] rounded-3xl flex items-center justify-center shadow-[0_0_60px_rgba(37,211,102,0.4)] transition-all duration-1000 border border-white/20 ${isSignUp ? 'rotate-y-180 scale-110' : 'animate-icon-float'}`}>
                        <div className={`transition-all duration-1000 ${isSignUp ? 'rotate-y-180' : ''}`}>
                            <svg className="w-16 h-16 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Bottom Content */}
                <div className="relative z-10 w-full transition-all duration-500 transform translate-y-0">
                    <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-3 tracking-tight leading-[1.1]">
                        {isSignUp ? (
                            <>Scale your <span className="text-[#25D366]">sales</span><br/>with automated chats.</>
                        ) : (
                            <>Welcome to<br/><span className="animate-brand-light drop-shadow-sm break-all whitespace-normal block leading-tight">{displayBrandName}</span></>
                        )}
                    </h1>
                    
                    <div className="flex items-center justify-between mt-8 border-t border-white/10 pt-6">
                        {/* Features/Social Proof */}
                        <div className="flex gap-4 items-center">
                            <div className="flex -space-x-3">
                                <div className="w-10 h-10 rounded-full border-2 border-[#0B141A] bg-slate-200"></div>
                                <div className="w-10 h-10 rounded-full border-2 border-[#0B141A] bg-slate-300"></div>
                                <div className="w-10 h-10 rounded-full border-2 border-[#0B141A] bg-slate-400"></div>
                                <div className="w-10 h-10 rounded-full border-2 border-[#0B141A] bg-[#25D366] flex items-center justify-center text-white">
                                    <CheckIcon className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="text-sm font-medium text-slate-400">
                                Trusted by <span className="text-white">growing</span><br/>businesses
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Footer on left */}
                <div className="relative z-10 text-sm text-slate-500 font-medium">
                    © {new Date().getFullYear()} {settings.brand_name || 'MarketingPlatform'}. All rights reserved.
                </div>
            </div>

            {/* Right Side - Form Container (3D Flip Card) */}
            <div className="w-full lg:w-[45%] flex items-center justify-center bg-slate-50 relative z-20 perspective-1000 p-6 sm:p-12 overflow-hidden lg:overflow-visible">
                <div className={`relative w-full max-w-[420px] transition-all duration-[800ms] preserve-3d ${isSignUp ? 'rotate-y-180 h-[820px] sm:h-[780px]' : 'h-[640px] sm:h-[540px]'}`}>
                    
                    {/* ================= FRONT FACE ================= */}
                    <div className="absolute inset-0 w-full h-full backface-hidden bg-white rounded-3xl shadow-2xl shadow-[#25D366]/5 border border-[#25D366]/40 p-8 sm:p-10 flex flex-col justify-center">
                        <div className="mb-10 text-center">
                            <div className="flex justify-center mb-6">
                                {settings.logo_url ? (
                                    <img src={settings.logo_url} alt={settings.brand_name} className="h-16 object-contain drop-shadow-sm" />
                                ) : (
                                    <div className="relative animate-icon-float">
                                        <div className="absolute inset-[-4px] rounded-full bg-[#25D366] animate-pulse-ring"></div>
                                        <div className="relative w-20 h-20 bg-gradient-to-tr from-[#25D366] to-[#128C7E] rounded-[1.25rem] flex items-center justify-center shadow-[0_8px_24px_rgba(37,211,102,0.4)] border-4 border-white ring-4 ring-[#25D366]/20">
                                            <svg className="w-10 h-10 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {view === 'login' && (
                                <>
                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex flex-col items-center text-center leading-tight">
                                        <span>Welcome to</span>
                                        <span className="animate-brand-dark break-all whitespace-normal w-full">{displayBrandName}</span>
                                    </h2>
                                    <p className="text-slate-500 font-medium">Sign in to your workspace to continue.</p>
                                </>
                            )}
                            {view === 'forgot-password' && (
                                <>
                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex flex-col items-center text-center leading-tight">
                                        <span>Reset Password</span>
                                    </h2>
                                    <p className="text-slate-500 font-medium text-sm mt-2">Enter your email and we'll send you a 6-digit verification code.</p>
                                </>
                            )}
                            {view === 'verify-reset' && (
                                <>
                                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2 flex flex-col items-center text-center leading-tight">
                                        <span>Enter Code</span>
                                    </h2>
                                    <p className="text-slate-500 font-medium text-sm mt-2">Please enter the 6-digit code sent to your email and your new password.</p>
                                </>
                            )}
                        </div>

                        {error && !isSignUp && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl font-medium flex items-start gap-3">
                                <div className="mt-0.5">⚠️</div>
                                <div>{error}</div>
                            </div>
                        )}
                        
                        {message && !isSignUp && (
                            <div className="mb-6 p-4 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-sm rounded-xl font-medium flex items-start gap-3">
                                <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>{message}</div>
                            </div>
                        )}

                        {view === 'login' && (
                            <form onSubmit={handleAuth} className="space-y-5 animate-[fadeIn_0.5s_ease-out]">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder-slate-400" placeholder="name@company.com" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-semibold text-slate-700">Password</label>
                                        <button type="button" onClick={() => { setView('forgot-password'); setError(null); setMessage(null); }} className="text-sm font-bold text-[#128C7E] hover:text-[#075E54] hover:underline transition-all">Forgot?</button>
                                    </div>
                                    <div className="relative">
                                        <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder-slate-400 pr-12" placeholder="••••••••" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                                            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-bold text-[15px] shadow-sm transition-all flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <span className="animate-spin text-xl">↻</span> : 'Sign in'}
                                </button>
                            </form>
                        )}

                        {view === 'forgot-password' && (
                            <form onSubmit={handleForgotPassword} className="space-y-5 animate-[fadeIn_0.5s_ease-out]">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">Email Address</label>
                                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] focus:bg-white outline-none transition-all font-medium text-slate-900 placeholder-slate-400" placeholder="name@company.com" />
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-bold text-[15px] shadow-sm transition-all flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <span className="animate-spin text-xl">↻</span> : 'Send Code'}
                                </button>
                                <button type="button" onClick={() => { setView('login'); setError(null); setMessage(null); }} className="w-full py-3 mt-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[15px] shadow-sm transition-all">
                                    Back to Login
                                </button>
                            </form>
                        )}

                        {view === 'verify-reset' && (
                            <form onSubmit={handleVerifyReset} className="space-y-4 animate-[fadeIn_0.5s_ease-out]">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">6-Digit Code</label>
                                    <input type="text" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] focus:bg-white outline-none transition-all font-medium text-slate-900 tracking-widest text-center text-lg" placeholder="123456" />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">New Password</label>
                                    <div className="relative">
                                        <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] focus:bg-white outline-none transition-all font-medium text-slate-900 pr-12" placeholder="••••••••" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                                            {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700">Confirm New Password</label>
                                    <div className="relative">
                                        <input type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] focus:bg-white outline-none transition-all font-medium text-slate-900 pr-12" placeholder="••••••••" />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-bold text-[15px] shadow-sm transition-all flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <span className="animate-spin text-xl">↻</span> : 'Reset Password'}
                                </button>
                                <button type="button" onClick={() => { setView('login'); setError(null); setMessage(null); }} className="w-full py-3 mt-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-[15px] shadow-sm transition-all">
                                    Cancel
                                </button>
                            </form>
                        )}

                        {view === 'login' && (
                            <div className="mt-8 text-center">
                                <p className="text-slate-500 font-medium text-sm">
                                    Don't have an account?{' '}
                                    <button onClick={() => { setView('signup'); setError(null); setMessage(null); }} className="font-bold text-[#128C7E] hover:text-[#075E54] hover:underline transition-all ml-1">
                                        Sign up
                                    </button>
                                </p>
                            </div>
                        )}
                    </div>

                    {/* ================= BACK FACE: SIGN UP ================= */}
                    <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-slate-900 rounded-3xl shadow-2xl shadow-[#25D366]/10 border border-[#25D366]/40 p-8 sm:p-10 flex flex-col justify-center text-white">
                        <div className="mb-10 text-center">
                            <div className="flex justify-center mb-6">
                                {settings.logo_url ? (
                                    <img src={settings.logo_url} alt={settings.brand_name} className="h-16 object-contain drop-shadow-sm brightness-0 invert" />
                                ) : (
                                    <div className="relative animate-icon-float">
                                        {/* Pulsing Glow Ring */}
                                        <div className="absolute inset-[-4px] rounded-full bg-[#25D366] animate-pulse-ring"></div>
                                        <div className="relative w-20 h-20 bg-gradient-to-tr from-[#25D366] to-[#128C7E] rounded-[1.25rem] flex items-center justify-center shadow-[0_8px_24px_rgba(37,211,102,0.4)] border-4 border-slate-800 ring-4 ring-[#25D366]/20">
                                            <svg className="w-10 h-10 text-white drop-shadow-md" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight mb-2">Create an account</h2>
                            <p className="text-slate-400 font-medium">Start building automated flows today.</p>
                        </div>

                        {error && isSignUp && (
                            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl font-medium flex items-start gap-3">
                                <div className="mt-0.5">⚠️</div>
                                <div>{error}</div>
                            </div>
                        )}

                        {message && isSignUp && (
                            <div className="mb-6 p-4 bg-[#25D366]/10 border border-[#25D366]/20 text-[#25D366] text-sm rounded-xl font-medium flex items-start gap-3">
                                <CheckIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div>{message}</div>
                            </div>
                        )}

                        <form onSubmit={handleAuth} className="space-y-4">
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-300">Full Name</label>
                                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none transition-all font-medium text-white placeholder-slate-300" placeholder="John Doe" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-300">Contact Number</label>
                                <input type="tel" required value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none transition-all font-medium text-white placeholder-slate-300" placeholder="+1234567890" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-semibold text-slate-300">Email Address</label>
                                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none transition-all font-medium text-white placeholder-slate-300" placeholder="name@company.com" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-300">Password</label>
                                    <div className="relative">
                                        <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none transition-all font-medium text-white placeholder-slate-300 pr-10" placeholder="••••••••" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 text-slate-400 hover:text-slate-200 focus:outline-none transition-colors">
                                            {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-300">Confirm Password</label>
                                    <div className="relative">
                                        <input type={showPassword ? "text" : "password"} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-[#25D366] focus:border-[#25D366] outline-none transition-all font-medium text-white placeholder-slate-300 pr-10" placeholder="••••••••" />
                                    </div>
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-3.5 mt-2 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl font-bold text-[15px] shadow-sm transition-all flex justify-center items-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
                                {loading ? <span className="animate-spin text-xl">↻</span> : 'Create account'}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-slate-400 font-medium text-sm">
                                Already have an account?{' '}
                                <button onClick={() => { setView('login'); setError(null); setMessage(null); }} className="font-bold text-[#25D366] hover:text-white hover:underline transition-all ml-1">
                                    Log in
                                </button>
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AuthPage;
