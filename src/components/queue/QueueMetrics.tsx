import { Card, Group, Stack, Text, SimpleGrid } from '@mantine/core';
import { IconClock, IconUsers, IconAlertTriangle, IconActivity } from '@tabler/icons-react';
import type { Task } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { calculateWaitTime, getTriageLevel } from '../../utils/queueUtils';
import { formatWaitTime } from '../../utils/triageUtils';
import type { FhirPriority } from '../../utils/triageUtils';

/**
 * Queue Metrics Component
 *
 * Displays statistics about the current queue state
 * - Total waiting
 * - Average wait time
 * - Longest wait time
 * - By priority/triage level breakdown
 */

interface QueueMetricsProps {
  /** Queue tasks */
  tasks: Task[];

  /** Show detailed breakdown */
  detailed?: boolean;
}

export function QueueMetrics({ tasks, detailed = true }: QueueMetricsProps): JSX.Element {
  const { t } = useTranslation();

  // Calculate metrics
  const waitingTasks = tasks.filter((t) => t.status === 'ready');
  const inProgressTasks = tasks.filter((t) => t.status === 'in-progress');

  const waitTimes = waitingTasks
    .filter((t) => t.authoredOn)
    .map((t) => calculateWaitTime(t));

  const totalWaiting = waitingTasks.length;
  const totalInProgress = inProgressTasks.length;
  const averageWaitTime = waitTimes.length > 0 ? Math.floor(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;
  const longestWaitTime = waitTimes.length > 0 ? Math.max(...waitTimes) : 0;

  // By priority
  const byPriority = {
    stat: waitingTasks.filter((t) => t.priority === 'stat').length,
    asap: waitingTasks.filter((t) => t.priority === 'asap').length,
    urgent: waitingTasks.filter((t) => t.priority === 'urgent').length,
    routine: waitingTasks.filter((t) => t.priority === 'routine').length,
  };

  // By triage level
  const byTriageLevel = {
    level1: waitingTasks.filter((t) => getTriageLevel(t) === 1).length,
    level2: waitingTasks.filter((t) => getTriageLevel(t) === 2).length,
    level3: waitingTasks.filter((t) => getTriageLevel(t) === 3).length,
    level4: waitingTasks.filter((t) => getTriageLevel(t) === 4).length,
    level5: waitingTasks.filter((t) => getTriageLevel(t) === 5).length,
  };

  return (
    <Stack gap="md">
      {/* Primary Metrics */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <MetricCard
          icon={<IconUsers size={24} />}
          label={t('queue.metrics.totalWaiting', 'Waiting')}
          value={totalWaiting}
          color="blue"
        />
        <MetricCard
          icon={<IconActivity size={24} />}
          label={t('queue.metrics.inProgress', 'In Progress')}
          value={totalInProgress}
          color="green"
        />
        <MetricCard
          icon={<IconClock size={24} />}
          label={t('queue.metrics.avgWait', 'Avg Wait')}
          value={formatWaitTime(averageWaitTime)}
          color="orange"
        />
        <MetricCard
          icon={<IconAlertTriangle size={24} />}
          label={t('queue.metrics.longestWait', 'Longest Wait')}
          value={formatWaitTime(longestWaitTime)}
          color={longestWaitTime > 60 ? 'red' : 'orange'}
        />
      </SimpleGrid>

      {/* Detailed Breakdown */}
      {detailed && totalWaiting > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {/* By Priority */}
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t('queue.metrics.byPriority', 'By Priority')}
              </Text>
              <Group justify="space-between">
                <Text size="sm" c="red">
                  {t('queue.priorityLevels.stat', 'STAT')}
                </Text>
                <Text size="sm" fw={500}>
                  {byPriority.stat}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="orange">
                  {t('queue.priorityLevels.asap', 'ASAP')}
                </Text>
                <Text size="sm" fw={500}>
                  {byPriority.asap}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="yellow">
                  {t('queue.priorityLevels.urgent', 'Urgent')}
                </Text>
                <Text size="sm" fw={500}>
                  {byPriority.urgent}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="green">
                  {t('queue.priorityLevels.routine', 'Routine')}
                </Text>
                <Text size="sm" fw={500}>
                  {byPriority.routine}
                </Text>
              </Group>
            </Stack>
          </Card>

          {/* By Triage Level */}
          <Card withBorder>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t('queue.metrics.byTriageLevel', 'By Triage Level')}
              </Text>
              <Group justify="space-between">
                <Text size="sm" c="red">
                  {t('queue.triageLevels.esi1', 'ESI 1 - Resuscitation')}
                </Text>
                <Text size="sm" fw={500}>
                  {byTriageLevel.level1}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="orange">
                  {t('queue.triageLevels.esi2', 'ESI 2 - Emergent')}
                </Text>
                <Text size="sm" fw={500}>
                  {byTriageLevel.level2}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="yellow">
                  {t('queue.triageLevels.esi3', 'ESI 3 - Urgent')}
                </Text>
                <Text size="sm" fw={500}>
                  {byTriageLevel.level3}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="green">
                  {t('queue.triageLevels.esi4', 'ESI 4 - Less Urgent')}
                </Text>
                <Text size="sm" fw={500}>
                  {byTriageLevel.level4}
                </Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="blue">
                  {t('queue.triageLevels.esi5', 'ESI 5 - Non-Urgent')}
                </Text>
                <Text size="sm" fw={500}>
                  {byTriageLevel.level5}
                </Text>
              </Group>
            </Stack>
          </Card>
        </SimpleGrid>
      )}
    </Stack>
  );
}

/**
 * Individual Metric Card
 */
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

function MetricCard({ icon, label, value, color }: MetricCardProps): JSX.Element {
  return (
    <Card withBorder>
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
