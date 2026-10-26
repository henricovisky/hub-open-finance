import React from 'react';
import { usePermissions, FinancialContext } from '@/lib/permissions';

interface PermissionGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAdmin?: boolean;
  context?: FinancialContext;
  accountId?: string;
  feature?: string;
}

export function PermissionGate({
  children,
  fallback = null,
  requireAdmin,
  context,
  accountId,
  feature,
}: PermissionGateProps) {
  const { isAdmin, canAccessContext, canViewAccount, canAccessFeature } = usePermissions();

  if (requireAdmin && !isAdmin) {
    return <>{fallback}</>;
  }

  if (context && !canAccessContext(context)) {
    return <>{fallback}</>;
  }

  if (accountId && !canViewAccount(accountId)) {
    return <>{fallback}</>;
  }

  if (feature && !canAccessFeature(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
