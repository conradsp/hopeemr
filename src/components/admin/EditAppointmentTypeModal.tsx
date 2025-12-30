import { Modal, TextInput, Button, Group, Stack, Textarea, NumberInput, ColorInput } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { IconCheck } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppointmentTypeDefinition, saveAppointmentType } from '../../utils/appointmentTypes';
import { showSuccess, handleError } from '../../utils/errorHandling';

interface EditAppointmentTypeModalProps {
  opened: boolean;
  onClose: () => void;
  appointmentType: AppointmentTypeDefinition | null;
}

export function EditAppointmentTypeModal({ 
  opened, 
  onClose, 
  appointmentType 
}: EditAppointmentTypeModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    duration: 30,
    description: '',
    color: '#2196F3',
    visitFee: 0,
  });

  useEffect(() => {
    if (appointmentType) {
      setFormData({
        code: appointmentType.code,
        display: appointmentType.display,
        duration: appointmentType.duration,
        description: appointmentType.description || '',
        color: appointmentType.color || '#2196F3',
        visitFee: appointmentType.visitFee || 0,
      });
    } else {
      setFormData({
        code: '',
        display: '',
        duration: 30,
        description: '',
        color: '#2196F3',
        visitFee: 0,
      });
    }
  }, [appointmentType, opened]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await saveAppointmentType(medplum, formData);
      showSuccess(t('message.success.saved'));
      onClose();
    } catch (error) {
      handleError(error, t('message.error.save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={appointmentType ? t('admin.appointmentTypes.edit') : t('admin.appointmentTypes.create')}
      size="md"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label={t('admin.appointmentTypes.code')}
            placeholder={t('admin.appointmentTypes.codePlaceholder')}
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.currentTarget.value.toLowerCase().replace(/\s+/g, '-') })}
            description={appointmentType ? t('admin.appointmentTypes.codeDisabled') : t('admin.appointmentTypes.codeDescription')}
            disabled={!!appointmentType}
          />

          <TextInput
            label={t('admin.appointmentTypes.displayName')}
            placeholder={t('admin.appointmentTypes.displayPlaceholder')}
            required
            value={formData.display}
            onChange={(e) => setFormData({ ...formData, display: e.currentTarget.value })}
          />

          <NumberInput
            label={t('admin.appointmentTypes.duration')}
            placeholder={t('admin.appointmentTypes.durationPlaceholder')}
            required
            min={5}
            max={480}
            step={5}
            value={formData.duration}
            onChange={(value) => setFormData({ ...formData, duration: Number(value) || 30 })}
          />

          <Textarea
            label={t('common.description')}
            placeholder={t('admin.appointmentTypes.descriptionPlaceholder')}
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />

          <ColorInput
            label={t('admin.appointmentTypes.color')}
            placeholder={t('common.selectStatus')}
            value={formData.color}
            onChange={(value) => setFormData({ ...formData, color: value })}
            format="hex"
            swatches={[
              '#4CAF50', '#2196F3', '#9C27B0', '#00BCD4', '#FF5722',
              '#FF9800', '#E91E63', '#607D8B', '#8BC34A', '#3F51B5',
              '#795548', '#009688', '#FFC107', '#F44336', '#673AB7',
            ]}
          />

          <NumberInput
            label={t('admin.appointmentTypes.visitFee')}
            value={formData.visitFee}
            onChange={(value) => setFormData({ ...formData, visitFee: Number(value) || 0 })}
            min={0}
            decimalScale={2}
            prefix="$"
            placeholder="0.00"
            description={t('billing.visitFee')}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconCheck size={16} />}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

