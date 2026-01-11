import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { themeService } from '../services/themeService';
import { CheckIcon, SparklesIcon, ZapIcon } from './icons';

interface Plan {
    id: string;
    name: string;
    limits: Record<string, any>;
    pricing: Array<{
        name: string;
        amount: number;
        interval: string;
        interval_count: number;
    }>;
    features?: string[];
}

interface Subscription {
    id: string;
    plan_id: string;
    plan?: Plan;
    status: string;
    end_date: string;
    start_date: string;
    amount: number;
    currency: string;
    payment_term: string;
}

const MyPlan: React.FC = () => {
    const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
    const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");

            // Fetch Current Subscription
            const { data: subs, error: subError } = await supabase
                .from('user_subscriptions')
                .select(`
                    *,
                    plan:plans(*)
                `)
                .eq('user_id', user.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(1);

            if (subError) throw subError;

            // Fetch All Active Plans for Upgrade
            const { data: plans, error: planError } = await supabase
                .from('plans')
                .select('*')
                .eq('is_active', true)
                .order('pricing', { ascending: true }); // Attempt to order by pricing generally

            if (planError) throw planError;

            if (subs && subs.length > 0) {
                const sub = subs[0] as unknown as Subscription;
                // Simple expiry check
                const endDate = new Date(sub.end_date);
                if (endDate > new Date()) {
                    setCurrentSubscription(sub);
                }
            }

            // Client-side sort plans by price just to be sure
            const sortedPlans = ((plans || []) as unknown as Plan[]).sort((a, b) => {
                const priceA = a.pricing?.[0]?.amount || 0;
                const priceB = b.pricing?.[0]?.amount || 0;
                return priceA - priceB;
            });

            setAvailablePlans(sortedPlans);

        } catch (err: any) {
            console.error("Error fetching plan data:", err);
            setError(err.message || "Failed to load plan details");
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = (plan: Plan) => {
        alert(`Upgrade to ${plan.name} functionality coming soon!`);
    };

    const formatLimitValue = (val: any) => {
        if (val === -1 || val === "-1") return "Unlimited";
        return val;
    };

    const formatLimitKey = (key: string) => {
        // Convert snake_case to Title Case
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-brand-500 bg-slate-50/50">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-200 border-t-brand-600 mb-4"></div>
                <p className="text-slate-400 font-medium animate-pulse">Loading your plan details...</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto no-scrollbar bg-slate-50/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

                {/* Header */}
                <div className="mb-10 md:mb-14 text-center md:text-left">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight mb-2">
                        Plan & Billing
                    </h1>
                    <p className="text-slate-500 text-lg max-w-2xl">
                        Manage your subscription, view usage limits, and upgrade to unlock more power.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-8 flex items-center shadow-sm">
                        <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        {error}
                    </div>
                )}

                {/* Current Subscription Hero Card */}
                <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl mb-16 group transition-all duration-500 hover:shadow-brand-500/10">

                    {/* Artistic Background blobs */}
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-brand-500 rounded-full blur-[100px] opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-600 rounded-full blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity duration-700"></div>

                    <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row gap-8 md:items-center justify-between">
                        <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-4">
                                <span className="px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(var(--color-brand-rgb),0.2)]">
                                    Current Plan
                                </span>
                                {currentSubscription && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${currentSubscription.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                        {currentSubscription.status.toUpperCase()}
                                    </span>
                                )}
                            </div>

                            <h2 className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">
                                {currentSubscription?.plan?.name || "Free Tier"}
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base font-medium">
                                {currentSubscription
                                    ? `Valid until ${new Date(currentSubscription.end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`
                                    : "You are currently on the free tier with limited features."}
                            </p>
                        </div>

                        <div className="flex flex-col items-start md:items-end">
                            {currentSubscription ? (
                                <>
                                    <div className="flex items-baseline text-white mb-1">
                                        <span className="text-2xl md:text-3xl font-bold text-slate-400 mr-1 symbol">{currentSubscription.currency || 'INR'}</span>
                                        <span className="text-4xl md:text-5xl font-black tracking-tighter">{currentSubscription.amount}</span>
                                    </div>
                                    <p className="text-slate-400 text-sm font-medium">
                                        Per {currentSubscription.payment_term}
                                    </p>
                                </>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <p className="text-slate-300 mb-2">Ready to unlock full potential?</p>
                                    <button
                                        onClick={() => document.getElementById('available-plans')?.scrollIntoView({ behavior: 'smooth' })}
                                        className="px-6 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-brand-50 transition-colors shadow-lg flex items-center gap-2"
                                    >
                                        <SparklesIcon className="w-4 h-4 text-amber-500" />
                                        View Plans
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {currentSubscription?.plan?.limits && (
                        <div className="relative z-10 bg-white/5 border-t border-white/10 p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-6 backdrop-blur-sm">
                            {Object.entries(currentSubscription.plan.limits).slice(0, 4).map(([key, value]) => (
                                <div key={key}>
                                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">{formatLimitKey(key)}</p>
                                    <p className="text-lg md:text-xl font-bold text-white tracking-tight">{formatLimitValue(value)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Available Plans Section */}
                <div id="available-plans">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold text-slate-800">Available Upgrades</h3>
                        {/* Toggle for Monthly/Yearly could go here */}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {availablePlans.map((plan) => {
                            const isCurrent = currentSubscription?.plan_id === plan.id;
                            const price = plan.pricing?.[0]; // Assuming first price option is default for display

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative flex flex-col rounded-2xl transition-all duration-300 
                                        ${isCurrent
                                            ? 'bg-white border-2 border-brand-500 shadow-xl ring-4 ring-brand-50/50 scale-[1.02] z-10'
                                            : 'bg-white border border-slate-200 hover:border-brand-300 hover:shadow-xl hover:-translate-y-1'
                                        }`}
                                >
                                    {isCurrent && (
                                        <div className="absolute top-0 right-0 left-0 -mt-4 flex justify-center">
                                            <span className="bg-brand-600 text-white text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg shadow-brand-500/30">
                                                Current Plan
                                            </span>
                                        </div>
                                    )}

                                    <div className="p-8 flex-1">
                                        <div className="mb-6">
                                            <h3 className="text-xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                                            <p className="text-slate-500 text-sm leading-relaxed">
                                                Perfect for scaling your business with advanced WhatsApp automation features.
                                            </p>
                                        </div>

                                        <div className="mb-8">
                                            {price ? (
                                                <div className="flex items-baseline">
                                                    <span className="text-sm font-bold text-slate-500 align-top mt-2">INR</span>
                                                    <span className="text-5xl font-extrabold text-slate-900 tracking-tighter mx-1">{price.amount}</span>
                                                    <span className="text-slate-400 font-medium">/{price.interval === 'day' ? 'day' : price.interval === 'month' ? 'mo' : price.interval}</span>
                                                </div>
                                            ) : (
                                                <div className="text-3xl font-bold text-slate-800">Custom</div>
                                            )}
                                        </div>

                                        <div className="space-y-4 mb-8">
                                            {plan.limits && Object.entries(plan.limits).map(([key, value]) => (
                                                <div key={key} className="flex items-start">
                                                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center mt-0.5 mr-3">
                                                        <CheckIcon className="w-3.5 h-3.5 text-emerald-600" />
                                                    </div>
                                                    <div>
                                                        <span className="block text-sm font-bold text-slate-700">
                                                            {key === 'team_members' && value === -1 ? 'Unlimited Team Members'
                                                                : key === 'contacts' && value === -1 ? 'Unlimited Contacts'
                                                                    : `${formatLimitValue(value)} ${formatLimitKey(key)}`}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium hidden">Included</span>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex items-start opacity-60">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center mt-0.5 mr-3">
                                                    <CheckIcon className="w-3.5 h-3.5 text-slate-400" />
                                                </div>
                                                <span className="text-sm text-slate-600">Standard Support</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-8 pt-0 mt-auto">
                                        <button
                                            onClick={() => !isCurrent && handleUpgrade(plan)}
                                            disabled={isCurrent}
                                            className={`w-full py-4 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2
                                                ${isCurrent
                                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                                    : 'bg-slate-900 text-white hover:bg-brand-600 hover:shadow-lg hover:shadow-brand-500/25 active:transform active:scale-[0.98]'
                                                }`}
                                        >
                                            {isCurrent ? (
                                                <>Current Active Plan</>
                                            ) : (
                                                <>
                                                    <ZapIcon className="w-4 h-4 fill-current" />
                                                    Upgrade Now
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* FAQ / Trust text footer */}
                <div className="mt-20 border-t border-slate-200 pt-10 text-center pb-10">
                    <p className="text-slate-400 text-sm">
                        Need a custom enterprise plan? <a href="#" className="text-brand-600 font-bold hover:underline">Contact Sales</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default MyPlan;
