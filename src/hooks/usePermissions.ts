/**
 * React Hooks for Permissions
 *
 * Custom hooks for using permissions in React components.
 * Roles come from the current ProjectMembership (see utils/permissionUtils.ts).
 * These decide what UI to show; the server enforces the role AccessPolicies.
 */

import { useMedplum } from '@medplum/react';
import { Practitioner, ProjectMembership } from '@medplum/fhirtypes';
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

export function useMembership(): ProjectMembership | undefined {
  const medplum = useMedplum();
  return medplum.getProjectMembership();
}

export function useUserRoles(): UserRole[] {
  const membership = useMembership();
  return useMemo(() => getUserRoles(membership), [membership]);
}

export function useUserPermissions(): Permission[] {
  const membership = useMembership();
  return useMemo(() => getUserPermissions(membership), [membership]);
}

export function useHasPermission(permission: Permission): boolean {
  const membership = useMembership();
  return useMemo(() => hasPermission(permission, membership), [permission, membership]);
}

export function useHasAnyPermission(permissions: Permission[]): boolean {
  const membership = useMembership();
  return useMemo(() => hasAnyPermission(permissions, membership), [permissions, membership]);
}

export function useHasAllPermissions(permissions: Permission[]): boolean {
  const membership = useMembership();
  return useMemo(() => hasAllPermissions(permissions, membership), [permissions, membership]);
}

export function useHasRole(role: UserRole): boolean {
  const membership = useMembership();
  return useMemo(() => hasRole(role, membership), [role, membership]);
}

export function useIsAdmin(): boolean {
  const membership = useMembership();
  return useMemo(() => isUserAdmin(membership), [membership]);
}

export function useCanAccessAdmin(): boolean {
  const membership = useMembership();
  return useMemo(() => canAccessAdmin(membership), [membership]);
}

export function useCanAccessBilling(): boolean {
  const membership = useMembership();
  return useMemo(() => canAccessBilling(membership), [membership]);
}

export function useCanAccessScheduling(): boolean {
  const membership = useMembership();
  return useMemo(() => canAccessScheduling(membership), [membership]);
}

export function useFeatureFlags(): FeatureFlags {
  const membership = useMembership();
  return useMemo(() => getFeatureFlags(membership), [membership]);
}

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const flags = useFeatureFlags();
  return flags[flag];
}

/**
 * Hook that returns permission checking utility
 */
export function usePermissions() {
  const membership = useMembership();

  return useMemo(
    () => ({
      hasPermission: (permission: Permission) => hasPermission(permission, membership),
      hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(permissions, membership),
      hasAllPermissions: (permissions: Permission[]) => hasAllPermissions(permissions, membership),
      hasRole: (role: UserRole) => hasRole(role, membership),
      permissions: getUserPermissions(membership),
      roles: getUserRoles(membership),
    }),
    [membership]
  );
}
