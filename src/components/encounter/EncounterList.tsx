import { Table, Text, Badge } from '@mantine/core';
import { getDisplayString } from '@medplum/core';
import { Encounter } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface EncounterListProps {
  encounters: Encounter[];
}

export function EncounterList({ encounters }: EncounterListProps): JSX.Element {
  const { t } = useTranslation();
  const rows = encounters.map((encounter) => (
    <Table.Tr key={encounter.id}>
      <Table.Td>
        <Text fw={500}>{getDisplayString(encounter)}</Text>
      </Table.Td>
      <Table.Td>{encounter.period?.start}</Table.Td>
      <Table.Td>{encounter.class?.display}</Table.Td>
      <Table.Td>
        <Badge>{t(`encounter.status.${encounter.status}`)}</Badge>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('encounter.type')}</Table.Th>
          <Table.Th>{t('encounter.date')}</Table.Th>
          <Table.Th>{t('encounter.class')}</Table.Th>
          <Table.Th>{t('encounter.status.label')}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
}

