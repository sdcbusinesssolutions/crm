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
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  if (fetching) return <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse"></div>;

  const assignedStaff = staffList.filter(s => assignedStaffIds.includes(s.id));

  return (
    <div className="relative inline-block">
      {/* Compact Display - Avatars */}
      <div className="flex items-center -space-x-2 overflow-visible">
        {assignedStaff.length === 0 ? (
          <div className="text-[10px] text-slate-400 font-medium italic pr-2">Unassigned</div>
        ) : (
          assignedStaff.slice(0, 3).map((staff) => (
            <div 
              key={staff.id} 
              title={staff.name}
              className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm hover:z-10 transition-transform hover:scale-110 cursor-help"
            >
              {staff.name?.charAt(0).toUpperCase()}
            </div>
          ))
        )}
        {assignedStaff.length > 3 && (
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm">
            +{assignedStaff.length - 3}
          </div>
        )}
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-dashed transition-all hover:scale-110 ml-2 ${
            isModalOpen ? 'bg-indigo-50 border-indigo-500 text-indigo-600' : 'bg-slate-50 border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500'
          }`}
          title="Manage Assignments"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </div>

      {/* Modal Backdrop */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          {/* Modal Content */}
          <div 
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-zoom-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  Assign Team Members
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Select staff members to handle this lead</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Staff List */}
            <div className="p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {staffList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 15.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                   </div>
                   <p className="text-sm font-medium">No team members found</p>
                   <p className="text-[10px] mt-1">Add staff in the Team Staff module</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {staffList.map((staff) => (
                    <label 
                      key={staff.id} 
                      className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                        assignedStaffIds.includes(staff.id) 
                          ? 'bg-indigo-50/50 border-indigo-600 shadow-sm' 
                          : 'bg-white border-slate-100 hover:border-indigo-200 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shadow-inner ${
                          assignedStaffIds.includes(staff.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {staff.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-black text-slate-800">{staff.name}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-bold uppercase tracking-wider mt-0.5">
                            <span className={`w-2 h-2 rounded-full shadow-sm ${staff.role === 'manager' ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                            {staff.role}
                          </div>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        assignedStaffIds.includes(staff.id) 
                          ? 'bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200' 
                          : 'bg-white border-slate-200 text-transparent'
                      }`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <input 
                        type="checkbox"
                        className="hidden"
                        checked={assignedStaffIds.includes(staff.id)}
                        onChange={() => handleToggleStaff(staff.id)}
                        disabled={loading}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer / Status */}
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
               {loading ? (
                 <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest">
                   <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                   Syncing...
                 </div>
               ) : (
                 <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-widest">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                   </svg>
                   Saved
                 </div>
               )}
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg shadow-slate-200 hover:scale-105 transition-all"
               >
                 Done
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadAssignment;

// Add local animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes zoom-in {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  .animate-fade-in {
    animation: fade-in 0.2s ease-out forwards;
  }
  .animate-zoom-in {
    animation: zoom-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
`;
document.head.appendChild(style);
