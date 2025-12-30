import { Card, Group, Text, Badge, ActionIcon, Tooltip } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { formatHumanName } from '@medplum/core';
import { useTranslation } from 'react-i18next';
import { TaskTypeIcon } from './TaskTypeIcon';
import { PriorityBadge } from './PriorityBadge';
import type { ProviderTask } from '../../types/queue.types';
import type { FhirPriority } from '../../utils/triageUtils';

interface PendingTaskCardProps {
  task: ProviderTask;
  onComplete: () => void;
  onClick: () => void;
}

/**
 * PendingTaskCard - Displays a provider task in a card format
 *
 * Shows task type icon, description, patient (if applicable),
 * priority, due date, and overdue indicator.
 */
export function PendingTaskCard({
  task,
  onComplete,
  onClick,
}: PendingTaskCardProps): JSX.Element {
  const { t } = useTranslation();

  // Format due date if present
  const formatDueDate = (date: Date): string => {
    const now = new Date();
    const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return t('common.today', 'Today');
    } else if (diffDays === 1) {
      return t('common.tomorrow', 'Tomorrow');
    } else if (diffDays === -1) {
      return t('common.yesterday', 'Yesterday');
    } else if (diffDays < 0) {
      return t('workQueue.overdueCount', '{{count}} days ago', { count: Math.abs(diffDays) });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Card
      withBorder
      p="sm"
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="md" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          {/* Task Type Icon */}
          <TaskTypeIcon type={task.taskType} size={24} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text fw={500} truncate>
                {task.description}
              </Text>
              <PriorityBadge priority={task.priority as FhirPriority} size="xs" />
              {task.isOverdue && (
                <Badge color="red" size="xs">
                  {t('workQueue.overdue', 'Overdue')}
                </Badge>
              )}
            </Group>

            {/* Patient name if applicable */}
            {task.patient && (
              <Text size="sm" c="dimmed" truncate>
                {formatHumanName(task.patient.name?.[0])}
              </Text>
            )}

            {/* Task type label */}
            {!task.patient && (
              <Text size="sm" c="dimmed">
                {t(`workQueue.taskTypes.${task.taskType}`, task.taskType)}
              </Text>
            )}
          </div>
        </Group>

        <Group gap="xs" wrap="nowrap">
          {/* Due date */}
          {task.dueDate && (
            <Text
              size="sm"
              c={task.isOverdue ? 'red' : 'dimmed'}
              style={{ whiteSpace: 'nowrap' }}
            >
              {formatDueDate(task.dueDate)}
            </Text>
          )}

          {/* Complete button */}
          <Tooltip label={t('workQueue.completeTask', 'Complete Task')}>
            <ActionIcon
              variant="light"
              color="green"
              onClick={(e) => {
                e.stopPropagation();
                onComplete();
              }}
            >
              <IconCheck size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}
