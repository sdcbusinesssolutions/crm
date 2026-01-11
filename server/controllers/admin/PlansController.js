const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getAllPlans = async (req, res) => {
    try {
        if (!supabaseAdmin) return res.status(500).json({ message: 'DB setup error' });

        const { data, error } = await supabaseAdmin
            .from('plans')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Fetch Plans Error:', error);
            // Fallback for UI if table doesn't exist yet
            if (error.code === '42P01') {
                return res.json([]);
            }
            return res.status(500).json({ message: 'Failed to fetch plans' });
        }

        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

exports.createPlan = async (req, res) => {
    try {
        const planData = req.body;
        console.log('Creating plan:', planData);

        const { data, error } = await supabaseAdmin
            .from('plans')
            .insert([planData])
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

        const { data, error } = await supabaseAdmin
            .from('plans')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) {
            console.error('Update Plan Error:', error);
            return res.status(400).json({ message: 'Failed to update plan', error: error.message });
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

        const { error } = await supabaseAdmin
            .from('plans')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete Plan Error:', error);
            return res.status(400).json({ message: 'Failed to delete plan', error: error.message });
        }

        res.json({ message: 'Plan deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};
