import { Table, Text, Title, Paper } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { ChargeItemSummary } from '../../utils/billing';

interface ChargesTableProps {
  charges: ChargeItemSummary[];
}

/**
 * Display table of charges
 */
export function ChargesTable({ charges }: ChargesTableProps): JSX.Element {
  const { t } = useTranslation();

  if (charges.length === 0) {
    return (
      <>
        <Title order={4} mb="md">{t('billing.charges')}</Title>
        <Paper p="xl" withBorder bg="gray.0" mb="md">
          <Text ta="center" c="dimmed">{t('billing.noCharges')}</Text>
        </Paper>
      </>
    );
  }

  return (
    <>
      <Title order={4} mb="md">{t('billing.charges')}</Title>
      <Table striped highlightOnHover mb="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('billing.serviceDescription')}</Table.Th>
            <Table.Th>{t('billing.serviceDate')}</Table.Th>
            <Table.Th>{t('billing.quantity')}</Table.Th>
            <Table.Th>{t('billing.pricePerUnit')}</Table.Th>
            <Table.Th>{t('billing.total')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {charges.map((charge) => (
            <Table.Tr key={charge.id}>
              <Table.Td>{charge.description || charge.code?.text}</Table.Td>
              <Table.Td>
                {charge.occurrenceDateTime ? formatDateTime(charge.occurrenceDateTime) : '-'}
              </Table.Td>
              <Table.Td>{charge.quantity?.value || 1}</Table.Td>
              <Table.Td>${(charge.unitPrice || 0).toFixed(2)}</Table.Td>
              <Table.Td>
                <Text fw={500}>${(charge.totalPrice || 0).toFixed(2)}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

