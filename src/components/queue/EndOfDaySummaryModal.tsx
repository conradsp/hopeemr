import { Modal, Stack, SimpleGrid, Card, Text, Group, Divider, LoadingOverlay } from '@mantine/core';
import {
  IconUsers,
  IconCalendar,
  IconWalk,
  IconUserOff,
  IconX,
  IconClock,
  IconCheck,
  IconClipboardList,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { EndOfDaySummary } from '../../types/queue.types';

interface EndOfDaySummaryModalProps {
  opened: boolean;
  onClose: () => void;
  summary: EndOfDaySummary | null;
  loading?: boolean;
}

interface SummaryStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: string;
}

function SummaryStat({ icon, label, value, color = 'blue' }: SummaryStatProps): JSX.Element {
  return (
    <Card withBorder p="md">
      <Group gap="sm">
        <div style={{ color: `var(--mantine-color-${color}-6)` }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <Text size="xs" c="dimmed">
            {label}
          </Text>
          <Text size="xl" fw={700}>
            {value}
          </Text>
        </div>
      </Group>
    </Card>
  );
}

/**
 * EndOfDaySummaryModal - Modal showing end of day statistics
 *
 * Displays a summary of the provider's day including:
 * - Patients seen
 * - Scheduled vs walk-ins
 * - No-shows and cancellations
 * - Average consultation time
 * - Tasks completed/pending
 */
export function EndOfDaySummaryModal({
  opened,
  onClose,
  summary,
  loading = false,
}: EndOfDaySummaryModalProps): JSX.Element {
  const { t } = useTranslation();

  // Format time in hours and minutes
  const formatTime = (minutes: number): string => {
    if (minutes < 60) {
      return t('workQueue.minutes', '{{count}}m', { count: minutes });
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return t('workQueue.hours', '{{count}}h {{minutes}}m', { count: hours, minutes: mins });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('workQueue.endOfDaySummary', 'End of Day Summary')}
      size="lg"
      centered
    >
      <Stack gap="md" pos="relative">
        <LoadingOverlay visible={loading} />

        {summary && (
          <>
            {/* Date Header */}
            <Text size="sm" c="dimmed" ta="center">
              {new Date(summary.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>

            <Divider label={t('common.patient', 'Patients')} labelPosition="center" />

            {/* Patient Stats */}
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <SummaryStat
                icon={<IconUsers size={24} />}
                label={t('workQueue.patientsSeen', 'Patients Seen')}
                value={summary.patientsSeen}
                color="green"
              />
              <SummaryStat
                icon={<IconCalendar size={24} />}
                label={t('workQueue.scheduledPatients', 'Scheduled')}
                value={summary.scheduledAppointments}
                color="blue"
              />
              <SummaryStat
                icon={<IconWalk size={24} />}
                label={t('workQueue.walkInsSeenToday', 'Walk-Ins')}
                value={summary.walkInsSeen}
                color="orange"
              />
              <SummaryStat
                icon={<IconUserOff size={24} />}
                label={t('workQueue.noShows', 'No Shows')}
                value={summary.noShows}
                color="red"
              />
            </SimpleGrid>

            {summary.cancelledAppointments > 0 && (
              <Card withBorder p="sm" bg="gray.0">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconX size={16} color="var(--mantine-color-gray-6)" />
                    <Text size="sm" c="dimmed">
                      {t('workQueue.cancelledToday', 'Cancelled')}
                    </Text>
                  </Group>
                  <Text fw={500}>{summary.cancelledAppointments}</Text>
                </Group>
              </Card>
            )}

            <Divider label={t('common.time', 'Time')} labelPosition="center" />

            {/* Time Stats */}
            <SimpleGrid cols={{ base: 2 }}>
              <SummaryStat
                icon={<IconClock size={24} />}
                label={t('workQueue.avgConsultTime', 'Avg Consult')}
                value={formatTime(summary.averageConsultTime)}
                color="violet"
              />
              <SummaryStat
                icon={<IconClock size={24} />}
                label={t('workQueue.totalConsultTime', 'Total Time')}
                value={formatTime(summary.totalConsultTime)}
                color="violet"
              />
            </SimpleGrid>

            <Divider label={t('workQueue.pendingTasks', 'Tasks')} labelPosition="center" />

            {/* Task Stats */}
            <SimpleGrid cols={{ base: 2 }}>
              <SummaryStat
                icon={<IconCheck size={24} />}
                label={t('workQueue.tasksCompleted', 'Completed')}
                value={summary.completedTasks}
                color="teal"
              />
              <SummaryStat
                icon={<IconClipboardList size={24} />}
                label={t('workQueue.tasksPending', 'Pending')}
                value={summary.pendingTasksRemaining}
                color={summary.pendingTasksRemaining > 0 ? 'pink' : 'gray'}
              />
            </SimpleGrid>
          </>
        )}

        {!summary && !loading && (
          <Text c="dimmed" ta="center" py="xl">
            {t('workQueue.loadError', 'Failed to load summary')}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
