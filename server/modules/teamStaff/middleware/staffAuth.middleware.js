const jwt = require('jsonwebtoken');
const { ACCESS_TYPES } = require('../constants');

/**
 * Middleware to authenticate staff members using a separate token/logic
 * If the user is an owner (existing auth), it allows bypass to manage staff
 */
const authenticateStaff = async (req, res, next) => {
  try {
    // Check for token in headers
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token (using existing JWT secret for consistency, but with staff payload)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Attach staff info to request
    req.staff = decoded; // Should contain staffId, tenantId, email, role
    req.user = { id: decoded.tenantId }; // For tenant-safety compatibility with existing logic
    
    next();
  } catch (error) {
    console.error('Staff Auth Error:', error);
    return res.status(401).json({ error: 'Unauthorized staff access' });
  }
};

/**
 * Middleware to check specific module permissions
 * @param {string} moduleName - Name of the module to check
 * @param {string} requiredAccess - Minimum access required (read or read_write)
 */
const checkModulePermission = (moduleName, requiredAccess) => {
  return async (req, res, next) => {
    // If user is owner, they have all access
    if (req.user && !req.staff) {
      return next();
    }

    const permissions = req.staff?.permissions || {};
    const staffAccess = permissions[moduleName] || ACCESS_TYPES.NO_ACCESS;

    if (staffAccess === ACCESS_TYPES.NO_ACCESS) {
      return res.status(403).json({ error: `Access denied to ${moduleName}` });
    }

    if (requiredAccess === ACCESS_TYPES.READ_WRITE) {
      if (staffAccess !== ACCESS_TYPES.READ_WRITE && staffAccess !== ACCESS_TYPES.ALL_ACCESS) {
        return res.status(403).json({ error: `Write access denied to ${moduleName}` });
      }
    }

    next();
  };
};

module.exports = {
  authenticateStaff,
  checkModulePermission
};
