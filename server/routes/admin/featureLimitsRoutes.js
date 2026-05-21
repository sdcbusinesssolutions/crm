const express = require('express');
const router = express.Router();
const FeatureLimitsService = require('../../services/FeatureLimitsService');
const requireAuth = require('../../middleware/requireAuth');

// Optional: SuperAdmin check middleware
const requireSuperAdmin = (req, res, next) => {
  // Add your superadmin check logic here based on your auth system
  // Example: if (req.user.role !== 'superadmin') return res.status(403)...
  next();
};

/**
 * @route   GET /api/admin/limits/:feature_name?
 * @desc    Get all custom limits (optionally filtered by feature)
 */
router.get('/:feature_name?', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const featureName = req.params.feature_name;
    const limits = await FeatureLimitsService.listFeatureLimits(featureName);
    res.json(limits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/admin/limits
 * @desc    Create or update a custom limit
 * @body    { feature_name, target_type, target_id, max_limit }
 */
router.post('/', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { feature_name, target_type, target_id, max_limit } = req.body;
    
    if (!feature_name || !['USER', 'DOMAIN'].includes(target_type) || !target_id || max_limit === undefined) {
      return res.status(400).json({ error: 'Invalid payload parameters' });
    }

    const limit = await FeatureLimitsService.setFeatureLimit(feature_name, target_type, target_id, max_limit);
    res.status(201).json(limit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @route   DELETE /api/admin/limits/:id
 * @desc    Delete a custom limit by ID
 */
router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await FeatureLimitsService.deleteFeatureLimit(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
