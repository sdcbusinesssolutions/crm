const express = require('express');
const router = express.Router();
// Standard require
const AdminAuthController = require('../../controllers/admin/AdminAuthController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.post('/login', AdminAuthController.loginAdmin);
router.get('/me', verifyAdminToken, AdminAuthController.getMe);

module.exports = router;

