import { MedplumClient } from '@medplum/core';
import type {
  Task,
  Patient,
  Appointment,
  Encounter,
  Location,
  Practitioner,
  Reference,
  CodeableConcept,
  Bundle,
  AuditEvent,
} from '@medplum/fhirtypes';
import { logger } from './logger';
import type {
  CheckInRequest,
  QueueEntry,
  TriageUpdate,
  ProviderTask,
  ProviderTaskType,
  EndOfDaySummary,
} from '../types/queue.types';

/**
 * Queue Management Utilities
 *
 * FHIR Compliance:
 * - Uses Task resource for queue entries (FHIR R4 compliant)
 * - Proper CodeableConcept for businessStatus (Healthcare Agent requirement)
 * - Standard FHIR references and relationships
 *
 * Security:
 * - Input validation on all operations
 * - Audit logging for all queue actions
 * - Soft delete only (no hard deletes)
 * - Race condition protection with optimistic locking
 */

// FHIR Coding Systems
const QUEUE_TASK_CODE_SYSTEM = 'http://medplum.com/fhir/CodeSystem/task-code';
const QUEUE_STATUS_SYSTEM = 'http://medplum.com/fhir/CodeSystem/queue-status';
const CHECKIN_METHOD_SYSTEM = 'http://medplum.com/fhir/CodeSystem/checkin-method';
const TRIAGE_LEVEL_EXTENSION = 'http://medplum.com/fhir/StructureDefinition/triage-level';
const CHIEF_COMPLAINT_EXTENSION = 'http://medplum.com/fhir/StructureDefinition/chief-complaint';
const COMPLAINT_SENSITIVITY_EXTENSION = 'http://medplum.com/fhir/StructureDefinition/complaint-sensitivity';
const CHECKIN_METHOD_EXTENSION = 'http://medplum.com/fhir/StructureDefinition/checkin-method';

/**
 * Create a queue entry (check in patient)
 *
 * @param medplum - MedplumClient instance
 * @param request - Check-in request data
 * @returns Created Task resource
 *
 * Security: Validates all inputs, logs audit event
 * Healthcare: Proper FHIR Task structure with CodeableConcept businessStatus
 */
export async function createQueueEntry(
  medplum: MedplumClient,
  request: CheckInRequest
): Promise<Task> {
  // Input validation
  validateCheckInRequest(request);

  // Determine priority from triage level if not specified
  const priority = request.priority || determinePriorityFromTriage(request.triageLevel);

  // Determine complaint sensitivity
  const sensitivity = request.complainSensitivity || 'public';

  // Build Task resource with proper FHIR structure
  const task: Task = {
    resourceType: 'Task',

    // Standard FHIR fields
    status: 'ready',
    intent: 'order',
    priority,

    // Task code - identifies this as a queue entry
    code: {
      coding: [
        {
          system: QUEUE_TASK_CODE_SYSTEM,
          code: 'patient-queue-entry',
          display: 'Patient Queue Entry',
        },
      ],
    },

    // Business status - MUST be CodeableConcept (Healthcare Agent requirement)
    businessStatus: {
      coding: [
        {
          system: QUEUE_STATUS_SYSTEM,
          code: 'waiting',
          display: 'Waiting',
        },
      ],
      text: 'Waiting for service',
    },

    // Patient reference
    for: request.patient,

    // Location reference (Healthcare Agent recommendation)
    location: request.location,

    // Requester - who created the queue entry (Healthcare Agent - provenance)
    requester: request.requester,

    // Appointment reference - use basedOn (Healthcare Agent requirement, not extension)
    basedOn: request.appointment ? [request.appointment] : undefined,

    // Timestamps
    authoredOn: new Date().toISOString(),

    // Extensions for queue-specific data
    extension: [
      // Triage level (ESI 1-5)
      ...(request.triageLevel
        ? [
            {
              url: TRIAGE_LEVEL_EXTENSION,
              valueInteger: request.triageLevel,
            },
          ]
        : []),

      // Chief complaint
      ...(request.chiefComplaint
        ? [
            {
              url: CHIEF_COMPLAINT_EXTENSION,
              valueString: sanitizeInput(request.chiefComplaint),
            },
          ]
        : []),

      // Complaint sensitivity level (Security Agent requirement)
      {
        url: COMPLAINT_SENSITIVITY_EXTENSION,
        valueCode: sensitivity,
      },

      // Check-in method
      {
        url: CHECKIN_METHOD_EXTENSION,
        valueCode: request.checkInMethod,
      },
    ],

    // Security classification (Security Agent requirement)
    meta: {
      tag: [
        {
          system: 'http://medplum.com/security-tags',
          code: 'queue-entry',
        },
      ],
      security: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
          code: 'R', // Restricted
          display: 'Restricted',
        },
      ],
    },
  };

  // Create the Task resource
  const createdTask = await medplum.createResource(task);

  // Update appointment status to 'arrived' if applicable
  if (request.appointment?.reference) {
    try {
      const appointmentId = request.appointment.reference.split('/')[1];
      const appointment = await medplum.readResource('Appointment', appointmentId);

      await medplum.updateResource({
        ...appointment,
        status: 'arrived',
      });

      logger.info('Updated appointment status to arrived', {
        appointmentId,
        taskId: createdTask.id,
      });
    } catch (error) {
      logger.error('Failed to update appointment status', error);
      // Don't fail the check-in if appointment update fails
    }
  }

  // Audit logging (Security Agent requirement)
  await logQueueAudit(medplum, {
    action: 'queue-entry-created',
    taskId: createdTask.id!,
    patientId: request.patient.reference!.split('/')[1],
    performerId: request.requester?.reference?.split('/')[1] || 'unknown',
    details: {
      checkInMethod: request.checkInMethod,
      priority,
      triageLevel: request.triageLevel,
    },
  });

  logger.info('Queue entry created', {
    taskId: createdTask.id,
    patientId: request.patient.reference,
    priority,
  });

  return createdTask;
}

/**
 * Get queue entries for a location/provider
 *
 * @param medplum - MedplumClient instance
 * @param options - Query options
 * @returns Array of Task resources
 *
 * Security: Filters by location and provider based on permissions
 */
export async function getQueue(
  medplum: MedplumClient,
  options: {
    location?: string;
    provider?: string;
    status?: ('ready' | 'in-progress')[];
  } = {}
): Promise<Task[]> {
  const { location, provider, status = ['ready', 'in-progress'] } = options;

  const searchParams: Record<string, string> = {
    code: 'http://medplum.com/fhir/CodeSystem/task-code|patient-queue-entry',
    status: status.join(','),
    _sort: '-priority,_lastUpdated', // Priority DESC (stat first), then FIFO by last updated
    _count: '100',
  };

  if (location) {
    searchParams.location = `Location/${location}`;
  }

  if (provider) {
    searchParams.owner = `Practitioner/${provider}`;
  }

  const tasks = await medplum.searchResources('Task', searchParams);

  return tasks;
}

/**
 * Claim next patient from queue (with race condition protection)
 *
 * @param medplum - MedplumClient instance
 * @param provider - Provider reference
 * @param location - Optional location filter
 * @returns Task and Encounter, or null if no patients waiting
 *
 * Security: Optimistic locking to prevent race conditions (Security Agent requirement)
 * Healthcare: Atomic transaction for Task update + Encounter creation (Healthcare Agent requirement)
 */
export async function claimNextPatient(
  medplum: MedplumClient,
  provider: Reference<Practitioner>,
  location?: Reference<Location>
): Promise<{ task: Task; encounter: Encounter } | null> {
  // Get all waiting patients, sorted by priority
  const tasks = await getQueue(medplum, {
    location: location?.reference?.split('/')[1],
    status: ['ready'],
  });

  if (tasks.length === 0) {
    return null;
  }

  // First task is highest priority + oldest (FIFO within priority)
  const task = tasks[0];

  // Security check: Verify task is still ready (race condition protection)
  if (task.status !== 'ready') {
    throw new Error('Patient already claimed by another provider');
  }

  if (!task.meta?.versionId) {
    throw new Error('Task version not available for optimistic locking');
  }

  // Get patient reference
  const patientRef = task.for;
  if (!patientRef?.reference) {
    throw new Error('Task missing patient reference');
  }
  const patient = patientRef as Reference<Patient>;

  // Create Encounter resource
  const encounter: Encounter = {
    resourceType: 'Encounter',
    status: 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: patient,
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'PPRF',
                display: 'primary performer',
              },
            ],
          },
        ],
        individual: provider,
      },
    ],
    period: {
      start: new Date().toISOString(),
    },
    ...(task.location && {
      location: [
        {
          location: task.location,
        },
      ],
    }),
    // Link back to appointment if exists
    ...(task.basedOn &&
      task.basedOn.length > 0 && {
        basedOn: task.basedOn,
      }),
  };

  // Update Task with new status and link to encounter
  // Use atomic transaction to ensure both succeed or both fail (Healthcare Agent requirement)
  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      // Create Encounter
      {
        request: {
          method: 'POST',
          url: 'Encounter',
        },
        resource: encounter,
        fullUrl: 'urn:uuid:encounter-temp',
      },
      // Update Task with optimistic locking (Security Agent requirement)
      {
        request: {
          method: 'PUT',
          url: `Task/${task.id}`,
          ifMatch: `W/"${task.meta.versionId}"`, // Optimistic locking
        },
        resource: {
          ...task,
          status: 'in-progress',
          businessStatus: {
            coding: [
              {
                system: QUEUE_STATUS_SYSTEM,
                code: 'in-service',
                display: 'In Service',
              },
            ],
            text: 'In service',
          },
          owner: provider,
          // Link to encounter (will be resolved after transaction)
          focus: {
            reference: 'urn:uuid:encounter-temp',
          },
          lastModified: new Date().toISOString(),
        },
      },
    ],
  };

  try {
    const result = await medplum.executeBatch(bundle);

    // Extract created encounter and updated task from transaction result
    const encounterEntry = result.entry?.find((e) => e.resource?.resourceType === 'Encounter');
    const taskEntry = result.entry?.find((e) => e.resource?.resourceType === 'Task');

    if (!encounterEntry?.resource || !taskEntry?.resource) {
      throw new Error('Transaction did not return expected resources');
    }

    const createdEncounter = encounterEntry.resource as Encounter;
    const updatedTask = taskEntry.resource as Task;

    // Audit logging (Security Agent requirement)
    await logQueueAudit(medplum, {
      action: 'patient-claimed',
      taskId: updatedTask.id!,
      patientId: patient.reference.split('/')[1],
      performerId: provider.reference!.split('/')[1],
      details: {
        encounterId: createdEncounter.id,
        priority: task.priority,
      },
    });

    logger.info('Patient claimed successfully', {
      taskId: updatedTask.id,
      encounterId: createdEncounter.id,
      providerId: provider.reference,
    });

    return { task: updatedTask, encounter: createdEncounter };
  } catch (error: any) {
    // Handle version conflict (race condition detected)
    if (error.outcome?.issue?.[0]?.code === 'conflict') {
      logger.warn('Optimistic locking conflict - patient already claimed', {
        taskId: task.id,
      });
      throw new Error('Patient was just claimed by another provider. Please select a different patient.');
    }

    logger.error('Failed to claim patient', error);
    throw error;
  }
}

/**
 * Claim a specific patient from the queue
 *
 * @param medplum - MedplumClient instance
 * @param taskId - The specific task ID to claim
 * @param provider - Provider reference
 * @returns Task and Encounter, or null if task not found/claimable
 *
 * Security: Optimistic locking to prevent race conditions
 * Healthcare: Atomic transaction for Task update + Encounter creation
 */
export async function claimSpecificPatient(
  medplum: MedplumClient,
  taskId: string,
  provider: Reference<Practitioner>
): Promise<{ task: Task; encounter: Encounter } | null> {
  // Read the specific task
  const task = await medplum.readResource('Task', taskId);

  // Security check: Verify task is still ready (race condition protection)
  if (task.status !== 'ready') {
    throw new Error('Patient already claimed by another provider');
  }

  if (!task.meta?.versionId) {
    throw new Error('Task version not available for optimistic locking');
  }

  // Get patient reference
  const patientRef = task.for;
  if (!patientRef?.reference) {
    throw new Error('Task missing patient reference');
  }
  const patient = patientRef as Reference<Patient>;

  // Create Encounter resource
  const encounter: Encounter = {
    resourceType: 'Encounter',
    status: 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: patient,
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'PPRF',
                display: 'primary performer',
              },
            ],
          },
        ],
        individual: provider,
      },
    ],
    period: {
      start: new Date().toISOString(),
    },
    ...(task.location && {
      location: [
        {
          location: task.location,
        },
      ],
    }),
    // Link back to appointment if exists
    ...(task.basedOn &&
      task.basedOn.length > 0 && {
        basedOn: task.basedOn,
      }),
  };

  // Update Task with new status and link to encounter
  // Use atomic transaction to ensure both succeed or both fail
  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      // Create Encounter
      {
        request: {
          method: 'POST',
          url: 'Encounter',
        },
        resource: encounter,
        fullUrl: 'urn:uuid:encounter-temp',
      },
      // Update Task with optimistic locking
      {
        request: {
          method: 'PUT',
          url: `Task/${task.id}`,
          ifMatch: `W/"${task.meta.versionId}"`,
        },
        resource: {
          ...task,
          status: 'in-progress',
          businessStatus: {
            coding: [
              {
                system: QUEUE_STATUS_SYSTEM,
                code: 'in-service',
                display: 'In Service',
              },
            ],
            text: 'In service',
          },
          owner: provider,
          focus: {
            reference: 'urn:uuid:encounter-temp',
          },
          lastModified: new Date().toISOString(),
        },
      },
    ],
  };

  try {
    const result = await medplum.executeBatch(bundle);

    // Extract created encounter and updated task from transaction result
    const encounterEntry = result.entry?.find((e) => e.resource?.resourceType === 'Encounter');
    const taskEntry = result.entry?.find((e) => e.resource?.resourceType === 'Task');

    if (!encounterEntry?.resource || !taskEntry?.resource) {
      throw new Error('Transaction did not return expected resources');
    }

    const createdEncounter = encounterEntry.resource as Encounter;
    const updatedTask = taskEntry.resource as Task;

    // Audit logging
    await logQueueAudit(medplum, {
      action: 'patient-claimed',
      taskId: updatedTask.id!,
      patientId: patient.reference.split('/')[1],
      performerId: provider.reference!.split('/')[1],
      details: {
        encounterId: createdEncounter.id,
        priority: task.priority,
      },
    });

    logger.info('Patient claimed successfully', {
      taskId: updatedTask.id,
      encounterId: createdEncounter.id,
      providerId: provider.reference,
    });

    return { task: updatedTask, encounter: createdEncounter };
  } catch (error: any) {
    // Handle version conflict (race condition detected)
    if (error.outcome?.issue?.[0]?.code === 'conflict') {
      logger.warn('Optimistic locking conflict - patient already claimed', {
        taskId: task.id,
      });
      throw new Error('Patient was just claimed by another provider. Please select a different patient.');
    }

    logger.error('Failed to claim patient', error);
    throw error;
  }
}

/**
 * Update triage level and priority
 *
 * @param medplum - MedplumClient instance
 * @param taskId - Task ID
 * @param update - Triage update data
 * @returns Updated Task
 *
 * Security: Validates input, logs audit event
 */
export async function updateTriageLevel(
  medplum: MedplumClient,
  taskId: string,
  update: TriageUpdate
): Promise<Task> {
  // Validate triage level
  if (update.triageLevel < 1 || update.triageLevel > 5) {
    throw new Error('Triage level must be between 1 and 5');
  }

  const task = await medplum.readResource('Task', taskId);

  // Update extensions
  const updatedExtensions = [
    ...(task.extension?.filter((ext) => ext.url !== TRIAGE_LEVEL_EXTENSION) || []),
    {
      url: TRIAGE_LEVEL_EXTENSION,
      valueInteger: update.triageLevel,
    },
  ];

  // Add notes if provided
  const updatedNotes = update.notes
    ? [
        ...(task.note || []),
        {
          text: sanitizeInput(update.notes),
          time: new Date().toISOString(),
          // Add author reference if available from Medplum context
        },
      ]
    : task.note;

  const updatedTask = await medplum.updateResource({
    ...task,
    priority: update.priority,
    extension: updatedExtensions,
    note: updatedNotes,
    lastModified: new Date().toISOString(),
  });

  // Audit logging - get current user from medplum profile
  const currentProfile = medplum.getProfile();
  await logQueueAudit(medplum, {
    action: 'triage-updated',
    taskId,
    patientId: task.for?.reference?.split('/')[1] || 'unknown',
    performerId: currentProfile?.id || 'unknown',
    details: {
      oldPriority: task.priority,
      newPriority: update.priority,
      triageLevel: update.triageLevel,
    },
  });

  logger.info('Triage level updated', {
    taskId,
    priority: update.priority,
    triageLevel: update.triageLevel,
  });

  return updatedTask;
}

/**
 * Complete queue entry (when encounter finished)
 *
 * @param medplum - MedplumClient instance
 * @param taskId - Task ID
 * @returns Updated Task
 *
 * Security: Soft delete only (status=completed, not deleted)
 */
export async function completeQueueEntry(medplum: MedplumClient, taskId: string): Promise<Task> {
  const task = await medplum.readResource('Task', taskId);

  const updatedTask = await medplum.updateResource({
    ...task,
    status: 'completed',
    businessStatus: {
      coding: [
        {
          system: QUEUE_STATUS_SYSTEM,
          code: 'completed',
          display: 'Completed',
        },
      ],
      text: 'Completed',
    },
    lastModified: new Date().toISOString(),
  });

  // Audit logging
  await logQueueAudit(medplum, {
    action: 'queue-entry-completed',
    taskId,
    patientId: task.for?.reference?.split('/')[1] || 'unknown',
    performerId: task.owner?.reference?.split('/')[1] || 'unknown',
    details: {
      duration: task.authoredOn
        ? Math.floor((Date.now() - new Date(task.authoredOn).getTime()) / 60000)
        : undefined,
    },
  });

  logger.info('Queue entry completed', { taskId });

  return updatedTask;
}

/**
 * Cancel queue entry (patient left, no-show, etc.)
 *
 * @param medplum - MedplumClient instance
 * @param taskId - Task ID
 * @param reason - Cancellation reason
 * @returns Updated Task
 *
 * Security: Soft delete only (Security Agent requirement)
 */
export async function cancelQueueEntry(
  medplum: MedplumClient,
  taskId: string,
  reason: string
): Promise<Task> {
  const task = await medplum.readResource('Task', taskId);

  const updatedTask = await medplum.updateResource({
    ...task,
    status: 'cancelled',
    statusReason: {
      text: sanitizeInput(reason),
    },
    businessStatus: {
      coding: [
        {
          system: QUEUE_STATUS_SYSTEM,
          code: 'cancelled',
          display: 'Cancelled',
        },
      ],
      text: 'Cancelled',
    },
    lastModified: new Date().toISOString(),
  });

  // Audit logging - get current user from medplum profile
  const currentProfile = medplum.getProfile();
  await logQueueAudit(medplum, {
    action: 'queue-entry-cancelled',
    taskId,
    patientId: task.for?.reference?.split('/')[1] || 'unknown',
    performerId: currentProfile?.id || 'unknown',
    details: { reason },
  });

  logger.info('Queue entry cancelled', { taskId, reason });

  return updatedTask;
}

/**
 * Complete queue entry by encounter reference
 *
 * Finds the Task associated with an Encounter and marks it as completed.
 * Searches by both focus reference and patient match.
 *
 * @param medplum - MedplumClient instance
 * @param encounterId - Encounter ID
 * @returns Updated Task or null if no associated Task found
 */
export async function completeQueueEntryByEncounter(
  medplum: MedplumClient,
  encounterId: string
): Promise<Task | null> {
  // First try to find Task by focus reference
  let tasks = await medplum.searchResources('Task', {
    code: 'http://medplum.com/fhir/CodeSystem/task-code|patient-queue-entry',
    focus: `Encounter/${encounterId}`,
    status: 'in-progress',
    _count: '1',
  });

  // If not found by focus, try to find by patient match
  if (tasks.length === 0) {
    try {
      // Get the Encounter to find the patient
      const encounter = await medplum.readResource('Encounter', encounterId);
      const patientRef = encounter.subject?.reference;

      if (patientRef) {
        // Find in-progress queue Tasks for this patient
        tasks = await medplum.searchResources('Task', {
          code: 'http://medplum.com/fhir/CodeSystem/task-code|patient-queue-entry',
          subject: patientRef,
          status: 'in-progress',
          _count: '1',
        });
      }
    } catch (err) {
      logger.warn('Error finding queue Task by patient', { encounterId, error: err });
    }
  }

  if (tasks.length === 0) {
    logger.info('No queue Task found for encounter', { encounterId });
    return null;
  }

  return completeQueueEntry(medplum, tasks[0].id!);
}

/**
 * Calculate wait time in minutes
 */
export function calculateWaitTime(task: Task): number {
  if (!task.authoredOn) return 0;
  const now = new Date().getTime();
  const checkIn = new Date(task.authoredOn).getTime();
  return Math.floor((now - checkIn) / 60000);
}

/**
 * Get triage level from task extension
 */
export function getTriageLevel(task: Task): number | undefined {
  return task.extension?.find((ext) => ext.url === TRIAGE_LEVEL_EXTENSION)?.valueInteger;
}

/**
 * Get chief complaint from task extension
 */
export function getChiefComplaint(task: Task): string | undefined {
  return task.extension?.find((ext) => ext.url === CHIEF_COMPLAINT_EXTENSION)?.valueString;
}

/**
 * Get complaint sensitivity level
 */
export function getComplaintSensitivity(task: Task): 'public' | 'private' | 'sensitive' {
  const code = task.extension?.find((ext) => ext.url === COMPLAINT_SENSITIVITY_EXTENSION)?.valueCode;
  return (code as 'public' | 'private' | 'sensitive') || 'public';
}

/**
 * Get check-in method
 */
export function getCheckInMethod(task: Task): 'scheduled' | 'walk-in' | 'referral' | 'emergency' {
  const code = task.extension?.find((ext) => ext.url === CHECKIN_METHOD_EXTENSION)?.valueCode;
  return (code as 'scheduled' | 'walk-in' | 'referral' | 'emergency') || 'walk-in';
}

/**
 * Determine FHIR priority from ESI triage level
 * Healthcare Agent requirement: Document ESI → FHIR priority mapping
 *
 * ESI Level | Clinical Description | FHIR Priority
 * 1         | Immediate            | stat
 * 2         | Emergent             | stat
 * 3         | Urgent               | urgent
 * 4         | Less urgent          | routine
 * 5         | Non-urgent           | routine
 */
function determinePriorityFromTriage(
  triageLevel?: number
): 'routine' | 'urgent' | 'asap' | 'stat' {
  if (!triageLevel) return 'routine';

  if (triageLevel <= 2) return 'stat'; // ESI 1-2: Life-threatening
  if (triageLevel === 3) return 'urgent'; // ESI 3: Urgent
  return 'routine'; // ESI 4-5: Non-urgent
}

/**
 * Validate check-in request
 * Security Agent requirement: Input validation
 */
function validateCheckInRequest(request: CheckInRequest): void {
  if (!request.patient?.reference) {
    throw new Error('Patient reference is required');
  }

  if (!request.location?.reference) {
    throw new Error('Location reference is required');
  }

  if (request.chiefComplaint && request.chiefComplaint.length > 500) {
    throw new Error('Chief complaint must be 500 characters or less');
  }

  // Check for potential XSS (Security Agent requirement)
  if (request.chiefComplaint && /<script|javascript:|onerror=/i.test(request.chiefComplaint)) {
    throw new Error('Invalid characters in chief complaint');
  }

  if (request.triageLevel && (request.triageLevel < 1 || request.triageLevel > 5)) {
    throw new Error('Triage level must be between 1 and 5');
  }

  const validCheckInMethods = ['scheduled', 'walk-in', 'referral', 'emergency'];
  if (!validCheckInMethods.includes(request.checkInMethod)) {
    throw new Error('Invalid check-in method');
  }
}

/**
 * Sanitize user input to prevent XSS
 * Security Agent requirement
 */
function sanitizeInput(input: string): string {
  // Remove any HTML tags
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Log queue audit event
 * Security Agent requirement: Comprehensive audit logging
 */
async function logQueueAudit(
  medplum: MedplumClient,
  event: {
    action: string;
    taskId: string;
    patientId: string;
    performerId: string;
    details?: Record<string, any>;
  }
): Promise<void> {
  try {
    const auditEvent: AuditEvent = {
      resourceType: 'AuditEvent',
      type: {
        system: 'http://medplum.com/audit-event-type',
        code: event.action,
        display: event.action.replace(/-/g, ' '),
      },
      action: determineAuditAction(event.action),
      recorded: new Date().toISOString(),
      outcome: '0', // Success
      agent: [
        {
          who: {
            reference: `Practitioner/${event.performerId}`,
          },
          requestor: true,
        },
      ],
      source: {
        observer: {
          display: 'Queue Management System',
        },
      },
      entity: [
        {
          what: {
            reference: `Patient/${event.patientId}`,
          },
          type: {
            system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
            code: '1', // Person
            display: 'Person',
          },
        },
        {
          what: {
            reference: `Task/${event.taskId}`,
          },
          type: {
            system: 'http://terminology.hl7.org/CodeSystem/audit-entity-type',
            code: '2', // System Object
            display: 'System Object',
          },
        },
      ],
    };

    await medplum.createResource(auditEvent);

    // Also log to application logger
    logger.info(`Queue audit: ${event.action}`, {
      taskId: event.taskId,
      patientId: event.patientId,
      performerId: event.performerId,
      ...event.details,
    });
  } catch (error) {
    logger.error('Failed to create audit event', error);
    // Don't fail the operation if audit logging fails
  }
}

/**
 * Determine FHIR audit action code from event type
 */
function determineAuditAction(eventType: string): 'C' | 'R' | 'U' | 'D' | 'E' {
  if (eventType.includes('created')) return 'C';
  if (eventType.includes('updated') || eventType.includes('claimed')) return 'U';
  if (eventType.includes('deleted') || eventType.includes('cancelled')) return 'D';
  if (eventType.includes('viewed') || eventType.includes('accessed')) return 'R';
  return 'E'; // Execute
}

// ============================================================================
// Provider Task Management Functions
// ============================================================================

/**
 * Task code to ProviderTaskType mapping
 */
const TASK_TYPE_MAP: Record<string, ProviderTaskType> = {
  'lab-review': 'lab-review',
  'imaging-review': 'imaging-review',
  'call-patient': 'call-patient',
  'referral': 'referral',
  'prescription': 'prescription',
  'prior-auth': 'prior-auth',
  'document-review': 'document-review',
  'follow-up': 'follow-up',
  'consult': 'consult',
  'other': 'other',
};

/**
 * Non-queue task codes (for filtering)
 */
const NON_QUEUE_TASK_CODES = [
  'lab-review',
  'imaging-review',
  'call-patient',
  'referral',
  'prescription',
  'prior-auth',
  'document-review',
  'follow-up',
  'consult',
  'other',
];

/**
 * Get provider task type from Task.code
 */
export function getProviderTaskType(task: Task): ProviderTaskType {
  const code = task.code?.coding?.[0]?.code;
  return code && code in TASK_TYPE_MAP ? TASK_TYPE_MAP[code] : 'other';
}

/**
 * Enrich a Task with computed fields for UI display
 */
export function enrichProviderTask(task: Task, patient?: Patient): ProviderTask {
  const taskType = getProviderTaskType(task);
  const dueDate = task.restriction?.period?.end
    ? new Date(task.restriction.period.end)
    : undefined;
  const now = new Date();
  const isOverdue = dueDate ? dueDate < now : false;

  // Get description from task.description or code display
  const description =
    task.description ||
    task.code?.coding?.[0]?.display ||
    task.code?.text ||
    'Task';

  return {
    task,
    taskType,
    patient,
    patientRef: task.for?.reference,
    description,
    dueDate,
    priority: (task.priority as ProviderTask['priority']) || 'routine',
    status: (task.status as ProviderTask['status']) || 'ready',
    isOverdue,
    relatedResourceRef: task.focus?.reference,
  };
}

/**
 * Get non-queue tasks assigned to a provider
 *
 * @param medplum - MedplumClient instance
 * @param providerId - Provider's Practitioner ID
 * @param options - Query options
 * @returns Array of enriched ProviderTask objects
 */
export async function getProviderTasks(
  medplum: MedplumClient,
  providerId: string,
  options: {
    status?: ('ready' | 'in-progress')[];
    includeCompleted?: boolean;
    date?: string;
  } = {}
): Promise<ProviderTask[]> {
  const { status = ['ready', 'in-progress'], includeCompleted = false } = options;

  // Build status list
  const statusList = includeCompleted ? [...status, 'completed'] : status;

  // Fetch tasks for each non-queue code type
  const taskPromises = NON_QUEUE_TASK_CODES.map((code) =>
    medplum.searchResources('Task', {
      code: `${QUEUE_TASK_CODE_SYSTEM}|${code}`,
      owner: `Practitioner/${providerId}`,
      status: statusList.join(','),
      _sort: '-priority,_lastUpdated',
      _count: '50',
    })
  );

  const taskResults = await Promise.all(taskPromises);
  const allTasks = taskResults.flat();

  // Get unique patient references
  const patientRefs = new Set<string>();
  for (const task of allTasks) {
    if (task.for?.reference) {
      patientRefs.add(task.for.reference);
    }
  }

  // Load patients in batch
  const patientMap = new Map<string, Patient>();
  const patientPromises = Array.from(patientRefs).map(async (ref) => {
    try {
      const patient = (await medplum.readReference({ reference: ref } as any)) as Patient;
      patientMap.set(ref, patient);
    } catch (err) {
      logger.warn('Failed to load patient for task', { patientRef: ref });
    }
  });

  await Promise.all(patientPromises);

  // Enrich tasks with patient data
  const enrichedTasks = allTasks.map((task) => {
    const patientRef = task.for?.reference;
    const patient = patientRef ? patientMap.get(patientRef) : undefined;
    return enrichProviderTask(task, patient);
  });

  // Sort by priority (stat first), then overdue, then due date
  enrichedTasks.sort((a, b) => {
    // Priority order: stat > asap > urgent > routine
    const priorityOrder = { stat: 0, asap: 1, urgent: 2, routine: 3 };
    const aPriority = priorityOrder[a.priority] ?? 3;
    const bPriority = priorityOrder[b.priority] ?? 3;

    if (aPriority !== bPriority) return aPriority - bPriority;

    // Overdue tasks first
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;

    // Then by due date (earliest first)
    if (a.dueDate && b.dueDate) {
      return a.dueDate.getTime() - b.dueDate.getTime();
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return 0;
  });

  return enrichedTasks;
}

/**
 * Complete a provider task
 *
 * @param medplum - MedplumClient instance
 * @param taskId - Task ID
 * @param notes - Optional completion notes
 * @returns Updated Task
 */
export async function completeProviderTask(
  medplum: MedplumClient,
  taskId: string,
  notes?: string
): Promise<Task> {
  const task = await medplum.readResource('Task', taskId);

  // Add completion notes if provided
  const updatedNotes = notes
    ? [
        ...(task.note || []),
        {
          text: sanitizeInput(notes),
          time: new Date().toISOString(),
        },
      ]
    : task.note;

  const updatedTask = await medplum.updateResource({
    ...task,
    status: 'completed',
    note: updatedNotes,
    executionPeriod: {
      ...task.executionPeriod,
      end: new Date().toISOString(),
    },
    lastModified: new Date().toISOString(),
  });

  // Audit logging
  await logQueueAudit(medplum, {
    action: 'provider-task-completed',
    taskId,
    patientId: task.for?.reference?.split('/')[1] || 'unknown',
    performerId: task.owner?.reference?.split('/')[1] || 'unknown',
    details: {
      taskType: getProviderTaskType(task),
      hasNotes: !!notes,
    },
  });

  logger.info('Provider task completed', {
    taskId,
    taskType: getProviderTaskType(task),
  });

  return updatedTask;
}

/**
 * Create a provider task (e.g., lab review, follow-up)
 *
 * @param medplum - MedplumClient instance
 * @param options - Task creation options
 * @returns Created Task
 */
export async function createProviderTask(
  medplum: MedplumClient,
  options: {
    taskType: ProviderTaskType;
    description: string;
    patient?: Reference<Patient>;
    owner: Reference<Practitioner>;
    priority?: 'routine' | 'urgent' | 'asap' | 'stat';
    dueDate?: Date;
    relatedResource?: Reference<any>;
    notes?: string;
  }
): Promise<Task> {
  const {
    taskType,
    description,
    patient,
    owner,
    priority = 'routine',
    dueDate,
    relatedResource,
    notes,
  } = options;

  const task: Task = {
    resourceType: 'Task',
    status: 'ready',
    intent: 'order',
    priority,
    code: {
      coding: [
        {
          system: QUEUE_TASK_CODE_SYSTEM,
          code: taskType,
          display: getTaskTypeDisplay(taskType),
        },
      ],
    },
    description: sanitizeInput(description),
    for: patient,
    owner,
    focus: relatedResource,
    authoredOn: new Date().toISOString(),
    ...(dueDate && {
      restriction: {
        period: {
          end: dueDate.toISOString(),
        },
      },
    }),
    ...(notes && {
      note: [
        {
          text: sanitizeInput(notes),
          time: new Date().toISOString(),
        },
      ],
    }),
  };

  const createdTask = await medplum.createResource(task);

  // Audit logging
  await logQueueAudit(medplum, {
    action: 'provider-task-created',
    taskId: createdTask.id!,
    patientId: patient?.reference?.split('/')[1] || 'none',
    performerId: owner.reference!.split('/')[1],
    details: {
      taskType,
      priority,
      hasDueDate: !!dueDate,
    },
  });

  logger.info('Provider task created', {
    taskId: createdTask.id,
    taskType,
    priority,
  });

  return createdTask;
}

/**
 * Get display name for task type
 */
function getTaskTypeDisplay(taskType: ProviderTaskType): string {
  const displayNames: Record<ProviderTaskType, string> = {
    'lab-review': 'Lab Review',
    'imaging-review': 'Imaging Review',
    'call-patient': 'Call Patient',
    'referral': 'Referral',
    'prescription': 'Prescription Review',
    'prior-auth': 'Prior Authorization',
    'document-review': 'Document Review',
    'follow-up': 'Follow Up',
    'consult': 'Consult Request',
    'other': 'Other Task',
  };
  return displayNames[taskType] || 'Task';
}

/**
 * Calculate average consultation time from completed encounters
 *
 * @param encounters - Array of completed encounters
 * @returns Average consultation time in minutes
 */
export function calculateAverageConsultTime(encounters: Encounter[]): number {
  const durations = encounters
    .filter((e) => e.period?.start && e.period?.end)
    .map((e) => {
      const start = new Date(e.period!.start!).getTime();
      const end = new Date(e.period!.end!).getTime();
      return (end - start) / 60000; // Convert to minutes
    })
    .filter((d) => d > 0 && d < 480); // Filter out invalid durations (0 or > 8 hours)

  if (durations.length === 0) return 0;
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

/**
 * Get end of day summary for a provider
 *
 * @param medplum - MedplumClient instance
 * @param providerId - Provider's Practitioner ID
 * @param date - Date string (defaults to today)
 * @returns End of day summary statistics
 */
export async function getEndOfDaySummary(
  medplum: MedplumClient,
  providerId: string,
  date?: string
): Promise<EndOfDaySummary> {
  const targetDate = date || new Date().toISOString().split('T')[0];

  // Fetch appointments for the date
  const appointments = await medplum.searchResources('Appointment', {
    actor: `Practitioner/${providerId}`,
    date: targetDate,
    _count: '200',
  });

  // Fetch completed encounters for the date
  const completedEncounters = await medplum.searchResources('Encounter', {
    participant: `Practitioner/${providerId}`,
    status: 'finished',
    date: targetDate,
    _count: '200',
  });

  // Fetch provider tasks
  const providerTasks = await getProviderTasks(medplum, providerId, {
    includeCompleted: true,
  });

  // Count by status
  const scheduledCount = appointments.filter((a) => a.status === 'booked').length;
  const arrivedCount = appointments.filter((a) => a.status === 'arrived').length;
  const fulfilledCount = appointments.filter((a) => a.status === 'fulfilled').length;
  const noShowCount = appointments.filter((a) => a.status === 'noshow').length;
  const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length;

  // Calculate average consult time
  const avgConsultTime = calculateAverageConsultTime(completedEncounters);

  // Calculate total consult time
  const totalConsultTime = completedEncounters
    .filter((e) => e.period?.start && e.period?.end)
    .reduce((sum, e) => {
      const start = new Date(e.period!.start!).getTime();
      const end = new Date(e.period!.end!).getTime();
      return sum + (end - start) / 60000;
    }, 0);

  // Count tasks
  const completedTasks = providerTasks.filter((t) => t.status === 'completed').length;
  const pendingTasks = providerTasks.filter(
    (t) => t.status === 'ready' || t.status === 'in-progress'
  ).length;

  // Count walk-ins (encounters not linked to appointments)
  const walkInsSeen = completedEncounters.filter(
    (e) => !e.basedOn || e.basedOn.length === 0
  ).length;

  return {
    date: targetDate,
    patientsSeen: completedEncounters.length,
    scheduledAppointments: scheduledCount + arrivedCount + fulfilledCount,
    walkInsSeen,
    noShows: noShowCount,
    cancelledAppointments: cancelledCount,
    averageConsultTime: avgConsultTime,
    totalConsultTime: Math.round(totalConsultTime),
    pendingTasksRemaining: pendingTasks,
    completedTasks,
  };
}

/**
 * Start an encounter from an appointment (Quick Encounter Start)
 *
 * @param medplum - MedplumClient instance
 * @param appointmentId - Appointment ID
 * @param provider - Provider reference
 * @returns Created Encounter
 */
export async function startEncounterFromAppointment(
  medplum: MedplumClient,
  appointmentId: string,
  provider: Reference<Practitioner>
): Promise<Encounter> {
  // Read the appointment
  const appointment = await medplum.readResource('Appointment', appointmentId);

  // Get patient reference
  const patientParticipant = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith('Patient/')
  );

  if (!patientParticipant?.actor?.reference) {
    throw new Error('Appointment has no patient participant');
  }

  // Get location from appointment
  const locationParticipant = appointment.participant?.find((p) =>
    p.actor?.reference?.startsWith('Location/')
  );

  // Create encounter
  const encounter: Encounter = {
    resourceType: 'Encounter',
    status: 'in-progress',
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: { reference: patientParticipant.actor.reference },
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'PPRF',
                display: 'primary performer',
              },
            ],
          },
        ],
        individual: provider,
      },
    ],
    period: {
      start: new Date().toISOString(),
    },
    basedOn: [{ reference: `Appointment/${appointmentId}` }],
    ...(locationParticipant?.actor && {
      location: [
        {
          location: locationParticipant.actor as Reference<Location>,
        },
      ],
    }),
    reasonCode: appointment.reasonCode,
  };

  // Create encounter and update appointment in transaction
  const bundle: Bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        request: {
          method: 'POST',
          url: 'Encounter',
        },
        resource: encounter,
      },
      {
        request: {
          method: 'PUT',
          url: `Appointment/${appointmentId}`,
        },
        resource: {
          ...appointment,
          status: 'fulfilled',
        },
      },
    ],
  };

  const result = await medplum.executeBatch(bundle);

  const encounterEntry = result.entry?.find(
    (e) => e.resource?.resourceType === 'Encounter'
  );

  if (!encounterEntry?.resource) {
    throw new Error('Failed to create encounter');
  }

  const createdEncounter = encounterEntry.resource as Encounter;

  logger.info('Encounter started from appointment', {
    encounterId: createdEncounter.id,
    appointmentId,
    providerId: provider.reference,
  });

  return createdEncounter;
}
