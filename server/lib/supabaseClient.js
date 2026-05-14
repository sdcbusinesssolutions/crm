
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
try {
    // Try server/.env
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
    // Try root .env (if executed from monorepo root context or just missing in server)
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (e) { }

// Centralized Configuration
const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
const supabaseKey = process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.trim() : '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.trim() : '';
console.log('[DEBUG_INIT] Supabase Service Key Length:', supabaseServiceKey.length);
if (!supabaseServiceKey) console.error('❌ [CRITICAL] SUPABASE_SERVICE_KEY IS MISSING IN ENV!');
else console.log('✅ [INIT] Service Key Loaded.');

/**
 * 1. Static Client (Anon)
 * Used for client-side like operations or public access.
 */
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

/**
 * 2. Admin Client (Service Role)
 * Used for background tasks (Webhooks, Flow Engine) to bypass RLS.
 */
let supabaseAdmin = null;
if (supabaseServiceKey) {
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    });
} else {
    console.warn('⚠️ SUPABASE_SERVICE_KEY not found. Background tasks may fail due to RLS.');
    // Fallback to anon client, but this will likely fail RLS checks
    supabaseAdmin = supabase;
}

/**
 * 3. Authenticated Client Factory
 * Creates a new Supabase client instance for a specific request.
 */
/**
 * 3. Authenticated Client Factory
 * Creates a new Supabase client instance for a specific request.
 * For staff members, we automatically return supabaseAdmin to bypass 
 * PGRST301 errors caused by custom JWTs that Supabase cannot decode.
 */
const getAuthenticatedSupabase = (req) => {
    // 1. Check if the user is a staff member (populated by requireAuth middleware)
    if (req.user && req.user.isStaff) {
        return supabaseAdmin;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        // Fallback to anon client if no header, but warn
        return supabase;
    }

    // 2. Return a request-scoped client for standard owners
    return createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        },
        global: {
            headers: { Authorization: authHeader }
        }
    });
};

module.exports = {
    supabase,
    supabaseAdmin,
    getAuthenticatedSupabase
};
