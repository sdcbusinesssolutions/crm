const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const { requirePermission, ACCESS_TYPES } = require('../middleware/requirePermission');



// ...
// ...
// --- Google Integration ---
const googleRoutes = require('./integrations/google');
router.use('/google', requirePermission('Integrations', ACCESS_TYPES.READ), googleRoutes);

// --- Gmail Integration ---
const gmailRoutes = require('./integrations/gmail');
router.use('/gmail', requirePermission('Integrations', ACCESS_TYPES.READ), gmailRoutes);

// --- SMTP Integration ---
const smtpRoutes = require('./integrations/smtp');
router.use('/smtp', requirePermission('Integrations', ACCESS_TYPES.READ), smtpRoutes);

module.exports = router;
