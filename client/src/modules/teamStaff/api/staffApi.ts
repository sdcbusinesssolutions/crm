import { tokenService } from '../../../services/tokenService';

const API_URL = import.meta.env.VITE_API_URL || '';

// Use shared token service for headers
const getAuthHeaders = async () => {
  return await tokenService.getAuthHeader();
};

export const staffApi = {
  // Staff Login
  login: async (credentials: any) => {
    const res = await fetch(`${API_URL}/api/team-staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(error.error || 'Login failed');
    }
    return await res.json();
  },

  // Owner: Manage Staff
  createStaff: async (staffData: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/team-staff`, {
      method: 'POST',
      headers,
      body: JSON.stringify(staffData)
    });
    if (!res.ok) throw new Error('Failed to create staff');
    return await res.json();
  },

  listStaff: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/team-staff`, { headers });
    if (!res.ok) throw new Error('Failed to list staff');
    return await res.json();
  },

  updatePermissions: async (staffId: string, permissions: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/team-staff/${staffId}/permissions`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ permissions })
    });
    if (!res.ok) throw new Error('Failed to update permissions');
    return await res.json();
  },

  assignLead: async (leadId: string, staffId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/team-staff/assign-lead`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadId, staffId })
    });
    if (!res.ok) throw new Error('Failed to assign lead');
    return await res.json();
  },

  getLeadAssignments: async (leadId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/team-staff/leads/${leadId}/assignments`, { headers });
    if (!res.ok) throw new Error('Failed to fetch assignments');
    return await res.json();
  },

  unassignLead: async (leadId: string, staffId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/api/team-staff/unassign-lead`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadId, staffId })
    });
    if (!res.ok) throw new Error('Failed to unassign lead');
    return await res.json();
  }
};
