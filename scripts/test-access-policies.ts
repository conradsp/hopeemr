/**
 * Integration test: prove the Medplum server enforces the role AccessPolicies.
 *
 * For each role, creates a throwaway ClientApplication whose ProjectMembership carries that
 * role's policy (the same mechanism user memberships use), signs in as it, and attempts a set
 * of reads and writes. Each attempt must succeed exactly when the policy allows it. Everything
 * created is removed afterwards.
 *
 * Run against a dev or scratch Project, never a live facility:
 *   MEDPLUM_BASE_URL=... MEDPLUM_CLIENT_ID=... MEDPLUM_CLIENT_SECRET=... npm run policies:test
 *
 * Exit code 0 = every expectation held. Requires setup-access-policies.ts to have run.
 */

import { MedplumClient, OperationOutcomeError, createReference, getReferenceString, getStatus } from '@medplum/core';
import type { ChargeItem, ClientApplication, Location, Observation, Patient, Practitioner, ProjectMembership, Resource } from '@medplum/fhirtypes';
import { POLICY_ROLES, PolicyRole, WriteOperation, buildRoleAccess, canWrite } from '../src/security/rolePolicies';
import { getRolePolicies } from '../src/utils/userRoles';
import { createAdminClient, getProjectId } from './lib/medplumAdmin';

type Outcome = 'allowed' | 'denied';

interface Probe {
  label: string;
  expected: (role: PolicyRole) => boolean;
  run: (client: MedplumClient, membership: ProjectMembership) => Promise<unknown>;
}

const LOCATION_TYPE = 'http://terminology.hl7.org/CodeSystem/location-physical-type';

function policy(type: string, op: WriteOperation): (role: PolicyRole) => boolean {
  return (role) => canWrite(role, type, op);
}

async function attempt(fn: () => Promise<unknown>): Promise<Outcome> {
  try {
    await fn();
    return 'allowed';
  } catch (error) {
    if (error instanceof OperationOutcomeError && getStatus(error.outcome) === 403) {
      return 'denied';
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const admin = await createAdminClient();
  const projectId = getProjectId(admin);
  const policies = await getRolePolicies(admin);
  const cleanup: Resource[] = [];

  async function adminCreate<T extends Resource>(resource: T): Promise<T> {
    const created = await admin.createResource(resource);
    cleanup.push(created);
    return created;
  }

  const patient = await adminCreate<Patient>({ resourceType: 'Patient', name: [{ family: 'PolicyTest' }] });
  const subject = createReference(patient);
  const location = (code: string): Location => ({
    resourceType: 'Location',
    name: `PolicyTest ${code}`,
    physicalType: { coding: [{ system: LOCATION_TYPE, code }] },
  });

  // Every write probe creates its own fixture so roles cannot interfere with each other.
  const probes: Probe[] = [
    { label: 'read Patient', expected: () => true, run: (c) => c.readResource('Patient', patient.id as string) },
    {
      label: 'create Patient',
      expected: policy('Patient', 'create'),
      run: (c) => c.createResource({ resourceType: 'Patient', name: [{ family: 'PolicyTest' }] }),
    },
    {
      label: 'create Observation',
      expected: policy('Observation', 'create'),
      run: (c) => c.createResource({ resourceType: 'Observation', status: 'final', code: { text: 'test' }, subject }),
    },
    {
      label: 'delete Observation',
      expected: policy('Observation', 'delete'),
      run: async (c) => {
        const obs = await adminCreate<Observation>({ resourceType: 'Observation', status: 'final', code: { text: 'test' }, subject });
        return c.deleteResource('Observation', obs.id as string);
      },
    },
    {
      label: 'create MedicationRequest',
      expected: policy('MedicationRequest', 'create'),
      run: (c) =>
        c.createResource({
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          subject,
          medicationCodeableConcept: { text: 'test' },
        }),
    },
    {
      label: 'create DiagnosticReport',
      expected: policy('DiagnosticReport', 'create'),
      run: (c) => c.createResource({ resourceType: 'DiagnosticReport', status: 'final', code: { text: 'test' }, subject }),
    },
    {
      label: 'create ChargeItem',
      expected: policy('ChargeItem', 'create'),
      run: (c) => c.createResource({ resourceType: 'ChargeItem', status: 'billable', code: { text: 'test' }, subject }),
    },
    {
      label: 'update ChargeItem',
      expected: policy('ChargeItem', 'update'),
      run: async (c) => {
        const charge = await adminCreate<ChargeItem>({ resourceType: 'ChargeItem', status: 'billable', code: { text: 'test' }, subject });
        return c.updateResource({ ...charge, status: 'not-billable' });
      },
    },
    {
      label: 'update bed Location',
      expected: policy('Location', 'update'),
      run: async (c) => {
        const bed = await adminCreate(location('bd'));
        return c.updateResource({ ...bed, description: 'updated' });
      },
    },
    {
      label: 'update department Location',
      expected: () => false,
      run: async (c) => {
        const ward = await adminCreate(location('wa'));
        return c.updateResource({ ...ward, description: 'updated' });
      },
    },
    {
      label: 'update Practitioner',
      expected: policy('Practitioner', 'update'),
      run: async (c) => {
        const practitioner = await adminCreate<Practitioner>({ resourceType: 'Practitioner', name: [{ family: 'PolicyTest' }] });
        return c.updateResource({ ...practitioner, active: false });
      },
    },
    {
      label: 'create AccessPolicy',
      expected: policy('AccessPolicy', 'create'),
      run: (c) => c.createResource({ resourceType: 'AccessPolicy', name: 'policy-test-escalation' }),
    },
    {
      label: 'grant self admin',
      expected: () => false,
      run: (c, membership) => c.updateResource({ ...membership, admin: true, access: [] }),
    },
  ];

  const failures: string[] = [];
  const clients: ClientApplication[] = [];

  try {
    for (const role of POLICY_ROLES) {
      const client = (await admin.post(`admin/projects/${projectId}/client`, {
        name: `policy-test-${role}`,
        description: 'Temporary client created by scripts/test-access-policies.ts',
      })) as ClientApplication;
      clients.push(client);

      const membership = await admin.searchOne('ProjectMembership', { profile: getReferenceString(client) });
      if (!membership) {
        throw new Error(`No membership created for client ${client.id}`);
      }
      const roleMembership = await admin.updateResource<ProjectMembership>({
        ...membership,
        admin: false,
        access: [buildRoleAccess(role, policies[role])],
      });

      const roleClient = new MedplumClient({ baseUrl: admin.getBaseUrl() });
      await roleClient.startClientLogin(client.id as string, client.secret as string);

      for (const probe of probes) {
        const expected: Outcome = probe.expected(role) ? 'allowed' : 'denied';
        let actual: Outcome | string;
        try {
          actual = await attempt(() => probe.run(roleClient, roleMembership));
        } catch (error) {
          actual = `error: ${error instanceof Error ? error.message : String(error)}`;
        }
        const ok = actual === expected;
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${role.padEnd(11)} ${probe.label.padEnd(28)} expected ${expected}, got ${actual}`);
        if (!ok) {
          failures.push(`${role}: ${probe.label} expected ${expected}, got ${actual}`);
        }
      }
    }
  } finally {
    // Remove resources the role clients created (tagged by PolicyTest names) and all fixtures
    const created = await Promise.all([
      admin.searchResources('Patient', { name: 'PolicyTest', _count: '100' }),
      admin.searchResources('Observation', { subject: getReferenceString(patient), _count: '100' }),
      admin.searchResources('MedicationRequest', { subject: getReferenceString(patient), _count: '100' }),
      admin.searchResources('DiagnosticReport', { subject: getReferenceString(patient), _count: '100' }),
      admin.searchResources('ChargeItem', { subject: getReferenceString(patient), _count: '100' }),
      admin.searchResources('AccessPolicy', { name: 'policy-test-escalation', _count: '100' }),
    ]);
    const toDelete = new Map<string, Resource>();
    for (const resource of [...created.flat(), ...cleanup]) {
      const key = getReferenceString(resource);
      if (key) {
        toDelete.set(key, resource);
      }
    }
    // Delete dependents before the patient they reference
    const ordered = [...toDelete.values()].sort((a, b) => Number(a.resourceType === 'Patient') - Number(b.resourceType === 'Patient'));
    for (const resource of ordered) {
      await admin.deleteResource(resource.resourceType, resource.id as string).catch(() => undefined);
    }
    for (const client of clients) {
      const membership = await admin.searchOne('ProjectMembership', { profile: getReferenceString(client) });
      if (membership?.id) {
        await admin.deleteResource('ProjectMembership', membership.id).catch(() => undefined);
      }
      await admin.deleteResource('ClientApplication', client.id as string).catch(() => undefined);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} expectation(s) failed:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`\nAll ${POLICY_ROLES.length * probes.length} expectations held.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
