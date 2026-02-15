const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const axios = require('axios');

// CONFIGURATION
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const LOG_FILE = path.join(__dirname, '../../monitor_logs_domain_wise.csv');
const DOMAINS_CSV = path.join(__dirname, '../../domains.csv');

// Ensure log file exists with header
if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, 'Timestamp,Domain,Container,CPU_Percent,Mem_Usage,Mem_Percent,App_Status,Response_Time_ms,Error_Message\n');
}

console.log(`🚀 Starting Domain-Wise Monitor... logging to ${LOG_FILE}`);

// Helper: Parse CSV Line
const parseCSVLine = (line) => {
    // Simple CSV parser - assuming no commas in values for now
    return line.split(',').map(s => s.trim());
};

const getDomains = () => {
    if (!fs.existsSync(DOMAINS_CSV)) {
        console.error('❌ specific domains.csv not found.');
        return [];
    }
    const content = fs.readFileSync(DOMAINS_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    const domains = [];

    // Skip header (row 0)
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols[0]) domains.push(cols[0]); // First column is Domain
    }
    return domains;
};

const checkDomains = async () => {
    const timestamp = new Date().toISOString();
    const domains = getDomains();

    // 1. Get Docker Stats (Snapshot)
    let dockerStatsMap = {}; // Key: loose container name matching or project name
    try {
        const statsOutput = await new Promise((resolve, reject) => {
            exec('docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}"', (err, stdout, stderr) => {
                if (err) resolve(''); // Don't crash, just empty stats
                else resolve(stdout);
            });
        });

        // Map stats by container name
        const lines = statsOutput.trim().split('\n');
        lines.forEach(line => {
            const parts = line.split(',');
            if (parts.length >= 4) {
                dockerStatsMap[parts[0]] = {
                    name: parts[0],
                    cpu: parts[1],
                    mem: parts[2],
                    memPerc: parts[3]
                };
            }
        });
    } catch (e) {
        console.error('Docker Stats Command Failed:', e);
    }

    // 2. Loop Domains and Check
    for (const domain of domains) {
        const safeName = domain.replace(/\./g, '_'); // clickube.com -> clickube_com

        // Find matching container stats
        // Container likely contains safeName
        const containerKey = Object.keys(dockerStatsMap).find(name => name.includes(safeName) && name.includes('whatsapp-app'));
        const stats = containerKey ? dockerStatsMap[containerKey] : { name: 'NOT_FOUND', cpu: '0%', mem: '0', memPerc: '0%' };

        let appStatus = 'UNKNOWN';
        let responseTime = 0;
        let errorMessage = '';

        // Check Health (Public URL)
        const url = `https://${domain}/api/status`;
        const start = Date.now();
        try {
            await axios.get(url, { timeout: 5000 });
            appStatus = 'ONLINE';
        } catch (e) {
            appStatus = 'DOWN';
            errorMessage = e.message;
            if (e.response) appStatus += ` (${e.response.status})`;
        }
        responseTime = Date.now() - start;

        // Log Data
        const logLine = `${timestamp},${domain},${stats.name},${stats.cpu},"${stats.mem}",${stats.memPerc},${appStatus},${responseTime},"${errorMessage}"\n`;
        fs.appendFileSync(LOG_FILE, logLine);
        console.log(`[${domain}] ${appStatus} - CPU: ${stats.cpu} - Mem: ${stats.memPerc}`);
    }
};

// Start Loop
setInterval(checkDomains, CHECK_INTERVAL_MS);
checkDomains(); // Initial run
