const express = require('express');
const router = express.Router();
const SettingsController = require('../../controllers/admin/SettingsController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

const AdminSettingsController = require('../../controllers/admin/AdminSettingsController');

router.get('/', verifyAdminToken, SettingsController.getSettings);
router.post('/update', verifyAdminToken, SettingsController.updateSettings);

// Onboarding Settings (Admin Only)
router.get('/onboarding', verifyAdminToken, AdminSettingsController.getOnboardingSettings);
router.put('/onboarding', verifyAdminToken, AdminSettingsController.updateOnboardingSettings);

// Signup Notifications (Platform Admin)
router.get('/notifications', verifyAdminToken, AdminSettingsController.getSignupNotifications);
router.put('/notifications', verifyAdminToken, AdminSettingsController.updateSignupNotifications);
router.get('/whatsapp-templates', verifyAdminToken, AdminSettingsController.getIntegrationTemplates);

// Email/SMTP Settings (Platform Admin)
router.get('/email', verifyAdminToken, AdminSettingsController.getSmtpSettings);
router.put('/email', verifyAdminToken, AdminSettingsController.updateSmtpSettings);
router.post('/email/test', verifyAdminToken, AdminSettingsController.testSmtpSettings);

module.exports = router;
