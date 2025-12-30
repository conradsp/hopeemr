import { useState } from 'react';
import {
  Modal,
  Stack,
  TextInput,
  Select,
  Button,
  Group,
  Alert,
  Text,
  Checkbox,
  Divider,
  LoadingOverlay,
  Code,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconUserPlus } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import type { Patient, HumanName, ContactPoint, Identifier } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { notifications } from '@mantine/notifications';
import { formatHumanName } from '@medplum/core';
import { logger } from '../../utils/logger';
import { useOfflineMutation } from '../../offline';

/**
 * Quick Register Modal
 *
 * Fast 30-second patient registration for walk-ins
 *
 * Captures only essential information:
 * - Name (first, last)
 * - Gender
 * - Age OR Date of Birth
 * - Phone number OR ID number
 *
 * Features:
 * - Auto-generates MRN
 * - Marks profile as "incomplete" for later completion
 * - Optional: Immediately proceed to check-in
 * - Input validation
 * - Duplicate detection
 *
 * Target time: 30 seconds from start to finish
 */

interface QuickRegisterModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: (patient: Patient) => void;
  proceedToCheckIn?: boolean; // If true, navigates to check-in after registration
}

export function QuickRegisterModal({
  opened,
  onClose,
  onSuccess,
  proceedToCheckIn = false,
}: QuickRegisterModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const { createResource } = useOfflineMutation();
  const navigate = useNavigate();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<string>('');
  const [age, setAge] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [markIncomplete, setMarkIncomplete] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate Medical Record Number (MRN)
   * Format: MRN-YYYYMMDD-XXXX (e.g., MRN-20250124-0001)
   */
  const generateMRN = (): string => {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `MRN-${dateStr}-${random}`;
  };

  /**
   * Calculate birth date from age
   */
  const calculateBirthDateFromAge = (ageYears: number): string => {
    const today = new Date();
    const birthYear = today.getFullYear() - ageYears;
    return `${birthYear}-01-01`; // Approximate to January 1st
  };

  /**
   * Validate form data
   */
  const validateForm = (): string | null => {
    if (!firstName.trim()) {
      return t('quickRegister.error.firstNameRequired', 'First name is required');
    }

    if (!lastName.trim()) {
      return t('quickRegister.error.lastNameRequired', 'Last name is required');
    }

    if (!gender) {
      return t('quickRegister.error.genderRequired', 'Gender is required');
    }

    if (!age) {
      return t('quickRegister.error.ageRequired', 'Age is required');
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
      return t('quickRegister.error.invalidAge', 'Age must be between 0 and 150');
    }

    if (!phoneNumber.trim() && !idNumber.trim()) {
      return t(
        'quickRegister.error.contactRequired',
        'Either phone number or ID number is required'
      );
    }

    return null;
  };

  /**
   * Handle quick registration
   */
  const handleRegister = async (): Promise<void> => {
    setError(null);

    // Validate
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      // Generate MRN
      const mrn = generateMRN();

      // Calculate birth date from age
      const birthDate = calculateBirthDateFromAge(parseInt(age));

      // Build name
      const name: HumanName = {
        use: 'official',
        family: lastName.trim(),
        given: [firstName.trim()],
        text: `${firstName.trim()} ${lastName.trim()}`,
      };

      // Build identifiers
      const identifiers: Identifier[] = [
        {
          use: 'official',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'MR',
                display: 'Medical Record Number',
              },
            ],
          },
          value: mrn,
        },
      ];

      // Add ID number if provided
      if (idNumber.trim()) {
        identifiers.push({
          use: 'secondary',
          type: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                code: 'DL',
                display: 'Driver\'s License',
              },
            ],
          },
          value: idNumber.trim(),
        });
      }

      // Build telecom
      const telecom: ContactPoint[] = [];
      if (phoneNumber.trim()) {
        telecom.push({
          system: 'phone',
          value: phoneNumber.trim(),
          use: 'mobile',
        });
      }

      // Build patient resource
      const patient: Patient = {
        resourceType: 'Patient',
        identifier: identifiers,
        name: [name],
        gender: gender as 'male' | 'female' | 'other' | 'unknown',
        birthDate,
        telecom: telecom.length > 0 ? telecom : undefined,
        // Mark as incomplete registration if checkbox selected
        meta: markIncomplete
          ? {
              tag: [
                {
                  system: 'http://medplum.com/patient-registration',
                  code: 'incomplete',
                  display: 'Incomplete Registration',
                },
              ],
            }
          : undefined,
      };

      // Create patient with offline support
      const result = await createResource(patient, 'Patient');
      const createdPatient = result.resource;

      logger.info('Quick registration successful', {
        patientId: createdPatient.id,
        mrn,
        isQueued: result.isQueued,
      });

      // Success notification
      if (result.isQueued) {
        notifications.show({
          title: t('quickRegister.savedOffline', 'Patient Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
          icon: <IconCheck size={16} />,
          autoClose: 5000,
        });
      } else {
        notifications.show({
          title: t('quickRegister.success', 'Patient Registered'),
          message: t(
            'quickRegister.successMessage',
            '{{name}} registered with MRN: {{mrn}}',
            {
              name: formatHumanName(createdPatient.name?.[0]),
              mrn,
            }
          ),
          color: 'green',
          icon: <IconCheck size={16} />,
          autoClose: 5000,
        });
      }

      // Call success callback
      if (onSuccess) {
        onSuccess(createdPatient);
      }

      // Navigate to check-in if requested (only when online)
      if (proceedToCheckIn && !result.isQueued) {
        navigate(`/check-in?patientId=${createdPatient.id}`);
      }

      // Reset form and close
      resetForm();
      onClose();
    } catch (err: any) {
      logger.error('Quick registration failed', err);
      setError(err.message || t('quickRegister.error.failed', 'Failed to register patient'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset form
   */
  const resetForm = (): void => {
    setFirstName('');
    setLastName('');
    setGender('');
    setAge('');
    setPhoneNumber('');
    setIdNumber('');
    setMarkIncomplete(true);
    setError(null);
  };

  /**
   * Handle close
   */
  const handleClose = (): void => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconUserPlus size={20} />
          <Text fw={600}>{t('quickRegister.title', 'Quick Registration')}</Text>
        </Group>
      }
      size="md"
    >
      <Stack gap="md" pos="relative">
        <LoadingOverlay visible={loading} />

        {/* Info Alert */}
        <Alert color="blue" variant="light">
          <Text size="sm">
            {t(
              'quickRegister.info',
              'Capture essential information only. Full demographics can be completed later.'
            )}
          </Text>
        </Alert>

        {/* Error Alert */}
        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            onClose={() => setError(null)}
            withCloseButton
          >
            {error}
          </Alert>
        )}

        {/* Name Fields */}
        <Group grow>
          <TextInput
            label={t('quickRegister.firstName', 'First Name')}
            placeholder={t('quickRegister.firstNamePlaceholder', 'John')}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoFocus
          />
          <TextInput
            label={t('quickRegister.lastName', 'Last Name')}
            placeholder={t('quickRegister.lastNamePlaceholder', 'Doe')}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </Group>

        {/* Gender & Age */}
        <Group grow>
          <Select
            label={t('quickRegister.gender', 'Gender')}
            placeholder={t('quickRegister.selectGender', 'Select')}
            data={[
              { value: 'male', label: t('gender.male', 'Male') },
              { value: 'female', label: t('gender.female', 'Female') },
              { value: 'other', label: t('gender.other', 'Other') },
              { value: 'unknown', label: t('gender.unknown', 'Unknown') },
            ]}
            value={gender}
            onChange={(value) => setGender(value || '')}
            required
          />
          <TextInput
            label={t('quickRegister.age', 'Age (years)')}
            placeholder="25"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            type="number"
            min={0}
            max={150}
            required
          />
        </Group>

        <Divider label={t('quickRegister.contactInfo', 'Contact Information (at least one)')} />

        {/* Phone & ID */}
        <Group grow>
          <TextInput
            label={t('quickRegister.phoneNumber', 'Phone Number')}
            placeholder="+1-555-123-4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
          <TextInput
            label={t('quickRegister.idNumber', 'ID Number')}
            placeholder="DL123456"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />
        </Group>

        {/* Mark Incomplete Checkbox */}
        <Checkbox
          label={t(
            'quickRegister.markIncomplete',
            'Mark as incomplete (complete full demographics later)'
          )}
          checked={markIncomplete}
          onChange={(e) => setMarkIncomplete(e.currentTarget.checked)}
        />

        {/* Auto-generated MRN Preview */}
        <Alert color="gray" variant="light">
          <Text size="sm">
            {t('quickRegister.mrnWillBeGenerated', 'Medical Record Number will be auto-generated')}
          </Text>
          <Code mt="xs">{generateMRN()} (example)</Code>
        </Alert>

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={handleClose} disabled={loading}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleRegister}
            disabled={loading}
            leftSection={<IconUserPlus size={16} />}
          >
            {proceedToCheckIn
              ? t('quickRegister.registerAndCheckIn', 'Register & Check In')
              : t('quickRegister.register', 'Register')}
          </Button>
        </Group>

        {/* Time Saver Note */}
        <Text size="xs" c="dimmed" ta="center">
          ⏱️ {t('quickRegister.timeSaver', 'Target: 30 seconds from start to finish')}
        </Text>
      </Stack>
    </Modal>
  );
}
