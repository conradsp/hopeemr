import { Paper, Text, Badge, Group, Stack } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { Observation } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { getInterpretationColor } from '../../../utils/encounterUtils';
import { useTranslation } from 'react-i18next';

interface ObservationsTabProps {
  observations: Observation[] | undefined;
}

export function ObservationsTab({ observations }: ObservationsTabProps): JSX.Element {
  const { t } = useTranslation();
  if (!observations || observations.length === 0) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">{t('observationsTab.noObservations')}</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="sm">
      {observations.map((obs) => {
        const hasValue = obs.valueQuantity || obs.valueString || obs.valueBoolean || obs.valueCodeableConcept;
        const referenceRange = obs.referenceRange?.[0];
        
        return (
          <Paper key={obs.id} p="md" withBorder>
            <Group justify="space-between" mb="xs">
              <div className="flex-1">
                <Text fw={500}>{obs.code?.coding?.[0]?.display || obs.code?.text}</Text>
                <Group gap="xs" mt={4}>
                  <Text size="xs" c="dimmed">
                    {obs.effectiveDateTime && formatDateTime(obs.effectiveDateTime)}
                  </Text>
                  {obs.category && (
                    <Badge size="xs" variant="dot">
                      {obs.category[0]?.coding?.[0]?.display || obs.category[0]?.text}
                    </Badge>
                  )}
                </Group>
              </div>
              {hasValue && (
                <div className="text-right">
                  {obs.valueQuantity && (
                    <>
                      <Text size="lg" fw={700}>
                        {obs.valueQuantity.value} {obs.valueQuantity.unit}
                      </Text>
                      {referenceRange && (
                        <Text size="xs" c="dimmed">
                          Range: {referenceRange.low?.value}-{referenceRange.high?.value} {referenceRange.low?.unit}
                        </Text>
                      )}
                    </>
                  )}
                  {obs.valueString && <Text fw={500}>{obs.valueString}</Text>}
                  {obs.valueBoolean !== undefined && (
                    <Badge color={obs.valueBoolean ? 'green' : 'red'}>
                      {obs.valueBoolean ? 'Yes' : 'No'}
                    </Badge>
                  )}
                  {obs.valueCodeableConcept && (
                    <Text fw={500}>
                      {obs.valueCodeableConcept.coding?.[0]?.display || obs.valueCodeableConcept.text}
                    </Text>
                  )}
                </div>
              )}
            </Group>
            {obs.interpretation && (
              <Badge 
                size="sm" 
                variant="light" 
                color={getInterpretationColor(obs.interpretation[0]?.coding?.[0]?.code)}
              >
                {obs.interpretation[0]?.coding?.[0]?.display || obs.interpretation[0]?.text}
              </Badge>
            )}
            {obs.note && obs.note.length > 0 && (
              <Text size="sm" c="dimmed" mt="xs">
                Note: {obs.note[0].text}
              </Text>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}

