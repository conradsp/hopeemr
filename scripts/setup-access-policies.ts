/**
 * Create or update the HopeEMR role AccessPolicies in one facility Project.
 *
 * Policies are keyed by name (hopeemr-role-<role>) and defined in src/security/rolePolicies.ts.
 * Idempotent: a second run reports every policy as unchanged.
 *
 * Usage:
 *   MEDPLUM_BASE_URL=... MEDPLUM_CLIENT_ID=... MEDPLUM_CLIENT_SECRET=... \
 *     npm run policies:setup:dry      # show what would change
 *     npm run policies:setup          # apply
 */

import type { AccessPolicy } from '@medplum/fhirtypes';
import { POLICY_ROLES, buildRolePolicy, getRolePolicyName } from '../src/security/rolePolicies';
import { createAdminClient, getProjectId } from './lib/medplumAdmin';

const dryRun = process.argv.includes('--dry-run');

function sameRules(a: AccessPolicy, b: AccessPolicy): boolean {
  return JSON.stringify(a.resource ?? []) === JSON.stringify(b.resource ?? []);
}

async function main(): Promise<void> {
  const medplum = await createAdminClient();
  console.log(`Project ${getProjectId(medplum)}${dryRun ? ' (dry run, no changes)' : ''}`);

  const existing = await medplum.searchResources('AccessPolicy', { _count: '100' });

  for (const role of POLICY_ROLES) {
    const name = getRolePolicyName(role);
    const desired = buildRolePolicy(role);
    const matches = existing.filter((p) => p.name === name);

    if (matches.length > 1) {
      throw new Error(`Found ${matches.length} policies named ${name}; remove the duplicates first`);
    }

    const current = matches[0];
    if (!current) {
      console.log(`  create     ${name}`);
      if (!dryRun) {
        await medplum.createResource(desired);
      }
    } else if (!sameRules(current, desired)) {
      console.log(`  update     ${name}`);
      if (!dryRun) {
        await medplum.updateResource({ ...current, resource: desired.resource });
      }
    } else {
      console.log(`  unchanged  ${name}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
