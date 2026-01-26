const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const SmtpService = require('../../services/SmtpService');

// List connections
router.get('/connections', async (req, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'smtp');

        if (error) throw error;
        // Don't return password strictly speaking, but we might need it for editing if we allowed it (we won't for now)
        const safeData = data.map(d => ({
            id: d.id,
            connection_name: d.connection_name,
            host: d.credentials.host, // Return host for UI display
            user: d.credentials.user,
            fromEmail: d.credentials.fromEmail,
            created_at: d.created_at
        }));
        res.json(safeData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save Connection
router.post('/connection', async (req, res) => {
    try {
        const userId = req.user.id;
        // Accept encryption
        const { name, host, port, user, pass, fromEmail, encryption } = req.body;

        if (!host || !port || !user || !pass) {
            return res.status(400).json({ error: 'Missing Required SMTP Fields' });
        }

        // Test connection first (include encryption)
        const testRes = await SmtpService.testConnection({ host, port, user, pass, encryption });
        if (!testRes.success) {
            return res.status(400).json({ error: 'Connection Failed: ' + testRes.error });
        }

        // Save encryption in credentials
        const credentials = { host, port, user, pass, fromEmail, encryption };

        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .insert({
                user_id: userId,
                provider: 'smtp',
                connection_name: name || `${host} (${user})`,
                credentials,
                metadata: { type: 'smtp' }
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, connection: data });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ... (Delete route unchanged) ...

// Send Test
router.post('/send', async (req, res) => {
    try {
        const { connectionId, to, subject, body } = req.body;

        // Fetch connection
        const { data: conn } = await supabaseAdmin
            .from('user_integrations')
            .select('credentials')
            .eq('id', connectionId)
            .single();

        if (!conn) return res.status(404).json({ error: 'Connection not found' });

        const { host, port, user, pass, fromEmail, encryption } = conn.credentials;
        const result = await SmtpService.sendEmail(
            { host, port, user, pass, encryption },
            fromEmail,
            to,
            subject,
            body
        );
        res.json(result);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
