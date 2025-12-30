import { MedplumClient } from '@medplum/core';
import type { Appointment, Task, Location, Patient, Reference } from '@medplum/fhirtypes';
import { logger } from './logger';
import { getWorkflowConfiguration } from './settings';
import { createQueueEntry } from './queueUtils';
import type { WorkflowConfiguration, AppointmentSyncStatus } from '../types/queue.types';

/**
 * Appointment to Queue Synchronization Service
 *
 * This service automatically syncs scheduled appointments to the patient queue
 * based on facility workflow configuration. It follows industry best practices
 * from Epic, Cerner, and OpenMRS for integrated scheduling and queue management.
 *
 * Key behaviors:
 * - Runs periodically (every 5 minutes by default)
 * - Checks for appointments due within the configured lead time
 * - Creates queue entries for appointments that haven't been synced
 * - Skips appointments that are already synced, cancelled, or no-show
 */

// Extension URL for tracking sync status
const SYNC_STATUS_EXTENSION = 'http://medplum.com/emr/queue-sync-status';
const SYNC_TASK_EXTENSION = 'http://medplum.com/emr/queue-task-reference';

// Sync interval in milliseconds (5 minutes)
const DEFAULT_SYNC_INTERVAL = 5 * 60 * 1000;

// Singleton instance
let syncIntervalId: NodeJS.Timeout | null = null;
let currentMedplum: MedplumClient | null = null;

/**
 * Initialize the appointment sync service
 * Should be called once when the app starts (for authenticated users)
 */
export function initializeAppointmentSyncService(medplum: MedplumClient): void {
  if (syncIntervalId) {
    logger.warn('Appointment sync service already initialized');
    return;
  }

  currentMedplum = medplum;

  // Run initial sync
  syncAppointmentsToQueue(medplum).catch(err => {
    logger.error('Initial appointment sync failed', err);
  });

  // Set up periodic sync
  syncIntervalId = setInterval(() => {
    if (currentMedplum) {
      syncAppointmentsToQueue(currentMedplum).catch(err => {
        logger.error('Periodic appointment sync failed', err);
      });
    }
  }, DEFAULT_SYNC_INTERVAL);

  logger.info('Appointment sync service initialized');
}

/**
 * Stop the appointment sync service
 */
export function stopAppointmentSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    currentMedplum = null;
    logger.info('Appointment sync service stopped');
  }
}

/**
 * Manually trigger an appointment sync
 * Useful for testing or when settings change
 */
export async function triggerAppointmentSync(medplum: MedplumClient): Promise<AppointmentSyncStatus[]> {
  return syncAppointmentsToQueue(medplum);
}

/**
 * Main sync function - finds appointments due soon and creates queue entries
 */
async function syncAppointmentsToQueue(medplum: MedplumClient): Promise<AppointmentSyncStatus[]> {
  const results: AppointmentSyncStatus[] = [];

  try {
    // Load workflow configuration
    const config = await getWorkflowConfiguration(medplum);

    // Check if auto-sync is enabled
    if (!config.autoSyncAppointmentsToQueue) {
      logger.debug('Auto-sync appointments is disabled');
      return results;
    }

    // Calculate time window
    const now = new Date();
    const leadTimeMs = config.appointmentQueueLeadTimeMinutes * 60 * 1000;
    const windowEnd = new Date(now.getTime() + leadTimeMs);

    // Find appointments starting within the lead time window
    // Status: booked (not yet arrived, not cancelled, not fulfilled)
    // Use date range: today <= date <= windowEnd
    const todayStr = now.toISOString().split('T')[0];
    const searchParams = new URLSearchParams();
    searchParams.append('status', 'booked');
    searchParams.append('date', `ge${todayStr}`);
    searchParams.append('date', `le${windowEnd.toISOString()}`);
    searchParams.append('_count', '100');

    const appointments = await medplum.searchResources('Appointment', searchParams.toString());

    logger.debug(`Found ${appointments.length} appointments within sync window`);

    // Process each appointment
    for (const appointment of appointments) {
      const status = await processAppointmentForSync(medplum, appointment, config);
      results.push(status);
    }

    // Log summary
    const synced = results.filter(r => r.status === 'synced').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    logger.info(`Appointment sync completed: ${synced} synced, ${skipped} skipped`);

    return results;
  } catch (error) {
    logger.error('Appointment sync failed', error);
    throw error;
  }
}

/**
 * Process a single appointment for queue sync
 */
async function processAppointmentForSync(
  medplum: MedplumClient,
  appointment: Appointment,
  config: WorkflowConfiguration
): Promise<AppointmentSyncStatus> {
  const appointmentId = appointment.id!;

  try {
    // Check if already synced
    const existingSyncStatus = appointment.extension?.find(
      ext => ext.url === SYNC_STATUS_EXTENSION
    )?.valueCode;

    if (existingSyncStatus === 'synced' || existingSyncStatus === 'arrived') {
      return {
        appointmentId,
        status: existingSyncStatus as 'synced' | 'arrived',
        skipReason: 'Already synced',
      };
    }

    // Check if appointment time is within sync window
    const appointmentStart = appointment.start ? new Date(appointment.start) : null;
    if (!appointmentStart) {
      return {
        appointmentId,
        status: 'skipped',
        skipReason: 'No start time',
      };
    }

    const now = new Date();
    const leadTimeMs = config.appointmentQueueLeadTimeMinutes * 60 * 1000;
    const syncThreshold = new Date(appointmentStart.getTime() - leadTimeMs);

    if (now < syncThreshold) {
      return {
        appointmentId,
        status: 'pending',
        skipReason: 'Not yet within lead time window',
      };
    }

    // Get patient reference
    const patientParticipant = appointment.participant?.find(
      p => p.actor?.reference?.startsWith('Patient/')
    );
    if (!patientParticipant?.actor?.reference) {
      return {
        appointmentId,
        status: 'skipped',
        skipReason: 'No patient participant',
      };
    }

    // Get location (from appointment location or serviceCategory)
    let locationRef: Reference<Location> | undefined;
    if (appointment.participant) {
      const locationParticipant = appointment.participant.find(
        p => p.actor?.reference?.startsWith('Location/')
      );
      if (locationParticipant?.actor) {
        locationRef = locationParticipant.actor as Reference<Location>;
      }
    }

    // If no location in participants, try to get a default location
    if (!locationRef) {
      try {
        const locations = await medplum.searchResources('Location', {
          _count: '1',
          status: 'active',
        });
        if (locations.length > 0) {
          locationRef = { reference: `Location/${locations[0].id}` };
        }
      } catch (err) {
        logger.warn('Failed to get default location', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    if (!locationRef) {
      return {
        appointmentId,
        status: 'skipped',
        skipReason: 'No location available',
      };
    }

    // Check if a queue task already exists for this appointment
    const existingTasks = await medplum.searchResources('Task', {
      'based-on': `Appointment/${appointmentId}`,
      code: 'http://medplum.com/fhir/CodeSystem/task-code|patient-queue-entry',
      _count: '1',
    });

    if (existingTasks.length > 0) {
      // Update appointment to mark as synced
      await updateAppointmentSyncStatus(medplum, appointment, 'synced', existingTasks[0].id);
      return {
        appointmentId,
        taskId: existingTasks[0].id,
        status: 'synced',
        syncedAt: new Date().toISOString(),
      };
    }

    // Create queue entry
    const task = await createQueueEntry(medplum, {
      patient: patientParticipant.actor as Reference<Patient>,
      location: locationRef,
      appointment: { reference: `Appointment/${appointmentId}` },
      chiefComplaint: appointment.description || appointment.appointmentType?.text,
      checkInMethod: 'scheduled',
      triageLevel: 5, // Default to lowest priority for scheduled appointments
    });

    // Update appointment to mark as synced
    await updateAppointmentSyncStatus(medplum, appointment, 'synced', task.id);

    logger.info('Appointment synced to queue', {
      appointmentId,
      taskId: task.id,
    });

    return {
      appointmentId,
      taskId: task.id,
      status: 'synced',
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Failed to sync appointment', { appointmentId, error });
    return {
      appointmentId,
      status: 'skipped',
      skipReason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update appointment with sync status
 */
async function updateAppointmentSyncStatus(
  medplum: MedplumClient,
  appointment: Appointment,
  status: 'synced' | 'arrived' | 'skipped',
  taskId?: string
): Promise<void> {
  try {
    // Filter out old sync extensions
    const otherExtensions = (appointment.extension || []).filter(
      ext => ext.url !== SYNC_STATUS_EXTENSION && ext.url !== SYNC_TASK_EXTENSION
    );

    // Add new sync extensions
    const newExtensions = [
      ...otherExtensions,
      { url: SYNC_STATUS_EXTENSION, valueCode: status },
    ];

    if (taskId) {
      newExtensions.push({
        url: SYNC_TASK_EXTENSION,
        valueReference: { reference: `Task/${taskId}` },
      });
    }

    await medplum.updateResource({
      ...appointment,
      extension: newExtensions,
    });
  } catch (error) {
    logger.error('Failed to update appointment sync status', { appointmentId: appointment.id, error });
    // Don't throw - sync status update is not critical
  }
}

/**
 * Mark an appointment as arrived (manual check-in)
 * This is called when a patient checks in for a scheduled appointment
 */
export async function markAppointmentArrived(
  medplum: MedplumClient,
  appointmentId: string,
  taskId: string
): Promise<void> {
  try {
    const appointment = await medplum.readResource('Appointment', appointmentId);
    await updateAppointmentSyncStatus(medplum, appointment, 'arrived', taskId);

    // Also update appointment status to 'arrived'
    await medplum.updateResource({
      ...appointment,
      status: 'arrived',
    });

    logger.info('Appointment marked as arrived', { appointmentId, taskId });
  } catch (error) {
    logger.error('Failed to mark appointment as arrived', { appointmentId, error });
    throw error;
  }
}

/**
 * Get sync status for an appointment
 */
export function getAppointmentSyncStatus(appointment: Appointment): AppointmentSyncStatus {
  const statusExt = appointment.extension?.find(ext => ext.url === SYNC_STATUS_EXTENSION);
  const taskExt = appointment.extension?.find(ext => ext.url === SYNC_TASK_EXTENSION);

  return {
    appointmentId: appointment.id!,
    status: (statusExt?.valueCode as AppointmentSyncStatus['status']) || 'pending',
    taskId: taskExt?.valueReference?.reference?.split('/')[1],
  };
}

/**
 * Check if an appointment is synced to queue
 */
export function isAppointmentSynced(appointment: Appointment): boolean {
  const statusExt = appointment.extension?.find(ext => ext.url === SYNC_STATUS_EXTENSION);
  return statusExt?.valueCode === 'synced' || statusExt?.valueCode === 'arrived';
}
