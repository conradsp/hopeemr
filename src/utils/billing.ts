// Billing utilities using FHIR ChargeItem and Account resources
import { MedplumClient } from '@medplum/core';
import { ChargeItem, Account, Reference } from '@medplum/fhirtypes';
import { logger } from './logger';

export interface ChargeItemSummary extends ChargeItem {
  description?: string;
  unitPrice?: number;
  totalPrice?: number;
}

export interface PaymentRecord {
  amount: number;
  method: 'cash' | 'credit-card' | 'debit-card' | 'check' | 'insurance' | 'other';
  date: string;
  notes?: string;
}

export interface BillingSummary {
  totalCharges: number;
  totalPayments: number;
  balance: number;
  charges: ChargeItemSummary[];
  payments: PaymentRecord[];
}

/**
 * Create a charge item for a service
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param description - Description of the service
 * @param code - Service code
 * @param quantity - Quantity of service
 * @param unitPrice - Price per unit
 * @param serviceReference - Reference to the service
 * @returns Promise resolving to created ChargeItem resource
 */
export async function createChargeItem(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  description: string,
  code: string,
  quantity: number,
  unitPrice: number,
  serviceReference?: Reference
): Promise<ChargeItem> {
  const chargeItem: ChargeItem = {
    resourceType: 'ChargeItem',
    status: 'billable',
    code: {
      coding: [{
        system: 'http://example.org/billing-codes',
        code,
        display: description,
      }],
      text: description,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    context: {
      reference: `Encounter/${encounterId}`,
    },
    occurrenceDateTime: new Date().toISOString(),
    quantity: {
      value: quantity,
    },
    priceOverride: {
      value: unitPrice,
      currency: 'USD',
    },
    // Store service reference in extension
    extension: serviceReference ? [{
      url: 'http://example.org/fhir/StructureDefinition/service-reference',
      valueReference: serviceReference,
    }] : undefined,
  };

  return medplum.createResource(chargeItem);
}

/**
 * Create charge for medication
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param medicationName - Name of the medication
 * @param quantity - Quantity dispensed
 * @param unitPrice - Price per unit
 * @param medicationRequestId - MedicationRequest resource ID
 * @returns Promise resolving to created ChargeItem resource
 */
export async function createMedicationCharge(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  medicationName: string,
  quantity: number,
  unitPrice: number,
  medicationRequestId?: string
): Promise<ChargeItem> {
  return createChargeItem(
    medplum,
    patientId,
    encounterId,
    `Medication: ${medicationName}`,
    'medication',
    quantity,
    unitPrice,
    medicationRequestId ? { reference: `MedicationRequest/${medicationRequestId}` } : undefined
  );
}

/**
 * Create charge for lab test
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param testName - Name of the lab test
 * @param price - Price of the test
 * @param serviceRequestId - ServiceRequest resource ID
 * @returns Promise resolving to created ChargeItem resource
 */
export async function createLabCharge(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  testName: string,
  price: number,
  serviceRequestId?: string
): Promise<ChargeItem> {
  return createChargeItem(
    medplum,
    patientId,
    encounterId,
    `Lab Test: ${testName}`,
    'lab-test',
    1,
    price,
    serviceRequestId ? { reference: `ServiceRequest/${serviceRequestId}` } : undefined
  );
}

/**
 * Create charge for imaging test
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param testName - Name of the imaging test
 * @param price - Price of the test
 * @param serviceRequestId - ServiceRequest resource ID
 * @returns Promise resolving to created ChargeItem resource
 */
export async function createImagingCharge(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  testName: string,
  price: number,
  serviceRequestId?: string
): Promise<ChargeItem> {
  return createChargeItem(
    medplum,
    patientId,
    encounterId,
    `Imaging: ${testName}`,
    'imaging',
    1,
    price,
    serviceRequestId ? { reference: `ServiceRequest/${serviceRequestId}` } : undefined
  );
}

/**
 * Create charge for bed/room (daily rate)
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param bedName - Name of the bed/room
 * @param days - Number of days
 * @param dailyRate - Daily rate
 * @param locationId - Location resource ID
 * @returns Promise resolving to created ChargeItem resource
 */
export async function createBedCharge(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  bedName: string,
  days: number,
  dailyRate: number,
  locationId?: string
): Promise<ChargeItem> {
  return createChargeItem(
    medplum,
    patientId,
    encounterId,
    `Bed/Room: ${bedName} (${days} day${days > 1 ? 's' : ''})`,
    'bed-room',
    days,
    dailyRate,
    locationId ? { reference: `Location/${locationId}` } : undefined
  );
}

/**
 * Create charge for provider visit
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param visitType - Type of visit
 * @param price - Price of the visit
 * @returns Promise resolving to created ChargeItem resource
 */
export async function createVisitCharge(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string,
  visitType: string,
  price: number
): Promise<ChargeItem> {
  return createChargeItem(
    medplum,
    patientId,
    encounterId,
    `Visit: ${visitType}`,
    'visit',
    1,
    price,
    { reference: `Encounter/${encounterId}` }
  );
}

/**
 * Get all charges for an encounter
 * @param medplum - Medplum client instance
 * @param encounterId - ID of the encounter
 * @returns Promise resolving to array of ChargeItem resources
 */
export async function getEncounterCharges(
  medplum: MedplumClient,
  encounterId: string
): Promise<ChargeItemSummary[]> {
  try {
    const result = await medplum.search('ChargeItem', {
      context: `Encounter/${encounterId}`,
      _count: '100',
    });

    return (result.entry?.map(e => {
      const charge = e.resource as ChargeItem;
      const unitPrice = charge.priceOverride?.value || 0;
      const quantity = charge.quantity?.value || 1;
      return {
        ...charge,
        description: charge.code?.text || charge.code?.coding?.[0]?.display,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    }) || []);
  } catch (error) {
    logger.error('Failed to fetch charges', error);
    return [];
  }
}

/**
 * Get all charges for a patient
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @returns Promise resolving to array of ChargeItem resources
 */
export async function getPatientCharges(
  medplum: MedplumClient,
  patientId: string
): Promise<ChargeItemSummary[]> {
  try {
    const result = await medplum.search('ChargeItem', {
      subject: `Patient/${patientId}`,
      _count: '200',
    });

    return (result.entry?.map(e => {
      const charge = e.resource as ChargeItem;
      const unitPrice = charge.priceOverride?.value || 0;
      const quantity = charge.quantity?.value || 1;
      return {
        ...charge,
        description: charge.code?.text || charge.code?.coding?.[0]?.display,
        unitPrice,
        totalPrice: unitPrice * quantity,
      };
    }) || []);
  } catch (error) {
    logger.error('Failed to fetch charges', error);
    return [];
  }
}

/**
 * Record a payment
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @param encounterId - ID of the encounter
 * @param payment - Payment details
 * @returns Promise resolving to updated Account resource
 */
export async function recordPayment(
  medplum: MedplumClient,
  patientId: string,
  encounterId: string | undefined,
  payment: PaymentRecord
): Promise<Account> {
  // Get or create account for patient
  const account = await getOrCreatePatientAccount(medplum, patientId);

  // Add payment to account extension
  const payments = account.extension?.filter(
    ext => ext.url === 'http://example.org/fhir/StructureDefinition/payment'
  ) || [];

  payments.push({
    url: 'http://example.org/fhir/StructureDefinition/payment',
    extension: [
      {
        url: 'amount',
        valueMoney: {
          value: payment.amount,
          currency: 'USD',
        },
      },
      {
        url: 'method',
        valueString: payment.method,
      },
      {
        url: 'date',
        valueDateTime: payment.date,
      },
      ...(encounterId ? [{
        url: 'encounter',
        valueReference: { reference: `Encounter/${encounterId}` },
      }] : []),
      ...(payment.notes ? [{
        url: 'notes',
        valueString: payment.notes,
      }] : []),
    ],
  });

  account.extension = [
    ...account.extension?.filter(
      ext => ext.url !== 'http://example.org/fhir/StructureDefinition/payment'
    ) || [],
    ...payments,
  ];

  return medplum.updateResource(account);
}

/**
 * Get or create account for patient
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @returns Promise resolving to Account resource
 */
async function getOrCreatePatientAccount(
  medplum: MedplumClient,
  patientId: string
): Promise<Account> {
  try {
    const result = await medplum.search('Account', {
      subject: `Patient/${patientId}`,
      _count: '1',
    });

    if (result.entry && result.entry.length > 0) {
      return result.entry[0].resource as Account;
    }
  } catch (_error) {
    // Account doesn't exist, create it
  }

  // Create new account
  const account: Account = {
    resourceType: 'Account',
    status: 'active',
    subject: [{
      reference: `Patient/${patientId}`,
    }],
    name: `Account for Patient ${patientId}`,
  };

  return medplum.createResource(account);
}

/**
 * Get billing summary for an encounter
 * @param medplum - Medplum client instance
 * @param encounterId - ID of the encounter
 * @param patientId - ID of the patient
 * @returns Promise resolving to billing summary object
 */
export async function getEncounterBillingSummary(
  medplum: MedplumClient,
  encounterId: string,
  patientId: string
): Promise<BillingSummary> {
  const charges = await getEncounterCharges(medplum, encounterId);
  const account = await getOrCreatePatientAccount(medplum, patientId);

  // Extract payments for this encounter
  const payments: PaymentRecord[] = [];
  const paymentExtensions = account.extension?.filter(
    ext => ext.url === 'http://example.org/fhir/StructureDefinition/payment'
  ) || [];

  for (const paymentExt of paymentExtensions) {
    const encounterRef = paymentExt.extension?.find(e => e.url === 'encounter')?.valueReference;
    if (encounterRef?.reference === `Encounter/${encounterId}`) {
      const amount = paymentExt.extension?.find(e => e.url === 'amount')?.valueMoney?.value || 0;
      const method = paymentExt.extension?.find(e => e.url === 'method')?.valueString as PaymentRecord['method'] || 'cash';
      const date = paymentExt.extension?.find(e => e.url === 'date')?.valueDateTime || new Date().toISOString();
      const notes = paymentExt.extension?.find(e => e.url === 'notes')?.valueString;

      payments.push({ amount, method, date, notes });
    }
  }

  const totalCharges = charges.reduce((sum, charge) => sum + (charge.totalPrice || 0), 0);
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    totalCharges,
    totalPayments,
    balance: totalCharges - totalPayments,
    charges,
    payments,
  };
}

/**
 * Get billing summary for a patient (all encounters)
 * @param medplum - Medplum client instance
 * @param patientId - ID of the patient
 * @returns Promise resolving to billing summary object
 */
export async function getPatientBillingSummary(
  medplum: MedplumClient,
  patientId: string
): Promise<BillingSummary> {
  const charges = await getPatientCharges(medplum, patientId);
  const account = await getOrCreatePatientAccount(medplum, patientId);

  // Extract all payments
  const payments: PaymentRecord[] = [];
  const paymentExtensions = account.extension?.filter(
    ext => ext.url === 'http://example.org/fhir/StructureDefinition/payment'
  ) || [];

  for (const paymentExt of paymentExtensions) {
    const amount = paymentExt.extension?.find(e => e.url === 'amount')?.valueMoney?.value || 0;
    const method = paymentExt.extension?.find(e => e.url === 'method')?.valueString as PaymentRecord['method'] || 'cash';
    const date = paymentExt.extension?.find(e => e.url === 'date')?.valueDateTime || new Date().toISOString();
    const notes = paymentExt.extension?.find(e => e.url === 'notes')?.valueString;

    payments.push({ amount, method, date, notes });
  }

  const totalCharges = charges.reduce((sum, charge) => sum + (charge.totalPrice || 0), 0);
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    totalCharges,
    totalPayments,
    balance: totalCharges - totalPayments,
    charges,
    payments,
  };
}

/**
 * Get pricing from resource extensions
 * @param resource - FHIR resource
 * @returns Pricing value or undefined
 */
export function getPriceFromResource(resource: any): number | undefined {
  const priceExt = resource.extension?.find(
    (ext: any) => ext.url === 'http://example.org/fhir/StructureDefinition/price'
  );
  return priceExt?.valueMoney?.value;
}

/**
 * Set pricing on a resource
 * @param resource - FHIR resource
 * @param price - Pricing value
 * @returns The updated resource
 */
export function setPriceOnResource(resource: any, price: number): any {
  const otherExtensions = resource.extension?.filter(
    (ext: any) => ext.url !== 'http://example.org/fhir/StructureDefinition/price'
  ) || [];

  return {
    ...resource,
    extension: [
      ...otherExtensions,
      {
        url: 'http://example.org/fhir/StructureDefinition/price',
        valueMoney: {
          value: price,
          currency: 'USD',
        },
      },
    ],
  };
}

