const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const speakeasy = require('speakeasy');
const axios = require('axios');
const qrcode = require('qrcode');
const crypto = require('crypto');
const { logOnboardingEvent } = require('../utils/logger');

// Helper to get user ID from request (populated by requireAuth middleware)
const getUserId = (req) => req.user.id;

// Helper to detect current domain for multi-tenant settings
const getTargetDomain = (req) => {
    const origin = req.headers.origin || req.headers.host || '';
    let domain = 'clickube.com';
    try {
        if (origin.startsWith('http')) {
            domain = new URL(origin).hostname;
        } else {
            domain = origin.split(':')[0];
        }
    } catch (e) {
        // Fallback already set
    }
    
    domain = domain.replace(/^www\./, '').toLowerCase();
    
    // Fallback for local development
    if (domain.includes('localhost') || domain.includes('127.0.0.1')) {
        return 'clickube.com';
    }
    
    return domain;
};

// ==========================================
// 1. WhatsApp Account Setup
// ==========================================

// ==========================================
// 1. WhatsApp Account Setup (Multiple Accounts)
// ==========================================

// GET /settings/whatsapp - List all accounts
router.get('/whatsapp', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        const { data, error } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        res.json(data || []);
    } catch (error) {
        console.error('Error fetching WhatsApp accounts:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/whatsapp - Create new account
router.post('/whatsapp', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const {
            name,
            phone_number,
            phone_number_id,
            whatsapp_business_account_id,
            meta_app_id,
            meta_access_token
        } = req.body;

        // Validate required fields
        if (!phone_number || !phone_number_id || !whatsapp_business_account_id || !meta_app_id || !meta_access_token) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Insert new account
        const { data, error } = await supabase
            .from('whatsapp_config')
            .insert({
                user_id: userId,
                name: name || 'WhatsApp Account',
                phone_number,
                phone_number_id,
                whatsapp_business_account_id,
                meta_app_id,
                meta_access_token
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'WhatsApp account added successfully', data });
    } catch (error) {
        console.error('Error adding WhatsApp account:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /settings/whatsapp/:id - Update account
router.put('/whatsapp/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const accountId = req.params.id;
        const supabase = getAuthenticatedSupabase(req);
        const {
            name,
            phone_number,
            phone_number_id,
            whatsapp_business_account_id,
            meta_app_id,
            meta_access_token
        } = req.body;

        if (!phone_number || !phone_number_id || !whatsapp_business_account_id || !meta_app_id || !meta_access_token) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const { data, error } = await supabase
            .from('whatsapp_config')
            .update({
                name,
                phone_number,
                phone_number_id,
                whatsapp_business_account_id,
                meta_app_id,
                meta_access_token,
                updated_at: new Date().toISOString()
            })
            .eq('id', accountId)
            .eq('user_id', userId) // Ensure ownership
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'WhatsApp account updated successfully', data });
    } catch (error) {
        console.error('Error updating WhatsApp account:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /settings/whatsapp/:id - Delete account
router.delete('/whatsapp/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const accountId = req.params.id;
        const supabase = getAuthenticatedSupabase(req);

        const { error } = await supabase
            .from('whatsapp_config')
            .delete()
            .eq('id', accountId)
            .eq('user_id', userId);

        if (error) throw error;

        res.json({ message: 'WhatsApp account deleted successfully' });
    } catch (error) {
        console.error('Error deleting WhatsApp account:', error);
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// 2. Webhook Setup
// ==========================================

// GET /settings/webhook
router.get('/webhook', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        // Generate Base URL
        const baseUrl = process.env.SERVER_BASE_URL || `https://${req.get('host')}/api`;

        // Fetch all accounts to generate URLs
        const { data: accounts, error: accountsError } = await supabase
            .from('whatsapp_config')
            .select('id, phone_number_id, verify_token')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (accountsError && accountsError.code !== 'PGRST116') throw accountsError;

        const verifyToken = accounts && accounts.length > 0 ? accounts[0].verify_token : '';

        // Generate a list of webhook URLs
        const webhookUrls = (accounts || []).map(account => ({
            phoneNumberId: account.phone_number_id,
            url: `${baseUrl}/${userId}/${account.phone_number_id}/webhook`
        }));

        res.json({
            webhookUrls, // List of { phoneNumberId, url }
            verifyToken
        });
    } catch (error) {
        console.error('Error fetching webhook settings:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/webhook (Update Verify Token)
router.post('/webhook', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { verifyToken } = req.body;

        if (!verifyToken) {
            return res.status(400).json({ error: 'Verify token is required' });
        }

        // Update ALL accounts for this user with the same verify token
        // This ensures whichever account is used for verification, it works.
        const { error } = await supabase
            .from('whatsapp_config')
            .update({ verify_token: verifyToken, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (error) throw error;

        // If no accounts exist, we can't save the token in whatsapp_config (unless we create a dummy one, which is bad).
        // Frontend should probably force creating an account first.
        // Or we could have a separate 'user_settings' table. 
        // For now, we assume at least one account exists or we just return success (but it won't be saved if no rows).

        // Check if any rows were updated
        // supabase-js update doesn't return count by default unless select is used?
        // Actually, if no rows match, it's not an error.

        res.json({ message: 'Verify token updated successfully' });
    } catch (error) {
        console.error('Error updating verify token:', error);
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// 3. Change Password
// ==========================================

router.post('/change-password', async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const supabase = getAuthenticatedSupabase(req);
        // Note: For auth.updateUser, we might need the service role client if we are updating other users,
        // but here we are updating the current user. 
        // However, auth.signInWithPassword usually requires the anon client or just works.
        // auth.updateUser works with the authenticated client.

        if (!oldPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'New passwords do not match' });
        }

        const email = req.user.email;
        if (!email) {
            return res.status(400).json({ error: 'User email not found in session' });
        }

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password: oldPassword
        });

        if (signInError) {
            return res.status(401).json({ error: 'Incorrect old password' });
        }

        // 2. Update to new password
        const { error: updateError } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (updateError) {
            throw updateError;
        }

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// 4. Two-Factor Authentication (2FA)
// ==========================================

// GET /settings/2fa
router.get('/2fa', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('user_security')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json({
            enabled: data?.two_factor_enabled || false,
            setupKey: data?.two_factor_secret || null
        });
    } catch (error) {
        console.error('Error fetching 2FA status:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/2fa/generate (Generate New Key)
router.post('/2fa/generate', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const secret = speakeasy.generateSecret({ length: 20 });

        // Save secret to DB
        const { data: existing } = await supabase
            .from('user_security')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (existing) {
            await supabase
                .from('user_security')
                .update({ two_factor_secret: secret.base32, two_factor_enabled: false })
                .eq('user_id', userId);
        } else {
            await supabase
                .from('user_security')
                .insert({ user_id: userId, two_factor_secret: secret.base32, two_factor_enabled: false });
        }

        // Generate QR Code
        const otpauth_url = secret.otpauth_url;
        const qrCodeUrl = await qrcode.toDataURL(otpauth_url);

        res.json({
            secret: secret.base32,
            qrCode: qrCodeUrl
        });
    } catch (error) {
        console.error('Error generating 2FA key:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/2fa/verify (Verify and Enable)
router.post('/2fa/verify', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { token } = req.body;

        if (!token) return res.status(400).json({ error: 'Token is required' });

        const { data } = await supabase
            .from('user_security')
            .select('two_factor_secret')
            .eq('user_id', userId)
            .single();

        if (!data || !data.two_factor_secret) {
            return res.status(400).json({ error: '2FA not set up' });
        }

        const verified = speakeasy.totp.verify({
            secret: data.two_factor_secret,
            encoding: 'base32',
            token: token
        });

        if (verified) {
            res.json({ valid: true });
        } else {
            res.status(400).json({ valid: false, error: 'Invalid token' });
        }
    } catch (error) {
        console.error('Error verifying 2FA:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/2fa/enable
router.post('/2fa/enable', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { token } = req.body;

        if (!token) return res.status(400).json({ error: 'Token is required to enable 2FA' });

        const { data } = await supabase
            .from('user_security')
            .select('two_factor_secret')
            .eq('user_id', userId)
            .single();

        if (!data || !data.two_factor_secret) {
            return res.status(400).json({ error: '2FA not set up' });
        }

        const verified = speakeasy.totp.verify({
            secret: data.two_factor_secret,
            encoding: 'base32',
            token: token
        });

        if (!verified) {
            return res.status(400).json({ error: 'Invalid token' });
        }

        await supabase
            .from('user_security')
            .update({ two_factor_enabled: true })
            .eq('user_id', userId);

        res.json({ message: '2FA enabled successfully' });
    } catch (error) {
        console.error('Error enabling 2FA:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/2fa/disable
router.post('/2fa/disable', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        await supabase
            .from('user_security')
            .update({ two_factor_enabled: false })
            .eq('user_id', userId);

        res.json({ message: '2FA disabled successfully' });
    } catch (error) {
        console.error('Error disabling 2FA:', error);
        if (error.code === '42P01') {
            return res.status(500).json({ error: 'Database table missing. Please run the setup SQL script.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 5. Branding & Appearance
// ==========================================

// GET /settings/branding - MOVED to branding.js for soft-auth
// router.get('/branding', ... );


// PUT /settings/branding
router.put('/branding', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const themeConfig = req.body;

        // Upsert branding settings
        const { data, error } = await supabase
            .from('branding_settings')
            .upsert({
                user_id: userId,
                theme_config: themeConfig,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Branding settings updated successfully', data: data.theme_config });
    } catch (error) {
        console.error('Error updating branding settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 6. Onboarding Settings
// ==========================================

// GET /settings/onboarding
router.get('/onboarding', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        const { data, error } = await supabase
            .from('onboarding_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Return empty default if not found
        res.json(data || {
            manual_enabled: false,
            embedded_enabled: false,
            embedded_app_id: '',
            embedded_app_secret: '',
            embedded_config_id: ''
        });
    } catch (error) {
        console.error('Error fetching onboarding settings:', error);
        if (error.code === '42P01') {
            // Use a defined error code/message so frontend can handle it nicely or ignore
            return res.status(500).json({ error: 'Database table missing. Please ensure migrations are run.' });
        }
        res.status(500).json({ error: error.message });
    }
});

// PUT /settings/onboarding
router.put('/onboarding', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const {
            manual_enabled,
            embedded_enabled,
            embedded_app_id,
            embedded_app_secret,
            embedded_config_id
        } = req.body;

        // Upsert settings
        const { data, error } = await supabase
            .from('onboarding_settings')
            .upsert({
                user_id: userId,
                manual_enabled,
                embedded_enabled,
                embedded_app_id,
                embedded_app_secret,
                embedded_config_id,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Onboarding settings updated successfully', data });
    } catch (error) {
        console.error('Error updating onboarding settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 7. Embedded Signup (User Facing)
// ==========================================

const MetaOnboardingService = require('../services/MetaOnboardingService');

// GET /settings/onboarding/config - Public config for embedded signup (App ID, Config ID)
// GET /settings/onboarding/config - Public config for embedded signup (App ID, Config ID)
// GET /settings/onboarding/config - Public config for embedded signup (App ID, Config ID)
router.get('/onboarding/config', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        // Domain Extraction
        const domain = getTargetDomain(req);


        // 1. Check for User-Specific Overrides (Allowing "Bring Your Own App")
        const { data: userSettings, error: userError } = await supabase
            .from('onboarding_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (userSettings && userSettings.embedded_enabled && userSettings.embedded_app_id && userSettings.embedded_config_id) {
            console.log('DEBUG: Returning Custom User App Config for Embedded Signup');
            return res.json({
                appId: userSettings.embedded_app_id,
                configId: userSettings.embedded_config_id,
                isCustom: true // Signal frontend to use own domain bridge
            });
        }

        // 2. Fallback to System Settings (Domain Aware)
        let settings;
        try {
            settings = await MetaOnboardingService.getSystemSettings(domain);
        } catch (e) {
            // If settings missing, just return disabled state
            console.warn(`[Onboarding] Config missing for ${domain}: ${e.message}`);
            return res.status(403).json({ error: 'Embedded signup is not configured for this domain.' });
        }

        if (!settings.embedded_enabled) {
            return res.status(403).json({ error: 'Embedded signup is disabled.' });
        }
        res.json({
            appId: settings.embedded_app_id,
            configId: settings.embedded_config_id,
            bridgeDomain: settings.bridge_domain || process.env.BRIDGE_DOMAIN,
            isCustom: false
        });
    } catch (error) {
        console.error('Error fetching onboarding config:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /settings/whatsapp/embedded-signup - Process OAuth Code
router.post('/whatsapp/embedded-signup', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { code, setup_mode } = req.body; // setup_mode could be 'phone' or 'waba'

        // Domain Extraction
        const domain = getTargetDomain(req);

        if (!code) return res.status(400).json({ error: 'Authorization code is required.' });

        logOnboardingEvent('SIGNUP_FLOW_START', { userId, setup_mode, domain });

        // 1. Exchange Code for Token (Pass Domain)
        const tokenData = await MetaOnboardingService.exchangeCodeForToken(code, domain);
        const accessToken = tokenData.access_token;

        // Auto-detect Logic
        let { waba_id, phone_number_id } = req.body;

        if (waba_id === 'auto_detect' || !waba_id) {
            console.log('Auto-detecting WABA...');
            // Pass Domain for fallback lookup
            const wabaData = await MetaOnboardingService.getWabas(accessToken, domain);
            if (wabaData.data && wabaData.data.length > 0) {
                waba_id = wabaData.data[0].id;
                logOnboardingEvent('WABA_AUTODETECT', { userId, wabaId: waba_id, count: wabaData.data.length });
                console.log('Detected WABA ID:', waba_id);
            } else {
                logOnboardingEvent('WABA_AUTODETECT_FAIL', { userId, error: 'No WABA found' });
                throw new Error('No WhatsApp Business Account found connected to this user.');
            }
        }

        // 2. Fetch Phone Numbers
        console.log(`Fetching phone numbers for WABA: ${waba_id}`);
        // Log intent to fetch phones
        logOnboardingEvent('FETCH_PHONES_INIT', { userId, wabaId: waba_id });
        const phoneData = await MetaOnboardingService.getPhoneNumbers(waba_id, accessToken);

        // 3. Auto-detect Phone
        let phoneRecord;
        if (phone_number_id === 'auto_detect' || !phone_number_id) {
            if (phoneData.data && phoneData.data.length > 0) {
                // IMPROVED: Sort by last_onboarded_time (descending) to pick the most recently added/modified number
                // This prevents picking an old number (e.g., from a previous test) when the user just added a new one.
                const sortedPhones = phoneData.data.sort((a, b) => {
                    const timeA = a.last_onboarded_time ? new Date(a.last_onboarded_time).getTime() : 0;
                    const timeB = b.last_onboarded_time ? new Date(b.last_onboarded_time).getTime() : 0;
                    return timeB - timeA;
                });

                phoneRecord = sortedPhones[0];
                phone_number_id = phoneRecord.id;
                logOnboardingEvent('PHONE_AUTODETECT', { userId, phoneId: phone_number_id, number: phoneRecord.display_phone_number });
                console.log(`Detected Phone ID: ${phone_number_id} (Last Onboarded: ${phoneRecord.last_onboarded_time || 'N/A'})`);
            } else {
                logOnboardingEvent('PHONE_AUTODETECT_FAIL', { userId, wabaId: waba_id, error: 'No phone numbers found' });
                throw new Error('No phone numbers found in this WABA.');
            }
        } else {
            phoneRecord = phoneData.data.find(p => p.id === phone_number_id);
            if (!phoneRecord) throw new Error('Selected phone number not found in WABA.');
        }

        // 4. Register Phone (if needed)
        console.log('Checking registration status for phone:', phoneRecord.display_phone_number);
        console.log('Platform Type:', phoneRecord.platform_type);
        console.log('Is On Biz App:', phoneRecord.is_on_biz_app);

        let isCoexistence = false;

        if (phoneRecord.is_on_biz_app) {
            console.log('Phone is on SMB App (Coexistence detected). Skipping registration.');
            logOnboardingEvent('COEXISTENCE_DETECTED', { userId, phoneId: phone_number_id, isOnBizApp: true });
            isCoexistence = true;
        } else if (phoneRecord.platform_type !== 'CLOUD_API') {
            console.log('Phone number not on Cloud API. Attempting registration...');
            try {
                // Default PIN '123456' as per reference implementation
                await MetaOnboardingService.registerPhoneNumber(phone_number_id, accessToken, '123456');
                logOnboardingEvent('PHONE_REG_SUCCESS', { userId, phoneId: phone_number_id });
                console.log('Registration successful.');
            } catch (regError) {
                console.warn('Registration warning:', regError.message);
                logOnboardingEvent('PHONE_REG_WARN', { userId, phoneId: phone_number_id, error: regError.message });
                // We don't abort strictly, as it might be a transient state or already registered.
                // But if it fails, the user might need to do it manually.
            }
        } else {
            console.log('Phone number is already on Cloud API. Skipping registration.');
        }

        // 5. Subscribe App (Webhook) - Robust/Aggressive Mode
        // Detect host locally
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const detectedBaseUrl = `${protocol}://${host}`;

        console.log(`[Embedded Signup] Resetting WABA connection to ensure clean state...`);
        // Aggressive Reset: Unsubscribe First
        await MetaOnboardingService.unsubscribeAppFromWaba(waba_id, accessToken);

        console.log(`[Embedded Signup] Subscribing App to WABA...`);
        await MetaOnboardingService.subscribeAppToWaba(waba_id, accessToken);

        // 6. Override Webhook
        const verifyToken = userId;
        console.log(`[Embedded Signup] Overriding Callback URL (Host: ${detectedBaseUrl})...`);
        await MetaOnboardingService.overrideCallbackUrl(waba_id, accessToken, verifyToken, detectedBaseUrl);

        // 6b. Trigger Coexistence Sync (Contacts & History)
        if (isCoexistence) {
            console.log('[Embedded Signup] Triggering Coexistence Data Sync...');
            logOnboardingEvent('SYNC_TRIGGER_INIT', { userId, phoneId: phone_number_id });
            // 1. Sync Contacts
            await MetaOnboardingService.triggerSmbDataSync(phone_number_id, accessToken, 'smb_app_state_sync');
            // 2. Sync History
            await MetaOnboardingService.triggerSmbDataSync(phone_number_id, accessToken, 'history');
        }

        // 7. Save to Database
        // We need the system App ID for the record (DOMAIN AWARE)
        const sysSettings = await MetaOnboardingService.getSystemSettings(domain);

        const { data, error } = await supabase
            .from('whatsapp_config')
            .insert({
                user_id: userId,
                name: phoneRecord.verified_name || phoneRecord.display_phone_number || 'Embedded WhatsApp',
                phone_number: phoneRecord.display_phone_number,
                phone_number_id: phone_number_id,
                whatsapp_business_account_id: waba_id,
                meta_app_id: sysSettings.embedded_app_id,
                meta_access_token: accessToken,
                verify_token: verifyToken
            })
            .select()
            .single();

        if (error) throw error;

        logOnboardingEvent('SIGNUP_FLOW_SUCCESS', {
            userId,
            wabaId: waba_id,
            phoneId: phone_number_id,
            verifyToken
        });

        res.json({ message: 'WhatsApp account connected successfully', data });

    } catch (error) {
        console.error('Embedded Signup Error:', error);
        logOnboardingEvent('SIGNUP_FLOW_ERROR', { userId: req.user.id, error: error.message });
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 8. Manual Webhook Update (User Triggered)
// ==========================================
router.post('/whatsapp/webhook/update', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        // Fetch config to get token and waba
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !config) {
            return res.status(404).json({ error: 'WhatsApp account not connected' });
        }

        const waba_id = config.whatsapp_business_account_id;
        const accessToken = config.meta_access_token;
        const verifyToken = config.verify_token || userId; // fallback to userId if missing

        if (!waba_id || !accessToken) {
            return res.status(400).json({ error: 'Incomplete configuration' });
        }

        // --- AUTO-FIX: Resolve Correct WABA ID ---
        const phone_number_id = config.phone_number_id;
        if (phone_number_id) {
            try {
                const GRAPH_API_URL = 'https://graph.facebook.com/v20.0';
                const phoneRes = await axios.get(`${GRAPH_API_URL}/${phone_number_id}?fields=whatsapp_business_account`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                const realWabaId = phoneRes.data.whatsapp_business_account?.id;

                if (realWabaId && realWabaId !== waba_id) {
                    console.log(`[WebhookUpdate] Correction: Updating WABA ID from ${waba_id} to ${realWabaId}`);

                    // Update Database
                    const { error: updateError } = await supabase
                        .from('whatsapp_config')
                        .update({ whatsapp_business_account_id: realWabaId })
                        .eq('user_id', userId);

                    if (!updateError) {
                        // Use correct ID for current operation
                        config.whatsapp_business_account_id = realWabaId;
                    }
                }
            } catch (resolveErr) {
                // Determine if it's a permissions issue or not found
                const msg = resolveErr.response?.data?.error?.message || resolveErr.message;
                // Only log non-trivial errors to avoid spamming logs for standard permission restrictions
                if (!msg.includes('nonexisting field')) {
                    console.warn('[WebhookUpdate] WABA Resolution Skipped:', msg);
                }
            }
        }

        const finalWabaId = config.whatsapp_business_account_id;

        // 0. Aggressive Reset: Unsubscribe First using detected logic
        // If we are in "Manual Update" mode, we want to clear any stuck state.
        console.log(`[Manual Update] Resetting connection for WABA ${finalWabaId}...`);
        await MetaOnboardingService.unsubscribeAppFromWaba(finalWabaId, accessToken);

        // 1. Force Subscribe App to WABA (Critical for receiving messages)
        // If this is missing/expired, verify works but messages don't arrive.
        console.log(`[Manual Update] Subscribing App to WABA ${finalWabaId}...`);

        let usableWabaId = finalWabaId;
        let isCoexistence = false; // Flag for SMB data sync

        try {
            await MetaOnboardingService.subscribeAppToWaba(usableWabaId, accessToken);
        } catch (subError) {
            console.warn('[Manual Update] Subscription failed. Checking if WABA ID is actually a Phone ID...', subError.message);

            // Fallback: If the "WABA ID" is actually a Phone ID, we can find the real WABA ID.
            try {
                const GRAPH_API_URL = 'https://graph.facebook.com/v20.0';
                const resolutionRes = await axios.get(`${GRAPH_API_URL}/${usableWabaId}?fields=whatsapp_business_account`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                const foundWabaId = resolutionRes.data.whatsapp_business_account?.id;

                if (foundWabaId && foundWabaId !== usableWabaId) {
                    console.log(`[Manual Update] RECOVERY: Found real WABA ID ${foundWabaId} from Phone ID ${usableWabaId}. Updating DB and Retrying...`);

                    // Update DB with REAL WABA ID
                    await supabase
                        .from('whatsapp_config')
                        .update({ whatsapp_business_account_id: foundWabaId })
                        .eq('user_id', userId);

                    usableWabaId = foundWabaId;

                    // Retry Subscription with NEW ID
                    await MetaOnboardingService.subscribeAppToWaba(usableWabaId, accessToken);
                    console.log('[Manual Update] Retry Subscription Successful!');
                } else {
                    throw subError;
                }
            } catch (resolutionError) {
                console.error('[Manual Update] Recovery failed:', resolutionError.message);
                throw subError;
            }
        }

        // 1.5. CHECK FOR COEXISTENCE (SMB App Users)
        // If the user is on the SMB App, we MUST trigger data sync to get contacts/history.
        if (config.phone_number_id) {
            try {
                // We need to check the specific phone number's status
                const phoneData = await MetaOnboardingService.getPhoneNumbers(usableWabaId, accessToken);
                const currentPhone = phoneData.data?.find(p => p.id === config.phone_number_id);

                if (currentPhone && currentPhone.is_on_biz_app) {
                    console.log(`[Manual Update] Coexistence Detected for ${config.phone_number_id}. Triggering Sync...`);
                    // Sync Contacts
                    await MetaOnboardingService.triggerSmbDataSync(config.phone_number_id, accessToken, 'smb_app_state_sync');
                    // Sync History
                    await MetaOnboardingService.triggerSmbDataSync(config.phone_number_id, accessToken, 'history');
                }
            } catch (syncCheckErr) {
                console.warn('[Manual Update] Failed to check Coexistence status:', syncCheckErr.message);
            }
        }

        // 2. Call Service to Override Webhook URL
        // Detect current host (crucial for Ngrok/Local testing)
        const protocol = req.get('x-forwarded-proto') || req.protocol; // Trust proxy for protocol
        const host = req.get('host');
        const detectedBaseUrl = `${protocol}://${host}`;

        console.log(`[Manual Update] Overriding Callback URL for WABA ${usableWabaId} using host: ${detectedBaseUrl}...`);
        await MetaOnboardingService.overrideCallbackUrl(usableWabaId, accessToken, verifyToken, detectedBaseUrl);

        logOnboardingEvent('WEBHOOK_UPDATE_SUCCESS', { userId, wabaId: usableWabaId });

        res.json({ message: 'Webhook URL updated successfully on Meta' });
    } catch (error) {
        console.error('Webhook Update Error:', error);
        logOnboardingEvent('WEBHOOK_UPDATE_ERROR', { userId: req.user.id, error: error.message });
        res.status(500).json({ error: error.message || 'Failed to update webhook' });
    }
});

// ==========================================
// 9. Token Management (Debug & Extend)
// ==========================================
// ==========================================
router.get('/whatsapp/token-debug', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        // 1. Get Token from DB
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token, meta_app_id') // Added meta_app_id
            .eq('user_id', userId)
            .single();

        if (error || !config || !config.meta_access_token) {
            return res.status(404).json({ error: 'No access token found' });
        }

        // 2. Fetch App ID/Secret to construct App Token
        const targetDomain = getTargetDomain(req);
        let sysSettings = {};
        try {
            sysSettings = await MetaOnboardingService.getSystemSettings(targetDomain);
        } catch (e) {
            console.warn(`System settings not found for token debug on ${targetDomain}, using fallback.`);
        }

        const appId = sysSettings.embedded_app_id || config.meta_app_id;
        const appSecret = sysSettings.embedded_app_secret;

        // If we have app credentials, use them (more reliable debugging). 
        // Otherwise, try using the token to debug itself (works for some fields).
        const appAccessToken = (appId && appSecret)
            ? `${appId}|${appSecret}`
            : config.meta_access_token;

        // 3. Debug Token
        const debugInfo = await MetaOnboardingService.getAccessTokenInfo(config.meta_access_token, appAccessToken);

        res.json({
            isValid: debugInfo.is_valid,
            expiresAt: debugInfo.expires_at,
            scopes: debugInfo.scopes,
            targetDomain: targetDomain, // Added for clarity
            appId: debugInfo.app_id || appId
        });
    } catch (err) {
        console.error('Token Debug Route Error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/whatsapp/token-extend', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        // 1. Get current token
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!config || !config.meta_access_token) {
            return res.status(404).json({ error: 'Config not found' });
        }

        const targetDomain = getTargetDomain(req);
        let sysSettings = {};
        try {
            sysSettings = await MetaOnboardingService.getSystemSettings(targetDomain);
        } catch (e) {
            console.warn(`System settings missing for token extend on ${targetDomain}`);
        }

        if (!sysSettings.embedded_app_id || !sysSettings.embedded_app_secret) {
            return res.status(400).json({
                error: 'Cannot extend token. System App ID and Secret are not configured in Onboarding Settings.'
            });
        }

        // 3. Call Service to Extend
        const result = await MetaOnboardingService.extendAccessToken(
            config.meta_access_token,
            sysSettings.embedded_app_id,
            sysSettings.embedded_app_secret
        );

        const newAccessToken = result.access_token;

        // 4. Update Database
        const { error: updateError } = await supabase
            .from('whatsapp_config')
            .update({ meta_access_token: newAccessToken })
            .eq('user_id', userId);

        if (updateError) throw updateError;

        res.json({
            success: true,
            message: 'Token extended successfully',
            expiresIn: result.expires_in // seconds from now
        });

    } catch (err) {
        console.error('Token Extend Route Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 10. Marketing Messages Lite (MM Lite)
// ==========================================

// POST /settings/whatsapp/mm-lite/partner-onboard/:id - Initiate partner onboarding
router.post('/whatsapp/mm-lite/partner-onboard/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const accountId = req.params.id;
        const supabase = getAuthenticatedSupabase(req);

        // Fetch account details
        const { data: config, error: fetchError } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('id', accountId)
            .eq('user_id', userId)
            .single();

        if (fetchError || !config) {
            return res.status(404).json({ error: 'WhatsApp account not found' });
        }

        let businessId = config.whatsapp_business_account_id; // Start with WABA ID
        
        // --- AUTO-FIX: Resolve Meta Business ID (Required for MM Lite) ---
        // If we only have the WABA ID, we need to find the ID of the Business that owns it.
        try {
            console.log(`[MM Lite] Attempting to resolve Business ID for WABA: ${businessId}`);
            const wabaInfo = await MetaOnboardingService.getWabaInfo(businessId, config.meta_access_token);
            if (wabaInfo.owner_business_info && wabaInfo.owner_business_info.id) {
                const realBusinessId = wabaInfo.owner_business_info.id;
                console.log(`[MM Lite] Correction: Resolved Business ID ${realBusinessId} from WABA ID ${businessId}`);
                businessId = realBusinessId;
            } else {
                console.warn(`[MM Lite] No owner_business_info found for WABA ${businessId}. Proceeding with original ID.`);
            }
        } catch (resolveErr) {
            console.warn(`[MM Lite] Business ID resolution failed (continuing with original):`, resolveErr.message);
        }

        // --- Domain Detection (Multi-tenant Support) ---
        const targetDomain = getTargetDomain(req);

        const result = await MetaOnboardingService.initiateMMLitePartnerOnboarding(
            businessId,
            config.meta_access_token,
            config.meta_app_id, // Use the App ID from DB as solution_id
            targetDomain
        );

        res.json({ 
            success: true,
            message: 'Partner onboarding initiated successfully', 
            data: result 
        });
    } catch (error) {
        console.error('Partner Onboarding Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /settings/whatsapp/mm-lite/eligibility/:id - Check eligibility
router.get('/whatsapp/mm-lite/eligibility/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const accountId = req.params.id;
        const supabase = getAuthenticatedSupabase(req);

        // 1. Get Config from DB
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('id', accountId)
            .eq('user_id', userId)
            .single();

        if (error || !config) {
            return res.status(404).json({ error: 'WhatsApp account not found' });
        }

        const waba_id = config.whatsapp_business_account_id;
        const accessToken = config.meta_access_token;

        if (!waba_id || !accessToken) {
            return res.status(400).json({ error: 'Incomplete configuration' });
        }

        // 2. Check Eligibility via Service
        try {
            const eligibility = await MetaOnboardingService.checkMMLiteEligibility(waba_id, accessToken, config.phone_number_id);

            if (!eligibility) {
                return res.status(404).json({ error: 'Eligibility data not returned from Meta' });
            }

            // Map Meta statuses to Frontend expected statuses
            let mappedStatus = eligibility.marketing_messages_onboarding_status || 'NOT_STARTED';
            if (mappedStatus === 'ONBOARDED') mappedStatus = 'COMPLETED';
            if (mappedStatus === 'APPROVED') mappedStatus = 'COMPLETED'; // Support old field mapping too

            res.json({
                waba_id: eligibility.id || waba_id,
                app_id: config.meta_app_id, // Added for clarity
                onboarding_status: (eligibility.marketing_messages_onboarding_status === 'ONBOARDED' || eligibility.marketing_messages_lite_onboarding_status === 'APPROVED') 
                                    ? 'APPROVED' 
                                    : 'PENDING',
                mm_lite_status: mappedStatus,
                phone_status: eligibility.phone_status || 'NOT_STARTED',
                bm_status: eligibility.bm_status || 'NOT_STARTED',
                full_eligibility: eligibility
            });
        } catch (serviceError) {
            console.error('MM Lite Service Error:', serviceError.message);
            res.status(502).json({ 
                error: 'Meta API Communication Error', 
                details: serviceError.message 
            });
        }

    } catch (err) {
        console.error('MM Lite Eligibility Route Error:', err);
        res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
});

// POST /settings/whatsapp/mm-lite/transition/:id - Transition number
router.post('/whatsapp/mm-lite/transition/:id', async (req, res) => {
    try {
        const userId = getUserId(req);
        const accountId = req.params.id;
        const supabase = getAuthenticatedSupabase(req);

        // 1. Get Config from DB
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('*')
            .eq('id', accountId)
            .eq('user_id', userId)
            .single();

        if (error || !config) {
            return res.status(404).json({ error: 'WhatsApp account not found' });
        }

        const phone_id = config.phone_number_id;
        const waba_id = config.whatsapp_business_account_id;
        const accessToken = config.meta_access_token;

        if (!phone_id || !accessToken) {
            return res.status(400).json({ error: 'Incomplete configuration' });
        }

        // --- Domain Detection (Multi-tenant Support) ---
        const targetDomain = getTargetDomain(req);

        // 2. Transition Number via Service (Using Meta Partner Onboarding API)
        // Note: Service handles status=ONBOARDED calls on the internal phone number edge.
        const result = await MetaOnboardingService.transitionNumberToMMLite(
            phone_id, 
            accessToken, 
            waba_id,
            targetDomain,
            config.meta_app_id
        );

        res.json({
            success: true,
            message: 'Number transition initiated successfully',
            data: result
        });

    } catch (err) {
        console.error('MM Lite Transition Route Error:', err);
        res.status(500).json({ error: err.message });
    }
});


// ==========================================
// 8. API Key Management
// ==========================================

/**
 * GET /api/settings/api-key
 * Fetch current stable API key
 */
router.get('/api-key', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        const { data, error } = await supabase
            .from('user_security')
            .select('api_key')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        res.json({ apiKey: data?.api_key || null });
    } catch (error) {
        console.error('Error fetching API key:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/settings/api-key
 * Generate or Rotate stable API key
 */
router.post('/api-key', async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        
        // Generate a clean prefix-based API key
        const newApiKey = `ak_${crypto.randomBytes(24).toString('hex')}`;

        // Update user_security record
        const { error } = await supabase
            .from('user_security')
            .upsert({ 
                user_id: userId, 
                api_key: newApiKey,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) throw error;

        res.json({ apiKey: newApiKey });
    } catch (error) {
        console.error('Error generating API key:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
