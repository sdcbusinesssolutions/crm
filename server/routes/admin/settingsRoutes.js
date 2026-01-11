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

module.exports = router;
