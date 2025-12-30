import { Modal, Button, Group, Stack, TextInput, Textarea, NumberInput, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Encounter, Patient, MedicationRequest } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconPill } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { administerMedication, AdministrationFormData } from '../../utils/medications';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { createMedicationCharge, getPriceFromResource } from '../../utils/billing';

interface AdministerMedicationModalProps {
  opened: boolean;
  onClose: (administered?: boolean) => void;
  encounter: Encounter;
  patient: Patient;
  medicationRequest: MedicationRequest;
}

export function AdministerMedicationModal({ 
  opened, 
  onClose, 
  encounter, 
  patient, 
  medicationRequest 
}: AdministerMedicationModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<AdministrationFormData>({
    medicationRequestId: medicationRequest.id || '',
    dosageGiven: medicationRequest.dosageInstruction?.[0]?.text || '',
    quantity: 1,
    notes: '',
  });

  const handleSubmit = async (): Promise<void> => {
    if (!formData.dosageGiven) {
      notifications.show({
        title: t('validationError'),
        message: t('pharmacy.administeredDose') + ' ' + t('common.required'),
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      await administerMedication(
        medplum,
        patient.id!,
        encounter.id!,
        {
          ...formData,
          medicationRequestId: medicationRequest.id!,
        }
      );

      // Create billing charge if medication has a price
      try {
        if (medicationRequest.medicationReference?.reference) {
          const medicationId = medicationRequest.medicationReference.reference.split('/')[1];
          const medication = await medplum.readResource('Medication', medicationId);
          const price = getPriceFromResource(medication);
          
          if (price && price > 0) {
            await createMedicationCharge(
              medplum,
              patient.id!,
              encounter.id!,
              medicationName,
              formData.quantity,
              price,
              medicationRequest.id
            );
          }
        }
      } catch (billingError) {
        // Log error but don't fail the administration
        handleError(billingError, 'creating medication charge');
      }

      showSuccess(t('pharmacy.administerSuccess'));
      notifications.show({
        title: t('success'),
        message: t('pharmacy.inventoryUpdated'),
        color: 'blue',
      });
      
      onClose(true);
    } catch (error) {
      handleError(error, 'administering medication');
    } finally {
      setLoading(false);
    }
  };

  const medicationName = medicationRequest.medicationReference?.display ||
    medicationRequest.medicationCodeableConcept?.text ||
    t('common.unknown');

  const prescribedDosage = medicationRequest.dosageInstruction?.[0]?.text || t('common.dash');

  return (
    <Modal
      opened={opened}
      onClose={() => onClose(false)}
      title={t('pharmacy.administerTitle')}
      size="md"
    >
      <Stack>
        <div>
          <Text size="sm" c="dimmed">{t('pharmacy.medications')}</Text>
          <Text size="lg" fw={500}>{medicationName}</Text>
        </div>

        <div>
          <Text size="sm" c="dimmed">{t('pharmacy.dosageInstructions')}</Text>
          <Text>{prescribedDosage}</Text>
        </div>

        <TextInput
          label={t('pharmacy.administeredDose')}
          placeholder="e.g., 500mg tablet"
          value={formData.dosageGiven}
          onChange={(e) => setFormData({ ...formData, dosageGiven: e.currentTarget.value })}
          required
        />

        <NumberInput
          label={t('pharmacy.quantity')}
          value={formData.quantity}
          onChange={(value) => setFormData({ ...formData, quantity: Number(value) || 1 })}
          min={1}
          required
        />

        <Textarea
          label={t('pharmacy.administrationNotes')}
          placeholder={t('common.enterNotes')}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.currentTarget.value })}
          rows={3}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => onClose(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            leftSection={<IconPill size={16} />}
            color="green"
          >
            {t('pharmacy.administer')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

