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
  color: string;
  // i18n keys; resolve via t() at the display site.
  labelKey: string;
  descriptionKey: string;
  timeTargetKey: string;
}

/**
 * ESI Triage Levels — color + i18n key references for label/description/timeTarget.
 * Healthcare Agent requirement: Document ESI system clearly. Strings live in
 * src/i18n/en.json and es.json under queue.triage.level{N}.{name|description|timeTarget}.
 */
export const TRIAGE_LEVELS: Record<number, TriageLevelInfo> = {
  1: {
    level: 1,
    color: 'red',
    labelKey: 'queue.triage.level1.name',
    descriptionKey: 'queue.triage.level1.description',
    timeTargetKey: 'queue.triage.level1.timeTarget',
  },
  2: {
    level: 2,
    color: 'orange',
    labelKey: 'queue.triage.level2.name',
    descriptionKey: 'queue.triage.level2.description',
    timeTargetKey: 'queue.triage.level2.timeTarget',
  },
  3: {
    level: 3,
    color: 'yellow',
    labelKey: 'queue.triage.level3.name',
    descriptionKey: 'queue.triage.level3.description',
    timeTargetKey: 'queue.triage.level3.timeTarget',
  },
  4: {
    level: 4,
    color: 'green',
    labelKey: 'queue.triage.level4.name',
    descriptionKey: 'queue.triage.level4.description',
    timeTargetKey: 'queue.triage.level4.timeTarget',
  },
  5: {
    level: 5,
    color: 'blue',
    labelKey: 'queue.triage.level5.name',
    descriptionKey: 'queue.triage.level5.description',
    timeTargetKey: 'queue.triage.level5.timeTarget',
  },
} as const;

/**
 * FHIR Task Priority mapping
 * Healthcare Agent requirement: ESI → FHIR priority mapping
 *
 * `labelKey` resolves via t() at display site (queue.priority.{code}).
 */
export const PRIORITY_CODES = {
  routine: {
    code: 'routine',
    labelKey: 'queue.priority.routine',
    color: 'green',
    sortOrder: 3,
  },
  urgent: {
    code: 'urgent',
    labelKey: 'queue.priority.urgent',
    color: 'yellow',
    sortOrder: 2,
  },
  asap: {
    code: 'asap',
    labelKey: 'queue.priority.asap',
    color: 'orange',
    sortOrder: 1,
  },
  stat: {
    code: 'stat',
    labelKey: 'queue.priority.stat',
    color: 'red',
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
 * Get triage level color for UI display.
 * Returns gray for unknown levels (defensive against bad data).
 */
export function getTriageLevelColor(level: TriageLevel): string {
  return TRIAGE_LEVELS[level]?.color ?? 'gray';
}

/**
 * Get FHIR priority color
 */
export function getPriorityColor(priority: FhirPriority): string {
  return PRIORITY_CODES[priority].color;
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

export interface WaitTimeFormat {
  /** i18n key — resolve at display site via t(key, params). */
  key: string;
  params: Record<string, number>;
}

/**
 * Format wait time as an i18n key + params. Display sites translate via t().
 * Uses i18next plural suffixes (_one / _other) for "minutes" and "hours".
 */
export function formatWaitTime(minutes: number): WaitTimeFormat {
  if (minutes < 1) {
    return { key: 'queue.waitTime.justArrived', params: {} };
  }
  if (minutes < 60) {
    return { key: 'queue.waitTime.minute', params: { count: minutes } };
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return { key: 'queue.waitTime.hour', params: { count: hours } };
  }

  return { key: 'queue.waitTime.hoursMinutes', params: { hours, minutes: remainingMinutes } };
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
 * Get triage level badge props for Mantine Badge component.
 * Display sites translate via t(labelKey, labelParams).
 */
export function getTriageBadgeProps(level: TriageLevel): {
  color: string;
  variant: 'filled' | 'light' | 'outline';
  labelKey: string;
  labelParams: { level: number; nameKey: string };
} {
  const info = TRIAGE_LEVELS[level];
  return {
    color: info.color,
    variant: level <= 2 ? 'filled' : 'light',
    labelKey: 'queue.triage.badgeLabel',
    labelParams: { level, nameKey: info.labelKey },
  };
}

/**
 * Get priority badge props for Mantine Badge component.
 * Display sites translate via t(labelKey).
 */
export function getPriorityBadgeProps(priority: FhirPriority): {
  color: string;
  variant: 'filled' | 'light' | 'outline';
  labelKey: string;
} {
  const info = PRIORITY_CODES[priority];
  return {
    color: info.color,
    variant: priority === 'stat' || priority === 'asap' ? 'filled' : 'light',
    labelKey: info.labelKey,
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
