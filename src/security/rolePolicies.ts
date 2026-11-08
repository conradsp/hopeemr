/**
 * Server-side role policies
 *
 * One Medplum AccessPolicy per non-admin role. These are the authority for what each role may
 * write; the client-side permissions in utils/permissions.ts only decide which UI to show.
 * Admins have ProjectMembership.admin = true and no policy (full project access).
 *
 * Read scope is open (every role can read every type it may see), writes are strict.
 * See docs/superpowers/specs/2026-11-07-server-side-authorization-design.md
 */

import { createReference } from '@medplum/core';
import type { AccessPolicy, AccessPolicyResource, ProjectMembershipAccess } from '@medplum/fhirtypes';
import { UserRole } from '../utils/permissions';

export type PolicyRole = Exclude<UserRole, UserRole.ADMIN>;
export type WriteOperation = 'create' | 'update' | 'delete';
type Interaction = NonNullable<AccessPolicyResource['interaction']>[number];

export const POLICY_ROLES: readonly PolicyRole[] = [
  UserRole.PROVIDER,
  UserRole.NURSE,
  UserRole.PHARMACY,
  UserRole.LAB,
  UserRole.RADIOLOGY,
  UserRole.BILLING,
  UserRole.FRONT_DESK,
];

const READ: Interaction[] = ['read', 'vread', 'search', 'history'];

const WRITES = {
  C: ['create'],
  U: ['update'],
  CU: ['create', 'update'],
  CUD: ['create', 'update', 'delete'],
} as const satisfies Record<string, WriteOperation[]>;

function write(resourceType: string, ops: keyof typeof WRITES, criteria?: string): AccessPolicyResource {
  return {
    resourceType,
    interaction: [...READ, ...WRITES[ops]],
    ...(criteria ? { criteria } : {}),
  };
}

const OPEN_READ: AccessPolicyResource = { resourceType: '*', readonly: true };
const AUDIT = write('AuditEvent', 'C');
// Beds only; departments (physical-type=wa) stay admin-only
const BEDS = write('Location', 'U', 'Location?physical-type=bd');

/** Write grants per role. Mirrors the approved write matrix in the spec. */
const ROLE_WRITES: Record<PolicyRole, AccessPolicyResource[]> = {
  [UserRole.PROVIDER]: [
    write('Patient', 'CU'),
    write('Coverage', 'CU'),
    write('Encounter', 'CU'),
    write('Appointment', 'CU'),
    write('Slot', 'U'),
    write('Task', 'CU'),
    write('Observation', 'CU'),
    write('Condition', 'CU'),
    write('Procedure', 'CU'),
    write('ClinicalImpression', 'CU'),
    write('QuestionnaireResponse', 'CU'),
    write('DocumentReference', 'CU'),
    write('Binary', 'C'),
    write('ServiceRequest', 'CU'),
    write('MedicationRequest', 'CU'),
    write('MedicationAdministration', 'CU'),
    write('DetectedIssue', 'CU'),
    BEDS,
    write('ChargeItem', 'C'),
  ],
  [UserRole.NURSE]: [
    write('Encounter', 'U'),
    write('Task', 'CU'),
    write('Observation', 'CU'),
    write('MedicationAdministration', 'CU'),
    write('DetectedIssue', 'CU'),
    BEDS,
    write('ChargeItem', 'C'),
  ],
  [UserRole.PHARMACY]: [
    write('MedicationRequest', 'U'),
    write('MedicationAdministration', 'CU'),
    write('Medication', 'CUD'),
    write('MedicationKnowledge', 'CUD'),
    write('ChargeItem', 'C'),
  ],
  [UserRole.LAB]: [
    write('Observation', 'CU'),
    write('DocumentReference', 'CU'),
    write('Binary', 'C'),
    write('ServiceRequest', 'U'),
    write('DiagnosticReport', 'CU'),
    write('ActivityDefinition', 'CUD'),
    write('ChargeItem', 'C'),
  ],
  [UserRole.RADIOLOGY]: [
    write('Observation', 'CU'),
    write('DocumentReference', 'CU'),
    write('Binary', 'C'),
    write('ServiceRequest', 'U'),
    write('DiagnosticReport', 'CU'),
    write('ActivityDefinition', 'CUD'),
    write('ChargeItem', 'C'),
  ],
  [UserRole.BILLING]: [
    write('Coverage', 'CU'),
    write('ChargeItem', 'CUD'),
    write('Account', 'CU'),
  ],
  [UserRole.FRONT_DESK]: [
    write('Patient', 'CU'),
    write('Coverage', 'CU'),
    write('Encounter', 'CU'),
    write('Appointment', 'CU'),
    write('Slot', 'U'),
    write('Task', 'CU'),
    write('ChargeItem', 'C'),
    write('Account', 'CU'),
  ],
};

export function getRolePolicyName(role: PolicyRole): string {
  return `hopeemr-role-${role}`;
}

export function buildRolePolicy(role: PolicyRole): AccessPolicy {
  return {
    resourceType: 'AccessPolicy',
    name: getRolePolicyName(role),
    resource: [OPEN_READ, AUDIT, ...ROLE_WRITES[role]],
  };
}

/**
 * Whether the role's policy grants a write. Evaluates our policy data only (criteria are
 * ignored); the integration test checks the real Medplum server agrees.
 */
export function canWrite(role: PolicyRole, resourceType: string, op: WriteOperation): boolean {
  return (buildRolePolicy(role).resource ?? []).some(
    (entry) => entry.resourceType === resourceType && !entry.readonly && (entry.interaction ?? []).includes(op)
  );
}

/**
 * Membership access entry for a role. `display` carries the role code so the client can read
 * roles synchronously from the membership; the server enforces the referenced policy.
 */
export function buildRoleAccess(role: PolicyRole, policy: AccessPolicy): ProjectMembershipAccess {
  return { policy: { ...createReference(policy), display: role } };
}

export function isPolicyRole(value: string | undefined): value is PolicyRole {
  return POLICY_ROLES.includes(value as PolicyRole);
}
