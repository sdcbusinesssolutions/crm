import React, { useEffect, useState } from 'react';
import { PlusIcon, EditIcon, TrashIcon, CheckIcon } from '../../../components/icons';
import Toast from '../../../components/Toast';
import PlanEditor from './PlanEditor';

const Plans = () => {
    const [plans, setPlans] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [selectedPlan, setSelectedPlan] = useState<any>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPlans(data);
            } else {
                setToast({ type: 'error', title: 'Error', message: 'Failed to fetch plans' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSavePlan = async (planData: any) => {
        try {
            const token = localStorage.getItem('adminToken');
            const url = view === 'create'
                ? '/api/admin/plans/create'
                : '/api/admin/plans/update';

            const body = view === 'edit' ? { ...planData, id: selectedPlan.id } : planData;

            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: `Plan ${view === 'create' ? 'created' : 'updated'} successfully` });
                fetchPlans();
                setView('list');
                setSelectedPlan(null);
            } else {
                const err = await res.json();
                setToast({ type: 'error', title: 'Error', message: err.error || err.message || 'Failed to save plan' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this plan?')) return;

        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/plans/delete', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            });

            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: 'Plan deleted successfully' });
                fetchPlans();
            } else {
                const err = await res.json();
                setToast({ type: 'error', title: 'Error', message: err.message || 'Failed to delete plan' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        }
    };

    if (view === 'create' || view === 'edit') {
        return (
            <div className="space-y-6">
                <PlanEditor
                    plan={selectedPlan}
                    onSave={handleSavePlan}
                    onCancel={() => { setView('list'); setSelectedPlan(null); }}
                />
                {toast && <Toast {...toast} onClose={() => setToast(null)} />}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Subscription Plans</h2>
                    <p className="text-slate-500 mt-1">Manage pricing and feature limits for your users.</p>
                </div>
                <button
                    onClick={() => { setSelectedPlan(null); setView('create'); }}
                    className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5"
                >
                    <PlusIcon /><span>Create Plan</span>
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {plans.length === 0 ? (
                        <div className="text-center p-12 bg-white rounded-2xl border border-slate-200 text-slate-500">
                            No plans found. Create your first plan to get started.
                        </div>
                    ) : (
                        plans.map(plan => (
                            <div key={plan.id} className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
                                        {plan.is_active ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                                        {Array.isArray(plan.pricing) ? (
                                            plan.pricing
                                                .filter((p: any) => p.enabled)
                                                .slice(0, 3)
                                                .map((p: any) => (
                                                    <div key={p.id} className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                        <span className="font-semibold text-slate-900">₹{p.amount}</span>
                                                        <span className="text-slate-400 text-xs">/{p.interval === 'day' ? `${p.interval_count}d` : p.interval === 'month' && p.interval_count === 1 ? 'mo' : p.interval === 'month' && p.interval_count === 3 ? 'qtr' : p.interval === 'month' && p.interval_count === 6 ? 'hlf' : p.interval === 'year' ? 'yr' : p.name}</span>
                                                    </div>
                                                ))
                                        ) : (
                                            /* Legacy Format Fallback */
                                            <>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-semibold text-slate-900">
                                                        {plan.pricing?.monthly?.enabled ? `₹${plan.pricing.monthly.amount}` : '-'}
                                                    </span>
                                                    <span className="text-slate-400">/mo</span>
                                                </div>
                                                <div className="w-px h-4 bg-slate-300 hidden md:block"></div>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-semibold text-slate-900">
                                                        {plan.pricing?.yearly?.enabled ? `₹${plan.pricing.yearly.amount}` : '-'}
                                                    </span>
                                                    <span className="text-slate-400">/yr</span>
                                                </div>
                                            </>
                                        )}
                                        {Array.isArray(plan.pricing) && plan.pricing.filter((p: any) => p.enabled).length > 3 && (
                                            <span className="text-xs text-slate-400 flex items-center">+{plan.pricing.filter((p: any) => p.enabled).length - 3} more</span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="text-[10px] bg-slate-50 border border-slate-100 px-2 py-1 rounded text-slate-500">
                                            Contacts: {plan.limits?.contacts === -1 ? '∞' : plan.limits?.contacts}
                                        </span>
                                        <span className="text-[10px] bg-slate-50 border border-slate-100 px-2 py-1 rounded text-slate-500">
                                            Campaigns: {plan.limits?.campaigns === -1 ? '∞' : plan.limits?.campaigns}
                                        </span>
                                        {plan.ai_bot_enabled && (
                                            <span className="text-[10px] bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-emerald-600 font-medium">
                                                AI Bot
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                                    <button
                                        onClick={() => { setSelectedPlan(plan); setView('edit'); }}
                                        className="flex-1 md:flex-none px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <EditIcon className="w-4 h-4" /> Edit Features
                                    </button>
                                    <button
                                        onClick={() => handleDeletePlan(plan.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Plan"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {toast && <Toast {...toast} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Plans;
