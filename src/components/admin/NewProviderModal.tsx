import { Modal, TextInput, Button, Group, Stack, Select, Textarea } from '@mantine/core';
import { Practitioner, HumanName, ContactPoint, Address } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconUserPlus } from '@tabler/icons-react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useModalForm } from '../../hooks/useModalForm';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { validators } from '../../utils/validation';

interface NewProviderModalProps {
  opened: boolean;
  onClose: () => void;
}

interface ProviderFormData {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  specialty: string;
  qualification: string;
  npi: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
}

export function NewProviderModal({ opened, onClose }: NewProviderModalProps): JSX.Element {
  const medplum = useMedplum();
  const { t } = useTranslation();

  const { formData, updateField, reset, loading, handleSave } = useModalForm<ProviderFormData>({
    initialData: {
      firstName: '',
      lastName: '',
      gender: '',
      email: '',
      phone: '',
      specialty: '',
      qualification: '',
      npi: '',
      addressLine: '',
      city: '',
      state: '',
      postalCode: '',
    },
    onSave: async (data) => {
      // Validation
      if (!validators.required(data.firstName) || !validators.required(data.lastName)) {
        throw new Error(t('users.newProvider.errorNameRequired', 'First name and last name are required'));
      }
      if (!validators.email(data.email)) {
        throw new Error(t('users.newProvider.errorEmailRequired', 'Valid email is required'));
      }
      if (data.phone && !validators.phone(data.phone)) {
        throw new Error(t('users.newProvider.errorPhoneInvalid', 'Please enter a valid 10-digit phone number'));
      }

      const name: HumanName = {
        given: [data.firstName],
        family: data.lastName,
        text: `${data.firstName} ${data.lastName}`,
        use: 'official',
      };

      const telecom: ContactPoint[] = [];
      if (data.email) {
        telecom.push({ system: 'email', value: data.email, use: 'work' });
      }
      if (data.phone) {
        telecom.push({ system: 'phone', value: data.phone, use: 'work' });
      }

      const address: Address | undefined = data.addressLine ? {
        line: [data.addressLine],
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: 'US',
        use: 'work',
      } : undefined;

      const practitioner: Practitioner = {
        resourceType: 'Practitioner',
        name: [name],
        telecom: telecom.length > 0 ? telecom : undefined,
        address: address ? [address] : undefined,
        gender: data.gender as 'male' | 'female' | 'other' | 'unknown' || undefined,
        active: true,
        identifier: data.npi ? [
          {
            system: 'http://hl7.org/fhir/sid/us-npi',
            value: data.npi,
          },
        ] : undefined,
        qualification: data.qualification ? [
          {
            code: {
              text: data.qualification,
            },
          },
        ] : undefined,
      };

      await medplum.createResource(practitioner);
      
      // Invite provider to set up their account
      if (data.email) {
        const project = medplum.getProject();
        if (project?.id) {
          try {
            await medplum.invite(
              project.id,
              {
                resourceType: 'Practitioner',
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
              }
            );
          } catch (error) {
            // Log but don't fail if invitation fails
            handleError(error, 'sending invitation');
          }
        }
      }
    },
    successMessage: t('users.newProvider.successMessage', 'Provider created successfully!'),
    onSuccess: () => {
      reset();
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    await handleSave();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('users.newProvider.title', 'Add New Provider')} size="lg" centered>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Group grow>
            <TextInput
              label={t('users.newProvider.firstName', 'First Name')}
              placeholder={t('users.newProvider.firstNamePlaceholder', 'John')}
              required
              value={formData.firstName}
              onChange={(event) => updateField('firstName', event.currentTarget.value)}
            />
            <TextInput
              label={t('users.newProvider.lastName', 'Last Name')}
              placeholder={t('users.newProvider.lastNamePlaceholder', 'Doe')}
              required
              value={formData.lastName}
              onChange={(event) => updateField('lastName', event.currentTarget.value)}
            />
          </Group>

          <Select
            label={t('users.newProvider.gender', 'Gender')}
            placeholder={t('users.newProvider.genderPlaceholder', 'Select gender')}
            data={['male', 'female', 'other', 'unknown']}
            value={formData.gender}
            onChange={(value) => updateField('gender', value || '')}
          />

          <Group grow>
            <TextInput
              label={t('users.newProvider.email', 'Email')}
              placeholder={t('users.newProvider.emailPlaceholder', 'john.doe@hospital.com')}
              type="email"
              required
              value={formData.email}
              onChange={(event) => updateField('email', event.currentTarget.value)}
            />
            <TextInput
              label={t('users.newProvider.phone', 'Phone')}
              placeholder={t('users.newProvider.phonePlaceholder', '555-123-4567')}
              type="tel"
              value={formData.phone}
              onChange={(event) => updateField('phone', event.currentTarget.value)}
            />
          </Group>

          <Group grow>
            <TextInput
              label={t('users.newProvider.npi', 'NPI Number')}
              placeholder={t('users.newProvider.npiPlaceholder', '1234567890')}
              value={formData.npi}
              onChange={(event) => updateField('npi', event.currentTarget.value)}
            />
            <TextInput
              label={t('users.newProvider.specialty', 'Specialty')}
              placeholder={t('users.newProvider.specialtyPlaceholder', 'e.g., Cardiology, Family Medicine')}
              value={formData.specialty}
              onChange={(event) => updateField('specialty', event.currentTarget.value)}
            />
          </Group>

          <Textarea
            label={t('users.newProvider.qualification', 'Qualification')}
            placeholder={t('users.newProvider.qualificationPlaceholder', 'MD, DO, NP, PA, etc.')}
            value={formData.qualification}
            onChange={(event) => updateField('qualification', event.currentTarget.value)}
            rows={2}
          />

          <TextInput
            label={t('users.newProvider.addressLine', 'Address Line 1')}
            placeholder={t('users.newProvider.addressLinePlaceholder', '123 Medical Center Drive')}
            value={formData.addressLine}
            onChange={(event) => updateField('addressLine', event.currentTarget.value)}
          />

          <Group grow>
            <TextInput
              label={t('users.newProvider.city', 'City')}
              placeholder={t('users.newProvider.cityPlaceholder', 'Anytown')}
              value={formData.city}
              onChange={(event) => updateField('city', event.currentTarget.value)}
            />
            <TextInput
              label={t('users.newProvider.state', 'State')}
              placeholder={t('users.newProvider.statePlaceholder', 'CA')}
              value={formData.state}
              onChange={(event) => updateField('state', event.currentTarget.value)}
            />
            <TextInput
              label={t('users.newProvider.postalCode', 'Postal Code')}
              placeholder={t('users.newProvider.postalCodePlaceholder', '12345')}
              value={formData.postalCode}
              onChange={(event) => updateField('postalCode', event.currentTarget.value)}
            />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconUserPlus size={16} />}>
              {t('users.newProvider.createProvider', 'Create Provider')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
