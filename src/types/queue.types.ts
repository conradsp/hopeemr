import type {
  Task,
  Patient,
  Appointment,
  Location,
  Practitioner,
  Encounter,
  Reference,
} from '@medplum/fhirtypes';

/**
 * Queue Management Type Definitions
 *
 * Defines all TypeScript interfaces for the queue management system
 */

/**
 * Check-in request data
 * Used when creating a new queue entry
 */
export interface CheckInRequest {
  /** Patient reference (required) */
  patient: Reference<Patient>;

  /** Location/department reference (required) */
  location: Reference<Location>;

  /** Who is checking in the patient (receptionist/nurse) */
  requester?: Reference<Practitioner>;

  /** Related appointment (if scheduled visit) */
  appointment?: Reference<Appointment>;

  /** Chief complaint (up to 500 characters) */
  chiefComplaint?: string;

  /** Chief complaint sensitivity level (Security Agent requirement) */
  complainSensitivity?: 'public' | 'private' | 'sensitive';

  /** ESI triage level (1-5, optional - can be assessed later) */
  triageLevel?: 1 | 2 | 3 | 4 | 5;

  /** FHIR priority (optional - derived from triage if not provided) */
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';

  /** Check-in method */
  checkInMethod: 'scheduled' | 'walk-in' | 'referral' | 'emergency';
}

/**
 * Triage update data
 * Used when nurse updates triage assessment
 */
export interface TriageUpdate {
  /** ESI triage level (1-5) */
  triageLevel: 1 | 2 | 3 | 4 | 5;

  /** FHIR priority */
  priority: 'routine' | 'urgent' | 'asap' | 'stat';

  /** Optional updated chief complaint */
  chiefComplaint?: string;

  /** Triage notes */
  notes?: string;
}

/**
 * Queue entry with enriched data
 * Combines Task resource with patient and calculated fields
 */
export interface QueueEntry {
  /** FHIR Task resource */
  task: Task;

  /** Patient resource (from _include) */
  patient: Patient;

  /** Calculated position in queue (1-based) */
  position: number;

  /** Wait time in minutes */
  waitTimeMinutes: number;

  /** FHIR priority */
  priority: 'routine' | 'urgent' | 'asap' | 'stat';

  /** ESI triage level (if assessed) */
  triageLevel?: 1 | 2 | 3 | 4 | 5;

  /** Chief complaint */
  chiefComplaint?: string;

  /** Complaint sensitivity */
  complaintSensitivity: 'public' | 'private' | 'sensitive';

  /** Check-in method */
  checkInMethod: 'scheduled' | 'walk-in' | 'referral' | 'emergency';

  /** Assigned provider (if claimed) */
  provider?: Practitioner;

  /** Related encounter (if claimed) */
  encounter?: Encounter;
}

/**
 * Queue metrics/statistics
 * Used for dashboard displays
 */
export interface QueueMetrics {
  /** Total patients currently waiting */
  totalWaiting: number;

  /** Total patients currently being seen */
  totalInProgress: number;

  /** Average wait time in minutes */
  averageWaitTime: number;

  /** Longest wait time in minutes */
  longestWaitTime: number;

  /** Patients waiting by triage level */
  byTriageLevel: {
    level1: number; // Resuscitation
    level2: number; // Emergent
    level3: number; // Urgent
    level4: number; // Less urgent
    level5: number; // Non-urgent
  };

  /** Patients waiting by priority */
  byPriority: {
    stat: number;
    asap: number;
    urgent: number;
    routine: number;
  };

  /** Patients waiting by check-in method */
  byCheckInMethod: {
    scheduled: number;
    walkIn: number;
    referral: number;
    emergency: number;
  };
}

/**
 * Queue filter options
 * Used for filtering queue display
 */
export interface QueueFilters {
  /** Filter by location */
  location?: string;

  /** Filter by assigned provider */
  provider?: string;

  /** Filter by priority levels */
  priorities?: ('routine' | 'urgent' | 'asap' | 'stat')[];

  /** Filter by triage levels */
  triageLevels?: (1 | 2 | 3 | 4 | 5)[];

  /** Filter by status */
  statuses?: ('ready' | 'in-progress' | 'completed' | 'cancelled')[];

  /** Filter by check-in method */
  checkInMethods?: ('scheduled' | 'walk-in' | 'referral' | 'emergency')[];

  /** Show only tasks with long wait times (in minutes) */
  minWaitTime?: number;
}

/**
 * Queue sort options
 */
export type QueueSortOrder =
  | 'priority' // Priority first, then FIFO
  | 'wait-time' // Longest wait first
  | 'triage-level' // Highest acuity first
  | 'fifo'; // First in, first out only

/**
 * Claim patient result
 * Returned when provider claims next patient
 */
export interface ClaimPatientResult {
  /** Updated task */
  task: Task;

  /** Created encounter */
  encounter: Encounter;

  /** Patient */
  patient: Patient;
}

/**
 * Waiting room display entry
 * Privacy-conscious display for public waiting room screens
 * Security Agent requirement: No PHI
 */
export interface WaitingRoomEntry {
  /** Anonymous queue number (not patient identifier) */
  queueNumber: number;

  /** Status */
  status: 'waiting' | 'ready';

  /** Estimated wait time range (not exact) */
  estimatedWait: string; // e.g., "15-30 minutes"

  /** NO patient names, NO chief complaints, NO identifiers */
}

/**
 * Queue dashboard view mode
 */
export type QueueViewMode =
  | 'provider' // Provider's assigned patients
  | 'location' // All patients in location
  | 'all'; // All patients (admin view)

/**
 * Provider availability status
 */
export interface ProviderStatus {
  /** Provider reference */
  provider: Reference<Practitioner>;

  /** Current status */
  status: 'available' | 'busy' | 'on-break' | 'off-duty';

  /** Number of patients currently assigned */
  patientsAssigned: number;

  /** Average consultation time (minutes) */
  averageConsultTime: number;
}

/**
 * Queue audit event data
 * Security Agent requirement
 */
export interface QueueAuditEvent {
  /** Event type */
  eventType:
    | 'queue-entry-created'
    | 'queue-entry-viewed'
    | 'patient-claimed'
    | 'triage-updated'
    | 'queue-entry-completed'
    | 'queue-entry-cancelled'
    | 'chief-complaint-viewed';

  /** User who performed the action */
  userId: string;

  /** Patient involved */
  patientId: string;

  /** Timestamp */
  timestamp: string;

  /** IP address */
  ipAddress?: string;

  /** Session ID */
  sessionId?: string;

  /** Additional details */
  details?: Record<string, any>;
}

/**
 * Queue configuration
 * Settings for queue behavior
 */
export interface QueueConfiguration {
  /** Auto-refresh interval (milliseconds) */
  refreshInterval: number;

  /** Enable real-time updates via subscriptions */
  enableRealtimeUpdates: boolean;

  /** Maximum wait time before alert (minutes) */
  maxWaitTimeBeforeAlert: number;

  /** Average consultation time per patient (minutes) */
  averageConsultationTime: number;

  /** Enable automatic triage escalation based on vitals */
  enableAutoTriageEscalation: boolean;

  /** Waiting room display mode */
  waitingRoomDisplayMode: 'queue-numbers' | 'initials' | 'none';
}

/**
 * Workflow Emphasis Mode
 *
 * Determines how the facility balances scheduling and queue management:
 * - scheduled-primary: Traditional clinic - appointments are the primary workflow
 * - hybrid: Both scheduling and queue are equally important (default)
 * - queue-primary: Urgent care/ED style - queue-first workflow
 *
 * Industry research:
 * - Epic, Cerner: Support both modes with facility-level configuration
 * - OpenMRS: Plans to "transfer appointments onto patient queues on day of appointment"
 * - Urgent care EMRs: Queue-first but still use schedules for capacity planning
 */
export type WorkflowEmphasis = 'scheduled-primary' | 'hybrid' | 'queue-primary';

/**
 * Facility workflow configuration
 * Determines how scheduling and queue management are integrated
 */
export interface WorkflowConfiguration {
  /** Primary workflow emphasis for this facility */
  workflowEmphasis: WorkflowEmphasis;

  /**
   * Auto-sync appointments to queue
   * When enabled, scheduled appointments are automatically added to the queue
   * at the configured time before their appointment start
   */
  autoSyncAppointmentsToQueue: boolean;

  /**
   * Minutes before appointment to add to queue
   * Only applies when autoSyncAppointmentsToQueue is true
   * Default: 15 minutes (patients should arrive 15 min early)
   */
  appointmentQueueLeadTimeMinutes: number;

  /**
   * Show scheduled appointments in provider work queue
   * When true, the provider's scheduled appointments appear alongside queue patients
   */
  showScheduledInWorkQueue: boolean;

  /**
   * Show queue patients on calendar
   * When true, walk-in queue patients appear on the provider calendar
   */
  showQueueOnCalendar: boolean;

  /**
   * Require check-in for scheduled appointments
   * When true, scheduled patients must check in before they can be seen
   * When false, scheduled patients are auto-checked-in at appointment time
   */
  requireCheckInForScheduled: boolean;

  /**
   * Auto-advance to next patient
   * When true, after completing a patient, the system suggests the next patient
   */
  autoAdvanceToNextPatient: boolean;

  /**
   * Enable walk-in scheduling
   * When true, walk-in patients can be assigned time slots for better flow management
   */
  enableWalkInSlots: boolean;

  /**
   * Default walk-in slot duration in minutes
   * Used when enableWalkInSlots is true
   */
  defaultWalkInSlotDuration: number;
}

/**
 * Default workflow configuration
 * Used when facility has not configured workflow settings
 */
export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfiguration = {
  workflowEmphasis: 'hybrid',
  autoSyncAppointmentsToQueue: true,
  appointmentQueueLeadTimeMinutes: 15,
  showScheduledInWorkQueue: true,
  showQueueOnCalendar: false,
  requireCheckInForScheduled: false,
  autoAdvanceToNextPatient: true,
  enableWalkInSlots: false,
  defaultWalkInSlotDuration: 30,
};

/**
 * Appointment sync status
 * Tracks which appointments have been synced to the queue
 */
export interface AppointmentSyncStatus {
  /** Appointment ID */
  appointmentId: string;

  /** Queue Task ID (if synced) */
  taskId?: string;

  /** Sync timestamp */
  syncedAt?: string;

  /** Sync status */
  status: 'pending' | 'synced' | 'skipped' | 'arrived';

  /** Reason for skip (if applicable) */
  skipReason?: string;
}

/**
 * Provider Task Type
 * Types of tasks that can be assigned to providers
 */
export type ProviderTaskType =
  | 'lab-review'        // Review lab results
  | 'imaging-review'    // Review imaging results
  | 'call-patient'      // Call patient for follow-up
  | 'referral'          // Process or review referral
  | 'prescription'      // Review/approve prescription
  | 'prior-auth'        // Prior authorization needed
  | 'document-review'   // Review documents
  | 'follow-up'         // General follow-up task
  | 'consult'           // Consult request
  | 'other';            // Other task types

/**
 * Provider Task with enriched data
 * Non-queue tasks assigned to the provider
 */
export interface ProviderTask {
  /** FHIR Task resource */
  task: Task;

  /** Task type */
  taskType: ProviderTaskType;

  /** Patient resource (if patient-related) */
  patient?: Patient;

  /** Patient reference string */
  patientRef?: string;

  /** Description of the task */
  description: string;

  /** Due date (if set) */
  dueDate?: Date;

  /** Priority */
  priority: 'routine' | 'urgent' | 'asap' | 'stat';

  /** Task status */
  status: 'ready' | 'in-progress' | 'completed' | 'cancelled';

  /** Is overdue */
  isOverdue: boolean;

  /** Related resource (e.g., DiagnosticReport, ServiceRequest) */
  relatedResourceRef?: string;
}

/**
 * Provider work queue statistics
 */
export interface ProviderWorkQueueStats {
  /** Total scheduled appointments */
  totalScheduled: number;

  /** Total walk-in queue patients */
  totalQueue: number;

  /** Total in-progress encounters */
  totalInProgress: number;

  /** Total completed today */
  totalCompleted: number;

  /** Total pending tasks */
  totalPendingTasks: number;

  /** Overdue tasks count */
  totalOverdueTasks: number;

  /** Average consultation time in minutes */
  averageConsultTime: number;

  /** Total patients (scheduled + queue) */
  totalPatients: number;
}

/**
 * Task code URLs for different task types
 */
export const TASK_CODE_URLS = {
  queueEntry: 'http://medplum.com/fhir/CodeSystem/task-code|patient-queue-entry',
  labReview: 'http://medplum.com/fhir/CodeSystem/task-code|lab-review',
  imagingReview: 'http://medplum.com/fhir/CodeSystem/task-code|imaging-review',
  callPatient: 'http://medplum.com/fhir/CodeSystem/task-code|call-patient',
  referral: 'http://medplum.com/fhir/CodeSystem/task-code|referral',
  prescription: 'http://medplum.com/fhir/CodeSystem/task-code|prescription',
  priorAuth: 'http://medplum.com/fhir/CodeSystem/task-code|prior-auth',
  documentReview: 'http://medplum.com/fhir/CodeSystem/task-code|document-review',
  followUp: 'http://medplum.com/fhir/CodeSystem/task-code|follow-up',
  consult: 'http://medplum.com/fhir/CodeSystem/task-code|consult',
  other: 'http://medplum.com/fhir/CodeSystem/task-code|other',
} as const;

/**
 * End of day summary
 * Statistics for provider's day
 */
export interface EndOfDaySummary {
  /** Date of summary */
  date: string;

  /** Total patients seen */
  patientsSeen: number;

  /** Total scheduled appointments */
  scheduledAppointments: number;

  /** Walk-ins seen */
  walkInsSeen: number;

  /** No-shows */
  noShows: number;

  /** Cancelled appointments */
  cancelledAppointments: number;

  /** Average consultation time */
  averageConsultTime: number;

  /** Total time spent in consultations */
  totalConsultTime: number;

  /** Pending tasks remaining */
  pendingTasksRemaining: number;

  /** Completed tasks */
  completedTasks: number;
}
