/**
 * Clinical Alerts Type Definitions
 * Types for critical value detection and alert management
 */

import { Patient, Encounter, Practitioner, PractitionerRole, Reference } from '@medplum/fhirtypes';

/**
 * Severity level for clinical alerts
 */
export type CriticalAlertSeverity = 'high' | 'moderate' | 'low';

/**
 * Types of vitals that can trigger critical alerts
 */
export type VitalType =
  | 'bloodPressureSystolic'
  | 'bloodPressureDiastolic'
  | 'heartRate'
  | 'respiratoryRate'
  | 'temperature'
  | 'oxygenSaturation'
  | 'bloodGlucose';

/**
 * Configuration for a critical threshold
 */
export interface CriticalThreshold {
  /** Type of vital sign */
  vitalType: VitalType;
  /** LOINC code for the vital */
  loincCode: string;
  /** Value above which is critical (undefined if no upper limit) */
  criticalHigh?: number;
  /** Value below which is critical (undefined if no lower limit) */
  criticalLow?: number;
  /** Unit of measurement */
  unit: string;
  /** Severity level of the alert */
  severity: CriticalAlertSeverity;
}

/**
 * A detected critical alert
 */
export interface CriticalAlert {
  /** Unique identifier for this alert instance */
  id: string;
  /** Type of vital sign */
  vitalType: VitalType;
  /** The recorded value that triggered the alert */
  value: number;
  /** The threshold configuration that was exceeded */
  threshold: CriticalThreshold;
  /** Whether the value is high or low */
  direction: 'high' | 'low';
  /** Severity level */
  severity: CriticalAlertSeverity;
  /** Whether the alert has been acknowledged */
  acknowledged: boolean;
  /** Timestamp when acknowledged */
  acknowledgedAt?: string;
  /** Reference to who acknowledged */
  acknowledgedBy?: Reference<Practitioner | PractitionerRole>;
}

/**
 * Result of validating vitals for critical values
 */
export interface VitalsValidationResult {
  /** True if no critical values detected */
  isValid: boolean;
  /** Array of detected critical alerts */
  criticalAlerts: CriticalAlert[];
}

/**
 * Props for the CriticalAlertModal component
 */
export interface CriticalAlertModalProps {
  /** Whether the modal is open */
  opened: boolean;
  /** Array of critical alerts to display */
  alerts: CriticalAlert[];
  /** Patient for whom alerts were detected */
  patient: Patient;
  /** Encounter context */
  encounter: Encounter;
  /** Callback when alerts are acknowledged */
  onAcknowledge: (alerts: CriticalAlert[]) => void;
  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * Vitals data structure from RecordVitalsModal
 */
export interface VitalsData {
  bloodPressureSystolic: string;
  bloodPressureDiastolic: string;
  heartRate: string;
  respiratoryRate: string;
  temperature: string;
  oxygenSaturation: string;
  bloodGlucose: string;
  weight: string;
  height: string;
}
