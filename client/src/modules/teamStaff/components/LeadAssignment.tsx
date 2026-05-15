import React, { useState, useEffect, useRef, useMemo } from 'react';
import { staffApi } from '../api/staffApi';
import { usePermissions, ACCESS_TYPES } from '../hooks/usePermissions';
import { createLead, getLeads, updateLead, getLead } from '../../../services/lead-management-api';

interface Props {
  leadId: string;
  contact?: any; 
  onAssigned?: () => void;
}

const LeadAssignment: React.FC<Props> = ({ leadId, contact, onAssigned }) => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [assignedStaffIds, setAssignedStaffIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLeadId, setActiveLeadId] = useState(leadId);
  const containerRef = useRef<HTMLDivElement>(null);
  const { hasAccess } = usePermissions();
  const isOwner = hasAccess('Staff Management', ACCESS_TYPES.ALL_ACCESS); 

  useEffect(() => {
    const resolveId = async () => {
      if (contact && contact.phone) {
        try {
          const existingLeads = await getLeads(undefined, undefined, 1, 5, { search: contact.phone });
          if (existingLeads.length > 0) {
            setActiveLeadId(existingLeads[0].id);
            loadData(existingLeads[0].id, existingLeads[0]);
          } else {
            loadData(leadId);
          }
        } catch (err) {
          loadData(leadId);
        }
      } else {
        loadData(leadId);
      }
    };
    resolveId();
  }, [leadId, contact?.phone]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = async (targetId: string, leadData?: any) => {
    setFetching(true);
    try {
      const allStaff = await staffApi.listStaff();
      setStaffList(allStaff);
      
      if (leadData && leadData.assigned_staff_ids) {
        setAssignedStaffIds(leadData.assigned_staff_ids);
      } else if (targetId) {
        try {
           const lead = await getLead(targetId);
           setAssignedStaffIds(lead?.assigned_staff_ids || []);
        } catch (e) {
           setAssignedStaffIds([]);
        }
      }
    } catch (err) {
      console.error('Failed to load lead assignments:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleToggleStaff = async (staffId: string) => {
    const isAssigned = assignedStaffIds.includes(staffId);
    const newIds = isAssigned 
      ? assignedStaffIds.filter(id => id !== staffId)
      : [...assignedStaffIds, staffId];
    
    setAssignedStaffIds(newIds);
    
    setLoading(true);
    try {
      let targetLeadId = activeLeadId;
      
      if (!targetLeadId && contact) {
        const newLead = await createLead({
          name: contact.name || 'Contact',
          phone: contact.phone,
          email: contact.email,
          status: 'active',
          source: 'manual'
        });
        targetLeadId = newLead.id;
        setActiveLeadId(newLead.id);
      }

      if (targetLeadId) {
        await updateLead(targetLeadId, { assigned_staff_ids: newIds });
        if (onAssigned) onAssigned();
      }
    } catch (err) {
      console.error('Failed to update assignments:', err);
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
    return <div className="p-4 text-gray-500 text-sm italic">You do not have permission to assign leads.</div>;
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

  if (fetching) return (
    <div className="flex items-center -space-x-2">
      <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse border-2 border-white"></div>
      <div className="w-7 h-7 rounded-full bg-slate-50 animate-pulse border-2 border-white"></div>
    </div>
  );

  const assignedStaff = staffList.filter(s => assignedStaffIds.includes(s.id));

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Compact Display - Avatars */}
      <div className="flex items-center -space-x-2 overflow-visible">
        {assignedStaff.length === 0 ? (
          <div className="text-[9px] text-slate-400 font-black uppercase tracking-tight pr-1">Unassigned</div>
        ) : (
          assignedStaff.slice(0, 3).map((staff) => (
            <div 
              key={staff.id} 
              title={staff.name}
              className={`w-7 h-7 rounded-full ${getAvatarColor(staff.name)} text-white flex items-center justify-center text-[9px] font-black border-2 border-white shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help`}
            >
              {staff.name?.charAt(0).toUpperCase()}
            </div>
          ))
        )}
        {assignedStaff.length > 3 && (
          <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-black border-2 border-white shadow-sm">
            +{assignedStaff.length - 3}
          </div>
        )}
        
        <button 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-dashed transition-all hover:scale-110 ml-1.5 ${
            isOpen ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'
          }`}
        >
          <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-45' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      {/* Advanced Dropdown Selection */}
      {isOpen && (
        <div className={`absolute top-full right-0 mt-2 z-[100] ${staffList.length > 6 ? 'w-80' : 'w-64'} bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right backdrop-blur-xl`}>
          {/* Header & Search */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-100/50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Assign Team</h3>
              {loading && (
                 <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              )}
            </div>
            <div className="relative">
               <input 
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Search staff..."
                 className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all pl-8 shadow-sm"
               />
               <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </div>
          </div>
          
          {/* Staff Grid */}
          <div className={`max-h-[320px] overflow-y-auto custom-scrollbar p-2 ${staffList.length > 6 ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-1'}`}>
            {filteredStaff.length === 0 ? (
              <div className="col-span-full py-8 text-center">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                   <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                   </svg>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">No matches found</p>
              </div>
            ) : (
              filteredStaff.map((staff) => {
                const isSelected = assignedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    onClick={(e) => { e.stopPropagation(); handleToggleStaff(staff.id); }}
                    className={`flex items-center gap-2.5 p-2 rounded-2xl transition-all relative group ${
                      isSelected 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-[1.02]' 
                        : 'hover:bg-slate-50 text-slate-600 border border-transparent hover:border-slate-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-[10px] font-black shadow-sm transition-colors ${
                      isSelected ? 'bg-white/20 text-white' : `${getAvatarColor(staff.name)} text-white`
                    }`}>
                      {staff.name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left overflow-hidden">
                      <div className="text-[10px] font-black truncate">{staff.name}</div>
                      <div className={`text-[8px] uppercase tracking-tighter font-bold ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
                        {staff.role}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <svg className="w-2 h-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
             <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1">
               {assignedStaffIds.length} Assigned
             </div>
             <button
               onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
               className="px-5 py-2 bg-slate-900 text-white rounded-xl text-[9px] font-black hover:bg-slate-800 transition-all shadow-md hover:scale-105 active:scale-95 uppercase tracking-widest"
             >
               SAVE
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadAssignment;
