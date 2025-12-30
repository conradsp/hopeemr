import { Paper, Group, Text, Badge, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface BillingSummaryCardProps {
  totalCharges: number;
  totalPayments: number;
  balance: number;
  onAddPayment: () => void;
  disabled?: boolean;
}

/**
 * Display billing summary with totals and action button
 */
export function BillingSummaryCard({
  totalCharges,
  totalPayments,
  balance,
  onAddPayment,
  disabled = false,
}: BillingSummaryCardProps): JSX.Element {
  const { t } = useTranslation();

  const getStatusColor = (bal: number): string => {
    if (bal === 0) return 'green';
    if (bal > 0) return totalPayments > 0 ? 'yellow' : 'red';
    return 'gray';
  };

  const getStatusLabel = (bal: number): string => {
    if (bal === 0) return t('billing.paid');
    if (bal > 0) return totalPayments > 0 ? t('billing.partiallyPaid') : t('billing.unpaid');
    return '';
  };

  return (
    <Paper p="md" withBorder mb="md" bg="gray.0">
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed">{t('billing.totalCharges')}</Text>
          <Text size="xl" fw={700}>${totalCharges.toFixed(2)}</Text>
        </div>
        <div>
          <Text size="sm" c="dimmed">{t('billing.totalPayments')}</Text>
          <Text size="xl" fw={700} c="green">${totalPayments.toFixed(2)}</Text>
        </div>
        <div>
          <Text size="sm" c="dimmed">{t('billing.outstandingBalance')}</Text>
          <Group gap="xs">
            <Text size="xl" fw={700} c={balance > 0 ? 'red' : 'green'}>
              ${balance.toFixed(2)}
            </Text>
            <Badge color={getStatusColor(balance)}>
              {getStatusLabel(balance)}
            </Badge>
          </Group>
        </div>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={onAddPayment}
          disabled={disabled}
        >
          {t('billing.addPayment')}
        </Button>
      </Group>
    </Paper>
  );
}

