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
        
        const cleanName = (name) => name.replace(/[\s+]/g, '').toLowerCase();
        
        const levels = {
            'no_access': 0,
            'read': 1,
            'read_write': 2,
            'all_access': 3
        };

        const requiredLevel = levels[requiredAccess] || 1;

        const checkAccess = (targetModuleName) => {
            const targetClean = cleanName(targetModuleName);
            for (const key of Object.keys(permissions)) {
                if (cleanName(key) === targetClean) {
                    return levels[permissions[key]] || 0;
                }
            }
            return 0;
        };

        const moduleNames = Array.isArray(moduleName) ? moduleName : [moduleName];
        let maxLevel = 0;
        
        for (const mod of moduleNames) {
            const level = checkAccess(mod);
            if (level > maxLevel) {
                maxLevel = level;
            }
        }

        if (maxLevel >= requiredLevel) {
            return next();
        }

        return res.status(403).json({
            error: 'Forbidden',
            message: `Insufficient permissions. Required: ${requiredAccess} for at least one of [${moduleNames.join(', ')}]`,
            module: moduleName,
            required: requiredAccess
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
