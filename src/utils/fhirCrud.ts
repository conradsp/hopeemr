/**
 * Generic FHIR CRUD Utilities
 *
 * Provides standardized create, read, update, delete operations for FHIR resources
 * identified by a specific identifier system. Reduces code duplication across
 * domain-specific utility files (labTests, imagingTests, diagnosticProviders, etc.)
 */

import { MedplumClient } from '@medplum/core';
import { Resource, Bundle, Identifier } from '@medplum/fhirtypes';
import { logger } from './logger';

/**
 * Supported FHIR resource types for CRUD operations
 */
export type CrudResourceType =
  | 'ActivityDefinition'
  | 'Organization'
  | 'Questionnaire'
  | 'ValueSet'
  | 'Location'
  | 'PractitionerRole';

/**
 * Options for resource queries
 */
export interface QueryOptions {
  /** Maximum number of results to return */
  maxResults?: number;
  /** Sort order for results */
  sort?: string;
  /** Additional search parameters */
  additionalParams?: Record<string, string>;
}

/**
 * Get all resources of a specific type that have a given identifier system
 *
 * @param medplum - Medplum client instance
 * @param resourceType - FHIR resource type
 * @param identifierSystem - Identifier system to filter by
 * @param options - Query options
 * @returns Array of matching resources
 *
 * @example
 * ```ts
 * const labTests = await getResourcesByIdentifierSystem(
 *   medplum,
 *   'ActivityDefinition',
 *   'http://medplum.com/emr/lab-tests'
 * );
 * ```
 */
export async function getResourcesByIdentifierSystem<T extends Resource>(
  medplum: MedplumClient,
  resourceType: CrudResourceType,
  identifierSystem: string,
  options: QueryOptions = {}
): Promise<T[]> {
  const { maxResults = 1000, sort, additionalParams = {} } = options;

  try {
    const searchParams: Record<string, string> = {
      _count: String(maxResults),
      ...additionalParams,
    };

    if (sort) {
      searchParams._sort = sort;
    }

    const result = await medplum.search(resourceType, searchParams);

    // Filter to only resources with our identifier system
    const resources = result.entry
      ?.map((e) => e.resource as T)
      .filter((resource) => {
        const identifiers = (resource as { identifier?: Identifier[] }).identifier;
        return identifiers?.some((id) => id.system === identifierSystem);
      }) || [];

    return resources;
  } catch (error) {
    logger.error(`Failed to load ${resourceType} resources`, { identifierSystem, error });
    return [];
  }
}

/**
 * Find a resource by its identifier value within a specific system
 *
 * @param medplum - Medplum client instance
 * @param resourceType - FHIR resource type
 * @param identifierSystem - Identifier system
 * @param identifierValue - Identifier value to find
 * @returns The resource if found, null otherwise
 */
export async function findResourceByIdentifier<T extends Resource>(
  medplum: MedplumClient,
  resourceType: CrudResourceType,
  identifierSystem: string,
  identifierValue: string
): Promise<T | null> {
  try {
    const result = await medplum.search(resourceType, {
      identifier: `${identifierSystem}|${identifierValue}`,
      _count: '1',
    });

    if (result.entry && result.entry.length > 0) {
      return result.entry[0].resource as T;
    }
    return null;
  } catch (error) {
    logger.error(`Failed to find ${resourceType}`, { identifierSystem, identifierValue, error });
    return null;
  }
}

/**
 * Create or update a resource based on identifier lookup
 * If a resource with the same identifier exists, it's updated; otherwise, a new one is created
 *
 * @param medplum - Medplum client instance
 * @param resource - Resource to save
 * @param identifierSystem - Identifier system used for lookup
 * @param identifierValue - Identifier value used for lookup
 * @returns The saved resource
 *
 * @example
 * ```ts
 * const saved = await saveResourceByIdentifier(
 *   medplum,
 *   labTestResource,
 *   'http://medplum.com/emr/lab-tests',
 *   'CBC-001'
 * );
 * ```
 */
export async function saveResourceByIdentifier<T extends Resource>(
  medplum: MedplumClient,
  resource: T,
  identifierSystem: string,
  identifierValue: string
): Promise<T> {
  // Check if resource already exists
  const existing = await findResourceByIdentifier<T>(
    medplum,
    resource.resourceType as CrudResourceType,
    identifierSystem,
    identifierValue
  );

  if (existing?.id) {
    // Update existing resource
    return medplum.updateResource({
      ...resource,
      id: existing.id,
    }) as Promise<T>;
  } else {
    // Create new resource
    return medplum.createResource(resource) as Promise<T>;
  }
}

/**
 * Delete a resource by its identifier
 *
 * @param medplum - Medplum client instance
 * @param resourceType - FHIR resource type
 * @param identifierSystem - Identifier system
 * @param identifierValue - Identifier value of resource to delete
 * @returns True if deleted, false if not found
 */
export async function deleteResourceByIdentifier(
  medplum: MedplumClient,
  resourceType: CrudResourceType,
  identifierSystem: string,
  identifierValue: string
): Promise<boolean> {
  try {
    const existing = await findResourceByIdentifier(
      medplum,
      resourceType,
      identifierSystem,
      identifierValue
    );

    if (existing?.id) {
      await medplum.deleteResource(resourceType, existing.id);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Failed to delete ${resourceType}`, { identifierSystem, identifierValue, error });
    throw error;
  }
}

/**
 * Initialize a set of default resources
 * Useful for seeding configuration data (lab tests, imaging tests, etc.)
 *
 * @param medplum - Medplum client instance
 * @param defaults - Array of default items to save
 * @param saveFunction - Function to save each item
 *
 * @example
 * ```ts
 * await initializeDefaults(medplum, DEFAULT_LAB_TESTS, saveLabTest);
 * ```
 */
export async function initializeDefaults<T>(
  medplum: MedplumClient,
  defaults: T[],
  saveFunction: (medplum: MedplumClient, item: T) => Promise<unknown>
): Promise<void> {
  for (const item of defaults) {
    try {
      await saveFunction(medplum, item);
    } catch (error) {
      logger.error('Failed to initialize default resource', { item, error });
      // Continue with other items even if one fails
    }
  }
}

/**
 * Batch delete multiple resources by their identifiers
 *
 * @param medplum - Medplum client instance
 * @param resourceType - FHIR resource type
 * @param identifierSystem - Identifier system
 * @param identifierValues - Array of identifier values to delete
 * @returns Object with success count and failed identifiers
 */
export async function batchDeleteByIdentifiers(
  medplum: MedplumClient,
  resourceType: CrudResourceType,
  identifierSystem: string,
  identifierValues: string[]
): Promise<{ deleted: number; failed: string[] }> {
  let deleted = 0;
  const failed: string[] = [];

  for (const value of identifierValues) {
    try {
      const success = await deleteResourceByIdentifier(
        medplum,
        resourceType,
        identifierSystem,
        value
      );
      if (success) {
        deleted++;
      } else {
        failed.push(value);
      }
    } catch {
      failed.push(value);
    }
  }

  return { deleted, failed };
}

/**
 * Check if a resource with the given identifier exists
 *
 * @param medplum - Medplum client instance
 * @param resourceType - FHIR resource type
 * @param identifierSystem - Identifier system
 * @param identifierValue - Identifier value to check
 * @returns True if exists, false otherwise
 */
export async function resourceExistsByIdentifier(
  medplum: MedplumClient,
  resourceType: CrudResourceType,
  identifierSystem: string,
  identifierValue: string
): Promise<boolean> {
  const resource = await findResourceByIdentifier(
    medplum,
    resourceType,
    identifierSystem,
    identifierValue
  );
  return resource !== null;
}
