import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import '../../styles/admin/main.css';
import { themeService, PRESETS } from '../../services/themeService';
import { ThemeConfig } from '../../types';

const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState<ThemeConfig>(PRESETS[0]);
    const [isAdminSuper, setIsAdminSuper] = useState(false);
    const [adminEmail, setAdminEmail] = useState('');
    const [adminName, setAdminName] = useState('Admin');
    const [masterBalance, setMasterBalance] = useState<number | null>(null);


    useEffect(() => {
        const verifyLegacyToken = async () => {
            const token = localStorage.getItem('adminToken');
            if (!token) return false;
            try {
                const res = await fetch('/api/admin/auth/me', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const adminData = await res.json();
                    setAdminEmail(adminData.email || '');
                    setAdminName(adminData.name || 'Administrator');
                    // Dynamic Role Check: Only set as super if role strictly matches
                    setIsAdminSuper(adminData.role === 'super_admin');
                    return true;
                }
            } catch (e) {
                console.error("Token verification failed", e);
            }
            return false;
        };

        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setAdminEmail(user.email || '');
                const { data } = await supabase
                    .from('profiles')
                    .select('role, full_name, name')
                    .eq('id', user.id)
                    .single();

                if (data) {
                    const profile = data as any;
                    if (profile.role === 'admin' || profile.role === 'super_admin') {
                        // Success via Supabase
                        setAdminName(profile.full_name || profile.name || 'Admin');
                        if (profile.role === 'super_admin') setIsAdminSuper(true);
                        return;
                    }
                }
            }

            // Fallback: Check for Backend Legacy Token if Supabase failed or user is not admin
            const legacySuccess = await verifyLegacyToken();
            if (legacySuccess) return;

            // If both fail, redirect
            console.warn('Unauthorized access to admin panel');
            navigate('/admin/auth/login');
        };

        checkRole();
    }, []);

    // Fetch Tenant Admin Master Wallet Balance (shown in header)
    useEffect(() => {
        if (isAdminSuper) return; // Super Admins don't have a Master Wallet limit
        const fetchMaster = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                if (!token) return;
                const res = await fetch('/api/wallet/admin/master-balance', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setMasterBalance(Number(data.balance || 0));
                }
            } catch (e) { /* ignore */ }
        };
        fetchMaster();
        const interval = setInterval(fetchMaster, 60000); // Refresh every 60s
        return () => clearInterval(interval);
    }, [isAdminSuper]);

    const handleLogout = () => {
        localStorage.removeItem('adminToken');
        navigate('/admin/auth/login');
    };

    // Load Admin Theme on Mount
    useEffect(() => {
        const loadTheme = () => {
            const stored = localStorage.getItem('admin_theme_config');
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setTheme(parsed);
                    themeService.applyTheme(parsed);
                } catch (e) {
                    themeService.applyTheme(PRESETS[0]);
                }
            } else {
                themeService.applyTheme(PRESETS[0]);
            }
        };
        loadTheme();

        // Listen for theme changes from Settings page
        const handleStorageChange = () => loadTheme();
        window.addEventListener('admin-theme-changed', handleStorageChange);

        return () => window.removeEventListener('admin-theme-changed', handleStorageChange);
    }, []);

    const menuItems = [
        { path: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/admin/users', label: 'Users', icon: '👥' },
        { path: '/admin/subscriptions', label: 'Subscriptions', icon: '💳' },
        { path: '/admin/plans', label: 'Plans', icon: '📝' },
        { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
        { path: '/admin/references', label: 'References', icon: '🔗' },
        { path: '/admin/video-guides', label: 'Video Guides', icon: '▶️' },
    ];

    if (isAdminSuper) {
        menuItems.push({ path: '/admin/pricing', label: 'Message Price', icon: '💰' });
        menuItems.push({ path: '/admin/super', label: 'Super Panel', icon: '🚀' });
        menuItems.push({ path: '/admin/limits', label: 'Staff Limit', icon: '🚧' });
        menuItems.push({ path: '/admin/super/video-guides', label: 'Global Videos', icon: '🎥' });
    }

    return (
        <div className="admin-layout flex h-screen bg-[var(--bg-color)] text-[var(--text-color)] font-sans">
            <aside className="w-64 flex flex-col border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] transition-colors duration-300">
                <div className="p-6">
                    <div className="flex items-center gap-3 text-[var(--primary-color)]">
                        <div className="w-8 h-8 rounded-lg bg-[var(--primary-color)] text-white flex items-center justify-center font-bold text-xl">A</div>
                        <h1 className="font-bold text-xl tracking-tight text-[var(--text-color)]">Admin</h1>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                    {menuItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${location.pathname === item.path
                                ? 'bg-[var(--primary-color)] text-white shadow-md shadow-[var(--primary-color)]/20'
                                : 'text-[var(--text-color)] hover:bg-[var(--bg-color)] hover:text-[var(--primary-color)]'
                                }`}
                        >
                            <span>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="p-4 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-color)]/50">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">AD</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[var(--text-color)] truncate">{adminName}</p>
                            <p className="text-xs text-slate-400 truncate">{adminEmail}</p>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-color)]">
                <header className="h-16 border-b border-[var(--border-color)] bg-[var(--sidebar-bg)] flex items-center justify-between px-8">
                    <h2 className="text-lg font-bold text-[var(--text-color)] capitalize">
                        {location.pathname.split('/').pop()}
                    </h2>
                    <div className="flex items-center gap-4">
                        {/* Master Wallet Balance Badge for Tenant Admins */}
                        {!isAdminSuper && masterBalance !== null && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                                masterBalance <= 0
                                    ? 'bg-red-50 border-red-200 text-red-700'
                                    : masterBalance < 500
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}>
                                <span>🏛</span>
                                <span>Agency Wallet: ₹{masterBalance.toFixed(2)}</span>
                            </div>
                        )}
                        <button onClick={handleLogout} className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
                            Sign Out
                        </button>
                    </div>
                </header>


                <div className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default AdminLayout;
