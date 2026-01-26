const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getAllPlans = async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ message: 'DB setup error' });

        // Extract domain from admin token (set by authMiddleware)
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;

        if (!adminDomain) {
            console.error('Admin domain not found in token');
            return res.status(403).json({ message: 'Domain information missing' });
        }

        console.log(`[PlansController] Fetching plans for domain: ${adminDomain}`);

        // Filter plans by domain
        const { data, error } = await supabaseAdmin
            .from('plans')
            .select('*')
            .eq('domain', adminDomain)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Fetch Plans Error:', error);
            // Fallback for UI if table doesn't exist yet
            if (error.code === '42P01') {
                return res.json([]);
            }
            return res.status(500).json({ message: 'Failed to fetch plans' });
        }

        console.log(`[PlansController] Found ${data.length} plans for domain ${adminDomain}`);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.createPlan = async (req, res) => {
    try {
        const planData = req.body;

        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Ensure the plan is created for the admin's domain
        const planWithDomain = {
            ...planData,
            domain: adminDomain
        };

        console.log(`[PlansController] Creating plan for domain: ${adminDomain}`, planWithDomain);

        const { data, error } = await supabaseAdmin
            .from('plans')
            .insert([planWithDomain])
            .select();

        if (error) {
            console.error('Create Plan Error:', error);
            return res.status(400).json({ message: 'Failed to create plan', error: error.message });
        }

        res.status(201).json({ message: 'Plan created successfully', plan: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.updatePlan = async (req, res) => {
    try {
        const { id, ...updates } = req.body;
        if (!id) return res.status(400).json({ message: 'Plan ID required' });

        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Only allow updating plans from the same domain
        const { data, error } = await supabaseAdmin
            .from('plans')
            .update(updates)
            .eq('id', id)
            .eq('domain', adminDomain)
            .select();

        if (error) {
            console.error('Update Plan Error:', error);
            return res.status(400).json({ message: 'Failed to update plan', error: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Plan not found or access denied' });
        }

        res.json({ message: 'Plan updated successfully', plan: data[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ message: 'Plan ID required' });

        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        if (!adminDomain) {
            return res.status(403).json({ message: 'Domain information missing' });
        }

        // Only allow deleting plans from the same domain
        const { data, error } = await supabaseAdmin
            .from('plans')
            .delete()
            .eq('id', id)
            .eq('domain', adminDomain)
            .select();

        if (error) {
            console.error('Delete Plan Error:', error);
            return res.status(400).json({ message: 'Failed to delete plan', error: error.message });
        }

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'Plan not found or access denied' });
        }

        res.json({ message: 'Plan deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
