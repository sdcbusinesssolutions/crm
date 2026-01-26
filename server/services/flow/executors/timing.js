const logger = { error: console.error, warn: console.warn, info: console.log };

module.exports = {
    async execute(session, node, context) {
        try {
            logger.info(`[TimingExecutor] Executing Timing Node ${node.id}`);

            const { delayValue, delayUnit } = node.data;
            let finalValue = parseFloat(delayValue);

            // Default to 'Minutes' if missing
            let rawUnit = delayUnit || 'Minutes';
            let unit = rawUnit.toLowerCase().trim();

            if (isNaN(finalValue)) {
                logger.warn('[TimingExecutor] Invalid delay value, defaulting to 1 minute');
                finalValue = 1;
                unit = 'minutes';
            }

            let delayMs = 60 * 1000; // Default 1 min if no match

            let resumeAt;

            // Normalize inputs: support singular/plural and case-insensitivity
            if (unit.includes('custom')) {
                // Handling Custom Date
                const { customDate } = node.data;
                if (!customDate) {
                    logger.warn('[TimingExecutor] Custom date selected but no date provided. Defaulting to 1 minute delay.');
                    delayMs = 60 * 1000;
                    resumeAt = new Date(Date.now() + delayMs).toISOString();
                } else {
                    const targetDate = new Date(customDate);
                    // Check if date is valid
                    if (isNaN(targetDate.getTime())) {
                        logger.warn('[TimingExecutor] Invalid custom date format. Defaulting to 1 minute delay.');
                        delayMs = 60 * 1000;
                        resumeAt = new Date(Date.now() + delayMs).toISOString();
                    } else {
                        // Calculate delayMs for logging purposes, though resumeAt is the source of truth
                        const now = Date.now();
                        // If target is in the past, resume immediately (or very shortly)
                        if (targetDate.getTime() <= now) {
                            logger.info('[TimingExecutor] Custom date is in the past. Resuming immediately.');
                            delayMs = 0;
                            resumeAt = new Date().toISOString();
                        } else {
                            delayMs = targetDate.getTime() - now;
                            resumeAt = targetDate.toISOString();
                        }
                    }
                }
            } else {
                // Standard Units
                if (unit.startsWith('second')) {
                    delayMs = finalValue * 1000;
                } else if (unit.startsWith('minute')) {
                    delayMs = finalValue * 60 * 1000;
                } else if (unit.startsWith('hour')) {
                    delayMs = finalValue * 60 * 60 * 1000;
                } else if (unit.startsWith('day')) {
                    delayMs = finalValue * 24 * 60 * 60 * 1000;
                } else if (unit.startsWith('week')) {
                    delayMs = finalValue * 7 * 24 * 60 * 60 * 1000;
                } else {
                    logger.warn(`[TimingExecutor] Unknown delay unit '${rawUnit}', defaulting to 1 minute.`);
                }
                resumeAt = new Date(Date.now() + delayMs).toISOString();
            }

            logger.info(`[TimingExecutor] Delay calculated: ${delayMs}ms (${finalValue} ${rawUnit}). Resume At: ${resumeAt}`);

            // Return DELAY action
            return {
                status: 'delayed',
                delayMs,
                resumeAt,
                __action: 'DELAY'
            };

        } catch (error) {
            logger.error('[TimingExecutor] Error:', error);
            // Fallback: Proceed immediately if calculation fails? Or error?
            return { status: 'error', error: error.message };
        }
    }
};
