import { createContext, useContext } from 'react';

export type UserRole = 'ADMIN' | 'MEMBER';

export type FinancialContext = 'HOUSEHOLD' | 'PERSONAL' | 'INVESTMENT' | 'WORK' | 'CONSOLIDATED' | 'OTHER';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface Permissions {
  isAdmin: boolean;
  isMember: boolean;
  canAccessPersonal: boolean;
  canManageConnections: boolean;
  allowedContexts: FinancialContext[];
  canAccessContext: (ctx: FinancialContext | string) => boolean;
  canViewAccount: (accContextOrId?: string) => boolean;
  canAccessFeature: (feature: string) => boolean;
}

export function computePermissions(user: CurrentUser | null): Permissions {
  if (!user) {
    return {
      isAdmin: false,
      isMember: false,
      canAccessPersonal: false,
      canManageConnections: false,
      allowedContexts: ['HOUSEHOLD'],
      canAccessContext: (ctx) => ctx === 'HOUSEHOLD',
      canViewAccount: () => false,
      canAccessFeature: () => false,
    };
  }

  const isAdmin = user.role === 'ADMIN';

  return {
    isAdmin,
    isMember: user.role === 'MEMBER',
    canAccessPersonal: isAdmin,
    canManageConnections: isAdmin,
    allowedContexts: isAdmin
      ? ['CONSOLIDATED', 'HOUSEHOLD', 'PERSONAL', 'INVESTMENT', 'WORK']
      : ['HOUSEHOLD'],
    canAccessContext: (ctx) => {
      if (isAdmin) return true;
      return ctx === 'HOUSEHOLD' || ctx === 'CONSOLIDATED';
    },
    canViewAccount: () => true,
    canAccessFeature: (feature) => {
      if (isAdmin) return true;
      if (feature === 'admin' || feature === 'connections' || feature === 'reset-data') return false;
      return true;
    },
  };
}

export const PermissionsContext = createContext<Permissions>({
  isAdmin: false,
  isMember: false,
  canAccessPersonal: false,
  canManageConnections: false,
  allowedContexts: ['HOUSEHOLD'],
  canAccessContext: () => false,
  canViewAccount: () => false,
  canAccessFeature: () => false,
});

export function usePermissions(): Permissions {
  return useContext(PermissionsContext);
}
