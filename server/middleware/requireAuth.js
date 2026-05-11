const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const jwt = require('jsonwebtoken');

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

            if (securityError) {
                console.error('API Key Lookup Error:', securityError);
                return res.status(401).json({ error: 'Unauthorized', message: 'API validation service error.' });
            }

            if (security && security.user_id) {
                // Fetch full user record to be consistent with auth.getUser
                const { data: userData, error: userError } = await supabaseAdmin
                    .from('profiles')
                    .select('*')
                    .eq('id', security.user_id)
                    .single();

                if (!userError && userData) {
                    req.user = { id: security.user_id, ...userData };
                    return next();
                } else {
                    return res.status(401).json({ error: 'Unauthorized', message: 'User profile not found for this API Key.' });
                }
            } else {
                return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API Key.' });
            }
        }

        // 2. Check for Bearer Token (Short-lived Supabase JWT)
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header. Use Bearer <token> or X-API-Key <key>'
            });
        }

        const token = authHeader.split(' ')[1];

        // 2a. Try verifying as a Staff JWT first (Local, fast)
        try {
            const decoded = jwt.verify(token, (process.env.JWT_SECRET || 'your-secret-key').trim());
            if (decoded && decoded.role === 'staff') {
                req.staff = decoded;
                req.user = { 
                    id: decoded.tenantId, 
                    email: decoded.email,
                    staffId: decoded.staffId,
                    isStaff: true 
                };
            } else if (decoded) {
                console.warn(`⚠️ [Auth] Token verified but role is NOT staff: ${decoded.role}`);
            }
        } catch (jwtErr) {
            // Not a valid staff token, but only log if it looks like one (to avoid spamming Supabase tokens)
            if (token.length > 50 && !token.startsWith('ey')) {
                 console.log('DEBUG: Potential staff token failed verification:', jwtErr.message);
            }
        }

        // 2b. If not staff, verify token using the static shared client with retry
        if (!req.staff) {
            let data, error;
            try {
                const result = await getUserWithRetry(token);
                data = result.data;
                error = result.error;
            } catch (fetchErr) {
                console.error('Auth network failure:', fetchErr.message);
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

            // Attach Supabase user to request object
            req.user = data.user;
        }
        
        // --- DATA SCOPE INITIALIZATION ---
        // By default, owners have 'global' scope, staff have 'assigned' scope
        req.user.dataScope = 'global';
        
        if (req.staff) {
            req.user.isStaff = true;
            req.user.staffId = req.staff.staffId;
            // For now, all staff are restricted to assigned data
            // In the future, this can be checked against a "View All" permission
            req.user.dataScope = 'assigned';
        }

        next();
    } catch (err) {
        console.error('Middleware error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = requireAuth;
