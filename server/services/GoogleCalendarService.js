const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');

const GoogleCalendarService = {
    _getAuthClient(creds) {
        if (creds.private_key && creds.client_email) {
            console.log('[GoogleCalendarService] Using Service Account for Auth');
            return new google.auth.JWT(
                creds.client_email,
                null,
                creds.private_key,
                ['https://www.googleapis.com/auth/calendar']
            );
        }

        const oauth2Client = new google.auth.OAuth2(
            creds.params_client_id || process.env.GOOGLE_CALENDAR_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
            creds.params_client_secret || process.env.GOOGLE_CALENDAR_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
            creds.params_redirect_url || process.env.GOOGLE_CALENDAR_REDIRECT_URL || process.env.GOOGLE_REDIRECT_URL
        );

        oauth2Client.setCredentials(creds);
        return oauth2Client;
    },

    async createEvent(userId, connectionId, eventData) {
        const { summary, description, startTime, endTime, attendees, addMeetLink } = eventData;

        // 1. Get Integration
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !integration) {
            throw new Error('Calendar connection not found');
        }

        // 2. Setup Auth
        const authClient = this._getAuthClient(integration.credentials);

        // 3. Create Event
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        const resource = {
            summary,
            description,
            start: { dateTime: startTime }, // Ensure these are ISO strings in the executor
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

        const result = await calendar.events.insert({
            calendarId: 'primary', // Service Account: Uses its own calendar unless impersonating. User: Uses user's primary.
            resource: resource,
            conferenceDataVersion: 1,
        });

        return {
            success: true,
            eventId: result.data.id,
            htmlLink: result.data.htmlLink,
            meetLink: result.data.hangoutLink
        };
    },

    async checkAvailability(userId, connectionId, startTime, endTime) {
        // 1. Get Integration
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !integration) {
            throw new Error('Calendar connection not found');
        }

        // 2. Setup Auth
        const authClient = this._getAuthClient(integration.credentials);
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        // 3. Query FreeBusy
        const response = await calendar.freebusy.query({
            resource: {
                timeMin: startTime,
                timeMax: endTime,
                items: [{ id: 'primary' }],
            },
        });

        const calendars = response.data.calendars;
        if (!calendars || !calendars.primary) return true; // Assume free if error? Or throw?

        const busySlots = calendars.primary.busy;
        // If there are any busy slots that overlap, return false
        return busySlots.length === 0;
    },

    async getFreeSlots(userId, connectionId, { startDate, daysToCheck, workStartHour, workEndHour, durationMinutes }) {
        // 1. Get Integration
        const { data: integration, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', connectionId)
            .eq('user_id', userId)
            .single();

        if (error || !integration) {
            throw new Error('Calendar connection not found');
        }

        // 2. Setup Auth
        const authClient = this._getAuthClient(integration.credentials);
        const calendar = google.calendar({ version: 'v3', auth: authClient });

        // Calculate Range
        const start = startDate ? new Date(startDate) : new Date();
        const end = new Date(start);
        end.setDate(end.getDate() + daysToCheck);

        // Fetch user busy times
        const response = await calendar.freebusy.query({
            resource: {
                timeMin: start.toISOString(),
                timeMax: end.toISOString(),
                items: [{ id: 'primary' }],
            },
        });

        const busySlots = (response.data.calendars.primary && response.data.calendars.primary.busy) ? response.data.calendars.primary.busy : [];
        const availableSlots = [];

        // Loop through days
        for (let i = 0; i < daysToCheck; i++) {
            const currentDay = new Date(start);
            currentDay.setDate(start.getDate() + i);

            // Define work hours for this day
            const dayStart = new Date(currentDay);
            dayStart.setHours(workStartHour, 0, 0, 0);

            const dayEnd = new Date(currentDay);
            dayEnd.setHours(workEndHour, 0, 0, 0);

            // Skip if dayStart is in the past (e.g. today 9am but it's 2pm)
            // But we must check against 'now' not just 'start'
            if (dayEnd < new Date()) continue; // Past day

            let slotStart = new Date(dayStart);
            if (slotStart < new Date()) {
                // If today, start from next hour
                slotStart = new Date();
                slotStart.setHours(slotStart.getHours() + 1, 0, 0, 0);
            }

            // Iterate slots in the day
            while (slotStart.getTime() + (durationMinutes * 60000) <= dayEnd.getTime()) {
                const slotEnd = new Date(slotStart.getTime() + (durationMinutes * 60000));

                // Check collision
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

                // Move next
                slotStart = slotEnd;
            }
        }

        return availableSlots.slice(0, 10); // Return top 10
    }
};

module.exports = GoogleCalendarService;
