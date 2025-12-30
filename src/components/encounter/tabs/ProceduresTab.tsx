import { Paper, Text, Badge, Group, Stack } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { Procedure } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface ProceduresTabProps {
  procedures: Procedure[] | undefined;
}

export function ProceduresTab({ procedures }: ProceduresTabProps): JSX.Element {
  const { t } = useTranslation();
  if (!procedures || procedures.length === 0) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">{t('proceduresTab.noProcedures', 'No procedures recorded')}</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {procedures.map((proc) => (
        <Paper key={proc.id} p="md" withBorder>
          <Group justify="space-between" mb="xs">
            <div className="flex-1">
              <Text fw={500}>{proc.code?.coding?.[0]?.display || proc.code?.text}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                {proc.performedDateTime && formatDateTime(proc.performedDateTime)}
                {proc.performedPeriod && (
                  <>
                    {proc.performedPeriod.start && formatDateTime(proc.performedPeriod.start)}
                    {' - '}
                    {proc.performedPeriod.end && formatDateTime(proc.performedPeriod.end)}
                  </>
                )}
              </Text>
            </div>
            <Badge color={proc.status === 'completed' ? 'green' : 'blue'} variant="light">
              {t(`procedure.status.${proc.status}`, proc.status)}
            </Badge>
          </Group>
          {proc.category && (
            <Badge size="sm" variant="dot" mr="xs">
              {proc.category.coding?.[0]?.display || proc.category.text}
            </Badge>
          )}
          {proc.performer && proc.performer.length > 0 && (
            <Text size="sm" c="dimmed" mt="xs">
              {t('common.performedBy', 'Performed by')}: {proc.performer[0].actor?.display || proc.performer[0].actor?.reference}
            </Text>
          )}
          {proc.outcome && (
            <Text size="sm" mt="xs">
              {t('common.outcome', 'Outcome')}: {proc.outcome.coding?.[0]?.display || proc.outcome.text}
            </Text>
          )}
          {proc.note && proc.note.length > 0 && (
            <Text size="sm" c="dimmed" mt="xs">
              {t('common.note', 'Note')}: {proc.note[0].text}
            </Text>
          )}
        </Paper>
      ))}
    </Stack>
  );
}

