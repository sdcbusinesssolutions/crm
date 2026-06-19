const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getAllSubscriptions = async (req, res) => {
    try {
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            console.error('Admin domain not found in token');
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Check if super admin
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        console.log(`[SubscriptionController] Fetching subscriptions for domain: ${adminDomain}, isSuperAdmin: ${isSuperAdmin}`);

        // Fetch raw subscriptions
        const { data: subs, error: subError } = await supabaseAdmin
            .from('user_subscriptions')
            .select('*')
            .order('created_at', { ascending: false });

        if (subError) {
            console.error('Fetch Subscriptions Error:', subError);
            if (subError.code === '42P01') return res.json([]); // Table doesn't exist
            return res.status(500).json({ message: 'Failed to fetch subscriptions' });
        }

        // Fetch Plans (filter by domain for regular admins)
        let plansQuery = supabaseAdmin.from('plans').select('id, name, domain, pricing');
        if (!isSuperAdmin) {
            plansQuery = plansQuery.eq('domain', adminDomain);
        }
        const { data: plans } = await plansQuery;

        // Fetch Users (Profiles) instead of Auth API to avoid hangs
        let profilesQuery = supabaseAdmin.from('profiles').select('*');

        if (!isSuperAdmin) {
            profilesQuery = profilesQuery.eq('signup_domain', adminDomain);
        }

        const { data: profiles, error: profilesError } = await profilesQuery;

        if (profilesError) {
            console.error('Fetch Profiles Error:', profilesError);
        }

        const safeProfiles = profiles || [];
        const profileMap = new Map(safeProfiles.map(p => [p.id, p]));
        const planMap = new Map(plans?.map(p => [p.id, { name: p.name, domain: p.domain, pricing: p.pricing }]));

        // Filter subscriptions based on domain
        let filteredSubs = subs;
        if (!isSuperAdmin) {
            filteredSubs = subs.filter(sub => profileMap.has(sub.user_id));
        }

        const formattedData = filteredSubs.map(sub => {
            const profile = profileMap.get(sub.user_id);
            const userName = profile ? (profile.full_name || profile.name || profile.email) : 'Unknown User';
            const userEmail = profile?.email;

            const planInfo = planMap.get(sub.plan_id);
            const planName = planInfo?.name || 'Unknown Plan';
            const isExpired = new Date(sub.end_date) < new Date();

            // Fallback amount logic
            let displayAmount = sub.amount;
            if (displayAmount === null || displayAmount === undefined || displayAmount === 0) {
                if (planInfo && planInfo.pricing && Array.isArray(planInfo.pricing)) {
                    // Try to find a matching price logic
                    const enabledPrice = planInfo.pricing.find(p => p.enabled && (
                        !sub.payment_term ||
                        p.name === sub.payment_term ||
                        `${p.interval_count || 1} ${p.interval || 'month'}(s)` === sub.payment_term
                    ));

                    if (enabledPrice) {
                        displayAmount = enabledPrice.amount;
                    } else {
                        // Fallback to first enabled if no precise match
                        const anyPrice = planInfo.pricing.find(p => p.enabled);
                        if (anyPrice) displayAmount = anyPrice.amount;
                    }
                }
            }

            return {
                id: sub.id,
                user_id: sub.user_id,
                user: userName,
                email: userEmail,
                signupDomain: profile?.signup_domain || 'Unknown',
                plan: planName,
                created: new Date(sub.start_date).toLocaleDateString(),
                expiry: new Date(sub.end_date).toLocaleDateString(),
                charges: `${displayAmount !== undefined && displayAmount !== null ? displayAmount : 0} ${sub.currency || 'INR'}`,
                type: sub.payment_term,
                status: sub.status === 'active' && !isExpired ? 'Active' : (sub.status === 'cancelled' ? 'Cancelled' : 'Expired'),
                raw_status: sub.status
            };
        });

        console.log(`[SubscriptionController] Returning ${formattedData.length} subscriptions for domain ${adminDomain}`);
        res.json(formattedData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.getUserSubscriptionHistory = async (req, res) => {
    try {
        const { userId } = req.params;
        const { data: subs, error } = await supabaseAdmin
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(400).json({ message: 'Error fetching history' });
        }

        // Fetch Plans to map names
        const { data: plans } = await supabaseAdmin.from('plans').select('id, name');
        const planMap = new Map(plans?.map(p => [p.id, p.name]));

        const history = subs.map(sub => ({
            id: sub.id,
            plan: planMap.get(sub.plan_id) || 'Unknown Plan',
            start_date: new Date(sub.start_date).toLocaleDateString(),
            end_date: new Date(sub.end_date).toLocaleDateString(),
            amount: sub.amount,
            currency: sub.currency,
            status: sub.status,
            payment_term: sub.payment_term
        }));

        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.assignSubscription = async (req, res) => {
    try {
        const { userId, planId, pricingOption } = req.body;

        console.log('Assigning Subscription:', { userId, planId, pricingOption });

        if (!userId || !planId || !pricingOption) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Check if super admin
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        // Validate that the plan belongs to the admin's domain (unless super admin)
        const { data: plan } = await supabaseAdmin
            .from('plans')
            .select('name, domain')
            .eq('id', planId)
            .single();

        if (!plan) {
            return res.status(404).json({ message: 'Plan not found' });
        }

        if (!isSuperAdmin && plan.domain !== adminDomain) {
            console.warn(`[SubscriptionController] Domain mismatch: Plan domain ${plan.domain} vs Admin domain ${adminDomain}`);
            return res.status(403).json({ message: 'Cannot assign plans from other domains' });
        }

        // Validate that the user belongs to the admin's domain (unless super admin)
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain')
            .eq('id', userId)
            .single();

        if (!userProfile) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!isSuperAdmin && userProfile.signup_domain !== adminDomain) {
            console.warn(`[SubscriptionController] Domain mismatch: User domain ${userProfile.signup_domain} vs Admin domain ${adminDomain}`);
            return res.status(403).json({ message: 'Cannot assign subscriptions to users from other domains' });
        }

        // NEW: LIMIT ENFORCEMENT
        const alreadyAssigned = userProfile?.plan_assigned_by_admin && userProfile?.plan_status === 'active';

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

        const startDate = new Date();
        const endDate = new Date(startDate);
        const { interval, interval_count } = pricingOption;

        // Calculate End Date
        if (interval === 'day') {
            endDate.setDate(endDate.getDate() + parseInt(interval_count));
        } else if (interval === 'week') {
            endDate.setDate(endDate.getDate() + (parseInt(interval_count) * 7));
        } else if (interval === 'month') {
            endDate.setMonth(endDate.getMonth() + parseInt(interval_count));
        } else if (interval === 'year') {
            endDate.setFullYear(endDate.getFullYear() + parseInt(interval_count));
        }

        const subscriptionData = {
            user_id: userId,
            plan_id: planId,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            status: 'active',
            payment_term: pricingOption.name || `${interval_count} ${interval}(s)`,
            amount: pricingOption.amount,
            currency: 'INR', // Default or from schema
            created_at: new Date().toISOString()
        };

        // Insert into DB
        const { data, error } = await supabaseAdmin
            .from('user_subscriptions')
            .insert([subscriptionData])
            .select();

        if (error) {
            console.error('Assign Subscription Error:', error);
            // Handle if table doesn't exist, maybe try to create it? (Optional, skipping for now)
            return res.status(400).json({ message: 'Failed to assign subscription', error: error.message });
        }

        // SYNC PROFILE with new Plan
        const { error: profileSyncError } = await supabaseAdmin
            .from('profiles')
            .update({
                plan_name: plan.name,
                plan_status: 'active',
                plan_expires_at: endDate.toISOString(),
                plan_assigned_by_admin: true
            })
            .eq('id', userId);

        if (profileSyncError) {
            console.error('Warning: Failed to sync profile plan status', profileSyncError);
        }

        console.log(`[SubscriptionController] Subscription assigned successfully for user ${userId} by admin ${adminDomain}`);
        res.json({ message: 'Subscription assigned successfully', subscription: data[0] });

    } catch (err) {
        console.error('Assign Subscription Exception:', err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.updateSubscription = async (req, res) => {
    try {
        const { id, planId, status, expiryDate } = req.body;

        if (!id) return res.status(400).json({ message: 'Subscription ID is required' });

        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Check if super admin
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        // Fetch the subscription to validate domain access
        const { data: existingSub } = await supabaseAdmin
            .from('user_subscriptions')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!existingSub) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        // Validate user domain (unless super admin)
        if (!isSuperAdmin) {
            const { data: userProfile } = await supabaseAdmin
                .from('profiles')
                .select('signup_domain')
                .eq('id', existingSub.user_id)
                .single();

            if (!userProfile || userProfile.signup_domain !== adminDomain) {
                console.warn(`[SubscriptionController] Domain mismatch on update: User domain ${userProfile?.signup_domain} vs Admin domain ${adminDomain}`);
                return res.status(403).json({ message: 'Cannot update subscriptions from other domains' });
            }
        }

        const updates = {};
        if (planId) {
            // Validate new plan domain if changing plan
            const { data: plan } = await supabaseAdmin
                .from('plans')
                .select('domain')
                .eq('id', planId)
                .single();

            if (!plan) {
                return res.status(404).json({ message: 'Plan not found' });
            }

            if (!isSuperAdmin && plan.domain !== adminDomain) {
                return res.status(403).json({ message: 'Cannot assign plans from other domains' });
            }

            updates.plan_id = planId;
        }
        if (status) updates.status = status;
        if (expiryDate) updates.end_date = expiryDate;

        const { data, error } = await supabaseAdmin
            .from('user_subscriptions')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Update Subscription Error:', error);
            return res.status(400).json({ message: 'Failed to update subscription', error: error.message });
        }

        console.log(`[SubscriptionController] Subscription ${id} updated by admin ${adminDomain}`);
        res.json({ message: 'Subscription updated successfully', subscription: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.deleteSubscription = async (req, res) => {
    try {
        const { id } = req.body;

        if (!id) return res.status(400).json({ message: 'Subscription ID is required' });

        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;

        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Check if super admin
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost';

        // Fetch the subscription to validate domain access
        const { data: existingSub } = await supabaseAdmin
            .from('user_subscriptions')
            .select('user_id')
            .eq('id', id)
            .single();

        if (!existingSub) {
            return res.status(404).json({ message: 'Subscription not found' });
        }

        // Validate user domain (unless super admin)
        if (!isSuperAdmin) {
            const { data: userProfile } = await supabaseAdmin
                .from('profiles')
                .select('signup_domain')
                .eq('id', existingSub.user_id)
                .single();

            if (!userProfile || userProfile.signup_domain !== adminDomain) {
                console.warn(`[SubscriptionController] Domain mismatch on delete: User domain ${userProfile?.signup_domain} vs Admin domain ${adminDomain}`);
                return res.status(403).json({ message: 'Cannot delete subscriptions from other domains' });
            }
        }

        const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ message: 'Failed to delete subscription', error: error.message });
        }

        console.log(`[SubscriptionController] Subscription ${id} deleted by admin ${adminDomain}`);
        res.json({ message: 'Subscription deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
