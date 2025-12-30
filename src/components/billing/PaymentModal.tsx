import { Modal, Stack, Group, Button, NumberInput, Select, Textarea } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useMedplum } from '@medplum/react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { recordPayment } from '../../utils/billing';
import { handleError, showSuccess, validateRequired } from '../../utils/errorHandling';

interface PaymentModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  patientId?: string;
  encounterId?: string;
}

export function PaymentModal({ opened, onClose, patientId, encounterId }: PaymentModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<string>('cash');
  const [date, setDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');

  const paymentMethods = [
    { value: 'cash', label: t('billing.method.cash') },
    { value: 'credit', label: t('billing.method.credit') },
    { value: 'debit', label: t('billing.method.debit') },
    { value: 'check', label: t('billing.method.check') },
    { value: 'insurance', label: t('billing.method.insurance') },
    { value: 'other', label: t('billing.method.other') },
  ];

  const handleSave = async (): Promise<void> => {
    // Validation
    const validationErrors = validateRequired({
      [t('billing.amount')]: amount,
      [t('billing.paymentMethod')]: method,
      [t('billing.paymentDate')]: date,
    });

    if (validationErrors.length > 0) {
      handleError(new Error(validationErrors.join(', ')), 'validating payment');
      return;
    }

    if (amount <= 0) {
      handleError(new Error(t('billing.amountRequired')), 'validating payment amount');
      return;
    }

    if (!patientId) {
      handleError(new Error(t('billing.patientRequired')), 'validating payment');
      return;
    }

    setLoading(true);
    try {
      await recordPayment(medplum, patientId, encounterId, {
        amount,
        method: method as 'cash' | 'credit-card' | 'debit-card' | 'check' | 'insurance' | 'other',
        date: date.toISOString(),
        notes,
      });

      showSuccess(t('billing.paymentRecorded'));
      handleClose(true);
    } catch (error) {
      handleError(error, 'recording payment');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (saved: boolean = false): void => {
    // Reset form
    setAmount(0);
    setMethod('cash');
    setDate(new Date());
    setNotes('');
    onClose(saved);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => handleClose(false)}
      title={t('billing.addPayment')}
      size="md"
    >
      <Stack gap="md">
        <NumberInput
          label={t('billing.amount')}
          value={amount}
          onChange={(value) => setAmount(Number(value) || 0)}
          required
          min={0}
          decimalScale={2}
          fixedDecimalScale
          prefix="$"
          placeholder="0.00"
        />

        <Select
          label={t('billing.paymentMethod')}
          data={paymentMethods}
          value={method}
          onChange={(value) => setMethod(value || 'cash')}
          required
        />

        <DateTimePicker
          label={t('billing.paymentDate')}
          value={date}
          onChange={(value) => setDate(value || new Date())}
          required
        />

        <Textarea
          label={t('billing.paymentNotes')}
          placeholder={t('billing.paymentNotesPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          rows={3}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => handleClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={loading}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

