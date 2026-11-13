import { JSX, ReactNode } from 'react';
import { Navigate } from 'react-router';
import { isUserAdmin } from '../../utils/permissionUtils';
import type { MembershipRoles } from '../../utils/permissionUtils';

interface RequireAdminProps {
  children: ReactNode;
  membership: MembershipRoles | null | undefined;
}

/**
 * Route protection component that ensures only admin users can access wrapped routes
 * Redirects non-admin users to the home page
 * @param root0 - Props object
 * @param root0.children - The child components to render if admin
 * @param root0.membership - The membership object containing admin status
 * @returns The children if admin, otherwise a redirect to home
 */
export function RequireAdmin({ children, membership }: RequireAdminProps): JSX.Element {
  if (!isUserAdmin(membership)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

