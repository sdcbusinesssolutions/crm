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
const FeatureLimitsService = require('../../../services/FeatureLimitsService');

// Custom Repository Implementation using Supabase Admin (Bypassing RLS for management)
const StaffService = {
  /**
   * Create a new staff member
   */
  async createStaff(ownerId, staffData) {
    const { name, email, phone, password, role } = staffData;
    console.log(`🚀 [StaffService] Starting creation for: ${email}, Owner: ${ownerId}`);
    
    // --- Enforce Staff Limit ---
    try {
      // 1. Get current staff count
      const { count, error: countErr } = await supabaseAdmin
        .from('team_staff')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', ownerId);

      if (countErr) throw countErr;

      // 2. Fetch owner domain if possible
      let domainId = null;
      const { data: profile } = await supabaseAdmin.from('profiles').select('signup_domain').eq('id', ownerId).maybeSingle();
      if (profile && profile.signup_domain) domainId = profile.signup_domain;

      // 3. Get allowed limit
      const maxStaffLimit = await FeatureLimitsService.getFeatureLimit(ownerId, domainId, 'STAFF');

      if (count >= maxStaffLimit) {
        throw new Error(`Staff limit reached (${maxStaffLimit}). Please contact support to increase your limit.`);
      }
    } catch (err) {
      if (err.message.includes('limit reached')) throw err;
      console.error('⚠️ [StaffService] Limit check failed/skipped:', err);
    }
    // ----------------------------
    
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
      // Check if this is an owner trying to use staff login
      const { data: owner } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (owner) {
        console.log(`ℹ️ [StaffService] Owner account fallback check for: ${email}`);
        throw new Error('This email belongs to an Owner account. Please use the main Owner login.');
      }

      console.warn(`⚠️ [StaffService] Login failed: Staff not found or inactive (${email})`);
      throw new Error('Invalid credentials or account not found');
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
    
    // Sync Conversation assignment
    try {
      const { data: lead } = await supabaseAdmin.from('leads').select('phone').eq('id', leadId).single();
      if (lead && lead.phone) {
         await supabaseAdmin.from('conversations').update({ assigned_to: staffId }).eq('user_id', ownerId).eq('contact_phone', lead.phone);
      }
    } catch(err) {
      console.error('[StaffService] Error syncing conversation assignment:', err);
    }
    
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
    
    // Sync Conversation unassignment
    try {
      const { data: lead } = await supabaseAdmin.from('leads').select('phone').eq('id', leadId).single();
      if (lead && lead.phone) {
         const { data: assignments } = await supabaseAdmin.from('lead_assignments').select('assigned_to').eq('lead_id', leadId);
         const nextAssigned = (assignments && assignments.length > 0) ? assignments[0].assigned_to : null;
         await supabaseAdmin.from('conversations').update({ assigned_to: nextAssigned }).eq('user_id', ownerId).eq('contact_phone', lead.phone);
      }
    } catch(err) {
      console.error('[StaffService] Error syncing conversation unassignment:', err);
    }
    
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
  },

  /**
   * Update staff member (password, status, role, name, phone)
   */
  async updateStaff(ownerId, staffId, updateData) {
    console.log(`✏️ [StaffService] Updating Staff: ${staffId}, Owner: ${ownerId}`);
    const { password, status, name, phone, role } = updateData;
    const updates = {};
    
    if (password) {
      updates.password_hash = hashPassword(password);
    }
    
    if (status !== undefined) {
      updates.status = status;
    }

    if (name !== undefined) {
      updates.name = name;
    }

    if (phone !== undefined) {
      updates.phone = phone;
    }

    if (role !== undefined) {
      updates.role = role;
    }

    if (Object.keys(updates).length === 0) {
      return null;
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('team_staff')
      .update(updates)
      .eq('id', staffId)
      .eq('tenant_id', ownerId)
      .select()
      .single();

    if (error) {
      console.error('❌ [StaffService] Error updating staff:', error);
      throw error;
    }

    console.log('✅ [StaffService] Staff member updated successfully.');
    return data;
  }
};

module.exports = StaffService;
