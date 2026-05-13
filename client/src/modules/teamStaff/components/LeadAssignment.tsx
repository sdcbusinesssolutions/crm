import React, { useState, useEffect } from 'react';
import { staffApi } from '../api/staffApi';
import { usePermissions, ACCESS_TYPES } from '../hooks/usePermissions';

interface Props {
  leadId: string;
  onAssigned?: () => void;
}

const LeadAssignment: React.FC<Props> = ({ leadId, onAssigned }) => {
  const [staffList, setStaffList] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const { hasAccess } = usePermissions();
  const isOwner = hasAccess('Staff Management', ACCESS_TYPES.ALL_ACCESS); // If they can manage staff, they can assign leads

  useEffect(() => {
    loadData();
  }, [leadId]);

  const loadData = async () => {
    setFetching(true);
    try {
      const [allStaff, currentAssignments] = await Promise.all([
        staffApi.listStaff(),
        staffApi.getLeadAssignments(leadId)
      ]);
      setStaffList(allStaff);
      setAssignments(currentAssignments);
    } catch (err) {
      console.error('Failed to load lead assignments', err);
    } finally {
      setFetching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedStaff) return;
    
    // Check if already assigned
    if (assignments.some(a => a.id === selectedStaff)) {
      setSelectedStaff('');
      return;
    }

    setLoading(true);
    try {
      await staffApi.assignLead(leadId, selectedStaff);
      setSelectedStaff('');
      await loadData(); // Reload to get fresh names
      if (onAssigned) onAssigned();
    } catch (err) {
      alert('Failed to assign lead');
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (staffId: string) => {
    if (!window.confirm('Remove this assignment?')) return;
    setLoading(true);
    try {
      await staffApi.unassignLead(leadId, staffId);
      await loadData();
      if (onAssigned) onAssigned();
    } catch (err) {
      alert('Failed to remove assignment');
    } finally {
      setLoading(false);
    }
  };

  // Filter out already assigned staff from the dropdown
  const availableStaff = staffList.filter(s => !assignments.some(a => a.id === s.id));

  if (fetching) return <div className="animate-pulse h-8 w-32 bg-slate-100 rounded-lg"></div>;

  return (
    <div className="flex flex-col gap-2">
      {/* Current Assignments */}
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {assignments.map(staff => (
            <div 
              key={staff.id} 
              className="group flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full text-[10px] font-bold border border-indigo-100 shadow-sm"
            >
              <span>{staff.name}</span>
              {isOwner && (
                <button 
                  onClick={() => handleUnassign(staff.id)}
                  className="hover:text-rose-600 transition-colors"
                  title="Remove assignment"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Assignment Dropdown (Owner Only) */}
      {isOwner && (
        <div className="flex items-center gap-2">
          <select 
            value={selectedStaff}
            onChange={e => setSelectedStaff(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-50"
            disabled={loading || availableStaff.length === 0}
          >
            <option value="">+ Assign Staff</option>
            {availableStaff.map((staff: any) => (
              <option key={staff.id} value={staff.id}>
                {staff.name} ({staff.role})
              </option>
            ))}
          </select>
          
          {selectedStaff && (
            <button 
              onClick={handleAssign}
              disabled={loading}
              className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-[11px] font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-sm shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? '...' : 'Add'}
            </button>
          )}
        </div>
      )}
      
      {availableStaff.length === 0 && assignments.length > 0 && (
        <span className="text-[10px] text-slate-400 font-medium ml-1 italic">All staff assigned</span>
      )}
    </div>
  );
};

export default LeadAssignment;
