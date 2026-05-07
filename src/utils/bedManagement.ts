// Utility functions for bed management using FHIR Location resources
import { MedplumClient } from '@medplum/core';
import { Location, Encounter } from '@medplum/fhirtypes';
import { logger } from './logger';

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'contaminated' | 'housekeeping';

// FHIR v2-0116 (Bed Status). Used by Location.operationalStatus per FHIR R4.
// Codes: C=Closed, H=Housekeeping, I=Isolated, K=Contaminated, O=Occupied, U=Unoccupied.
export const OPERATIONAL_STATUS_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0116';

// HopeEMR-internal extension preserving the BedStatus literal. Necessary because
// 'reserved' has no FHIR v2-0116 equivalent (closest standard code is 'O' Occupied,
// but that loses the reserved-vs-occupied distinction the UI exposes).
export const BED_STATUS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/bed-status';
export type BedType = 'standard' | 'icu' | 'isolation' | 'bariatric' | 'pediatric' | 'maternity';
export type DepartmentType = 'emergency' | 'icu' | 'surgery' | 'pediatrics' | 'maternity' | 'general' | 'cardiology' | 'oncology' | 'orthopedics' | 'psychiatry';

export interface DepartmentFormData {
  name: string;
  code: string;
  type: DepartmentType;
  description?: string;
}

export interface BedFormData {
  bedNumber: string;
  roomNumber: string;
  departmentId: string;
  bedType: BedType;
  status: BedStatus;
  dailyRate?: number;
}

export interface BedWithDepartment extends Location {
  departmentName?: string;
}

/**
 * Get all departments (Location resources with physicalType = 'wa' for ward)
 */
export async function getDepartments(medplum: MedplumClient): Promise<Location[]> {
  try {
    const result = await medplum.search('Location', {
      'physical-type': 'wa', // Ward/Department
      _count: '100',
    });
    return result.entry?.map(e => e.resource as Location) || [];
  } catch (error) {
    logger.error('Failed to fetch departments', error);
    return [];
  }
}

/**
 * Create a new department
 */
export async function createDepartment(
  medplum: MedplumClient,
  data: DepartmentFormData
): Promise<Location> {
  const department: Location = {
    resourceType: 'Location',
    status: 'active',
    name: data.name,
    mode: 'instance',
    physicalType: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
        code: 'wa',
        display: 'Ward',
      }],
    },
    type: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
        code: data.type.toUpperCase(),
        display: data.type,
      }],
    }],
    identifier: [{
      system: 'http://example.org/department-codes',
      value: data.code,
    }],
    description: data.description,
  };

  return medplum.createResource(department);
}

/**
 * Update an existing department
 */
export async function updateDepartment(
  medplum: MedplumClient,
  department: Location
): Promise<Location> {
  return medplum.updateResource(department);
}

/**
 * Delete a department
 */
export async function deleteDepartment(
  medplum: MedplumClient,
  departmentId: string
): Promise<void> {
  await medplum.deleteResource('Location', departmentId);
}

/**
 * Get all beds (Location resources with physicalType = 'bd' for bed)
 */
export async function getBeds(medplum: MedplumClient): Promise<BedWithDepartment[]> {
  try {
    const result = await medplum.search('Location', {
      'physical-type': 'bd', // Bed
      _count: '100',
    });
    
    const beds = result.entry?.map(e => e.resource as Location) || [];
    
    // Fetch department names for each bed
    const bedsWithDepartments = await Promise.all(
      beds.map(async (bed) => {
        if (bed.partOf?.reference) {
          try {
            const deptId = bed.partOf.reference.split('/')[1];
            const dept = await medplum.readResource('Location', deptId);
            return {
              ...bed,
              departmentName: dept.name,
            } as BedWithDepartment;
          } catch {
            return bed as BedWithDepartment;
          }
        }
        return bed as BedWithDepartment;
      })
    );
    
    return bedsWithDepartments;
  } catch (error) {
    logger.error('Failed to fetch beds', error);
    return [];
  }
}

/**
 * Get available beds in a specific department
 */
export async function getAvailableBeds(
  medplum: MedplumClient,
  departmentId: string
): Promise<Location[]> {
  try {
    const result = await medplum.search('Location', {
      'physical-type': 'bd',
      'partof': `Location/${departmentId}`,
      'operational-status': 'U', // Unoccupied
      _count: '100',
    });
    return result.entry?.map(e => e.resource as Location) || [];
  } catch (error) {
    logger.error('Failed to fetch available beds', error);
    return [];
  }
}

/**
 * Create a new bed
 */
export async function createBed(
  medplum: MedplumClient,
  data: BedFormData
): Promise<Location> {
  const bed: Location = {
    resourceType: 'Location',
    status: 'active',
    name: `Bed ${data.bedNumber}`,
    mode: 'instance',
    physicalType: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
        code: 'bd',
        display: 'Bed',
      }],
    },
    type: [{
      coding: [{
        system: 'http://example.org/bed-types',
        code: data.bedType,
        display: data.bedType,
      }],
    }],
    identifier: [{
      system: 'http://example.org/bed-numbers',
      value: data.bedNumber,
    }],
    partOf: {
      reference: `Location/${data.departmentId}`,
    },
    operationalStatus: {
      system: OPERATIONAL_STATUS_SYSTEM,
      code: getOperationalStatusCode(data.status),
      display: data.status,
    },
    extension: [
      {
        url: 'http://example.org/fhir/StructureDefinition/room-number',
        valueString: data.roomNumber,
      },
      {
        url: BED_STATUS_EXTENSION_URL,
        valueCode: data.status,
      },
    ],
  };

  return medplum.createResource(bed);
}

/**
 * Update an existing bed
 */
export async function updateBed(
  medplum: MedplumClient,
  bed: Location
): Promise<Location> {
  return medplum.updateResource(bed);
}

/**
 * Delete a bed
 */
export async function deleteBed(
  medplum: MedplumClient,
  bedId: string
): Promise<void> {
  await medplum.deleteResource('Location', bedId);
}

/**
 * Assign a bed to an encounter
 */
export async function assignBedToEncounter(
  medplum: MedplumClient,
  encounterId: string,
  bedId: string,
  notes?: string
): Promise<Encounter> {
  // Get the encounter
  const encounter = await medplum.readResource('Encounter', encounterId);
  
  // Get the bed
  const bed = await medplum.readResource('Location', bedId);
  
  // Check if bed is available
  if (bed.operationalStatus?.code !== 'U') {
    throw new Error('Bed is not available');
  }
  
  // Update encounter with bed location
  const updatedEncounter: Encounter = {
    ...encounter,
    location: [
      ...(encounter.location || []),
      {
        location: {
          reference: `Location/${bedId}`,
          display: bed.name,
        },
        status: 'active',
        period: {
          start: new Date().toISOString(),
        },
      },
    ],
  };
  
  if (notes) {
    updatedEncounter.extension = [
      ...(updatedEncounter.extension || []),
      {
        url: 'http://example.org/fhir/StructureDefinition/bed-assignment-notes',
        valueString: notes,
      },
    ];
  }
  
  // Update bed status to occupied
  const updatedBed: Location = {
    ...bed,
    operationalStatus: {
      system: OPERATIONAL_STATUS_SYSTEM,
      code: 'O',
      display: 'Occupied',
    },
    extension: setBedStatusExtension(bed.extension, 'occupied'),
  };

  // Save both resources
  await medplum.updateResource(updatedBed);
  return medplum.updateResource(updatedEncounter);
}

/**
 * Release a bed from an encounter
 */
export async function releaseBedFromEncounter(
  medplum: MedplumClient,
  encounterId: string,
  bedId: string
): Promise<Encounter> {
  // Get the encounter
  const encounter = await medplum.readResource('Encounter', encounterId);
  
  // Get the bed
  const bed = await medplum.readResource('Location', bedId);
  
  // Update encounter - mark current bed location as inactive and set end time
  const updatedEncounter: Encounter = {
    ...encounter,
    location: (encounter.location || []).map(loc => {
      if (loc.location.reference === `Location/${bedId}` && loc.status === 'active') {
        return {
          ...loc,
          status: 'completed',
          period: {
            ...loc.period,
            end: new Date().toISOString(),
          },
        };
      }
      return loc;
    }),
  };
  
  // Update bed status to available
  const updatedBed: Location = {
    ...bed,
    operationalStatus: {
      system: OPERATIONAL_STATUS_SYSTEM,
      code: 'U',
      display: 'Unoccupied',
    },
    extension: setBedStatusExtension(bed.extension, 'available'),
  };
  
  // Save both resources
  await medplum.updateResource(updatedBed);
  return medplum.updateResource(updatedEncounter);
}

/**
 * Get current bed assignment for an encounter
 */
export function getCurrentBedAssignment(encounter: Encounter): Location['id'] | null {
  const activeLocation = encounter.location?.find(
    loc => loc.status === 'active' && loc.location.reference?.startsWith('Location/')
  );
  
  if (activeLocation?.location.reference) {
    return activeLocation.location.reference.split('/')[1];
  }
  
  return null;
}

/**
 * Convert HopeEMR BedStatus to FHIR v2-0116 OperationalStatus code.
 *
 * Note: 'reserved' has no v2-0116 equivalent. We map it to 'O' (Occupied) so that
 * standards-only consumers see the bed as not-available; the BedStatus literal
 * is preserved alongside in the BED_STATUS_EXTENSION_URL extension.
 */
export function getOperationalStatusCode(status: BedStatus): string {
  switch (status) {
    case 'available':
      return 'U'; // Unoccupied
    case 'occupied':
      return 'O'; // Occupied
    case 'reserved':
      return 'O'; // Occupied (operationally not available; extension preserves the 'reserved' distinction)
    case 'maintenance':
      return 'C'; // Closed
    case 'contaminated':
      return 'K'; // Contaminated
    case 'housekeeping':
      return 'H'; // Housekeeping
    default:
      return 'U';
  }
}

/**
 * Read BedStatus from a Location, preferring the BED_STATUS_EXTENSION_URL
 * extension (canonical) and falling back to the v2-0116 code mapping for
 * pre-migration beds that don't yet carry the extension.
 */
export function getBedStatusFromLocation(location: Location): BedStatus {
  const ext = location.extension?.find((e) => e.url === BED_STATUS_EXTENSION_URL);
  if (ext?.valueCode && isBedStatus(ext.valueCode)) {
    return ext.valueCode;
  }
  return getBedStatusFromLegacyCode(location.operationalStatus?.code);
}

/**
 * Build a new extension array with the BedStatus extension set/replaced.
 */
export function setBedStatusExtension(
  existing: Location['extension'] | undefined,
  status: BedStatus
): NonNullable<Location['extension']> {
  const others = (existing ?? []).filter((e) => e.url !== BED_STATUS_EXTENSION_URL);
  return [...others, { url: BED_STATUS_EXTENSION_URL, valueCode: status }];
}

/**
 * Legacy v2-0116 → BedStatus mapping. Mirrors the (FHIR-non-compliant) mapping
 * that pre-migration beds were saved with, so unmigrated beds continue to display
 * the user-visible state they had before the code fix. Once all beds are migrated
 * (extension present), this fallback becomes unreachable.
 */
function getBedStatusFromLegacyCode(code?: string): BedStatus {
  switch (code) {
    case 'U':
      return 'available';
    case 'O':
      return 'occupied';
    case 'K':
      return 'housekeeping';
    case 'C':
      return 'maintenance';
    case 'I':
      return 'contaminated';
    default:
      return 'available';
  }
}

const BED_STATUSES: readonly BedStatus[] = [
  'available',
  'occupied',
  'reserved',
  'maintenance',
  'contaminated',
  'housekeeping',
];

function isBedStatus(value: string): value is BedStatus {
  return (BED_STATUSES as readonly string[]).includes(value);
}

/**
 * Get bed statistics for a department
 */
export async function getDepartmentBedStats(
  medplum: MedplumClient,
  departmentId: string
): Promise<{ total: number; available: number; occupied: number }> {
  try {
    const allBeds = await medplum.search('Location', {
      'physical-type': 'bd',
      'partof': `Location/${departmentId}`,
      _count: '100',
    });
    
    const beds = allBeds.entry?.map(e => e.resource as Location) || [];
    const total = beds.length;
    const available = beds.filter(b => b.operationalStatus?.code === 'U').length;
    const occupied = beds.filter(b => b.operationalStatus?.code === 'O').length;
    
    return { total, available, occupied };
  } catch (error) {
    logger.error('Failed to get bed stats', error);
    return { total: 0, available: 0, occupied: 0 };
  }
}

