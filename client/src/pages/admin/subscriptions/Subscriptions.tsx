import React, { useEffect, useState } from 'react';
import {
    SearchIcon,
    PlusIcon,
    TrashIcon,
    EditIcon,
    CheckIcon,
    CloseIcon,
    BadgeIcon,
    BriefcaseIcon,
    UsersIcon
} from '../../../components/icons';
import Toast from '../../../components/Toast';

import Modal from '../../../components/Modal';

const Subscriptions = () => {
    const [subs, setSubs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Filters
    const [domainFilter, setDomainFilter] = useState('all');
    const [planFilter, setPlanFilter] = useState('all');
    const [monthFilter, setMonthFilter] = useState('all');
    
    // Auth / Domain State
    const [domains, setDomains] = useState<any[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Assignment Modal State
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignmentData, setAssignmentData] = useState({ userId: '', planId: '', pricingOptionIndex: -1 });
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    // History Modal State
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [currentHistory, setCurrentHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState({ id: '', planId: '', status: '', expiryDate: '' });
    const [isEditCustomDuration, setIsEditCustomDuration] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // Toast State
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

    const fetchUsersAndPlans = async () => {
        const token = localStorage.getItem('adminToken');
        try {
            const [usersRes, plansRes] = await Promise.all([
                fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch('/api/admin/plans', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (usersRes.ok) setAvailableUsers(await usersRes.json());
            if (plansRes.ok) setAvailablePlans(await plansRes.json());
        } catch (e) {
            console.error('Failed to load options', e);
        }
    };

    const fetchSubscriptions = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/subscriptions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSubs(data);
            } else {
                setToast({ type: 'error', title: 'Error', message: 'Failed to fetch subscriptions' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Failed to load subscriptions' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewHistory = async (userId: string) => {
        setHistoryModalOpen(true);
        setHistoryLoading(true);
        setCurrentHistory([]);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch(`/api/admin/subscriptions/history/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setCurrentHistory(data);
            } else {
                setToast({ type: 'error', title: 'Error', message: 'Failed to fetch history' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error loading history' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleEditClick = (sub: any) => {
        // Find plan ID logic might need improvement if we don't have it explicitly in 'sub', 
        // but getAllSubscriptions returns plan name. For now let's hope we can map it or just allow status/date edit.
        // Wait, getAllSubscriptions returns plan name, not ID. 
        // IMPORTANT: We need planId in the response. I'll need to check if getAllSubscriptions returns plan_id.
        // Yes, my updated controller returns `plan_id` in the mapped object.

        // Convert expiry date to YYYY-MM-DD for input
        let dateStr = '';
        try {
            const d = new Date(sub.expiry);
            if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
            }
        } catch (e) { }

        setEditData({
            id: sub.id,
            planId: sub.plan_id || '', // Need to ensure plan_id is available in 'subs' state
            status: sub.raw_status || 'active',
            expiryDate: dateStr
        });

        // Load plans if not already loaded
        if (availablePlans.length === 0) fetchUsersAndPlans();

        setIsEditModalOpen(true);
    };

    const handleUpdateSubscription = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdating(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/subscriptions/update', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: editData.id,
                    planId: editData.planId,
                    status: editData.status,
                    expiryDate: editData.expiryDate
                })
            });

            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: 'Subscription updated' });
                setIsEditModalOpen(false);
                fetchSubscriptions();
            } else {
                const err = await res.json();
                setToast({ type: 'error', title: 'Error', message: err.message || 'Failed to update' });
            }
        } catch (error) {
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleEditPlanChange = (newPlanId: string) => {
        setEditData(prev => ({ ...prev, planId: newPlanId }));

        // Find existing plan details
        const plan = availablePlans.find(p => p.id === newPlanId);
        if (!plan) return;

        const isCustom = (plan.name || '').toLowerCase().includes('custom');
        setIsEditCustomDuration(isCustom);

        if (isCustom) return; // Allow manual date

        if (plan.pricing && Array.isArray(plan.pricing) && plan.pricing.length > 0) {
            const pricing = plan.pricing.find((p: any) => p.enabled) || plan.pricing[0];
            if (pricing) {
                let days = 30;
                const count = parseInt(pricing.interval_count) || 1;
                switch (pricing.interval) {
                    case 'day': days = count; break;
                    case 'week': days = count * 7; break;
                    case 'month': days = count * 30; break;
                    case 'year': days = count * 365; break;
                    default: days = 30;
                }
                const newDate = new Date();
                newDate.setDate(newDate.getDate() + days);
                setEditData(prev => ({ ...prev, planId: newPlanId, expiryDate: newDate.toISOString().split('T')[0] }));
            }
        }
    };

    useEffect(() => {
        if (isAssignModalOpen) {
            fetchUsersAndPlans();
        }
    }, [isAssignModalOpen]);

    useEffect(() => {
        const checkSuperAdmin = async () => {
            let isMaster = false;
            try {
                const token = localStorage.getItem('adminToken');
                if (token) {
                    const res = await fetch('/api/admin/auth/me', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const adminData = await res.json();
                        isMaster = adminData.role === 'super_admin';
                    }
                }
            } catch (e) { console.error(e); }

            if (!isMaster) {
                // @ts-ignore
                const MASTER_URL = (import.meta as any).env.VITE_MASTER_URL || '';
                const hostname = window.location.hostname;
                isMaster = MASTER_URL.includes(hostname) || hostname.includes('localhost');
            }

            setIsSuperAdmin(isMaster);
            
            if (isMaster) {
                try {
                    const token = localStorage.getItem('adminToken');
                    const res = await fetch('/api/admin/domains', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        setDomains(await res.json());
                    }
                } catch (e) { console.error(e); }
            }
        };

        checkSuperAdmin();
        fetchSubscriptions();
        
        // Always fetch plans on mount so plan filter can be populated
        const token = localStorage.getItem('adminToken');
        if (token) {
            fetch('/api/admin/plans', { headers: { 'Authorization': `Bearer ${token}` } })
                .then(res => res.ok ? res.json() : [])
                .then(data => setAvailablePlans(data))
                .catch(e => console.error(e));
        }
    }, []);

    const handleAssignSubscription = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAssigning(true);
        try {
            const token = localStorage.getItem('adminToken');
            const selectedPlan = availablePlans.find(p => p.id === assignmentData.planId);

            // Handle both legacy (object) and new (array) pricing formats
            let pricingOptions = [];
            if (Array.isArray(selectedPlan?.pricing)) {
                pricingOptions = selectedPlan.pricing;
            } else if (selectedPlan?.pricing) {
                if (selectedPlan.pricing.monthly?.enabled) pricingOptions.push({ ...selectedPlan.pricing.monthly, id: 'monthly', interval: 'month', interval_count: 1 });
                if (selectedPlan.pricing.yearly?.enabled) pricingOptions.push({ ...selectedPlan.pricing.yearly, id: 'yearly', interval: 'year', interval_count: 1 });
            }

            const selectedOption = pricingOptions[assignmentData.pricingOptionIndex];

            const res = await fetch('/api/admin/subscriptions/assign', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: assignmentData.userId,
                    planId: assignmentData.planId,
                    pricingOption: selectedOption
                })
            });

            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: 'Subscription assigned successfully' });
                setIsAssignModalOpen(false);
                setAssignmentData({ userId: '', planId: '', pricingOptionIndex: -1 });
                fetchSubscriptions();
            } else {
                const err = await res.json();
                setToast({ type: 'error', title: 'Error', message: err.message || 'Failed to assign' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsAssigning(false);
        }
    };

    const handleDeleteSubscription = async (id: string) => {
        if (!window.confirm('Delete this subscription?')) return;
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/subscriptions/delete', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                setToast({ type: 'success', title: 'Deleted', message: 'Subscription removed' });
                fetchSubscriptions();
            }
        } catch (e) { console.error(e); }
    };

    // Helper to get pricing options for render
    const getPricingOptions = (planId: string) => {
        const plan = availablePlans.find(p => p.id === planId);
        if (!plan || !plan.pricing) return [];

        if (Array.isArray(plan.pricing)) return plan.pricing.filter((p: any) => p.enabled);

        // Legacy Support
        const opts = [];
        if (plan.pricing.monthly?.enabled) opts.push({ ...plan.pricing.monthly, name: 'Monthly', id: 'monthly', amount: plan.pricing.monthly.amount });
        if (plan.pricing.yearly?.enabled) opts.push({ ...plan.pricing.yearly, name: 'Yearly', id: 'yearly', amount: plan.pricing.yearly.amount });
        return opts;
    };

    // Filter Logic - Pre-month to calculate counts
    const preMonthFilteredSubs = subs.filter(sub => {
        if (domainFilter !== 'all' && sub.signupDomain !== domainFilter) return false;
        if (planFilter !== 'all' && sub.plan !== planFilter) return false;
        return true;
    });

    const monthCounts: Record<string, number> = {
        '01': 0, '02': 0, '03': 0, '04': 0, '05': 0, '06': 0,
        '07': 0, '08': 0, '09': 0, '10': 0, '11': 0, '12': 0
    };

    preMonthFilteredSubs.forEach(sub => {
        const d = new Date(sub.expiry);
        if (!isNaN(d.getTime())) {
            const m = (d.getMonth() + 1).toString().padStart(2, '0');
            if (monthCounts[m] !== undefined) {
                monthCounts[m]++;
            }
        }
    });

    const domainFilteredSubs = preMonthFilteredSubs.filter(sub => {
        if (monthFilter !== 'all') {
            const d = new Date(sub.expiry);
            if (!isNaN(d.getTime())) {
                const subMonth = (d.getMonth() + 1).toString().padStart(2, '0');
                if (subMonth !== monthFilter) return false;
            } else {
                return false; // Can't parse date
            }
        }
        
        return true;
    });

    const filteredSubs = domainFilteredSubs.filter(sub => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            (sub.user?.toLowerCase() || '').includes(search) ||
            (sub.plan?.toLowerCase() || '').includes(search) ||
            (sub.status?.toLowerCase() || '').includes(search) ||
            (sub.email?.toLowerCase() || '').includes(search)
        );
    });

    const totalPages = Math.ceil(filteredSubs.length / entriesPerPage);
    const currentEntries = filteredSubs.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    // Selection Logic
    const handleSelectAll = () => {
        const allOnPageSelected = currentEntries.length > 0 && currentEntries.every(s => selectedIds.has(String(s.id)));
        const newSet = new Set(selectedIds);
        if (allOnPageSelected) {
            currentEntries.forEach(s => newSet.delete(String(s.id)));
        } else {
            currentEntries.forEach(s => newSet.add(String(s.id)));
        }
        setSelectedIds(newSet);
    };

    const handleSelectRow = (id: string) => {
        const idStr = String(id);
        const newSet = new Set(selectedIds);
        if (newSet.has(idStr)) newSet.delete(idStr);
        else newSet.add(idStr);
        setSelectedIds(newSet);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:max-w-2xl">
                    <div className="relative group flex-1 min-w-[200px]">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-500 transition-colors">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Search subscriptions by user, plan, status..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-10 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm outline-none transition-all"
                        />
                    </div>
                    
                    {isSuperAdmin && domains.length > 0 && (
                        <select
                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-btn text-sm font-medium text-slate-600 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none shadow-sm cursor-pointer"
                            value={domainFilter}
                            onChange={(e) => { setDomainFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all">All Domains</option>
                            {domains.map(d => (
                                <option key={d.domain} value={d.domain}>{d.domain}</option>
                            ))}
                        </select>
                    )}

                    <select
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-btn text-sm font-medium text-slate-600 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none shadow-sm cursor-pointer"
                        value={planFilter}
                        onChange={(e) => { setPlanFilter(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="all">All Plans</option>
                        {availablePlans.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        className="px-3 py-2.5 bg-white border border-slate-200 rounded-btn text-sm font-medium text-slate-600 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none shadow-sm cursor-pointer"
                        value={monthFilter}
                        onChange={(e) => { setMonthFilter(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="all">All Expiry Months</option>
                        <option value="01">January ({monthCounts['01']})</option>
                        <option value="02">February ({monthCounts['02']})</option>
                        <option value="03">March ({monthCounts['03']})</option>
                        <option value="04">April ({monthCounts['04']})</option>
                        <option value="05">May ({monthCounts['05']})</option>
                        <option value="06">June ({monthCounts['06']})</option>
                        <option value="07">July ({monthCounts['07']})</option>
                        <option value="08">August ({monthCounts['08']})</option>
                        <option value="09">September ({monthCounts['09']})</option>
                        <option value="10">October ({monthCounts['10']})</option>
                        <option value="11">November ({monthCounts['11']})</option>
                        <option value="12">December ({monthCounts['12']})</option>
                    </select>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <button
                        onClick={() => setIsAssignModalOpen(true)}
                        className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm"
                    >
                        <PlusIcon /><span>Manual Subscription</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        Loading...
                    </div>
                ) : filteredSubs.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <BriefcaseIcon className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No subscriptions found</h3>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-10">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                checked={currentEntries.length > 0 && currentEntries.every(s => selectedIds.has(String(s.id)))}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">User Details</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Plan Details</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Billing Period</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Charges</th>
                                        <th className="px-6 py-3 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentEntries.map((sub, index) => {
                                        const subId = String(sub.id || index);
                                        return (
                                            <tr key={subId} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(subId) ? 'bg-brand-50/30' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                        checked={selectedIds.has(subId)}
                                                        onChange={() => handleSelectRow(subId)}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                                                            {sub.user?.charAt(0) || 'U'}
                                                        </div>
                                                        <div className="font-bold text-sm text-slate-900">{sub.user}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-bold text-sm text-brand-600">{sub.plan}</div>
                                                        <div className="text-xs text-slate-500">{sub.type}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-slate-600">
                                                        <div className="font-medium">Started: {sub.created}</div>
                                                        <div className="text-slate-400">Expires: {sub.expiry}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${sub.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : sub.status === 'Cancelled' || sub.status === 'Expired'
                                                            ? 'bg-red-50 text-red-700 border-red-100'
                                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                        {sub.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-mono font-medium text-slate-700">{sub.charges}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleViewHistory(sub.user_id)} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-brand-300 hover:text-brand-600 rounded-lg transition-colors shadow-sm">
                                                            History
                                                        </button>
                                                        <button onClick={() => handleEditClick(sub)} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-brand-300 hover:text-brand-600 rounded-lg transition-colors shadow-sm">
                                                            Edit
                                                        </button>
                                                        <button onClick={() => handleDeleteSubscription(sub.id)} className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-transparent rounded-lg transition-colors">
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                            <div className="text-xs font-medium text-slate-500">
                                Showing <span className="font-bold text-slate-700">{Math.min(filteredSubs.length, (currentPage - 1) * entriesPerPage + 1)}</span> to <span className="font-bold text-slate-700">{Math.min(filteredSubs.length, currentPage * entriesPerPage)}</span> of <span className="font-bold text-slate-700">{filteredSubs.length}</span> results
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm disabled:cursor-not-allowed"
                                >
                                    Prev
                                </button>
                                <div className="px-4 py-2 bg-brand-600 text-white rounded-btn text-sm font-bold shadow-sm shadow-brand-200">
                                    {currentPage}
                                </div>
                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    className="px-4 py-2 border border-slate-300 rounded-btn bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 text-sm font-bold shadow-sm disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Assignment Modal */}
            <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Manually Assign Subscription">
                <form onSubmit={handleAssignSubscription} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select User</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-brand-500 text-sm"
                            value={assignmentData.userId}
                            onChange={e => setAssignmentData({ ...assignmentData, userId: e.target.value })}
                        >
                            <option value="">-- Choose User --</option>
                            {availableUsers.map(u => (
                                <option key={u.id} value={u.id}>{u.name || u.email} ({u.email})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Plan</label>
                        <select
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-brand-500 text-sm"
                            value={assignmentData.planId}
                            onChange={e => setAssignmentData({ ...assignmentData, planId: e.target.value, pricingOptionIndex: -1 })}
                        >
                            <option value="">-- Choose Plan --</option>
                            {availablePlans.map(p => (
                                <option key={p.id} value={p.id}>{p.name} {p.is_active ? '' : '(Inactive)'}</option>
                            ))}
                        </select>
                    </div>

                    {assignmentData.planId && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Billing Duration</label>
                            <select
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-brand-500 text-sm"
                                value={assignmentData.pricingOptionIndex}
                                onChange={e => setAssignmentData({ ...assignmentData, pricingOptionIndex: parseInt(e.target.value) })}
                            >
                                <option value="-1">-- Choose Duration --</option>
                                {getPricingOptions(assignmentData.planId).map((opt: any, idx: number) => (
                                    <option key={idx} value={idx}>
                                        {opt.name} - ₹{opt.amount} ({opt.interval === 'day' ? `${opt.interval_count} Days` : opt.interval === 'month' ? `${opt.interval_count} Months` : '1 Year'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                        <button type="submit" disabled={isAssigning} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
                            {isAssigning ? 'Assigning...' : 'Assign Subscription'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* History Modal */}
            <Modal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Subscription History">
                <div className="space-y-4">
                    {historyLoading ? (
                        <div className="text-center py-8 text-slate-500">Loading history...</div>
                    ) : currentHistory.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">No history found for this user.</div>
                    ) : (
                        <div className="overflow-hidden border border-slate-200 rounded-lg">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Plan</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Duration</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {currentHistory.map((h: any) => (
                                        <tr key={h.id}>
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900">{h.plan}</td>
                                            <td className="px-4 py-3 text-sm text-slate-500">
                                                {h.start_date} - {h.end_date}
                                                <div className="text-xs text-slate-400">{h.payment_term}</div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${h.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {h.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-mono text-slate-700">
                                                {h.amount} {h.currency}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="flex justify-end pt-2">
                        <button onClick={() => setHistoryModalOpen(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Close</button>
                    </div>
                </div>
            </Modal>

            {/* Edit Subscription Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Subscription">
                <form onSubmit={handleUpdateSubscription} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Plan</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-brand-500 text-sm"
                            value={editData.planId}
                            onChange={e => handleEditPlanChange(e.target.value)}
                        >
                            <option value="">-- No Change --</option>
                            {availablePlans.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-brand-500 text-sm"
                            value={editData.status}
                            onChange={e => setEditData({ ...editData, status: e.target.value })}
                        >
                            <option value="active">Active</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                        <input
                            type="date"
                            className={`w-full px-3 py-2 border rounded-lg outline-none text-sm ${!isEditCustomDuration ? 'bg-slate-100 text-slate-500' : 'border-slate-300 focus:ring-brand-500'}`}
                            value={editData.expiryDate}
                            onChange={e => setEditData({ ...editData, expiryDate: e.target.value })}
                            disabled={!isEditCustomDuration}
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            {isEditCustomDuration ? "Changing this effectively extends or shortens the subscription." : "Auto-calculated based on plan duration."}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancel</button>
                        <button type="submit" disabled={isUpdating} className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50">
                            {isUpdating ? 'Updating...' : 'Update Subscription'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Toast Notification */}
            {toast && (
                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default Subscriptions;
