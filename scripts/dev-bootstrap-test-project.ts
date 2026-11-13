/**
 * DEV ONLY: create a fresh Project with a project-admin ClientApplication on a local Medplum,
 * for running setup-access-policies.ts and test-access-policies.ts.
 *
 * Registers a throwaway user, creates an ordinary Project for it (never the Super Admin
 * project, whose members bypass access policies), and prints shell exports for a project-admin
 * client in that Project. Requires open registration (the local default: no reCAPTCHA).
 *
 * Usage: eval "$(MEDPLUM_BASE_URL=http://localhost:8103/ npx tsx scripts/dev-bootstrap-test-project.ts)"
 */

import { MedplumClient } from '@medplum/core';
import type { ClientApplication } from '@medplum/fhirtypes';

async function main(): Promise<void> {
  const baseUrl = process.env.MEDPLUM_BASE_URL ?? 'http://localhost:8103/';
  if (!/localhost|127\.0\.0\.1/.test(baseUrl)) {
    throw new Error(`Refusing to bootstrap against non-local server ${baseUrl}`);
  }
  const medplum = new MedplumClient({ baseUrl });

  const stamp = Date.now();
  const user = await medplum.startNewUser({
    firstName: 'Policy',
    lastName: 'Test',
    email: `policy-test-${stamp}@example.com`,
    password: `PolicyTest-${stamp}-${Math.random().toString(36).slice(2)}`,
  });
  const created = await medplum.startNewProject({ login: user.login, projectName: `policy-test-${stamp}` });
  if (!created.code) {
    throw new Error('New project login did not return a code');
  }
  await medplum.processCode(created.code);

  const projectId = medplum.getProject()?.id;
  const client = (await medplum.post(`admin/projects/${projectId}/client`, {
    name: 'policy-test-admin',
    description: 'Project admin client for local policy tests',
  })) as ClientApplication;

  // Make the client a project admin so it can manage policies and memberships
  const membership = await medplum.searchOne('ProjectMembership', { profile: `ClientApplication/${client.id}` });
  if (!membership) {
    throw new Error('Client membership not found');
  }
  await medplum.updateResource({ ...membership, admin: true });

  console.log(`export MEDPLUM_BASE_URL='${baseUrl}'`);
  console.log(`export MEDPLUM_CLIENT_ID='${client.id}'`);
  console.log(`export MEDPLUM_CLIENT_SECRET='${client.secret}'`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
