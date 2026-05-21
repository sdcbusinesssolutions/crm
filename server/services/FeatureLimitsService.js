const { supabaseAdmin } = require('../lib/supabaseClient');

// Centralized configuration for default limits
const DEFAULT_LIMITS = {
  'STAFF': 2,
  'CONTACTS': 500,
  'PIPELINES': 3,
  'FLOWS': 5
};

const FeatureLimitsService = {
  /**
   * Get the allowed limit for a specific feature by applying precedence:
   * Individual User Limit > Domain Limit > Default Limit
   */
  async getFeatureLimit(userId, domainId, featureName) {
    let allowedLimit = DEFAULT_LIMITS[featureName] || 0;

    // 1. Check for Individual User Limit (Highest Priority)
    if (userId) {
      const { data: userLimit, error: userErr } = await supabaseAdmin
        .from('feature_limits')
        .select('max_limit')
        .eq('feature_name', featureName)
        .eq('target_type', 'USER')
        .eq('target_id', userId)
        .maybeSingle();
      
      if (!userErr && userLimit) {
        return userLimit.max_limit;
      }
    }

    // 2. Check for Domain Limit (Medium Priority)
    if (domainId) {
      const { data: domainLimit, error: domainErr } = await supabaseAdmin
        .from('feature_limits')
        .select('max_limit')
        .eq('feature_name', featureName)
        .eq('target_type', 'DOMAIN')
        .eq('target_id', domainId)
        .maybeSingle();

      if (!domainErr && domainLimit) {
        return domainLimit.max_limit;
      }
    }

    // 3. Fallback to Default
    return allowedLimit;
  },

  /**
   * Super Admin function to set/override a limit
   */
  async setFeatureLimit(featureName, targetType, targetId, maxLimit) {
    const { data, error } = await supabaseAdmin
      .from('feature_limits')
      .upsert(
        {
          feature_name: featureName,
          target_type: targetType,
          target_id: targetId,
          max_limit: maxLimit,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'feature_name,target_type,target_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('❌ [FeatureLimitsService] Error setting limit:', error);
      throw error;
    }
    return data;
  },

  /**
   * List custom limits (for Super Admin dashboard)
   */
  async listFeatureLimits(featureName) {
    let query = supabaseAdmin.from('feature_limits').select('*');
    if (featureName) {
      query = query.eq('feature_name', featureName);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  /**
   * Delete a custom limit
   */
  async deleteFeatureLimit(id) {
    const { error } = await supabaseAdmin
      .from('feature_limits')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};

module.exports = FeatureLimitsService;
