import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Stack,
  Button,
  Group,
  Alert,
  LoadingOverlay,
  Select,
  Paper,
  Modal,
  TextInput,
  Textarea,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconUserCheck, IconRefresh, IconFilter } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { getReferenceString } from '@medplum/core';
import type { Patient, Task, Practitioner, Location } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { notifications } from '@mantine/notifications';
import { QueueTable } from '../../components/queue/QueueTable';
import { QueueMetrics } from '../../components/queue/QueueMetrics';
import { getQueue, claimNextPatient, claimSpecificPatient, updateTriageLevel, cancelQueueEntry } from '../../utils/queueUtils';
import { suggestPriorityFromTriage } from '../../utils/triageUtils';
import type { TriageUpdate } from '../../types/queue.types';
import { Permission } from '../../utils/permissions';
import { usePermissions } from '../../hooks/usePermissions';
import { logger } from '../../utils/logger';

/**
 * Queue Dashboard Page
 *
 * Main provider view for managing patient queue
 *
 * Features:
 * - View all patients in queue
 * - Claim next patient (with race condition protection)
 * - Update triage levels
 * - Filter by location/provider
 * - Real-time metrics
 * - Auto-refresh
 */

export function QueueDashboardPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  // State - all hooks must be called before any early returns
  const [tasks, setTasks] = useState<Task[]>([]);
  const [patients, setPatients] = useState<Map<string, Patient>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [triageModalOpen, setTriageModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [triageFormData, setTriageFormData] = useState<TriageUpdate>({
    triageLevel: 3,
    priority: 'urgent',
    notes: '',
  });
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [taskToRemove, setTaskToRemove] = useState<Task | null>(null);

  const profile = medplum.getProfile() as Practitioner;
  const canViewQueue = hasPermission(Permission.VIEW_QUEUE);

  /**
   * Load queue data
   */
  const loadQueue = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Get queue tasks
      const queueTasks = await getQueue(medplum, {
        location: selectedLocation || undefined,
        status: ['ready', 'in-progress'],
      });

      setTasks(queueTasks);

      // Load patient resources
      const patientMap = new Map<string, Patient>();
      for (const task of queueTasks) {
        const patientRef = task.for ? getReferenceString(task.for) : undefined;
        if (patientRef && !patientMap.has(patientRef)) {
          try {
            const patient = await medplum.readReference(task.for as any);
            patientMap.set(patientRef, patient);
          } catch (err) {
            logger.warn('Failed to load patient', { patientRef, error: err });
          }
        }
      }

      setPatients(patientMap);
    } catch (err: any) {
      logger.error('Failed to load queue', err);
      setError(err.message || t('queue.error.loadFailed', 'Failed to load queue'));
    } finally {
      setLoading(false);
    }
  };

  // Load queue on mount and when location changes
  useEffect(() => {
    if (canViewQueue) {
      loadQueue();
    }
  }, [selectedLocation, canViewQueue]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!canViewQueue) return;
    
    const interval = setInterval(() => {
      loadQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedLocation, canViewQueue]);

  // Permission check - must be after all hooks
  if (!canViewQueue) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title={t('common.accessDenied', 'Access Denied')} color="red">
          {t('queue.noViewPermission', 'You do not have permission to view the queue.')}
        </Alert>
      </Container>
    );
  }

  /**
   * Claim next patient
   * Security: Optimistic locking prevents race conditions
   */
  const handleClaimNext = async (): Promise<void> => {
    if (!hasPermission(Permission.CLAIM_QUEUE_PATIENTS)) {
      notifications.show({
        title: t('common.accessDenied', 'Access Denied'),
        message: t('queue.noClaimPermission', 'You do not have permission to claim patients'),
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);

      const result = await claimNextPatient(medplum, { reference: `Practitioner/${profile.id}` });

      if (!result) {
        notifications.show({
          title: t('queue.noPatients', 'No Patients'),
          message: t('queue.noWaitingPatients', 'No patients are currently waiting'),
          color: 'blue',
        });
        return;
      }

      notifications.show({
        title: t('queue.patientClaimed', 'Patient Claimed'),
        message: t('queue.patientClaimedSuccess', 'Patient has been assigned to you'),
        color: 'green',
      });

      // Navigate to encounter
      navigate(`/Encounter/${result.encounter.id}`);
    } catch (err: any) {
      logger.error('Failed to claim patient', err);
      notifications.show({
        title: t('queue.error.claimFailed', 'Failed to Claim Patient'),
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
      loadQueue();
    }
  };

  /**
   * Claim specific patient
   */
  const handleClaimPatient = async (task: Task): Promise<void> => {
    if (!hasPermission(Permission.CLAIM_QUEUE_PATIENTS)) {
      notifications.show({
        title: t('common.accessDenied', 'Access Denied'),
        message: t('queue.noClaimPermission', 'You do not have permission to claim patients'),
        color: 'red',
      });
      return;
    }

    if (!task.id) {
      notifications.show({
        title: t('queue.error.claimFailed', 'Failed to Claim Patient'),
        message: 'Task ID is missing',
        color: 'red',
      });
      return;
    }

    try {
      setLoading(true);

      const result = await claimSpecificPatient(
        medplum,
        task.id,
        { reference: `Practitioner/${profile.id}` }
      );

      if (!result) {
        notifications.show({
          title: t('queue.error.claimFailed', 'Failed to Claim Patient'),
          message: 'Could not claim this patient',
          color: 'red',
        });
        return;
      }

      notifications.show({
        title: t('queue.patientClaimed', 'Patient Claimed'),
        message: t('queue.patientClaimedSuccess', 'Patient has been assigned to you'),
        color: 'green',
      });

      // Navigate to encounter
      navigate(`/Encounter/${result.encounter.id}`);
    } catch (err: any) {
      logger.error('Failed to claim patient', err);
      notifications.show({
        title: t('queue.error.claimFailed', 'Failed to Claim Patient'),
        message: err.message,
        color: 'red',
      });
      loadQueue();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update triage level
   */
  const handleUpdateTriage = (task: Task): void => {
    setSelectedTask(task);
    setTriageFormData({
      triageLevel: 3,
      priority: 'urgent',
      notes: '',
    });
    setTriageModalOpen(true);
  };

  const handleSaveTriage = async (): Promise<void> => {
    if (!selectedTask) return;

    try {
      setLoading(true);

      await updateTriageLevel(medplum, selectedTask.id!, triageFormData);

      notifications.show({
        title: t('queue.triageUpdated', 'Triage Updated'),
        message: t('queue.triageUpdatedSuccess', 'Triage level has been updated'),
        color: 'green',
      });

      setTriageModalOpen(false);
      loadQueue();
    } catch (err: any) {
      logger.error('Failed to update triage', err);
      notifications.show({
        title: t('queue.error.triageUpdateFailed', 'Failed to Update Triage'),
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open remove confirmation modal
   */
  const handleRemoveEntry = (task: Task): void => {
    setTaskToRemove(task);
    setRemoveModalOpen(true);
  };

  /**
   * Confirm and remove patient from queue
   */
  const handleConfirmRemove = async (): Promise<void> => {
    if (!taskToRemove?.id) return;

    try {
      setLoading(true);
      setRemoveModalOpen(false);

      await cancelQueueEntry(medplum, taskToRemove.id, 'Removed from queue by staff');

      notifications.show({
        title: t('queue.patientRemoved', 'Patient Removed'),
        message: t('queue.patientRemovedSuccess', 'Patient has been removed from the queue'),
        color: 'green',
      });

      setTaskToRemove(null);
      loadQueue();
    } catch (err: any) {
      logger.error('Failed to remove from queue', err);
      notifications.show({
        title: t('queue.error.cancelFailed', 'Failed to Remove Patient'),
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Title order={2}>{t('queue.dashboard', 'Queue Dashboard')}</Title>
          <Group>
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={loadQueue}>
              {t('common.refresh', 'Refresh')}
            </Button>
            {hasPermission(Permission.CLAIM_QUEUE_PATIENTS) && (
              <Button leftSection={<IconUserCheck size={16} />} onClick={handleClaimNext}>
                {t('queue.nextPatient', 'Next Patient')}
              </Button>
            )}
          </Group>
        </Group>

        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
            {error}
          </Alert>
        )}

        {/* Metrics */}
        <QueueMetrics tasks={tasks} />

        {/* Queue Table */}
        <Paper withBorder shadow="sm" p="md" pos="relative">
          <LoadingOverlay visible={loading} />

          <QueueTable
            tasks={tasks}
            patients={patients}
            onClaimPatient={handleClaimPatient}
            onUpdateTriage={handleUpdateTriage}
            onCancelEntry={handleRemoveEntry}
          />
        </Paper>
      </Stack>

      {/* Triage Modal */}
      <Modal
        opened={triageModalOpen}
        onClose={() => setTriageModalOpen(false)}
        title={t('queue.updateTriage', 'Update Triage')}
      >
        <Stack gap="md">
          <Select
            label={t('queue.triageLevel', 'Triage Level (ESI)')}
            data={[
              { value: '1', label: 'ESI 1 - Resuscitation' },
              { value: '2', label: 'ESI 2 - Emergent' },
              { value: '3', label: 'ESI 3 - Urgent' },
              { value: '4', label: 'ESI 4 - Less Urgent' },
              { value: '5', label: 'ESI 5 - Non-Urgent' },
            ]}
            value={triageFormData.triageLevel.toString()}
            onChange={(value) => {
              const level = parseInt(value || '3') as 1 | 2 | 3 | 4 | 5;
              setTriageFormData({
                ...triageFormData,
                triageLevel: level,
                priority: suggestPriorityFromTriage(level),
              });
            }}
          />

          <Select
            label={t('queue.priority', 'Priority')}
            data={[
              { value: 'stat', label: 'STAT' },
              { value: 'asap', label: 'ASAP' },
              { value: 'urgent', label: 'Urgent' },
              { value: 'routine', label: 'Routine' },
            ]}
            value={triageFormData.priority}
            onChange={(value) => setTriageFormData({ ...triageFormData, priority: value as any })}
          />

          <Textarea
            label={t('queue.triageNotes', 'Triage Notes')}
            placeholder={t('queue.triageNotesPlaceholder', 'Additional notes...')}
            value={triageFormData.notes}
            onChange={(e) => setTriageFormData({ ...triageFormData, notes: e.target.value })}
            rows={3}
          />

          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setTriageModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSaveTriage}>{t('common.save', 'Save')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        opened={removeModalOpen}
        onClose={() => {
          setRemoveModalOpen(false);
          setTaskToRemove(null);
        }}
        title={t('queue.removeFromQueue', 'Remove from Queue')}
        size="sm"
        centered
      >
        <Stack gap="md">
          <Text>{t('queue.confirmRemove', 'Are you sure you want to remove this patient from the queue?')}</Text>
          <Group justify="flex-end">
            <Button
              variant="subtle"
              onClick={() => {
                setRemoveModalOpen(false);
                setTaskToRemove(null);
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button color="red" onClick={handleConfirmRemove}>
              {t('queue.removeFromQueue', 'Remove from Queue')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
