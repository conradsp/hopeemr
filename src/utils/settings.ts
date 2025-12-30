import { MedplumClient } from '@medplum/core';
import { Organization } from '@medplum/fhirtypes';
import { logger } from './logger';
import type { WorkflowConfiguration, WorkflowEmphasis } from '../types/queue.types';
import { DEFAULT_WORKFLOW_CONFIG } from '../types/queue.types';

export interface EMRSettings {
  name: string;
  logo: string | null;
}

/**
 * Extension URLs for workflow configuration
 */
const WORKFLOW_EXTENSION_URLS = {
  emphasis: 'http://medplum.com/emr/workflow-emphasis',
  autoSyncAppointments: 'http://medplum.com/emr/auto-sync-appointments',
  appointmentLeadTime: 'http://medplum.com/emr/appointment-lead-time',
  showScheduledInWorkQueue: 'http://medplum.com/emr/show-scheduled-in-work-queue',
  showQueueOnCalendar: 'http://medplum.com/emr/show-queue-on-calendar',
  requireCheckIn: 'http://medplum.com/emr/require-check-in',
  autoAdvance: 'http://medplum.com/emr/auto-advance',
  enableWalkInSlots: 'http://medplum.com/emr/enable-walk-in-slots',
  walkInSlotDuration: 'http://medplum.com/emr/walk-in-slot-duration',
};

const SETTINGS_ORG_IDENTIFIER = 'emr-settings';

/**
 * Get EMR settings from the Organization resource
 */
export async function getEMRSettings(medplum: MedplumClient): Promise<EMRSettings | null> {
  try {
    // Search for the settings organization
    const result = await medplum.search('Organization', {
      identifier: SETTINGS_ORG_IDENTIFIER,
      _count: '1',
    });

    if (result.entry && result.entry.length > 0) {
      const org = result.entry[0].resource as Organization;
      return {
        name: org.name || 'Medplum EMR',
        logo: org.extension?.find(ext => ext.url === 'logo')?.valueString || null,
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to load EMR settings', error);
    return null;
  }
}

/**
 * Save EMR settings to the Organization resource
 */
export async function saveEMRSettings(medplum: MedplumClient, settings: EMRSettings): Promise<void> {
  try {
    // Search for existing settings organization
    const result = await medplum.search('Organization', {
      identifier: SETTINGS_ORG_IDENTIFIER,
      _count: '1',
    });

    const extension = settings.logo ? [
      {
        url: 'logo',
        valueString: settings.logo,
      },
    ] : undefined;

    if (result.entry && result.entry.length > 0) {
      // Update existing
      const org = result.entry[0].resource as Organization;
      await medplum.updateResource({
        ...org,
        name: settings.name,
        extension,
      });
    } else {
      // Create new
      await medplum.createResource({
        resourceType: 'Organization',
        identifier: [
          {
            system: 'http://medplum.com/emr',
            value: SETTINGS_ORG_IDENTIFIER,
          },
        ],
        name: settings.name,
        extension,
        active: true,
      });
    }
  } catch (error) {
    logger.error('Failed to save EMR settings', error);
    throw error;
  }
}

/**
 * Get workflow configuration from the Organization resource
 * Returns default configuration if not set
 */
export async function getWorkflowConfiguration(medplum: MedplumClient): Promise<WorkflowConfiguration> {
  try {
    const result = await medplum.search('Organization', {
      identifier: SETTINGS_ORG_IDENTIFIER,
      _count: '1',
    });

    if (result.entry && result.entry.length > 0) {
      const org = result.entry[0].resource as Organization;
      const extensions = org.extension || [];

      const getExtValue = <T>(url: string, defaultValue: T): T => {
        const ext = extensions.find(e => e.url === url);
        if (!ext) return defaultValue;
        if (ext.valueString !== undefined) return ext.valueString as T;
        if (ext.valueBoolean !== undefined) return ext.valueBoolean as T;
        if (ext.valueInteger !== undefined) return ext.valueInteger as T;
        if (ext.valueCode !== undefined) return ext.valueCode as T;
        return defaultValue;
      };

      return {
        workflowEmphasis: getExtValue(WORKFLOW_EXTENSION_URLS.emphasis, DEFAULT_WORKFLOW_CONFIG.workflowEmphasis) as WorkflowEmphasis,
        autoSyncAppointmentsToQueue: getExtValue(WORKFLOW_EXTENSION_URLS.autoSyncAppointments, DEFAULT_WORKFLOW_CONFIG.autoSyncAppointmentsToQueue),
        appointmentQueueLeadTimeMinutes: getExtValue(WORKFLOW_EXTENSION_URLS.appointmentLeadTime, DEFAULT_WORKFLOW_CONFIG.appointmentQueueLeadTimeMinutes),
        showScheduledInWorkQueue: getExtValue(WORKFLOW_EXTENSION_URLS.showScheduledInWorkQueue, DEFAULT_WORKFLOW_CONFIG.showScheduledInWorkQueue),
        showQueueOnCalendar: getExtValue(WORKFLOW_EXTENSION_URLS.showQueueOnCalendar, DEFAULT_WORKFLOW_CONFIG.showQueueOnCalendar),
        requireCheckInForScheduled: getExtValue(WORKFLOW_EXTENSION_URLS.requireCheckIn, DEFAULT_WORKFLOW_CONFIG.requireCheckInForScheduled),
        autoAdvanceToNextPatient: getExtValue(WORKFLOW_EXTENSION_URLS.autoAdvance, DEFAULT_WORKFLOW_CONFIG.autoAdvanceToNextPatient),
        enableWalkInSlots: getExtValue(WORKFLOW_EXTENSION_URLS.enableWalkInSlots, DEFAULT_WORKFLOW_CONFIG.enableWalkInSlots),
        defaultWalkInSlotDuration: getExtValue(WORKFLOW_EXTENSION_URLS.walkInSlotDuration, DEFAULT_WORKFLOW_CONFIG.defaultWalkInSlotDuration),
      };
    }

    return { ...DEFAULT_WORKFLOW_CONFIG };
  } catch (error) {
    logger.error('Failed to load workflow configuration', error);
    return { ...DEFAULT_WORKFLOW_CONFIG };
  }
}

/**
 * Save workflow configuration to the Organization resource
 */
export async function saveWorkflowConfiguration(
  medplum: MedplumClient,
  config: WorkflowConfiguration
): Promise<void> {
  try {
    const result = await medplum.search('Organization', {
      identifier: SETTINGS_ORG_IDENTIFIER,
      _count: '1',
    });

    const workflowExtensions = [
      { url: WORKFLOW_EXTENSION_URLS.emphasis, valueCode: config.workflowEmphasis },
      { url: WORKFLOW_EXTENSION_URLS.autoSyncAppointments, valueBoolean: config.autoSyncAppointmentsToQueue },
      { url: WORKFLOW_EXTENSION_URLS.appointmentLeadTime, valueInteger: config.appointmentQueueLeadTimeMinutes },
      { url: WORKFLOW_EXTENSION_URLS.showScheduledInWorkQueue, valueBoolean: config.showScheduledInWorkQueue },
      { url: WORKFLOW_EXTENSION_URLS.showQueueOnCalendar, valueBoolean: config.showQueueOnCalendar },
      { url: WORKFLOW_EXTENSION_URLS.requireCheckIn, valueBoolean: config.requireCheckInForScheduled },
      { url: WORKFLOW_EXTENSION_URLS.autoAdvance, valueBoolean: config.autoAdvanceToNextPatient },
      { url: WORKFLOW_EXTENSION_URLS.enableWalkInSlots, valueBoolean: config.enableWalkInSlots },
      { url: WORKFLOW_EXTENSION_URLS.walkInSlotDuration, valueInteger: config.defaultWalkInSlotDuration },
    ];

    if (result.entry && result.entry.length > 0) {
      const org = result.entry[0].resource as Organization;

      // Preserve existing non-workflow extensions
      const otherExtensions = (org.extension || []).filter(
        ext => !Object.values(WORKFLOW_EXTENSION_URLS).includes(ext.url)
      );

      await medplum.updateResource({
        ...org,
        extension: [...otherExtensions, ...workflowExtensions],
      });
    } else {
      // Create settings organization if it doesn't exist
      await medplum.createResource({
        resourceType: 'Organization',
        identifier: [
          {
            system: 'http://medplum.com/emr',
            value: SETTINGS_ORG_IDENTIFIER,
          },
        ],
        name: 'Medplum EMR',
        extension: workflowExtensions,
        active: true,
      });
    }

    logger.info('Workflow configuration saved', config);
  } catch (error) {
    logger.error('Failed to save workflow configuration', error);
    throw error;
  }
}

