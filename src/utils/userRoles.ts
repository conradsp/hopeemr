/**
 * Role assignment for project members
 *
 * Roles are stored on ProjectMembership: admin as membership.admin, every other role as an
 * access entry pointing at that role's AccessPolicy (created by scripts/setup-access-policies.ts).
 * Only project admins can write ProjectMembership, so users cannot change their own roles.
 */

import { MedplumClient, getReferenceString } from '@medplum/core';
import type { AccessPolicy, Practitioner, ProjectMembership } from '@medplum/fhirtypes';
import { UserRole } from './permissions';
import { POLICY_ROLES, PolicyRole, buildRoleAccess, getRolePolicyName, isPolicyRole } from '../security/rolePolicies';

export class MissingRolePoliciesError extends Error {
  constructor(missing: PolicyRole[]) {
    super(
      `Role access policies are missing (${missing.join(', ')}). ` +
        'Run scripts/setup-access-policies.ts for this project.'
    );
    this.name = 'MissingRolePoliciesError';
  }
}

/**
 * Load the role AccessPolicies for the current project.
 * @throws MissingRolePoliciesError if any role policy has not been created
 */
export async function getRolePolicies(medplum: MedplumClient): Promise<Record<PolicyRole, AccessPolicy>> {
  // A project has only a handful of policies; fetch them all and match by exact name
  const policies = await medplum.searchResources('AccessPolicy', { _count: '100' });
  const byRole: Partial<Record<PolicyRole, AccessPolicy>> = {};
  for (const role of POLICY_ROLES) {
    const policy = policies.find((p) => p.name === getRolePolicyName(role));
    if (policy) {
      byRole[role] = policy;
    }
  }
  const missing = POLICY_ROLES.filter((role) => !byRole[role]);
  if (missing.length > 0) {
    throw new MissingRolePoliciesError(missing);
  }
  return byRole as Record<PolicyRole, AccessPolicy>;
}

/**
 * Return a copy of the membership with its roles replaced.
 * Access entries that are not HopeEMR role policies are preserved.
 */
export function withRoles(
  membership: ProjectMembership,
  roles: UserRole[],
  policies: Record<PolicyRole, AccessPolicy>
): ProjectMembership {
  const otherAccess = (membership.access ?? []).filter((entry) => !isPolicyRole(entry.policy?.display));
  const roleAccess = roles.filter(isPolicyRole).map((role) => buildRoleAccess(role, policies[role]));
  return {
    ...membership,
    admin: roles.includes(UserRole.ADMIN),
    access: [...otherAccess, ...roleAccess],
  };
}

/**
 * Save a member's roles. Refuses to remove admin from the signed-in user's own membership,
 * which would lock the facility out of user management.
 */
export async function saveMembershipRoles(
  medplum: MedplumClient,
  membership: ProjectMembership,
  roles: UserRole[]
): Promise<ProjectMembership> {
  const isSelf = membership.id !== undefined && membership.id === medplum.getProjectMembership()?.id;
  if (isSelf && membership.admin && !roles.includes(UserRole.ADMIN)) {
    throw new Error('You cannot remove the Administrator role from your own account.');
  }
  const policies = await getRolePolicies(medplum);
  return medplum.updateResource(withRoles(membership, roles, policies));
}

/** Find the membership whose profile is the given practitioner. */
export function findMembershipForProfile(
  memberships: ProjectMembership[],
  practitioner: Practitioner
): ProjectMembership | undefined {
  const ref = getReferenceString(practitioner);
  return memberships.find((m) => m.profile?.reference === ref);
}
