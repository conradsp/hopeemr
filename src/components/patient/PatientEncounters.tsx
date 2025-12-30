import { Table, Text, Badge, Stack } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { Patient, Encounter } from '@medplum/fhirtypes';
import { Loading, useSearchResources } from '@medplum/react';
import { JSX } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './PatientEncounters.module.css';

interface PatientEncountersProps {
  patient: Patient;
  encounters?: Encounter[];
}

export function PatientEncounters({ patient, encounters: encountersProp }: PatientEncountersProps): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [encountersFetched, loading] = useSearchResources('Encounter', 
    !encountersProp && patient ? {
      patient: `Patient/${patient.id}`,
      _count: '50',
    } : undefined
  );

  // Use prop if provided, otherwise use fetched data
  const encounters = encountersProp || encountersFetched;

  if (loading) {
    return <Loading />;
  }

  if (!encounters || encounters.length === 0) {
    return (
      <div className={styles.emptyState}>
        {t('encounter.noneFound', 'No encounters found')}
      </div>
    );
  }

  return (
    <Stack gap="md">
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('common.date', 'Date')}</Table.Th>
            <Table.Th>{t('common.type', 'Type')}</Table.Th>
            <Table.Th>{t('common.class', 'Class')}</Table.Th>
            <Table.Th>{t('common.status', 'Status')}</Table.Th>
            <Table.Th>{t('common.reason', 'Reason')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {encounters.map((encounter) => {
            const encounterDate = encounter.period?.start || encounter.period?.end;
            const encounterType = encounter.type?.[0]?.coding?.[0]?.display || 
                                 encounter.type?.[0]?.text || 
                                 t('common.unknown', 'Unknown');
            const encounterClass = encounter.class?.display || encounter.class?.code || t('common.dash', '-');
            const reason = encounter.reasonCode?.[0]?.coding?.[0]?.display || 
                          encounter.reasonCode?.[0]?.text ||
                          encounter.type?.[0]?.coding?.[0]?.display ||
                          t('common.dash', '-');
            return (
              <Table.Tr 
                key={encounter.id}
                onClick={() => navigate(`/Encounter/${encounter.id}`)}
                className={styles.clickableRow}
              >
                <Table.Td>
                  <Text size="sm">
                    {encounterDate ? formatDateTime(encounterDate) : t('common.dash', '-')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {encounterType}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{encounterClass}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge 
                    color={encounter.status === 'finished' ? 'green' : 'blue'}
                    variant="light"
                    size="sm"
                  >
                    {t(`encounter.status.${encounter.status}`, encounter.status)}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {reason}
                  </Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

