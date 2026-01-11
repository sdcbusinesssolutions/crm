const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getAllSubscriptions = async (req, res) => {
    try {
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

        // Fetch Plans
        const { data: plans } = await supabaseAdmin.from('plans').select('id, name');

        // Fetch Users (We need to get user details to display names/emails)
        // Since we can't always join auth.users easily depending on permissions, we'll fetch list
        // Note: Listing all users might be heavy, but for this admin view it's acceptable or we can paginate later.
        const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.listUsers();
        const users = userResult?.users || [];

        if (userError) {
            console.error('Fetch Users Error:', userError);
        }

        const planMap = new Map(plans?.map(p => [p.id, p.name]));
        const userMap = new Map(users?.map(u => [u.id, u]));

        const formattedData = subs.map(sub => {
            const user = userMap.get(sub.user_id);
            const planName = planMap.get(sub.plan_id) || 'Unknown Plan';
            const isExpired = new Date(sub.end_date) < new Date();

            return {
                id: sub.id,
                user_id: sub.user_id, // Store for history lookup
                user: user ? (user.user_metadata?.full_name || user.email) : 'Unknown User',
                email: user?.email,
                plan: planName,
                created: new Date(sub.start_date).toLocaleDateString(),
                expiry: new Date(sub.end_date).toLocaleDateString(),
                charges: `${sub.amount || 0} ${sub.currency || 'INR'}`,
                type: sub.payment_term,
                status: sub.status === 'active' && !isExpired ? 'Active' : (sub.status === 'cancelled' ? 'Cancelled' : 'Expired'),
                raw_status: sub.status // Keep raw active/cancelled status
            };
        });

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

        const updates = {};
        if (planId) updates.plan_id = planId;
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

        res.json({ message: 'Subscription updated successfully', subscription: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.deleteSubscription = async (req, res) => {
    try {
        const { id } = req.body;
        const { error } = await supabaseAdmin
            .from('user_subscriptions')
            .delete()
            .eq('id', id);

        if (error) {
            return res.status(400).json({ message: 'Failed to delete subscription', error: error.message });
        }
        res.json({ message: 'Subscription deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
