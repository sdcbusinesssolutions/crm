const express = require('express');
const router = express.Router();
const StaffController = require('../controllers/staff.controller');
const { authenticateStaff } = require('../middleware/staffAuth.middleware');
const requireAuth = require('../../../middleware/requireAuth'); // Existing owner auth

// 1. Public Staff Routes
router.post('/login', StaffController.login);

// 2. Owner-Only Routes (Managing Staff)
// These use the existing CRM authentication (requireAuth)
// 2. Owner-Only or Staff-Access Routes
// Combined auth to allow both Owners and Staff to see the list
const combinedAuth = (req, res, next) => {
  // Try existing owner auth first
  requireAuth(req, res, (err) => {
    if (!err) return next();
    // If not owner, try staff auth
    authenticateStaff(req, res, next);
  });
};

router.post('/', requireAuth, StaffController.createStaff);
router.get('/', combinedAuth, StaffController.listStaff);
router.put('/:staffId/permissions', requireAuth, StaffController.updatePermissions);
router.post('/assign-lead', requireAuth, StaffController.assignLead);
router.get('/leads/:leadId/assignments', requireAuth, StaffController.getLeadAssignments);
router.post('/unassign-lead', requireAuth, StaffController.unassignLead);
router.post('/assign-conversation', requireAuth, StaffController.assignConversation);
router.delete('/:staffId', requireAuth, StaffController.deleteStaff);

// 3. Staff-Specific Routes
// These use the new staff authentication
router.get('/me', authenticateStaff, (req, res) => {
  res.json({ staff: req.staff });
});

router.get('/my-leads', authenticateStaff, StaffController.getMyLeads);

module.exports = router;
