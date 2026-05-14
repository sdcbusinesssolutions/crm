import React, { useState, useEffect } from 'react';
import { staffApi } from '../api/staffApi';
import { usePermissions, ACCESS_TYPES } from '../hooks/usePermissions';
import { createLead, getLeads, updateLead } from '../../../services/lead-management-api';

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeLeadId, setActiveLeadId] = useState(leadId);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
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

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [leadId, contact?.phone, isDropdownOpen]);

  const loadData = async (targetId: string, leadData?: any) => {
    setFetching(true);
    try {
      const allStaff = await staffApi.listStaff();
      setStaffList(allStaff);
      
      if (leadData && leadData.assigned_staff_ids) {
        setAssignedStaffIds(leadData.assigned_staff_ids);
      } else if (targetId) {
        try {
           const lead = await staffApi.getLead(targetId);
           setAssignedStaffIds(lead.assigned_staff_ids || []);
        } catch (e) {
           // Fallback if staffApi.getLead is missing or fails
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
          source: 'crm_contact'
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

  if (fetching) return <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse"></div>;

  const assignedStaff = staffList.filter(s => assignedStaffIds.includes(s.id));

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Compact Display */}
      <div className="flex items-center -space-x-2 overflow-visible">
        {assignedStaff.slice(0, 3).map((staff) => (
          <div 
            key={staff.id} 
            title={staff.name}
            className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help"
          >
            {staff.name?.charAt(0).toUpperCase()}
          </div>
        ))}
        {assignedStaff.length > 3 && (
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm">
            +{assignedStaff.length - 3}
          </div>
        )}
        
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-dashed transition-all hover:scale-110 ml-2 ${
            isDropdownOpen ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'
          }`}
          title="Manage Assignments"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isDropdownOpen ? "M6 18L18 6M6 6l12 12" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
          </svg>
        </button>
      </div>

      {/* Dropdown Selector */}
      {isDropdownOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 animate-fade-in overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Assign Team Members
            </h3>
          </div>
          
          <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar">
            {staffList.length === 0 ? (
              <div className="text-xs text-slate-500 py-4 italic text-center">No staff members found.</div>
            ) : (
              staffList.map((staff) => (
                <label 
                  key={staff.id} 
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                    assignedStaffIds.includes(staff.id) 
                      ? 'bg-indigo-50 border-indigo-100' 
                      : 'bg-white border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                      assignedStaffIds.includes(staff.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {staff.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-700">{staff.name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium uppercase">
                        <span className={`w-1.5 h-1.5 rounded-full ${staff.role === 'manager' ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                        {staff.role}
                      </div>
                    </div>
                  </div>
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500/20 transition-all cursor-pointer"
                    checked={assignedStaffIds.includes(staff.id)}
                    onChange={() => handleToggleStaff(staff.id)}
                    disabled={loading}
                  />
                </label>
              ))
            )}
          </div>

          {loading && (
            <div className="p-3 border-t border-slate-100 bg-indigo-50/50 flex items-center justify-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest">
              <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              Updating...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadAssignment;
