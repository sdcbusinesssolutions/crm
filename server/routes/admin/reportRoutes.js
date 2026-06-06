const express = require('express');
const router = express.Router();
const ReportController = require('../../controllers/admin/ReportController');

// All routes are prefixed with /api/wallet/admin/reports in the main server file
// Admin authentication middleware should be applied before hitting these routes.

router.get('/revenue', ReportController.getRevenueReport);
router.get('/wallet-summary', ReportController.getWalletSummary);
router.get('/usage', ReportController.getUsageReport);

module.exports = router;
