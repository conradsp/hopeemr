import type { AccessPolicy, ProjectMembership } from '@medplum/fhirtypes';
import { describe, expect, it } from 'vitest';
import { getUserRoles, withSessionRoles } from './permissionUtils';
import { UserRole } from './permissions';

// Shape Medplum 5 returns from /auth/me for a non-admin user: `access` is stripped
const sessionMembership: ProjectMembership = {
  resourceType: 'ProjectMembership',
  id: 'm1',
  project: { reference: 'Project/p1' },
  user: { reference: 'User/u1' },
  profile: { reference: 'Practitioner/pr1' },
};

const nursePolicy: AccessPolicy = {
  resourceType: 'AccessPolicy',
  basedOn: [{ reference: 'AccessPolicy/a1', display: 'nurse' }],
};

describe('withSessionRoles', () => {
  it('restores roles from the session access policy when the membership has no access', () => {
    const membership = withSessionRoles(sessionMembership, nursePolicy);
    expect(getUserRoles(membership)).toEqual([UserRole.NURSE]);
  });

  it('keeps access already on the membership', () => {
    const withAccess: ProjectMembership = {
      ...sessionMembership,
      access: [{ policy: { reference: 'AccessPolicy/a2', display: 'pharmacy' } }],
    };
    expect(getUserRoles(withSessionRoles(withAccess, nursePolicy))).toEqual([UserRole.PHARMACY]);
  });

  it('ignores policies that are not HopeEMR roles', () => {
    const adminPolicy: AccessPolicy = {
      resourceType: 'AccessPolicy',
      basedOn: [{ reference: 'AccessPolicy/a3', display: 'Default Admin Access Policy' }],
    };
    const admin = withSessionRoles({ ...sessionMembership, admin: true }, adminPolicy);
    expect(getUserRoles(admin)).toEqual([UserRole.ADMIN]);
  });

  it('gives no roles without a membership or access policy', () => {
    expect(withSessionRoles(undefined, nursePolicy)).toBeUndefined();
    expect(getUserRoles(withSessionRoles(sessionMembership, undefined))).toEqual([]);
  });

  it('does not mutate the session membership', () => {
    withSessionRoles(sessionMembership, nursePolicy);
    expect(sessionMembership.access).toBeUndefined();
  });
});
