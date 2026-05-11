import React, { useState, useEffect } from 'react';
import { staffApi } from '../api/staffApi';

interface Props {
  leadId: string;
  currentStaffId?: string;
  onAssigned?: () => void;
}

const LeadAssignment: React.FC<Props> = ({ leadId, currentStaffId, onAssigned }) => {
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(currentStaffId || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    staffApi.listStaff().then(setStaffList).catch(console.error);
  }, []);

  const handleAssign = async () => {
    if (!selectedStaff) return;
    setLoading(true);
    try {
      await staffApi.assignLead(leadId, selectedStaff);
      if (onAssigned) onAssigned();
      alert('Lead assigned successfully');
    } catch (err) {
      alert('Failed to assign lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <select 
        value={selectedStaff}
        onChange={e => setSelectedStaff(e.target.value)}
        className="border rounded-md p-1 text-sm bg-white"
        disabled={loading}
      >
        <option value="">Unassigned</option>
        {staffList.map((staff: any) => (
          <option key={staff.id} value={staff.id}>
            {staff.name}
          </option>
        ))}
      </select>
      <button 
        onClick={handleAssign}
        disabled={loading || !selectedStaff}
        className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-xs font-bold hover:bg-indigo-100 disabled:opacity-50"
      >
        {loading ? '...' : 'Assign'}
      </button>
    </div>
  );
};

export default LeadAssignment;
