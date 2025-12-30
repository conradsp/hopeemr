import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Title,
  Stack,
  SimpleGrid,
  Card,
  Text,
  Badge,
  Group,
  Button,
  Divider,
  Alert,
  LoadingOverlay,
  SegmentedControl,
  Tooltip,
  Paper,
} from '@mantine/core';
import {
  IconClock,
  IconUsers,
  IconCheck,
  IconAlertCircle,
  IconCalendar,
  IconUserCheck,
  IconRefresh,
  IconList,
  IconLayoutGrid,
  IconArrowRight,
  IconPlayerPlay,
  IconClipboardList,
  IconChartBar,
} from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { formatHumanName, getReferenceString } from '@medplum/core';
import type { Appointment, Encounter, Patient, Practitioner, Task } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { formatWaitTime } from '../../utils/triageUtils';
import {
  calculateWaitTime,
  getChiefComplaint,
  claimNextPatient,
  getProviderTasks,
  completeProviderTask,
  calculateAverageConsultTime,
  getEndOfDaySummary,
  startEncounterFromAppointment,
} from '../../utils/queueUtils';
import { PriorityBadge } from '../../components/queue/PriorityBadge';
import { PendingTaskCard } from '../../components/queue/PendingTaskCard';
import { CompleteTaskModal } from '../../components/queue/CompleteTaskModal';
import { EndOfDaySummaryModal } from '../../components/queue/EndOfDaySummaryModal';
import { logger } from '../../utils/logger';
import type { FhirPriority } from '../../utils/triageUtils';
import type { ProviderTask, EndOfDaySummary } from '../../types/queue.types';
import { useWorkflowConfig, shouldShowScheduling, shouldShowQueue, isHybridMode } from '../../hooks/useWorkflowConfig';
import { isAppointmentSynced, getAppointmentSyncStatus } from '../../utils/appointmentSyncService';
import { notifications } from '@mantine/notifications';

/**
 * Provider Work Queue Page
 *
 * Personalized dashboard showing provider's patients for today:
 * - Today's scheduled appointments
 * - Walk-ins assigned to me (from queue)
 * - In-progress encounters (currently seeing)
 * - Completed today
 * - Quick stats
 *
 * This view adapts based on facility workflow configuration:
 * - scheduled-primary: Emphasizes appointments, queue is secondary
 * - hybrid: Shows both equally (unified timeline view)
 * - queue-primary: Emphasizes queue, appointments shown inline
 *
 * This is different from the main Queue Dashboard which shows ALL patients.
 * This view is focused on MY patients only.
 */

interface WorkQueueData {
  scheduledAppointments: Appointment[];
  myQueuePatients: Task[];
  inProgressEncounters: Encounter[];
  completedToday: Encounter[];
  patients: Map<string, Patient>;
  pendingTasks: ProviderTask[];
}

/**
 * Unified patient item - combines appointments and queue tasks for timeline view
 */
interface UnifiedPatientItem {
  id: string;
  type: 'appointment' | 'queue' | 'encounter';
  patient: Patient | undefined;
  patientRef: string | undefined;
  time: Date;
  displayTime: string;
  status: string;
  priority?: FhirPriority;
  complaint?: string;
  appointmentType?: string;
  encounter?: Encounter;
  appointment?: Appointment;
  task?: Task;
  isSynced?: boolean;
  taskId?: string;
}

type ViewMode = 'unified' | 'separate';

export function ProviderWorkQueuePage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { config: workflowConfig, loading: configLoading } = useWorkflowConfig();

  const [data, setData] = useState<WorkQueueData>({
    scheduledAppointments: [],
    myQueuePatients: [],
    inProgressEncounters: [],
    completedToday: [],
    patients: new Map(),
    pendingTasks: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [claimingPatient, setClaimingPatient] = useState(false);
  const [averageConsultTime, setAverageConsultTime] = useState(0);

  // Task completion modal state
  const [selectedTask, setSelectedTask] = useState<ProviderTask | null>(null);
  const [taskCompleteModalOpen, setTaskCompleteModalOpen] = useState(false);
  const [completingTask, setCompletingTask] = useState(false);

  // End of day summary modal state
  const [endOfDaySummaryOpen, setEndOfDaySummaryOpen] = useState(false);
  const [endOfDaySummary, setEndOfDaySummary] = useState<EndOfDaySummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Quick encounter start state
  const [startingEncounter, setStartingEncounter] = useState<string | null>(null);

  const profile = medplum.getProfile() as Practitioner;
  const providerId = profile?.id;

  /**
   * Load all work queue data for the provider
   */
  const loadWorkQueue = async (): Promise<void> => {
    if (!providerId) {
      setError(t('workQueue.noProvider', 'Provider profile not found'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const today = new Date().toISOString().split('T')[0];

      // Load today's scheduled appointments
      const appointments = await medplum.searchResources('Appointment', {
        actor: `Practitioner/${providerId}`,
        date: today,
        status: 'booked,arrived,fulfilled',
        _sort: 'date',
        _count: '100',
      });

      // Load queue tasks assigned to me
      const queueTasks = await medplum.searchResources('Task', {
        code: 'http://medplum.com/fhir/CodeSystem/task-code|patient-queue-entry',
        owner: `Practitioner/${providerId}`,
        status: 'ready,in-progress',
        _sort: '-priority,_lastUpdated',
        _count: '100',
      });

      // Load in-progress encounters
      const inProgressEncounters = await medplum.searchResources('Encounter', {
        participant: `Practitioner/${providerId}`,
        status: 'in-progress',
        _sort: '-date',
        _count: '100',
      });

      // Load completed encounters today (use date range for reliable matching)
      const completedEncounters = await medplum.searchResources('Encounter', {
        participant: `Practitioner/${providerId}`,
        status: 'finished',
        date: `ge${today}`,
        _sort: '-date',
        _count: '100',
      });

      // Load pending tasks (non-queue tasks assigned to provider)
      const pendingTasks = await getProviderTasks(medplum, providerId);

      // Calculate average consultation time from completed encounters
      const avgTime = calculateAverageConsultTime(completedEncounters);
      setAverageConsultTime(avgTime);

      // Load all unique patients
      const patientMap = new Map<string, Patient>();
      const allResources = [
        ...appointments,
        ...queueTasks,
        ...inProgressEncounters,
        ...completedEncounters,
      ];

      for (const resource of allResources) {
        let patientRef: string | undefined;

        if (resource.resourceType === 'Appointment') {
          patientRef = resource.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))
            ?.actor?.reference;
        } else if (resource.resourceType === 'Task') {
          patientRef = resource.for?.reference;
        } else if (resource.resourceType === 'Encounter') {
          patientRef = resource.subject?.reference;
        }

        if (patientRef && !patientMap.has(patientRef)) {
          try {
            const patient = await medplum.readReference({ reference: patientRef } as any) as Patient;
            patientMap.set(patientRef, patient);
          } catch (err) {
            logger.warn('Failed to load patient', { patientRef, error: err });
          }
        }
      }

      setData({
        scheduledAppointments: appointments,
        myQueuePatients: queueTasks,
        inProgressEncounters: inProgressEncounters,
        completedToday: completedEncounters,
        patients: patientMap,
        pendingTasks,
      });
    } catch (err: any) {
      logger.error('Failed to load work queue', err);
      setError(err.message || t('workQueue.loadError', 'Failed to load work queue'));
    } finally {
      setLoading(false);
    }
  };

  // Load on mount
  useEffect(() => {
    loadWorkQueue();
  }, [providerId]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadWorkQueue();
    }, 60000);

    return () => clearInterval(interval);
  }, [providerId]);

  // Calculate stats - only count 'ready' queue tasks (in-progress are shown as encounters)
  const readyQueuePatients = data.myQueuePatients.filter(t => t.status === 'ready');
  const stats = {
    totalScheduled: data.scheduledAppointments.length,
    totalQueue: readyQueuePatients.length,
    totalInProgress: data.inProgressEncounters.length,
    totalCompleted: data.completedToday.length,
    totalPatients: data.scheduledAppointments.length + readyQueuePatients.length,
    totalPendingTasks: data.pendingTasks.length,
    overdueTasks: data.pendingTasks.filter((t) => t.isOverdue).length,
    averageConsultTime,
  };

  // Create unified patient list for timeline view
  const unifiedPatients = useMemo((): UnifiedPatientItem[] => {
    const items: UnifiedPatientItem[] = [];

    // Add scheduled appointments
    if (shouldShowScheduling(workflowConfig)) {
      for (const apt of data.scheduledAppointments) {
        const patientRef = apt.participant?.find((p) =>
          p.actor?.reference?.startsWith('Patient/')
        )?.actor?.reference;
        const patient = patientRef ? data.patients.get(patientRef) : undefined;
        const syncStatus = getAppointmentSyncStatus(apt);

        items.push({
          id: `apt-${apt.id}`,
          type: 'appointment',
          patient,
          patientRef,
          time: apt.start ? new Date(apt.start) : new Date(),
          displayTime: apt.start
            ? new Date(apt.start).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })
            : '',
          status: apt.status || 'booked',
          appointmentType: apt.appointmentType?.text || t('workQueue.appointment', 'Appointment'),
          appointment: apt,
          isSynced: isAppointmentSynced(apt),
          taskId: syncStatus.taskId,
        });
      }
    }

    // Add queue patients (only 'ready' ones - 'in-progress' are shown as encounters)
    if (shouldShowQueue(workflowConfig)) {
      for (const task of data.myQueuePatients) {
        // Skip in-progress tasks - they have an associated encounter that's already displayed
        if (task.status === 'in-progress') continue;

        const patientRef = task.for ? getReferenceString(task.for) : undefined;
        const patient = patientRef ? data.patients.get(patientRef) : undefined;

        items.push({
          id: `task-${task.id}`,
          type: 'queue',
          patient,
          patientRef,
          time: task.authoredOn ? new Date(task.authoredOn) : new Date(),
          displayTime: formatWaitTime(calculateWaitTime(task)),
          status: task.status || 'ready',
          priority: task.priority as FhirPriority,
          complaint: getChiefComplaint(task),
          task,
        });
      }
    }

    // Add in-progress encounters
    for (const encounter of data.inProgressEncounters) {
      const patientRef = encounter.subject ? getReferenceString(encounter.subject) : undefined;
      const patient = patientRef ? data.patients.get(patientRef) : undefined;

      items.push({
        id: `enc-${encounter.id}`,
        type: 'encounter',
        patient,
        patientRef,
        time: encounter.period?.start ? new Date(encounter.period.start) : new Date(),
        displayTime: t('workQueue.inProgress', 'In Progress'),
        status: 'in-progress',
        appointmentType: encounter.type?.[0]?.text || t('workQueue.encounter', 'Encounter'),
        encounter,
      });
    }

    // Sort by time (earliest first for appointments, oldest first for queue)
    items.sort((a, b) => {
      // In-progress encounters always come first
      if (a.type === 'encounter' && b.type !== 'encounter') return -1;
      if (b.type === 'encounter' && a.type !== 'encounter') return 1;

      // Then sort by time
      return a.time.getTime() - b.time.getTime();
    });

    return items;
  }, [data, workflowConfig, t]);

  // Handle claiming next patient from queue
  const handleClaimNextPatient = async (): Promise<void> => {
    if (!providerId) return;

    setClaimingPatient(true);
    try {
      const result = await claimNextPatient(medplum, { reference: `Practitioner/${providerId}` });

      if (result) {
        notifications.show({
          title: t('queue.patientClaimed', 'Patient Claimed'),
          message: t('queue.patientClaimedSuccess', 'Patient has been assigned to you'),
          color: 'green',
        });

        // Reload the queue
        loadWorkQueue();

        // Navigate to the encounter
        if (result.encounter?.id) {
          navigate(`/Encounter/${result.encounter.id}`);
        }
      } else {
        notifications.show({
          title: t('queue.noPatients', 'No Patients'),
          message: t('queue.noWaitingPatients', 'No patients are currently waiting'),
          color: 'blue',
        });
      }
    } catch (err: any) {
      logger.error('Failed to claim patient', err);
      notifications.show({
        title: t('queue.error.claimFailed', 'Failed to Claim Patient'),
        message: err.message || 'An error occurred',
        color: 'red',
      });
    } finally {
      setClaimingPatient(false);
    }
  };

  // Get next patient suggestion (for auto-advance feature)
  const nextPatient = useMemo(() => {
    if (!workflowConfig.autoAdvanceToNextPatient) return null;

    // Find the next patient in the unified list that isn't in-progress
    return unifiedPatients.find(p => p.type !== 'encounter' && p.status !== 'in-progress');
  }, [unifiedPatients, workflowConfig.autoAdvanceToNextPatient]);

  // Handle completing a provider task
  const handleCompleteTask = async (taskId: string, notes?: string): Promise<void> => {
    setCompletingTask(true);
    try {
      await completeProviderTask(medplum, taskId, notes);
      notifications.show({
        title: t('workQueue.taskCompleted', 'Task Completed'),
        message: t('workQueue.taskCompletedSuccess', 'Task has been marked as complete'),
        color: 'green',
      });
      loadWorkQueue();
    } catch (err: any) {
      logger.error('Failed to complete task', err);
      notifications.show({
        title: t('common.error', 'Error'),
        message: err.message || 'Failed to complete task',
        color: 'red',
      });
    } finally {
      setCompletingTask(false);
    }
  };

  // Handle quick encounter start from appointment
  const handleQuickEncounterStart = async (appointment: Appointment): Promise<void> => {
    if (!appointment.id || !providerId) return;

    setStartingEncounter(appointment.id);
    try {
      const encounter = await startEncounterFromAppointment(
        medplum,
        appointment.id,
        { reference: `Practitioner/${providerId}` }
      );

      notifications.show({
        title: t('encounter.created', 'Encounter Created'),
        message: t('workQueue.startEncounter', 'Started encounter'),
        color: 'green',
      });

      // Navigate to the new encounter
      if (encounter.id) {
        navigate(`/Encounter/${encounter.id}`);
      }
    } catch (err: any) {
      logger.error('Failed to start encounter', err);
      notifications.show({
        title: t('common.error', 'Error'),
        message: err.message || 'Failed to start encounter',
        color: 'red',
      });
    } finally {
      setStartingEncounter(null);
    }
  };

  // Handle opening end of day summary
  const handleOpenSummary = async (): Promise<void> => {
    if (!providerId) return;

    setEndOfDaySummaryOpen(true);
    setLoadingSummary(true);

    try {
      const summary = await getEndOfDaySummary(medplum, providerId);
      setEndOfDaySummary(summary);
    } catch (err: any) {
      logger.error('Failed to load end of day summary', err);
      notifications.show({
        title: t('common.error', 'Error'),
        message: t('workQueue.loadError', 'Failed to load summary'),
        color: 'red',
      });
    } finally {
      setLoadingSummary(false);
    }
  };

  // Handle navigating to task-related resource
  const handleTaskClick = (task: ProviderTask): void => {
    if (task.relatedResourceRef) {
      navigate(`/${task.relatedResourceRef}`);
    } else if (task.patientRef) {
      navigate(`/${task.patientRef}`);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Group gap="sm">
              <Title order={2}>{t('workQueue.title', 'My Work Queue')}</Title>
              {workflowConfig.workflowEmphasis !== 'hybrid' && (
                <Badge
                  variant="light"
                  color={workflowConfig.workflowEmphasis === 'queue-primary' ? 'orange' : 'blue'}
                  size="sm"
                >
                  {workflowConfig.workflowEmphasis === 'queue-primary'
                    ? t('workflow.queuePrimary', 'Queue-First')
                    : t('workflow.scheduledPrimary', 'Scheduled-First')}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              {t('workQueue.subtitle', 'Your patients for today')}
            </Text>
          </div>
          <Group gap="sm">
            {isHybridMode(workflowConfig) && (
              <SegmentedControl
                size="xs"
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
                data={[
                  {
                    value: 'unified',
                    label: (
                      <Group gap={4}>
                        <IconList size={14} />
                        <span>{t('workQueue.unifiedView', 'Timeline')}</span>
                      </Group>
                    ),
                  },
                  {
                    value: 'separate',
                    label: (
                      <Group gap={4}>
                        <IconLayoutGrid size={14} />
                        <span>{t('workQueue.separateView', 'Sections')}</span>
                      </Group>
                    ),
                  },
                ]}
              />
            )}
            <Button
              variant="light"
              leftSection={<IconChartBar size={16} />}
              onClick={handleOpenSummary}
            >
              {t('workQueue.viewSummary', 'View Summary')}
            </Button>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={loadWorkQueue}>
              {t('common.refresh', 'Refresh')}
            </Button>
          </Group>
        </Group>

        {/* Next Patient Suggestion Card */}
        {nextPatient && workflowConfig.autoAdvanceToNextPatient && (
          <Paper withBorder p="md" bg="blue.0" radius="md">
            <Group justify="space-between">
              <Group gap="md">
                <IconPlayerPlay size={24} color="var(--mantine-color-blue-6)" />
                <div>
                  <Text size="sm" fw={600}>
                    {t('workQueue.nextSuggested', 'Next Patient')}
                  </Text>
                  <Group gap="xs">
                    <Text fw={500}>
                      {nextPatient.patient
                        ? formatHumanName(nextPatient.patient.name?.[0])
                        : t('common.unknown', 'Unknown')}
                    </Text>
                    {nextPatient.type === 'appointment' && (
                      <Badge size="xs" color="blue">{nextPatient.displayTime}</Badge>
                    )}
                    {nextPatient.type === 'queue' && nextPatient.priority && (
                      <PriorityBadge priority={nextPatient.priority} size="xs" />
                    )}
                  </Group>
                </div>
              </Group>
              <Button
                leftSection={<IconArrowRight size={16} />}
                onClick={handleClaimNextPatient}
                loading={claimingPatient}
              >
                {t('queue.nextPatient', 'Next Patient')}
              </Button>
            </Group>
          </Paper>
        )}

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} pos="relative">
          <LoadingOverlay visible={loading} />

          <StatCard
            icon={<IconCalendar size={24} />}
            label={t('workQueue.scheduled', 'Scheduled')}
            value={stats.totalScheduled}
            color="blue"
          />
          <StatCard
            icon={<IconUsers size={24} />}
            label={t('workQueue.inQueue', 'In Queue')}
            value={stats.totalQueue}
            color="orange"
          />
          <StatCard
            icon={<IconUserCheck size={24} />}
            label={t('workQueue.inProgress', 'In Progress')}
            value={stats.totalInProgress}
            color="green"
          />
          <StatCard
            icon={<IconCheck size={24} />}
            label={t('workQueue.completed', 'Completed')}
            value={stats.totalCompleted}
            color="teal"
          />
          <StatCard
            icon={<IconClock size={24} />}
            label={t('workQueue.avgConsultTime', 'Avg Consult')}
            value={`${stats.averageConsultTime}m`}
            color="violet"
          />
          <StatCard
            icon={<IconClipboardList size={24} />}
            label={t('workQueue.pendingTasks', 'Pending Tasks')}
            value={stats.totalPendingTasks}
            color="pink"
            badge={stats.overdueTasks > 0 ? stats.overdueTasks : undefined}
          />
        </SimpleGrid>

        {/* Unified Timeline View */}
        {viewMode === 'unified' && unifiedPatients.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Text size="lg" fw={600}>
                  {t('workQueue.todaysPatients', "Today's Patients")}
                </Text>
                <Badge>{unifiedPatients.length}</Badge>
              </Group>
              <Divider />
              <Stack gap="xs">
                {unifiedPatients.map((item) => (
                  <Card
                    key={item.id}
                    withBorder
                    p="sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (item.type === 'encounter' && item.encounter?.id) {
                        navigate(`/Encounter/${item.encounter.id}`);
                      } else if (item.type === 'queue' && item.task?.focus?.reference) {
                        navigate(`/${item.task.focus.reference}`);
                      } else if (item.patientRef) {
                        navigate(`/${item.patientRef}`);
                      }
                    }}
                  >
                    <Group justify="space-between">
                      <Group gap="md">
                        {/* Type indicator */}
                        <Tooltip
                          label={
                            item.type === 'appointment'
                              ? t('workQueue.scheduled', 'Scheduled')
                              : item.type === 'queue'
                              ? t('workQueue.walkIn', 'Walk-in')
                              : t('workQueue.inProgress', 'In Progress')
                          }
                        >
                          <Badge
                            variant="light"
                            color={
                              item.type === 'encounter'
                                ? 'green'
                                : item.type === 'appointment'
                                ? 'blue'
                                : 'orange'
                            }
                            size="sm"
                          >
                            {item.type === 'encounter' ? (
                              <IconUserCheck size={12} />
                            ) : item.type === 'appointment' ? (
                              <IconCalendar size={12} />
                            ) : (
                              <IconUsers size={12} />
                            )}
                          </Badge>
                        </Tooltip>

                        <div>
                          <Group gap="xs">
                            <Text fw={500}>
                              {item.patient
                                ? formatHumanName(item.patient.name?.[0])
                                : t('common.unknown', 'Unknown')}
                            </Text>
                            {item.priority && <PriorityBadge priority={item.priority} size="xs" />}
                            {item.type === 'queue' && item.status === 'in-progress' && (
                              <Badge color="blue" size="xs">
                                {t('workQueue.claimed', 'Claimed')}
                              </Badge>
                            )}
                            {item.isSynced && (
                              <Tooltip label={t('workQueue.syncedToQueue', 'Synced to queue')}>
                                <Badge color="green" size="xs" variant="dot">
                                  {t('workQueue.inQueue', 'In Queue')}
                                </Badge>
                              </Tooltip>
                            )}
                          </Group>
                          <Text size="sm" c="dimmed">
                            {item.complaint || item.appointmentType || t('queue.noComplaint', 'Not specified')}
                          </Text>
                        </div>
                      </Group>

                      <div style={{ textAlign: 'right' }}>
                        <Group gap="xs" justify="flex-end">
                          {item.type === 'appointment' && <IconCalendar size={14} />}
                          {item.type === 'queue' && <IconClock size={14} />}
                          <Text size="sm" fw={500}>
                            {item.displayTime}
                          </Text>
                        </Group>
                        <Badge
                          color={
                            item.status === 'in-progress'
                              ? 'green'
                              : item.status === 'arrived'
                              ? 'green'
                              : item.status === 'ready'
                              ? 'orange'
                              : 'gray'
                          }
                          size="sm"
                        >
                          {item.status === 'ready'
                            ? t('workQueue.waiting', 'Waiting')
                            : item.status === 'in-progress'
                            ? t('workQueue.inProgress', 'In Progress')
                            : item.status}
                        </Badge>
                      </div>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Card>
        )}

        {/* Separate Views - shown when viewMode is 'separate' or in non-hybrid modes */}
        {(viewMode === 'separate' || !isHybridMode(workflowConfig)) && (
          <>
            {/* Scheduled Appointments */}
            {shouldShowScheduling(workflowConfig) && data.scheduledAppointments.length > 0 && (
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      {t('workQueue.scheduledAppointments', 'Scheduled Appointments')}
                    </Text>
                    <Badge>{data.scheduledAppointments.length}</Badge>
                  </Group>
                  <Divider />
                  <Stack gap="xs">
                    {data.scheduledAppointments.map((apt) => {
                      const patientRef = apt.participant?.find((p) =>
                        p.actor?.reference?.startsWith('Patient/')
                      )?.actor?.reference;
                      const patient = patientRef ? data.patients.get(patientRef) : undefined;
                      const syncStatus = getAppointmentSyncStatus(apt);

                      return (
                        <Card key={apt.id} withBorder p="sm" style={{ cursor: 'pointer' }}>
                          <Group justify="space-between">
                            <div>
                              <Group gap="xs">
                                <Text fw={500}>
                                  {patient ? formatHumanName(patient.name?.[0]) : t('common.unknown', 'Unknown')}
                                </Text>
                                {isAppointmentSynced(apt) && (
                                  <Tooltip label={t('workQueue.syncedToQueue', 'Synced to queue')}>
                                    <Badge color="green" size="xs" variant="dot">
                                      {t('workQueue.inQueue', 'In Queue')}
                                    </Badge>
                                  </Tooltip>
                                )}
                              </Group>
                              <Text size="sm" c="dimmed">
                                {apt.appointmentType?.text || t('workQueue.appointment', 'Appointment')}
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Text size="sm" fw={500}>
                                {apt.start ? new Date(apt.start).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                }) : ''}
                              </Text>
                              <Badge
                                color={
                                  apt.status === 'arrived'
                                    ? 'green'
                                    : apt.status === 'fulfilled'
                                    ? 'blue'
                                    : 'gray'
                                }
                                size="sm"
                              >
                                {apt.status}
                              </Badge>
                            </div>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                </Stack>
              </Card>
            )}

            {/* My Queue Patients (walk-ins assigned to me) */}
            {shouldShowQueue(workflowConfig) && data.myQueuePatients.length > 0 && (
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      {t('workQueue.myQueuePatients', 'My Queue Patients')}
                    </Text>
                    <Badge>{data.myQueuePatients.length}</Badge>
                  </Group>
                  <Divider />
                  <Stack gap="xs">
                    {data.myQueuePatients.map((task) => {
                      const patientRef = task.for ? getReferenceString(task.for) : undefined;
                      const patient = patientRef ? data.patients.get(patientRef) : undefined;
                      const priority = task.priority as FhirPriority;
                      const waitTime = task.authoredOn ? calculateWaitTime(task) : 0;
                      const complaint = getChiefComplaint(task);

                      return (
                        <Card
                          key={task.id}
                          withBorder
                          p="sm"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            if (task.focus?.reference) {
                              navigate(`/${task.focus.reference}`);
                            }
                          }}
                        >
                          <Group justify="space-between">
                            <div>
                              <Group gap="xs">
                                <Text fw={500}>
                                  {patient ? formatHumanName(patient.name?.[0]) : t('common.unknown', 'Unknown')}
                                </Text>
                                <PriorityBadge priority={priority} size="xs" />
                                {task.status === 'in-progress' && (
                                  <Badge color="blue" size="xs">
                                    {t('workQueue.claimed', 'Claimed')}
                                  </Badge>
                                )}
                              </Group>
                              <Text size="sm" c="dimmed">
                                {complaint || t('queue.noComplaint', 'No complaint specified')}
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Group gap="xs">
                                <IconClock size={16} />
                                <Text size="sm">{formatWaitTime(waitTime)}</Text>
                              </Group>
                            </div>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                </Stack>
              </Card>
            )}

            {/* In Progress Encounters */}
            {data.inProgressEncounters.length > 0 && (
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      {t('workQueue.currentlySeeing', 'Currently Seeing')}
                    </Text>
                    <Badge color="green">{data.inProgressEncounters.length}</Badge>
                  </Group>
                  <Divider />
                  <Stack gap="xs">
                    {data.inProgressEncounters.map((encounter) => {
                      const patientRef = encounter.subject ? getReferenceString(encounter.subject) : undefined;
                      const patient = patientRef ? data.patients.get(patientRef) : undefined;

                      return (
                        <Card
                          key={encounter.id}
                          withBorder
                          p="sm"
                          style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/Encounter/${encounter.id}`)}
                        >
                          <Group justify="space-between">
                            <div>
                              <Text fw={500}>
                                {patient ? formatHumanName(patient.name?.[0]) : t('common.unknown', 'Unknown')}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {encounter.type?.[0]?.text || t('workQueue.encounter', 'Encounter')}
                              </Text>
                            </div>
                            <Button size="xs" variant="light" onClick={() => navigate(`/Encounter/${encounter.id}`)}>
                              {t('workQueue.continueEncounter', 'Continue')}
                            </Button>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                </Stack>
              </Card>
            )}

            {/* Completed Today */}
            {data.completedToday.length > 0 && (
              <Card withBorder>
                <Stack gap="md">
                  <Group justify="space-between">
                    <Text size="lg" fw={600}>
                      {t('workQueue.completedToday', 'Completed Today')}
                    </Text>
                    <Badge color="teal">{data.completedToday.length}</Badge>
                  </Group>
                  <Divider />
                  <Stack gap="xs">
                    {data.completedToday.slice(0, 5).map((encounter) => {
                      const patientRef = encounter.subject ? getReferenceString(encounter.subject) : undefined;
                      const patient = patientRef ? data.patients.get(patientRef) : undefined;

                      return (
                        <Card key={encounter.id} withBorder p="sm" style={{ cursor: 'pointer' }}>
                          <Group justify="space-between">
                            <div>
                              <Text fw={500}>
                                {patient ? formatHumanName(patient.name?.[0]) : t('common.unknown', 'Unknown')}
                              </Text>
                              <Text size="sm" c="dimmed">
                                {encounter.type?.[0]?.text || t('workQueue.encounter', 'Encounter')}
                              </Text>
                            </div>
                            <Badge color="teal" size="sm">
                              {t('workQueue.finished', 'Finished')}
                            </Badge>
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                  {data.completedToday.length > 5 && (
                    <Text size="sm" c="dimmed" ta="center">
                      {t('workQueue.andMore', 'And {{count}} more...', {
                        count: data.completedToday.length - 5,
                      })}
                    </Text>
                  )}
                </Stack>
              </Card>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading &&
          stats.totalPatients === 0 &&
          data.inProgressEncounters.length === 0 &&
          data.completedToday.length === 0 && (
            <Card withBorder p="xl">
              <Stack align="center" gap="md">
                <IconCheck size={48} style={{ opacity: 0.5 }} />
                <Text size="lg" fw={500}>
                  {t('workQueue.noPatientsToday', 'No patients scheduled for today')}
                </Text>
                <Text size="sm" c="dimmed">
                  {t('workQueue.checkBackLater', 'Check back later or check the main queue for walk-ins')}
                </Text>
                <Button variant="light" onClick={() => navigate('/queue')}>
                  {t('workQueue.viewMainQueue', 'View Main Queue')}
                </Button>
              </Stack>
            </Card>
          )}

        {/* Pending Tasks Section */}
        {data.pendingTasks.length > 0 && (
          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Group gap="xs">
                  <Text size="lg" fw={600}>
                    {t('workQueue.pendingTasks', 'Pending Tasks')}
                  </Text>
                  {stats.overdueTasks > 0 && (
                    <Badge color="red" size="sm">
                      {t('workQueue.overdueCount', '{{count}} overdue', { count: stats.overdueTasks })}
                    </Badge>
                  )}
                </Group>
                <Badge>{data.pendingTasks.length}</Badge>
              </Group>
              <Divider />
              <Stack gap="xs">
                {data.pendingTasks.map((task) => (
                  <PendingTaskCard
                    key={task.task.id}
                    task={task}
                    onComplete={() => {
                      setSelectedTask(task);
                      setTaskCompleteModalOpen(true);
                    }}
                    onClick={() => handleTaskClick(task)}
                  />
                ))}
              </Stack>
            </Stack>
          </Card>
        )}

        {/* All tasks complete message */}
        {data.pendingTasks.length === 0 && stats.totalCompleted > 0 && (
          <Card withBorder bg="teal.0">
            <Group justify="center" gap="xs" py="sm">
              <IconCheck size={20} color="var(--mantine-color-teal-6)" />
              <Text c="teal.7" fw={500}>
                {t('workQueue.allTasksComplete', 'All tasks complete!')}
              </Text>
            </Group>
          </Card>
        )}
      </Stack>

      {/* Complete Task Modal */}
      <CompleteTaskModal
        opened={taskCompleteModalOpen}
        onClose={() => {
          setTaskCompleteModalOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onComplete={handleCompleteTask}
        loading={completingTask}
      />

      {/* End of Day Summary Modal */}
      <EndOfDaySummaryModal
        opened={endOfDaySummaryOpen}
        onClose={() => setEndOfDaySummaryOpen(false)}
        summary={endOfDaySummary}
        loading={loadingSummary}
      />
    </Container>
  );
}

/**
 * Stat Card Component
 */
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
  badge?: number;
}

function StatCard({ icon, label, value, color, badge }: StatCardProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <Card withBorder>
      <Group gap="sm">
        <div style={{ color: `var(--mantine-color-${color}-6)` }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <Group gap="xs" justify="space-between">
            <Text size="xs" c="dimmed">
              {label}
            </Text>
            {badge !== undefined && badge > 0 && (
              <Badge size="xs" color="red">
                {t('workQueue.overdueCount', '{{count}} overdue', { count: badge })}
              </Badge>
            )}
          </Group>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </div>
      </Group>
    </Card>
  );
}
