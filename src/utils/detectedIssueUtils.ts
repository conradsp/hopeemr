/**
 * DetectedIssue FHIR Resource Utilities
 * Helpers for creating audit trail records for clinical alerts
 */

import { DetectedIssue, Patient, Encounter, Observation, Practitioner, PractitionerRole } from '@medplum/fhirtypes';
import { MedplumClient } from '@medplum/core';
import { CriticalAlert, VitalType } from '../types/clinicalAlerts.types';

/**
 * SNOMED CT codes for clinical alert conditions
 */
const ALERT_CODES: Record<string, { system: string; code: string; display: string }> = {
  // Blood pressure conditions
  criticalHypertension: {
    system: 'http://snomed.info/sct',
    code: '38341003',
    display: 'Hypertensive crisis',
  },
  criticalHypotension: {
    system: 'http://snomed.info/sct',
    code: '45007003',
    display: 'Low blood pressure',
  },
  // Heart rate conditions
  criticalTachycardia: {
    system: 'http://snomed.info/sct',
    code: '3424008',
    display: 'Tachycardia',
  },
  criticalBradycardia: {
    system: 'http://snomed.info/sct',
    code: '48867003',
    display: 'Bradycardia',
  },
  // Temperature conditions
  criticalHyperthermia: {
    system: 'http://snomed.info/sct',
    code: '386661006',
    display: 'Fever',
  },
  criticalHypothermia: {
    system: 'http://snomed.info/sct',
    code: '386689009',
    display: 'Hypothermia',
  },
  // Oxygen saturation
  criticalHypoxia: {
    system: 'http://snomed.info/sct',
    code: '389086002',
    display: 'Hypoxia',
  },
  // Respiratory rate conditions
  criticalTachypnea: {
    system: 'http://snomed.info/sct',
    code: '271823003',
    display: 'Tachypnea',
  },
  criticalBradypnea: {
    system: 'http://snomed.info/sct',
    code: '86684002',
    display: 'Bradypnea',
  },
  // Blood glucose conditions
  criticalHyperglycemia: {
    system: 'http://snomed.info/sct',
    code: '80394007',
    display: 'Hyperglycemia',
  },
  criticalHypoglycemia: {
    system: 'http://snomed.info/sct',
    code: '302866003',
    display: 'Hypoglycemia',
  },
  // Generic fallback
  criticalValue: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'CRIT',
    display: 'Critical value',
  },
};

/**
 * Get the appropriate SNOMED code for a critical alert
 * @param alert - The critical alert
 * @returns The SNOMED code object for the alert type
 */
export function getAlertCode(alert: CriticalAlert): { system: string; code: string; display: string } {
  const { vitalType, direction } = alert;

  switch (vitalType) {
    case 'bloodPressureSystolic':
    case 'bloodPressureDiastolic':
      return direction === 'high' ? ALERT_CODES.criticalHypertension : ALERT_CODES.criticalHypotension;

    case 'heartRate':
      return direction === 'high' ? ALERT_CODES.criticalTachycardia : ALERT_CODES.criticalBradycardia;

    case 'temperature':
      return direction === 'high' ? ALERT_CODES.criticalHyperthermia : ALERT_CODES.criticalHypothermia;

    case 'oxygenSaturation':
      return ALERT_CODES.criticalHypoxia;

    case 'respiratoryRate':
      return direction === 'high' ? ALERT_CODES.criticalTachypnea : ALERT_CODES.criticalBradypnea;

    case 'bloodGlucose':
      return direction === 'high' ? ALERT_CODES.criticalHyperglycemia : ALERT_CODES.criticalHypoglycemia;

    default:
      return ALERT_CODES.criticalValue;
  }
}

/**
 * Get the patient display name
 */
function getPatientDisplay(patient: Patient): string {
  if (patient.name?.[0]?.text) {
    return patient.name[0].text;
  }
  const parts = [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean);
  return parts.join(' ') || 'Unknown Patient';
}

/**
 * Get direction-based threshold value
 */
function getThresholdValue(alert: CriticalAlert): number | undefined {
  return alert.direction === 'high' ? alert.threshold.criticalHigh : alert.threshold.criticalLow;
}

/**
 * Get a descriptive vital type name for the detail text
 */
function getVitalTypeName(vitalType: VitalType): string {
  const names: Record<VitalType, string> = {
    bloodPressureSystolic: 'Systolic Blood Pressure',
    bloodPressureDiastolic: 'Diastolic Blood Pressure',
    heartRate: 'Heart Rate',
    respiratoryRate: 'Respiratory Rate',
    temperature: 'Temperature',
    oxygenSaturation: 'Oxygen Saturation',
    bloodGlucose: 'Blood Glucose',
  };
  return names[vitalType];
}

/**
 * Build a DetectedIssue FHIR resource for a critical alert
 * @param alert - The critical alert that was acknowledged
 * @param patient - The patient for whom the alert was detected
 * @param encounter - The encounter context
 * @param author - The practitioner who acknowledged the alert
 * @param observations - Related observations (may be empty if not yet created)
 * @returns A DetectedIssue resource ready to be saved
 */
export function buildDetectedIssueResource(
  alert: CriticalAlert,
  patient: Patient,
  encounter: Encounter,
  author: Practitioner | PractitionerRole,
  observations: Observation[] = []
): DetectedIssue {
  const alertCode = getAlertCode(alert);
  const thresholdValue = getThresholdValue(alert);
  const vitalName = getVitalTypeName(alert.vitalType);
  const direction = alert.direction === 'high' ? 'above' : 'below';

  const detectedIssue: DetectedIssue = {
    resourceType: 'DetectedIssue',
    status: 'final',
    code: {
      coding: [alertCode],
      text: alertCode.display,
    },
    severity: alert.severity,
    patient: {
      reference: `Patient/${patient.id}`,
      display: getPatientDisplay(patient),
    },
    identifiedDateTime: new Date().toISOString(),
    author: {
      reference: `${author.resourceType}/${author.id}`,
    },
    detail: `Critical ${vitalName}: ${alert.value} ${alert.threshold.unit} (${direction} threshold of ${thresholdValue} ${alert.threshold.unit})`,
    mitigation: [
      {
        action: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: 'ACK',
              display: 'Acknowledged',
            },
          ],
          text: 'Provider acknowledged critical alert',
        },
        date: alert.acknowledgedAt || new Date().toISOString(),
        author: {
          reference: `${author.resourceType}/${author.id}`,
        },
      },
    ],
  };

  // Add reference to encounter if available
  if (encounter.id) {
    detectedIssue.extension = [
      {
        url: 'http://medplum.com/fhir/StructureDefinition/encounter-reference',
        valueReference: {
          reference: `Encounter/${encounter.id}`,
        },
      },
    ];
  }

  // Add implicated observations if available
  if (observations.length > 0) {
    detectedIssue.implicated = observations.map((obs) => ({
      reference: `Observation/${obs.id}`,
    }));
  }

  return detectedIssue;
}

/**
 * Create DetectedIssue resources for a list of acknowledged critical alerts
 * @param medplum - The MedplumClient instance
 * @param alerts - Array of acknowledged critical alerts
 * @param patient - The patient for whom alerts were detected
 * @param encounter - The encounter context
 * @param observations - Related observations that were created
 * @returns Array of created DetectedIssue resources
 */
export async function createDetectedIssues(
  medplum: MedplumClient,
  alerts: CriticalAlert[],
  patient: Patient,
  encounter: Encounter,
  observations: Observation[] = []
): Promise<DetectedIssue[]> {
  const profile = medplum.getProfile();
  if (!profile) {
    throw new Error('No authenticated user profile found');
  }

  const createdIssues: DetectedIssue[] = [];

  for (const alert of alerts) {
    if (alert.acknowledged) {
      const issue = buildDetectedIssueResource(
        alert,
        patient,
        encounter,
        profile as Practitioner | PractitionerRole,
        observations
      );
      const created = await medplum.createResource(issue);
      createdIssues.push(created);
    }
  }

  return createdIssues;
}
