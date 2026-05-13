const express = require('express');
const router = express.Router();
const StaffController = require('../controllers/staff.controller');
const { authenticateStaff } = require('../middleware/staffAuth.middleware');
const requireAuth = require('../../../middleware/requireAuth'); // Existing owner auth

// 1. Public Staff Routes
router.post('/login', StaffController.login);

// 2. Owner-Only Routes (Managing Staff)
// These use the existing CRM authentication (requireAuth)
router.post('/', requireAuth, StaffController.createStaff);
router.get('/', requireAuth, StaffController.listStaff);
router.put('/:staffId/permissions', requireAuth, StaffController.updatePermissions);
router.post('/assign-lead', requireAuth, StaffController.assignLead);
router.get('/leads/:leadId/assignments', requireAuth, StaffController.getLeadAssignments);
router.post('/unassign-lead', requireAuth, StaffController.unassignLead);
router.post('/assign-conversation', requireAuth, StaffController.assignConversation);

// 3. Staff-Specific Routes
// These use the new staff authentication
router.get('/me', authenticateStaff, (req, res) => {
  res.json({ staff: req.staff });
});

router.get('/my-leads', authenticateStaff, StaffController.getMyLeads);

module.exports = router;
