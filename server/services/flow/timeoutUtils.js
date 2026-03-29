/**
 * Centralized utility for calculating node timeouts (unresponsive timeout).
 * Handles both new (timeout, timeoutUnit) and legacy (unresponsiveTimeout) formats.
 */
module.exports = {
    calculateTimeoutAt(nodeData) {
        const { ifUnresponsive, timeout, timeoutUnit, unresponsiveTimeout } = nodeData;
        if (!ifUnresponsive) return undefined;

        let duration = 0;
        let unit = 'min';

        // 1. Try New Format (Explicit timeout value + dropdown unit)
        if (timeout !== undefined && timeout !== null && timeout !== '') {
            duration = parseFloat(timeout) || 0;
            unit = (timeoutUnit || 'Minutes').toLowerCase().trim();
        }
        // 2. Try Legacy Format (String e.g. "2 Minutes" or "15 sec")
        else if (unresponsiveTimeout) {
            const str = unresponsiveTimeout.toLowerCase().trim();
            const match = str.match(/^([\d.]+)\s*([a-z]*)$/);
            if (match) {
                duration = parseFloat(match[1]);
                unit = match[2] || 'min';
            }
        }

        if (duration <= 0) return undefined;

        let multiplier = 60 * 1000; // Minutes default
        if (unit.startsWith('sec')) multiplier = 1000;
        else if (unit.startsWith('min')) multiplier = 60 * 1000;
        else if (unit.startsWith('hour') || unit.startsWith('hr')) multiplier = 60 * 60 * 1000;
        else if (unit.startsWith('day')) multiplier = 24 * 60 * 60 * 1000;

        const ms = duration * multiplier;
        if (ms > 0) {
            return new Date(Date.now() + ms).toISOString();
        }

        return undefined;
    }
};
