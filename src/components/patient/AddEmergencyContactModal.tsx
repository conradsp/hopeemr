import { Modal, TextInput, Button, Group, Stack, Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Patient, ContactPoint, HumanName } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconPhone } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AddEmergencyContactModalProps {
  opened: boolean;
  onClose: () => void;
  patient: Patient;
  onSuccess?: () => void;
}

export function AddEmergencyContactModal({ opened, onClose, patient, onSuccess }: AddEmergencyContactModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    relationship: '',
    phone: '',
    email: '',
  });

  const handleChange = (field: string, value: string | null): void => {
    setFormData((prev) => ({ ...prev, [field]: value || '' }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      const contactName: HumanName = {
        given: [formData.firstName],
        family: formData.lastName,
        text: `${formData.firstName} ${formData.lastName}`,
      };

      const telecom: ContactPoint[] = [];
      if (formData.phone) {
        telecom.push({ system: 'phone', value: formData.phone, use: 'mobile' });
      }
      if (formData.email) {
        telecom.push({ system: 'email', value: formData.email });
      }

      // Update patient with new emergency contact
      const updatedPatient: Patient = {
        ...patient,
        contact: [
          ...(patient.contact || []),
          {
            name: contactName,
            relationship: [
              {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
                    code: formData.relationship,
                    display: formData.relationship,
                  },
                ],
                text: formData.relationship,
              },
            ],
            telecom: telecom.length > 0 ? telecom : undefined,
          },
        ],
      };

      await medplum.updateResource(updatedPatient);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        relationship: '',
        phone: '',
        email: '',
      });
      
      notifications.show({
        title: t('success'),
        message: t('patient.emergencyContactSuccess'),
        color: 'green',
      });
      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('patient.emergencyContactError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('patient.addEmergencyContact')} centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Group grow>
            <TextInput
              label={t('common.firstName')}
              placeholder={t('common.firstNamePlaceholder')}
              required
              value={formData.firstName}
              onChange={(event) => handleChange('firstName', event.currentTarget.value)}
            />
            <TextInput
              label={t('common.lastName')}
              placeholder={t('common.lastNamePlaceholder')}
              required
              value={formData.lastName}
              onChange={(event) => handleChange('lastName', event.currentTarget.value)}
            />
          </Group>

          <Select
            label={t('patient.relationship')}
            placeholder={t('patient.selectRelationship')}
            required
            data={[
              { value: 'Spouse', label: t('patient.relationshipOptions.spouse') },
              { value: 'Parent', label: t('patient.relationshipOptions.parent') },
              { value: 'Child', label: t('patient.relationshipOptions.child') },
              { value: 'Sibling', label: t('patient.relationshipOptions.sibling') },
              { value: 'Friend', label: t('patient.relationshipOptions.friend') },
              { value: 'Other', label: t('patient.relationshipOptions.other') },
            ]}
            value={formData.relationship}
            onChange={(value) => handleChange('relationship', value)}
          />

          <TextInput
            label={t('common.phoneNumber')}
            placeholder="555-123-4567"
            type="tel"
            required
            value={formData.phone}
            onChange={(event) => handleChange('phone', event.currentTarget.value)}
          />

          <TextInput
            label={t('common.email')}
            placeholder="john.doe@example.com"
            type="email"
            value={formData.email}
            onChange={(event) => handleChange('email', event.currentTarget.value)}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconPhone size={16} />}>
              {t('patient.addContact')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

