import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/lead-management';
import { AppConfig } from '../AppConfig';

const PROJECT_URL = AppConfig.VITE_SUPABASE_URL;
const ANON_KEY = AppConfig.VITE_SUPABASE_ANON_KEY;

if (!ANON_KEY) {
  console.warn('Supabase Anon Key is missing! Authentication will fail.');
}

export const supabase = createClient<Database>(PROJECT_URL, ANON_KEY);

// Monkey-patch Supabase Auth on the frontend to seamlessly support Staff JWT tokens when logged in as a staff member.
// This ensures that all components and services calling supabase.auth.getSession() or supabase.auth.getUser()
// automatically get the correct token and user profile, resolving permissions and page loading issues.

const authAny = supabase.auth as any;
const originalGetSession = authAny.getSession.bind(supabase.auth);
const originalGetUser = authAny.getUser.bind(supabase.auth);

authAny.getSession = async () => {
  const staffToken = localStorage.getItem('staffToken');
  if (staffToken) {
    const staffDataStr = localStorage.getItem('staffData');
    let user: any = null;
    if (staffDataStr) {
      try {
        const staffData = JSON.parse(staffDataStr);
        user = {
          id: staffData.id || 'staff',
          email: staffData.email || 'staff@gmail.com',
          role: 'staff',
          user_metadata: {
            name: staffData.name || 'Staff User',
            role: 'staff'
          }
        };
      } catch (e) {}
    }
    if (!user) {
      user = { id: 'staff', email: 'staff@gmail.com', role: 'staff' };
    }
    return {
      data: {
        session: {
          access_token: staffToken,
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: '',
          user: user,
          expires_at: Math.floor(Date.now() / 1000) + 3600
        } as any
      },
      error: null
    };
  }
  return originalGetSession();
};

authAny.getUser = async (jwt?: string) => {
  const staffToken = localStorage.getItem('staffToken');
  if (staffToken && !jwt) {
    const staffDataStr = localStorage.getItem('staffData');
    let user: any = null;
    if (staffDataStr) {
      try {
        const staffData = JSON.parse(staffDataStr);
        user = {
          id: staffData.id || 'staff',
          email: staffData.email || 'staff@gmail.com',
          role: 'staff',
          user_metadata: {
            name: staffData.name || 'Staff User',
            role: 'staff'
          }
        };
      } catch (e) {}
    }
    if (!user) {
      user = { id: 'staff', email: 'staff@gmail.com', role: 'staff' };
    }
    return {
      data: {
        user: user
      },
      error: null
    };
  }
  return originalGetUser(jwt);
};
