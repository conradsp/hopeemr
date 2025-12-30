import { Paper, Text, Badge, Group, Stack, Accordion } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { Observation } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { groupObservationsByTime, getInterpretationColor } from '../../../utils/encounterUtils';
import { useTranslation } from 'react-i18next';

interface VitalsTabProps {
  vitals: Observation[] | undefined;
}

export function VitalsTab({ vitals }: VitalsTabProps): JSX.Element {
  const { t } = useTranslation();
  if (!vitals || vitals.length === 0) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">{t('vitalsTab.noVitals', 'No vitals recorded for this encounter')}</Text>
      </Paper>
    );
  }

  const groupedVitals = groupObservationsByTime(vitals);

  return (
    <Accordion variant="separated">
      {Object.entries(groupedVitals).sort(([a], [b]) => b.localeCompare(a)).map(([timestamp, vitalGroup]) => {
        const displayTime = timestamp !== 'Unknown' 
          ? formatDateTime(vitalGroup[0].effectiveDateTime || '')
          : 'Unknown Time';
        
        // Create summary of vitals in this group
        const summary: string[] = [];
        vitalGroup.forEach(obs => {
          if (obs.component && obs.component.length > 0) {
            // Blood pressure
            const systolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8480-6');
            const diastolic = obs.component.find(c => c.code?.coding?.[0]?.code === '8462-4');
            if (systolic && diastolic) {
              summary.push(`BP: ${systolic.valueQuantity?.value}/${diastolic.valueQuantity?.value}`);
            }
          } else if (obs.valueQuantity) {
            const label = obs.code?.coding?.[0]?.display?.split(' ')[0] || obs.code?.text || 'Value';
            summary.push(`${label}: ${obs.valueQuantity.value}${obs.valueQuantity.unit}`);
          }
        });

        return (
          <Accordion.Item key={timestamp} value={timestamp}>
            <Accordion.Control>
              <Group justify="space-between" pr="md">
                <div>
                  <Text fw={500}>{displayTime}</Text>
                  <Text size="xs" c="dimmed">{vitalGroup.length} measurement{vitalGroup.length !== 1 ? 's' : ''}</Text>
                </div>
                <Text size="sm" c="dimmed">{summary.join(' • ')}</Text>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                {vitalGroup.map((obs) => {
                  const hasValue = obs.valueQuantity || obs.valueString || obs.valueBoolean || 
                                  obs.valueCodeableConcept || obs.component;
                  const referenceRange = obs.referenceRange?.[0];
                  
                  return (
                    <Paper key={obs.id} p="sm" withBorder bg="gray.0">
                      <Group justify="space-between">
                        <div className="flex-1">
                          <Text size="sm" fw={500}>
                            {obs.code?.coding?.[0]?.display || obs.code?.text || 'Unknown Vital'}
                          </Text>
                          {obs.status && (
                            <Badge size="xs" variant="light" mt={4}>
                              {obs.status}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          {obs.valueQuantity && (
                            <>
                              <Text size="lg" fw={700} c="blue">
                                {obs.valueQuantity.value} {obs.valueQuantity.unit}
                              </Text>
                              {referenceRange && (
                                <Text size="xs" c="dimmed">
                                  Normal: {referenceRange.low?.value}-{referenceRange.high?.value}
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
                          {!hasValue && (
                            <Text size="sm" c="dimmed">No value</Text>
                          )}
                        </div>
                      </Group>
                      
                      {/* Multi-component observations */}
                      {obs.component && obs.component.length > 0 && (
                        <Stack gap="xs" mt="sm" pl="md">
                          {obs.component.map((comp, idx) => (
                            <Group key={idx} justify="space-between">
                              <Text size="sm" c="dimmed">
                                {comp.code?.coding?.[0]?.display || comp.code?.text}
                              </Text>
                              <Text size="md" fw={600} c="blue">
                                {comp.valueQuantity?.value} {comp.valueQuantity?.unit}
                              </Text>
                            </Group>
                          ))}
                        </Stack>
                      )}
                      
                      {obs.interpretation && (
                        <Badge 
                          size="sm" 
                          variant="light" 
                          color={getInterpretationColor(obs.interpretation[0]?.coding?.[0]?.code)}
                          mt="xs"
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
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion>
  );
}

