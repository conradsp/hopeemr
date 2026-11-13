/**
 * Shared helper for operator scripts: an authenticated MedplumClient for one facility Project.
 *
 * Uses a ClientApplication whose ProjectMembership has admin = true. Create one in the Medplum
 * app (Project Admin > Clients) and set:
 *   MEDPLUM_BASE_URL=https://api.hopeemr.com/
 *   MEDPLUM_CLIENT_ID=...
 *   MEDPLUM_CLIENT_SECRET=...
 */

import { MedplumClient } from '@medplum/core';

export async function createAdminClient(): Promise<MedplumClient> {
  const baseUrl = process.env.MEDPLUM_BASE_URL;
  const clientId = process.env.MEDPLUM_CLIENT_ID;
  const clientSecret = process.env.MEDPLUM_CLIENT_SECRET;
  if (!baseUrl || !clientId || !clientSecret) {
    throw new Error('Set MEDPLUM_BASE_URL, MEDPLUM_CLIENT_ID and MEDPLUM_CLIENT_SECRET');
  }
  const medplum = new MedplumClient({ baseUrl });
  await medplum.startClientLogin(clientId, clientSecret);
  return medplum;
}

/** The Project the admin client belongs to. */
export function getProjectId(medplum: MedplumClient): string {
  const projectId = medplum.getProject()?.id;
  if (!projectId) {
    throw new Error('Signed-in client has no project');
  }
  return projectId;
}
