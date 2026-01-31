const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getUsers = async (req, res) => {
    try {
        if (!supabaseAdmin) {
            return res.status(500).json({ message: 'Server misconfiguration: No DB Access' });
        }

        // Extract domain from admin token (set by authMiddleware)
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            console.error('Admin domain not found in token');
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Check if super admin
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        console.log(`[UsersController] Fetching users for domain: ${adminDomain}, isSuperAdmin: ${isSuperAdmin}`);

        // Fetch profiles from database
        const { data: profiles, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('SERVER ERROR: Failed to list profiles.', error);
            // Handle Schema Cache Error (PGRST205) or Undefined Table (42P01)
            if (error.code === 'PGRST205' || error.code === '42P01') {
                console.warn('⚠️ WARNING: public.profiles table not found or schema cache stale.');
                console.warn('👉 ACTION REQUIRED: Run \"server/sql/200_combined_multi_tenancy.sql\" in your Supabase SQL Editor.');
                console.warn('👉 OR: Restart your Supabase project to refresh the schema cache.');

                // Return empty array to keep UI valid instead of crashing
                return res.json([]);
            }
            throw error;
        }

        // Filter users based on domain (super admin sees all)
        let targetProfiles = profiles;
        if (!isSuperAdmin) {
            console.log(`[UsersController] Filtering users for Tenant: ${adminDomain}`);
            targetProfiles = profiles.filter(p => p.signup_domain === adminDomain);
        } else {
            console.log(`[UsersController] Super Admin Access - Showing ALL ${profiles.length} users.`);
        }

        const mappedUsers = targetProfiles.map(u => {
            const createdDate = new Date(u.created_at);
            const formattedDate = createdDate.toLocaleDateString('en-GB', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            return {
                id: u.id,
                name: u.full_name || u.name || 'User',
                email: u.email,
                status: 'Active',
                mobile: u.phone || u.mobile || 'N/A',
                // Add domain info so Super Admin knows where they came from
                signupDomain: u.signup_domain,
                adminStatus: u.role || 'Standard',
                current_plan: u.plan_name || 'Free',
                createdOn: formattedDate,
                lastSignIn: null
            };
        });

        console.log(`[UsersController] Returning ${mappedUsers.length} users for domain ${adminDomain}`);
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

        // Determine Request Origin (for fallback)
        const origin = req.headers.origin || req.headers.host || '';
        console.log(`[Impersonation Debug] Raw Origin/Host: '${origin}'`); // DEBUG

        let requestBase = origin;
        if (requestBase && !requestBase.startsWith('http')) {
            requestBase = (origin.includes('localhost') ? 'http' : 'https') + '://' + requestBase;
        }

        console.log(`[Impersonation Debug] Normalized RequestBase: '${requestBase}'`); // DEBUG

        let currentCallbackDomain = 'clickube.com';
        try {
            if (requestBase) currentCallbackDomain = new URL(requestBase).hostname;
        } catch (e) {
            console.error(`[Impersonation Debug] URL Parse Error:`, e.message);
        }

        console.log(`[Impersonation Debug] Resolved Callback Domain: '${currentCallbackDomain}'`); // DEBUG       

        // Decide Target Domain
        // PRIORITY:
        // 1. If the Admin is on a custom domain (not clickube.com), KEEP them on that domain.
        // 2. If the Admin is on the Master Domain, send them to the User's assigned domain.

        const MASTER_HOST = 'clickube.com';
        let targetDomain = currentCallbackDomain;

        // If we are on the Master Domain (or localhost mimicking it), respect the User's specific domain
        if (currentCallbackDomain.includes(MASTER_HOST) && userProfile && userProfile.signup_domain) {
            targetDomain = userProfile.signup_domain;
        }
        // Otherwise (we are on a whitelabel domain), force that domain (Sticky Attribute)
        else {
            targetDomain = currentCallbackDomain;
        }

        if (!targetDomain) targetDomain = MASTER_HOST;

        // Normalize target domain
        const normalize = (d) => d ? d.trim().toLowerCase().replace(/^www\./, '') : '';
        targetDomain = normalize(targetDomain);

        console.log(`[Impersonation Debug] Final Target Domain: '${targetDomain}'`); // DEBUG

        // Handle Localhost vs Production Logic
        const isTargetLocalhost = targetDomain.includes('localhost') || targetDomain.includes('127.0.0.1');
        const protocol = isTargetLocalhost ? 'http' : 'https';
        const baseUrl = `${protocol}://${targetDomain}`;

        console.log(`[Impersonation] Targeting Base URL: ${baseUrl}`);
        // console.log(`Impersonation: Redirecting to: '${baseUrl}'`);

        // Generate a magic link for the user
        // BOUNCE STRATEGY:
        // 1. Redirect to Master Domain (whitelisted).
        // 2. Append 'bounce' param with the final target.

        // Determine Master URL (Fallback to request origin if not set)
        // We use the request origin as a fallback for masterUrl if VITE_MASTER_URL is missing.
        // This supports local development where 'origin' might be localhost.
        // Note: 'origin' and 'requestBase' are already calculated above.

        let envMaster = process.env.VITE_MASTER_URL || '';
        if (envMaster.includes(',')) {
            envMaster = envMaster.split(',')[0]; // Handle cases like "url,false" or list of urls
        }

        const masterUrl = envMaster.trim() || requestBase || 'https://clickube.com';
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
            const clientUrl = masterUrl; // Fix ReferenceError

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

exports.assignPlan = async (req, res) => {
    try {
        const { userId, planId, durationDays } = req.body;
        console.log('Assign Plan Request:', { userId, planId, durationDays });

        if (!userId || !planId) {
            return res.status(400).json({ message: 'User ID and Plan ID are required.' });
        }

        if (!supabaseAdmin) {
            return res.status(500).json({ message: 'Server configuration error.' });
        }

        // 1. Fetch Plan Details
        const { data: plan, error: planError } = await supabaseAdmin
            .from('plans')
            .select('*')
            .eq('id', planId)
            .single();

        if (planError || !plan) {
            return res.status(404).json({ message: 'Plan not found.' });
        }

        // 2. Validate Domain (Isolation)
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        if (!isSuperAdmin && plan.domain !== adminDomain) {
            return res.status(403).json({ message: 'Access Denied: You cannot assign plans from other domains.' });
        }

        // 3. Calculate Expiry
        let finalDuration = durationDays ? parseInt(durationDays) : 30;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + finalDuration);

        // 4. Update Profile
        const updateData = {
            plan_name: plan.name,
            plan_status: 'active',
            plan_expires_at: expiryDate.toISOString()
        };

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('Profile Plan Update Error:', updateError);
            return res.status(400).json({ message: 'Failed to update user profile with plan.', error: updateError.message });
        }

        // 5. Add strictly to history
        const subscriptionData = {
            user_id: userId,
            plan_id: planId,
            start_date: new Date().toISOString(),
            end_date: expiryDate.toISOString(),
            status: 'active'
        };

        await supabaseAdmin.from('user_subscriptions').insert([subscriptionData]);

        res.json({ message: 'Plan assigned successfully', plan: plan.name, expiresAt: expiryDate });

    } catch (err) {
        console.error('Assign Plan Exception:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
