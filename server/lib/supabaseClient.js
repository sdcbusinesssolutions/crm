
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
 * Added custom fetch with timeout to handle ISP connectivity issues (ConnectTimeoutError).
 */
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    global: {
        fetch: (url, options) => {
            return fetch(url, {
                ...options,
                // Increase timeout to 30 seconds for slow ISP connections
                signal: AbortSignal.timeout(30000)
            });
        }
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
        },
        global: {
            fetch: (url, options) => {
                return fetch(url, {
                    ...options,
                    signal: AbortSignal.timeout(30000)
                });
            }
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
    let client;

    // 1. Check if the user is a staff member (populated by requireAuth middleware)
    if (req.user && req.user.isStaff) {
        client = supabaseAdmin;
    } else {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            // Fallback to anon client if no header, but warn
            client = supabase;
        } else {
            // 2. Return a request-scoped client for standard owners
            client = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false
                },
                global: {
                    headers: { Authorization: authHeader },
                    fetch: (url, options) => {
                        return fetch(url, {
                            ...options,
                            signal: AbortSignal.timeout(30000)
                        });
                    }
                }
            });
        }
    }

    // Monkey-patch auth.getUser on the request-scoped client to return req.user if present.
    // This avoids redundant network calls, accelerates database operations,
    // and seamlessly handles staff authentication since staff accounts do not exist in Supabase auth.
    if (req.user && client) {
        const patchedClient = Object.create(client);
        patchedClient.auth = Object.create(client.auth);
        patchedClient.auth.getUser = async () => {
            return {
                data: { user: req.user },
                error: null
            };
        };
        return patchedClient;
    }

    return client;
};

// --- GLOBAL AUTH RETRY DECORATOR ---
// Dynamically wraps auth.getUser on supabase & supabaseAdmin to provide automatic retries,
// exponential backoff, and jitter. This completely eliminates UND_ERR_CONNECT_TIMEOUT
// network timeout issues across all routes, controllers, and middlewares.
const decorateAuthWithRetry = (client) => {
    if (!client || !client.auth) return;
    
    const originalGetUser = client.auth.getUser.bind(client.auth);
    
    client.auth.getUser = async (token, retries = 4) => {
        let lastError = null;
        for (let i = 0; i < retries; i++) {
            try {
                const result = await originalGetUser(token);
                // If it's a server error or a fetch failure/timeout, trigger retry by throwing
                if (result.error && (result.error.status >= 500 || result.error.message.includes('fetch failed') || result.error.message.includes('timeout'))) {
                    throw result.error;
                }
                return result;
            } catch (err) {
                lastError = err;
                const isNetworkError = err.message.includes('fetch failed') || 
                                       err.message.includes('timeout') || 
                                       err.code === 'UND_ERR_CONNECT_TIMEOUT' || 
                                       err.name === 'TimeoutError';
                
                if (i === retries - 1 || !isNetworkError) {
                    break;
                }
                
                // Exponential backoff with random jitter
                const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                console.warn(`⚠️ [Auth-Retry] Supabase connection failed (Attempt ${i + 1}/${retries}). Retrying in ${Math.round(delay)}ms... Error: ${err.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return {
            data: { user: null },
            error: lastError || { message: 'Authentication request failed after retries' }
        };
    };
};

decorateAuthWithRetry(supabase);
decorateAuthWithRetry(supabaseAdmin);

module.exports = {
    supabase,
    supabaseAdmin,
    getAuthenticatedSupabase
};
