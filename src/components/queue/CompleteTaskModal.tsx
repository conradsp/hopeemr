import { useState } from 'react';
import { Modal, Stack, Text, Textarea, Group, Button } from '@mantine/core';
import { formatHumanName } from '@medplum/core';
import { useTranslation } from 'react-i18next';
import { TaskTypeIcon } from './TaskTypeIcon';
import type { ProviderTask } from '../../types/queue.types';

interface CompleteTaskModalProps {
  opened: boolean;
  onClose: () => void;
  task: ProviderTask | null;
  onComplete: (taskId: string, notes?: string) => Promise<void>;
  loading?: boolean;
}

/**
 * CompleteTaskModal - Modal for completing a provider task
 *
 * Allows the provider to add optional notes when completing a task.
 */
export function CompleteTaskModal({
  opened,
  onClose,
  task,
  onComplete,
  loading = false,
}: CompleteTaskModalProps): JSX.Element {
  const { t } = useTranslation();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (): Promise<void> => {
    if (!task?.task.id) return;

    setSubmitting(true);
    try {
      await onComplete(task.task.id, notes.trim() || undefined);
      setNotes('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = (): void => {
    setNotes('');
    onClose();
  };

  if (!task) {
    return <></>;
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t('workQueue.completeTask', 'Complete Task')}
      centered
    >
      <Stack gap="md">
        {/* Task Details */}
        <Group gap="sm">
          <TaskTypeIcon type={task.taskType} size={24} />
          <div>
            <Text fw={500}>{task.description}</Text>
            <Text size="sm" c="dimmed">
              {t(`workQueue.taskTypes.${task.taskType}`, task.taskType)}
            </Text>
          </div>
        </Group>

        {/* Patient if applicable */}
        {task.patient && (
          <Text size="sm">
            <Text span fw={500}>
              {t('common.patient', 'Patient')}:{' '}
            </Text>
            {formatHumanName(task.patient.name?.[0])}
          </Text>
        )}

        {/* Notes textarea */}
        <Textarea
          label={t('workQueue.taskNotes', 'Task Notes')}
          placeholder={t(
            'workQueue.taskNotesPlaceholder',
            'Optional notes about task completion...'
          )}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          minRows={3}
          maxRows={6}
        />

        {/* Action buttons */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={handleClose} disabled={submitting || loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            color="green"
            onClick={handleComplete}
            loading={submitting || loading}
          >
            {t('workQueue.completeTask', 'Complete Task')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
