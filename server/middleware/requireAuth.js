const { supabase, supabaseAdmin } = require('../lib/supabaseClient');

/**
 * Authentication Middleware
 * Verifies the Bearer token from the Authorization header using the shared Supabase client.
 */
const requireAuth = async (req, res, next) => {
    // Retry logic helper
    const getUserWithRetry = async (token, retries = 2) => {
        for (let i = 0; i < retries; i++) {
            try {
                return await supabase.auth.getUser(token);
            } catch (err) {
                if (i === retries - 1) throw err;
                // Wait short period
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    };

    try {
        const authHeader = req.headers.authorization;
        const xApiKey = req.headers['x-api-key'];

        // 1. Check for API Key (Long-lived)
        const apiKey = xApiKey || (authHeader?.startsWith('ApiKey ') ? authHeader.split(' ')[1] : null);
        
        if (apiKey) {
            const { data: security, error: securityError } = await supabaseAdmin
                .from('user_security')
                .select('user_id')
                .eq('api_key', apiKey)
                .maybeSingle();

            if (!securityError && security && security.user_id) {
                // Fetch full user record to be consistent with auth.getUser
                // Using supabaseAdmin to ensure we can get the user even if RLS is tight on auth schema
                const { data: userData, error: userError } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('id', security.user_id)
                    .single();

                if (!userError && userData) {
                    req.user = { id: security.user_id, ...userData };
                    return next();
                }
            }
            
            // If API key was provided but failed, we continue to check Bearer token 
            // but might eventually return 401.
        }

        // 2. Check for Bearer Token (Short-lived Supabase JWT)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Use Bearer <token> or X-API-Key <key>'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token using the static shared client with retry
        // We use getUser instead of getSession for security on the server side
        let data, error;
        try {
            const result = await getUserWithRetry(token);
            data = result.data;
            error = result.error;
        } catch (fetchErr) {
            console.error('Auth network failure:', fetchErr.message);
            // On strict network fail, we can't verify.
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication service unavailable'
            });
        }

        if (error || !data || !data.user) {
            const isExpired = error?.message?.toLowerCase().includes('expired') || error?.status === 401;
            return res.status(401).json({
                error: 'Unauthorized',
                message: isExpired ? 'Token expired. Please sign in again.' : 'Invalid authentication token',
                code: isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
            });
        }

        // Attach user to request object
        req.user = data.user;
        next();
    } catch (err) {
        console.error('Middleware error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = requireAuth;
