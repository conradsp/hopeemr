import { Modal, Button, TextInput, Select, Stack, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMedplum } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import { JSX, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { handleError } from '../../utils/errorHandling';
import { useOfflineMutation } from '../../offline';

interface NewPatientModalProps {
  opened: boolean;
  onClose: () => void;
}

export function NewPatientModal({ opened, onClose }: NewPatientModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const { createResource } = useOfflineMutation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: '',
    email: '',
    phone: '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      const patient: Patient = {
        resourceType: 'Patient',
        name: [
          {
            given: [formData.firstName],
            family: formData.lastName,
            use: 'official',
          },
        ],
        birthDate: formData.birthDate,
        gender: formData.gender as 'male' | 'female' | 'other' | 'unknown',
        telecom: [
          ...(formData.email ? [{
            system: 'email' as const,
            value: formData.email,
            use: 'home' as const,
          }] : []),
          ...(formData.phone ? [{
            system: 'phone' as const,
            value: formData.phone,
            use: 'mobile' as const,
          }] : []),
        ],
        address: formData.addressLine ? [
          {
            line: [formData.addressLine],
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
            use: 'home',
          },
        ] : undefined,
        active: true,
      };

      // Create with offline support
      const result = await createResource(patient, 'Patient');

      if (result.isQueued) {
        notifications.show({
          title: t('patient.savedOffline', 'Patient Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
        });
        onClose();
      } else {
        onClose();
        navigate(`/patient/${result.resource.id}`);
      }
    } catch (error) {
      handleError(error, t('patient.createError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('patient.createNew')} size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Group grow>
            <TextInput
              label={t('common.firstName')}
              placeholder={t('common.firstNamePlaceholder')}
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
            <TextInput
              label={t('common.lastName')}
              placeholder={t('common.lastNamePlaceholder')}
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </Group>

          <Group grow>
            <TextInput
              label={t('common.dateOfBirth')}
              type="date"
              required
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
            />
            <Select
              label={t('common.gender')}
              placeholder={t('common.selectGender')}
              required
              data={[
                { value: 'male', label: t('common.male') },
                { value: 'female', label: t('common.female') },
                { value: 'other', label: t('common.other') },
                { value: 'unknown', label: t('common.unknown') },
              ]}
              value={formData.gender}
              onChange={(value) => setFormData({ ...formData, gender: value || '' })}
            />
          </Group>

          <Group grow>
            <TextInput
              label={t('common.email')}
              placeholder={t('common.emailPlaceholder')}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <TextInput
              label={t('common.phoneNumber')}
              placeholder={t('common.phonePlaceholder')}
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </Group>

          <TextInput
            label={t('common.addressLine')}
            placeholder={t('common.addressPlaceholder')}
            value={formData.addressLine}
            onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
          />

          <Group grow>
            <TextInput
              label={t('common.city')}
              placeholder={t('common.cityPlaceholder')}
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <TextInput
              label={t('common.state')}
              placeholder={t('common.statePlaceholder')}
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
            <TextInput
              label={t('common.postalCode')}
              placeholder={t('common.postalCodePlaceholder')}
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {t('patient.createButton')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

