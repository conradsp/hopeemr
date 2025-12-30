import { describe, it, expect } from 'vitest';
import { evaluateVitalsForCriticalAlerts, CRITICAL_THRESHOLDS } from './criticalThresholds';
import { VitalsData } from '../types/clinicalAlerts.types';

describe('criticalThresholds', () => {
  describe('CRITICAL_THRESHOLDS', () => {
    it('should have critical thresholds defined for all vital types', () => {
      expect(CRITICAL_THRESHOLDS.bloodPressureSystolic).toBeDefined();
      expect(CRITICAL_THRESHOLDS.bloodPressureDiastolic).toBeDefined();
      expect(CRITICAL_THRESHOLDS.heartRate).toBeDefined();
      expect(CRITICAL_THRESHOLDS.respiratoryRate).toBeDefined();
      expect(CRITICAL_THRESHOLDS.temperature).toBeDefined();
      expect(CRITICAL_THRESHOLDS.oxygenSaturation).toBeDefined();
      expect(CRITICAL_THRESHOLDS.bloodGlucose).toBeDefined();
    });

    it('should have correct threshold values for blood pressure', () => {
      expect(CRITICAL_THRESHOLDS.bloodPressureSystolic.criticalHigh).toBe(180);
      expect(CRITICAL_THRESHOLDS.bloodPressureSystolic.criticalLow).toBe(90);
      expect(CRITICAL_THRESHOLDS.bloodPressureDiastolic.criticalHigh).toBe(120);
      expect(CRITICAL_THRESHOLDS.bloodPressureDiastolic.criticalLow).toBe(60);
    });

    it('should have correct threshold values for heart rate', () => {
      expect(CRITICAL_THRESHOLDS.heartRate.criticalHigh).toBe(120);
      expect(CRITICAL_THRESHOLDS.heartRate.criticalLow).toBe(50);
    });

    it('should have correct threshold values for oxygen saturation', () => {
      expect(CRITICAL_THRESHOLDS.oxygenSaturation.criticalLow).toBe(90);
      expect(CRITICAL_THRESHOLDS.oxygenSaturation.criticalHigh).toBeUndefined();
    });
  });

  describe('evaluateVitalsForCriticalAlerts', () => {
    const emptyVitals: VitalsData = {
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      heartRate: '',
      respiratoryRate: '',
      temperature: '',
      oxygenSaturation: '',
      bloodGlucose: '',
      weight: '',
      height: '',
    };

    it('should return no alerts for normal vitals', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '120',
        bloodPressureDiastolic: '80',
        heartRate: '70',
        respiratoryRate: '16',
        temperature: '98.6',
        oxygenSaturation: '98',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(true);
      expect(result.criticalAlerts).toHaveLength(0);
    });

    it('should return no alerts for empty vitals', () => {
      const result = evaluateVitalsForCriticalAlerts(emptyVitals);
      expect(result.isValid).toBe(true);
      expect(result.criticalAlerts).toHaveLength(0);
    });

    it('should detect critical high systolic blood pressure', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '185',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('bloodPressureSystolic');
      expect(result.criticalAlerts[0].direction).toBe('high');
      expect(result.criticalAlerts[0].value).toBe(185);
    });

    it('should detect critical low systolic blood pressure', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '85',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('bloodPressureSystolic');
      expect(result.criticalAlerts[0].direction).toBe('low');
    });

    it('should detect critical high diastolic blood pressure', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureDiastolic: '125',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('bloodPressureDiastolic');
      expect(result.criticalAlerts[0].direction).toBe('high');
    });

    it('should detect critical low oxygen saturation', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        oxygenSaturation: '85',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('oxygenSaturation');
      expect(result.criticalAlerts[0].direction).toBe('low');
    });

    it('should NOT detect high oxygen saturation (100% is normal)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        oxygenSaturation: '100',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(true);
      expect(result.criticalAlerts).toHaveLength(0);
    });

    it('should detect critical high heart rate (tachycardia)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        heartRate: '130',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('heartRate');
      expect(result.criticalAlerts[0].direction).toBe('high');
    });

    it('should detect critical low heart rate (bradycardia)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        heartRate: '45',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('heartRate');
      expect(result.criticalAlerts[0].direction).toBe('low');
    });

    it('should detect critical high temperature (hyperthermia)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        temperature: '104',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('temperature');
      expect(result.criticalAlerts[0].direction).toBe('high');
    });

    it('should detect critical low temperature (hypothermia)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        temperature: '94',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('temperature');
      expect(result.criticalAlerts[0].direction).toBe('low');
    });

    it('should detect critical high respiratory rate (tachypnea)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        respiratoryRate: '35',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('respiratoryRate');
      expect(result.criticalAlerts[0].direction).toBe('high');
    });

    it('should detect critical low respiratory rate (bradypnea)', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        respiratoryRate: '8',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts).toHaveLength(1);
      expect(result.criticalAlerts[0].vitalType).toBe('respiratoryRate');
      expect(result.criticalAlerts[0].direction).toBe('low');
    });

    it('should detect multiple critical values at once', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '190',
        bloodPressureDiastolic: '130',
        heartRate: '130',
        oxygenSaturation: '85',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(false);
      expect(result.criticalAlerts.length).toBeGreaterThanOrEqual(4);

      const vitalTypes = result.criticalAlerts.map(a => a.vitalType);
      expect(vitalTypes).toContain('bloodPressureSystolic');
      expect(vitalTypes).toContain('bloodPressureDiastolic');
      expect(vitalTypes).toContain('heartRate');
      expect(vitalTypes).toContain('oxygenSaturation');
    });

    it('should not trigger on borderline normal values', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '180', // Exactly at threshold, not above
        bloodPressureDiastolic: '120', // Exactly at threshold, not above
        heartRate: '120', // Exactly at threshold, not above
        oxygenSaturation: '90', // Exactly at threshold, not below
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(true);
      expect(result.criticalAlerts).toHaveLength(0);
    });

    it('should handle invalid non-numeric values gracefully', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: 'abc',
        heartRate: 'not a number',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.isValid).toBe(true);
      expect(result.criticalAlerts).toHaveLength(0);
    });

    it('should include unique IDs for each alert', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '190',
        bloodPressureDiastolic: '130',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.criticalAlerts[0].id).toBeDefined();
      expect(result.criticalAlerts[1].id).toBeDefined();
      expect(result.criticalAlerts[0].id).not.toBe(result.criticalAlerts[1].id);
    });

    it('should set acknowledged to false by default', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '190',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      expect(result.criticalAlerts[0].acknowledged).toBe(false);
    });

    it('should include threshold information in alert', () => {
      const vitals: VitalsData = {
        ...emptyVitals,
        bloodPressureSystolic: '190',
      };

      const result = evaluateVitalsForCriticalAlerts(vitals);
      const alert = result.criticalAlerts[0];

      expect(alert.threshold).toBeDefined();
      expect(alert.threshold.criticalHigh).toBe(180);
      expect(alert.threshold.criticalLow).toBe(90);
      expect(alert.threshold.unit).toBe('mmHg');
    });
  });
});
