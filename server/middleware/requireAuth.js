const { supabase } = require('../lib/supabaseClient');

/**
 * Authentication Middleware
 * Verifies the Bearer token from the Authorization header using the shared Supabase client.
 */
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Missing or invalid Authorization header'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verify token using the static shared client
        // We use getUser instead of getSession for security on the server side
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data || !data.user) {
            console.error('Auth validation failed:', error?.message);
            return res.status(401).json({
                error: 'Unauthorized',
                message: `Invalid or expired token: ${error?.message || 'No user data'}`
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
