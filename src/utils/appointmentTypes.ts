import { CodeableConcept, ValueSet, ValueSetComposeIncludeConcept } from '@medplum/fhirtypes';
import { MedplumClient } from '@medplum/core';
import { logger } from './logger';
import { setPriceOnResource, getPriceFromResource } from './billing';

/**
 * Appointment Type definitions
 * Stored as a FHIR ValueSet for standardization
 */

export interface AppointmentTypeDefinition {
  code: string;
  display: string;
  duration: number; // in minutes
  description?: string;
  color?: string; // for calendar display
  visitFee?: number; // billing
}

/**
 * Default appointment types based on common EMR practices
 */
export const DEFAULT_APPOINTMENT_TYPES: AppointmentTypeDefinition[] = [
  {
    code: 'new-patient',
    display: 'New Patient Visit',
    duration: 60,
    description: 'Initial visit for new patients, includes comprehensive evaluation',
    color: '#4CAF50',
  },
  {
    code: 'follow-up',
    display: 'Follow-Up Visit',
    duration: 30,
    description: 'Follow-up appointment for existing patients',
    color: '#2196F3',
  },
  {
    code: 'annual-physical',
    display: 'Annual Physical Exam',
    duration: 45,
    description: 'Yearly comprehensive physical examination',
    color: '#9C27B0',
  },
  {
    code: 'wellness-checkup',
    display: 'Wellness Check-Up',
    duration: 30,
    description: 'General wellness and preventive care visit',
    color: '#00BCD4',
  },
  {
    code: 'urgent-care',
    display: 'Urgent Care',
    duration: 20,
    description: 'Same-day urgent medical needs',
    color: '#FF5722',
  },
  {
    code: 'consultation',
    display: 'Consultation',
    duration: 45,
    description: 'Specialist consultation or second opinion',
    color: '#FF9800',
  },
  {
    code: 'procedure',
    display: 'Procedure',
    duration: 60,
    description: 'In-office medical procedure',
    color: '#E91E63',
  },
  {
    code: 'lab-work',
    display: 'Lab Work',
    duration: 15,
    description: 'Laboratory tests and specimen collection',
    color: '#607D8B',
  },
  {
    code: 'immunization',
    display: 'Immunization',
    duration: 15,
    description: 'Vaccine administration',
    color: '#8BC34A',
  },
  {
    code: 'telehealth',
    display: 'Telehealth Visit',
    duration: 30,
    description: 'Virtual video consultation',
    color: '#3F51B5',
  },
  {
    code: 'pre-op',
    display: 'Pre-Operative Visit',
    duration: 45,
    description: 'Pre-surgical evaluation and preparation',
    color: '#795548',
  },
  {
    code: 'post-op',
    display: 'Post-Operative Follow-Up',
    duration: 30,
    description: 'Post-surgical follow-up care',
    color: '#009688',
  },
];

const APPOINTMENT_TYPE_SYSTEM = 'http://medplum.com/appointment-types';
const VALUESET_ID = 'appointment-types-valueset';

/**
 * Convert appointment type definitions to FHIR ValueSet
 */
export function createAppointmentTypesValueSet(): ValueSet {
  const concepts: ValueSetComposeIncludeConcept[] = DEFAULT_APPOINTMENT_TYPES.map(type => ({
    code: type.code,
    display: type.display,
    designation: type.description ? [
      {
        value: type.description,
      },
    ] : undefined,
  }));

  return {
    resourceType: 'ValueSet',
    id: VALUESET_ID,
    url: `${APPOINTMENT_TYPE_SYSTEM}/valueset`,
    identifier: [
      {
        system: APPOINTMENT_TYPE_SYSTEM,
        value: VALUESET_ID,
      },
    ],
    status: 'active',
    name: 'AppointmentTypes',
    title: 'Appointment Types',
    description: 'Standard appointment types for scheduling',
    compose: {
      include: [
        {
          system: APPOINTMENT_TYPE_SYSTEM,
          concept: concepts,
        },
      ],
    },
  };
}

/**
 * Initialize appointment types in the system
 */
export async function initializeAppointmentTypes(medplum: MedplumClient): Promise<void> {
  try {
    // Check if ValueSet already exists
    const existing = await medplum.search('ValueSet', {
      identifier: VALUESET_ID,
      _count: '1',
    });

    if (!existing.entry || existing.entry.length === 0) {
      // Create the ValueSet
      await medplum.createResource(createAppointmentTypesValueSet());
    }
  } catch (error) {
    logger.error('Failed to initialize appointment types', error);
  }
}

/**
 * Get all appointment types
 */
export async function getAppointmentTypes(medplum: MedplumClient): Promise<AppointmentTypeDefinition[]> {
  try {
    const valueSet = await medplum.search('ValueSet', {
      identifier: VALUESET_ID,
      _count: '1',
    });

    if (valueSet.entry && valueSet.entry.length > 0) {
      const vs = valueSet.entry[0].resource as ValueSet;
      const concepts = vs.compose?.include?.[0]?.concept || [];
      
      // Map back to our type definition with defaults
      return concepts.map(concept => {
        const defaultType = DEFAULT_APPOINTMENT_TYPES.find(t => t.code === concept.code);
        const visitFee = getPriceFromResource(vs);
        return {
          code: concept.code || '',
          display: concept.display || '',
          duration: defaultType?.duration || 30,
          description: concept.designation?.[0]?.value || defaultType?.description,
          color: defaultType?.color || '#2196F3',
          visitFee,
        };
      });
    }

    return DEFAULT_APPOINTMENT_TYPES;
  } catch (error) {
    logger.error('Failed to load appointment types', error);
    return DEFAULT_APPOINTMENT_TYPES;
  }
}

/**
 * Get appointment type by code
 */
export function getAppointmentTypeByCode(code: string): AppointmentTypeDefinition | undefined {
  return DEFAULT_APPOINTMENT_TYPES.find(t => t.code === code);
}

/**
 * Create a CodeableConcept for an appointment type
 */
export function createAppointmentTypeCodeableConcept(code: string): CodeableConcept {
  const type = getAppointmentTypeByCode(code);
  
  return {
    coding: [
      {
        system: APPOINTMENT_TYPE_SYSTEM,
        code: code,
        display: type?.display || code,
      },
    ],
    text: type?.display || code,
  };
}

/**
 * Create or update an appointment type
 */
export async function saveAppointmentType(
  medplum: MedplumClient, 
  type: AppointmentTypeDefinition
): Promise<void> {
  try {
    const valueSet = await medplum.search('ValueSet', {
      identifier: VALUESET_ID,
      _count: '1',
    });

    let vs: ValueSet;
    if (valueSet.entry && valueSet.entry.length > 0) {
      vs = valueSet.entry[0].resource as ValueSet;
    } else {
      vs = createAppointmentTypesValueSet();
    }

    // Update or add the concept
    if (!vs.compose) vs.compose = { include: [] };
    if (!vs.compose.include[0]) vs.compose.include[0] = { system: APPOINTMENT_TYPE_SYSTEM, concept: [] };
    
    const concepts = vs.compose.include[0].concept || [];
    const existingIndex = concepts.findIndex(c => c.code === type.code);
    
    const newConcept: ValueSetComposeIncludeConcept = {
      code: type.code,
      display: type.display,
      designation: type.description ? [{ value: type.description }] : undefined,
    };

    if (existingIndex >= 0) {
      concepts[existingIndex] = newConcept;
    } else {
      concepts.push(newConcept);
    }

    vs.compose.include[0].concept = concepts;
    
    // Add pricing if provided
    const vsWithPrice = type.visitFee !== undefined
      ? setPriceOnResource(vs, type.visitFee)
      : vs;

    if (vs.id) {
      await medplum.updateResource(vsWithPrice);
    } else {
      await medplum.createResource(vsWithPrice);
    }
  } catch (error) {
    logger.error('Failed to save appointment type', error);
    throw error;
  }
}

/**
 * Delete an appointment type
 */
export async function deleteAppointmentType(
  medplum: MedplumClient,
  code: string
): Promise<void> {
  try {
    const valueSet = await medplum.search('ValueSet', {
      identifier: VALUESET_ID,
      _count: '1',
    });

    if (valueSet.entry && valueSet.entry.length > 0) {
      const vs = valueSet.entry[0].resource as ValueSet;
      
      if (vs.compose?.include?.[0]?.concept) {
        vs.compose.include[0].concept = vs.compose.include[0].concept.filter(
          c => c.code !== code
        );
        
        if (vs.id) {
          await medplum.updateResource(vs);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to delete appointment type', error);
    throw error;
  }
}

