import { Modal, Button, Group, Stack, Select } from '@mantine/core';
import { Patient, Practitioner } from '@medplum/fhirtypes';
import { useMedplum, Loading, useSearchResources } from '@medplum/react';
import { IconStethoscope } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { showSuccess, handleError } from '../../utils/errorHandling';

interface AddPractitionerModalProps {
  opened: boolean;
  onClose: () => void;
  patient: Patient;
  onSuccess?: () => void;
}

export function AddPractitionerModal({ opened, onClose, patient, onSuccess }: AddPractitionerModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [selectedPractitionerId, setSelectedPractitionerId] = useState<string | null>(null);

  // Load all practitioners
  const [practitioners, practitionersLoading] = useSearchResources('Practitioner', {
    _count: '100',
    _sort: 'name',
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    if (!selectedPractitionerId) {
      handleError(new Error(t('patient.selectPractitioner')), t('modal.validationError'));
      return;
    }

    setLoading(true);

    try {
      const selectedPractitioner = practitioners?.find(p => p.id === selectedPractitionerId);
      
      if (!selectedPractitioner) {
        throw new Error(t('patient.practitionerNotFound'));
      }

      // Update patient with general practitioner
      const updatedPatient: Patient = {
        ...patient,
        generalPractitioner: [
          ...(patient.generalPractitioner || []),
          {
            reference: `Practitioner/${selectedPractitionerId}`,
            display: selectedPractitioner.name?.[0]?.text || 
                    [selectedPractitioner.name?.[0]?.given?.[0], selectedPractitioner.name?.[0]?.family]
                      .filter(Boolean).join(' '),
          },
        ],
      };

      await medplum.updateResource(updatedPatient);
      
      setSelectedPractitionerId(null);
      showSuccess(t('patient.practitionerSuccess'));
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      handleError(error, t('patient.practitionerError'));
    } finally {
      setLoading(false);
    }
  };

  const practitionerOptions = practitioners?.map(p => ({
    value: p.id || '',
    label: p.name?.[0]?.text || 
           [p.name?.[0]?.given?.[0], p.name?.[0]?.family].filter(Boolean).join(' ') || 
           t('common.unknown'),
  })) || [];

  return (
    <Modal opened={opened} onClose={onClose} title={t('patient.assignPractitioner')} centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          {practitionersLoading ? (
            <Loading />
          ) : (
            <Select
              label={t('patient.selectPractitioner')}
              placeholder={t('patient.choosePractitioner')}
              required
              data={practitionerOptions}
              value={selectedPractitionerId}
              onChange={setSelectedPractitionerId}
              searchable
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              loading={loading} 
              leftSection={<IconStethoscope size={16} />}
              disabled={!selectedPractitionerId}
            >
              {t('patient.assignButton')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

