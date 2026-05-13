/**
 * Permission Middleware
 * Checks if the staff member has the required access level for a specific module.
 * 
 * @param {string} moduleName - The name of the module (e.g., 'Inbox', 'Contacts')
 * @param {string} requiredAccess - The required access level ('read', 'read_write', 'all_access')
 */
const requirePermission = (moduleName, requiredAccess = 'read') => {
    return (req, res, next) => {
        // 1. If not a staff member (i.e., owner/admin), allow all
        if (!req.staff) {
            return next();
        }

        const permissions = req.staff.permissions || {};
        
        // Handle case sensitivity or spaces in module names from frontend
        // The frontend might send 'Contact List' but the key might be 'Contact+List' or 'ContactList'
        // We'll try to find a match by cleaning both
        const cleanName = (name) => name.replace(/[\s+]/g, '').toLowerCase();
        const targetClean = cleanName(moduleName);
        
        let currentAccess = 'no_access';
        
        // Search for the permission key
        for (const key of Object.keys(permissions)) {
            if (cleanName(key) === targetClean) {
                currentAccess = permissions[key];
                break;
            }
        }

        const levels = {
            'no_access': 0,
            'read': 1,
            'read_write': 2,
            'all_access': 3
        };

        const currentLevel = levels[currentAccess] || 0;
        const requiredLevel = levels[requiredAccess] || 1;

        if (currentLevel >= requiredLevel) {
            return next();
        }

        return res.status(403).json({
            error: 'Forbidden',
            message: `Insufficient permissions. Required: ${requiredAccess} for ${moduleName}`,
            module: moduleName,
            required: requiredAccess,
            actual: currentAccess
        });
    };
};

const ACCESS_TYPES = {
    NO_ACCESS: 'no_access',
    READ: 'read',
    READ_WRITE: 'read_write',
    ALL_ACCESS: 'all_access'
};

module.exports = requirePermission;
module.exports.requirePermission = requirePermission;
module.exports.ACCESS_TYPES = ACCESS_TYPES;
