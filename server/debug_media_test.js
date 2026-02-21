/**
 * MEDIA DOWNLOAD DIAGNOSTIC SCRIPT
 * Tests the FULL pipeline exactly as the webhook does it.
 * Run: node server/debug_media_test.js
 */
const axios = require('axios');
const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
const USER_ID = '77009036-af89-49f7-a16b-de652950a7d1';
const PHONE_ID = '850356761502552';
const WEBHOOK_URL = 'https://clickube.com/api/77009036-af89-49f7-a16b-de652950a7d1/850356761502552/webhook';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const mediaAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    timeout: 90000,
    scheduling: 'lifo'
});

// ── Step 1: Validate Token ─────────────────────────────────────────────────
async function validateToken(token) {
    console.log('\n🔐 STEP 1: Validating Meta Access Token...');
    try {
        const r = await axios.get('https://graph.facebook.com/v21.0/me', {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000
        });
        console.log('✅ Token VALID:', JSON.stringify(r.data));
        return true;
    } catch (e) {
        console.log('❌ Token INVALID - HTTP', e.response?.status, JSON.stringify(e.response?.data));
        return false;
    }
}

// ── Step 2: Simulate a webhook with an image message ───────────────────────
async function sendTestWebhook(mediaId, uniqueMsgId) {
    const payload = {
        object: 'whatsapp_business_account',
        entry: [{
            id: '123456',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: { display_phone_number: '15550123456', phone_number_id: PHONE_ID },
                    contacts: [{ profile: { name: 'Debug Test' }, wa_id: '918408907516' }],
                    messages: [{
                        from: '918408907516',
                        id: uniqueMsgId,
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        type: 'image',
                        image: {
                            id: mediaId,
                            mime_type: 'image/jpeg',
                            sha256: 'test_sha256'
                        }
                    }]
                },
                field: 'messages'
            }]
        }]
    };

    try {
        const r = await axios.post(WEBHOOK_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'x-hub-signature-256': 'sha256=test' // Bypass if signature check is disabled
            },
            timeout: 15000
        });
        console.log(`  Webhook responded: HTTP ${r.status}`);
        return true;
    } catch (e) {
        console.log(`  Webhook error: HTTP ${e.response?.status} - ${e.message}`);
        return false;
    }
}

// ── Step 3: Test direct media download (same as webhook code) ──────────────
async function testDirectDownload(mediaId, token) {
    console.log(`\n📥 STEP 3: Direct download test for mediaId: ${mediaId}`);

    // Fetch URL from Meta
    let urlData;
    try {
        const r = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 15000
        });
        urlData = r.data;
        console.log('✅ URL fetched from Meta:', urlData?.url?.substring(0, 80));
        console.log('   MIME type:', urlData?.mime_type, '| File size:', urlData?.file_size);
    } catch (e) {
        console.log('❌ URL fetch failed - HTTP', e.response?.status, JSON.stringify(e.response?.data));
        if (e.response?.status === 401) {
            console.log('   >>> TOKEN IS EXPIRED — refresh in Settings > WhatsApp Config <<<');
        }
        return null;
    }

    if (!urlData?.url) return null;

    // Download the binary
    await new Promise(r => setTimeout(r, 1000)); // CDN propagation
    try {
        const start = Date.now();
        const r = await axios.get(urlData.url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': '*/*',
                'Accept-Encoding': 'identity',
                'User-Agent': 'Mozilla/5.0 Chrome/121.0.0.0',
            },
            responseType: 'arraybuffer',
            decompress: false,
            timeout: 60000,
            httpsAgent: mediaAgent
        });
        const ms = Date.now() - start;
        const bytes = r.data.byteLength;
        console.log(`✅ Binary downloaded: ${bytes} bytes in ${ms}ms`);
        return Buffer.from(r.data);
    } catch (e) {
        console.log('❌ Binary download failed - HTTP', e.response?.status, e.message);
        return null;
    }
}

// ── Step 4: Upload to Supabase and return URL ──────────────────────────────
async function testUpload(buffer, mediaId) {
    console.log(`\n☁️  STEP 4: Upload to Supabase...`);
    const path = `${USER_ID}/debug-test/${Date.now()}-${mediaId}.jpeg`;
    const { error } = await supabase.storage
        .from('campaign-media')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
    if (error) {
        console.log('❌ Upload failed:', error.message);
        return null;
    }
    const { data: pub } = supabase.storage.from('campaign-media').getPublicUrl(path);
    console.log('✅ Uploaded successfully!');
    console.log('   Public URL:', pub?.publicUrl);
    return pub?.publicUrl;
}

// ── Step 5: Run 10 Webhook Simulations ────────────────────────────────────
async function runWebhookLoadTest(token, realMediaId, count = 10) {
    console.log(`\n🚀 STEP 5: Sending ${count} webhook simulations to live server...`);
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
        const uniqueWamId = `wamid.test_${Date.now()}_${i}`;
        process.stdout.write(`  [${i + 1}/${count}] Sending... `);
        const ok = await sendTestWebhook(realMediaId, uniqueWamId);
        if (ok) { passed++; process.stdout.write('✅\n'); }
        else { failed++; process.stdout.write('❌\n'); }
        await new Promise(r => setTimeout(r, 500)); // 500ms between sends
    }

    console.log(`\n  Results: ${passed} passed, ${failed} failed out of ${count}`);

    // Wait 15s for BG downloads to complete, then check DB
    console.log('\n  Waiting 15s for background downloads to complete...');
    await new Promise(r => setTimeout(r, 15000));

    const { data } = await supabase
        .from('messages')
        .select('id, media_url, type')
        .ilike('type', '%image%')
        .order('created_at', { ascending: false })
        .limit(count + 5);

    const withUrl = data?.filter(m => m.media_url && !m.media_url.includes('TOKEN')) || [];
    const withoutUrl = data?.filter(m => !m.media_url) || [];
    console.log(`  DB check: ${withUrl.length} messages have media_url, ${withoutUrl.length} have null`);
    return { passed, failed };
}

// ── MAIN ───────────────────────────────────────────────────────────────────
async function main() {
    console.log('========================================');
    console.log(' MEDIA PIPELINE FULL DIAGNOSTIC');
    console.log('========================================');

    // Get token
    const { data: cfg } = await supabase
        .from('whatsapp_config')
        .select('meta_access_token')
        .eq('user_id', USER_ID).eq('phone_number_id', PHONE_ID).single();
    const token = cfg?.meta_access_token;
    console.log('Token length:', token?.length);

    // Step 1
    const tokenValid = await validateToken(token);
    if (!tokenValid) {
        console.log('\n🛑 CANNOT PROCEED - Token is invalid. Fix token first.');
        process.exit(1);
    }

    // Get one recent real media ID from the Meta Graph API via phone number
    // We'll use a recently stored message's whatsapp_message_id to get the conversation
    const { data: recentImage } = await supabase
        .from('messages')
        .select('whatsapp_message_id, type')
        .eq('type', 'image')
        .eq('direction', 'in')
        .not('whatsapp_message_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    // The whatsapp_message_id is the WAMID, not the media ID used for download
    // We need to get a fresh media ID by monitoring a test upload
    // For testing, use the phone number's WABA ID to list recent messages

    // ─── APPROACH: Fetch media objects from WABA ───
    let realMediaId = null;
    try {
        console.log('\n🔍 Fetching recent media from WABA via Graph API...');
        // Get WABA ID
        const { data: wabaData } = await supabase
            .from('whatsapp_config')
            .select('business_account_id, phone_number_id')
            .eq('user_id', USER_ID)
            .eq('phone_number_id', PHONE_ID)
            .single();

        // Use phone number ID to get recent messages
        if (wabaData?.business_account_id) {
            const r = await axios.get(
                `https://graph.facebook.com/v21.0/${wabaData.business_account_id}/media`,
                {
                    headers: { Authorization: `Bearer ${token}` },
                    params: { fields: 'id,mime_type,file_size', limit: 1 },
                    timeout: 10000
                }
            );
            realMediaId = r.data?.data?.[0]?.id;
            console.log('Found mediaId from WABA:', realMediaId);
        }
    } catch (e) {
        console.log('Could not fetch from WABA:', e.message);
    }

    // If no media ID from WABA, use a known test ID or prompt
    if (!realMediaId) {
        // Use the media ID from the last failed DB entry if available
        console.log('\n⚠️  No fresh mediaId available for test. Using a known recent ID from logs...');
        // IDs from the logs we saw earlier
        realMediaId = '937616382273143'; // From last log failure
    }

    // Step 3: Direct download test
    const buffer = await testDirectDownload(realMediaId, token);
    if (!buffer) {
        console.log('\n⚠️  Direct download failed. Media IDs expire after ~5 mins in Meta.');
        console.log('   The webhook simulation below will use fresh IDs when you send real messages.');
    } else {
        // Step 4: Upload test
        await testUpload(buffer, realMediaId);
    }

    // Step 5: Load test with live webhook (10 messages)
    await runWebhookLoadTest(token, realMediaId, 10);

    console.log('\n========================================');
    console.log(' DIAGNOSIS COMPLETE');
    console.log('========================================');
    process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
