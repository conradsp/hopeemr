import { Paper, Title, Tabs, Table, Text, Stack, Badge } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { Patient, Observation } from '@medplum/fhirtypes';
import { Loading, useSearchResources } from '@medplum/react';
import { IconChartLine } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PatientObservations.module.css';

interface PatientObservationsProps {
  patient: Patient;
  observations?: Observation[];
}

export function PatientObservations({ patient, observations: observationsProp }: PatientObservationsProps): JSX.Element {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState<string>('all');

  // Fetch observations if not provided via props
  const [observationsFetched, loading] = useSearchResources('Observation',
    !observationsProp && patient ? {
      patient: `Patient/${patient.id}`,
      _count: '100',
      _sort: '-date'
    } : undefined
  );

  // Use prop if provided, otherwise use fetched data
  const observations = observationsProp || observationsFetched;

  const tabs = [
    ['all', t('observationsTab.all', 'All Observations')],
    ['height', t('observationsTab.height', 'Height')],
    ['weight', t('observationsTab.weight', 'Weight')],
    ['blood-pressure', t('observationsTab.bloodPressure', 'Blood Pressure')],
    ['bmi', t('observationsTab.bmi', 'BMI')],
  ];

  // Filter observations by type
  const filterObservations = (codeFilter?: string): Observation[] => {
    if (!observations) return [];
    if (!codeFilter || codeFilter === 'all') return observations;
    
    return observations.filter(obs => {
      const code = obs.code?.coding?.[0]?.code;
      return code === codeFilter;
    });
  };

  const getObservationValue = (obs: Observation): string => {
    if (obs.valueQuantity) {
      return `${obs.valueQuantity.value} ${obs.valueQuantity.unit || ''}`;
    }
    if (obs.valueString) {
      return obs.valueString;
    }
    if (obs.valueBoolean !== undefined) {
      return obs.valueBoolean ? 'Yes' : 'No';
    }
    if (obs.valueCodeableConcept) {
      return obs.valueCodeableConcept.text || obs.valueCodeableConcept.coding?.[0]?.display || '';
    }
    if (obs.component && obs.component.length > 0) {
      // For multi-component observations like blood pressure
      return obs.component.map(comp => {
        const label = comp.code?.coding?.[0]?.display || '';
        const value = comp.valueQuantity ? `${comp.valueQuantity.value} ${comp.valueQuantity.unit || ''}` : '';
        return `${label}: ${value}`;
      }).join(', ');
    }
    return '-';
  };

  const renderObservationTable = (codeFilter?: string): JSX.Element => {
    const filteredObs = filterObservations(codeFilter);

    if (loading && !observationsProp) {
      return <Loading />;
    }

    if (!filteredObs || filteredObs.length === 0) {
      return (
        <Stack align="center" py="xl">
          <Text c="dimmed">{t('observationsTab.noObservations', 'No observations found')}</Text>
        </Stack>
      );
    }

    return (
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('common.date', 'Date')}</Table.Th>
            <Table.Th>{t('common.type', 'Type')}</Table.Th>
            <Table.Th>{t('common.value', 'Value')}</Table.Th>
            <Table.Th>{t('common.status', 'Status')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filteredObs.map((obs) => (
            <Table.Tr key={obs.id}>
              <Table.Td>
                <Text size="sm">
                  {obs.effectiveDateTime 
                    ? formatDateTime(obs.effectiveDateTime)
                    : obs.effectiveInstant 
                    ? formatDateTime(obs.effectiveInstant)
                    : t('common.dash', '-')}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>
                  {obs.code?.text || obs.code?.coding?.[0]?.display || t('common.unknown', 'Unknown')}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{getObservationValue(obs)}</Text>
              </Table.Td>
              <Table.Td>
                <Badge 
                  color={obs.status === 'final' ? 'green' : obs.status === 'preliminary' ? 'yellow' : 'gray'}
                  variant="light"
                  size="sm"
                >
                  {obs.status}
                </Badge>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder>
      <Title order={4} mb="md">
        <IconChartLine size={20} className={styles.inlineIcon} />
        {t('observationsTab.title', 'Observations')}
      </Title>
      
      <Tabs value={currentTab} onChange={(value) => setCurrentTab(value || 'all')} mt="md">
        <Tabs.List>
          {tabs.map((tab) => (
            <Tabs.Tab key={tab[0]} value={tab[0]}>
              {tab[1]}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="all" pt="md">
          {renderObservationTable('all')}
        </Tabs.Panel>
        <Tabs.Panel value="height" pt="md">
          {renderObservationTable('8302-2')}
        </Tabs.Panel>
        <Tabs.Panel value="weight" pt="md">
          {renderObservationTable('29463-7')}
        </Tabs.Panel>
        <Tabs.Panel value="blood-pressure" pt="md">
          {renderObservationTable('85354-9')}
        </Tabs.Panel>
        <Tabs.Panel value="bmi" pt="md">
          {renderObservationTable('39156-5')}
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
}

