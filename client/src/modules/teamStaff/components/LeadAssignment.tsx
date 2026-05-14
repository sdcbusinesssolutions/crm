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
  const [activeLeadId, setActiveLeadId] = useState(leadId);
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

  if (fetching) return <div className="p-4 animate-pulse flex flex-col gap-2"><div className="h-4 w-24 bg-slate-200 rounded"></div><div className="h-10 w-full bg-slate-100 rounded"></div></div>;

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        Assign Team Members
      </h3>
      
      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
        {staffList.length === 0 ? (
          <div className="text-xs text-gray-500 py-2 italic text-center">No staff members found.</div>
        ) : (
          staffList.map((staff) => (
            <label 
              key={staff.id} 
              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                assignedStaffIds.includes(staff.id) 
                  ? 'bg-indigo-50 border-indigo-200' 
                  : 'bg-slate-50 border-transparent hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
                  assignedStaffIds.includes(staff.id) ? 'bg-indigo-600 text-white' : 'bg-slate-300 text-slate-600'
                }`}>
                  {staff.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-700">{staff.name}</div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-medium">
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
        <div className="mt-3 flex items-center gap-2 text-[10px] text-indigo-600 font-bold">
          <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          Saving...
        </div>
      )}
    </div>
  );
};

export default LeadAssignment;
