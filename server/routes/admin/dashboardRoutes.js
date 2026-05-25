const express = require('express');
const router = express.Router();
const DashboardController = require('../../controllers/admin/DashboardController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.get('/stats', verifyAdminToken, DashboardController.getDashboardStats);
router.get('/tenants', verifyAdminToken, DashboardController.getTenantsList);

router.post('/tenants/limit', verifyAdminToken, DashboardController.updateTenantLimit);
router.post('/tenants/add', verifyAdminToken, DashboardController.addTenant);
router.post('/tenants/delete', verifyAdminToken, DashboardController.deleteTenant);

module.exports = router;
