const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// CONFIGURATION
const CHECK_INTERVAL_MS = 5000; // Check every 5 seconds
const LOG_FILE = path.join(__dirname, '../../monitor_logs.csv');
const TARGET_URL = 'http://localhost:5000/api/status';
const CONTAINER_NAME_FILTER = 'whatsapp-app'; // Part of the container name to match

// Ensure log file exists with header
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'Timestamp,Container,CPU_Percent,Mem_Usage,Mem_Percent,App_Status,Response_Time_ms\n');
}

console.log(`🚀 Starting Monitor... logging to ${LOG_FILE}`);

const checkSystem = async () => {
    const timestamp = new Date().toISOString();
    let containerStats = [];
    let appStatus = 'UNKNOWN';
    let responseTime = 0;

    // 1. Get Docker Stats
    try {
        const statsOutput = await new Promise((resolve, reject) => {
            // --no-stream to get a single snapshot
            exec('docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}"', (err, stdout, stderr) => {
                if (err) reject(err);
                else resolve(stdout);
            });
        });

        const lines = statsOutput.trim().split('\n');
        lines.forEach(line => {
            if (line.includes(CONTAINER_NAME_FILTER)) {
                // Remove specialized characters if any
                containerStats.push(line.trim());
            }
        });
    } catch (e) {
        console.error('Docker Stats Error:', e.message);
        containerStats.push(`ERROR-DOCKER,,,`);
    }

    // 2. Check App Health
    const start = Date.now();
    try {
        await axios.get(TARGET_URL, { timeout: 3000 });
        appStatus = 'ONLINE';
    } catch (e) {
        appStatus = `DOWN (${e.code || e.message})`;
    }
    responseTime = Date.now() - start;

    // 3. Write to Log
    if (containerStats.length === 0) {
        const logLine = `${timestamp},NO_CONTAINER_FOUND,0,0,0,${appStatus},${responseTime}\n`;
        fs.appendFileSync(LOG_FILE, logLine);
        console.log(logLine.trim());
    } else {
        containerStats.forEach(stat => {
            // stat is "Name,CPU,MemUsage,MemPerc"
            // We strip the % signs for cleaner CSV if needed, but keeping them is fine for now
            const logLine = `${timestamp},${stat},${appStatus},${responseTime}\n`;
            fs.appendFileSync(LOG_FILE, logLine);
            console.log(logLine.trim());
        });
    }
};

// Start Loop
setInterval(checkSystem, CHECK_INTERVAL_MS);
checkSystem(); // Initial run
