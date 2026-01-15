const express = require('express');
const router = express.Router();
const DashboardController = require('../../controllers/admin/DashboardController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.get('/stats', verifyAdminToken, DashboardController.getDashboardStats);
router.get('/tenants', verifyAdminToken, DashboardController.getTenantsList);

module.exports = router;
