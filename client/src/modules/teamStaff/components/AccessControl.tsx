import React from 'react';
import { usePermissions, ACCESS_TYPES } from '../hooks/usePermissions';

interface Props {
  module: string;
  requiredAccess?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Higher-order component to control access to specific UI elements
 */
export const AccessControl: React.FC<Props> = ({ 
  module, 
  requiredAccess = ACCESS_TYPES.READ, 
  fallback = null, 
  children 
}) => {
  const { hasAccess } = usePermissions();

  if (!hasAccess(module, requiredAccess)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
