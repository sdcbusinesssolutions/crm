import React, { useState, useEffect, useRef } from 'react';
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

  if (!isOwner && !hasAccess('Lead Management', ACCESS_TYPES.READ_WRITE)) {
    return <div className="p-4 text-gray-500 text-sm italic">You do not have permission to assign leads.</div>;
  }

  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-indigo-500', 'bg-emerald-500', 'bg-blue-500', 'bg-amber-500', 
      'bg-rose-500', 'bg-violet-500', 'bg-cyan-500', 'bg-teal-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
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
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight pr-1">Unassigned</div>
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
          <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-black border-2 border-white shadow-sm">
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

      {/* Modern Dropdown Selection */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 z-[100] w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right">
          <div className="p-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assign Staff</h3>
            {loading && (
               <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          
          <div className="max-h-60 overflow-y-auto custom-scrollbar p-1.5">
            {staffList.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-[10px] italic">No staff found</div>
            ) : (
              staffList.map((staff) => {
                const isSelected = assignedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    onClick={(e) => { e.stopPropagation(); handleToggleStaff(staff.id); }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl transition-all mb-0.5 ${
                      isSelected 
                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                        : 'hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-[10px] font-black shadow-sm ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-100 text-slate-400'
                      }`}>
                        {staff.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left truncate">
                        <div className="text-[11px] truncate">{staff.name}</div>
                        <div className="text-[8px] opacity-60 font-medium uppercase tracking-tighter">{staff.role}</div>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2 border-t border-slate-50 bg-slate-50/30 flex justify-end">
             <button
               onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
               className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black hover:bg-slate-800 transition-colors uppercase tracking-widest"
             >
               DONE
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadAssignment;
