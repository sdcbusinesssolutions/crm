import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/lead-management';
import { AppConfig } from '../AppConfig';

const PROJECT_URL = AppConfig.VITE_SUPABASE_URL;
const ANON_KEY = AppConfig.VITE_SUPABASE_ANON_KEY;

if (!ANON_KEY) {
  console.warn('Supabase Anon Key is missing! Authentication will fail.');
}

export const supabase = createClient<Database>(PROJECT_URL, ANON_KEY);
