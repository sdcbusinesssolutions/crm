import { supabase } from '../../../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || '';

// Improved Token handling using standard fetch (avoiding axios dependency)
const getAuthHeaders = async (isStaff: boolean = false) => {
  let token = null;
  
  if (isStaff) {
    token = localStorage.getItem('staffToken');
  } else {
    // Standard owner authentication
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token;
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
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
  }
};
