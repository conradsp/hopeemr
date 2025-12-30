import { MedplumClient } from '@medplum/core';
import { ValueSet, ValueSetExpansionContains } from '@medplum/fhirtypes';

export const DIAGNOSIS_VALUESET_URL = 'http://medplum.com/emr/diagnosis-codes';

// Common ICD-10 diagnoses to include by default
const DEFAULT_ICD10_CODES = [
  // Cardiovascular
  { code: 'I10', display: 'Essential (primary) hypertension' },
  { code: 'I25.10', display: 'Atherosclerotic heart disease of native coronary artery without angina pectoris' },
  { code: 'I48.91', display: 'Unspecified atrial fibrillation' },
  { code: 'I50.9', display: 'Heart failure, unspecified' },
  
  // Endocrine
  { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', display: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'E78.5', display: 'Hyperlipidemia, unspecified' },
  { code: 'E03.9', display: 'Hypothyroidism, unspecified' },
  { code: 'E66.9', display: 'Obesity, unspecified' },
  
  // Respiratory
  { code: 'J45.909', display: 'Unspecified asthma, uncomplicated' },
  { code: 'J44.9', display: 'Chronic obstructive pulmonary disease, unspecified' },
  { code: 'J06.9', display: 'Acute upper respiratory infection, unspecified' },
  { code: 'J18.9', display: 'Pneumonia, unspecified organism' },
  
  // Musculoskeletal
  { code: 'M25.50', display: 'Pain in unspecified joint' },
  { code: 'M79.3', display: 'Panniculitis, unspecified' },
  { code: 'M54.5', display: 'Low back pain' },
  { code: 'M17.9', display: 'Osteoarthritis of knee, unspecified' },
  
  // Mental Health
  { code: 'F41.9', display: 'Anxiety disorder, unspecified' },
  { code: 'F32.9', display: 'Major depressive disorder, single episode, unspecified' },
  { code: 'F33.9', display: 'Major depressive disorder, recurrent, unspecified' },
  
  // Gastrointestinal
  { code: 'K21.9', display: 'Gastro-esophageal reflux disease without esophagitis' },
  { code: 'K59.00', display: 'Constipation, unspecified' },
  { code: 'K58.9', display: 'Irritable bowel syndrome without diarrhea' },
  
  // Neurological
  { code: 'G43.909', display: 'Migraine, unspecified, not intractable, without status migrainosus' },
  { code: 'G89.29', display: 'Other chronic pain' },
  
  // Infectious
  { code: 'J02.9', display: 'Acute pharyngitis, unspecified' },
  { code: 'N39.0', display: 'Urinary tract infection, site not specified' },
  { code: 'L03.90', display: 'Cellulitis, unspecified' },
  
  // Other common
  { code: 'R50.9', display: 'Fever, unspecified' },
  { code: 'R51', display: 'Headache' },
  { code: 'R05', display: 'Cough' },
  { code: 'Z00.00', display: 'Encounter for general adult medical examination without abnormal findings' },
  { code: 'Z23', display: 'Encounter for immunization' },
];

export async function getDiagnosisValueSet(medplum: MedplumClient): Promise<ValueSet | undefined> {
  const results = await medplum.searchResources('ValueSet', {
    url: DIAGNOSIS_VALUESET_URL,
    _count: '1',
  });
  return results[0];
}

export async function initializeDefaultDiagnosisCodes(medplum: MedplumClient): Promise<ValueSet> {
  let valueSet = await getDiagnosisValueSet(medplum);
  
  const expansion: ValueSetExpansionContains[] = DEFAULT_ICD10_CODES.map(code => ({
    system: 'http://hl7.org/fhir/sid/icd-10',
    code: code.code,
    display: code.display,
  }));

  if (valueSet) {
    // Update existing
    valueSet.expansion = {
      timestamp: new Date().toISOString(),
      contains: expansion,
    };
    return await medplum.updateResource(valueSet);
  } else {
    // Create new
    valueSet = {
      resourceType: 'ValueSet',
      url: DIAGNOSIS_VALUESET_URL,
      name: 'EMR_Diagnosis_Codes',
      title: 'EMR Diagnosis Codes',
      status: 'active',
      description: 'ICD-10 and custom diagnosis codes available in the EMR',
      expansion: {
        timestamp: new Date().toISOString(),
        contains: expansion,
      },
    };
    return await medplum.createResource(valueSet);
  }
}

export async function addDiagnosisCode(
  medplum: MedplumClient,
  code: string,
  display: string,
  system: string = 'http://hl7.org/fhir/sid/icd-10'
): Promise<ValueSet> {
  let valueSet = await getDiagnosisValueSet(medplum);
  
  if (!valueSet) {
    // Initialize if doesn't exist
    valueSet = await initializeDefaultDiagnosisCodes(medplum);
  }

  const contains = valueSet.expansion?.contains || [];
  
  // Check if code already exists
  const exists = contains.some(c => c.code === code && c.system === system);
  if (exists) {
    throw new Error(`Diagnosis code ${code} already exists`);
  }

  contains.push({
    system,
    code,
    display,
  });

  valueSet.expansion = {
    timestamp: new Date().toISOString(),
    contains,
  };

  return await medplum.updateResource(valueSet);
}

export async function updateDiagnosisCode(
  medplum: MedplumClient,
  originalCode: string,
  originalSystem: string,
  newCode: string,
  newDisplay: string,
  newSystem: string = 'http://hl7.org/fhir/sid/icd-10'
): Promise<ValueSet> {
  const valueSet = await getDiagnosisValueSet(medplum);
  if (!valueSet) {
    throw new Error('Diagnosis ValueSet not found');
  }

  const contains = valueSet.expansion?.contains || [];
  const index = contains.findIndex(c => c.code === originalCode && c.system === originalSystem);
  
  if (index === -1) {
    throw new Error('Diagnosis code not found');
  }

  contains[index] = {
    system: newSystem,
    code: newCode,
    display: newDisplay,
  };

  valueSet.expansion = {
    timestamp: new Date().toISOString(),
    contains,
  };

  return await medplum.updateResource(valueSet);
}

export async function deleteDiagnosisCode(
  medplum: MedplumClient,
  code: string,
  system: string
): Promise<ValueSet> {
  const valueSet = await getDiagnosisValueSet(medplum);
  if (!valueSet) {
    throw new Error('Diagnosis ValueSet not found');
  }

  const contains = valueSet.expansion?.contains || [];
  const filtered = contains.filter(c => !(c.code === code && c.system === system));

  valueSet.expansion = {
    timestamp: new Date().toISOString(),
    contains: filtered,
  };

  return await medplum.updateResource(valueSet);
}

export async function getAllDiagnosisCodes(medplum: MedplumClient): Promise<ValueSetExpansionContains[]> {
  const valueSet = await getDiagnosisValueSet(medplum);
  return valueSet?.expansion?.contains || [];
}

