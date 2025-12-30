/**
 * React Hooks for Permissions
 * 
 * Custom hooks for using permissions in React components
 */

import { useMedplum } from '@medplum/react';
import { Practitioner } from '@medplum/fhirtypes';
import { useMemo } from 'react';
import {
  getUserRoles,
  getUserPermissions,
  hasPermission,
  hasRole,
  hasAnyPermission,
  hasAllPermissions,
  getFeatureFlags,
  isUserAdmin,
  canAccessAdmin,
  canAccessBilling,
  canAccessScheduling,
} from '../utils/permissionUtils';
import { UserRole, Permission } from '../utils/permissions';
import type { FeatureFlags } from '../utils/permissionUtils';

export function useCurrentUser(): Practitioner | null {
  const medplum = useMedplum();
  const profile = medplum.getProfile();
  if (profile?.resourceType === 'Practitioner') {
    return profile as Practitioner;
  }
  return null;
}

export function useMembership(): { admin?: boolean } | undefined {
  const medplum = useMedplum();
  // Use the correct method to get membership from MedplumClient
  const membership = medplum.getProjectMembership ? medplum.getProjectMembership() : undefined;
  return membership;
}

export function useUserRoles(): UserRole[] {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => getUserRoles(user), [user, membership]);
}

export function useUserPermissions(): Permission[] {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => getUserPermissions(user, membership), [user, membership]);
}

export function useHasPermission(permission: Permission): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => hasPermission(user, permission, membership), [user, permission, membership]);
}

export function useHasAnyPermission(permissions: Permission[]): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => hasAnyPermission(user, permissions, membership), [user, permissions, membership]);
}

export function useHasAllPermissions(permissions: Permission[]): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => hasAllPermissions(user, permissions, membership), [user, permissions, membership]);
}

export function useHasRole(role: UserRole): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => hasRole(user, role, membership), [user, role, membership]);
}

export function useIsAdmin(): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => isUserAdmin(user, membership), [user, membership]);
}

export function useCanAccessAdmin(): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => canAccessAdmin(user, membership), [user, membership]);
}

export function useCanAccessBilling(): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => canAccessBilling(user, membership), [user, membership]);
}

export function useCanAccessScheduling(): boolean {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => canAccessScheduling(user, membership), [user, membership]);
}

export function useFeatureFlags(): FeatureFlags {
  const user = useCurrentUser();
  const membership = useMembership();
  return useMemo(() => getFeatureFlags(user, membership), [user, membership]);
}

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const flags = useFeatureFlags();
  return flags[flag];
}

/**
 * Hook that returns permission checking utility
 */
export function usePermissions() {
  const user = useCurrentUser();
  const membership = useMembership();

  return useMemo(
    () => ({
      hasPermission: (permission: Permission) => hasPermission(user, permission, membership),
      hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(user, permissions, membership),
      hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(user, permissions, membership),
      hasRole: (role: UserRole) => hasRole(user, role, membership),
      permissions: getUserPermissions(user, membership),
      roles: getUserRoles(user),
    }),
    [user, membership]
  );
}

