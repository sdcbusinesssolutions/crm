import React, { useState, useEffect } from 'react';
import { settingsService } from '../../services/settingsService';

interface WhatsAppAccount {
    id: string;
    name: string;
    phone_number: string;
}

const MMLiteOnboarding: React.FC = () => {
    const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(1);
    const [status, setStatus] = useState<any>(null);
    const [partnerOnboardResult, setPartnerOnboardResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const data = await settingsService.getWhatsAppConfig();
            const list = Array.isArray(data) ? data : (data && data.id ? [data] : []);
            setAccounts(list);
            if (list.length > 0) {
                setSelectedAccountId(list[0].id);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to load accounts');
        } finally {
            setLoading(false);
        }
    };

    const handlePartnerOnboarding = async () => {
        if (!selectedAccountId) return;
        setProcessing(true);
        setError(null);
        try {
            const result = await settingsService.initiateMMLitePartnerOnboarding(selectedAccountId);
            setPartnerOnboardResult(result);
            setCurrentStep(2); // Move to Terms
        } catch (err: any) {
            setError(err.message || 'Partner onboarding failed');
        } finally {
            setProcessing(false);
        }
    };

    useEffect(() => {
        if (selectedAccountId && currentStep === 1) {
            // Optional: Auto-check status to see where we are
            checkEligibility(true);
        }
    }, [selectedAccountId]);

    const checkEligibility = async (silent = false) => {
        if (!selectedAccountId) return;
        if (!silent) setProcessing(true);
        setError(null);
        try {
            const result = await settingsService.checkMMLiteEligibility(selectedAccountId);
            setStatus(result);
            
            // Logic based on Meta Status:
            // COMPLETED: Already onboarded and transitioned
            // ELIGIBLE: Can start transition
            // IN_PROGRESS: Transition is happening
            
            if (result.phone_status === 'ACTIVE') {
                setCurrentStep(5); // Truly finished
            } else if (result.mm_lite_status === 'COMPLETED' || result.mm_lite_status === 'ELIGIBLE') {
                setCurrentStep(3); // Onboarded but needs transition
            } else if (result.mm_lite_status === 'IN_PROGRESS') {
                setCurrentStep(5); // Special case
            }
        } catch (err: any) {
            if (!silent) setError(err.message || 'Verification failed');
        } finally {
            if (!silent) setProcessing(false);
        }
    };

    const handleTransition = async () => {
        if (!selectedAccountId) return;
        setProcessing(true);
        setError(null);
        try {
            await settingsService.transitionToMMLite(selectedAccountId);
            setCurrentStep(5);
            // Refresh status
            const result = await settingsService.checkMMLiteEligibility(selectedAccountId);
            setStatus(result);
        } catch (err: any) {
            setError(err.message || 'Transition failed');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading configurations...</div>;

    if (accounts.length === 0) {
        return (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
                <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800">No WhatsApp Account Found</h3>
                <p className="text-slate-500 mt-2">You need to connect a WhatsApp Business API account first before you can use MM Lite features.</p>
            </div>
        );
    }

    const steps = [
        { id: 1, name: 'Partner Init', desc: 'Onboard via Partner' },
        { id: 2, name: 'Terms', desc: 'Understanding MM Lite' },
        { id: 3, name: 'Eligibility', desc: 'Check WABA status' },
        { id: 4, name: 'Transition', desc: 'Activate on number' },
        { id: 5, name: 'Confirmation', desc: 'Finish Setup' }
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center font-bold text-xl shadow-sm">MM</div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Marketing Messages Lite</h2>
                        <p className="text-slate-500">Scale your marketing campaigns with optimized delivery and performance.</p>
                    </div>
                </div>
            </div>

            {/* Steps Indicator */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <div className="flex justify-between relative">
                    <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100 -z-0"></div>
                    {steps.map((step) => (
                        <div key={step.id} className="relative z-10 flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                                currentStep === step.id 
                                ? 'bg-brand-600 text-white shadow-lg ring-4 ring-brand-50' 
                                : currentStep > step.id 
                                ? 'bg-green-500 text-white' 
                                : 'bg-white border-2 border-slate-200 text-slate-400'
                            }`}>
                                {currentStep > step.id ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                ) : step.id}
                            </div>
                            <span className={`mt-2 text-xs font-bold uppercase tracking-wider ${currentStep === step.id ? 'text-brand-600' : 'text-slate-400'}`}>{step.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3 animate-shake">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1-1 0 102 0V6a1-1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}

            {/* Account Selector */}
            {currentStep < 4 && (
                <div className="mb-8 p-4 bg-slate-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-bold text-slate-600 uppercase tracking-tighter">Target Account:</label>
                        <select 
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-brand-500 outline-none"
                            disabled={currentStep > 1 || processing}
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name} ({acc.phone_number})</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* Step Content */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
                {currentStep === 1 && (
                    <div className="p-8 animate-fade-in text-center">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><line x1="6" y1="11" x2="6" y2="11.01"></line><line x1="10" y1="11" x2="10" y2="11.01"></line><line x1="14" y1="11" x2="14" y2="11.01"></line><line x1="18" y1="11" x2="18" y2="11.01"></line></svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">Partner Onboarding</h3>
                        <p className="text-slate-600 mb-8 max-w-lg mx-auto leading-relaxed">
                            To enable Marketing Messages Lite, we first need to establish a business agreement with Meta on your behalf as an authorized technology partner.
                        </p>

                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left mb-8 max-w-lg mx-auto">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Partner Workflow</h4>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2 text-sm text-slate-600">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    Validates partner-app permissions
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    Identifies eligible shared WABAs
                                </li>
                                <li className="flex items-center gap-2 text-sm text-slate-600">
                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                    Creates business agreement request
                                </li>
                            </ul>
                        </div>

                        <button 
                            onClick={handlePartnerOnboarding}
                            disabled={processing}
                            className={`w-full max-w-sm py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 ${processing ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {processing ? 'Initiating...' : 'Initialize Onboarding Request'}
                            {!processing && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>}
                        </button>
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="p-8 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Boost Your Marketing Reach</h3>
                            <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">Request ID: {partnerOnboardResult?.request_id?.slice(0, 10)}...</div>
                        </div>
                        <p className="text-slate-600 mb-6 leading-relaxed">
                            The onboarding request has been initialized. Now, please review the Marketing Messages Lite (MM Lite) advantages and agree to the terms.
                        </p>
                        <ul className="space-y-4 mb-8">
                            <li className="flex items-start gap-3">
                                <div className="p-1 bg-green-100 text-green-600 rounded-lg mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-800">Higher Throughput</span>
                                    <span className="text-sm text-slate-500">Send thousands of messages rapidly without rate limit constraints.</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-3">
                                <div className="p-1 bg-green-100 text-green-600 rounded-lg mt-0.5">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </div>
                                <div>
                                    <span className="block font-bold text-slate-800">Optimized Delivery</span>
                                    <span className="text-sm text-slate-500">Benefit from Meta's advanced routing for marketing traffic.</span>
                                </div>
                            </li>
                        </ul>
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl mb-8">
                            <p className="text-sm text-amber-800 font-medium">
                                <span className="font-bold">⚠️ Note:</span> By proceeding, you agree to Meta's Marketing Messages terms. This transition is usually permanent for the selected phone number.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(1)} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Back</button>
                            <button 
                                onClick={() => setCurrentStep(3)}
                                className="flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700 transition-all flex items-center justify-center gap-2"
                            >
                                Agree & Proceed to Eligibility
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="p-8 animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">WABA Eligibility</h3>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            Meta requires your WhatsApp Business Account to meet certain prerequisites before enabling MM Lite features. Let's check your status.
                        </p>

                        {!status ? (
                            <div className="text-center py-12">
                                <div className={`w-16 h-16 border-4 border-brand-100 border-t-brand-600 rounded-full mx-auto ${processing ? 'animate-spin' : ''}`}></div>
                                <button
                                    onClick={checkEligibility}
                                    disabled={processing}
                                    className="mt-8 px-8 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-all shadow-md active:scale-95"
                                >
                                    {processing ? 'Checking...' : 'Check Status Now'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-700">WABA ID</span>
                                            <span className="text-xs font-mono text-slate-400">{status.waba_id}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-bold">Onboarding Status</span>
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight ${
                                            status.onboarding_status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {status.onboarding_status}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-5 bg-white rounded-xl border-2 border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand-600"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-800">MM Lite Feature</span>
                                            <span className="text-xs text-slate-500">Marketing Messages Lite availability</span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                                        status.phone_status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 
                                        status.mm_lite_status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                                    }`}>
                                        {status.phone_status === 'ACTIVE' ? 'ACTIVE' : status.mm_lite_status}
                                    </span>
                                </div>
                                {status.phone_status && status.phone_status !== 'UNKNOWN' && (
                                    <div className="flex items-center justify-between px-5 py-2 bg-slate-50 rounded-lg border border-slate-100 mt-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone API Status</span>
                                        <span className={`text-[10px] font-bold ${status.phone_status === 'ACTIVE' ? 'text-green-600' : 'text-amber-600'}`}>
                                            {status.phone_status}
                                        </span>
                                    </div>
                                )}

                                {status.mm_lite_status === 'NOT_STARTED' || status.mm_lite_status === 'INELIGIBLE' ? (
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                        <div>
                                            <p className="text-sm font-bold text-amber-800">Your account is not yet eligible.</p>
                                            <p className="text-xs text-amber-700 mt-1">Please ensure your business is verified and you have sent some standard marketing messages recently. Meta usually updates eligibility once a week.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-4 flex gap-4">
                                        <button 
                                            onClick={() => setCurrentStep(2)}
                                            className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm"
                                        >
                                            Back
                                        </button>
                                        <button 
                                            onClick={() => setCurrentStep(status.phone_status === 'ACTIVE' ? 5 : 4)}
                                            className="flex-1 py-2.5 bg-brand-600 text-white font-bold rounded-xl hover:bg-brand-700 transition-all shadow-md text-sm"
                                        >
                                            {status.phone_status === 'ACTIVE' ? 'Proceed to Confirmation' : (status.mm_lite_status === 'COMPLETED' ? 'Proceed to Transition' : 'Continue to Transition')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="p-8 animate-fade-in">
                        <h3 className="text-xl font-bold text-slate-800 mb-4">Finalizing Transition</h3>
                        <p className="text-slate-600 mb-8 leading-relaxed">
                            You are about to transition your WhatsApp number to Marketing Messages Lite. This will optimize your number for bulk marketing blasts.
                        </p>

                        <div className="p-5 bg-pink-50 border border-pink-100 rounded-2xl mb-8">
                            <h4 className="font-bold text-pink-800 mb-2 flex items-center gap-2">
                                <span className="w-5 h-5 bg-pink-200 rounded-full flex items-center justify-center text-[10px]">!</span>
                                Template Requirement
                            </h4>
                            <p className="text-sm text-pink-700 mb-3">Ensure you have approved templates in the <span className="font-bold">MARKETING</span> category.</p>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={() => setCurrentStep(3)} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">Back</button>
                            <button 
                                onClick={handleTransition}
                                disabled={processing}
                                className={`flex-1 py-3 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:shadow-brand-100 transition-all flex items-center justify-center gap-2 ${processing ? 'opacity-70 cursor-not-allowed' : 'animate-pulse-subtle'}`}
                            >
                                {processing ? 'Processing...' : 'Transition to MM Lite Now'}
                                {!processing && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>}
                            </button>
                        </div>
                    </div>
                )}

                {currentStep === 5 && (
                    <div className="p-12 text-center animate-fade-in">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border-4 border-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <p className="text-slate-500 mb-8 max-w-sm mx-auto">
                            Congratulations! Your WhatsApp number is now optimized for Marketing Messages Lite.
                        </p>
                        
                        <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left mb-8 shadow-inner">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Meta Verification Data</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Meta Status</span>
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-black uppercase">ACTIVE / ONBOARDED</span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Solution ID</span>
                                    <span className="text-xs font-mono text-slate-400 select-all">{status?.app_id || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Business ID</span>
                                    <span className="text-xs font-mono text-slate-400 select-all">{status?.waba_id || 'N/A'}</span>
                                </div>
                            </div>
                            <p className="mt-4 text-[10px] text-slate-400 text-center italic">IDs are verified directly from Meta's API response.</p>
                        </div>
                        <button 
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-900 transition-all hover:scale-105 active:scale-95"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}
            </div>

            {/* Support Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">Need help with Meta Onboarding?</h4>
                        <p className="text-xs text-slate-500">Our support team can help you with eligibility issues.</p>
                    </div>
                </div>
                <button className="text-brand-600 text-sm font-bold hover:underline">Contact Support</button>
            </div>
        </div>
    );
};

export default MMLiteOnboarding;
