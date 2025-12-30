import { Modal, TextInput, Button, Group, Stack, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Patient, Coverage } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconShieldCheck } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AddInsuranceModalProps {
  opened: boolean;
  onClose: () => void;
  patient: Patient;
  onSuccess?: () => void;
}

export function AddInsuranceModal({ opened, onClose, patient, onSuccess }: AddInsuranceModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    payorName: '',
    memberId: '',
    groupNumber: '',
    type: 'medical',
    status: 'active',
  });

  const handleChange = (field: string, value: string | null): void => {
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get display name for coverage type
      let typeDisplay = 'Medical';
      if (formData.type === 'dental') {
        typeDisplay = 'Dental';
      } else if (formData.type === 'vision') {
        typeDisplay = 'Vision';
      }

      const coverage: Coverage = {
        resourceType: 'Coverage',
        status: formData.status as 'active' | 'cancelled' | 'draft' | 'entered-in-error',
        beneficiary: {
          reference: `Patient/${patient.id}`,
          display: patient.name?.[0]?.text || patient.name?.[0]?.family,
        },
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
              code: formData.type,
              display: typeDisplay,
            },
          ],
        },
        payor: [
          {
            display: formData.payorName,
          },
        ],
        subscriberId: formData.memberId,
        class: formData.groupNumber ? [
          {
            type: {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                  code: 'group',
                },
              ],
            },
            value: formData.groupNumber,
          },
        ] : undefined,
      };

      await medplum.createResource(coverage);
      
      // Reset form
      setFormData({
        payorName: '',
        memberId: '',
        groupNumber: '',
        type: 'medical',
        status: 'active',
      });
      
      notifications.show({
        title: t('success'),
        message: t('patient.insuranceSuccess'),
        color: 'green',
      });
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch {
      notifications.show({
        title: t('error'),
        message: t('patient.insuranceError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('patient.addInsurance')} centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label={t('insurance.company')}
            placeholder={t('insurance.companyPlaceholder')}
            required
            value={formData.payorName}
            onChange={(event) => handleChange('payorName', event.currentTarget.value)}
          />

          <TextInput
            label={t('insurance.memberId')}
            placeholder="ABC123456789"
            required
            value={formData.memberId}
            onChange={(event) => handleChange('memberId', event.currentTarget.value)}
          />

          <TextInput
            label={t('insurance.groupNumber')}
            placeholder="GRP001"
            value={formData.groupNumber}
            onChange={(event) => handleChange('groupNumber', event.currentTarget.value)}
          />

          <Select
            label={t('insurance.type')}
            placeholder={t('insurance.selectType')}
            required
            data={[
              { value: 'medical', label: t('insurance.medical') },
              { value: 'dental', label: t('insurance.dental') },
              { value: 'vision', label: t('insurance.vision') },
            ]}
            value={formData.type}
            onChange={(value) => handleChange('type', value)}
          />

          <Select
            label={t('common.status')}
            placeholder={t('common.selectStatus')}
            required
            data={[
              { value: 'active', label: t('insurance.status.active') },
              { value: 'cancelled', label: t('insurance.status.cancelled') },
            ]}
            value={formData.status}
            onChange={(value) => handleChange('status', value)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconShieldCheck size={16} />}>
              {t('patient.addInsuranceButton')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

