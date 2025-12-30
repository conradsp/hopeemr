import { Modal, Button, Group, Stack, Select, Textarea, NumberInput, Radio } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Encounter, Patient, Medication, MedicationRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconPill } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMedications, PrescriptionFormData } from '../../utils/medications';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { useOfflineMutation } from '../../offline';

interface PrescribeMedicationModalProps {
  opened: boolean;
  onClose: (saved?: boolean) => void;
  encounter: Encounter;
  patient: Patient;
}

export function PrescribeMedicationModal({ opened, onClose, encounter, patient }: PrescribeMedicationModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const { createResource } = useOfflineMutation();
  const [loading, setLoading] = useState(false);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [formData, setFormData] = useState<PrescriptionFormData>({
    medicationId: '',
    dosageInstruction: '',
    quantity: 30,
    refills: 0,
    isPrescriptionType: 'external',
    notes: '',
  });

  useEffect(() => {
    if (opened) {
      loadMedications();
    }
  }, [opened, medplum]);

  const loadMedications = async (): Promise<void> => {
    try {
      const meds = await getMedications(medplum);
      setMedications(meds);
    } catch (error) {
      handleError(error, 'loading medications');
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!formData.medicationId) {
      notifications.show({
        title: t('validationError'),
        message: t('pharmacy.selectMedication'),
        color: 'red',
      });
      return;
    }

    if (!formData.dosageInstruction) {
      notifications.show({
        title: t('validationError'),
        message: t('pharmacy.dosageInstructions') + ' ' + t('common.required'),
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      // Find selected medication for display name
      const selectedMed = medications.find(m => m.id === formData.medicationId);
      const medicationDisplay = selectedMed?.code?.coding?.[0]?.display || selectedMed?.code?.text || 'Medication';

      // Build MedicationRequest resource
      const medicationRequest: MedicationRequest = {
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: formData.isPrescriptionType === 'external' ? 'order' : 'instance-order',
        medicationReference: {
          reference: `Medication/${formData.medicationId}`,
          display: medicationDisplay,
        },
        subject: {
          reference: `Patient/${patient.id}`,
        },
        encounter: {
          reference: `Encounter/${encounter.id}`,
        },
        authoredOn: new Date().toISOString(),
        requester: {
          reference: `${medplum.getProfile()?.resourceType}/${medplum.getProfile()?.id}`,
        },
        dosageInstruction: [
          {
            text: formData.dosageInstruction,
          },
        ],
        dispenseRequest: {
          quantity: {
            value: formData.quantity,
            unit: 'tablets',
          },
          numberOfRepeatsAllowed: formData.refills,
        },
        note: formData.notes ? [{ text: formData.notes }] : undefined,
      };

      // Create with offline support
      const result = await createResource(medicationRequest, 'MedicationRequest');

      if (result.isQueued) {
        notifications.show({
          title: t('pharmacy.savedOfflineTitle', 'Prescription Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
        });
      } else {
        showSuccess(t('pharmacy.prescribeSuccess'));
      }

      // Reset form
      setFormData({
        medicationId: '',
        dosageInstruction: '',
        quantity: 30,
        refills: 0,
        isPrescriptionType: 'external',
        notes: '',
      });

      onClose(true);
    } catch (error) {
      handleError(error, 'creating prescription');
    } finally {
      setLoading(false);
    }
  };

  const medicationOptions = medications.map(med => ({
    value: med.id || '',
    label: `${med.code?.text || med.code?.coding?.[0]?.display} - ${med.amount?.numerator?.value}${med.amount?.numerator?.unit} ${med.form?.coding?.[0]?.display || ''}`,
  }));

  return (
    <Modal
      opened={opened}
      onClose={() => onClose(false)}
      title={t('pharmacy.prescribeTitle')}
      size="lg"
    >
      <Stack>
        <Select
          label={t('pharmacy.selectMedication')}
          placeholder={t('pharmacy.selectMedication')}
          data={medicationOptions}
          value={formData.medicationId}
          onChange={(value) => setFormData({ ...formData, medicationId: value || '' })}
          searchable
          required
        />

        <Textarea
          label={t('pharmacy.dosageInstructions')}
          placeholder="e.g., Take 1 tablet by mouth twice daily with food"
          value={formData.dosageInstruction}
          onChange={(e) => setFormData({ ...formData, dosageInstruction: e.currentTarget.value })}
          rows={2}
          required
        />

        <Group grow>
          <NumberInput
            label={t('pharmacy.quantity')}
            value={formData.quantity}
            onChange={(value) => setFormData({ ...formData, quantity: Number(value) || 0 })}
            min={1}
            required
          />
          <NumberInput
            label={t('pharmacy.refills')}
            value={formData.refills}
            onChange={(value) => setFormData({ ...formData, refills: Number(value) || 0 })}
            min={0}
            max={12}
          />
        </Group>

        <Radio.Group
          label={t('pharmacy.prescriptionType')}
          value={formData.isPrescriptionType}
          onChange={(value) => setFormData({ ...formData, isPrescriptionType: value as 'external' | 'internal' })}
        >
          <Stack mt="xs">
            <Radio value="external" label={t('pharmacy.external')} />
            <Radio value="internal" label={t('pharmacy.internal')} />
          </Stack>
        </Radio.Group>

        <Textarea
          label={t('common.notes')}
          placeholder={t('common.enterNotes')}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
          rows={2}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            leftSection={<IconPill size={16} />}
          >
            {t('pharmacy.prescribe')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

