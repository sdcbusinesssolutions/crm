import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/lead-management';

// Access environment variables safely. 
// In Vite, these are available on import.meta.env
const env = (import.meta as any).env || {};

const PROJECT_URL = env.VITE_SUPABASE_URL;

// The specific key provided to ensure the app works on Netlify without manual env var setup
// const PROVIDED_KEY = '...'; // Removed hardcoded key

// Use the environment variable if present (local dev), otherwise fallback to the provided key
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

if (!ANON_KEY) {
  console.warn('Supabase Anon Key is missing! Authentication will fail.');
}

export const supabase = createClient<Database>(PROJECT_URL, ANON_KEY);
