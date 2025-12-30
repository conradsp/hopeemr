import { MedplumClient } from '@medplum/core';
import { ActivityDefinition } from '@medplum/fhirtypes';
import { logger } from './logger';
import { setPriceOnResource } from './billing';

export interface ImagingTestDefinition {
  code: string;
  display: string;
  loincCode?: string;
  category: string;
  bodyPart?: string;
  modality?: string;
  description?: string;
  price?: number;
}

const IMAGING_TEST_IDENTIFIER_SYSTEM = 'http://medplum.com/emr/imaging-test';

/**
 * Default imaging tests catalog
 */
export const DEFAULT_IMAGING_TESTS: ImagingTestDefinition[] = [
  // X-Ray Studies
  {
    code: 'chest-xray-2view',
    display: 'Chest X-Ray, 2 Views',
    loincCode: '30746-2',
    category: 'X-Ray',
    bodyPart: 'Chest',
    modality: 'DX',
    description: 'Frontal and lateral chest radiograph',
  },
  {
    code: 'chest-xray-1view',
    display: 'Chest X-Ray, 1 View',
    loincCode: '36643-5',
    category: 'X-Ray',
    bodyPart: 'Chest',
    modality: 'DX',
    description: 'Single view chest radiograph',
  },
  {
    code: 'abdomen-xray',
    display: 'Abdomen X-Ray',
    loincCode: '30704-1',
    category: 'X-Ray',
    bodyPart: 'Abdomen',
    modality: 'DX',
    description: 'Abdominal radiograph',
  },
  {
    code: 'spine-lumbar-xray',
    display: 'Lumbar Spine X-Ray',
    loincCode: '30751-2',
    category: 'X-Ray',
    bodyPart: 'Lumbar Spine',
    modality: 'DX',
    description: 'Lumbosacral spine radiograph',
  },
  {
    code: 'knee-xray',
    display: 'Knee X-Ray',
    loincCode: '37648-3',
    category: 'X-Ray',
    bodyPart: 'Knee',
    modality: 'DX',
    description: 'Knee radiograph',
  },

  // CT Scans
  {
    code: 'ct-head-wo',
    display: 'CT Head without Contrast',
    loincCode: '82692-5',
    category: 'CT',
    bodyPart: 'Head',
    modality: 'CT',
    description: 'Non-contrast CT of head',
  },
  {
    code: 'ct-chest-wo',
    display: 'CT Chest without Contrast',
    loincCode: '82698-2',
    category: 'CT',
    bodyPart: 'Chest',
    modality: 'CT',
    description: 'Non-contrast CT of chest',
  },
  {
    code: 'ct-abdomen-pelvis-w',
    display: 'CT Abdomen and Pelvis with Contrast',
    loincCode: '79096-2',
    category: 'CT',
    bodyPart: 'Abdomen/Pelvis',
    modality: 'CT',
    description: 'Contrast-enhanced CT of abdomen and pelvis',
  },
  {
    code: 'ct-spine-lumbar',
    display: 'CT Lumbar Spine',
    loincCode: '82701-4',
    category: 'CT',
    bodyPart: 'Lumbar Spine',
    modality: 'CT',
    description: 'CT of lumbar spine',
  },

  // MRI Studies
  {
    code: 'mri-brain-wo',
    display: 'MRI Brain without Contrast',
    loincCode: '79087-1',
    category: 'MRI',
    bodyPart: 'Brain',
    modality: 'MR',
    description: 'Non-contrast MRI of brain',
  },
  {
    code: 'mri-brain-w',
    display: 'MRI Brain with Contrast',
    loincCode: '79088-9',
    category: 'MRI',
    bodyPart: 'Brain',
    modality: 'MR',
    description: 'Contrast-enhanced MRI of brain',
  },
  {
    code: 'mri-spine-lumbar',
    display: 'MRI Lumbar Spine',
    loincCode: '79090-5',
    category: 'MRI',
    bodyPart: 'Lumbar Spine',
    modality: 'MR',
    description: 'MRI of lumbar spine',
  },
  {
    code: 'mri-knee',
    display: 'MRI Knee',
    loincCode: '37362-1',
    category: 'MRI',
    bodyPart: 'Knee',
    modality: 'MR',
    description: 'MRI of knee',
  },
  {
    code: 'mri-shoulder',
    display: 'MRI Shoulder',
    loincCode: '37365-4',
    category: 'MRI',
    bodyPart: 'Shoulder',
    modality: 'MR',
    description: 'MRI of shoulder',
  },

  // Ultrasound
  {
    code: 'us-abdomen-complete',
    display: 'Ultrasound Abdomen Complete',
    loincCode: '79379-2',
    category: 'Ultrasound',
    bodyPart: 'Abdomen',
    modality: 'US',
    description: 'Complete abdominal ultrasound',
  },
  {
    code: 'us-pelvis',
    display: 'Ultrasound Pelvis',
    loincCode: '79380-0',
    category: 'Ultrasound',
    bodyPart: 'Pelvis',
    modality: 'US',
    description: 'Pelvic ultrasound',
  },
  {
    code: 'us-ob-complete',
    display: 'Ultrasound OB Complete',
    loincCode: '79381-8',
    category: 'Ultrasound',
    bodyPart: 'Uterus',
    modality: 'US',
    description: 'Complete obstetric ultrasound',
  },

  // Other Modalities
  {
    code: 'dexa-spine-hip',
    display: 'DEXA Scan Spine and Hip',
    loincCode: '38269-7',
    category: 'Nuclear Medicine',
    bodyPart: 'Spine/Hip',
    modality: 'DXA',
    description: 'Bone density measurement',
  },
  {
    code: 'echo-transthoracic',
    display: 'Echocardiogram Transthoracic',
    loincCode: '79379-2',
    category: 'Ultrasound',
    bodyPart: 'Heart',
    modality: 'US',
    description: 'Transthoracic echocardiography',
  },
  {
    code: 'mammogram-screening',
    display: 'Mammogram Screening',
    loincCode: '24604-1',
    category: 'Mammography',
    bodyPart: 'Breast',
    modality: 'MG',
    description: 'Screening mammography bilateral',
  },
];

/**
 * Get all imaging tests from the system
 */
export async function getImagingTests(medplum: MedplumClient): Promise<ActivityDefinition[]> {
  try {
    // Get all ActivityDefinitions and filter by identifier system
    const result = await medplum.search('ActivityDefinition', {
      _count: '1000',
      _sort: 'title',
    });
    
    // Filter to only those with our imaging test identifier system
    const imagingTests = result.entry
      ?.map(e => e.resource as ActivityDefinition)
      .filter(def => 
        def.identifier?.some(id => id.system === IMAGING_TEST_IDENTIFIER_SYSTEM)
      ) || [];
    
    return imagingTests;
  } catch (error) {
    logger.error('Failed to load imaging tests', error);
    return [];
  }
}

/**
 * Initialize default imaging tests
 */
export async function initializeDefaultImagingTests(medplum: MedplumClient): Promise<void> {
  for (const test of DEFAULT_IMAGING_TESTS) {
    await saveImagingTest(medplum, test);
  }
}

/**
 * Save an imaging test definition
 */
export async function saveImagingTest(
  medplum: MedplumClient,
  test: ImagingTestDefinition
): Promise<ActivityDefinition> {
  // Check if test already exists
  const existing = await medplum.search('ActivityDefinition', {
    identifier: `${IMAGING_TEST_IDENTIFIER_SYSTEM}|${test.code}`,
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
        system: IMAGING_TEST_IDENTIFIER_SYSTEM,
        value: test.code,
      },
    ],
    // Store additional metadata in extensions
    extension: [
      {
        url: 'category',
        valueString: test.category,
      },
      test.bodyPart ? {
        url: 'bodyPart',
        valueString: test.bodyPart,
      } : undefined,
      test.modality ? {
        url: 'modality',
        valueString: test.modality,
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
    return await medplum.updateResource({
      ...activityWithPrice,
      id: existingDef.id,
    });
  } else {
    // Create new
    return await medplum.createResource(activityWithPrice);
  }
}

/**
 * Delete an imaging test
 */
export async function deleteImagingTest(medplum: MedplumClient, code: string): Promise<void> {
  const existing = await medplum.search('ActivityDefinition', {
    identifier: `${IMAGING_TEST_IDENTIFIER_SYSTEM}|${code}`,
    _count: '1',
  });

  if (existing.entry && existing.entry.length > 0) {
    const def = existing.entry[0].resource as ActivityDefinition;
    if (def.id) {
      await medplum.deleteResource('ActivityDefinition', def.id);
    }
  }
}

