import React, { useState } from 'react';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Password reset link sent (Mock)');
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h2>Forgot Password</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Enter your email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-btn">Send Reset Link</button>
                </form>
                <div className="links">
                    <a href="/auth/login">Back to Login</a>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
