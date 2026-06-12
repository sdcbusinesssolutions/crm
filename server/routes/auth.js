const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const SmtpService = require('../services/SmtpService');
const NodeCache = require('node-cache');

// Cache for OTPs: valid for 15 minutes (900 seconds)
const otpCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

// Helper to generate a 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Request Password Reset OTP
 * POST /api/auth/forgot-password
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email, domain } = req.body;

        if (!email || !domain) {
            return res.status(400).json({ error: 'Email and domain are required' });
        }

        const requestDomain = domain.replace(/^www\./, '').toLowerCase();

        // 1. Verify user exists in this domain
        const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('id, name')
            .eq('email', email)
            .eq('signup_domain', requestDomain)
            .single();

        if (profileError || !userProfile) {
            // Return success anyway to prevent email enumeration attacks
            return res.json({ success: true, message: 'If an account exists, an OTP will be sent.' });
        }

        // 2. Fetch Tenant Admin's SMTP Settings
        // Find domain owner/admin
        const { data: domainUsers } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('signup_domain', requestDomain)
            .in('role', ['owner', 'admin'])
            .limit(1);

        if (!domainUsers || domainUsers.length === 0) {
            console.warn(`Auth Route: No admin found for domain ${requestDomain}`);
            return res.status(500).json({ error: 'System configuration error. Please contact support.' });
        }

        const adminId = domainUsers[0].id;

        // Get SMTP integration
        const { data: smtpIntegration } = await supabaseAdmin
            .from('user_integrations')
            .select('credentials')
            .eq('user_id', adminId)
            .eq('provider', 'smtp')
            .single();

        if (!smtpIntegration || !smtpIntegration.credentials) {
            console.warn(`Auth Route: No SMTP configuration found for domain ${requestDomain}`);
            return res.status(500).json({ error: 'Email service is not configured for this workspace. Please contact support.' });
        }

        const smtpConfig = smtpIntegration.credentials;

        // 3. Generate OTP and save to cache
        const otp = generateOTP();
        const cacheKey = `${email.toLowerCase()}_${requestDomain}`;
        otpCache.set(cacheKey, otp);

        // 4. Send Email
        const htmlBody = `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
                <h2 style="color: #333;">Password Reset Request</h2>
                <p>Hello ${userProfile.name || 'User'},</p>
                <p>We received a request to reset your password for your workspace on <strong>${requestDomain}</strong>.</p>
                <p>Your password reset code is:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; text-align: center; padding: 20px; background-color: #f5f5f5; border-radius: 6px; margin: 20px 0;">
                    ${otp}
                </div>
                <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
                <hr style="border: 0; border-top: 1px solid #eaeaea; margin-top: 30px; margin-bottom: 20px;" />
                <p style="color: #999; font-size: 12px; text-align: center;">Secure Password Recovery</p>
            </div>
        `;

        await SmtpService.sendEmail(
            smtpConfig,
            smtpConfig.fromEmail,
            email,
            'Your Password Reset Code',
            htmlBody
        );

        return res.json({ success: true, message: 'OTP sent successfully' });

    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

/**
 * Verify OTP and Reset Password
 * POST /api/auth/reset-password
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, domain, otp, newPassword } = req.body;

        if (!email || !domain || !otp || !newPassword) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const requestDomain = domain.replace(/^www\./, '').toLowerCase();
        const cacheKey = `${email.toLowerCase()}_${requestDomain}`;

        // 1. Verify OTP
        const cachedOtp = otpCache.get(cacheKey);

        if (!cachedOtp) {
            return res.status(400).json({ error: 'OTP has expired or is invalid. Please request a new one.' });
        }

        if (cachedOtp !== otp) {
            return res.status(400).json({ error: 'Incorrect OTP code.' });
        }

        // 2. Find user ID
        const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', email)
            .eq('signup_domain', requestDomain)
            .single();

        if (!userProfile) {
            return res.status(400).json({ error: 'User not found' });
        }

        // 3. Update password in Supabase Auth
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userProfile.id, {
            password: newPassword
        });

        if (updateError) {
            throw updateError;
        }

        // 4. Clear OTP from cache
        otpCache.del(cacheKey);

        return res.json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
