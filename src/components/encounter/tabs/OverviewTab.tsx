import { Paper, Text, Stack, Group, Title } from '@mantine/core';
import { Observation, Procedure, Condition } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface OverviewTabProps {
  vitals: Observation[] | undefined;
  nonVitalObservations: Observation[] | undefined;
  procedures: Procedure[] | undefined;
  conditions: Condition[] | undefined;
}

export function OverviewTab({ vitals, nonVitalObservations, procedures, conditions }: OverviewTabProps): JSX.Element {
  const { t } = useTranslation();
  const hasData = (vitals && vitals.length > 0) || 
                  (nonVitalObservations && nonVitalObservations.length > 0) || 
                  (procedures && procedures.length > 0) || 
                  (conditions && conditions.length > 0);

  if (!hasData) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">{t('common.noClinicalData', 'No clinical data recorded for this encounter')}</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Vitals Summary */}
      {vitals && vitals.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">{t('common.vitalSigns', 'Vital Signs')}</Title>
          <Stack gap="xs">
            {vitals.slice(0, 10).map((obs) => (
              <Group key={obs.id} justify="space-between">
                <Text size="sm">{obs.code?.coding?.[0]?.display || obs.code?.text}</Text>
                <Text size="sm" fw={500}>
                  {obs.valueQuantity?.value} {obs.valueQuantity?.unit}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}
      
      {/* Other Observations Summary */}
      {nonVitalObservations && nonVitalObservations.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">{t('common.otherObservations', 'Other Observations')}</Title>
          <Stack gap="xs">
            {nonVitalObservations.slice(0, 5).map((obs) => (
              <Group key={obs.id} justify="space-between">
                <Text size="sm">{obs.code?.coding?.[0]?.display || obs.code?.text}</Text>
                <Text size="sm" fw={500}>
                  {obs.valueQuantity?.value} {obs.valueQuantity?.unit}
                  {obs.valueString}
                  {obs.valueCodeableConcept?.coding?.[0]?.display || obs.valueCodeableConcept?.text}
                </Text>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Procedures Summary */}
      {procedures && procedures.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">{t('common.procedures', 'Procedures')}</Title>
          <Stack gap="xs">
            {procedures.map((proc) => (
              <Text key={proc.id} size="sm">
                • {proc.code?.coding?.[0]?.display || proc.code?.text}
              </Text>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Conditions/Diagnoses */}
      {conditions && conditions.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">{t('common.diagnoses', 'Diagnoses')}</Title>
          <Stack gap="xs">
            {conditions.map((condition) => (
              <Text key={condition.id} size="sm">
                • {condition.code?.coding?.[0]?.display || condition.code?.text}
              </Text>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

