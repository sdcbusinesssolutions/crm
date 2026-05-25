import React from 'react';
import { usePermissions, ACCESS_TYPES } from '../hooks/usePermissions';

interface PermissionGateProps {
  moduleName: string;
  requiredAccess?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  moduleName,
  requiredAccess = ACCESS_TYPES.READ,
  children,
  fallback = null,
  showError = false
}) => {
  const { hasAccess, isStaff } = usePermissions();

  // If not staff (owner), allow all access
  if (!isStaff) return <>{children}</>;

  const allowed = hasAccess(moduleName, requiredAccess);

  if (allowed) {
    return <>{children}</>;
  }

  if (showError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <span>You don't have permission to {requiredAccess.replace('_', ' ')} for {moduleName}.</span>
      </div>
    );
  }

  return <>{fallback}</>;
};

export default PermissionGate;
