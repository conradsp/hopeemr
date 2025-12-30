/**
 * Triage Level Utilities
 *
 * Implements Emergency Severity Index (ESI) triage system
 * ESI is a 5-level triage system used in emergency departments
 *
 * Reference: https://www.ahrq.gov/patient-safety/settings/emergency-dept/esi.html
 */

export interface TriageLevelInfo {
  level: number;
  label: string;
  color: string;
  description: string;
  timeTarget: string;
  examples: string[];
}

/**
 * ESI Triage Levels with clinical descriptions
 * Healthcare Agent requirement: Document ESI system clearly
 */
export const TRIAGE_LEVELS: Record<number, TriageLevelInfo> = {
  1: {
    level: 1,
    label: 'Resuscitation',
    color: 'red',
    description: 'Immediate life-saving intervention required',
    timeTarget: 'Immediate (0 min)',
    examples: [
      'Cardiac arrest',
      'Severe respiratory distress',
      'Unresponsive',
      'Severe hemorrhage',
      'Major trauma with unstable vitals',
    ],
  },
  2: {
    level: 2,
    label: 'Emergent',
    color: 'orange',
    description: 'High risk situation, potential for deterioration',
    timeTarget: 'Within 10 minutes',
    examples: [
      'Chest pain with cardiac risk factors',
      'Altered mental status',
      'Severe pain (8-10/10)',
      'Difficulty breathing',
      'Severe dehydration',
    ],
  },
  3: {
    level: 3,
    label: 'Urgent',
    color: 'yellow',
    description: 'Moderate acuity, multiple resources needed',
    timeTarget: 'Within 30 minutes',
    examples: [
      'Moderate pain (5-7/10)',
      'Abdominal pain',
      'Fever with concerning symptoms',
      'Minor trauma requiring evaluation',
      'Moderate bleeding',
    ],
  },
  4: {
    level: 4,
    label: 'Less Urgent',
    color: 'green',
    description: 'Low acuity, one resource needed',
    timeTarget: 'Within 60 minutes',
    examples: [
      'Mild pain (2-4/10)',
      'Minor injuries',
      'Sore throat',
      'Rash without systemic symptoms',
      'Chronic condition follow-up',
    ],
  },
  5: {
    level: 5,
    label: 'Non-Urgent',
    color: 'blue',
    description: 'Minor symptoms, no resources needed immediately',
    timeTarget: 'Within 120 minutes',
    examples: [
      'Medication refill',
      'Minor cold symptoms',
      'Prescription renewal',
      'Minor questions',
      'Follow-up appointment',
    ],
  },
} as const;

/**
 * FHIR Task Priority mapping
 * Healthcare Agent requirement: ESI → FHIR priority mapping
 */
export const PRIORITY_CODES = {
  routine: {
    code: 'routine',
    display: 'Routine',
    color: 'green',
    description: 'Normal priority',
    sortOrder: 3,
  },
  urgent: {
    code: 'urgent',
    display: 'Urgent',
    color: 'yellow',
    description: 'Urgent priority',
    sortOrder: 2,
  },
  asap: {
    code: 'asap',
    display: 'ASAP',
    color: 'orange',
    description: 'As soon as possible',
    sortOrder: 1,
  },
  stat: {
    code: 'stat',
    display: 'STAT',
    color: 'red',
    description: 'Immediate attention required',
    sortOrder: 0,
  },
} as const;

export type TriageLevel = 1 | 2 | 3 | 4 | 5;
export type FhirPriority = 'routine' | 'urgent' | 'asap' | 'stat';

/**
 * Get triage level information
 */
export function getTriageLevelInfo(level: TriageLevel): TriageLevelInfo {
  return TRIAGE_LEVELS[level];
}

/**
 * Get triage level color for UI display
 */
export function getTriageLevelColor(level: TriageLevel): string {
  return TRIAGE_LEVELS[level].color;
}

/**
 * Get triage level label
 */
export function getTriageLevelLabel(level: TriageLevel): string {
  return TRIAGE_LEVELS[level].label;
}

/**
 * Get FHIR priority color
 */
export function getPriorityColor(priority: FhirPriority): string {
  return PRIORITY_CODES[priority].color;
}

/**
 * Get FHIR priority display name
 */
export function getPriorityDisplay(priority: FhirPriority): string {
  return PRIORITY_CODES[priority].display;
}

/**
 * Get FHIR priority sort order (lower number = higher priority)
 */
export function getPrioritySortOrder(priority: FhirPriority): number {
  return PRIORITY_CODES[priority].sortOrder;
}

/**
 * Suggest FHIR priority from ESI triage level
 * Healthcare Agent requirement: Documented ESI → FHIR priority mapping
 *
 * @param triageLevel - ESI triage level (1-5)
 * @returns FHIR Task priority code
 */
export function suggestPriorityFromTriage(triageLevel: TriageLevel): FhirPriority {
  switch (triageLevel) {
    case 1:
    case 2:
      return 'stat'; // ESI 1-2: Life-threatening, immediate
    case 3:
      return 'urgent'; // ESI 3: Urgent, within 30 min
    case 4:
    case 5:
    default:
      return 'routine'; // ESI 4-5: Non-urgent
  }
}

/**
 * Suggest ESI triage level from vital signs
 * Healthcare Agent requirement: Auto-escalate priority based on vitals
 *
 * This is a simplified algorithm. In production, use complete ESI decision tree.
 *
 * @param vitals - Patient vital signs
 * @returns Suggested ESI level
 */
export function suggestTriageLevelFromVitals(vitals: {
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  temperature?: number; // Celsius
}): TriageLevel {
  // ESI Level 1: Immediate (Life-threatening)
  if (
    (vitals.heartRate !== undefined && (vitals.heartRate < 40 || vitals.heartRate > 150)) ||
    (vitals.systolicBP !== undefined && (vitals.systolicBP < 80 || vitals.systolicBP > 200)) ||
    (vitals.respiratoryRate !== undefined && (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 35)) ||
    (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation < 85)
  ) {
    return 1; // Resuscitation
  }

  // ESI Level 2: Emergent (High risk)
  if (
    (vitals.heartRate !== undefined && (vitals.heartRate < 50 || vitals.heartRate > 120)) ||
    (vitals.systolicBP !== undefined && (vitals.systolicBP < 90 || vitals.systolicBP > 180)) ||
    (vitals.diastolicBP !== undefined && vitals.diastolicBP > 120) ||
    (vitals.respiratoryRate !== undefined && (vitals.respiratoryRate < 10 || vitals.respiratoryRate > 30)) ||
    (vitals.oxygenSaturation !== undefined && vitals.oxygenSaturation < 90) ||
    (vitals.temperature !== undefined && (vitals.temperature < 35 || vitals.temperature > 39))
  ) {
    return 2; // Emergent
  }

  // ESI Level 3: Urgent (Moderate acuity)
  if (
    (vitals.heartRate !== undefined && (vitals.heartRate < 60 || vitals.heartRate > 100)) ||
    (vitals.systolicBP !== undefined && (vitals.systolicBP < 100 || vitals.systolicBP > 160)) ||
    (vitals.temperature !== undefined && vitals.temperature > 38.3)
  ) {
    return 3; // Urgent
  }

  // ESI Level 4: Less urgent (Stable)
  return 4;
}

/**
 * Get wait time color based on duration and priority
 * Security/UX: Visual indicators for long wait times
 *
 * @param waitTimeMinutes - Wait time in minutes
 * @param priority - FHIR priority level
 * @returns Color code for UI
 */
export function getWaitTimeColor(waitTimeMinutes: number, priority: FhirPriority): string {
  // STAT patients: Red if waiting > 5 minutes
  if (priority === 'stat') {
    return waitTimeMinutes > 5 ? 'red' : 'green';
  }

  // ASAP patients: Orange if waiting > 15 minutes
  if (priority === 'asap') {
    if (waitTimeMinutes > 15) return 'red';
    if (waitTimeMinutes > 10) return 'orange';
    return 'green';
  }

  // Urgent patients: Yellow if waiting > 30 minutes
  if (priority === 'urgent') {
    if (waitTimeMinutes > 30) return 'red';
    if (waitTimeMinutes > 20) return 'orange';
    return 'green';
  }

  // Routine patients: Green if < 60 minutes
  if (waitTimeMinutes < 30) return 'green';
  if (waitTimeMinutes < 60) return 'yellow';
  if (waitTimeMinutes < 90) return 'orange';
  return 'red';
}

/**
 * Format wait time for display
 */
export function formatWaitTime(minutes: number): string {
  if (minutes < 1) return 'Just arrived';
  if (minutes === 1) return '1 minute';
  if (minutes < 60) return `${minutes} minutes`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Calculate estimated wait time based on queue position and average consultation time
 *
 * @param queuePosition - Position in queue (1-based)
 * @param averageConsultationTime - Average time per patient in minutes
 * @returns Estimated wait time in minutes
 */
export function calculateEstimatedWait(
  queuePosition: number,
  averageConsultationTime: number = 15
): number {
  return (queuePosition - 1) * averageConsultationTime;
}

/**
 * Get triage level badge props for Mantine Badge component
 */
export function getTriageBadgeProps(level: TriageLevel): {
  color: string;
  variant: 'filled' | 'light' | 'outline';
  label: string;
} {
  const info = TRIAGE_LEVELS[level];
  return {
    color: info.color,
    variant: level <= 2 ? 'filled' : 'light',
    label: `ESI ${level} - ${info.label}`,
  };
}

/**
 * Get priority badge props for Mantine Badge component
 */
export function getPriorityBadgeProps(priority: FhirPriority): {
  color: string;
  variant: 'filled' | 'light' | 'outline';
  label: string;
} {
  const info = PRIORITY_CODES[priority];
  return {
    color: info.color,
    variant: priority === 'stat' || priority === 'asap' ? 'filled' : 'light',
    label: info.display.toUpperCase(),
  };
}

/**
 * Validate triage level
 */
export function isValidTriageLevel(level: number): level is TriageLevel {
  return level >= 1 && level <= 5;
}

/**
 * Validate FHIR priority
 */
export function isValidPriority(priority: string): priority is FhirPriority {
  return ['routine', 'urgent', 'asap', 'stat'].includes(priority);
}
