import { useState, useEffect } from 'react';

export const ACCESS_TYPES = {
  READ: 'read',
  READ_WRITE: 'read_write',
  NO_ACCESS: 'no_access',
  ALL_ACCESS: 'all_access'
};

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<any>(null);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    const staffData = localStorage.getItem('staffData');
    if (staffData) {
      const parsed = JSON.parse(staffData);
      setPermissions(parsed.permissions || {});
      setIsStaff(true);
    } else {
      // If no staff data, assume owner (all access)
      setIsStaff(false);
    }
  }, []);

  const hasAccess = (moduleName: string, requiredAccess: string = ACCESS_TYPES.READ) => {
    if (!isStaff) return true; // Owner bypass
    
    const access = permissions?.[moduleName] || ACCESS_TYPES.NO_ACCESS;
    
    if (access === ACCESS_TYPES.NO_ACCESS) return false;
    if (access === ACCESS_TYPES.ALL_ACCESS) return true;
    
    if (requiredAccess === ACCESS_TYPES.READ_WRITE) {
      return access === ACCESS_TYPES.READ_WRITE;
    }
    
    return true; // Has read or read_write
  };

  return { permissions, isStaff, hasAccess };
};
