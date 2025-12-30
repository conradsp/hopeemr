// Utility functions for medication management
import { MedplumClient } from '@medplum/core';
import { Medication, MedicationRequest, MedicationAdministration, MedicationKnowledge } from '@medplum/fhirtypes';
import { DEFAULT_MEDICATIONS } from './defaultMedications';
import { logger } from './logger';

export interface MedicationInventory {
  medicationId: string;
  medication: Medication;
  currentStock: number;
  reorderLevel: number;
  reorderQuantity: number;
  expirationDate?: string;
  lotNumber?: string;
  location?: string;
}

export interface PrescriptionFormData {
  medicationId: string;
  dosageInstruction: string;
  quantity: number;
  refills: number;
  isPrescriptionType: 'external' | 'internal';
  notes?: string;
}

export interface AdministrationFormData {
  medicationRequestId: string;
  dosageGiven: string;
  quantity: number;
  notes?: string;
}

/**
 * Get all medications from the catalog
 * @param medplum - Medplum client instance
 * @returns Promise resolving to array of Medication resources
 */
export async function getMedications(medplum: MedplumClient): Promise<Medication[]> {
  try {
    const result = await medplum.search('Medication', {
      _count: '100',
      _sort: 'code',
    });
    return result.entry?.map(e => e.resource as Medication) || [];
  } catch (error) {
    logger.error('Failed to fetch medications', error);
    return [];
  }
}

/**
 * Create a new medication in the catalog
 * @param medplum - Medplum client instance
 * @param medication - Partial Medication resource
 * @returns Promise resolving to created Medication resource
 */
export async function createMedication(
  medplum: MedplumClient,
  medication: Partial<Medication>
): Promise<Medication> {
  return medplum.createResource({
    resourceType: 'Medication',
    ...medication,
  } as Medication);
}

/**
 * Update medication in the catalog
 * @param medplum - Medplum client instance
 * @param medication - Medication resource to update
 * @returns Promise resolving to updated Medication resource
 */
export async function updateMedication(
  medplum: MedplumClient,
  medication: Medication
): Promise<Medication> {
  return medplum.updateResource(medication);
}

/**
 * Delete medication from catalog
 * @param medplum - Medplum client instance
 * @param medicationId - ID of the medication to delete
 */
export async function deleteMedication(
  medplum: MedplumClient,
  medicationId: string
): Promise<void> {
  await medplum.deleteResource('Medication', medicationId);
}

/**
 * Create a prescription (MedicationRequest)
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param prescription - Prescription form data
 * @returns Promise resolving to created MedicationRequest resource
 */
export async function createPrescription(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  prescription: PrescriptionFormData
): Promise<MedicationRequest> {
  const medication = await medplum.readResource('Medication', prescription.medicationId);
  
  const medicationRequest: MedicationRequest = {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: prescription.isPrescriptionType === 'external' ? 'order' : 'instance-order',
    medicationReference: {
      reference: `Medication/${prescription.medicationId}`,
      display: medication.code?.coding?.[0]?.display || medication.code?.text,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    authoredOn: new Date().toISOString(),
    requester: {
      reference: `${medplum.getProfile()?.resourceType}/${medplum.getProfile()?.id}`,
    },
    dosageInstruction: [
      {
        text: prescription.dosageInstruction,
      },
    ],
    dispenseRequest: {
      numberOfRepeatsAllowed: prescription.refills,
      quantity: {
        value: prescription.quantity,
      },
    },
    note: prescription.notes ? [{ text: prescription.notes }] : undefined,
    // Use extension to mark internal vs external
    extension: [
      {
        url: 'http://example.org/fhir/StructureDefinition/prescription-type',
        valueString: prescription.isPrescriptionType,
      },
    ],
  };

  return medplum.createResource(medicationRequest);
}

/**
 * Administer medication and update inventory
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param administration - Administration form data
 * @returns Promise resolving to created MedicationAdministration resource
 */
export async function administerMedication(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  administration: AdministrationFormData
): Promise<MedicationAdministration> {
  // Get the medication request
  const medicationRequest = await medplum.readResource(
    'MedicationRequest',
    administration.medicationRequestId
  );

  // Create medication administration record
  const medicationAdministration: MedicationAdministration = {
    resourceType: 'MedicationAdministration',
    status: 'completed',
    medicationReference: medicationRequest.medicationReference,
    subject: {
      reference: `Patient/${patientId}`,
    },
    context: {
      reference: `Encounter/${encounterId}`,
    },
    effectiveDateTime: new Date().toISOString(),
    performer: [
      {
        actor: {
          reference: `${medplum.getProfile()?.resourceType}/${medplum.getProfile()?.id}`,
        },
      },
    ],
    request: {
      reference: `MedicationRequest/${administration.medicationRequestId}`,
    },
    dosage: {
      text: administration.dosageGiven,
      dose: {
        value: administration.quantity,
      },
    },
    note: administration.notes ? [{ text: administration.notes }] : undefined,
  };

  const result = await medplum.createResource(medicationAdministration);

  // Update inventory for internal medications
  const isInternal = medicationRequest.extension?.find(
    ext => ext.url === 'http://example.org/fhir/StructureDefinition/prescription-type'
  )?.valueString === 'internal';

  if (isInternal && medicationRequest.medicationReference?.reference) {
    const medicationId = medicationRequest.medicationReference.reference.split('/')[1];
    await updateInventoryAfterAdministration(medplum, medicationId, administration.quantity);
  }

  return result;
}

/**
 * Update inventory after medication administration
 * @param medplum - Medplum client instance
 * @param medicationId - ID of the medication
 * @param quantity - Quantity administered
 */
async function updateInventoryAfterAdministration(
  medplum: MedplumClient,
  medicationId: string,
  quantity: number
): Promise<void> {
  // Fetch the Medication resource to get its RxNorm code
  const medication = await medplum.readResource('Medication', medicationId);
  const rxnormCode = medication.code?.coding?.find(c => c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm')?.code;
  if (!rxnormCode) {
    return;
  }
  // Search for MedicationKnowledge resource that tracks inventory
  const result = await medplum.search('MedicationKnowledge', {
    'code': rxnormCode,
    _count: '1',
  });
  if (result.entry && result.entry.length > 0) {
    const medKnowledge = result.entry[0].resource as MedicationKnowledge;
    // Update the packaging information to reflect new stock
    if (medKnowledge.packaging) {
      const currentQuantity = medKnowledge.packaging.quantity?.value || 0;
      const newQuantity = Math.max(0, currentQuantity - quantity);
      medKnowledge.packaging.quantity = {
        value: newQuantity,
      };
      await medplum.updateResource(medKnowledge);
    }
  }
}

/**
 * Get inventory for a medication
 * @param medplum - Medplum client instance
 * @param medicationId - ID of the medication
 * @returns Promise resolving to MedicationKnowledge or null
 */
export async function getMedicationInventory(
  medplum: MedplumClient,
  medicationId: string
): Promise<MedicationKnowledge | null> {
  try {
    // Fetch the Medication resource to get its RxNorm code
    const medication = await medplum.readResource('Medication', medicationId);
    const rxnormCode = medication.code?.coding?.find(c => c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm')?.code;
    if (!rxnormCode) {
      return null;
    }
    const result = await medplum.search('MedicationKnowledge', {
      'code': rxnormCode,
      _count: '1',
    });
    if (result.entry && result.entry.length > 0) {
      return result.entry[0].resource as MedicationKnowledge;
    }
    return null;
  } catch (error) {
    logger.error('Failed to fetch inventory', error);
    return null;
  }
}

/**
 * Create or update medication inventory
 * @param medplum - Medplum client instance
 * @param medicationId - ID of the medication
 * @param quantity - Current stock quantity
 * @param reorderLevel - Reorder level
 * @param reorderQuantity - Reorder quantity
 * @param expirationDate - Expiration date (optional)
 * @param lotNumber - Lot number (optional)
 * @param location - Storage location (optional)
 * @returns Promise resolving to MedicationKnowledge resource
 */
export async function updateMedicationInventory(
  medplum: MedplumClient,
  medicationId: string,
  quantity: number,
  reorderLevel: number,
  reorderQuantity: number,
  expirationDate?: string,
  lotNumber?: string,
  location?: string
): Promise<MedicationKnowledge> {
  // Check if inventory already exists
  const existing = await getMedicationInventory(medplum, medicationId);

  if (existing) {
    // Update existing
    existing.packaging = {
      quantity: {
        value: quantity,
      },
    };
    // Store additional info in extensions
    existing.extension = [
      {
        url: 'http://example.org/fhir/StructureDefinition/reorder-level',
        valueInteger: reorderLevel,
      },
      {
        url: 'http://example.org/fhir/StructureDefinition/reorder-quantity',
        valueInteger: reorderQuantity,
      },
    ];
    if (expirationDate) {
      existing.extension.push({
        url: 'http://example.org/fhir/StructureDefinition/expiration-date',
        valueDate: expirationDate,
      });
    }
    if (lotNumber) {
      existing.extension.push({
        url: 'http://example.org/fhir/StructureDefinition/lot-number',
        valueString: lotNumber,
      });
    }
    if (location) {
      existing.extension.push({
        url: 'http://example.org/fhir/StructureDefinition/storage-location',
        valueString: location,
      });
    }

    return medplum.updateResource(existing);
  } else {
    // Create new
    // Fetch medication details for coding
    const medication = await medplum.readResource('Medication', medicationId);
    const medKnowledge: MedicationKnowledge = {
      resourceType: 'MedicationKnowledge',
      status: 'active',
      code: {
        coding: [
          {
            system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: medication.code?.coding?.[0]?.code,
            display: medication.code?.coding?.[0]?.display,
          },
          // Only add NDC coding if present
          ...(medication.code?.coding?.find(c => c.system === 'http://hl7.org/fhir/sid/ndc') ? [{
            system: 'http://hl7.org/fhir/sid/ndc',
            code: medication.code?.coding?.find(c => c.system === 'http://hl7.org/fhir/sid/ndc')?.code,
            display: medication.code?.coding?.find(c => c.system === 'http://hl7.org/fhir/sid/ndc')?.display,
          }] : []),
        ],
        text: medication.code?.text || medication.code?.coding?.[0]?.display,
      },
      packaging: {
        quantity: {
          value: quantity,
        },
      },
      extension: [
        {
          url: 'http://example.org/fhir/StructureDefinition/reorder-level',
          valueInteger: reorderLevel,
        },
        {
          url: 'http://example.org/fhir/StructureDefinition/reorder-quantity',
          valueInteger: reorderQuantity,
        },
      ],
    };

    if (expirationDate) {
      medKnowledge.extension?.push({
        url: 'http://example.org/fhir/StructureDefinition/expiration-date',
        valueDate: expirationDate,
      });
    }
    if (lotNumber) {
      medKnowledge.extension?.push({
        url: 'http://example.org/fhir/StructureDefinition/lot-number',
        valueString: lotNumber,
      });
    }
    if (location) {
      medKnowledge.extension?.push({
        url: 'http://example.org/fhir/StructureDefinition/storage-location',
        valueString: location,
      });
    }

    return medplum.createResource(medKnowledge);
  }
}

/**
 * Get all prescriptions for an encounter
 * @param medplum - Medplum client instance
 * @param encounterId - ID of the encounter
 * @returns Promise resolving to array of MedicationRequest resources
 */
export async function getEncounterPrescriptions(
  medplum: MedplumClient,
  encounterId: string
): Promise<MedicationRequest[]> {
  try {
    const result = await medplum.search('MedicationRequest', {
      encounter: `Encounter/${encounterId}`,
      _count: '100',
    });
    return result.entry?.map(e => e.resource as MedicationRequest) || [];
  } catch (error) {
    logger.error('Failed to fetch prescriptions', error);
    return [];
  }
}

/**
 * Get medication administrations for an encounter
 * @param medplum - Medplum client instance
 * @param encounterId - ID of the encounter
 * @returns Promise resolving to array of MedicationAdministration resources
 */
export async function getEncounterAdministrations(
  medplum: MedplumClient,
  encounterId: string
): Promise<MedicationAdministration[]> {
  try {
    const result = await medplum.search('MedicationAdministration', {
      context: `Encounter/${encounterId}`,
      _count: '100',
    });
    return result.entry?.map(e => e.resource as MedicationAdministration) || [];
  } catch (error) {
    logger.error('Failed to fetch administrations', error);
    return [];
  }
}

/**
 * Initialize default medications in the catalog
 * @param medplum - Medplum client instance
 */
export async function initializeDefaultMedications(medplum: MedplumClient): Promise<void> {
  for (const med of DEFAULT_MEDICATIONS) {
    // Try to find an existing medication by RxCUI code
    const searchResult = await medplum.search('Medication', {
      'code:code': med.rxcui,
      _count: '1',
    });
    const codingArr = [
      {
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: med.rxcui,
        display: med.genericName,
      }
    ];
    if (med.ndc) {
      codingArr.push({
        system: 'http://hl7.org/fhir/sid/ndc',
        code: med.ndc,
        display: med.brandName,
      });
    }
    const medicationResource: Medication = {
      resourceType: 'Medication',
      status: 'active',
      code: {
        coding: codingArr,
        text: med.brandName || med.genericName,
      },
      form: {
        coding: [
          {
            code: med.dosageForm,
            display: med.dosageForm,
          },
        ],
      },
      amount: {
        numerator: {
          value: Number(med.strength),
          unit: med.unit,
        },
        denominator: {
          value: 1,
        },
      },
      extension: [
        {
          url: 'http://example.org/fhir/StructureDefinition/medication-category',
          valueString: med.category,
        },
        {
          url: 'http://example.org/fhir/StructureDefinition/medication-description',
          valueString: med.description,
        },
      ],
    };
    if (searchResult.entry?.[0]?.resource) {
      // Update existing
      medicationResource.id = searchResult.entry[0].resource.id;
      await updateMedication(medplum, medicationResource);
    } else {
      // Create new
      await createMedication(medplum, medicationResource);
    }
  }
}

