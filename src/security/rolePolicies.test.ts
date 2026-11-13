import { describe, it, expect } from 'vitest';
import type { AccessPolicyResource } from '@medplum/fhirtypes';
import { UserRole } from '../utils/permissions';
import {
  POLICY_ROLES,
  buildRolePolicy,
  getRolePolicyName,
  canWrite,
} from './rolePolicies';

const ADMIN_ONLY_TYPES = [
  'Practitioner',
  'PractitionerRole',
  'Organization',
  'Questionnaire',
  'ValueSet',
  'CodeSystem',
  'Schedule',
  'AccessPolicy',
  'ProjectMembership',
  'User',
  'ClientApplication',
];

const CLINICAL_TYPES = [
  'Patient',
  'Encounter',
  'Observation',
  'Condition',
  'Procedure',
  'ClinicalImpression',
  'QuestionnaireResponse',
  'DocumentReference',
  'ServiceRequest',
  'DiagnosticReport',
  'MedicationRequest',
  'MedicationAdministration',
  'DetectedIssue',
  'Task',
  'AuditEvent',
];

function entries(role: (typeof POLICY_ROLES)[number]): AccessPolicyResource[] {
  return buildRolePolicy(role).resource ?? [];
}

describe('rolePolicies', () => {
  it('defines a policy for every non-admin role and none for admin', () => {
    const expected = Object.values(UserRole).filter((r) => r !== UserRole.ADMIN);
    expect([...POLICY_ROLES].sort()).toEqual([...expected].sort());
  });

  it('names each policy after its role', () => {
    for (const role of POLICY_ROLES) {
      expect(buildRolePolicy(role).name).toBe(getRolePolicyName(role));
      expect(getRolePolicyName(role)).toBe(`hopeemr-role-${role}`);
    }
  });

  it('gives every role read-only access to all types and create-only audit', () => {
    for (const role of POLICY_ROLES) {
      expect(entries(role)).toContainEqual({ resourceType: '*', readonly: true });
      expect(canWrite(role, 'AuditEvent', 'create')).toBe(true);
      expect(canWrite(role, 'AuditEvent', 'update')).toBe(false);
      expect(canWrite(role, 'AuditEvent', 'delete')).toBe(false);
    }
  });

  it('never lets a role write admin-only types', () => {
    for (const role of POLICY_ROLES) {
      for (const type of ADMIN_ONLY_TYPES) {
        for (const op of ['create', 'update', 'delete'] as const) {
          expect(canWrite(role, type, op), `${role} ${op} ${type}`).toBe(false);
        }
      }
    }
  });

  it('never lets a role delete clinical records', () => {
    for (const role of POLICY_ROLES) {
      for (const type of CLINICAL_TYPES) {
        expect(canWrite(role, type, 'delete'), `${role} delete ${type}`).toBe(false);
      }
    }
  });

  it('only lets billing change or remove charges; clinical roles may only create them', () => {
    for (const role of POLICY_ROLES) {
      const isBilling = role === UserRole.BILLING;
      expect(canWrite(role, 'ChargeItem', 'update'), role).toBe(isBilling);
      expect(canWrite(role, 'ChargeItem', 'delete'), role).toBe(isBilling);
    }
    expect(canWrite(UserRole.PROVIDER, 'ChargeItem', 'create')).toBe(true);
    expect(canWrite(UserRole.NURSE, 'ChargeItem', 'create')).toBe(true);
    expect(canWrite(UserRole.FRONT_DESK, 'ChargeItem', 'create')).toBe(true);
  });

  it('limits bed writes to bed Locations', () => {
    const bedEntries = entries(UserRole.NURSE).filter((e) => e.resourceType === 'Location');
    expect(bedEntries).toHaveLength(1);
    expect(bedEntries[0].criteria).toBe('Location?physical-type=bd');
    expect(bedEntries[0].interaction).not.toContain('create');
    expect(bedEntries[0].interaction).not.toContain('delete');
  });

  it('matches key cells of the approved write matrix', () => {
    expect(canWrite(UserRole.FRONT_DESK, 'Observation', 'create')).toBe(false);
    expect(canWrite(UserRole.FRONT_DESK, 'Patient', 'create')).toBe(true);
    expect(canWrite(UserRole.NURSE, 'MedicationRequest', 'create')).toBe(false);
    expect(canWrite(UserRole.NURSE, 'Observation', 'create')).toBe(true);
    expect(canWrite(UserRole.PROVIDER, 'MedicationRequest', 'create')).toBe(true);
    expect(canWrite(UserRole.PHARMACY, 'MedicationRequest', 'create')).toBe(false);
    expect(canWrite(UserRole.PHARMACY, 'MedicationRequest', 'update')).toBe(true);
    expect(canWrite(UserRole.PHARMACY, 'Medication', 'delete')).toBe(true);
    expect(canWrite(UserRole.LAB, 'DiagnosticReport', 'create')).toBe(true);
    expect(canWrite(UserRole.LAB, 'ServiceRequest', 'create')).toBe(false);
    expect(canWrite(UserRole.BILLING, 'Patient', 'update')).toBe(false);
    expect(canWrite(UserRole.RADIOLOGY, 'ActivityDefinition', 'delete')).toBe(true);
  });
});
