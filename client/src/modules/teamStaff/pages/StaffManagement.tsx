import React, { useState, useEffect } from 'react';
import { staffApi } from '../api/staffApi';
import PermissionMatrix from '../components/PermissionMatrix';
import { MODULES, ACCESS_TYPES } from '../constants';
import { usePermissions } from '../hooks/usePermissions';
import Modal from '../../../components/Modal';
import Toast from '../../../components/Toast';

const getAvatarStyle = (name: string) => {
  if (!name) return 'bg-indigo-50 text-indigo-600 border border-indigo-100';
  const charCode = name.charCodeAt(0) + (name.charCodeAt(name.length - 1) || 0);
  const styles = [
    'bg-indigo-50 text-indigo-600 border border-indigo-100',
    'bg-emerald-50 text-emerald-600 border border-emerald-100',
    'bg-amber-50 text-amber-600 border border-amber-100',
    'bg-purple-50 text-purple-600 border border-purple-100',
    'bg-pink-50 text-pink-600 border border-pink-100',
    'bg-sky-50 text-sky-600 border border-sky-100'
  ];
  return styles[charCode % styles.length];
};

const StaffManagement: React.FC = () => {
  const [staffList, setStaffList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<{id: string, name: string} | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', phone: '', role: 'staff' });
  const [currentPermissions, setCurrentPermissions] = useState<any>({});
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedStaffForPassword, setSelectedStaffForPassword] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const { isStaff } = usePermissions();

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const data = await staffApi.listStaff();
      setStaffList(data);
    } catch (err) {
      console.error('Failed to load staff', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await staffApi.createStaff(newStaff);
      setIsModalOpen(false);
      loadStaff();
      setNewStaff({ name: '', email: '', password: '', phone: '', role: 'staff' });
      setToast({ type: 'success', title: 'Success', message: 'Staff member created successfully.' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to create staff';
      setToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const openPermissionModal = (staff: any) => {
    setSelectedStaff(staff);
    setCurrentPermissions(staff.permissions || {}); 
    setIsPermModalOpen(true);
  };

  const handlePermissionChange = (module: string, access: string) => {
    setCurrentPermissions((prev: any) => ({ ...prev, [module]: access }));
  };

  const savePermissions = async () => {
    setLoading(true);
    try {
      await staffApi.updatePermissions(selectedStaff.id, currentPermissions);
      setIsPermModalOpen(false);
      loadStaff();
      setToast({ type: 'success', title: 'Permissions Updated', message: 'Permissions have been saved successfully.' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to update permissions';
      setToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (staffId: string, staffName: string) => {
    setStaffToDelete({ id: staffId, name: staffName });
    setIsDeleteModalOpen(true);
  };

  const proceedDelete = async () => {
    if (!staffToDelete) return;
    setLoading(true);
    try {
      await staffApi.deleteStaff(staffToDelete.id);
      loadStaff();
      setIsDeleteModalOpen(false);
      setStaffToDelete(null);
      setToast({ type: 'success', title: 'Deleted', message: 'Staff member deleted successfully.' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to delete staff';
      setToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (staff: any) => {
    const newStatus = staff.status === 'active' ? 'inactive' : 'active';
    setLoading(true);
    try {
      await staffApi.updateStaff(staff.id, { status: newStatus });
      loadStaff();
      setToast({ type: 'success', title: 'Status Updated', message: `Staff member is now ${newStatus}.` });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to update status';
      setToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setToast({ type: 'error', title: 'Invalid Password', message: 'Password must be at least 6 characters long.' });
      return;
    }
    setLoading(true);
    try {
      await staffApi.updateStaff(selectedStaffForPassword.id, { password: newPassword });
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setToast({ type: 'success', title: 'Success', message: 'Password updated successfully.' });
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to update password';
      setToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (isStaff) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center border border-slate-100">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">🚫</div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Restricted Access</h2>
          <p className="text-slate-500 font-medium mb-8">This module is reserved for Account Owners only. Staff members cannot manage team permissions.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold transition-all active:scale-95"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#f8fafc] min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Team Staff</h1>
            <p className="text-slate-500 text-sm font-medium">Manage your team members and their module permissions</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="group flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
          >
            <svg className="w-5 h-5 transition-transform group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            Add Team Member
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-[#00684a]/40 overflow-hidden">
          <table className="min-w-full border-separate border-spacing-0">
            <thead className="bg-[#00684a] text-white shadow-md">
              <tr className="bg-[#00684a] text-white shadow-md border-b border-white/20">
                <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-[#00684a] border-b border-white/20 whitespace-nowrap">Team Member</th>
                <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-[#00684a] border-b border-white/20 whitespace-nowrap">Role</th>
                <th className="px-6 py-5 text-left font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-[#00684a] border-b border-white/20 whitespace-nowrap">Status</th>
                <th className="px-6 py-5 text-right font-black uppercase tracking-wider text-xs text-white drop-shadow-sm !bg-[#00684a] border-b border-white/20 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">
                    No team members found. Click "Add Team Member" to start.
                  </td>
                </tr>
              ) : staffList.map((staff: any) => (
                <tr key={staff.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                  <td className="px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-transform hover:scale-105 shadow-sm ${getAvatarStyle(staff.name)}`}>
                        {staff.name ? staff.name[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{staff.name}</div>
                        <div className="text-xs text-slate-500 font-medium">{staff.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-600 capitalize">{staff.role}</span>
                  </td>
                  <td className="px-6 py-4 border-b border-slate-100">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${staff.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${staff.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                      {staff.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right border-b border-slate-100">
                    <div className="flex justify-end items-center gap-2">
                      <button 
                        onClick={() => openPermissionModal(staff)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 shadow-sm hover:shadow border border-indigo-100 active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Permissions
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedStaffForPassword(staff);
                          setNewPassword('');
                          setIsPasswordModalOpen(true);
                        }}
                        title="Change Password"
                        className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 hover:shadow-md transition-all flex items-center justify-center disabled:opacity-50 active:scale-90"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                        </svg>
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(staff)}
                        title={staff.status === 'active' ? "Lock Account" : "Unlock Account"}
                        className={`w-8 h-8 rounded-full border transition-all flex items-center justify-center disabled:opacity-50 active:scale-90 ${
                          staff.status === 'active' 
                            ? 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-amber-500 hover:text-white hover:border-amber-500 hover:shadow-md' 
                            : 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 hover:shadow-md'
                        }`}
                      >
                        {staff.status === 'active' ? (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2z" /></svg>
                        )}
                      </button>
                      <button 
                        onClick={() => handleDelete(staff.id, staff.name)}
                        disabled={loading}
                        className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 hover:shadow-md transition-all flex items-center justify-center disabled:opacity-50 active:scale-90"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Permission Modal */}
        {isPermModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl p-8 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 animate-scale-up">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Access Control</h2>
                  <p className="text-slate-500 text-sm font-medium">Configure module access for {selectedStaff?.name}</p>
                </div>
                <button onClick={() => setIsPermModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-full transition-colors">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto mb-8 pr-2 custom-scrollbar">
                {/* Only Assigned Leads Setting */}
                <div className="mb-6 p-4 bg-[#00684a]/5 rounded-2xl border border-[#00684a]/15 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#00684a]/10 text-[#00684a] rounded-xl flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.746 3.746 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-900 text-sm">Only Assigned Leads</div>
                      <div className="text-slate-500 text-xs font-medium">If enabled, this staff member will only be able to view and manage leads assigned to them.</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={currentPermissions?.only_assigned_leads === 'all_access'}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        handlePermissionChange('only_assigned_leads', isChecked ? 'all_access' : 'no_access');
                      }}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00684a]"></div>
                  </label>
                </div>

                <PermissionMatrix 
                  permissions={currentPermissions} 
                  onChange={handlePermissionChange} 
                  loading={loading}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button 
                  onClick={() => setIsPermModalOpen(false)} 
                  className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={savePermissions} 
                  disabled={loading}
                  className="bg-[#00684a] hover:bg-[#00523a] text-white px-8 py-2.5 rounded-xl font-bold shadow-lg shadow-[#00684a]/10 disabled:opacity-50 transition-all active:scale-95"
                >
                  {loading ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Staff Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl p-0 w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden animate-scale-up">
              <div className="bg-slate-50/80 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Add Team Member</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Staff Credentials</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 rounded-full transition-all shadow-sm">✕</button>
              </div>

              <form onSubmit={handleCreate} className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      </span>
                      <input 
                        type="text" placeholder="e.g. John Smith" required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 00-2 2z" /></svg>
                      </span>
                      <input 
                        type="email" placeholder="john@company.com" required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={newStaff.email} onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Temporary Password</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      <input 
                        type="password" placeholder="••••••••" required
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={newStaff.password} onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                      </span>
                      <input 
                        type="text" placeholder="+1 (555) 000-0000"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={newStaff.phone} onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Role</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                      </span>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm outline-none appearance-none"
                        value={newStaff.role || 'staff'} onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                      >
                        <option value="staff">Staff Member</option>
                        <option value="manager">Manager</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-10 flex flex-col gap-3">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                        Initialize Staff Account
                      </>
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="w-full text-slate-400 font-bold py-2 text-sm hover:text-slate-600 transition-colors uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {isPasswordModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white rounded-3xl p-0 w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden animate-scale-up">
              <div className="bg-slate-50/80 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Change Password</h2>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{selectedStaffForPassword?.name}</p>
                </div>
                <button onClick={() => setIsPasswordModalOpen(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-600 rounded-full transition-all shadow-sm">✕</button>
              </div>

              <form onSubmit={handlePasswordChangeSubmit} className="p-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                    <div className="relative group">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      </span>
                      <input 
                        type="password" placeholder="Min. 6 characters" required minLength={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-bold text-sm"
                        value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-2xl font-black shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsPasswordModalOpen(false)} 
                    className="w-full text-slate-400 font-bold py-2 text-xs hover:text-slate-600 transition-colors uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {/* Delete Confirmation Modal */}
        {isDeleteModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
              <div className="p-6">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto bg-red-100">
                  <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 text-center mb-2">Delete Staff Member?</h3>
                <p className="text-slate-500 text-center mb-6 text-sm">
                  Are you sure you want to delete {staffToDelete?.name}? This action cannot be undone and they will lose access immediately.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setStaffToDelete(null);
                    }}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={proceedDelete}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-200 transition-colors flex items-center justify-center gap-2"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
};

export default StaffManagement;
