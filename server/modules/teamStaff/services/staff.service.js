const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Hash password using PBKDF2
 */
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

/**
 * Verify password
 */
const verifyPassword = (password, storedHash) => {
  const [salt, hash] = storedHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
};
const { supabaseAdmin } = require('../../../lib/supabaseClient');
const { ACCESS_TYPES, MODULES } = require('../constants');

// Custom Repository Implementation using Supabase Admin (Bypassing RLS for management)
const StaffService = {
  /**
   * Create a new staff member
   */
  async createStaff(ownerId, staffData) {
    const { name, email, phone, password, role } = staffData;
    console.log(`🚀 [StaffService] Starting creation for: ${email}, Owner: ${ownerId}`);
    
    // Hash password
    const password_hash = hashPassword(password);
    
    const { data, error } = await supabaseAdmin
      .from('team_staff')
      .insert([{
        tenant_id: ownerId,
        created_by: ownerId,
        name,
        email,
        phone,
        password_hash,
        role: role || 'staff'
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ [StaffService] Table Insert Error:', error);
      throw error;
    }

    console.log(`✅ [StaffService] Staff record created: ${data.id}. Initializing permissions...`);

    // Initialize default permissions (no_access for all)
    const defaultPermissions = MODULES.map(module => ({
      tenant_id: ownerId,
      staff_id: data.id,
      module_name: module,
      access_type: ACCESS_TYPES.NO_ACCESS
    }));

    const { error: permError } = await supabaseAdmin.from('team_staff_permissions').insert(defaultPermissions);
    if (permError) {
      console.error('❌ [StaffService] Permissions Init Error:', permError);
      throw permError;
    }

    console.log(`🎉 [StaffService] Staff member ${email} fully initialized.`);
    return data;
  },

  async login(email, password) {
    console.log(`🔑 [StaffService] Login attempt for: ${email}`);
    
    // 1. Find staff by email
    const { data: staff, error } = await supabaseAdmin
      .from('team_staff')
      .select('*')
      .eq('email', email)
      .eq('status', 'active')
      .single();

    if (error || !staff) {
      console.warn(`⚠️ [StaffService] Login failed: Staff not found or inactive (${email})`);
      throw new Error('Invalid credentials or inactive account');
    }

    console.log(`👤 [StaffService] Staff found: ${staff.id}. Verifying password...`);

    // 2. Verify password
    const isMatch = verifyPassword(password, staff.password_hash);
    if (!isMatch) {
      console.warn(`❌ [StaffService] Login failed: Password mismatch for ${email}`);
      throw new Error('Invalid credentials');
    }

    console.log(`✅ [StaffService] Password verified. Fetching permissions...`);

    // 3. Fetch permissions
    const { data: perms, error: permError } = await supabaseAdmin
      .from('team_staff_permissions')
      .select('module_name, access_type')
      .eq('staff_id', staff.id);

    if (permError) {
      console.error('❌ [StaffService] Login Error fetching permissions:', permError);
    }

    // Ensure perms is an array even if error or null
    const permissionsArray = perms || [];
    
    const permissions = permissionsArray.reduce((acc, p) => {
      acc[p.module_name] = p.access_type;
      return acc;
    }, {});

    console.log(`🎫 [StaffService] Permissions processed: ${Object.keys(permissions).length} modules found.`);

    // 4. Generate JWT
    const token = jwt.sign(
      {
        staffId: staff.id,
        tenantId: staff.tenant_id,
        email: staff.email,
        role: 'staff',
        permissions
      },
      (process.env.JWT_SECRET || 'your-secret-key').trim(),
      { expiresIn: '24h' }
    );

    console.log(`✅ [StaffService] Login successful for ${email}. Returning token.`);

    return {
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions
      }
    };
  },

  /**
   * Update permissions
   */
  async updatePermissions(ownerId, staffId, permissionsUpdate) {
    console.log(`🔐 [StaffService] Updating permissions for Staff: ${staffId}, Owner: ${ownerId}`);
    // permissionsUpdate: { "Inbox": "read", "LeadCRM": "read_write" }
    const updates = Object.entries(permissionsUpdate).map(([module, access]) => ({
      tenant_id: ownerId,
      staff_id: staffId,
      module_name: module,
      access_type: access
    }));

    console.log(`📝 [StaffService] Upserting ${updates.length} permission records...`);

    // Upsert permissions
    const { error } = await supabaseAdmin
      .from('team_staff_permissions')
      .upsert(updates, { onConflict: 'staff_id,module_name' });

    if (error) {
      console.error('❌ [StaffService] Permissions Upsert Error:', error);
      throw error;
    }
    
    console.log('✅ [StaffService] Permissions updated successfully.');
    return true;
  },

  /**
   * Assign Lead
   */
  async assignLead(ownerId, leadId, staffId) {
    const { error } = await supabaseAdmin
      .from('lead_assignments')
      .insert([{
        tenant_id: ownerId,
        lead_id: leadId,
        assigned_to: staffId,
        assigned_by: ownerId
      }]);

    if (error) throw error;
    return true;
  },

  /**
   * Get all assignments for a lead
   */
  async getLeadAssignments(ownerId, leadId) {
    const { data, error } = await supabaseAdmin
      .from('lead_assignments')
      .select(`
        assigned_to,
        team_staff (id, name, email)
      `)
      .eq('lead_id', leadId)
      .eq('tenant_id', ownerId);

    if (error) throw error;
    return data.map(d => d.team_staff).filter(Boolean);
  },

  /**
   * Unassign Lead
   */
  async unassignLead(ownerId, leadId, staffId) {
    const { error } = await supabaseAdmin
      .from('lead_assignments')
      .delete()
      .eq('lead_id', leadId)
      .eq('assigned_to', staffId)
      .eq('tenant_id', ownerId);

    if (error) throw error;
    return true;
  },

  /**
   * Assign Conversation
   */
  async assignConversation(ownerId, conversationId, staffId) {
    const { error } = await supabaseAdmin
      .from('conversations')
      .update({
        assigned_to: staffId
      })
      .eq('id', conversationId)
      .eq('user_id', ownerId); // Ensure owner owns it

    if (error) throw error;
    return true;
  },

  /**
   * Delete staff member
   */
  async deleteStaff(ownerId, staffId) {
    console.log(`🗑️ [StaffService] Deleting Staff: ${staffId}, Owner: ${ownerId}`);
    
    // Deleting from team_staff will CASCADE to team_staff_permissions and lead_assignments
    const { error } = await supabaseAdmin
      .from('team_staff')
      .delete()
      .eq('id', staffId)
      .eq('tenant_id', ownerId);

    if (error) {
      console.error('❌ [StaffService] Error deleting staff:', error);
      throw error;
    }

    console.log('✅ [StaffService] Staff member deleted successfully.');
    return true;
  }
};

module.exports = StaffService;
