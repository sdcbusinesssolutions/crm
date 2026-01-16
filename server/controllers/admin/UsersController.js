const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getUsers = async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ message: 'Server misconfiguration: No DB Access' });
        }

        // MULTI-TENANCY: Identify the domain of the Admin
        const origin = req.headers.origin || req.headers.host || '';
        // Strip protocol and port if needed, but simple includes check is robust enough for now
        // Or strictly parse: new URL(origin).hostname
        let requestDomain = origin;
        try {
            if (origin.startsWith('http')) {
                requestDomain = new URL(origin).hostname;
            }
        } catch (e) { }

        console.log(`[Admin] Fetching users for domain: ${requestDomain}`);

        // Instead of auth.admin.listUsers() which is global, we query the new public.profiles table
        // This table is synced via triggers and contains the 'signup_domain'
        const { data: profiles, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            //.eq('signup_domain', requestDomain) // UNCOMMENT THIS TO ENFORCE STRICT ISOLATION
            // For now, if we want to test without strict data, we can leave it open OR use soft match
            // .ilike('signup_domain', `%${requestDomain}%`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('SERVER ERROR: Failed to list profiles.', error);
            // Handle Schema Cache Error (PGRST205) or Undefined Table (42P01)
            if (error.code === 'PGRST205' || error.code === '42P01') {
                console.warn('⚠️ WARNING: public.profiles table not found or schema cache stale.');
                console.warn('👉 ACTION REQUIRED: Run "server/sql/200_combined_multi_tenancy.sql" in your Supabase SQL Editor.');
                console.warn('👉 OR: Restart your Supabase project to refresh the schema cache.');

                // Return empty array to keep UI valid instead of crashing
                return res.json([]);
            }
            throw error;
        }

        // Filter in memory for now if not strictly using .eq() above
        // This ensures the admin only sees users who signed up on THEIR domain
        // const filteredProfiles = profiles.filter(p => !p.signup_domain || p.signup_domain.includes(requestDomain));

        // REVERTING TO DIRECT MAPPING for speed, assuming the profiles query handles it or we return all for 'master' admin
        // Ideally: If Admin is 'Super Admin' (clickube.com), they might see all?

        let targetProfiles = profiles;
        // If strict white-labeling is required:
        // SUPER ADMIN EXCEPTION: If the admin is on the MASTER DOMAIN (clickube.com), show EVERYTHING.
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';

        if (requestDomain &&
            !requestDomain.includes('localhost') &&
            requestDomain !== MASTER_DOMAIN) {
            console.log(`[Admin] Filtering users for Tenant: ${requestDomain}`);
            targetProfiles = profiles.filter(p => p.signup_domain === requestDomain);
        } else {
            console.log(`[Admin] Super Admin Access (Master Domain or Localhost) - Showing ALL ${profiles.length} users.`);
        }

        const mappedUsers = targetProfiles.map(u => {
            const createdDate = new Date(u.created_at);
            const formattedDate = createdDate.toLocaleDateString('en-GB', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            return {
                id: u.id,
                name: 'User', // Profiles table might need name column sync or we fetch metadata
                email: u.email,
                status: 'Active',
                mobile: 'N/A',
                // Add domain info so Super Admin knows where they came from
                signupDomain: u.signup_domain,
                adminStatus: u.role || 'Standard',
                createdOn: formattedDate,
                lastSignIn: null
            };
        });

        res.json(mappedUsers);
    } catch (err) {
        console.error('Unhandled Error in getUsers:', err);
        res.status(500).json({
            message: 'Internal Server Error while fetching users.',
            details: err.message
        });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { email, password, name, mobile, role } = req.body;
        console.log('Create User Request:', { email, name, mobile, role });

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        if (!supabaseAdmin) {
            return res.status(500).json({ message: 'Server configuration error: No DB Access.' });
        }

        // --- DOMAIN LOGIC ---
        // 1. Identify Requester Domain
        const origin = req.headers.origin || req.headers.host || '';
        let requesterDomain = 'localhost';
        try { if (origin.startsWith('http')) requesterDomain = new URL(origin).hostname; } catch (e) { }

        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = requesterDomain === MASTER_DOMAIN || requesterDomain.includes('localhost');

        // 2. Determine Target Domain
        // If Super Admin AND providing a specific domain, use it.
        // Otherwise, force the user to be created in the current domain.
        let targetDomain = requesterDomain;
        if (req.body.signupDomain && isSuperAdmin) {
            console.log(`[Super Admin] Explicitly creating user for domain: ${req.body.signupDomain}`);
            targetDomain = req.body.signupDomain;
        }

        const userRole = role === 'admin' ? 'admin' : 'user';

        // 3. Create User in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true, // Auto-confirm email
            phone: mobile,
            user_metadata: {
                full_name: name || '',
                phone: mobile || '',
                signup_domain: targetDomain,
                role: userRole // Pass role to metadata
            }
        });

        if (error) {
            console.error('Supabase Create User Error:', error);
            return res.status(400).json({ message: 'Failed to create user.', error: error.message });
        }

        // 4. Force Update Profile (To ensure correct Role & Domain)
        // The trigger 'handle_new_user' might run async or might miss the role default.
        // We explicitly set it here to be safe and immediate.
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                signup_domain: targetDomain,
                role: userRole
            })
            .eq('id', data.user.id);

        if (profileError) {
            console.error('Profile Update Warning:', profileError);
            // Verify if row exists, if not insert it? Trigger should have handled it.
        }

        res.status(201).json({
            message: 'User created successfully.',
            user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.full_name,
                status: 'Active',
                role: userRole
            }
        });

    } catch (err) {
        console.error('Create User Exception:', err);
        res.status(500).json({ message: 'Internal Server Error during user creation.' });
    }
};

exports.toggleUserStatus = async (req, res) => {
    try {
        const { userId, action } = req.body;
        console.log(`Toggle user status request: ${action} for ${userId}`);

        if (!userId || !action) {
            return res.status(400).json({ message: 'User ID and action are required.' });
        }

        if (!supabaseAdmin) {
            return res.status(500).json({ message: 'Server configuration error.' });
        }

        // 1. Identify Requester (Admin)
        const origin = req.headers.origin || req.headers.host || '';
        let requestDomain = 'localhost';
        try { if (origin.startsWith('http')) requestDomain = new URL(origin).hostname; } catch (e) { }

        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = requestDomain === MASTER_DOMAIN || requestDomain.includes('localhost');

        // 2. Identify Target User's Domain
        // We need to fetch the user's profile or metadata to know where they belong
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain')
            .eq('id', userId)
            .single();

        let targetDomain = 'unknown';
        if (userProfile) {
            targetDomain = userProfile.signup_domain;
        } else {
            // Fallback: Fetch from Auth User Metadata if profile missing
            const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (user && user.user_metadata) {
                targetDomain = user.user_metadata.signup_domain || 'unknown';
            }
        }

        // 3. ENFORCE PERMISSIONS
        // If NOT Super Admin, they can ONLY touch users from their own domain
        if (!isSuperAdmin && targetDomain !== requestDomain) {
            console.warn(`[Security] Admin from ${requestDomain} tried to modify user from ${targetDomain}`);
            return res.status(403).json({
                message: 'Access Denied: You cannot manage users from other domains.'
            });
        }

        let updateData = {};
        if (action === 'activate') {
            updateData = { ban_duration: 'none' }; // 'none' lifts the ban in Supabase
        } else if (action === 'deactivate') {
            updateData = { ban_duration: '876000h' }; // Approx 100 years
        } else {
            return res.status(400).json({ message: 'Invalid action. Use "activate" or "deactivate".' });
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);

        if (error) {
            console.error('Supabase Update Error:', error);
            // Fallback for mock users
            if (userId.toString().length < 5) {
                return res.json({ message: `Mock user ${action}d successfully` });
            }
            return res.status(400).json({ message: 'Failed to update user status.', error: error.message });
        }

        res.json({ message: `User ${action}d successfully`, user: data.user });

    } catch (err) {
        console.error('Toggle Status Error:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { userId, email, password, name, mobile } = req.body;
        console.log('Update User Request:', { userId, email, name });

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        const attributes = {
            email: email,
            user_metadata: { full_name: name, phone: mobile }
        };

        if (password && password.trim() !== '') {
            attributes.password = password;
        }

        if (mobile) {
            attributes.phone = mobile;
        }

        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, attributes);

        if (error) {
            console.error('Supabase Update User Error:', error);
            return res.status(400).json({ message: 'Failed to update user.', error: error.message });
        }

        res.json({ message: 'User updated successfully', user: data.user });

    } catch (err) {
        console.error('Update User Exception:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.body;
        console.log('Delete User Request:', userId);

        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            console.error('Supabase Delete Error:', error);
            // Fallback for mock users
            if (userId.toString().length < 5) {
                return res.json({ message: 'Mock user deleted successfully' });
            }
            return res.status(400).json({ message: 'Failed to delete user', error: error.message });
        }

        res.json({ message: 'User deleted successfully' });

    } catch (err) {
        console.error('Delete User Exception:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.softDeleteUser = (req, res) => { res.json({ message: 'User soft deleted' }); };
exports.hardDeleteUser = (req, res) => { res.json({ message: 'User hard deleted' }); };
exports.changeUserPassword = (req, res) => { res.json({ message: 'Password changed' }); };
exports.impersonateUser = async (req, res) => {
    try {
        const { email } = req.body;
        console.log('Received impersonation request for:', email);

        if (!email) {
            return res.status(400).json({ message: 'Email is required for impersonation.' });
        }

        if (!supabaseAdmin) {
            console.error('Supabase Admin client not initialized.');
            return res.status(500).json({ message: 'Server configuration error.' });
        }

        // =========================================================================
        // DYNAMIC URL DETECTION (Tenancy Aware)
        // =========================================================================

        // 1. Fetch Target User's Domain
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain')
            .eq('email', email)
            .single();

        let targetDomain = userProfile ? userProfile.signup_domain : 'clickube.com';

        // Handle Localhost vs Production Logic
        // If we are on localhost, we likely want to stay on localhost but maybe different port? 
        // Or if we are testing domains locally with hosts file.
        // For production: construct https://{targetDomain}

        // PROD MODE: Dynamic Redirect
        // FORCE the link to point to the user's domain.
        const protocol = targetDomain.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${targetDomain}`;

        console.log(`[Impersonation] Targeting: ${baseUrl}`);

        console.log(`Impersonation: Redirecting to: '${baseUrl}'`);

        // Generate a magic link for the user
        // BOUNCE STRATEGY:
        // 1. Redirect to Master Domain (whitelisted).
        // 2. Append 'bounce' param with the final target.
        // 3. Frontend on Master will forward the #access_token to the target.

        const masterUrl = process.env.VITE_MASTER_URL || 'https://clickube.com';
        const bounceUrl = `${masterUrl}?bounce=${encodeURIComponent(baseUrl)}`;

        console.log(`[Impersonation] Bounce URL: ${bounceUrl}`);

        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: bounceUrl
            }
        });

        if (error) {
            console.error('Supabase Generate Link Error:', error);
            // Fallback for demo/mock users if real Supabase call fails due to invalid email in mock
            if (email.includes('Mock') || error.message.includes('User not found')) {
                return res.json({
                    url: `${clientUrl}/login?mock_impersonate=${encodeURIComponent(email)}`,
                    message: 'Mock impersonation link generated'
                });
            }
            return res.status(400).json({ message: 'Failed to generate access link.', error: error.message });
        }

        console.log('Generated impersonation link:', data.properties.action_link);
        res.json({ url: data.properties.action_link });

    } catch (err) {
        console.error('Impersonation Error:', err);
        res.status(500).json({ message: 'Internal Server Error during impersonation.' });
    }
};
