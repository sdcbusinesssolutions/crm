const http = require('http');

function testEndpoint(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5000,
            path: path,
            method: 'GET',
            headers: {
                // I don't have a token, but let's see if it returns 401 or 500
            }
        };

        const req = http.request(options, (res) => {
            console.log(`Status for ${path}:`, res.statusCode);
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });

        req.on('error', (e) => reject(e));
        req.end();
    });
}

async function runTest() {
    try {
        await testEndpoint('/api/inbox/conversations');
        await testEndpoint('/api/leads');
    } catch (e) {
        console.error('Connection failed:', e.message);
    }
}

runTest();
