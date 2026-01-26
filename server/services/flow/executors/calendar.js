const GoogleCalendarService = require('../../GoogleCalendarService');
const { parseISO, addDays, nextDay, setHours, setMinutes, parse } = require('date-fns');

// Basic Natural Language Parser helper
const parseDateString = (dateStr, session = null) => {
    // Debug logging
    console.log('[Calendar Executor] Parsing Date String:', dateStr, typeof dateStr);

    if (!dateStr) return null;

    // 1. Handle actual Object Input
    if (typeof dateStr === 'object') {
        if (dateStr.id && typeof dateStr.id === 'string' && dateStr.id.includes('T')) {
            console.log('[Calendar Executor] Found ID in object:', dateStr.id);
            return dateStr.start || dateStr.id; // Use .start or .id (ISO)
        }
        // If it's a date object
        if (dateStr instanceof Date) return dateStr.toISOString();

        // If we can't find an ID, we can't parse it.
        console.error('[Calendar Executor] Object input missing ID:', JSON.stringify(dateStr));
        return null; // Return null so validation fails instead of defaulting to 'Now'
    }

    let str = String(dateStr).trim();

    // 2. Handle Stringified JSON (e.g. flowEngine stringified the variable)
    if (str.startsWith('{') && str.endsWith('}')) {
        try {
            const parsed = JSON.parse(str);
            if (parsed.id && typeof parsed.id === 'string' && parsed.id.includes('T')) {
                console.log('[Calendar Executor] Parsed JSON string, found ID:', parsed.id);
                return parsed.start || parsed.id;
            } else {
                console.warn('[Calendar Executor] Parsed JSON but no valid ID found:', parsed);
            }
        } catch (e) {
            console.warn('[Calendar Executor] Failed to parse JSON string:', e.message);
            // Not valid JSON, continue to string parsing
        }
    }

    // 3. Handle Unresolved Variable String (e.g. {{listMessage-123.save_slot}} that contextManager failed to resolve)
    // This happens if the user uses a variable path that doesn't strictly exist, but refers to a valid Node.
    if (str.startsWith('{{') && str.endsWith('}}') && session && session.variables) {
        console.log('[Calendar Executor] Attempting rescue of unresolved variable:', str);
        const inner = str.slice(2, -2).trim();
        // Try to find a node ID in the string (e.g. listMessage-1767637496518)
        const nodeIdMatch = inner.match(/(listMessage-[a-zA-Z0-9-]+)/);
        if (nodeIdMatch) {
            const nodeId = nodeIdMatch[1];
            const nodeVar = session.variables[nodeId];
            if (nodeVar) {
                console.log('[Calendar Executor] Found matching Node Variable in session:', nodeId);
                // Try response.id (Standard List Message)
                if (nodeVar.response && nodeVar.response.id && typeof nodeVar.response.id === 'string' && nodeVar.response.id.includes('T')) {
                    console.log('[Calendar Executor] Rescued ID from response.id:', nodeVar.response.id);
                    return nodeVar.response.start || nodeVar.response.id;
                }
                // Try id (Flattened/Direct)
                if (nodeVar.id && typeof nodeVar.id === 'string' && nodeVar.id.includes('T')) {
                    return nodeVar.start || nodeVar.id;
                }
            } else {
                console.warn('[Calendar Executor] Node ID found in string but missing from session variables:', nodeId);
            }
        }
    }

    str = str.toLowerCase();

    // Explicitly reject "[object Object]" to prevent random default times
    if (str === '[object object]') {
        console.error('[Calendar Executor] Received "[object Object]" string. Validation Failed.');
        return null;
    }

    const now = new Date();

    // Check if valid ISO first
    if (!isNaN(Date.parse(dateStr)) && String(dateStr).includes('T')) {
        return new Date(dateStr).toISOString();
    }

    // Simple Keywords
    let targetDate = new Date();
    let hasDateShift = false;

    if (str.includes('today')) {
        // keep today
        hasDateShift = true;
    } else if (str.includes('tomorrow')) {
        targetDate = addDays(now, 1);
        hasDateShift = true;
    } else if (str.includes('next week')) {
        targetDate = addDays(now, 7);
        hasDateShift = true;
    } else if (str.includes('next monday')) {
        targetDate = nextDay(now, 1); // 1 = Monday
        hasDateShift = true;
    }

    // Extract Time (e.g. "at 4pm", "10:00")
    // Strict Regex: Requires either a colon (10:00) OR an AM/PM designator (4pm).
    // This prevents matching "17" from a Node ID timestamp "1767..." as "17:00".
    const timeMatch = str.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s*(am|pm))?|(?:^|\s)(\d{1,2})\s*(am|pm)/i);

    if (timeMatch) {
        // Group 1: HH (with colon)
        // Group 2: MM
        // Group 3: AM/PM (with colon)
        // Group 4: HH (without colon, MUST have AM/PM)
        // Group 5: AM/PM (without colon)

        let hours = parseInt(timeMatch[1] || timeMatch[4]);
        const minutes = parseInt(timeMatch[2] || '0');
        const meridiem = (timeMatch[3] || timeMatch[5] || '').toLowerCase();

        if (meridiem === 'pm' && hours < 12) hours += 12;
        if (meridiem === 'am' && hours === 12) hours = 0;

        targetDate = setHours(targetDate, hours);
        targetDate = setMinutes(targetDate, minutes);
        return targetDate.toISOString();
    } else {
        // If we found a date keyword (Tomorrow) but NO time, default to 9am is maybe okay?
        // But if we found NO keyword and NO time, we should fail.

        if (hasDateShift) {
            targetDate.setHours(9, 0, 0, 0);
            return targetDate.toISOString();
        }

        // No recognizable date or time
        console.error('[Calendar Executor] Could not parse date string:', str);
        return null; // Return null so validation fails instead of defaulting to 'Now'
    }
};

module.exports = {
    async execute(session, node, context) {
        const { connectionId, action = 'create_event', summary, description, startTime, endTime, duration, durationUnit, attendees, addMeetLink, outputVariableName } = node.data;
        const userId = session.user_id;

        if (!connectionId) {
            console.error('[Calendar Executor] No connection ID provided');
            return { success: false, error: 'No connection ID' };
        }

        // Parse Dates
        const startISO = parseDateString(startTime, session);
        let endISO = null;

        if (endTime) {
            endISO = parseDateString(endTime, session);
        } else if (duration) {
            // Calculate end time based on duration
            const dur = parseInt(duration);
            const multiplier = durationUnit === 'hours' ? 60 * 60 * 1000 : 60 * 1000;
            if (startISO && !isNaN(dur)) {
                endISO = new Date(new Date(startISO).getTime() + (dur * multiplier)).toISOString();
            }
        }

        // Fallback default 1 hour
        if (!endISO && startISO) {
            endISO = new Date(new Date(startISO).getTime() + 3600000).toISOString();
        }

        if (action !== 'get_available_slots' && (!startISO || !endISO)) {
            console.error('[Calendar Executor] Invalid Date Format', { startTime, startISO });
            return { success: false, error: 'Invalid Date Format. Please use ISO or "Tomorrow at 4pm".' };
        }

        console.log('[Calendar Executor] Action:', action, 'Start:', startISO, 'End:', endISO);

        try {
            if (action === 'check_availability') {
                // Check if slot is free
                const isFree = await GoogleCalendarService.checkAvailability(userId, connectionId, startISO, endISO);
                const result = { success: true, is_free: isFree, is_busy: !isFree };

                // Return result to be saved in variable
                return {
                    success: true,
                    available: isFree,
                    text: isFree ? 'true' : 'false', // Standard text property for simpler usage
                    ...result
                };

            } else if (action === 'get_available_slots') {
                const { format } = require('date-fns');
                const workStartHour = node.data.workStartHour || 9;
                const workEndHour = node.data.workEndHour || 17;
                const daysToCheck = node.data.daysToCheck || 3;
                const durationMinutes = node.data.duration || 30; // Use duration field
                const timezone = node.data.timezone || 'UTC';

                const slots = await GoogleCalendarService.getFreeSlots(userId, connectionId, {
                    startDate: startISO, // Optional start date
                    daysToCheck,
                    workStartHour,
                    workEndHour,
                    durationMinutes
                });

                // Format for List Message with Timezone support
                const listRows = slots.map(slot => {
                    const d = new Date(slot.start); // ISO => UTC
                    // Format using Intl for timezone correctness
                    const timeStr = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: timezone }).format(d);
                    const dateStr = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone }).format(d);

                    return {
                        id: slot.start, // ISO string
                        title: `${dateStr}, ${timeStr}`, // "Tue, Jan 6, 10:00 AM" in correct TZ
                        description: `Available Slot`
                    };
                });

                console.log(`[CalendarExecutor] check_avail slots found: ${slots.length}`);

                const outputPayload = {
                    success: true,
                    found_slots: listRows.length > 0,
                    count: listRows.length,
                    slots: slots,
                    list_sections: [
                        {
                            title: 'Available Times',
                            rows: listRows
                        }
                    ]
                };

                return outputPayload;

            } else {
                const { format } = require('date-fns');
                const timezone = node.data.timezone || 'UTC';

                const result = await GoogleCalendarService.createEvent(userId, connectionId, {
                    summary,
                    description,
                    startTime: startISO,
                    endTime: endISO,
                    attendees,
                    addMeetLink
                });

                // Format for friendly output with Timezone support
                const startDate = new Date(startISO);
                const endDate = new Date(endISO);

                const fmtOptions = { timeZone: timezone, dateStyle: 'full', timeStyle: 'short' };
                const friendlyDateTime = new Intl.DateTimeFormat('en-US', fmtOptions).format(startDate);
                const friendlyDate = new Intl.DateTimeFormat('en-US', { timeZone: timezone, dateStyle: 'full' }).format(startDate);
                const friendlyTime = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeStyle: 'short' }).format(startDate);

                return {
                    success: true,
                    ...result,
                    htmlLink: result.htmlLink,
                    meetLink: result.meetLink,
                    startTime: startISO,
                    endTime: endISO,
                    formattedDate: friendlyDate, // e.g. Tuesday, January 6, 2026
                    formattedTime: friendlyTime, // e.g. 10:00 AM
                    formattedDateTime: friendlyDateTime, // e.g. Tuesday, January 6, 2026 at 10:00 AM
                    durationMinutes: (endDate - startDate) / 60000
                };
            }

        } catch (error) {

            const errorDetails = error.response?.data?.error || error.message;
            console.error(`[Calendar Executor] Failed to execute action '${action}':`, {
                message: error.message,
                details: errorDetails,
                stack: error.stack
            });
            return { success: false, error: typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails };
        }
    }
};
