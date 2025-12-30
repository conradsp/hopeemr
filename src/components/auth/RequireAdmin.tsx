import { JSX, ReactNode } from 'react';
import { Navigate } from 'react-router';
import { isUserAdmin } from '../../utils/permissionUtils';

interface RequireAdminProps {
  children: ReactNode;
  membership: { admin?: boolean };
  practitioner?: any; // Optional, for future extensibility
}

/**
 * Route protection component that ensures only admin users can access wrapped routes
 * Redirects non-admin users to the home page
 * @param root0 - Props object
 * @param root0.children - The child components to render if admin
 * @param root0.membership - The membership object containing admin status
 * @param root0.practitioner - Optional practitioner profile
 * @returns The children if admin, otherwise a redirect to home
 */
export function RequireAdmin({ children, membership, practitioner }: RequireAdminProps): JSX.Element {
  // Use practitioner from props if provided, otherwise undefined
  if (!isUserAdmin(practitioner, membership)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

