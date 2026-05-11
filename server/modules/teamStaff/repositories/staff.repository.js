import { pgPool } from '../../../lib/db.js'; // Assuming existing db lib

export const StaffRepository = {
  async createStaff(staffData) {
    const { tenant_id, created_by, name, email, phone, password_hash, role } = staffData;
    const query = `
      INSERT INTO team_staff (tenant_id, created_by, name, email, phone, password_hash, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, role, status, created_at
    `;
    const values = [tenant_id, created_by, name, email, phone, password_hash, role];
    const { rows } = await pgPool.query(query, values);
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await pgPool.query('SELECT * FROM team_staff WHERE email = $1', [email]);
    return rows[0];
  },

  async getStaffByTenant(tenantId) {
    const { rows } = await pgPool.query(
      'SELECT id, name, email, phone, role, status, created_at FROM team_staff WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
    return rows;
  },

  async updateStaff(staffId, tenantId, updateData) {
    const fields = Object.keys(updateData);
    const setClause = fields.map((field, i) => `${field} = $${i + 3}`).join(', ');
    const values = [staffId, tenantId, ...Object.values(updateData)];
    
    const query = `
      UPDATE team_staff 
      SET ${setClause}, updated_at = now() 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, name, email, role, status
    `;
    const { rows } = await pgPool.query(query, values);
    return rows[0];
  },

  async deleteStaff(staffId, tenantId) {
    await pgPool.query('DELETE FROM team_staff WHERE id = $1 AND tenant_id = $2', [staffId, tenantId]);
    return true;
  }
};

export const PermissionRepository = {
  async assignPermissions(tenantId, staffId, permissions) {
    // permissions: [{ module_name, access_type }]
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      
      // Clear existing permissions for this staff
      await client.query('DELETE FROM team_staff_permissions WHERE staff_id = $1 AND tenant_id = $2', [staffId, tenantId]);
      
      // Insert new permissions
      for (const p of permissions) {
        await client.query(
          'INSERT INTO team_staff_permissions (tenant_id, staff_id, module_name, access_type) VALUES ($1, $2, $3, $4)',
          [tenantId, staffId, p.module_name, p.access_type]
        );
      }
      
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async getStaffPermissions(staffId, tenantId) {
    const { rows } = await pgPool.query(
      'SELECT module_name, access_type FROM team_staff_permissions WHERE staff_id = $1 AND tenant_id = $2',
      [staffId, tenantId]
    );
    return rows.reduce((acc, curr) => {
      acc[curr.module_name] = curr.access_type;
      return acc;
    }, {});
  }
};

export const LeadAssignmentRepository = {
  async assignLead(tenantId, leadId, assignedTo, assignedBy) {
    const query = `
      INSERT INTO lead_assignments (tenant_id, lead_id, assigned_to, assigned_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (lead_id, assigned_to) DO NOTHING
      RETURNING id
    `;
    const { rows } = await pgPool.query(query, [tenantId, leadId, assignedTo, assignedBy]);
    return rows[0];
  },

  async getAssignedLeads(staffId, tenantId) {
    const query = `
      SELECT l.* 
      FROM leads l
      JOIN lead_assignments la ON l.id = la.lead_id
      WHERE la.assigned_to = $1 AND la.tenant_id = $2
    `;
    const { rows } = await pgPool.query(query, [staffId, tenantId]);
    return rows;
  }
};
