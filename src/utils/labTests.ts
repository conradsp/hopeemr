import { MedplumClient } from '@medplum/core';
import { ActivityDefinition } from '@medplum/fhirtypes';
import { logger } from './logger';
import { setPriceOnResource } from './billing';

export interface LabTestResultField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  unit?: string;
  options?: string[];
}

export interface LabTestDefinition {
  code: string;
  display: string;
  loincCode?: string;
  category: string;
  specimenType?: string;
  aoeQuestions?: string[];
  description?: string;
  resultFields?: LabTestResultField[];
  price?: number;
}

const LAB_TEST_IDENTIFIER_SYSTEM = 'http://medplum.com/emr/lab-test';

/**
 * Default lab tests catalog
 */
export const DEFAULT_LAB_TESTS: LabTestDefinition[] = [
  // Chemistry Panel Tests
  {
    code: 'cmp',
    display: 'Comprehensive Metabolic Panel (CMP)',
    loincCode: '24323-8',
    category: 'Chemistry',
    specimenType: 'Serum',
    description: '14 tests including glucose, electrolytes, kidney and liver function',
    resultFields: [
      { name: 'glucose', label: 'Glucose', type: 'number', unit: 'mg/dL' },
      { name: 'calcium', label: 'Calcium', type: 'number', unit: 'mg/dL' },
      { name: 'sodium', label: 'Sodium', type: 'number', unit: 'mmol/L' },
      { name: 'potassium', label: 'Potassium', type: 'number', unit: 'mmol/L' },
      { name: 'chloride', label: 'Chloride', type: 'number', unit: 'mmol/L' },
      { name: 'bun', label: 'BUN', type: 'number', unit: 'mg/dL' },
      { name: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL' },
      { name: 'albumin', label: 'Albumin', type: 'number', unit: 'g/dL' },
      { name: 'total_protein', label: 'Total Protein', type: 'number', unit: 'g/dL' },
      { name: 'alkaline_phosphatase', label: 'Alkaline Phosphatase', type: 'number', unit: 'U/L' },
      { name: 'alt', label: 'ALT', type: 'number', unit: 'U/L' },
      { name: 'ast', label: 'AST', type: 'number', unit: 'U/L' },
      { name: 'bilirubin', label: 'Total Bilirubin', type: 'number', unit: 'mg/dL' },
    ],
  },
  {
    code: 'bmp',
    display: 'Basic Metabolic Panel (BMP)',
    loincCode: '51990-0',
    category: 'Chemistry',
    specimenType: 'Serum',
    description: '8 tests including glucose, calcium, and electrolytes',
    resultFields: [
      { name: 'glucose', label: 'Glucose', type: 'number', unit: 'mg/dL' },
      { name: 'calcium', label: 'Calcium', type: 'number', unit: 'mg/dL' },
      { name: 'sodium', label: 'Sodium', type: 'number', unit: 'mmol/L' },
      { name: 'potassium', label: 'Potassium', type: 'number', unit: 'mmol/L' },
      { name: 'chloride', label: 'Chloride', type: 'number', unit: 'mmol/L' },
      { name: 'bun', label: 'BUN', type: 'number', unit: 'mg/dL' },
      { name: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL' },
    ],
  },
  {
    code: 'lipid-panel',
    display: 'Lipid Panel',
    loincCode: '57698-3',
    category: 'Chemistry',
    specimenType: 'Serum',
    aoeQuestions: ['Is patient fasting?'],
    description: 'Total cholesterol, HDL, LDL, triglycerides',
    resultFields: [
      { name: 'total_cholesterol', label: 'Total Cholesterol', type: 'number', unit: 'mg/dL' },
      { name: 'hdl', label: 'HDL Cholesterol', type: 'number', unit: 'mg/dL' },
      { name: 'ldl', label: 'LDL Cholesterol', type: 'number', unit: 'mg/dL' },
      { name: 'triglycerides', label: 'Triglycerides', type: 'number', unit: 'mg/dL' },
    ],
  },
  {
    code: 'hba1c',
    display: 'Hemoglobin A1c',
    loincCode: '4548-4',
    category: 'Chemistry',
    specimenType: 'Whole Blood',
    description: 'Average blood sugar over past 2-3 months',
    resultFields: [
      { name: 'hba1c', label: 'Hemoglobin A1c', type: 'number', unit: '%' },
    ],
  },
  {
    code: 'tsh',
    display: 'Thyroid Stimulating Hormone (TSH)',
    loincCode: '3016-3',
    category: 'Chemistry',
    specimenType: 'Serum',
    description: 'Thyroid function screening',
    resultFields: [
      { name: 'tsh', label: 'TSH', type: 'number', unit: 'uIU/mL' },
    ],
  },
  // Hematology Tests
  {
    code: 'cbc',
    display: 'Complete Blood Count (CBC)',
    loincCode: '58410-2',
    category: 'Hematology',
    specimenType: 'Whole Blood',
    description: 'Red cells, white cells, platelets, hemoglobin, hematocrit',
    resultFields: [
      { name: 'wbc', label: 'White Blood Cells', type: 'number', unit: '10^3/uL' },
      { name: 'rbc', label: 'Red Blood Cells', type: 'number', unit: '10^6/uL' },
      { name: 'hemoglobin', label: 'Hemoglobin', type: 'number', unit: 'g/dL' },
      { name: 'hematocrit', label: 'Hematocrit', type: 'number', unit: '%' },
      { name: 'platelets', label: 'Platelets', type: 'number', unit: '10^3/uL' },
    ],
  },
  {
    code: 'cbc-diff',
    display: 'CBC with Differential',
    loincCode: '69738-3',
    category: 'Hematology',
    specimenType: 'Whole Blood',
    description: 'CBC plus white blood cell differential',
    resultFields: [
      { name: 'neutrophils', label: 'Neutrophils', type: 'number', unit: '%' },
      { name: 'lymphocytes', label: 'Lymphocytes', type: 'number', unit: '%' },
      { name: 'monocytes', label: 'Monocytes', type: 'number', unit: '%' },
      { name: 'eosinophils', label: 'Eosinophils', type: 'number', unit: '%' },
      { name: 'basophils', label: 'Basophils', type: 'number', unit: '%' },
    ],
  },
  {
    code: 'pt-inr',
    display: 'Prothrombin Time (PT/INR)',
    loincCode: '5902-2',
    category: 'Hematology',
    specimenType: 'Plasma',
    description: 'Blood clotting time, warfarin monitoring',
    resultFields: [
      { name: 'pt', label: 'Prothrombin Time', type: 'number', unit: 'seconds' },
      { name: 'inr', label: 'INR', type: 'number' },
    ],
  },
  // Infectious Disease
  {
    code: 'strep-rapid',
    display: 'Rapid Strep Test',
    loincCode: '6559-3',
    category: 'Microbiology',
    specimenType: 'Throat Swab',
    description: 'Rapid detection of Group A Streptococcus',
    resultFields: [
      { name: 'result', label: 'Result', type: 'select', options: ['Positive', 'Negative'] },
    ],
  },
  {
    code: 'flu-rapid',
    display: 'Rapid Influenza Test',
    loincCode: '80382-5',
    category: 'Microbiology',
    specimenType: 'Nasopharyngeal Swab',
    description: 'Rapid detection of Influenza A and B',
    resultFields: [
      { name: 'result', label: 'Result', type: 'select', options: ['Positive', 'Negative'] },
    ],
  },
  {
    code: 'covid-pcr',
    display: 'COVID-19 PCR',
    loincCode: '94500-6',
    category: 'Microbiology',
    specimenType: 'Nasopharyngeal Swab',
    description: 'SARS-CoV-2 detection by PCR',
    resultFields: [
      { name: 'result', label: 'Result', type: 'select', options: ['Detected', 'Not Detected'] },
    ],
  },
  {
    code: 'urinalysis',
    display: 'Urinalysis',
    loincCode: '24356-8',
    category: 'Microbiology',
    specimenType: 'Urine',
    description: 'Physical, chemical, and microscopic examination of urine',
    resultFields: [
      { name: 'appearance', label: 'Appearance', type: 'string' },
      { name: 'color', label: 'Color', type: 'string' },
      { name: 'ph', label: 'pH', type: 'number' },
      { name: 'protein', label: 'Protein', type: 'string' },
      { name: 'glucose', label: 'Glucose', type: 'string' },
      { name: 'blood', label: 'Blood', type: 'string' },
      { name: 'leukocytes', label: 'Leukocytes', type: 'string' },
    ],
  },
  {
    code: 'urine-culture',
    display: 'Urine Culture',
    loincCode: '87088-0',
    category: 'Microbiology',
    specimenType: 'Urine',
    description: 'Culture and sensitivity for urinary tract infection',
    resultFields: [
      { name: 'organism', label: 'Organism', type: 'string' },
      { name: 'sensitivity', label: 'Sensitivity', type: 'string' },
      { name: 'result', label: 'Result', type: 'select', options: ['Positive', 'Negative'] },
    ],
  },
  // Other Common Tests
  {
    code: 'vitamin-d',
    display: 'Vitamin D, 25-Hydroxy',
    loincCode: '1989-3',
    category: 'Chemistry',
    specimenType: 'Serum',
    description: 'Vitamin D level assessment',
    resultFields: [
      { name: 'vitamin_d', label: 'Vitamin D', type: 'number', unit: 'ng/mL' },
    ],
  },
  {
    code: 'b12',
    display: 'Vitamin B12',
    loincCode: '2132-9',
    category: 'Chemistry',
    specimenType: 'Serum',
    description: 'Vitamin B12 level',
    resultFields: [
      { name: 'b12', label: 'Vitamin B12', type: 'number', unit: 'pg/mL' },
    ],
  },
  {
    code: 'psa',
    display: 'Prostate-Specific Antigen (PSA)',
    loincCode: '2857-1',
    category: 'Chemistry',
    specimenType: 'Serum',
    description: 'Prostate cancer screening',
    resultFields: [
      { name: 'psa', label: 'PSA', type: 'number', unit: 'ng/mL' },
    ],
  },
];

/**
 * Get all lab tests from the system
 */
export async function getLabTests(medplum: MedplumClient): Promise<ActivityDefinition[]> {
  try {
    // Get all ActivityDefinitions and filter by identifier system
    const result = await medplum.search('ActivityDefinition', {
      _count: '1000'
    });
    
    // Filter to only those with our lab test identifier system
    const labTests = result.entry
      ?.map(e => e.resource as ActivityDefinition)
      .filter(def => 
        def.identifier?.some(id => id.system === LAB_TEST_IDENTIFIER_SYSTEM)
      ) || [];
    
    return labTests;
  } catch (error) {
    logger.error('Failed to load lab tests', error);
    return [];
  }
}

/**
 * Initialize default lab tests
 * @param medplum - Medplum client instance
 */
export async function initializeDefaultLabTests(medplum: MedplumClient): Promise<void> {
  for (const test of DEFAULT_LAB_TESTS) {
    await saveLabTest(medplum, test);
  }
}

/**
 * Save a lab test definition
 * @param medplum - Medplum client instance
 * @param test - Lab test definition
 * @returns - Promise resolving to saved ActivityDefinition
 */
export async function saveLabTest(
  medplum: MedplumClient,
  test: LabTestDefinition
): Promise<ActivityDefinition> {
  // Check if test already exists
  const existing = await medplum.search('ActivityDefinition', {
    identifier: `${LAB_TEST_IDENTIFIER_SYSTEM}|${test.code}`,
    _count: '1',
  });

  const activityDefinition: ActivityDefinition = {
    resourceType: 'ActivityDefinition',
    status: 'active',
    kind: 'ServiceRequest',
    code: {
      coding: test.loincCode ? [
        {
          system: 'http://loinc.org',
          code: test.loincCode,
          display: test.display,
        },
      ] : undefined,
      text: test.display,
    },
    title: test.display,
    description: test.description,
    identifier: [
      {
        system: LAB_TEST_IDENTIFIER_SYSTEM,
        value: test.code,
      },
    ],
    // Store additional metadata in extensions
    extension: [
      {
        url: 'category',
        valueString: test.category,
      },
      test.specimenType ? {
        url: 'specimenType',
        valueString: test.specimenType,
      } : undefined,
      test.aoeQuestions && test.aoeQuestions.length > 0 ? {
        url: 'aoeQuestions',
        valueString: JSON.stringify(test.aoeQuestions),
      } : undefined,
      test.resultFields && test.resultFields.length > 0 ? {
        url: 'resultFields',
        valueString: JSON.stringify(test.resultFields),
      } : undefined,
    ].filter(Boolean) as any,
  };

  // Add price if provided
  const activityWithPrice = test.price !== undefined 
    ? setPriceOnResource(activityDefinition, test.price)
    : activityDefinition;

  if (existing.entry && existing.entry.length > 0) {
    // Update existing
    const existingDef = existing.entry[0].resource as ActivityDefinition;
    return medplum.updateResource({
      ...activityWithPrice,
      id: existingDef.id,
    });
  } else {
    // Create new
    return medplum.createResource(activityWithPrice);
  }
}

/**
 * Delete a lab test
 * @param medplum - Medplum client instance
 * @param code - Lab test code
 */
export async function deleteLabTest(medplum: MedplumClient, code: string): Promise<void> {
  const existing = await medplum.search('ActivityDefinition', {
    identifier: `${LAB_TEST_IDENTIFIER_SYSTEM}|${code}`,
    _count: '1',
  });

  if (existing.entry && existing.entry.length > 0) {
    const def = existing.entry[0].resource as ActivityDefinition;
    if (def.id) {
      await medplum.deleteResource('ActivityDefinition', def.id);
    }
  }
}

