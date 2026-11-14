/**
 * Sample data for demo and test servers (scripts/seed-sample-data.ts).
 *
 * Every person here is fictional. Never copy data from a real server into this file: the
 * repository is public. Dates are relative to the day the seed runs, so the data always
 * looks recent.
 *
 * Codes must exist in the app's default catalogs (diagnosis codes, formulary, lab tests);
 * sampleData.test.ts enforces that.
 */

import type { PolicyRole } from '../../src/security/rolePolicies';
import { UserRole } from '../../src/utils/permissions';

/** Identifier system marking seeded patients; the seed skips a patient that already exists. */
export const SAMPLE_PATIENT_SYSTEM = 'http://hopeemr.com/fhir/identifier/sample-patient';

/** Tag on every seeded resource, so sample data can be found (and removed) later. */
export const SAMPLE_TAG = { system: 'http://hopeemr.com/fhir/CodeSystem/data-origin', code: 'sample' };

export const SAMPLE_CLINIC_NAME = 'HopeEMR Demo Clinic';

export const SAMPLE_DEPARTMENT = {
  name: 'Consulta Externa',
  code: 'consulta-externa',
  type: 'general' as const,
  description: 'Outpatient clinic (sample data)',
};

export interface SampleUser {
  role: PolicyRole;
  firstName: string;
  lastName: string;
  email: string;
}

/** One demo login per role. Passwords are generated at seed time, never stored in the repo. */
export const SAMPLE_USERS: SampleUser[] = [
  { role: UserRole.PROVIDER, firstName: 'Demo', lastName: 'Provider', email: 'demo.provider@hopeemr.com' },
  { role: UserRole.NURSE, firstName: 'Demo', lastName: 'Nurse', email: 'demo.nurse@hopeemr.com' },
  { role: UserRole.FRONT_DESK, firstName: 'Demo', lastName: 'Front Desk', email: 'demo.frontdesk@hopeemr.com' },
  { role: UserRole.PHARMACY, firstName: 'Demo', lastName: 'Pharmacy', email: 'demo.pharmacy@hopeemr.com' },
  { role: UserRole.LAB, firstName: 'Demo', lastName: 'Lab', email: 'demo.lab@hopeemr.com' },
  { role: UserRole.RADIOLOGY, firstName: 'Demo', lastName: 'Radiology', email: 'demo.radiology@hopeemr.com' },
  { role: UserRole.BILLING, firstName: 'Demo', lastName: 'Billing', email: 'demo.billing@hopeemr.com' },
];

export interface SampleVitals {
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  /** °C */
  temperature?: number;
  /** % */
  oxygenSaturation?: number;
  /** mg/dL */
  bloodGlucose?: number;
  /** kg */
  weight?: number;
  /** cm */
  height?: number;
}

export interface SampleDiagnosis {
  /** ICD-10 code from the app's default diagnosis list */
  code: string;
  display: string;
  clinicalStatus: 'active' | 'resolved';
}

export interface SamplePrescription {
  /** Generic name from DEFAULT_MEDICATIONS */
  medication: string;
  dosage: string;
  quantity: number;
  refills: number;
}

export interface SampleVisit {
  daysAgo: number;
  reason: string;
  vitals: SampleVitals;
  diagnoses: SampleDiagnosis[];
  prescriptions: SamplePrescription[];
  /** Lab test codes from DEFAULT_LAB_TESTS, left pending for the lab user */
  labOrders: string[];
}

export interface SampleQueueEntry {
  chiefComplaint: string;
  triageLevel: 1 | 2 | 3 | 4 | 5;
  checkInMethod: 'scheduled' | 'walk-in';
}

export interface SamplePatient {
  id: string;
  given: string[];
  family: string;
  gender: 'male' | 'female';
  birthDate: string;
  phone: string;
  city: string;
  visits: SampleVisit[];
  /** Present when the patient is waiting in today's queue */
  queue?: SampleQueueEntry;
}

export const SAMPLE_PATIENTS: SamplePatient[] = [
  {
    id: 'SAMPLE-001',
    given: ['María', 'José'],
    family: 'Hernández López',
    gender: 'female',
    birthDate: '1968-03-14',
    phone: '+504 9000-0001',
    city: 'Siguatepeque',
    visits: [
      {
        daysAgo: 90,
        reason: 'Control de presión y azúcar',
        vitals: { systolic: 152, diastolic: 94, heartRate: 84, respiratoryRate: 16, temperature: 36.8, oxygenSaturation: 97, bloodGlucose: 182, weight: 78, height: 156 },
        diagnoses: [
          { code: 'I10', display: 'Essential (primary) hypertension', clinicalStatus: 'active' },
          { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications', clinicalStatus: 'active' },
        ],
        prescriptions: [
          { medication: 'Lisinopril', dosage: '10 mg by mouth once daily', quantity: 30, refills: 2 },
          { medication: 'Metformin', dosage: '500 mg by mouth twice daily with meals', quantity: 60, refills: 2 },
        ],
        labOrders: [],
      },
      {
        daysAgo: 30,
        reason: 'Seguimiento hipertensión y diabetes',
        vitals: { systolic: 138, diastolic: 86, heartRate: 78, respiratoryRate: 16, temperature: 36.6, oxygenSaturation: 98, bloodGlucose: 141, weight: 76.5 },
        diagnoses: [],
        prescriptions: [],
        labOrders: ['hba1c', 'lipid-panel'],
      },
    ],
  },
  {
    id: 'SAMPLE-002',
    given: ['José', 'Luis'],
    family: 'Martínez Mejía',
    gender: 'male',
    birthDate: '1955-11-02',
    phone: '+504 9000-0002',
    city: 'Comayagua',
    visits: [
      {
        daysAgo: 14,
        reason: 'Dolor de espalda baja',
        vitals: { systolic: 146, diastolic: 90, heartRate: 72, respiratoryRate: 14, temperature: 36.7, oxygenSaturation: 96, weight: 70, height: 165 },
        diagnoses: [
          { code: 'M54.5', display: 'Low back pain', clinicalStatus: 'active' },
          { code: 'I10', display: 'Essential (primary) hypertension', clinicalStatus: 'active' },
        ],
        prescriptions: [{ medication: 'Acetaminophen', dosage: '500 mg by mouth every 8 hours as needed for pain', quantity: 30, refills: 0 }],
        labOrders: [],
      },
    ],
  },
  {
    id: 'SAMPLE-003',
    given: ['Ana', 'Lucía'],
    family: 'Reyes Castillo',
    gender: 'female',
    birthDate: '1994-07-21',
    phone: '+504 9000-0003',
    city: 'Siguatepeque',
    visits: [
      {
        daysAgo: 7,
        reason: 'Dolor de garganta y fiebre',
        vitals: { systolic: 112, diastolic: 72, heartRate: 96, respiratoryRate: 18, temperature: 38.4, oxygenSaturation: 98, weight: 58, height: 160 },
        diagnoses: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified', clinicalStatus: 'active' }],
        prescriptions: [{ medication: 'Amoxicillin', dosage: '500 mg by mouth three times daily for 10 days', quantity: 30, refills: 0 }],
        labOrders: ['strep-rapid'],
      },
    ],
  },
  {
    id: 'SAMPLE-004',
    given: ['Carlos', 'Eduardo'],
    family: 'Flores Banegas',
    gender: 'male',
    birthDate: '2015-02-09',
    phone: '+504 9000-0004',
    city: 'La Esperanza',
    visits: [
      {
        daysAgo: 45,
        reason: 'Tos y silbido en el pecho',
        vitals: { heartRate: 104, respiratoryRate: 24, temperature: 37.1, oxygenSaturation: 95, weight: 34, height: 140 },
        diagnoses: [{ code: 'J45.909', display: 'Unspecified asthma, uncomplicated', clinicalStatus: 'active' }],
        // No inhaler: Albuterol shares an RxNorm code in defaultMedications.ts and is overwritten
        prescriptions: [],
        labOrders: [],
      },
    ],
  },
  {
    id: 'SAMPLE-005',
    given: ['Rosa', 'Elena'],
    family: 'Sánchez Murillo',
    gender: 'female',
    birthDate: '1979-09-30',
    phone: '+504 9000-0005',
    city: 'Comayagua',
    visits: [
      {
        daysAgo: 60,
        reason: 'Ardor en el estómago',
        vitals: { systolic: 124, diastolic: 80, heartRate: 70, respiratoryRate: 15, temperature: 36.5, oxygenSaturation: 99, weight: 66, height: 158 },
        diagnoses: [{ code: 'K21.9', display: 'Gastro-esophageal reflux disease without esophagitis', clinicalStatus: 'active' }],
        prescriptions: [],
        labOrders: ['cbc'],
      },
    ],
  },
  {
    id: 'SAMPLE-006',
    given: ['Daniel', 'Alejandro'],
    family: 'Cruz Zelaya',
    gender: 'male',
    birthDate: '2001-05-17',
    phone: '+504 9000-0006',
    city: 'Siguatepeque',
    visits: [],
    queue: { chiefComplaint: 'Fiebre de 3 días y dolor de cuerpo', triageLevel: 3, checkInMethod: 'walk-in' },
  },
  {
    id: 'SAMPLE-007',
    given: ['Gabriela', 'Patricia'],
    family: 'Ortiz Paz',
    gender: 'female',
    birthDate: '1988-12-05',
    phone: '+504 9000-0007',
    city: 'La Esperanza',
    visits: [
      {
        daysAgo: 120,
        reason: 'Gripe',
        vitals: { systolic: 118, diastolic: 76, heartRate: 82, respiratoryRate: 16, temperature: 37.6, oxygenSaturation: 98, weight: 61, height: 162 },
        diagnoses: [{ code: 'J06.9', display: 'Acute upper respiratory infection, unspecified', clinicalStatus: 'resolved' }],
        prescriptions: [],
        labOrders: [],
      },
    ],
    queue: { chiefComplaint: 'Dolor de cabeza frecuente', triageLevel: 4, checkInMethod: 'walk-in' },
  },
  {
    id: 'SAMPLE-008',
    given: ['Pedro', 'Antonio'],
    family: 'Matute Rivera',
    gender: 'male',
    birthDate: '1949-08-23',
    phone: '+504 9000-0008',
    city: 'Comayagua',
    visits: [
      {
        daysAgo: 75,
        reason: 'Control de presión',
        vitals: { systolic: 164, diastolic: 98, heartRate: 76, respiratoryRate: 16, temperature: 36.4, oxygenSaturation: 96, weight: 72, height: 168 },
        diagnoses: [{ code: 'I10', display: 'Essential (primary) hypertension', clinicalStatus: 'active' }],
        prescriptions: [{ medication: 'Lisinopril', dosage: '20 mg by mouth once daily', quantity: 30, refills: 2 }],
        labOrders: ['bmp'],
      },
    ],
    queue: { chiefComplaint: 'Cita de control de presión', triageLevel: 4, checkInMethod: 'scheduled' },
  },
];
