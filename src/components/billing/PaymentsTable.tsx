import { Table, Text, Title, Badge } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { PaymentRecord } from '../../utils/billing';

interface PaymentsTableProps {
  payments: PaymentRecord[];
}

/**
 * Display table of payments
 */
export function PaymentsTable({ payments }: PaymentsTableProps): JSX.Element {
  const { t } = useTranslation();

  if (payments.length === 0) {
    return <></>;
  }

  return (
    <>
      <Title order={4} mb="md">{t('billing.payments')}</Title>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t('billing.paymentDate')}</Table.Th>
            <Table.Th>{t('billing.amount')}</Table.Th>
            <Table.Th>{t('billing.paymentMethod')}</Table.Th>
            <Table.Th>{t('billing.paymentNotes')}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {payments.map((payment, index) => (
            <Table.Tr key={index}>
              <Table.Td>{formatDateTime(payment.date)}</Table.Td>
              <Table.Td>
                <Text fw={500} c="green">${payment.amount.toFixed(2)}</Text>
              </Table.Td>
              <Table.Td>
                <Badge>{t(`billing.method.${payment.method}`)}</Badge>
              </Table.Td>
              <Table.Td>{payment.notes || '-'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
}

