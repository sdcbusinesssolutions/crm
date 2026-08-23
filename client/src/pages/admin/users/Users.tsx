import React, { useEffect, useState } from 'react';
import {
    SearchIcon,
    PlusIcon,
    TrashIcon,
    EditIcon,
    UsersIcon,
    ChevronDownIcon,
    BadgeIcon,
    CheckIcon,
    ZapIcon,
    CreditCardIcon,
    BriefcaseIcon,
    TagIcon,
    BookOpenIcon,
    MegaphoneIcon,
    EyeIcon,
    PauseIcon,
    PaymentIcon,
    ListIcon,
    ArchiveIcon,
    CloseIcon,
    UserCircleIcon,
    LinkIcon
} from '../../../components/icons';
import Toast from '../../../components/Toast';
import Modal from '../../../components/Modal';
import WalletTopupModal from './WalletTopupModal';
import WalletRatesModal from './WalletRatesModal';
import AdminWalletLedger from './AdminWalletLedger';
import DomainLedgerModal from './DomainLedgerModal';

const Users = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [domainFilter, setDomainFilter] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'all' | 'trial'>('all');

    // Domain / Tenant State (Super Admin Only)
    const [domains, setDomains] = useState<any[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loggedInMasterBalance, setLoggedInMasterBalance] = useState<number | null>(null);


    // Toast State
    const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);

    // Add User State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', mobile: '', signupDomain: '', role: 'user', isCustomDomain: false });

    // Edit User State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState({ id: '', name: '', email: '', password: '', mobile: '' });

    // Delete User State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingUser, setDeletingUser] = useState<any>(null);

    // Assign Plan State
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [assigningUser, setAssigningUser] = useState<any>(null);
    const [availablePlans, setAvailablePlans] = useState<any[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [planDuration, setPlanDuration] = useState('30');
    const [isCustomDuration, setIsCustomDuration] = useState(false);

    // Wallet State
    const [isWalletTopupOpen, setIsWalletTopupOpen] = useState(false);
    const [isWalletRatesOpen, setIsWalletRatesOpen] = useState(false);
    const [isWalletLedgerOpen, setIsWalletLedgerOpen] = useState(false);
    const [isDomainLedgerOpen, setIsDomainLedgerOpen] = useState(false);
    const [selectedWalletUser, setSelectedWalletUser] = useState<any>(null);

    // Master Wallet State
    const [isMasterTopupOpen, setIsMasterTopupOpen] = useState(false);
    const [masterTopupAmount, setMasterTopupAmount] = useState('');
    const [masterTopupDescription, setMasterTopupDescription] = useState('Monthly wholesale recharge');


    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Check for Super Admin status securely via backend
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
            } catch (e) {
                console.error('Failed to verify admin role', e);
            }

            // Fallback to hostname check
            if (!isMaster) {
                // @ts-ignore
                const MASTER_URL = (import.meta as any).env.VITE_MASTER_URL || '';
                const hostname = window.location.hostname;
                isMaster = MASTER_URL.includes(hostname) || hostname.includes('localhost');
            }

            setIsSuperAdmin(isMaster);
            if (isMaster) {
                fetchDomains();
            } else {
                // If Tenant Admin, fetch their own master balance to lock UI if depleted
                try {
                    const token = localStorage.getItem('adminToken');
                    if (token) {
                        const res = await fetch('/api/wallet/admin/master-balance', {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        if (res.ok) {
                            const data = await res.json();
                            setLoggedInMasterBalance(Number(data.balance || 0));
                        }
                    }
                } catch (e) {
                    console.error('Failed to fetch master balance', e);
                }
            }
        };


        checkSuperAdmin();
        fetchUsers();
    }, []);

    useEffect(() => {
        if (!selectedPlanId || !availablePlans.length) return;
        const plan = availablePlans.find(p => p.id === selectedPlanId);
        if (!plan) return;

        // Check for Custom Plan (case insensitive)
        const isCustom = (plan.name || '').toLowerCase().includes('custom');
        setIsCustomDuration(isCustom);

        if (isCustom) {
            // If strictly custom plan, allow manual input (keep current or default)
            return;
        }

        // Calculate duration from pricing
        if (plan.pricing && Array.isArray(plan.pricing) && plan.pricing.length > 0) {
            // Find first enabled pricing or fallback to first
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
                setPlanDuration(days.toString());
            }
        }
    }, [selectedPlanId, availablePlans]);

    const fetchDomains = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/dashboard/tenants', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDomains(data);
                if (data.length > 0) {
                    // Set default to first domain
                    setNewUser(prev => ({ ...prev, signupDomain: data[0].domain }));
                }
            }
        } catch (e) {
            console.error("Failed to load domains", e);
        }
    };

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            } else {
                setToast({ type: 'error', title: 'Error', message: 'Failed to fetch users' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Failed to load users' });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/plans', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAvailablePlans(data);
                if (data.length > 0) setSelectedPlanId(data[0].id);
            }
        } catch (error) {
            console.error("Failed to load plans", error);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/users/create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newUser)
            });

            const data = await res.json();
            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: 'User created successfully' });
                setIsAddModalOpen(false);
                setNewUser({ name: '', email: '', password: '', mobile: '', signupDomain: isSuperAdmin && domains.length > 0 ? domains[0].domain : '', role: 'user', isCustomDomain: false });
                fetchUsers();
            } else {
                setToast({ type: 'error', title: 'Error', message: data.message || 'Failed to create user' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/users/update', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: editingUser.id,
                    email: editingUser.email,
                    password: editingUser.password, // Only sent if changed
                    name: editingUser.name,
                    mobile: editingUser.mobile
                })
            });

            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: 'User updated successfully' });
                setIsEditModalOpen(false);
                fetchUsers();
            } else {
                const data = await res.json();
                setToast({ type: 'error', title: 'Error', message: data.message || 'Failed to update user' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUser = async () => {
        if (!deletingUser) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/users/delete', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: deletingUser.id })
            });

            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: 'User deleted successfully' });
                setIsDeleteModalOpen(false);
                setDeletingUser(null);
                fetchUsers();
            } else {
                const data = await res.json();
                setToast({ type: 'error', title: 'Error', message: data.message || 'Failed to delete user' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignPlanSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assigningUser || !selectedPlanId) return;

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/admin/users/assign-plan', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: assigningUser.id,
                    planId: selectedPlanId,
                    durationDays: planDuration
                })
            });

            const data = await res.json();
            if (res.ok) {
                setToast({ type: 'success', title: 'Success', message: `Plan assigned to ${assigningUser.name}` });
                setIsPlanModalOpen(false);
                setAssigningUser(null);
                fetchUsers(); // Refresh to show new plan status
            } else {
                setToast({ type: 'error', title: 'Error', message: data.message || 'Failed to assign plan' });
            }
        } catch (error) {
            console.error(error);
            setToast({ type: 'error', title: 'Error', message: 'Network error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleMasterTopupSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedWalletUser) return;
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/wallet/admin/topup-master', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tenantAdminUserId: selectedWalletUser.id,
                    amount: Number(masterTopupAmount),
                    description: masterTopupDescription
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to top-up master wallet');
            
            setToast({ type: 'success', title: 'Master Wallet Recharged', message: `Successfully added ₹${masterTopupAmount} to Agency Wallet.` });
            setIsMasterTopupOpen(false);
            setMasterTopupAmount('');
            fetchUsers();
        } catch (error: any) {
            setToast({ type: 'error', title: 'Recharge Failed', message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter Logic
    const domainFilteredUsers = users.filter(user => {
        if (domainFilter !== 'all' && user.signupDomain !== domainFilter) return false;
        return true;
    });

    const activeCount = domainFilteredUsers.filter(u => u.status === 'Active').length;
    const expiredCount = domainFilteredUsers.filter(u => u.status === 'Expired').length;
    const inactiveCount = domainFilteredUsers.filter(u => u.status === 'Inactive').length;

    const filteredUsers = domainFilteredUsers.filter(user => {
        // Tab Filter
        if (activeTab === 'trial' && !user.canTenantDelete) return false;

        // Status Filter
        if (statusFilter !== 'all') {
            const userStatus = user.status?.toLowerCase() || 'unknown';
            if (statusFilter === 'active' && userStatus !== 'active') return false;
            if (statusFilter === 'inactive' && userStatus !== 'inactive') return false;
            if (statusFilter === 'expired' && userStatus !== 'expired') return false;
        }

        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            (user.name?.toLowerCase() || '').includes(search) ||
            (user.email?.toLowerCase() || '').includes(search) ||
            (user.mobile?.toString() || '').includes(search) ||
            (user.status?.toLowerCase() || '').includes(search)
        );
    });

    const trialUsersCount = users.filter(u => u.canTenantDelete).length;

    const totalPages = Math.ceil(filteredUsers.length / entriesPerPage);
    const currentEntries = filteredUsers.slice((currentPage - 1) * entriesPerPage, currentPage * entriesPerPage);

    // Selection Logic
    const handleSelectAll = () => {
        const allOnPageSelected = currentEntries.length > 0 && currentEntries.every(u => selectedIds.has(u.id));
        const newSet = new Set(selectedIds);
        if (allOnPageSelected) {
            currentEntries.forEach(u => newSet.delete(u.id));
        } else {
            currentEntries.forEach(u => newSet.add(u.id));
        }
        setSelectedIds(newSet);
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // Mock Actions
    const handleAction = async (action: string, user: any) => {
        if (action === 'Login') {
            try {
                // Check if user is active first? No, server handles it.
                // But if plan expired, they can't login.
                // Impersonation bypasses login check usually, but good to know.

                setToast({ type: 'info', title: 'Impersonating...', message: `Generating login link for ${user.name}...` });
                const token = localStorage.getItem('adminToken');
                const res = await fetch('/api/admin/users/login-as', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: user.email })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.url) {
                        setToast({ type: 'success', title: 'Success', message: 'Redirecting to user dashboard...' });
                        // Open in new tab to keep Admin panel open
                        window.open(data.url, '_blank');
                    } else {
                        setToast({ type: 'error', title: 'Error', message: 'Server returned no URL.' });
                    }
                } else {
                    const err = await res.json();
                    setToast({ type: 'error', title: 'Impersonation Failed', message: err.message || 'Unknown error' });
                }
            } catch (error) {
                console.error('Impersonation error:', error);
                setToast({ type: 'error', title: 'Error', message: 'Failed to impersonate user.' });
            }
            return;
        }

        if (action === 'activate' || action === 'deactivate') {
            try {
                const token = localStorage.getItem('adminToken');
                const res = await fetch('/api/admin/users/status-toggle', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, action })
                });

                if (res.ok) {
                    setToast({ type: 'success', title: 'Success', message: `User ${action}d successfully` });
                    fetchUsers(); // Refresh list
                } else {
                    setToast({ type: 'error', title: 'Error', message: `Failed to ${action} user` });
                }
            } catch (err) {
                console.error(err);
                setToast({ type: 'error', title: 'Error', message: 'Network error' });
            }
            return;
        }
        if (action === 'Edit') {
            setEditingUser({
                id: user.id,
                name: user.name,
                email: user.email,
                mobile: user.mobile === 'N/A' ? '' : user.mobile,
                password: '' // Don't prefill password
            });
            setIsEditModalOpen(true);
            return;
        }

        if (action === 'Delete') {
            setDeletingUser(user);
            setIsDeleteModalOpen(true);
            return;
        }

        if (action === 'WalletTopup') {
            setSelectedWalletUser(user);
            setIsWalletTopupOpen(true);
            return;
        }

        if (action === 'MasterTopup') {
            setSelectedWalletUser(user);
            setMasterTopupAmount('');
            setIsMasterTopupOpen(true);
            return;
        }

        if (action === 'WalletRates') {
            setSelectedWalletUser(user);
            setIsWalletRatesOpen(true);
            return;
        }

        if (action === 'WalletLedger') {
            setSelectedWalletUser(user);
            setIsWalletLedgerOpen(true);
            return;
        }

        console.log(`${action} for user:`, user);
        setToast({ type: 'info', title: 'Action Triggered', message: `${action} for ${user.name}` });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200">
                <button 
                    onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'all' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    All Users ({users.length})
                </button>
                <button 
                    onClick={() => { setActiveTab('trial'); setCurrentPage(1); }}
                    className={`px-6 py-3 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'trial' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    Recent Signups / Trial ({trialUsersCount})
                    {trialUsersCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>}
                </button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 lg:max-w-2xl">
                    <div className="relative group flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-500 transition-colors">
                            <SearchIcon />
                        </div>
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="pl-10 pr-4 py-2.5 w-full bg-white border border-slate-200 rounded-btn focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm outline-none transition-all"
                        />
                    </div>

                    {isSuperAdmin && domains.length > 0 && (
                        <div className="relative group w-full sm:w-48">
                            <select
                                value={domainFilter}
                                onChange={(e) => { setDomainFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full appearance-none bg-white border border-slate-200 rounded-btn px-4 py-2.5 pr-10 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm outline-none transition-all text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="all">All Domains</option>
                                {domains.map(d => (
                                    <option key={d.domain} value={d.domain}>{d.domain}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                                <ChevronDownIcon />
                            </div>
                        </div>
                    )}

                    <div className="relative group w-full sm:w-56">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full appearance-none bg-white border border-slate-200 rounded-btn px-4 py-2.5 pr-10 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm shadow-sm outline-none transition-all text-slate-700 font-medium cursor-pointer"
                        >
                            <option value="all">All Statuses ({domainFilteredUsers.length})</option>
                            <option value="active">Active ({activeCount})</option>
                            <option value="expired">Expired ({expiredCount})</option>
                            <option value="inactive">Inactive ({inactiveCount})</option>
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <ChevronDownIcon />
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                    <button
                        onClick={() => setIsDomainLedgerOpen(true)}
                        className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-btn font-bold shadow-md shadow-slate-200 transition-all transform hover:-translate-y-0.5 text-sm"
                    >
                        <span>Master Ledger Report 📊</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center space-x-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-btn font-bold shadow-md shadow-brand-200 transition-all transform hover:-translate-y-0.5 text-sm"
                    >
                        <PlusIcon /><span>Add User</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        Loading...
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="p-16 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <UsersIcon className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No users found</h3>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-100">
                                <thead className="bg-brand-600 text-white shadow-md">
                                    <tr>
                                        <th className="px-3 py-5 text-left w-10 !bg-brand-600">
                                            <input
                                                type="checkbox"
                                                className="rounded border-white/30 text-brand-500 focus:ring-white h-4 w-4 cursor-pointer"
                                                checked={currentEntries.length > 0 && currentEntries.every(u => selectedIds.has(u.id))}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">User Details</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Status</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Domain</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Contact</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Role</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Plan</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Wallet</th>
                                        <th className="px-3 py-5 text-left text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Created</th>
                                        <th className="px-3 py-5 text-right text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-sm !bg-brand-600 whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentEntries.map((user) => (
                                        <tr key={user.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(user.id) ? 'bg-brand-50/30' : ''}`}>
                                            <td className="px-3 py-3">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                    checked={selectedIds.has(user.id)}
                                                    onChange={() => handleSelectRow(user.id)}
                                                />
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user.canTenantDelete ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {user.name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-bold text-slate-900">{user.name || 'N/A'}</div>
                                                            {user.isTrialUser && (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200">Trial</span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-slate-500">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span
                                                    onClick={() => handleAction(user.status === 'Inactive' ? 'activate' : 'deactivate', user)}
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border cursor-pointer select-none hover:opacity-80 transition-opacity ${user.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : user.status === 'Inactive'
                                                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                            : user.status === 'Expired'
                                                                ? 'bg-red-50 text-red-700 border-red-200 animate-pulse-subtle'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                    {user.status || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                {user.signupDomain ? (
                                                    <a href={`https://${user.signupDomain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline bg-brand-50 hover:bg-brand-100 px-2.5 py-1 rounded-full transition-colors border border-brand-100">
                                                        <LinkIcon className="w-3 h-3" />
                                                        {user.signupDomain}
                                                    </a>
                                                ) : (
                                                    <span className="text-[11px] text-slate-400 font-bold italic bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="text-xs font-mono text-slate-600">{user.mobile || 'N/A'}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize border whitespace-nowrap ${
                                                    user.adminStatus === 'super_admin' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    user.adminStatus === 'admin' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-slate-50 text-slate-600 border-slate-200'
                                                }`}>
                                                    {user.adminStatus === 'super_admin' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                                    ) : user.adminStatus === 'admin' ? (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                                    ) : (
                                                        <UserCircleIcon className="w-3.5 h-3.5" />
                                                    )}
                                                    {user.adminStatus ? user.adminStatus.replace('_', ' ') : 'User'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="flex flex-col items-start gap-1">
                                                    <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                                                        user.current_plan?.toLowerCase().includes('premium') ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                                        user.current_plan?.toLowerCase().includes('trial') ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                                                        'bg-slate-50 text-slate-700 border-slate-200'
                                                    }`}>
                                                        {user.current_plan || 'Free'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                {user.is_tenant_admin ? (
                                                    /* Tenant Admin: show Master Wallet status */
                                                    <div>
                                                        {user.master_wallet_balance === null ? (
                                                            /* Never been funded by Super Admin */
                                                            <div className="flex flex-col gap-1">
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                                                    🏛 No Credit Line
                                                                </span>
                                                                <div className="text-[10px] text-slate-400">Not funded yet</div>
                                                            </div>
                                                        ) : Number(user.master_wallet_balance) <= 0 ? (
                                                            /* Depleted — needs recharge urgently */
                                                            <div className="flex flex-col gap-1">
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                                                                    🚨 ₹0.00
                                                                </span>
                                                                <div className="text-[10px] text-red-500 font-bold">Agency depleted!</div>
                                                            </div>
                                                        ) : Number(user.master_wallet_balance) < 500 ? (
                                                            /* Low balance — warning */
                                                            <div className="flex flex-col gap-1">
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                                                    ⚠️ ₹{Number(user.master_wallet_balance).toFixed(2)}
                                                                </span>
                                                                <div className="text-[10px] text-amber-600">Agency low</div>
                                                            </div>
                                                        ) : (
                                                            /* Healthy */
                                                            <div className="flex flex-col gap-1">
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                                    🏛 ₹{Number(user.master_wallet_balance).toFixed(2)}
                                                                </span>
                                                                <div className="text-[10px] text-slate-400">Agency wallet</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* Regular User: show their message-sending balance */
                                                    <div className="flex flex-col gap-1">
                                                        <div className={`text-xs font-bold ${Number(user.wallet_balance || 0) < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                                                            ₹{Number(user.wallet_balance || 0).toFixed(2)}
                                                        </div>
                                                        <span className={`inline-block w-max text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                            (!user.billing_mode || user.billing_mode === 'CREDIT_LINE_SUPER')
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : user.billing_mode === 'CREDIT_LINE_TENANT'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {(!user.billing_mode || user.billing_mode === 'CREDIT_LINE_SUPER') 
                                                                ? '🏛 Super Credit' 
                                                                : user.billing_mode === 'CREDIT_LINE_TENANT' 
                                                                    ? '🏢 Tenant Credit' 
                                                                    : '💳 Direct Meta'}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3">
                                                <div className="text-xs text-slate-500">{user.createdOn}</div>
                                                {user.canTenantDelete && (
                                                    <div className="text-[10px] font-bold text-amber-600 mt-0.5">
                                                        Can delete for {9 - (user.daysOld || 0)} more days
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                                <div className="flex flex-nowrap items-center justify-end gap-1.5 transition-opacity whitespace-nowrap">
                                                    <button 
                                                        onClick={() => handleAction('Login', user)} 
                                                        disabled={user.status === 'Inactive'}
                                                        title="Login as User"
                                                        className={`flex items-center gap-1 px-1.5 py-1 rounded-md transition-colors ${
                                                            user.status === 'Inactive' 
                                                            ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                                                            : 'text-brand-700 hover:bg-brand-100 bg-brand-50'
                                                        }`}
                                                    >
                                                        <EyeIcon className="w-3.5 h-3.5" />
                                                        <span className="text-[10px] font-bold leading-none">Login</span>
                                                    </button>
                                                    {user.status === 'Inactive' ? (
                                                        <button onClick={() => handleAction('activate', user)} className="flex items-center gap-1 px-1.5 py-1 text-white bg-emerald-600 rounded-md hover:bg-emerald-700 shadow-sm transition-colors animate-pulse-subtle"><CheckIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Unblock</span></button>
                                                    ) : (
                                                        <button onClick={() => handleAction('deactivate', user)} className="flex items-center gap-1 px-1.5 py-1 text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"><PauseIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Block</span></button>
                                                    )}
                                                    <button onClick={() => {
                                                        setAssigningUser(user);
                                                        fetchPlans();
                                                        setIsPlanModalOpen(true);
                                                    }} className="flex items-center gap-1 px-1.5 py-1 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"><ArchiveIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Plan</span></button>
                                                    {isSuperAdmin ? (
                                                        <>
                                                            <button onClick={() => handleAction('WalletTopup', user)} className="flex items-center gap-1 px-1.5 py-1 text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors"><PaymentIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">{user.billing_mode === 'DIRECT_META' ? 'Billing' : 'Top-up'}</span></button>
                                                            {user.is_tenant_admin && (
                                                                <button onClick={() => handleAction('MasterTopup', user)} className="flex items-center gap-1 px-1.5 py-1 text-purple-700 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors animate-pulse-subtle"><BriefcaseIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Agency</span></button>
                                                            )}
                                                            <button onClick={() => handleAction('WalletRates', user)} className="flex items-center gap-1 px-1.5 py-1 text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"><TagIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Rates</span></button>
                                                            <button onClick={() => handleAction('WalletLedger', user)} className="flex items-center gap-1 px-1.5 py-1 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"><ListIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Ledger</span></button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {loggedInMasterBalance !== null && loggedInMasterBalance <= 0 ? (
                                                                <button disabled className="flex items-center gap-1 px-1.5 py-1 text-slate-400 bg-slate-100 cursor-not-allowed rounded-md" title="Agency Wallet Depleted. Contact Super Admin.">
                                                                    <PaymentIcon className="w-3.5 h-3.5 opacity-50" /><span className="text-[10px] font-bold leading-none">Top-up</span>
                                                                </button>
                                                            ) : (
                                                                <button onClick={() => handleAction('WalletTopup', user)} className="flex items-center gap-1 px-1.5 py-1 text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors"><PaymentIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">{user.billing_mode === 'DIRECT_META' ? 'Billing' : 'Top-up'}</span></button>
                                                            )}
                                                            <button onClick={() => handleAction('WalletRates', user)} className="flex items-center gap-1 px-1.5 py-1 text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"><TagIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Rates</span></button>
                                                            <button onClick={() => handleAction('WalletLedger', user)} className="flex items-center gap-1 px-1.5 py-1 text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"><ListIcon className="w-3.5 h-3.5" /><span className="text-[10px] font-bold leading-none">Ledger</span></button>
                                                        </>
                                                    )}


                                                    <div className="w-px h-5 bg-slate-200 mx-0.5"></div>
                                                    <button onClick={() => handleAction('Edit', user)} className="p-1 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-md transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleAction('Delete', user)} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center gap-4">
                            <div className="text-xs font-medium text-slate-500">
                                Showing <span className="font-bold text-slate-700">{Math.min(filteredUsers.length, (currentPage - 1) * entriesPerPage + 1)}</span> to <span className="font-bold text-slate-700">{Math.min(filteredUsers.length, currentPage * entriesPerPage)}</span> of <span className="font-bold text-slate-700">{filteredUsers.length}</span> results
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

            {/* Toast Notification */}
            {toast && (
                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}

            {/* Add User Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="Add New User"
            >
                <form onSubmit={handleCreateUser} className="space-y-4">
                    {/* SUPER ADMIN: Domain Selection */}
                    {isSuperAdmin && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Assign to Workspace (Domain)</label>

                            {/* Toggle between Dropdown and Custom Input */}
                            <div className="flex gap-2 mb-2">
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input
                                        type="radio"
                                        name="domainType"
                                        checked={!newUser.isCustomDomain}
                                        onChange={() => setNewUser(prev => ({ ...prev, isCustomDomain: false, signupDomain: domains.length > 0 ? domains[0].domain : '' }))}
                                        className="text-brand-600 focus:ring-brand-500"
                                    />
                                    Select from List
                                </label>
                                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                                    <input
                                        type="radio"
                                        name="domainType"
                                        checked={!!newUser.isCustomDomain}
                                        onChange={() => setNewUser(prev => ({ ...prev, isCustomDomain: true, signupDomain: '' }))}
                                        className="text-brand-600 focus:ring-brand-500"
                                    />
                                    Enter Manually
                                </label>
                            </div>

                            {!newUser.isCustomDomain ? (
                                <div className="relative">
                                    <select
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800 appearance-none bg-white"
                                        value={newUser.signupDomain}
                                        onChange={e => setNewUser({ ...newUser, signupDomain: e.target.value })}
                                    >
                                        {domains.map(d => (
                                            <option key={d.domain} value={d.domain}>
                                                {d.domain} ({d.brand_name || 'Unnamed'})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <ChevronDownIcon className="w-4 h-4 text-slate-500" />
                                    </div>
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800 bg-white"
                                    value={newUser.signupDomain}
                                    onChange={e => setNewUser({ ...newUser, signupDomain: e.target.value })}
                                    placeholder="e.g. apiautomation.in"
                                />
                            )}

                            <p className="text-xs text-slate-500 mt-1">
                                {newUser.isCustomDomain
                                    ? "Enter the exact domain name for this workspace."
                                    : "Select an existing active workspace."}
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">User Role</label>
                        <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800 bg-white"
                            value={newUser.role}
                            onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                        >
                            <option value="user">Tenant User (Standard)</option>
                            <option value="admin">Tenant Admin (Full Access)</option>
                            {isSuperAdmin && <option value="super_admin">Super Admin (System Owner)</option>}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            {newUser.role === 'admin'
                                ? "Can manage users, settings, and billing for this workspace."
                                : "Standard access to configured features only."}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={newUser.name}
                            onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                            placeholder="John Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={newUser.email}
                            onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                            placeholder="john@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={newUser.password}
                            onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                            placeholder="******"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                        <input
                            type="tel"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={newUser.mobile}
                            onChange={e => setNewUser({ ...newUser, mobile: e.target.value })}
                            placeholder="+1234567890"
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsAddModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Edit User"
            >
                <form onSubmit={handleEditUser} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input
                            type="text"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={editingUser.name}
                            onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input
                            type="email"
                            required
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={editingUser.email}
                            onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password (Optional)</label>
                        <input
                            type="password"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={editingUser.password}
                            onChange={e => setEditingUser({ ...editingUser, password: e.target.value })}
                            placeholder="Leave blank to keep current"
                            minLength={6}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                        <input
                            type="tel"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                            value={editingUser.mobile}
                            onChange={e => setEditingUser({ ...editingUser, mobile: e.target.value })}
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                title="Confirm Delete"
            >
                <div className="space-y-4">
                    <p className="text-slate-600">
                        Are you sure you want to delete user <span className="font-bold text-slate-900">{deletingUser?.name}</span>?
                        This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteUser}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Deleting...' : 'Delete User'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Assign Plan Modal */}
            <Modal
                isOpen={isPlanModalOpen}
                onClose={() => setIsPlanModalOpen(false)}
                title="Assign Plan"
            >
                <form onSubmit={handleAssignPlanSubmit} className="space-y-4">
                    <p className="text-sm text-slate-600 mb-4">
                        Assigning a plan to <span className="font-bold text-slate-900">{assigningUser?.name}</span>.
                        This will override their current subscription.
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Select Plan</label>
                        {availablePlans.length > 0 ? (
                            <div className="space-y-2">
                                {availablePlans.map(plan => (
                                    <label key={plan.id} className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${selectedPlanId === plan.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'}`}>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="radio"
                                                name="plan"
                                                value={plan.id}
                                                checked={selectedPlanId === plan.id}
                                                onChange={() => setSelectedPlanId(plan.id)}
                                                className="text-brand-600 focus:ring-brand-500"
                                            />
                                            <div>
                                                <div className="font-bold text-slate-900">{plan.name}</div>
                                                <div className="text-xs text-slate-500">
                                                    {(plan.pricing && plan.pricing[0]) ? `${plan.pricing[0].amount} ${plan.pricing[0].currency || 'INR'}` : 'Custom Pricing'}
                                                </div>
                                            </div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center p-4 bg-slate-50 rounded-lg text-slate-500">
                                No plans available. Please create a plan first.
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Duration (Days)</label>
                        {isCustomDuration ? (
                            <input
                                type="number"
                                min="1"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 outline-none text-slate-800"
                                value={planDuration}
                                onChange={e => setPlanDuration(e.target.value)}
                                placeholder="30"
                            />
                        ) : (
                            <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-medium">
                                {planDuration} Days
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                            Plan will expire on {new Date(Date.now() + parseInt(planDuration || '0') * 86400000).toLocaleDateString()}.
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => setIsPlanModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || availablePlans.length === 0}
                            className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                        >
                            {isSubmitting ? 'Assigning...' : 'Assign Plan'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Wallet Modals */}
            {isWalletTopupOpen && selectedWalletUser && (
                <WalletTopupModal
                    isOpen={isWalletTopupOpen}
                    onClose={() => setIsWalletTopupOpen(false)}
                    user={selectedWalletUser}
                    isSuperAdmin={isSuperAdmin}
                    onSuccess={() => {
                        setToast({ type: 'success', title: 'Success', message: 'Wallet updated successfully' });
                    }}
                />
            )}

            {isWalletRatesOpen && selectedWalletUser && (
                <WalletRatesModal
                    isOpen={isWalletRatesOpen}
                    onClose={() => { setIsWalletRatesOpen(false); setSelectedWalletUser(null); }}
                    user={selectedWalletUser}
                    onSuccess={() => {
                        setToast({ type: 'success', title: 'Success', message: 'Rates updated successfully' });
                    }}
                />
            )}

            {/* Wallet Ledger — full transaction history for a user */}
            {isWalletLedgerOpen && selectedWalletUser && (
                <AdminWalletLedger
                    user={selectedWalletUser}
                    onClose={() => { setIsWalletLedgerOpen(false); setSelectedWalletUser(null); }}
                />
            )}


            <Modal isOpen={isMasterTopupOpen} onClose={() => setIsMasterTopupOpen(false)} title={`Recharge Agency Wallet`}>
                <form onSubmit={handleMasterTopupSubmit} className="p-6 space-y-6">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="text-sm font-bold text-amber-800 mb-1">🏛 Wholesale Credit Pool</div>
                        <p className="text-xs text-amber-700">
                            You are adding credits directly to the Master Wallet for <strong>{selectedWalletUser?.name} ({selectedWalletUser?.signupDomain})</strong>. They will use this balance to top-up their sub-users.
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Amount (₹)</label>
                            <input
                                type="number"
                                required
                                min="1"
                                value={masterTopupAmount}
                                onChange={(e) => setMasterTopupAmount(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="e.g. 5000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                            <input
                                type="text"
                                required
                                value={masterTopupDescription}
                                onChange={(e) => setMasterTopupDescription(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                placeholder="Monthly wholesale recharge"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                        <button type="button" onClick={() => setIsMasterTopupOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
                            {isSubmitting ? 'Recharging...' : 'Confirm Recharge'}
                        </button>
                    </div>
                </form>
            </Modal>
            {isDomainLedgerOpen && (
                <DomainLedgerModal 
                    isSuperAdmin={isSuperAdmin}
                    domainFilter={domainFilter !== 'all' ? domainFilter : undefined}
                    onClose={() => setIsDomainLedgerOpen(false)} 
                />
            )}
        </div>
    );
};

export default Users;
