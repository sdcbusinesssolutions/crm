import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            // Using /api/admin proxy which runs on port 5000 (main backend)
            // or directly 5000 if running locally
            const response = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
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
                    <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
                        <span className="text-white font-bold text-xl">V</span>
                    </div>
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
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none"
                            required
                        />
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
