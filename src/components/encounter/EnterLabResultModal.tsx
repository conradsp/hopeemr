import { JSX, useState } from 'react';
import { Modal, Button, Group, Stack, TextInput, Select } from '@mantine/core';
import { LabTestResultField } from '../../utils/labTests';
import { useTranslation } from 'react-i18next';
import styles from './EnterLabResultModal.module.css';

interface EnterLabResultModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  resultFields: LabTestResultField[];
  onSave: (values: Record<string, any>) => void;
}

export function EnterLabResultModal({ opened, onClose, resultFields, onSave }: EnterLabResultModalProps): JSX.Element {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, any>>({});

  const handleChange = (name: string, value: any): void => {
    setValues(v => ({ ...v, [name]: value }));
  };

  const handleSave = (): void => {
    onSave(values);
    onClose(true);
  };

  return (
    <Modal opened={opened} onClose={() => onClose(false)} title={t('orders.enterLabResults')} size="lg">
      <Stack gap="md">
        {resultFields.map((field) => (
          <Group key={field.name}>
            <TextInput
              label={field.label}
              value={values[field.name] ?? ''}
              onChange={e => handleChange(field.name, e.currentTarget.value)}
              placeholder={field.unit ? t('orders.valueWithUnit', { unit: field.unit }) : t('orders.value')}
              type={field.type === 'number' ? 'number' : 'text'}
              className={styles.inputField}
            />
            {field.unit && <span className={styles.unitLabel}>{field.unit}</span>}
            {field.type === 'select' && (
              <Select
                label={field.label}
                data={field.options?.map(opt => ({ value: opt, label: opt })) || []}
                value={values[field.name] ?? ''}
                onChange={val => handleChange(field.name, val)}
                className={styles.inputField}
              />
            )}
          </Group>
        ))}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('common.saveResults')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
