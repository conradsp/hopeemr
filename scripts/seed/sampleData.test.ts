import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { POLICY_ROLES } from '../../src/security/rolePolicies';
import { DEFAULT_MEDICATIONS } from '../../src/utils/defaultMedications';
import { DEFAULT_LAB_TESTS } from '../../src/utils/labTests';
import { SAMPLE_PATIENTS, SAMPLE_USERS } from './sampleData';

// The default diagnosis list is private to diagnosisCodes.ts, so check against its source
const DEFAULT_DIAGNOSIS_SOURCE = readFileSync(new URL('../../src/utils/diagnosisCodes.ts', import.meta.url), 'utf8');

const visits = SAMPLE_PATIENTS.flatMap((p) => p.visits);

describe('sample seed data', () => {
  it('has unique patient identifiers', () => {
    const ids = SAMPLE_PATIENTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has one demo user per policy role, with unique emails', () => {
    expect(SAMPLE_USERS.map((u) => u.role).sort()).toEqual([...POLICY_ROLES].sort());
    expect(new Set(SAMPLE_USERS.map((u) => u.email)).size).toBe(SAMPLE_USERS.length);
  });

  it('only prescribes medications in the default formulary', () => {
    // A medication sharing its RxNorm code with another is overwritten by initializeDefaultMedications
    const counts = new Map<string, number>();
    DEFAULT_MEDICATIONS.forEach((m) => counts.set(m.rxcui, (counts.get(m.rxcui) ?? 0) + 1));
    const formulary = new Set(DEFAULT_MEDICATIONS.filter((m) => counts.get(m.rxcui) === 1).map((m) => m.genericName));
    for (const rx of visits.flatMap((v) => v.prescriptions)) {
      expect(formulary, rx.medication).toContain(rx.medication);
    }
  });

  it('only orders lab tests in the default catalog', () => {
    const catalog = new Set(DEFAULT_LAB_TESTS.map((t) => t.code));
    for (const code of visits.flatMap((v) => v.labOrders)) {
      expect(catalog, code).toContain(code);
    }
  });

  it('only uses diagnosis codes from the default diagnosis list', () => {
    for (const dx of visits.flatMap((v) => v.diagnoses)) {
      expect(DEFAULT_DIAGNOSIS_SOURCE, dx.code).toContain(`code: '${dx.code}', display: '${dx.display}'`);
    }
  });

  it('records vitals in metric units within plausible ranges', () => {
    for (const { vitals } of visits) {
      if (vitals.temperature !== undefined) {
        expect(vitals.temperature).toBeGreaterThan(34);
        expect(vitals.temperature).toBeLessThan(42);
      }
      if (vitals.weight !== undefined) {
        expect(vitals.weight).toBeLessThan(200);
      }
      if (vitals.height !== undefined) {
        expect(vitals.height).toBeGreaterThan(50);
      }
    }
  });

  it('dates every visit in the past', () => {
    for (const visit of visits) {
      expect(visit.daysAgo).toBeGreaterThan(0);
    }
  });
});
