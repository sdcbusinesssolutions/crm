const { supabase } = require('../lib/supabaseClient');

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

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header'
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
            // console.error('Auth validation failed:', error?.message); // Reduce noise
            return res.status(401).json({
                error: 'Unauthorized',
                message: `Invalid or expired token`
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
