const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Simple in-memory cache for Service Account Tokens
const serviceAccountCache = new Map();

// Helper: Robust Fetch with Token Refresh & Service Account Support
// Duplicated from routes/integrations/calendar.js for consistency and robustness in background jobs
const fetchWithRefresh = async (url, method, body, creds, connectionId) => {
    // 1. Service Account Check (JWT)
    const isServiceAccount = (creds.type === 'service_account') || (creds.private_key && creds.client_email);

    if (isServiceAccount) {
        const email = creds.client_email;
        const now = Math.floor(Date.now() / 1000);

        // A. CACHE CHECK
        if (serviceAccountCache.has(email)) {
            const cached = serviceAccountCache.get(email);
            if (cached.expiresAt > now + 300) {
                console.log(`[GoogleCalendarService] Using Cached Service Account Token for ${email}`);
                return await axios({
                    method,
                    url,
                    data: body,
                    headers: { 'Authorization': `Bearer ${cached.token}` }
                });
            }
        }

        // B. FULL AUTH FLOW (Manual JWT)
        // Global Proxy Cleanup
        ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy'].forEach(v => {
            if (process.env[v] !== undefined) delete process.env[v];
        });

        if (!creds.private_key || !creds.client_email) {
            throw new Error('Service Account Authentication Failed: Missing private_key or client_email.');
        }

        let privateKey = creds.private_key;
        if (typeof privateKey === 'string') {
            if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
            privateKey = privateKey.replace(/^"|"$/g, '');
        }

        try {
            console.log('[GoogleCalendarService] Initiating Manual JWT Exchange...');
            const payload = {
                iss: creds.client_email,
                scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
                aud: 'https://oauth2.googleapis.com/token',
                exp: now + 3600,
                iat: now
            };

            const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });

            const exchangeUrl = 'https://oauth2.googleapis.com/token';
            const exchangeParams = new URLSearchParams();
            exchangeParams.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
            exchangeParams.append('assertion', token);

            const response = await axios.post(exchangeUrl, exchangeParams, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                proxy: false
            });

            const accessToken = response.data.access_token;
            if (!accessToken) throw new Error('No access_token returned from JWT exchange.');

            serviceAccountCache.set(email, {
                token: accessToken,
                expiresAt: now + (response.data.expires_in || 3600)
            });

            return await axios({
                method,
                url,
                data: body,
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

        } catch (authError) {
            console.error('[GoogleCalendarService] Service Account Auth failed:', authError.message);
            throw new Error(`Service Account Auth Failed: ${authError.message}`);
        }
    }

    // 2. Standard OAuth2 Flow (User Account)
    let activeCreds = creds;

    try {
        // PROACTIVE REFRESH (5 min buffer)
        const now = Date.now();
        const EXPIRY_BUFFER = 5 * 60 * 1000;
        const isExpiring = activeCreds.expiry_date && (activeCreds.expiry_date <= now + EXPIRY_BUFFER);

        if (isExpiring && activeCreds.refresh_token) {
            console.log('[GoogleCalendarService] Token expiring soon. Refreshing proactively...');

            // Manual refresh to avoid Gaxios proxy issues
            try {
                const tokenUrl = 'https://oauth2.googleapis.com/token';
                const payload = {
                    client_id: activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                    client_secret: activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                    refresh_token: activeCreds.refresh_token,
                    grant_type: 'refresh_token'
                };

                const { data: credentials } = await axios.post(tokenUrl, payload, { proxy: false });

                if (connectionId) {
                    const newCreds = { ...activeCreds, ...credentials };
                    // Recalculate expiry if provided
                    if (credentials.expires_in) {
                        newCreds.expiry_date = Date.now() + (credentials.expires_in * 1000);
                    }
                    await supabaseAdmin.from('user_integrations').update({ credentials: newCreds, updated_at: new Date() }).eq('id', connectionId);
                    activeCreds = newCreds;
                }
            } catch (rErr) {
                console.warn('[GoogleCalendarService] Proactive refresh failed, trying with old token', rErr.message);
            }
        }

        return await axios({
            method,
            url,
            data: body,
            headers: { 'Authorization': `Bearer ${activeCreds.access_token}` },
            proxy: false
        });

    } catch (error) {
        // REACTIVE REFRESH (401)
        if (error.response && error.response.status === 401 && activeCreds.refresh_token) {
            console.log('[GoogleCalendarService] 401 Unauthorized. Attempting reactive refresh...');

            try {
                const tokenUrl = 'https://oauth2.googleapis.com/token';
                const payload = {
                    client_id: activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                    client_secret: activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                    refresh_token: activeCreds.refresh_token,
                    grant_type: 'refresh_token'
                };

                const { data: credentials } = await axios.post(tokenUrl, payload, { proxy: false });

                if (connectionId) {
                    const newCreds = { ...activeCreds, ...credentials };
                    if (credentials.expires_in) {
                        newCreds.expiry_date = Date.now() + (credentials.expires_in * 1000);
                    }
                    await supabaseAdmin.from('user_integrations').update({ credentials: newCreds, updated_at: new Date() }).eq('id', connectionId);
                    activeCreds = newCreds;
                }

                // Retry
                return await axios({
                    method,
                    url,
                    data: body,
                    headers: { 'Authorization': `Bearer ${activeCreds.access_token}` },
                    proxy: false
                });

            } catch (refreshErr) {
                console.error('[GoogleCalendarService] Reactive refresh failed:', refreshErr.message);
                throw new Error('Authorization Expired. Please Re-Connect Account.');
            }
        }
        throw error;
    }
};

const GoogleCalendarService = {
    // Legacy helper mainly for structure, but logic moved to fetchWithRefresh
    async _getIntegration(userId, connectionId) {
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !integration) {
            throw new Error('Calendar connection not found');
        }
        return integration;
    },

    async createEvent(userId, connectionId, eventData) {
        const { summary, description, startTime, endTime, attendees, addMeetLink } = eventData;
        const integration = await this._getIntegration(userId, connectionId);

        // Construct Request
        const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1`;

        const resource = {
            summary,
            description,
            start: { dateTime: startTime },
            end: { dateTime: endTime },
            attendees: attendees ? attendees.split(',').map(email => ({ email: email.trim() })) : [],
        };

        if (addMeetLink) {
            resource.conferenceData = {
                createRequest: {
                    requestId: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    conferenceSolutionKey: { type: "hangoutsMeet" },
                },
            };
        }

        console.log('[GoogleCalendarService] Creating Event via Axios...');
        const response = await fetchWithRefresh(url, 'POST', resource, integration.credentials, connectionId);

        return {
            success: true,
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            meetLink: response.data.hangoutLink
        };
    },

    async checkAvailability(userId, connectionId, startTime, endTime) {
        const integration = await this._getIntegration(userId, connectionId);

        const url = 'https://www.googleapis.com/calendar/v3/freeBusy';
        const body = {
            timeMin: startTime,
            timeMax: endTime,
            items: [{ id: 'primary' }]
        };

        console.log('[GoogleCalendarService] Checking availability...');
        const response = await fetchWithRefresh(url, 'POST', body, integration.credentials, connectionId);

        const busySlots = response.data.calendars?.primary?.busy || [];
        return busySlots.length === 0;
    },

    async getFreeSlots(userId, connectionId, { startDate, daysToCheck, workStartHour, workEndHour, durationMinutes }) {
        const integration = await this._getIntegration(userId, connectionId);

        // Fetch user busy times
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + daysToCheck);

        const url = 'https://www.googleapis.com/calendar/v3/freeBusy';
        const body = {
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            items: [{ id: 'primary' }]
        };

        console.log('[GoogleCalendarService] Fetching FreeSlots busy data...');
        const response = await fetchWithRefresh(url, 'POST', body, integration.credentials, connectionId);

        const busySlots = response.data.calendars?.primary?.busy || [];
        const availableSlots = [];

        // Loop logic
        for (let i = 0; i < daysToCheck; i++) {
            const currentDay = new Date(start);
            currentDay.setDate(start.getDate() + i);

            // Define work hours for this day
            const dayStart = new Date(currentDay);
            dayStart.setHours(workStartHour, 0, 0, 0);

            const dayEnd = new Date(currentDay);
            dayEnd.setHours(workEndHour, 0, 0, 0);

            if (dayEnd < new Date()) continue; // Past day

            let slotStart = new Date(dayStart);
            if (slotStart < new Date()) {
                slotStart = new Date();
                slotStart.setHours(slotStart.getHours() + 1, 0, 0, 0);
            }

            while (slotStart.getTime() + (durationMinutes * 60000) <= dayEnd.getTime()) {
                const slotEnd = new Date(slotStart.getTime() + (durationMinutes * 60000));

                const isBusy = busySlots.some(busy => {
                    const bStart = new Date(busy.start).getTime();
                    const bEnd = new Date(busy.end).getTime();
                    return (slotStart.getTime() < bEnd && slotEnd.getTime() > bStart);
                });

                if (!isBusy) {
                    availableSlots.push({
                        start: slotStart.toISOString(),
                        end: slotEnd.toISOString()
                    });
                }
                slotStart = slotEnd;
            }
        }

        return availableSlots.slice(0, 10);
    }
};

module.exports = GoogleCalendarService;
