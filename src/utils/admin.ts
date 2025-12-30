import { useMedplum } from '@medplum/react';
import { useEffect, useState } from 'react';
import { useMembership } from '../hooks/usePermissions';

/**
 * Checks if the current user is an admin by examining their ProjectMembership.
 * @param membership - The ProjectMembership object
 * @returns A boolean indicating whether the user is an admin
 */
export function isUserAdminFromMembership(membership?: { admin?: boolean }): boolean {
  return membership?.admin === true;
}

/**
 * React hook that provides the admin status of the current user.
 * @returns An object containing the admin status and loading state
 */
export function useAdminStatus(): { isAdmin: boolean; loading: boolean } {
  const membership = useMembership();
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setIsAdminUser(isUserAdminFromMembership(membership));
    setLoading(false);
  }, [membership]);

  return { isAdmin: isAdminUser, loading };
}
