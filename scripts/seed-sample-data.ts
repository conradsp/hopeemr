/**
 * Seed a HopeEMR project with sample configuration, demo users and fictional patients.
 *
 * Safe to re-run: catalogs are upserted, and users, the department and patients that already
 * exist are skipped. Refuses to run against a project that holds patients it did not create,
 * unless --allow-existing-patients is passed, so it is never run against a live clinic by accident.
 *
 * Requires the role AccessPolicies (npm run policies:setup) and a project-admin client:
 *   MEDPLUM_BASE_URL=... MEDPLUM_CLIENT_ID=... MEDPLUM_CLIENT_SECRET=... npm run seed:sample
 *
 * Flags:
 *   --skip-users               do not create demo users
 *   --allow-existing-patients  seed even if the project already has non-sample patients
 *   --credentials-file <path>  write new demo passwords to <path> (mode 600) instead of stdout
 *
 * Demo user passwords are generated and printed once at the end; store them somewhere safe.
 */

import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createReference, getReferenceString, MedplumClient } from '@medplum/core';
import type {
  AccessPolicy,
  ActivityDefinition,
  CodeableConcept,
  Condition,
  Encounter,
  Location,
  Medication,
  MedicationRequest,
  Observation,
  Patient,
  Practitioner,
  ProjectMembership,
  Reference,
  ServiceRequest,
} from '@medplum/fhirtypes';
import { createAdminClient, getProjectId } from './lib/medplumAdmin';
import {
  SAMPLE_CLINIC_NAME,
  SAMPLE_DEPARTMENT,
  SAMPLE_PATIENT_SYSTEM,
  SAMPLE_PATIENTS,
  SAMPLE_TAG,
  SAMPLE_USERS,
  type SamplePatient,
  type SampleVisit,
  type SampleVitals,
} from './seed/sampleData';
import { buildRoleAccess, getRolePolicyName, type PolicyRole } from '../src/security/rolePolicies';
import { createDepartment } from '../src/utils/bedManagement';
import { initializeDefaultDiagnosisCodes } from '../src/utils/diagnosisCodes';
import { initializeDefaultDiagnosticProviders } from '../src/utils/diagnosticProviders';
import { initializeDefaultImagingTests } from '../src/utils/imagingTests';
import { initializeDefaultLabTests, getLabTests } from '../src/utils/labTests';
import { getMedications, initializeDefaultMedications } from '../src/utils/medications';
import { initializeDefaultTemplates } from '../src/utils/noteTemplates';
import { createQueueEntry } from '../src/utils/queueUtils';
import { getEMRSettings, saveEMRSettings } from '../src/utils/settings';
import { UserRole } from '../src/utils/permissions';

const DEPARTMENT_SYSTEM = 'http://hopeemr.com/fhir/CodeSystem/department';
const LAB_TEST_IDENTIFIER_SYSTEM = 'http://hopeemr.com/fhir/identifier/lab-test';
const META = { tag: [SAMPLE_TAG] };

const argv = process.argv.slice(2);
const args = new Set(argv);
/** With --credentials-file <path>, demo passwords go to that file (mode 600) instead of stdout. */
const credentialsFile = argv.includes('--credentials-file') ? argv[argv.indexOf('--credentials-file') + 1] : undefined;

function reportPassword(role: string, email: string, password: string): void {
  const line = `${role.padEnd(11)} ${email.padEnd(30)} ${password}`;
  if (credentialsFile) {
    appendFileSync(credentialsFile, `${line}\n`, { mode: 0o600 });
    console.log(`Demo user: ${role.padEnd(11)} ${email} (password written to ${credentialsFile})`);
  } else {
    console.log(`Demo user: ${line}`);
  }
}

interface CreatedUser {
  email: string;
  role: PolicyRole;
  password: string;
}

function daysAgo(days: number, hour = 9): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

async function assertSafeTarget(medplum: MedplumClient): Promise<void> {
  const patients = await medplum.searchResources('Patient', { _count: '200', _elements: 'identifier' });
  const foreign = patients.filter((p) => !p.identifier?.some((id) => id.system === SAMPLE_PATIENT_SYSTEM));
  if (foreign.length > 0 && !args.has('--allow-existing-patients')) {
    throw new Error(
      `Project has ${foreign.length} patient(s) not created by this seed. If this is a test server, ` +
        're-run with --allow-existing-patients. Never seed a server holding real patients.'
    );
  }
}

async function loadRolePolicies(medplum: MedplumClient): Promise<Map<PolicyRole, AccessPolicy>> {
  const policies = new Map<PolicyRole, AccessPolicy>();
  for (const user of SAMPLE_USERS) {
    const policy = await medplum.searchOne('AccessPolicy', { name: getRolePolicyName(user.role) });
    if (!policy) {
      throw new Error(`AccessPolicy ${getRolePolicyName(user.role)} not found. Run npm run policies:setup first.`);
    }
    policies.set(user.role, policy);
  }
  return policies;
}

async function seedConfiguration(medplum: MedplumClient): Promise<void> {
  if (!(await getEMRSettings(medplum))) {
    await saveEMRSettings(medplum, { name: SAMPLE_CLINIC_NAME, logo: null });
  }
  await initializeDefaultDiagnosisCodes(medplum);
  await initializeDefaultLabTests(medplum);
  await initializeDefaultImagingTests(medplum);
  await initializeDefaultMedications(medplum);
  await initializeDefaultDiagnosticProviders(medplum);
  await initializeDefaultTemplates(medplum);
  console.log('Configuration: clinic settings, diagnosis codes, lab and imaging catalogs, formulary, providers, note templates');
}

async function seedDepartment(medplum: MedplumClient): Promise<Location> {
  const existing = await medplum.searchOne('Location', {
    identifier: `${DEPARTMENT_SYSTEM}|${SAMPLE_DEPARTMENT.code}`,
  });
  if (existing) {
    return existing;
  }
  console.log(`Department: ${SAMPLE_DEPARTMENT.name}`);
  return createDepartment(medplum, SAMPLE_DEPARTMENT);
}

/** Creates missing demo users. Returns every demo Practitioner by role, plus new credentials. */
async function seedUsers(
  medplum: MedplumClient,
  projectId: string,
  policies: Map<PolicyRole, AccessPolicy>
): Promise<{ practitioners: Map<PolicyRole, Practitioner>; created: CreatedUser[] }> {
  const practitioners = new Map<PolicyRole, Practitioner>();
  const created: CreatedUser[] = [];

  for (const user of SAMPLE_USERS) {
    let practitioner = await medplum.searchOne('Practitioner', { email: user.email });
    if (!practitioner && !args.has('--skip-users')) {
      const password = randomBytes(12).toString('base64url');
      const policy = policies.get(user.role) as AccessPolicy;
      const membership = (await medplum.post(`admin/projects/${projectId}/invite`, {
        resourceType: 'Practitioner',
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password,
        sendEmail: false,
        membership: { access: [buildRoleAccess(user.role, policy)] },
      })) as ProjectMembership;
      practitioner = await medplum.readReference(membership.profile as Reference<Practitioner>);
      created.push({ email: user.email, role: user.role, password });
      // Report now: if a later step fails, the password would otherwise be lost
      reportPassword(user.role, user.email, password);
    }
    if (practitioner) {
      practitioners.set(user.role, practitioner);
    }
  }
  return { practitioners, created };
}

function vitalObservation(
  code: string,
  display: string,
  text: string,
  base: Pick<Observation, 'subject' | 'encounter' | 'effectiveDateTime'>
): Observation {
  return {
    resourceType: 'Observation',
    meta: META,
    status: 'final',
    category: [
      {
        coding: [
          { system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' },
        ],
      },
    ],
    code: { coding: [{ system: 'http://loinc.org', code, display }], text },
    ...base,
  };
}

/** Mirrors the observations RecordVitalsModal creates. */
function buildVitals(vitals: SampleVitals, base: Pick<Observation, 'subject' | 'encounter' | 'effectiveDateTime'>): Observation[] {
  const q = (value: number, unit: string, ucum: string): Observation['valueQuantity'] => ({
    value,
    unit,
    system: 'http://unitsofmeasure.org',
    code: ucum,
  });
  const observations: Observation[] = [];

  if (vitals.systolic && vitals.diastolic) {
    observations.push({
      ...vitalObservation('85354-9', 'Blood pressure panel', 'Blood Pressure', base),
      component: [
        { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] }, valueQuantity: q(vitals.systolic, 'mmHg', 'mm[Hg]') },
        { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] }, valueQuantity: q(vitals.diastolic, 'mmHg', 'mm[Hg]') },
      ],
    });
  }
  const simple: [number | undefined, string, string, string, string, string][] = [
    [vitals.heartRate, '8867-4', 'Heart rate', 'Heart Rate', 'beats/min', '/min'],
    [vitals.respiratoryRate, '9279-1', 'Respiratory rate', 'Respiratory Rate', 'breaths/min', '/min'],
    [vitals.temperature, '8310-5', 'Body temperature', 'Temperature', '°C', 'Cel'],
    [vitals.oxygenSaturation, '2708-6', 'Oxygen saturation in Arterial blood', 'Oxygen Saturation', '%', '%'],
    [vitals.bloodGlucose, '2345-7', 'Glucose [Mass/volume] in Serum or Plasma', 'Blood Glucose', 'mg/dL', 'mg/dL'],
    [vitals.weight, '29463-7', 'Body weight', 'Weight', 'kg', 'kg'],
    [vitals.height, '8302-2', 'Body height', 'Height', 'cm', 'cm'],
  ];
  for (const [value, code, display, text, unit, ucum] of simple) {
    if (value !== undefined) {
      observations.push({ ...vitalObservation(code, display, text, base), valueQuantity: q(value, unit, ucum) });
    }
  }
  return observations;
}

interface SeedContext {
  department: Location;
  provider?: Practitioner;
  frontDesk?: Practitioner;
  medications: Medication[];
  labTests: ActivityDefinition[];
}

function findMedication(ctx: SeedContext, name: string): Medication {
  const medication = ctx.medications.find((m) =>
    m.code?.coding?.some((c) => c.display?.toLowerCase() === name.toLowerCase())
  );
  if (!medication) {
    throw new Error(`Medication ${name} not in formulary`);
  }
  return medication;
}

function findLabTest(ctx: SeedContext, code: string): ActivityDefinition & { code: CodeableConcept } {
  const test = ctx.labTests.find((t) =>
    t.identifier?.some((id) => id.system === LAB_TEST_IDENTIFIER_SYSTEM && id.value === code)
  );
  if (!test?.code) {
    throw new Error(`Lab test ${code} not in catalog`);
  }
  return test as ActivityDefinition & { code: CodeableConcept };
}

/** Fails before anything is written if a sample references a missing catalog entry. */
function assertCatalogsComplete(ctx: SeedContext): void {
  for (const visit of SAMPLE_PATIENTS.flatMap((p) => p.visits)) {
    visit.prescriptions.forEach((rx) => findMedication(ctx, rx.medication));
    visit.labOrders.forEach((code) => findLabTest(ctx, code));
  }
}

async function seedVisit(medplum: MedplumClient, patient: Patient, visit: SampleVisit, ctx: SeedContext): Promise<void> {
  const start = daysAgo(visit.daysAgo);
  const subject = createReference(patient);
  const providerRef = ctx.provider ? createReference(ctx.provider) : undefined;

  const encounter = await medplum.createResource<Encounter>({
    resourceType: 'Encounter',
    meta: META,
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' },
    subject,
    participant: providerRef
      ? [
          {
            type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'PPRF', display: 'primary performer' }] }],
            individual: providerRef,
          },
        ]
      : undefined,
    period: { start, end: plusMinutes(start, 25) },
    location: [{ location: createReference(ctx.department) }],
    reasonCode: [{ text: visit.reason }],
  });
  const encounterRef = createReference(encounter);

  const base = { subject, encounter: encounterRef, effectiveDateTime: plusMinutes(start, 5) };
  for (const observation of buildVitals(visit.vitals, base)) {
    await medplum.createResource(observation);
  }

  for (const dx of visit.diagnoses) {
    await medplum.createResource<Condition>({
      resourceType: 'Condition',
      meta: META,
      clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: dx.clinicalStatus }] },
      verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
      code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: dx.code, display: dx.display }], text: dx.display },
      subject,
      encounter: encounterRef,
      onsetDateTime: start,
      recordedDate: plusMinutes(start, 15),
      recorder: providerRef,
    });
  }

  for (const rx of visit.prescriptions) {
    const medication = findMedication(ctx, rx.medication);
    await medplum.createResource<MedicationRequest>({
      resourceType: 'MedicationRequest',
      meta: META,
      status: visit.daysAgo > 30 ? 'completed' : 'active',
      intent: 'order',
      medicationReference: { ...createReference(medication), display: rx.medication },
      subject,
      encounter: encounterRef,
      authoredOn: plusMinutes(start, 20),
      requester: providerRef,
      dosageInstruction: [{ text: rx.dosage }],
      dispenseRequest: { numberOfRepeatsAllowed: rx.refills, quantity: { value: rx.quantity } },
      extension: [{ url: 'http://hopeemr.com/fhir/StructureDefinition/prescription-type', valueString: 'internal' }],
    });
  }

  for (const code of visit.labOrders) {
    const test = findLabTest(ctx, code);
    await medplum.createResource<ServiceRequest>({
      resourceType: 'ServiceRequest',
      meta: META,
      status: 'active',
      intent: 'order',
      priority: 'routine',
      category: [{ coding: [{ system: 'http://snomed.info/sct', code: '108252007', display: 'Laboratory procedure' }] }],
      code: test.code,
      subject,
      encounter: encounterRef,
      authoredOn: plusMinutes(start, 20),
      requester: providerRef,
    });
  }
}

async function seedPatient(medplum: MedplumClient, sample: SamplePatient, ctx: SeedContext): Promise<boolean> {
  const existing = await medplum.searchOne('Patient', { identifier: `${SAMPLE_PATIENT_SYSTEM}|${sample.id}` });
  if (existing) {
    return false;
  }
  const patient = await medplum.createResource<Patient>({
    resourceType: 'Patient',
    meta: META,
    identifier: [{ system: SAMPLE_PATIENT_SYSTEM, value: sample.id }],
    name: [{ use: 'official', given: sample.given, family: sample.family }],
    gender: sample.gender,
    birthDate: sample.birthDate,
    telecom: [{ system: 'phone', value: sample.phone, use: 'mobile' }],
    address: [{ use: 'home', city: sample.city, country: 'HN' }],
    active: true,
  });

  for (const visit of [...sample.visits].sort((a, b) => b.daysAgo - a.daysAgo)) {
    await seedVisit(medplum, patient, visit, ctx);
  }

  if (sample.queue) {
    await createQueueEntry(medplum, {
      patient: createReference(patient),
      location: createReference(ctx.department),
      requester: ctx.frontDesk ? createReference(ctx.frontDesk) : undefined,
      chiefComplaint: sample.queue.chiefComplaint,
      triageLevel: sample.queue.triageLevel,
      checkInMethod: sample.queue.checkInMethod,
    });
  }
  console.log(`Patient: ${sample.given.join(' ')} ${sample.family} (${sample.visits.length} visits${sample.queue ? ', in queue' : ''})`);
  return true;
}

async function main(): Promise<void> {
  const medplum = await createAdminClient();
  const projectId = getProjectId(medplum);
  console.log(`Seeding project ${projectId} on ${medplum.getBaseUrl()}`);

  await assertSafeTarget(medplum);
  const policies = await loadRolePolicies(medplum);

  await seedConfiguration(medplum);
  const department = await seedDepartment(medplum);
  const { practitioners, created } = await seedUsers(medplum, projectId, policies);

  const ctx: SeedContext = {
    department,
    provider: practitioners.get(UserRole.PROVIDER),
    frontDesk: practitioners.get(UserRole.FRONT_DESK),
    medications: await getMedications(medplum),
    labTests: await getLabTests(medplum),
  };

  assertCatalogsComplete(ctx);

  let newPatients = 0;
  for (const sample of SAMPLE_PATIENTS) {
    if (await seedPatient(medplum, sample, ctx)) {
      newPatients++;
    }
  }
  console.log(`\nDone: ${newPatients} new patient(s), ${SAMPLE_PATIENTS.length - newPatients} already present.`);

  if (created.length > 0) {
    console.log(`\n${created.length} demo user(s) created. Passwords are reported once, above; store them now.`);
  }
  console.log(`\nSample resources are tagged ${SAMPLE_TAG.system}|${SAMPLE_TAG.code} (${getReferenceString(department)} is the sample department).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
