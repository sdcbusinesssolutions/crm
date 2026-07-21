const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

// Get Config
router.get('/config', async (req, res) => {
    try {
        const userId = req.user.id;

        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'callyzer')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is No rows found

        if (data && data.credentials) {
            return res.json({
                baseUrl: data.credentials.baseUrl,
                apiToken: data.credentials.apiToken
            });
        }
        res.json({ baseUrl: null, apiToken: null });

    } catch (error) {
        console.error('Get Callyzer Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Config
router.post('/config', async (req, res) => {
    try {
        const userId = req.user.id;
        const { baseUrl, apiToken } = req.body;

        if (!baseUrl) return res.status(400).json({ error: 'Base URL is required' });
        if (!apiToken) return res.status(400).json({ error: 'API Token is required' });

        const { data: existingRows, error: fetchErr } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'callyzer');

        if (fetchErr) throw fetchErr;

        let resultError = null;

        if (existingRows && existingRows.length > 0) {
            const targetId = existingRows[0].id;
            const { error: updateErr } = await supabaseAdmin
                .from('user_integrations')
                .update({
                    credentials: { baseUrl, apiToken },
                    connection_name: 'Callyzer Integration',
                    updated_at: new Date()
                })
                .eq('id', targetId);
            resultError = updateErr;
        } else {
            const { error: insertErr } = await supabaseAdmin
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'callyzer',
                    connection_name: 'Callyzer Integration',
                    credentials: { baseUrl, apiToken }
                });
            resultError = insertErr;
        }

        if (resultError) throw resultError;

        res.json({ success: true });
    } catch (error) {
        console.error('Save Callyzer Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete Config
router.delete('/config', async (req, res) => {
    try {
        const userId = req.user.id;
        const { error } = await supabaseAdmin
            .from('user_integrations')
            .delete()
            .eq('user_id', userId)
            .eq('provider', 'callyzer');

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Delete Callyzer Config Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Fetch History for a Number
router.get('/history', async (req, res) => {
    try {
        const userId = req.user.id;
        const phoneNumber = req.query.number;

        if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });

        // 1. Get credentials
        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'callyzer')
            .limit(1)
            .single();

        if (error || !data || !data.credentials) {
            return res.status(400).json({ error: 'Callyzer is not connected' });
        }

        const { baseUrl, apiToken } = data.credentials;

        // 2. Prepare dates (Last 30 days to now)
        const callTo = Math.floor(Date.now() / 1000);
        const callFrom = callTo - (30 * 24 * 60 * 60);

        // 3. Make paginated requests with native client_numbers filter
        const callyzerUrl = `${baseUrl.replace(/\/+$/, '')}/api/v2.2/call-log/history`;
        const target10 = phoneNumber.slice(-10);
        
        let allLogs = [];
        let page = 1;
        let hasMore = true;

        while (hasMore && page <= 10) { // Safety limit of 10 pages (1000 calls per contact in 30 days)
            const response = await fetch(callyzerUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    call_from: callFrom,
                    call_to: callTo,
                    call_types: ["Incoming", "Outgoing", "Missed", "Rejected"],
                    call_method: "PhoneCall",
                    call_mode: "Voice",
                    client_numbers: [target10], // API expects exactly 10 digits
                    page: page
                })
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.warn(`Callyzer rate limited at page ${page} for contact ${target10}`);
                    break;
                }
                throw new Error(`Callyzer API error: ${response.statusText}`);
            }

            const resultData = await response.json();
            
            if (resultData && Array.isArray(resultData.result)) {
                allLogs = allLogs.concat(resultData.result);
                if (resultData.result.length < 100) {
                    hasMore = false;
                } else {
                    page++;
                    if (page <= 10) await new Promise(r => setTimeout(r, 500)); // Rate limit buffer
                }
            } else {
                hasMore = false;
            }
        }
        
        // 4. Map the logs for the client
        let filteredLogs = allLogs.map(call => ({
            id: call.id,
            employee: call.emp_name || 'Unknown',
            client_name: call.client_name || 'Unknown',
            client_number: call.client_number,
            call_type: call.call_type,
            duration_seconds: call.duration,
            call_date: call.call_date,
            call_time: call.call_time,
            call_method: call.call_method,
            call_recording_url: call.call_recording_url || ''
        }));

        res.json({
            success: true,
            total_records: filteredLogs.length,
            result: filteredLogs
        });
    } catch (error) {
        console.error('Callyzer History Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
