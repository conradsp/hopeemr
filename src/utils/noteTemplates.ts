import { Questionnaire } from '@medplum/fhirtypes';
import { logger } from './logger';
import { MedplumClient } from '@medplum/core';

/**
 * Default clinical note templates following common medical documentation standards
 */

// SOAP Note Template (Subjective, Objective, Assessment, Plan)
export const SOAP_TEMPLATE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'SOAP Note',
  description: 'Subjective, Objective, Assessment, and Plan documentation',
  identifier: [{ system: 'http://medplum.com/note-templates', value: 'soap-note' }],
  item: [
    {
      linkId: 'subjective',
      text: 'Subjective',
      type: 'text',
      required: true,
    },
    {
      linkId: 'objective',
      text: 'Objective',
      type: 'text',
      required: true,
    },
    {
      linkId: 'assessment',
      text: 'Assessment',
      type: 'text',
      required: true,
    },
    {
      linkId: 'plan',
      text: 'Plan',
      type: 'text',
      required: true,
    },
  ],
};

// History and Physical Template
export const H_AND_P_TEMPLATE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'History & Physical',
  description: 'Complete history and physical examination documentation',
  identifier: [{ system: 'http://medplum.com/note-templates', value: 'h-and-p' }],
  item: [
    {
      linkId: 'chief-complaint',
      text: 'Chief Complaint',
      type: 'string',
      required: true,
    },
    {
      linkId: 'hpi',
      text: 'History of Present Illness',
      type: 'text',
      required: true,
    },
    {
      linkId: 'pmh',
      text: 'Past Medical History',
      type: 'text',
    },
    {
      linkId: 'medications',
      text: 'Current Medications',
      type: 'text',
    },
    {
      linkId: 'allergies',
      text: 'Allergies',
      type: 'text',
    },
    {
      linkId: 'social-history',
      text: 'Social History',
      type: 'text',
    },
    {
      linkId: 'family-history',
      text: 'Family History',
      type: 'text',
    },
    {
      linkId: 'ros',
      text: 'Review of Systems',
      type: 'text',
    },
    {
      linkId: 'physical-exam',
      text: 'Physical Examination',
      type: 'text',
      required: true,
    },
    {
      linkId: 'assessment',
      text: 'Assessment',
      type: 'text',
      required: true,
    },
    {
      linkId: 'plan',
      text: 'Plan',
      type: 'text',
      required: true,
    },
  ],
};

// Progress Note Template
export const PROGRESS_NOTE_TEMPLATE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'Progress Note',
  description: 'Daily progress note for ongoing care',
  identifier: [{ system: 'http://medplum.com/note-templates', value: 'progress-note' }],
  item: [
    {
      linkId: 'interval-history',
      text: 'Interval History',
      type: 'text',
      required: true,
    },
    {
      linkId: 'physical-exam',
      text: 'Physical Exam',
      type: 'text',
      required: true,
    },
    {
      linkId: 'labs-results',
      text: 'Labs/Results',
      type: 'text',
    },
    {
      linkId: 'assessment-plan',
      text: 'Assessment & Plan',
      type: 'text',
      required: true,
    },
  ],
};

// Consultation Note Template
export const CONSULTATION_TEMPLATE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'Consultation Note',
  description: 'Specialist consultation documentation',
  identifier: [{ system: 'http://medplum.com/note-templates', value: 'consultation' }],
  item: [
    {
      linkId: 'reason-for-consult',
      text: 'Reason for Consultation',
      type: 'text',
      required: true,
    },
    {
      linkId: 'hpi',
      text: 'History of Present Illness',
      type: 'text',
      required: true,
    },
    {
      linkId: 'review',
      text: 'Review of Records',
      type: 'text',
    },
    {
      linkId: 'physical-exam',
      text: 'Physical Examination',
      type: 'text',
      required: true,
    },
    {
      linkId: 'impression',
      text: 'Impression',
      type: 'text',
      required: true,
    },
    {
      linkId: 'recommendations',
      text: 'Recommendations',
      type: 'text',
      required: true,
    },
  ],
};

// Procedure Note Template
export const PROCEDURE_NOTE_TEMPLATE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'Procedure Note',
  description: 'Documentation for procedures performed',
  identifier: [{ system: 'http://medplum.com/note-templates', value: 'procedure-note' }],
  item: [
    {
      linkId: 'procedure-name',
      text: 'Procedure Name',
      type: 'string',
      required: true,
    },
    {
      linkId: 'indication',
      text: 'Indication',
      type: 'text',
      required: true,
    },
    {
      linkId: 'consent',
      text: 'Consent Obtained',
      type: 'boolean',
      required: true,
    },
    {
      linkId: 'anesthesia',
      text: 'Anesthesia',
      type: 'string',
    },
    {
      linkId: 'description',
      text: 'Procedure Description',
      type: 'text',
      required: true,
    },
    {
      linkId: 'findings',
      text: 'Findings',
      type: 'text',
      required: true,
    },
    {
      linkId: 'complications',
      text: 'Complications',
      type: 'text',
    },
    {
      linkId: 'specimens',
      text: 'Specimens Sent',
      type: 'text',
    },
    {
      linkId: 'post-procedure',
      text: 'Post-Procedure Plan',
      type: 'text',
      required: true,
    },
  ],
};

// Discharge Summary Template
export const DISCHARGE_SUMMARY_TEMPLATE: Questionnaire = {
  resourceType: 'Questionnaire',
  status: 'active',
  title: 'Discharge Summary',
  description: 'Hospital discharge documentation',
  identifier: [{ system: 'http://medplum.com/note-templates', value: 'discharge-summary' }],
  item: [
    {
      linkId: 'admission-date',
      text: 'Admission Date',
      type: 'date',
      required: true,
    },
    {
      linkId: 'discharge-date',
      text: 'Discharge Date',
      type: 'date',
      required: true,
    },
    {
      linkId: 'admission-diagnosis',
      text: 'Admission Diagnosis',
      type: 'text',
      required: true,
    },
    {
      linkId: 'discharge-diagnosis',
      text: 'Discharge Diagnosis',
      type: 'text',
      required: true,
    },
    {
      linkId: 'hospital-course',
      text: 'Hospital Course',
      type: 'text',
      required: true,
    },
    {
      linkId: 'procedures',
      text: 'Procedures Performed',
      type: 'text',
    },
    {
      linkId: 'discharge-medications',
      text: 'Discharge Medications',
      type: 'text',
      required: true,
    },
    {
      linkId: 'discharge-instructions',
      text: 'Discharge Instructions',
      type: 'text',
      required: true,
    },
    {
      linkId: 'follow-up',
      text: 'Follow-up Plans',
      type: 'text',
      required: true,
    },
  ],
};

/**
 * Array of all default templates
 */
export const DEFAULT_TEMPLATES = [
  SOAP_TEMPLATE,
  H_AND_P_TEMPLATE,
  PROGRESS_NOTE_TEMPLATE,
  CONSULTATION_TEMPLATE,
  PROCEDURE_NOTE_TEMPLATE,
  DISCHARGE_SUMMARY_TEMPLATE,
];

/**
 * Initialize default templates in the system
 */
export async function initializeDefaultTemplates(medplum: MedplumClient): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    try {
      // Check if template already exists
      const existing = await medplum.search('Questionnaire', {
        identifier: template.identifier?.[0]?.value || '',
        _count: '1',
      });

      if (!existing.entry || existing.entry.length === 0) {
        // Create the template
        await medplum.createResource(template);
      }
    } catch (error) {
      logger.error(`Failed to initialize template ${template.title}`, error);
    }
  }
}

/**
 * Get all note templates from the system
 */
export async function getNoteTemplates(medplum: MedplumClient): Promise<Questionnaire[]> {
  try {
    const result = await medplum.search('Questionnaire', {
      _count: '100',
      _sort: 'title',
    });
    return (result.entry?.map(e => e.resource as Questionnaire) || []);
  } catch (error) {
    logger.error('Failed to load note templates', error);
    return [];
  }
}

