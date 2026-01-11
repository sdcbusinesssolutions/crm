const express = require('express');
const router = express.Router();
const PlansController = require('../../controllers/admin/PlansController');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.get('/', verifyAdminToken, PlansController.getAllPlans);
router.post('/create', verifyAdminToken, PlansController.createPlan);
router.post('/update', verifyAdminToken, PlansController.updatePlan);
router.post('/delete', verifyAdminToken, PlansController.deletePlan);

module.exports = router;
