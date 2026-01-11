const express = require('express');
const router = express.Router();
const UsersController = require('../../controllers/admin/UsersController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.get('/', verifyAdminToken, UsersController.getUsers);
router.post('/create', verifyAdminToken, UsersController.createUser);
router.post('/update', verifyAdminToken, UsersController.updateUser);
router.post('/delete-soft', verifyAdminToken, UsersController.softDeleteUser);
router.post('/delete', verifyAdminToken, UsersController.deleteUser);
router.post('/delete-hard', verifyAdminToken, UsersController.hardDeleteUser);
router.post('/change-password', verifyAdminToken, UsersController.changeUserPassword);
router.post('/login-as', verifyAdminToken, UsersController.impersonateUser);
router.post('/status-toggle', verifyAdminToken, UsersController.toggleUserStatus);

module.exports = router;
