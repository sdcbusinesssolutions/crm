import { tokenService } from '../../../services/tokenService';
import { AppConfig } from '../../../AppConfig';

let API_URL = AppConfig.VITE_API_URL || '/api';

// Normalize absolute API URLs to ensure the '/api' suffix is appended if omitted
if (API_URL.startsWith('http') && !API_URL.endsWith('/api') && !API_URL.includes('/api/')) {
    API_URL = `${API_URL}/api`;
}

// Use shared token service for headers
const getAuthHeaders = async () => {
  return await tokenService.getAuthHeader();
};

export const staffApi = {
  // Staff Login
  login: async (credentials: any) => {
    const res = await fetch(`${API_URL}/team-staff/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const contentType = res.headers.get('content-type');
    if (!res.ok) {
      let errorMessage = 'Login failed';
      try {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await res.json();
          errorMessage = errorData.error || errorMessage;
        } else {
          errorMessage = await res.text() || errorMessage;
        }
      } catch (e) {
        errorMessage = 'Invalid credentials or server error';
      }
      throw new Error(errorMessage);
    }

    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    throw new Error('Server returned an invalid response format');
  },

  // Owner: Manage Staff
  createStaff: async (staffData: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff`, {
      method: 'POST',
      headers,
      body: JSON.stringify(staffData)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create staff');
    }
    return await res.json();
  },

  listStaff: async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff`, { headers });
    if (!res.ok) throw new Error('Failed to list staff');
    return await res.json();
  },

  updatePermissions: async (staffId: string, permissions: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff/${staffId}/permissions`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ permissions })
    });
    if (!res.ok) throw new Error('Failed to update permissions');
    return await res.json();
  },

  assignLead: async (leadId: string, staffId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff/assign-lead`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadId, staffId })
    });
    if (!res.ok) throw new Error('Failed to assign lead');
    return await res.json();
  },

  getLeadAssignments: async (leadId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff/leads/${leadId}/assignments`, { headers });
    if (!res.ok) throw new Error('Failed to fetch assignments');
    return await res.json();
  },

  unassignLead: async (leadId: string, staffId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff/unassign-lead`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadId, staffId })
    });
    if (!res.ok) throw new Error('Failed to unassign lead');
    return await res.json();
  },

  deleteStaff: async (staffId: string) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff/${staffId}`, {
      method: 'DELETE',
      headers
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to delete staff' }));
      throw new Error(error.error || 'Failed to delete staff');
    }
    return await res.json();
  },

  updateStaff: async (staffId: string, staffData: any) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${API_URL}/team-staff/${staffId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(staffData)
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to update staff' }));
      throw new Error(error.error || 'Failed to update staff');
    }
    return await res.json();
  }
};
