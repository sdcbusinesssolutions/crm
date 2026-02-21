/**
 * LOAD TEST: 100 media webhook simulations
 * Tests the FULL pipeline: webhook → downloadMedia (curl) → Supabase
 * Run: node server/load_test_media.js
 */
const axios = require('axios');
const { execFile } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const USER_ID = '77009036-af89-49f7-a16b-de652950a7d1';
const PHONE_ID = '850356761502552';
const WEBHOOK_URL = 'https://clickube.com/api/77009036-af89-49f7-a16b-de652950a7d1/850356761502552/webhook';
const KNOWN_MEDIA_IDS = ['802056279575952', '1459765322325788', '794265627024656', '1884323585551281'];

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Exact same curl function as in webhook.js
function downloadBinaryWithCurl(url, token) {
    return new Promise((resolve, reject) => {
        const args = [
            '--silent', '--fail', '--location', '--max-time', '60',
            '--max-filesize', '52428800',
            '-H', `Authorization: Bearer ${token}`,
            '-H', 'User-Agent: WhatsApp/2.2412.10 N',
            '-H', 'Accept: */*',
            url
        ];
        execFile('curl', args, { encoding: null, maxBuffer: 55 * 1024 * 1024, timeout: 70000 },
            (error, stdout, stderr) => {
                if (error) return reject(new Error(`curl: ${error.message}`));
                if (!stdout || stdout.length === 0) return reject(new Error('curl: empty'));
                resolve(stdout);
            }
        );
    });
}

// Full downloadMedia logic (same as webhook.js)
async function downloadMedia(mediaId, accessToken) {
    // Step 1: Get CDN URL
    const r = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000
    });
    const urlData = r.data;
    if (!urlData?.url) throw new Error('No CDN URL from Meta');

    const mimeType = urlData.mime_type || 'application/octet-stream';

    // Step 2: Download via curl
    const buffer = await downloadBinaryWithCurl(urlData.url, accessToken);
    if (!buffer || buffer.length === 0) throw new Error('Empty buffer from curl');

    // Step 3: Upload to Supabase
    const ext = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
    const filename = `loadtest-${mediaId}-${Date.now()}.${ext}`;
    const storagePath = `${USER_ID}/loadtest/${filename}`;

    const { error } = await supabase.storage.from('campaign-media')
        .upload(storagePath, buffer, { contentType: mimeType, upsert: true });
    if (error) throw new Error(`Supabase upload: ${error.message}`);

    const { data: pub } = supabase.storage.from('campaign-media').getPublicUrl(storagePath);
    return { size: buffer.length, mimeType, url: pub.publicUrl };
}

// Send real webhook to live server
async function sendWebhook(mediaId, i) {
    const payload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: '123456', changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '15551234', phone_number_id: PHONE_ID },
                    contacts: [{ profile: { name: 'LoadTest' }, wa_id: '918408907516' }],
                    messages: [{
                        from: '918408907516', id: `wamid.loadtest_${Date.now()}_${i}`,
                        timestamp: Math.floor(Date.now() / 1000).toString(), type: 'image',
                        image: { id: mediaId, mime_type: 'image/jpeg', sha256: 'test' }
                    }]
                }, field: 'messages'
            }]
        }]
    };
    const r = await axios.post(WEBHOOK_URL, payload, {
        headers: { 'Content-Type': 'application/json' }, timeout: 10000
    });
    return r.status;
}

async function runLoadTest() {
    console.log('=================================================');
    console.log(' MEDIA LOAD TEST — 100 curl downloads + uploads');
    console.log('=================================================\n');

    // Get token
    const { data: cfg } = await supabase.from('whatsapp_config')
        .select('meta_access_token').eq('user_id', USER_ID).eq('phone_number_id', PHONE_ID).single();
    const token = cfg.meta_access_token;
    console.log(`✅ Token loaded (length: ${token.length})\n`);

    let passed = 0, failed = 0, totalBytes = 0;
    const errors = [];
    const startAll = Date.now();

    // First test 1 download to prove it works
    console.log('--- UNIT TEST: Single download ---');
    try {
        const result = await downloadMedia(KNOWN_MEDIA_IDS[0], token);
        console.log(`✅ Unit test PASSED: ${result.size} bytes, ${result.mimeType}`);
        console.log(`   URL: ${result.url.substring(0, 80)}`);
    } catch (e) {
        console.log(`❌ Unit test FAILED: ${e.message}`);
        console.log('⛔ Cannot proceed with load test.');
        process.exit(1);
    }

    // Send 100 webhooks (they process in background - we check DB after delay)  
    console.log('\n--- WEBHOOK LOAD TEST: 100 webhooks to live server ---');
    let webhookPassed = 0, webhookFailed = 0;

    for (let i = 0; i < 100; i++) {
        const mediaId = KNOWN_MEDIA_IDS[i % KNOWN_MEDIA_IDS.length];
        try {
            const status = await sendWebhook(mediaId, i);
            webhookPassed++;
            if ((i + 1) % 10 === 0) process.stdout.write(`[${i + 1}/100] webhooks sent ✅\n`);
        } catch (e) {
            webhookFailed++;
            if ((i + 1) % 10 === 0) process.stdout.write(`[${i + 1}/100] webhooks sent ❌\n`);
        }
        await new Promise(r => setTimeout(r, 200)); // 200ms between requests = 5/sec
    }

    console.log(`\nWebhook spray: ${webhookPassed} accepted, ${webhookFailed} rejected out of 100`);

    // Now directly test 20 concurrent downloads (simulates the VPS processing load)
    console.log('\n--- DIRECT DOWNLOAD TEST: 20 concurrent curl downloads ---');
    const concurrent = [];
    for (let i = 0; i < 20; i++) {
        const mediaId = KNOWN_MEDIA_IDS[i % KNOWN_MEDIA_IDS.length];
        concurrent.push(
            downloadMedia(mediaId, token)
                .then(r => { passed++; totalBytes += r.size; return 'ok'; })
                .catch(e => { failed++; errors.push(e.message.substring(0, 60)); return 'fail'; })
        );
    }
    const results = await Promise.all(concurrent);
    const elapsed = Date.now() - startAll;

    console.log('\n=================================================');
    console.log(' LOAD TEST RESULTS');
    console.log('=================================================');
    console.log(`Direct downloads: ${passed} PASSED, ${failed} FAILED out of 20`);
    console.log(`Total data     : ${(totalBytes / 1024 / 1024).toFixed(2)} MB downloaded`);
    console.log(`Total time     : ${(elapsed / 1000).toFixed(1)}s`);
    console.log(`Success rate   : ${Math.round(passed / 20 * 100)}%`);
    if (errors.length > 0) {
        console.log(`\nErrors: ${[...new Set(errors)].join('; ')}`);
    }

    // Wait 30s for BG webhook downloads, then check DB
    console.log('\n⏳ Waiting 30s for webhook background processing...');
    await new Promise(r => setTimeout(r, 30000));

    const { data: recentMsgs } = await supabase.from('messages')
        .select('id, type, media_url, created_at')
        .eq('direction', 'in').in('type', ['image', 'video', 'audio', 'document'])
        .order('created_at', { ascending: false }).limit(20);

    const withUrl = recentMsgs?.filter(m => m.media_url).length || 0;
    const withoutUrl = recentMsgs?.filter(m => !m.media_url).length || 0;
    console.log(`\nDB verification (last 20 media messages):`);
    console.log(`  ✅ With media_url : ${withUrl}`);
    console.log(`  ❌ Without media_url: ${withoutUrl}`);
    console.log(`  Success rate: ${Math.round(withUrl / (withUrl + withoutUrl) * 100)}%`);

    console.log('\n=================================================');
    if (passed >= 18 && failed <= 2) {
        console.log(' ✅ LOAD TEST PASSED — Media downloads are working!');
    } else {
        console.log(' ❌ LOAD TEST FAILED — Check errors above');
    }
    console.log('=================================================');
    process.exit(0);
}

runLoadTest().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
