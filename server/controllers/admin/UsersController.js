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

        const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7', 10);
        const DELETE_WINDOW_DAYS = parseInt(process.env.TENANT_ADMIN_DELETE_WINDOW_DAYS || '9', 10);
        const now = new Date();

        // Fetch ALL wallet rows — both regular and master wallets
        const { data: wallets } = await supabaseAdmin
            .from('user_wallets')
            .select('user_id, balance, is_tenant_master, billing_mode');

        // Regular wallet: user's message-sending balance
        const walletMap = new Map();
        // Master wallet: Tenant Admin's wholesale credit pool
        const masterWalletMap = new Map();

        (wallets || []).forEach(w => {
            if (w.is_tenant_master) {
                masterWalletMap.set(w.user_id, Number(w.balance || 0));
            } else {
                walletMap.set(w.user_id, {
                    balance: Number(w.balance || 0),
                    billing_mode: w.billing_mode || 'DIRECT_META'
                });
            }
        });

        const mappedUsers = targetProfiles.map(u => {
            const createdDate = new Date(u.created_at || now);
            const formattedDate = createdDate.toLocaleDateString('en-GB', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });

            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
            const daysSinceCreation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Map plan_status to UI status
            let uiStatus = 'Active';
            if (u.plan_status === 'suspended' || u.plan_status === 'banned') {
                uiStatus = 'Inactive';
            } else if (u.plan_expires_at && new Date(u.plan_expires_at) < now) {
                uiStatus = 'Expired';
            }

            // Determination of Trial and Delete Eligibility
            const isTrialUser = (u.plan_name === 'Free Trial' || u.plan_name === 'Free') && daysSinceCreation <= TRIAL_DAYS;
            const canTenantDelete = !u.plan_assigned_by_admin && daysSinceCreation <= DELETE_WINDOW_DAYS;

            const isTenantAdmin = (u.role === 'admin');
            const walletInfo = walletMap.get(u.id) || { balance: 0, billing_mode: 'DIRECT_META' };
            const masterBalance = masterWalletMap.has(u.id) ? masterWalletMap.get(u.id) : null;

            return {
                id: u.id,
                name: u.full_name || u.name || 'User',
                email: u.email,
                status: uiStatus,
                mobile: u.phone || u.mobile || 'N/A',
                signupDomain: u.signup_domain,
                adminStatus: u.role || 'Standard',
                current_plan: u.plan_name || 'Free',
                createdOn: formattedDate,
                daysOld: daysSinceCreation,
                isTrialUser,
                canTenantDelete,
                lastSignIn: null,
                wallet_balance: walletInfo.balance,
                billing_mode: walletInfo.billing_mode,
                // Tenant Admin-specific fields
                is_tenant_admin: isTenantAdmin,
                // master_wallet_balance: null = no master wallet set up yet (not yet funded by Super Admin)
                // master_wallet_balance: 0   = funded before but now depleted
                // master_wallet_balance: >0  = has credits to distribute
                master_wallet_balance: masterBalance
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
        let targetDomain = requesterDomain;
        if (req.body.signupDomain && isSuperAdmin) {
            console.log(`[Super Admin] Explicitly creating user for domain: ${req.body.signupDomain}`);
            targetDomain = req.body.signupDomain;
        }

        const userRole = role === 'admin' ? 'admin' : 'user';

        // --- TRIAL PERIOD CONFIG ---
        // Configurable via TRIAL_DAYS env variable (default: 7 days)
        const TRIAL_DAYS = parseInt(process.env.TRIAL_DAYS || '7', 10);
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + TRIAL_DAYS);

        // 3. Create User in Supabase Auth
        const createPayload = {
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name || '',
                phone: mobile || '',
                signup_domain: targetDomain,
                role: userRole
            }
        };

        if (mobile && mobile.trim() !== '') {
            createPayload.phone = mobile;
        }

        const { data, error } = await supabaseAdmin.auth.admin.createUser(createPayload);

        if (error) {
            console.error('Supabase Create User Error:', error);
            return res.status(400).json({ message: 'Failed to create user.', error: error.message });
        }

        // 4. Stamp profile with domain, role AND the default Free Trial expiry.
        //    The DB trigger (handle_new_user) may have already created the row;
        //    we upsert here to guarantee correct values.
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                signup_domain: targetDomain,
                role: userRole,
                plan_name: 'Free Trial',
                plan_status: 'active',
                plan_expires_at: trialExpiry.toISOString(),
                plan_assigned_by_admin: false   // no paid plan yet
            })
            .eq('id', data.user.id);

        if (profileError) {
            console.warn('[createUser] Profile update warning:', profileError.message);
        }

        console.log(`[createUser] User ${email} created on ${targetDomain} with ${TRIAL_DAYS}-day trial.`);

        res.status(201).json({
            message: 'User created successfully.',
            trialDays: TRIAL_DAYS,
            trialExpiresAt: trialExpiry,
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

        let authUpdateData = {};
        let dbStatus = 'active';

        if (action === 'activate') {
            authUpdateData = { ban_duration: 'none' };
            dbStatus = 'active';
        } else if (action === 'deactivate') {
            authUpdateData = { ban_duration: '876000h' }; // Approx 100 years
            dbStatus = 'suspended';
        } else {
            return res.status(400).json({ message: 'Invalid action. Use "activate" or "deactivate".' });
        }

        // 4. Update Supabase Auth (Native Ban)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdateData);

        if (authError) {
            console.error('Supabase Auth Update Error:', authError);
            if (userId.toString().length < 5) return res.json({ message: `Mock user ${action}d successfully` });
            return res.status(400).json({ message: `Failed to update Auth status: ${authError.message}` });
        }

        // 5. Sync with Profiles Table (for listing and DB checks)
        const { error: syncError } = await supabaseAdmin
            .from('profiles')
            .update({ plan_status: dbStatus })
            .eq('id', userId);

        if (syncError) {
            console.warn('[toggleUserStatus] DB Profile sync warning:', syncError.message);
        }

        res.json({ message: `User account has been ${action === 'activate' ? 'unblocked' : 'blocked'} successfully.` });

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
        if (!supabaseAdmin) return res.status(500).json({ message: 'Server configuration error.' });

        // ── Identify the requesting admin ────────────────────────────────────
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole   = req.admin?.role;
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL
            ? new URL(process.env.VITE_MASTER_URL).hostname
            : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin'
            || adminDomain === MASTER_DOMAIN
            || (adminDomain || '').includes('localhost');

        // ── Load the target user's profile ───────────────────────────────────
        const { data: profile, error: profileFetchError } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain, plan_name, plan_assigned_by_admin, created_at')
            .eq('id', userId)
            .single();

        if (profileFetchError || !profile) {
            // Handle mock/test users with short IDs
            if (userId.toString().length < 5) {
                return res.json({ message: 'Mock user deleted successfully' });
            }
            return res.status(404).json({ message: 'User not found.' });
        }

        // ── SUPER ADMIN: unrestricted delete ─────────────────────────────────
        if (isSuperAdmin) {
            console.log(`[deleteUser] Super Admin deleting user ${userId}`);
            const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (error) {
                console.error('Supabase Delete Error (Super Admin):', error);
                return res.status(400).json({ 
                    message: 'Error: Platform was unable to delete the user account.', 
                    details: error.message 
                });
            }
            return res.json({ 
                message: 'Super Admin: User account and all associated data have been deleted successfully.' 
            });
        }

        // ── TENANT ADMIN: restricted delete ──────────────────────────────────
        // Rule 1 – Can only manage users from their own domain
        if (profile.signup_domain !== adminDomain) {
            console.warn(`[deleteUser] Domain mismatch: admin ${adminDomain} tried to delete user from ${profile.signup_domain}`);
            return res.status(403).json({ 
                message: 'Security Alert: You do not have permission to delete users from other workspaces.' 
            });
        }

        // Rule 2 – Cannot delete a user who has a paid plan assigned
        const hasPaidPlan = profile.plan_assigned_by_admin === true;
        if (hasPaidPlan) {
            return res.status(403).json({
                message: 'Action Denied: This user has a paid plan assigned. To protect customer data, only a Super Admin can delete active subscribers.'
            });
        }

        // Rule 3 – Can only delete trial users within the configurable window
        const DELETE_WINDOW_DAYS = parseInt(process.env.TENANT_ADMIN_DELETE_WINDOW_DAYS || '9', 10);
        const createdAt = new Date(profile.created_at);
        const nowMs     = Date.now();
        const daysSinceCreation = Math.floor((nowMs - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceCreation > DELETE_WINDOW_DAYS) {
            return res.status(403).json({
                message: `Action Denied: The ${DELETE_WINDOW_DAYS}-day deletion window for this trial user has expired (Account Age: ${daysSinceCreation} days). Please contact Support or the Super Admin to request deletion.`
            });
        }

        // All checks passed — proceed with deletion
        console.log(`[deleteUser] Tenant Admin (${adminDomain}) deleting trial user ${userId} (${daysSinceCreation} days old).`);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (deleteError) {
            console.error('Supabase Delete Error (Tenant Admin):', deleteError);
            return res.status(400).json({ message: 'Failed to delete user.', error: deleteError.message });
        }

        res.json({ message: 'User deleted successfully.' });

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

        // NEW: LIMIT ENFORCEMENT
        const { data: targetUser } = await supabaseAdmin
            .from('profiles')
            .select('plan_assigned_by_admin, plan_status')
            .eq('id', userId)
            .single();

        const alreadyAssigned = targetUser?.plan_assigned_by_admin && targetUser?.plan_status === 'active';

        if (!isSuperAdmin && !alreadyAssigned) {
            const { data: limitData } = await supabaseAdmin
                .from('tenant_limits')
                .select('user_limit')
                .eq('domain', adminDomain)
                .single();
            
            const userLimit = limitData ? limitData.user_limit : 0;

            const { count, error: countError } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('signup_domain', adminDomain)
                .eq('plan_assigned_by_admin', true)
                .eq('plan_status', 'active');
            
            if (countError) {
                return res.status(500).json({ message: 'Error checking tenant limits.' });
            }

            if (count >= userLimit) {
                return res.status(403).json({ message: `Your user limit of ${userLimit} has been reached. Please contact Super Admin to increase your limit.` });
            }
        }

        // 3. Calculate Expiry
        let finalDuration = durationDays ? parseInt(durationDays) : 30;
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + finalDuration);

        // 4. Update Profile — also flag plan_assigned_by_admin = TRUE
        //    This prevents Tenant Admin from deleting the user going forward.
        const updateData = {
            plan_name: plan.name,
            plan_status: 'active',
            plan_expires_at: expiryDate.toISOString(),
            plan_assigned_by_admin: true   // ← locks out tenant-admin delete
        };

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(updateData)
            .eq('id', userId);

        if (updateError) {
            console.error('Profile Plan Update Error:', updateError);
            return res.status(400).json({ message: 'Failed to update user profile with plan.', error: updateError.message });
        }

        // 5. Record subscription history
        const subscriptionData = {
            user_id: userId,
            plan_id: planId,
            start_date: new Date().toISOString(),
            end_date: expiryDate.toISOString(),
            status: 'active'
        };

        await supabaseAdmin.from('user_subscriptions').insert([subscriptionData]);

        console.log(`[assignPlan] Plan "${plan.name}" assigned to user ${userId} by admin ${adminDomain}. plan_assigned_by_admin = true.`);
        res.json({ message: 'Plan assigned successfully', plan: plan.name, expiresAt: expiryDate });

    } catch (err) {
        console.error('Assign Plan Exception:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
