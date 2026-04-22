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
    CloseIcon
} from '../../../components/icons';
import Toast from '../../../components/Toast';
import Modal from '../../../components/Modal';

const Users = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'all' | 'trial'>('all');

    // Domain / Tenant State (Super Admin Only)
    const [domains, setDomains] = useState<any[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

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


    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        // Quick check for Super Admin status (Master Domain)
        const checkSuperAdmin = () => {
            // @ts-ignore
            const MASTER_URL = (import.meta as any).env.VITE_MASTER_URL || '';
            const hostname = window.location.hostname;
            const isMaster = MASTER_URL.includes(hostname) || hostname.includes('localhost');
            setIsSuperAdmin(isMaster);
            if (isMaster) fetchDomains();
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

    // Filter Logic
    const filteredUsers = users.filter(user => {
        // Tab Filter
        if (activeTab === 'trial' && !user.canTenantDelete) return false;

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
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
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
                                <thead className="bg-slate-50/80">
                                    <tr>
                                        <th className="px-6 py-4 text-left w-10">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                checked={currentEntries.length > 0 && currentEntries.every(u => selectedIds.has(u.id))}
                                                onChange={handleSelectAll}
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">User Details</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Domain</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Contact</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Role</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Plan</th>
                                        <th className="px-6 py-3 text-left text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Created</th>
                                        <th className="px-6 py-3 text-right text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {currentEntries.map((user) => (
                                        <tr key={user.id} className={`hover:bg-slate-50 transition-colors group ${selectedIds.has(user.id) ? 'bg-brand-50/30' : ''}`}>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4 cursor-pointer"
                                                    checked={selectedIds.has(user.id)}
                                                    onChange={() => handleSelectRow(user.id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
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
                                            <td className="px-6 py-4">
                                                <span
                                                    onClick={() => handleAction(user.status === 'Inactive' ? 'activate' : 'deactivate', user)}
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border cursor-pointer select-none hover:opacity-80 transition-opacity ${user.status === 'Active'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : user.status === 'Inactive'
                                                            ? 'bg-red-50 text-red-700 border-red-100'
                                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                                        }`}>
                                                    {user.status || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-slate-500 font-medium bg-slate-50 px-2 py-1 rounded border border-slate-100 inline-block">
                                                    {user.signupDomain || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs font-mono text-slate-600">{user.mobile || 'N/A'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600">
                                                    <BadgeIcon className="w-3 h-3" />
                                                    {user.adminStatus || 'Standard'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                                    {user.current_plan || 'Free'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-xs text-slate-500">{user.createdOn}</div>
                                                {user.canTenantDelete && (
                                                    <div className="text-[10px] font-bold text-amber-600 mt-0.5">
                                                        Can delete for {9 - (user.daysOld || 0)} more days
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleAction('Login', user)} 
                                                        disabled={user.status === 'Inactive'}
                                                        className={`px-2 py-1 text-xs font-bold rounded transition-colors ${
                                                            user.status === 'Inactive' 
                                                            ? 'text-slate-400 bg-slate-100 cursor-not-allowed' 
                                                            : 'text-brand-600 bg-brand-50 hover:bg-brand-100'
                                                        }`}
                                                    >
                                                        Login
                                                    </button>
                                                    {user.status === 'Inactive' ? (
                                                        <button onClick={() => handleAction('activate', user)} className="px-2 py-1 text-xs font-bold text-white bg-emerald-600 rounded hover:bg-emerald-700 shadow-sm transition-colors animate-pulse-subtle">Unblock</button>
                                                    ) : (
                                                        <button onClick={() => handleAction('deactivate', user)} className="px-2 py-1 text-xs font-bold text-amber-600 bg-amber-50 rounded hover:bg-amber-100 transition-colors">Block</button>
                                                    )}
                                                    <button onClick={() => {
                                                        setAssigningUser(user);
                                                        fetchPlans();
                                                        setIsPlanModalOpen(true);
                                                    }} className="px-2 py-1 text-xs font-bold text-brand-600 bg-brand-50 rounded hover:bg-brand-100 transition-colors">Plan</button>
                                                    <button onClick={() => handleAction('Edit', user)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={() => handleAction('Delete', user)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><TrashIcon className="w-4 h-4" /></button>
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
        </div>
    );
};

export default Users;
