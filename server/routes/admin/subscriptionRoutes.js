const express = require('express');
const router = express.Router();
const SubscriptionController = require('../../controllers/admin/SubscriptionController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.get('/', verifyAdminToken, SubscriptionController.getAllSubscriptions);
router.get('/history/:userId', verifyAdminToken, SubscriptionController.getUserSubscriptionHistory);
router.post('/update', verifyAdminToken, SubscriptionController.updateSubscription); // Can be placeholder or real update logic
router.post('/delete', verifyAdminToken, SubscriptionController.deleteSubscription);
router.post('/assign', verifyAdminToken, SubscriptionController.assignSubscription);

module.exports = router;
