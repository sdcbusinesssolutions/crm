import { useState, useEffect } from 'react';

export const ACCESS_TYPES = {
  NO_ACCESS: 'no_access',
  READ: 'read',
  READ_WRITE: 'read_write',
  ALL_ACCESS: 'all_access'
};

const ACCESS_LEVELS: Record<string, number> = {
  [ACCESS_TYPES.NO_ACCESS]: 0,
  [ACCESS_TYPES.READ]: 1,
  [ACCESS_TYPES.READ_WRITE]: 2,
  [ACCESS_TYPES.ALL_ACCESS]: 3
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
      setIsStaff(false);
    }
  }, []);

  const hasAccess = (moduleName: string, requiredAccess: string = ACCESS_TYPES.READ) => {
    // 1. Owner Bypassing
    if (!isStaff) return true;
    
    // 2. Resolve current access for the module
    const currentAccess = permissions?.[moduleName] || ACCESS_TYPES.NO_ACCESS;
    
    // 3. Compare using numeric levels for precision
    const currentLevel = ACCESS_LEVELS[currentAccess] || 0;
    const requiredLevel = ACCESS_LEVELS[requiredAccess] || 1;
    
    return currentLevel >= requiredLevel;
  };

  const canWrite = (moduleName: string) => hasAccess(moduleName, ACCESS_TYPES.READ_WRITE);

  return { permissions, isStaff, hasAccess, canWrite };
};
