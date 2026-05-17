import React, { useState, useEffect, useMemo } from 'react';
import { staffApi } from '../api/staffApi';
import { usePermissions, ACCESS_TYPES } from '../hooks/usePermissions';
import { createLead, getLeads, updateLead, getLead } from '../../../services/lead-management-api';
import Modal from '../../../components/Modal';

interface Props {
  leadId: string;
  contact?: any; 
  onAssigned?: () => void;
  className?: string;
  showNames?: boolean;
}

const LeadAssignment: React.FC<Props> = ({ leadId, contact, onAssigned, className, showNames = true }) => {
  const [staffList, setStaffList] = useState<any[]>([]);
  // Defensive initialization
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>(Array.isArray(contact?.assigned_staff_ids) ? contact.assigned_staff_ids : []);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!contact?.assigned_staff_ids);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvedLeadId, setResolvedLeadId] = useState<string | null>(null);

  // Sync state with props when board data refreshes
  useEffect(() => {
    if (Array.isArray(contact?.assigned_staff_ids)) {
      setAssignedStaffIds(contact.assigned_staff_ids);
    }
  }, [contact?.assigned_staff_ids]);
  const [searchQuery, setSearchQuery] = useState('');
  const { hasAccess } = usePermissions();
  const isOwner = hasAccess('Staff Management', ACCESS_TYPES.ALL_ACCESS); 

  // Initialize data
  useEffect(() => {
    if (leadId) {
      loadData(leadId, contact);
    }
  }, [leadId]);

  const loadData = async (targetId: string, initialData?: any) => {
    setFetching(true);
    try {
      const allStaff = await staffApi.listStaff();
      setStaffList(allStaff);
      
      let actualLeadId: string | null = targetId;
      let leadData = null;

      // Try to fetch as direct lead ID first
      if (targetId && !targetId.startsWith('cnt-')) {
        try {
            leadData = await getLead(targetId);
        } catch (e) {
            leadData = null; // Failed to fetch, might be a Contact ID
        }
      }

      // If no lead found directly, it might be a Contact ID. Try finding by phone.
      if (!leadData && (initialData?.phone || initialData?.contact_phone)) {
        const phoneToSearch = initialData.phone || initialData.contact_phone;
        const leads: any = await getLeads(undefined, undefined, 1, 1, { search: phoneToSearch });
        const leadsData = leads?.data || leads || [];
        if (Array.isArray(leadsData) && leadsData.length > 0) {
            actualLeadId = leadsData[0].id;
            leadData = leadsData[0];
        } else {
            actualLeadId = null; // No lead exists yet
        }
      } else if (!leadData) {
          actualLeadId = null;
      }

      setResolvedLeadId(actualLeadId);

      // Use initial data if available, otherwise fetch
      if (initialData && Array.isArray(initialData.assigned_staff_ids)) {
        setAssignedStaffIds(initialData.assigned_staff_ids);
      } else {
        setAssignedStaffIds(Array.isArray(leadData?.assigned_staff_ids) ? leadData.assigned_staff_ids : []);
      }
    } catch (err) {
      console.error('Failed to load lead assignments:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleToggleStaff = async (staffId: string) => {
    // 1. Calculate new state
    const isAssigned = assignedStaffIds.includes(staffId);
    const newIds = isAssigned 
      ? assignedStaffIds.filter(id => id !== staffId)
      : [...assignedStaffIds, staffId];
    
    // 2. Optimistic Update
    setAssignedStaffIds(newIds);
    setLoading(true);

    try {
      let currentLeadId = resolvedLeadId;
      
      // 3. Persist to server
      if (!currentLeadId && contact) {
          // We need to create a lead first!
          const newLead = await createLead({
              name: contact.name || contact.contact_name || 'Unnamed Contact',
              email: contact.email || '',
              phone: contact.phone || contact.contact_phone || '',
              company: contact.company || contact.custom_data?.company || '',
              source: contact.source || 'Manual',
              assigned_staff_ids: newIds
          });
          currentLeadId = newLead.id;
          setResolvedLeadId(newLead.id);
          
          if (onAssigned) onAssigned();
      } else if (currentLeadId) {
          const updatedLead = await updateLead(currentLeadId, { assigned_staff_ids: newIds });
          
          if (updatedLead) {
            // 4. Confirm with server data
            const serverIds = updatedLead.assigned_staff_ids || [];
            setAssignedStaffIds(serverIds);
            if (onAssigned) onAssigned();
          }
      }
    } catch (err) {
      console.error('Failed to update assignments:', err);
      // Revert on error
      if (resolvedLeadId) {
          const lead = await getLead(resolvedLeadId);
          setAssignedStaffIds(Array.isArray(lead?.assigned_staff_ids) ? lead.assigned_staff_ids : []);
      } else {
          setAssignedStaffIds(Array.isArray(contact?.assigned_staff_ids) ? contact.assigned_staff_ids : []);
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredStaff = useMemo(() => {
    if (!searchQuery) return staffList;
    return staffList.filter(s => 
      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staffList, searchQuery]);

  if (!isOwner && !hasAccess('Lead Management', ACCESS_TYPES.READ_WRITE)) {
    return null; 
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 
      'bg-rose-500', 'bg-violet-500', 'bg-cyan-500', 'bg-teal-500'
    ];
    let hash = 0;
    const n = name || 'User';
    for (let i = 0; i < n.length; i++) {
      hash = n.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
          className={className || `p-1.5 rounded-lg transition-colors group/btn relative ${
            assignedStaffIds.length > 0 
              ? 'text-[#00684a] bg-emerald-50 hover:bg-emerald-100' 
              : 'text-[var(--color-text)] opacity-60 hover:opacity-100 hover:text-[#00684a] hover:bg-emerald-50'
          }`}
          title="Assign Team"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          {assignedStaffIds.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-[#00684a] text-white text-[8px] font-black rounded-full flex items-center justify-center border border-white px-0.5">
              {assignedStaffIds.length}
            </span>
          )}
        </button>

        {showNames && assignedStaffIds.length > 0 && staffList.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 ml-1">
              {assignedStaffIds.map(id => {
                  const staff = staffList.find(s => s.id === id);
                  if (!staff) return null;
                  const initials = staff.name ? staff.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
                  return (
                      <div 
                          key={id} 
                          className="w-6 h-6 rounded-full bg-emerald-100 text-[#00684a] border border-emerald-200 flex items-center justify-center text-[9px] font-black shadow-sm relative group cursor-pointer hover:bg-emerald-200 transition-colors"
                      >
                          {initials}
                          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-50 shadow-lg">
                              {staff.name}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5 border-4 border-transparent border-t-slate-800"></div>
                          </div>
                      </div>
                  );
              })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Assign Team Members"
        size="xl"
      >
        <div className="space-y-5">
          {/* Search & Counter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/80 to-teal-50/60 p-4 rounded-2xl border border-emerald-200/60">
             <div className="relative flex-1">
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff members..."
                  className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#00684a]/20 focus:border-[#00684a] transition-all pl-10 shadow-sm"
                />
                <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
             </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="bg-white px-4 py-2 rounded-xl border border-emerald-200 shadow-sm flex items-center">
                   <span className="text-xs font-black text-[#00684a] mr-2">{Array.isArray(assignedStaffIds) ? assignedStaffIds.length : 0}</span>
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected</span>
                </div>
                {loading && (
                   <div className="flex items-center gap-2 text-[10px] font-black text-[#00684a] animate-pulse">
                      <div className="w-3 h-3 border-2 border-[#00684a] border-t-transparent rounded-full animate-spin"></div>
                      SAVING
                   </div>
                )}
             </div>
          </div>

          {/* Staff Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
            {fetching ? (
               Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-[72px] bg-slate-50 animate-pulse rounded-xl border border-slate-100"></div>
               ))
            ) : filteredStaff.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 italic bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No staff members match your search.
              </div>
            ) : (
              filteredStaff.map((staff) => {
                const isSelected = assignedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    onClick={() => handleToggleStaff(staff.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 relative group ${
                      isSelected 
                        ? 'bg-emerald-50 border-[#00684a] shadow-md shadow-emerald-100' 
                        : 'bg-white border-slate-100 hover:border-[#0D9668]/40 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-sm font-black shadow-sm transition-all ${
                      isSelected ? 'bg-[#00684a] text-white scale-105' : `${getAvatarColor(staff.name)} text-white`
                    }`}>
                      {staff.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left overflow-hidden flex-1">
                      <div className={`text-xs font-black truncate ${isSelected ? 'text-[#00684a]' : 'text-slate-700'}`}>{staff.name}</div>
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{staff.role}</div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#00684a] flex items-center justify-center text-white shadow-sm">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
             <button
               onClick={() => setIsModalOpen(false)}
               className="px-8 py-3 bg-[#00684a] text-white rounded-xl text-xs font-black shadow-lg hover:bg-[#005c42] hover:shadow-xl transition-all uppercase tracking-widest active:scale-95"
             >
               ✓ Confirm Selection
             </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default LeadAssignment;
