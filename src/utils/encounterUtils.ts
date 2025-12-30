import { Observation } from '@medplum/fhirtypes';

// Common vital sign LOINC codes from Medplum documentation
export const VITAL_SIGN_CODES = new Set([
  '8310-5',  // Body temperature
  '8867-4',  // Heart rate
  '9279-1',  // Respiratory rate
  '85354-9', // Blood pressure panel
  '8480-6',  // Systolic BP
  '8462-4',  // Diastolic BP
  '2708-6',  // Oxygen saturation
  '29463-7', // Body weight
  '8302-2',  // Body height
  '39156-5', // BMI
  '8478-0',  // Mean arterial pressure
]);

export const VITAL_KEYWORDS = [
  'blood pressure',
  'heart rate',
  'pulse',
  'temperature',
  'respiratory rate',
  'oxygen',
  'weight',
  'height',
  'bmi',
];

/**
 * Checks if an observation is a vital sign
 */
export function isVitalSign(obs: Observation): boolean {
  const code = obs.code?.coding?.[0]?.code;
  const system = obs.code?.coding?.[0]?.system;
  const category = obs.category?.[0]?.coding?.[0]?.code;
  const display = obs.code?.coding?.[0]?.display?.toLowerCase() || '';
  
  // Check if categorized as vital-signs
  if (category === 'vital-signs') {
    return true;
  }
  
  // Check if it has a vital sign LOINC code
  if (system === 'http://loinc.org' && VITAL_SIGN_CODES.has(code || '')) {
    return true;
  }
  
  // Check display name for common vital keywords
  return VITAL_KEYWORDS.some(keyword => display.includes(keyword));
}

/**
 * Groups observations by their effective date/time (rounded to minute)
 */
export function groupObservationsByTime(observations: Observation[]): Record<string, Observation[]> {
  return observations.reduce<Record<string, Observation[]>>((acc, obs) => {
    const timestamp = obs.effectiveDateTime || 'Unknown';
    const key = timestamp ? new Date(timestamp).toISOString().slice(0, 16) : 'Unknown';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(obs);
    return acc;
  }, {});
}

/**
 * Helper to get badge color based on encounter status
 */
export function getEncounterStatusColor(status?: string): string {
  if (status === 'finished') {
    return 'green';
  }
  if (status === 'in-progress') {
    return 'blue';
  }
  return 'gray';
}

/**
 * Helper to get badge color based on observation interpretation
 */
export function getInterpretationColor(code?: string): string {
  if (code === 'H') {
    return 'red';
  }
  if (code === 'L') {
    return 'blue';
  }
  return 'green';
}

/**
 * Helper to get badge color based on service request status
 */
export function getServiceRequestStatusColor(status?: string): string {
  if (status === 'completed') {
    return 'green';
  }
  if (status === 'active') {
    return 'blue';
  }
  if (status === 'on-hold') {
    return 'yellow';
  }
  if (status === 'revoked') {
    return 'red';
  }
  return 'gray';
}

/**
 * Helper to get badge color based on diagnostic report status
 */
export function getDiagnosticReportStatusColor(status?: string): string {
  if (status === 'final') {
    return 'green';
  }
  if (status === 'preliminary') {
    return 'yellow';
  }
  return 'gray';
}

