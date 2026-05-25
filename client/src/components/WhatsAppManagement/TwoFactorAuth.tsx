import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';

interface TwoFactorAuthProps {
    readOnly?: boolean;
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ readOnly }) => {
    const [enabled, setEnabled] = useState(false);
    const [setupKey, setSetupKey] = useState<string | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [verifyCode, setVerifyCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await settingsService.get2FAStatus();
            setEnabled(data.enabled);
            setSetupKey(data.setupKey);
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to load 2FA status' });
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (readOnly) return;
        setProcessing(true);
        setMessage(null);
        try {
            const data = await settingsService.generate2FA();
            setSetupKey(data.secret);
            setQrCode(data.qrCode);
            // If we generate a new key, it's not enabled yet until verified
            setEnabled(false);
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to generate 2FA key' });
        } finally {
            setProcessing(false);
        }
    };

    const handleVerifyAndEnable = async () => {
        if (readOnly || !verifyCode) return;
        setProcessing(true);
        setMessage(null);
        try {
            await settingsService.enable2FA(verifyCode);
            setEnabled(true);
            setQrCode(null); // Hide QR code after success
            setVerifyCode('');
            setMessage({ type: 'success', text: '2FA enabled successfully' });
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Verification failed' });
        } finally {
            setProcessing(false);
        }
    };

    const handleDisable = async () => {
        if (readOnly) return;
        if (!window.confirm('Are you sure you want to disable 2FA?')) return;
        setProcessing(true);
        setMessage(null);
        try {
            await settingsService.disable2FA();
            setEnabled(false);
            setSetupKey(null);
            setMessage({ type: 'success', text: '2FA disabled successfully' });
        } catch (err) {
            console.error(err);
            setMessage({ type: 'error', text: 'Failed to disable 2FA' });
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

    return (
        <div className="max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Two-Factor Authentication (2FA)</h2>

            {message && (
                <div className={`p-4 mb-6 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-medium text-slate-800">Status</h3>
                        <p className={`text-sm font-bold ${enabled ? 'text-green-600' : 'text-slate-500'}`}>
                            {enabled ? 'Enabled' : 'Disabled'}
                        </p>
                    </div>
                    {enabled && !readOnly && (
                        <button
                            onClick={handleDisable}
                            disabled={processing}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                        >
                            Disable 2FA
                        </button>
                    )}
                </div>

                {!enabled && (
                    <div className="border-t border-slate-100 pt-6">
                        <h3 className="text-lg font-medium text-slate-800 mb-4">Setup 2FA</h3>

                        {!qrCode && !setupKey && !readOnly && (
                            <button
                                onClick={handleGenerate}
                                disabled={processing}
                                className="px-6 py-2.5 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-all"
                            >
                                {processing ? 'Generating...' : 'Generate New Key'}
                            </button>
                        )}

                        {readOnly && !qrCode && !setupKey && (
                            <p className="text-sm text-slate-500">2FA setup is disabled in Read Only Mode.</p>
                        )}

                        {(qrCode || setupKey) && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="flex flex-col md:flex-row gap-8 items-start">
                                    {qrCode && (
                                        <div className="bg-white p-2 border border-slate-200 rounded-lg">
                                            <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                                        </div>
                                    )}
                                    <div className="flex-1 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Setup Key</label>
                                            <div className="flex items-center gap-2">
                                                <code className="bg-slate-100 px-3 py-2 rounded border border-slate-200 text-slate-700 font-mono text-sm flex-1">
                                                    {setupKey}
                                                </code>
                                                <button
                                                    onClick={() => navigator.clipboard.writeText(setupKey || '')}
                                                    className="p-2 text-slate-500 hover:text-brand-600 transition-colors"
                                                    title="Copy Key"
                                                >
                                                    📋
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Scan the QR code or enter the setup key manually in your authenticator app (Google Authenticator, Authy, etc.).
                                            </p>
                                        </div>

                                        {!readOnly && (
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Verify Code</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={verifyCode}
                                                        onChange={(e) => setVerifyCode(e.target.value)}
                                                        className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                                                        placeholder="Enter 6-digit code"
                                                    />
                                                    <button
                                                        onClick={handleVerifyAndEnable}
                                                        disabled={processing || !verifyCode}
                                                        className="px-6 py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                    >
                                                        {processing ? 'Verifying...' : 'Verify & Enable'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TwoFactorAuth;
