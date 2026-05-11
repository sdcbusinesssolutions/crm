const StaffService = require('../services/staff.service');

const StaffController = {
  /**
   * Login for staff members
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const result = await StaffService.login(email, password);
      res.json(result);
    } catch (error) {
      res.status(401).json({ error: error.message });
    }
  },

  /**
   * Create staff member (Owner only)
   */
  async createStaff(req, res) {
    try {
      const ownerId = req.user.id;
      console.log('👤 [StaffController] Creating staff for owner:', ownerId);
      const staff = await StaffService.createStaff(ownerId, req.body);
      res.status(201).json(staff);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  /**
   * List all staff (Owner only)
   */
  async listStaff(req, res) {
    try {
      const { supabaseAdmin } = require('../../../lib/supabaseClient');
      const { data, error } = await supabaseAdmin
        .from('team_staff')
        .select(`
          id, name, email, phone, role, status, created_at,
          team_staff_permissions (module_name, access_type)
        `)
        .eq('tenant_id', req.user.id);
      
      if (error) throw error;

      // Transform permissions array into object for easier frontend use
      const formattedData = data.map(staff => ({
        ...staff,
        permissions: (staff.team_staff_permissions || []).reduce((acc, p) => {
          acc[p.module_name] = p.access_type;
          return acc;
        }, {})
      }));

      res.json(formattedData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Update permissions (Owner only)
   */
  async updatePermissions(req, res) {
    try {
      const { staffId } = req.params;
      const { permissions } = req.body;
      await StaffService.updatePermissions(req.user.id, staffId, permissions);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  /**
   * Assign Lead to Staff (Owner only)
   */
  async assignLead(req, res) {
    try {
      const { leadId, staffId } = req.body;
      await StaffService.assignLead(req.user.id, leadId, staffId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  /**
   * Assign Conversation to Staff (Owner only)
   */
  async assignConversation(req, res) {
    try {
      const { conversationId, staffId } = req.body;
      await StaffService.assignConversation(req.user.id, conversationId, staffId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  /**
   * Get leads assigned to the logged-in staff member
   */
  async getMyLeads(req, res) {
    try {
      if (!req.staff) {
        return res.status(403).json({ error: 'Only staff can access assigned leads' });
      }
      const { staffId, tenantId } = req.staff;
      const { supabaseAdmin } = require('../../../lib/supabaseClient');
      
      const { data, error } = await supabaseAdmin
        .from('lead_assignments')
        .select(`
          lead_id,
          leads (*)
        `)
        .eq('assigned_to', staffId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Extract the lead objects from the assignment records
      const leads = data.map(item => item.leads).filter(Boolean);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = StaffController;
