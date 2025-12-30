import { Grid, Paper, Title, Text, Stack, Badge, Group, Divider, Accordion } from '@mantine/core';
import { formatDate } from '@medplum/core';
import { Patient, Observation } from '@medplum/fhirtypes';
import { Loading, useSearchResources } from '@medplum/react';
import { IconAlertCircle, IconMicroscope, IconStethoscope, IconHeartbeat } from '@tabler/icons-react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PatientOverview.module.css';

interface PatientOverviewProps {
  patient: Patient;
}

export function PatientOverview({ patient }: PatientOverviewProps): JSX.Element {
  // Search for clinical data
  const [allergies] = useSearchResources('AllergyIntolerance', {
    patient: `Patient/${patient.id}`,
    _count: '10'
  });

  const [conditions] = useSearchResources('Condition', {
    patient: `Patient/${patient.id}`,
    _count: '10'
  });

  const [observations] = useSearchResources('Observation', {
    patient: `Patient/${patient.id}`,
    _count: '500'
  });

  const [serviceRequests] = useSearchResources('ServiceRequest', {
    patient: `Patient/${patient.id}`,
    _count: '10'
  });

  const [documents] = useSearchResources('DocumentReference', {
    patient: `Patient/${patient.id}`,
    _count: '50'
  });

  // Filter lab results - check both undefined and empty cases
  const labs = observations === undefined ? undefined : observations.filter((obs) => {
    const category = obs.category?.[0]?.coding?.[0]?.code;
    return category === 'laboratory';
  });

  // Helper to get results for a given order
  const getOrderResults = (order: any): Observation[] => {
    if (!observations) { return []; }
    const orderRef = order.id ? `ServiceRequest/${order.id}` : undefined;
    const encounterRef = order.encounter?.reference;
    return observations.filter(obs =>
      (orderRef && obs.basedOn?.[0]?.reference === orderRef) &&
      (encounterRef ? obs.encounter?.reference === encounterRef : true)
    );
  };

  const { t } = useTranslation();

  return (
    <Grid>
      {/* Allergies */}
      <Grid.Col span={6}>
        <Paper shadow="sm" p="md" withBorder>
          <Group mb="sm">
            <IconAlertCircle size={20} color="#fa5252" />
            <Title order={4}>{t('patientOverview.allergies')}</Title>
          </Group>
          <Divider mb="sm" />
          {allergies === undefined && <Loading />}
          {allergies !== undefined && allergies.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">{t('patientOverview.noneReported')}</Text>
          )}
          {allergies !== undefined && allergies.length > 0 && (
            <Stack gap="xs">
              {allergies.slice(0, 5).map((allergy) => (
                <Paper key={allergy.id} p="xs" bg="red.0" radius="sm">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {allergy.code?.coding?.[0]?.display || allergy.code?.text || 'Unknown'}
                      </Text>
                      {allergy.reaction?.[0]?.manifestation?.[0] && (
                        <Text size="xs" c="dimmed">
                          {allergy.reaction[0].manifestation[0]?.coding?.[0]?.display || allergy.reaction[0].manifestation[0]?.text}
                        </Text>
                      )}
                    </div>
                    {allergy.criticality && (
                      <Badge size="sm" color={(function() {
                        if (allergy.criticality === 'high') { return 'red'; }
                        if (allergy.criticality === 'low') { return 'yellow'; }
                        return 'gray';
                      })()}>
                        {allergy.criticality}
                      </Badge>
                    )}
                  </Group>
                </Paper>
              ))}
              {allergies.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">+ {allergies.length - 5} {t('patientOverview.more')}</Text>
              )}
            </Stack>
          )}
        </Paper>
      </Grid.Col>

      {/* Diagnoses */}
      <Grid.Col span={6}>
        <Paper shadow="sm" p="md" withBorder>
          <Group mb="sm">
            <IconStethoscope size={20} color="#7950f2" />
            <Title order={4}>{t('patientOverview.activeDiagnoses')}</Title>
          </Group>
          <Divider mb="sm" />
          {conditions === undefined && <Loading />}
          {conditions !== undefined && conditions.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">{t('patientOverview.noneReported')}</Text>
          )}
          {conditions !== undefined && conditions.length > 0 && (
            <Stack gap="xs">
              {conditions.slice(0, 5).map((condition) => (
                <Paper key={condition.id} p="xs" bg="grape.0" radius="sm">
                  <Group justify="space-between">
                    <div>
                      <Text size="sm" fw={500}>
                        {condition.code?.coding?.[0]?.display || condition.code?.text || t('common.unknown', 'Unknown')}
                      </Text>
                      {condition.onsetDateTime && (
                        <Text size="xs" c="dimmed">
                          {t('patientOverview.since')}: {formatDate(condition.onsetDateTime)}
                        </Text>
                      )}
                    </div>
                    {condition.severity && (
                      <Badge size="sm" variant="light">
                        {condition.severity.coding?.[0]?.display || condition.severity.text}
                      </Badge>
                    )}
                  </Group>
                </Paper>
              ))}
              {conditions.length > 5 && (
                <Text size="xs" c="dimmed" ta="center">+ {conditions.length - 5} {t('patientOverview.more')}</Text>
              )}
            </Stack>
          )}
        </Paper>
      </Grid.Col>

      {/* Vitals */}
      <Grid.Col span={6}>
        <Paper shadow="sm" p="xs" withBorder>
          <Group mb={4} gap={4}>
            <IconHeartbeat size={18} color="#e64980" />
            <Title order={4} className={styles.vitalsTitle}>{t('patientOverview.recentVitals')}</Title>
          </Group>
          <Divider mb={4} />
          {observations === undefined && <Loading />}
          {observations !== undefined && (() => {
            const vitals = observations.filter((obs) => obs.category?.[0]?.coding?.[0]?.code === 'vital-signs');
            if (vitals.length === 0) {
              return <Text size="xs" c="dimmed" ta="center" py={4}>{t('patientOverview.noneReported')}</Text>;
            }
            return (
              <Stack gap={2}>
                {vitals.slice(0, 5).map((vital) => (
                  <Group key={vital.id} justify="space-between" p={2} gap={2}>
                    <Text size="xs" className={styles.vitalText}>
                      {vital.code?.coding?.[0]?.display || vital.code?.text || t('common.unknown', 'Unknown')}
                    </Text>
                    <Group gap={2}>
                      {vital.valueQuantity && (
                        <Text size="xs" fw={600} className={styles.vitalText}>
                          {vital.valueQuantity.value} {vital.valueQuantity.unit}
                        </Text>
                      )}
                      {vital.component && vital.component.length > 0 && (
                        <Text size="xs" fw={600} className={styles.vitalText}>
                          {vital.component.map(c => `${c.valueQuantity?.value}${c.valueQuantity?.unit}`).join('/')}
                        </Text>
                      )}
                      {vital.effectiveDateTime && (
                        <Text size="xs" c="dimmed" className={styles.vitalText}>
                          {formatDate(vital.effectiveDateTime)}
                        </Text>
                      )}
                    </Group>
                  </Group>
                ))}
                {/* Show weight and height if present, after first 5 vitals */}
                {(() => {
                  const vitals = observations.filter((obs) => obs.category?.[0]?.coding?.[0]?.code === 'vital-signs');
                  const weight = vitals.find(v => v.code?.coding?.[0]?.code === '29463-7');
                  const height = vitals.find(v => v.code?.coding?.[0]?.code === '8302-2');
                  return [weight, height].filter((v): v is typeof weight => !!v).map((vital) => (
                    vital ? (
                      <Group key={vital.id} justify="space-between" p={2} gap={2}>
                        <Text size="xs" className={styles.vitalText}>
                          {vital.code?.coding?.[0]?.display || vital.code?.text}
                        </Text>
                        <Group gap={2}>
                          {vital.valueQuantity && (
                            <Text size="xs" fw={600} className={styles.vitalText}>
                              {vital.valueQuantity.value} {vital.valueQuantity.unit}
                            </Text>
                          )}
                          {vital.effectiveDateTime && (
                            <Text size="xs" c="dimmed" className={styles.vitalText}>
                              {formatDate(vital.effectiveDateTime)}
                            </Text>
                          )}
                        </Group>
                      </Group>
                    ) : null
                  ));
                })()}
              </Stack>
            );
          })()}
        </Paper>
      </Grid.Col>

      {/* Recent Lab & Imaging Orders/Results - move to right half below diagnoses */}
      <Grid.Col span={6}>
        <Paper shadow="sm" p="md" withBorder>
          <Group mb="sm">
            <IconMicroscope size={20} color="#fd7e14" />
            <Title order={4}>{t('patientOverview.recentLabImaging')}</Title>
          </Group>
          <Divider mb="sm" />
          {(serviceRequests === undefined || labs === undefined) && <Loading />}
          {(serviceRequests !== undefined && labs !== undefined && serviceRequests.length === 0) && (
            <Text size="sm" c="dimmed" ta="center" py="md">{t('patientOverview.noOrders')}</Text>
          )}
          {(serviceRequests !== undefined && labs !== undefined && serviceRequests.length > 0) && (
            <Accordion>
              {serviceRequests.slice(0, 8).map((sr) => {
                const isLab = sr.category?.[0]?.coding?.[0]?.code === '108252007';
                const categoryLabel = isLab ? 'Lab' : 'Imaging';
                const results = getOrderResults(sr);
                // Status badge color
                let statusColor = 'gray';
                if (typeof sr.status === 'string') {
                  if (sr.status === 'completed') { statusColor = 'green'; }
                  else if (sr.status === 'active') { statusColor = 'blue'; }
                  else if (sr.status === 'on-hold') { statusColor = 'yellow'; }
                }
                return (
                  <Accordion.Item key={sr.id} value={sr.id || ''}>
                    <Accordion.Control>
                      <Group gap="xs">
                        <Badge size="xs" color={isLab ? 'blue' : 'grape'}>{t(`orders.${isLab ? 'lab' : 'imaging'}`)}</Badge>
                        <Badge size="xs" color={statusColor} variant="light">{t(`orders.status.${sr.status}`, sr.status)}</Badge>
                        {sr.priority && sr.priority !== 'routine' && (
                          <Badge color="red" variant="filled" size="xs">{sr.priority.toUpperCase()}</Badge>
                        )}
                        <Text size="sm" fw={500}>{sr.code?.coding?.[0]?.display || sr.code?.text || t('orders.orderDiagnostic', 'Order')}</Text>
                        {sr.authoredOn && (
                          <Text size="xs" c="dimmed">{t('patientOverview.ordered')}: {formatDate(sr.authoredOn)}</Text>
                        )}
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {results.length > 0 && (
                        <Stack gap="xs">
                          {results.map((obs, idx) => (
                            <Group key={idx} gap="xs">
                              <Text fw={500}>{obs.code?.text || t('common.unknown', 'Unknown')}</Text>
                              {obs.valueQuantity && (
                                <Text>{obs.valueQuantity.value} {obs.valueQuantity.unit}</Text>
                              )}
                              {obs.valueString && (
                                <Text>{obs.valueString}</Text>
                              )}
                              {obs.valueBoolean !== undefined && (
                                <Text>{obs.valueBoolean ? t('common.yes', 'Yes') : t('common.no', 'No')}</Text>
                              )}
                              {obs.valueCodeableConcept && (
                                <Text>{obs.valueCodeableConcept.text}</Text>
                              )}
                            </Group>
                          ))}
                        </Stack>
                      )}
                      {results.length === 0 && !isLab && documents && documents.some(doc => doc.context?.related?.some(r => r.reference === `ServiceRequest/${sr.id}`)) && (
                        <Text size="xs" c="green" mt={4}>Images uploaded</Text>
                      )}
                      {results.length === 0 && (isLab || !(documents && documents.some(doc => doc.context?.related?.some(r => r.reference === `ServiceRequest/${sr.id}`)))) && (
                        <Text size="xs" c="dimmed" mt={4}>{t('patientOverview.resultsPending')}</Text>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                );
              })}
            </Accordion>
          )}
        </Paper>
      </Grid.Col>

    </Grid>
  );
}

