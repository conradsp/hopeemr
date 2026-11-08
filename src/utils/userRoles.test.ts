import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockClient } from '@medplum/mock';
import { createReference } from '@medplum/core';
import type { AccessPolicy, ProjectMembership } from '@medplum/fhirtypes';
import { UserRole } from './permissions';
import { getUserRoles } from './permissionUtils';
import { POLICY_ROLES, buildRolePolicy } from '../security/rolePolicies';
import {
  MissingRolePoliciesError,
  findMembershipForProfile,
  getRolePolicies,
  saveMembershipRoles,
  withRoles,
} from './userRoles';

async function createAllPolicies(medplum: MockClient): Promise<void> {
  for (const role of POLICY_ROLES) {
    await medplum.createResource(buildRolePolicy(role));
  }
}

describe('userRoles', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  it('loads one policy per role', async () => {
    await createAllPolicies(medplum);
    const policies = await getRolePolicies(medplum);
    for (const role of POLICY_ROLES) {
      expect(policies[role].name).toBe(`hopeemr-role-${role}`);
    }
  });

  it('reports missing role policies clearly', async () => {
    await expect(getRolePolicies(medplum)).rejects.toBeInstanceOf(MissingRolePoliciesError);
  });

  it('round-trips roles through a membership', async () => {
    await createAllPolicies(medplum);
    const policies = await getRolePolicies(medplum);
    const membership: ProjectMembership = {
      resourceType: 'ProjectMembership',
      project: { reference: 'Project/p1' },
      user: { reference: 'User/u1' },
      profile: { reference: 'Practitioner/pr1' },
    };

    const updated = withRoles(membership, [UserRole.NURSE, UserRole.PHARMACY], policies);
    expect(updated.admin).toBe(false);
    expect(getUserRoles(updated)).toEqual([UserRole.NURSE, UserRole.PHARMACY]);
    expect(updated.access?.[0].policy.reference).toBe(`AccessPolicy/${policies[UserRole.NURSE].id}`);

    const asAdmin = withRoles(updated, [UserRole.ADMIN], policies);
    expect(asAdmin.admin).toBe(true);
    expect(asAdmin.access).toEqual([]);
    expect(getUserRoles(asAdmin)).toEqual([UserRole.ADMIN]);
  });

  it('preserves access entries that are not HopeEMR roles', async () => {
    await createAllPolicies(medplum);
    const policies = await getRolePolicies(medplum);
    const custom: AccessPolicy = await medplum.createResource({ resourceType: 'AccessPolicy', name: 'custom' });
    const membership: ProjectMembership = {
      resourceType: 'ProjectMembership',
      project: { reference: 'Project/p1' },
      user: { reference: 'User/u1' },
      profile: { reference: 'Practitioner/pr1' },
      access: [{ policy: createReference(custom) }],
    };
    const updated = withRoles(membership, [UserRole.LAB], policies);
    expect(updated.access).toHaveLength(2);
    expect(updated.access?.[0].policy.reference).toBe(`AccessPolicy/${custom.id}`);
  });

  it('ignores roles a user could not have been granted by a policy', () => {
    expect(
      getUserRoles({ access: [{ policy: { reference: 'AccessPolicy/x', display: 'superuser' } }] })
    ).toEqual([]);
    expect(getUserRoles(undefined)).toEqual([]);
  });

  it('refuses to remove admin from your own membership', async () => {
    await createAllPolicies(medplum);
    const own: ProjectMembership = {
      resourceType: 'ProjectMembership',
      id: 'self',
      admin: true,
      project: { reference: 'Project/p1' },
      user: { reference: 'User/u1' },
      profile: { reference: 'Practitioner/pr1' },
    };
    vi.spyOn(medplum, 'getProjectMembership').mockReturnValue(own);
    await expect(saveMembershipRoles(medplum, own, [UserRole.PROVIDER])).rejects.toThrow(/own account/);
  });

  it('finds the membership for a practitioner', () => {
    const memberships: ProjectMembership[] = [
      {
        resourceType: 'ProjectMembership',
        project: { reference: 'Project/p1' },
        user: { reference: 'User/u1' },
        profile: { reference: 'Practitioner/a' },
      },
      {
        resourceType: 'ProjectMembership',
        project: { reference: 'Project/p1' },
        user: { reference: 'User/u2' },
        profile: { reference: 'Practitioner/b' },
      },
    ];
    expect(findMembershipForProfile(memberships, { resourceType: 'Practitioner', id: 'b' })?.user.reference).toBe(
      'User/u2'
    );
    expect(findMembershipForProfile(memberships, { resourceType: 'Practitioner', id: 'c' })).toBeUndefined();
  });
});
