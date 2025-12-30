/**
 * Critical Thresholds Configuration and Validation
 * Defines critical value thresholds for vital signs and provides validation functions
 */

import { CriticalThreshold, CriticalAlert, VitalType, VitalsValidationResult, VitalsData } from '../types/clinicalAlerts.types';

/**
 * Generate unique ID for alerts
 */
function generateAlertId(): string {
  return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Critical thresholds for vital signs
 * Based on LOW-RESOURCE-PROVIDER-RECOMMENDATIONS.md
 *
 * These thresholds represent values that require immediate attention:
 * - Blood Pressure: > 180/120 (hypertensive crisis) or < 90/60 (hypotension)
 * - Temperature: > 102.2°F (39°C) or < 95°F (35°C)
 * - Heart Rate: > 120 (tachycardia) or < 50 (bradycardia)
 * - Respiratory Rate: > 30 (tachypnea) or < 10 (bradypnea)
 * - Oxygen Saturation: < 90% (hypoxia)
 * - Blood Glucose: < 70 (hypoglycemia) or > 400 (severe hyperglycemia)
 */
export const CRITICAL_THRESHOLDS: Record<VitalType, CriticalThreshold> = {
  bloodPressureSystolic: {
    vitalType: 'bloodPressureSystolic',
    loincCode: '8480-6',
    criticalHigh: 180,
    criticalLow: 90,
    unit: 'mmHg',
    severity: 'high',
  },
  bloodPressureDiastolic: {
    vitalType: 'bloodPressureDiastolic',
    loincCode: '8462-4',
    criticalHigh: 120,
    criticalLow: 60,
    unit: 'mmHg',
    severity: 'high',
  },
  heartRate: {
    vitalType: 'heartRate',
    loincCode: '8867-4',
    criticalHigh: 120,
    criticalLow: 50,
    unit: 'bpm',
    severity: 'high',
  },
  respiratoryRate: {
    vitalType: 'respiratoryRate',
    loincCode: '9279-1',
    criticalHigh: 30,
    criticalLow: 10,
    unit: '/min',
    severity: 'high',
  },
  temperature: {
    vitalType: 'temperature',
    loincCode: '8310-5',
    criticalHigh: 102.2, // 39°C in Fahrenheit
    criticalLow: 95, // 35°C in Fahrenheit
    unit: '°F',
    severity: 'high',
  },
  oxygenSaturation: {
    vitalType: 'oxygenSaturation',
    loincCode: '2708-6',
    criticalLow: 90,
    // No critical high - 100% is not critical
    unit: '%',
    severity: 'high',
  },
  bloodGlucose: {
    vitalType: 'bloodGlucose',
    loincCode: '2345-7',
    criticalHigh: 400,
    criticalLow: 70,
    unit: 'mg/dL',
    severity: 'high',
  },
};

/**
 * Check a single value against its threshold
 * @param value - The measured value
 * @param threshold - The threshold configuration
 * @param vitalType - Type of vital being checked
 * @returns CriticalAlert if threshold exceeded, null otherwise
 */
function checkThreshold(
  value: number,
  threshold: CriticalThreshold,
  vitalType: VitalType
): CriticalAlert | null {
  // Check critical high (>= to include exact threshold value)
  if (threshold.criticalHigh !== undefined && value >= threshold.criticalHigh) {
    return {
      id: generateAlertId(),
      vitalType,
      value,
      threshold,
      direction: 'high',
      severity: threshold.severity,
      acknowledged: false,
    };
  }

  // Check critical low (<= to include exact threshold value)
  if (threshold.criticalLow !== undefined && value <= threshold.criticalLow) {
    return {
      id: generateAlertId(),
      vitalType,
      value,
      threshold,
      direction: 'low',
      severity: threshold.severity,
      acknowledged: false,
    };
  }

  return null;
}

/**
 * Evaluate vitals data for critical values
 * @param vitals - The vitals data from the form
 * @returns Validation result with any detected critical alerts
 */
export function evaluateVitalsForCriticalAlerts(vitals: VitalsData): VitalsValidationResult {
  const criticalAlerts: CriticalAlert[] = [];

  // Blood Pressure Systolic
  if (vitals.bloodPressureSystolic) {
    const value = parseFloat(vitals.bloodPressureSystolic);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.bloodPressureSystolic, 'bloodPressureSystolic');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  // Blood Pressure Diastolic
  if (vitals.bloodPressureDiastolic) {
    const value = parseFloat(vitals.bloodPressureDiastolic);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.bloodPressureDiastolic, 'bloodPressureDiastolic');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  // Heart Rate
  if (vitals.heartRate) {
    const value = parseFloat(vitals.heartRate);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.heartRate, 'heartRate');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  // Respiratory Rate
  if (vitals.respiratoryRate) {
    const value = parseFloat(vitals.respiratoryRate);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.respiratoryRate, 'respiratoryRate');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  // Temperature
  if (vitals.temperature) {
    const value = parseFloat(vitals.temperature);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.temperature, 'temperature');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  // Oxygen Saturation
  if (vitals.oxygenSaturation) {
    const value = parseFloat(vitals.oxygenSaturation);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.oxygenSaturation, 'oxygenSaturation');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  // Blood Glucose
  if (vitals.bloodGlucose) {
    const value = parseFloat(vitals.bloodGlucose);
    if (!isNaN(value)) {
      const alert = checkThreshold(value, CRITICAL_THRESHOLDS.bloodGlucose, 'bloodGlucose');
      if (alert) {
        criticalAlerts.push(alert);
      }
    }
  }

  return {
    isValid: criticalAlerts.length === 0,
    criticalAlerts,
  };
}

/**
 * Get the display name for a vital type (for debugging/logging)
 * Note: Use i18n translations for user-facing text
 */
export function getVitalTypeDisplayName(vitalType: VitalType): string {
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
