const express = require('express');
const router = express.Router();
const FeatureLimitsService = require('../../services/FeatureLimitsService');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const domainToUUID = require('../../utils/domainUUID');

/**
 * @route   GET /api/admin/limits/targets/lookup
 * @desc    Get list of users and domains for dropdowns
 */
router.get('/targets/lookup', verifyAdminToken, async (req, res) => {
  try {
    const { domain } = req.query;

    // Fetch all users to extract all domains (cheap enough for now, or just use RPC)
    const { data: allUsers, error: allUserError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, signup_domain')
      .order('created_at', { ascending: false });

    if (allUserError) throw allUserError;

    // Extract unique domains from ALL users so the dropdown always has full list
    const uniqueDomains = new Set();
    allUsers.forEach(u => {
      if (u.signup_domain) uniqueDomains.add(u.signup_domain);
    });
    const domainsList = Array.from(uniqueDomains).map(d => ({ id: d, domain: d }));

    // Now filter the users if a domain was requested
    let filteredUsers = allUsers;
    if (domain) {
      filteredUsers = allUsers.filter(u => u.signup_domain === domain);
    }

    res.json({
      users: filteredUsers || [],
      domains: domainsList
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   GET /api/admin/limits/features
 * @desc    Get all available feature modules
 */
router.get('/features', verifyAdminToken, (req, res) => {
  res.json(FeatureLimitsService.getAvailableFeatures());
});

/**
 * @route   GET /api/admin/limits/:feature_name?
 * @desc    Get all custom limits (optionally filtered by feature)
 */
router.get('/:feature_name?', verifyAdminToken, async (req, res) => {
  try {
    const featureName = req.params.feature_name;
    const limits = await FeatureLimitsService.listFeatureLimits(featureName);

    // Build reverse map to display domain strings instead of UUIDs
    const { data: allUsers } = await supabaseAdmin.from('profiles').select('signup_domain');
    const uuidToDomainMap = {};
    if (allUsers) {
      allUsers.forEach(u => {
        if (u.signup_domain) {
          uuidToDomainMap[domainToUUID(u.signup_domain)] = u.signup_domain;
        }
      });
    }

    const enrichedLimits = limits.map(limit => {
      if (limit.target_type === 'DOMAIN') {
        return {
          ...limit,
          target_id: uuidToDomainMap[limit.target_id] || limit.target_id
        };
      }
      return limit;
    });

    res.json(enrichedLimits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/admin/limits
 * @desc    Create or update a custom limit
 * @body    { feature_name, target_type, target_id, max_limit }
 */
router.post('/', verifyAdminToken, async (req, res) => {
  try {
    let { feature_name, target_type, target_id, max_limit } = req.body;
    
    if (!feature_name || !['USER', 'DOMAIN'].includes(target_type) || !target_id || max_limit === undefined) {
      return res.status(400).json({ error: 'Invalid payload parameters' });
    }

    if (target_type === 'DOMAIN') {
      target_id = domainToUUID(target_id);
    }

    const newLimit = await FeatureLimitsService.setFeatureLimit(feature_name, target_type, target_id, max_limit);
    res.status(201).json(newLimit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   DELETE /api/admin/limits/:id
 * @desc    Delete a custom limit by ID
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
  try {
    const { id } = req.params;
    await FeatureLimitsService.deleteFeatureLimit(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
