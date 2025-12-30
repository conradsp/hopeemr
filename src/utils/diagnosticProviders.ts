import { MedplumClient } from '@medplum/core';
import { Organization } from '@medplum/fhirtypes';
import { logger } from './logger';

export interface DiagnosticProviderDefinition {
  name: string;
  code: string;
  type: 'lab' | 'imaging' | 'both';
  phone?: string;
  website?: string;
}

const DIAGNOSTIC_PROVIDER_IDENTIFIER_SYSTEM = 'http://medplum.com/emr/diagnostic-provider';

/**
 * Default diagnostic providers
 */
export const DEFAULT_DIAGNOSTIC_PROVIDERS: DiagnosticProviderDefinition[] = [
  {
    name: 'Quest Diagnostics',
    code: 'quest',
    type: 'lab',
    phone: '1-866-697-8378',
    website: 'https://www.questdiagnostics.com',
  },
  {
    name: 'LabCorp',
    code: 'labcorp',
    type: 'lab',
    phone: '1-888-522-2677',
    website: 'https://www.labcorp.com',
  },
  {
    name: 'ACME Clinical Laboratory',
    code: 'acme-lab',
    type: 'lab',
  },
  {
    name: 'Regional Imaging Center',
    code: 'regional-imaging',
    type: 'imaging',
  },
  {
    name: 'Advanced Radiology Associates',
    code: 'advanced-radiology',
    type: 'imaging',
  },
  {
    name: 'City Hospital Diagnostic Center',
    code: 'city-hospital-diag',
    type: 'both',
  },
];

/**
 * Get all diagnostic providers from the system
 */
export async function getDiagnosticProviders(medplum: MedplumClient): Promise<Organization[]> {
  try {
    // Get all Organizations and filter by identifier system
    const result = await medplum.search('Organization', {
      _count: '1000',
      _sort: 'name',
    });
    
    // Filter to only those with our diagnostic provider identifier system
    const providers = result.entry
      ?.map(e => e.resource as Organization)
      .filter(org => 
        org.identifier?.some(id => id.system === DIAGNOSTIC_PROVIDER_IDENTIFIER_SYSTEM)
      ) || [];
    
    return providers;
  } catch (error) {
    logger.error('Failed to load diagnostic providers', error);
    return [];
  }
}

/**
 * Initialize default diagnostic providers
 */
export async function initializeDefaultDiagnosticProviders(medplum: MedplumClient): Promise<void> {
  for (const provider of DEFAULT_DIAGNOSTIC_PROVIDERS) {
    await saveDiagnosticProvider(medplum, provider);
  }
}

/**
 * Save a diagnostic provider
 */
export async function saveDiagnosticProvider(
  medplum: MedplumClient,
  provider: DiagnosticProviderDefinition
): Promise<Organization> {
  // Check if provider already exists
  const existing = await medplum.search('Organization', {
    identifier: `${DIAGNOSTIC_PROVIDER_IDENTIFIER_SYSTEM}|${provider.code}`,
    _count: '1',
  });

  const organization: Organization = {
    resourceType: 'Organization',
    active: true,
    name: provider.name,
    identifier: [
      {
        system: DIAGNOSTIC_PROVIDER_IDENTIFIER_SYSTEM,
        value: provider.code,
      },
    ],
    type: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'prov',
            display: 'Healthcare Provider',
          },
        ],
      },
    ],
    telecom: [
      provider.phone ? {
        system: 'phone',
        value: provider.phone,
      } : undefined,
      provider.website ? {
        system: 'url',
        value: provider.website,
      } : undefined,
    ].filter(Boolean) as any,
    extension: [
      {
        url: 'diagnosticType',
        valueString: provider.type,
      },
    ],
  };

  if (existing.entry && existing.entry.length > 0) {
    // Update existing
    const existingOrg = existing.entry[0].resource as Organization;
    return await medplum.updateResource({
      ...organization,
      id: existingOrg.id,
    });
  } else {
    // Create new
    return await medplum.createResource(organization);
  }
}

/**
 * Delete a diagnostic provider
 */
export async function deleteDiagnosticProvider(medplum: MedplumClient, code: string): Promise<void> {
  const existing = await medplum.search('Organization', {
    identifier: `${DIAGNOSTIC_PROVIDER_IDENTIFIER_SYSTEM}|${code}`,
    _count: '1',
  });

  if (existing.entry && existing.entry.length > 0) {
    const org = existing.entry[0].resource as Organization;
    if (org.id) {
      await medplum.deleteResource('Organization', org.id);
    }
  }
}

