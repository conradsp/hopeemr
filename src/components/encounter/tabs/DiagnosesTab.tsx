import { Paper, Text, Badge, Group, Stack, Grid } from '@mantine/core';
import { formatDate } from '@medplum/core';
import { Condition } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface DiagnosesTabProps {
  conditions: Condition[] | undefined;
}

export function DiagnosesTab({ conditions }: DiagnosesTabProps): JSX.Element {
  const { t } = useTranslation();
  if (!conditions || conditions.length === 0) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">{t('diagnosesTab.noDiagnoses', 'No diagnoses recorded')}</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {conditions.map((condition) => (
        <Paper key={condition.id} p="md" withBorder>
          <Group justify="space-between" mb="xs">
            <div className="flex-1">
              <Text fw={500}>{condition.code?.coding?.[0]?.display || condition.code?.text}</Text>
              {condition.code?.coding?.[0]?.code && (
                <Text size="xs" c="dimmed" mt={2}>
                  {t('common.code', 'Code')}: {condition.code.coding[0].system} {condition.code.coding[0].code}
                </Text>
              )}
            </div>
            <Stack gap="xs" align="flex-end">
              {condition.clinicalStatus && (
                <Badge color="green" variant="light">
                  {condition.clinicalStatus.coding?.[0]?.display || condition.clinicalStatus.text}
                </Badge>
              )}
              {condition.verificationStatus && (
                <Badge color="blue" variant="light">
                  {condition.verificationStatus.coding?.[0]?.display || condition.verificationStatus.text}
                </Badge>
              )}
            </Stack>
          </Group>
          <Grid mt="xs">
            {condition.severity && (
              <Grid.Col span={4}>
                <Text size="xs" c="dimmed">{t('common.severity', 'Severity')}</Text>
                <Badge size="sm" variant="light" mt={4}>
                  {condition.severity.coding?.[0]?.display || condition.severity.text}
                </Badge>
              </Grid.Col>
            )}
            {condition.onsetDateTime && (
              <Grid.Col span={4}>
                <Text size="xs" c="dimmed">{t('common.onset', 'Onset')}</Text>
                <Text size="sm" mt={4}>{formatDate(condition.onsetDateTime)}</Text>
              </Grid.Col>
            )}
            {condition.recordedDate && (
              <Grid.Col span={4}>
                <Text size="xs" c="dimmed">{t('common.recorded', 'Recorded')}</Text>
                <Text size="sm" mt={4}>{formatDate(condition.recordedDate)}</Text>
              </Grid.Col>
            )}
          </Grid>
          {condition.note && condition.note.length > 0 && (
            <Paper bg="gray.0" p="sm" mt="xs" radius="sm">
              <Text size="xs" c="dimmed" mb={4}>{t('common.clinicalNotes', 'Clinical Notes')}</Text>
              <Text size="sm" className="whitespace-pre-wrap">
                {condition.note[0].text}
              </Text>
            </Paper>
          )}
        </Paper>
      ))}
    </Stack>
  );
}

