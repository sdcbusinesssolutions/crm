const logger = { error: console.error, warn: console.warn, info: console.log };

module.exports = {
    async execute(session, node, context) {
        try {
            logger.info(`[TimingExecutor] Executing Timing Node ${node.id}`);

            const { delayValue, delayUnit } = node.data;
            let finalValue = parseFloat(delayValue);
            let unit = delayUnit || 'Minutes';

            if (isNaN(finalValue)) {
                logger.warn('[TimingExecutor] Invalid delay value, defaulting to 1 minute');
                finalValue = 1;
                unit = 'Minutes';
            }

            let delayMs = 0;
            switch (unit) {
                case 'Seconds': delayMs = finalValue * 1000; break;
                case 'Minutes': delayMs = finalValue * 60 * 1000; break;
                case 'Hours': delayMs = finalValue * 60 * 60 * 1000; break;
                case 'Days': delayMs = finalValue * 24 * 60 * 60 * 1000; break;
                case 'Weeks': delayMs = finalValue * 7 * 24 * 60 * 60 * 1000; break;
                default: delayMs = 60 * 1000;
            }

            const resumeAt = new Date(Date.now() + delayMs).toISOString();

            logger.info(`[TimingExecutor] Delay calculated: ${delayMs}ms. Resume At: ${resumeAt}`);

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
