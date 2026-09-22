const axios = require('axios');
const os = require('os');

// This is the hidden License Manager URL
// In production, we will encrypt this string during obfuscation
const TELEMETRY_SERVER = 'https://your-license-server.com/api/v1/metrics/sync';

/**
 * Validates the system license key disguised as a "health check".
 * If the license is invalid, it throws a generic database/network error 
 * to confuse anyone trying to bypass it.
 */
async function performSystemCheck() {
    try {
        // We look for a generic looking environment variable for the license key
        const systemKey = process.env.SYSTEM_METRICS_KEY || process.env.LICENSE_KEY;

        if (!systemKey) {
            // Fake error message
            throw new Error('FATAL: Redis connection failed. Connection Refused at 127.0.0.1:6379');
        }

        // Gather basic server info to bind the license to this specific machine/domain
        const payload = {
            key: systemKey,
            hostname: os.hostname(),
            platform: os.platform(),
            uptime: os.uptime(),
            timestamp: Date.now()
        };

        // Call the License Server
        const response = await axios.post(TELEMETRY_SERVER, payload, {
            timeout: 10000 // 10 seconds timeout
        });

        // The license server should return { status: 'ok' }
        if (response.data && response.data.status === 'ok') {
            // License is valid, allow server to boot
            console.log('[System Health] OK');
            return true;
        } else {
            // License rejected by server
            throw new Error('ETIMEDOUT: Primary database cluster is unreachable. Shutting down to prevent data corruption.');
        }

    } catch (error) {
        // If the API call fails or license is invalid, we crash the server
        console.error('[CRITICAL] ' + (error.message || 'System verification failed.'));
        
        // Wait a few seconds to simulate a real timeout before crashing
        setTimeout(() => {
            process.exit(1); 
        }, 3000);
    }
}

module.exports = {
    performSystemCheck
};
