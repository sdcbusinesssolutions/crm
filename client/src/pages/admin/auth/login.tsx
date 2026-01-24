import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeIcon, EyeOffIcon } from '../../../components/icons';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();


    // IMPERSONATION HANDLING
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) {
            console.log('Detected Admin Impersonation Token, attempting auto-login...');
            handleLogin(null, token);
        }
    }, []);

    const handleLogin = async (e: React.FormEvent | null, impersonationToken?: string) => {
        if (e) e.preventDefault();
        setError('');

        try {
            const body = impersonationToken
                ? { impersonation_token: impersonationToken }
                : { email, password };

            // Using /api/admin proxy which runs on port 5000 (main backend)
            // or directly 5000 if running locally
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (response.ok) {
                // 1. Set Legacy Token (for existing APIs)
                localStorage.setItem('adminToken', data.token);

                // 2. Start Supabase Session (for RLS & Frontend Apps)
                if (!impersonationToken) {
                    const { supabase } = await import('../../../lib/supabase');
                    const { error: sbError } = await supabase.auth.signInWithPassword({
                        email,
                        password
                    });

                    if (sbError) {
                        console.warn("Supabase Auth Sync Failed:", sbError.message);
                        // Optional: don't block login if custom auth worked, but RLS features won't work.
                    }
                }

                navigate('/admin/dashboard');
            } else {
                setError(data.message || 'Login failed');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="text-center mb-6">

                    <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome Back</h2>
                    <p className="text-sm text-gray-500">Sign in to continue to your workspace.</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group mb-4">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@company.com"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                            required
                        />
                    </div>
                    <div className="form-group mb-6">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none pr-12"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-1.5 text-orange-600 hover:text-orange-700 transition-all rounded-md hover:bg-orange-50 focus:outline-none"
                            >
                                {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded text-center">{error}</p>}

                    <button
                        type="submit"
                        className="w-full bg-orange-700 hover:bg-orange-800 text-white font-bold py-3 rounded-lg shadow-md transition-colors duration-200"
                    >
                        Sign In
                    </button>
                </form>

                <div className="mt-6 text-center border-t border-gray-100 pt-6">
                    <p className="text-sm text-gray-500">
                        Don't have an account? <span className="text-orange-700 font-bold cursor-pointer">Sign Up</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
