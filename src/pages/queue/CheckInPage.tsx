import { useState, JSX } from 'react';
import {
  Container,
  Title,
  Paper,
  Stack,
  TextInput,
  Select,
  Textarea,
  Button,
  Group,
  Alert,
  LoadingOverlay,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconUserPlus } from '@tabler/icons-react';
import { useMedplum, useSearchResources } from '@medplum/react';
import { formatHumanName, getReferenceString } from '@medplum/core';
import type { Patient, Appointment, Location, Practitioner } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { notifications } from '@mantine/notifications';
import { createQueueEntry } from '../../utils/queueUtils';
import { suggestPriorityFromTriage } from '../../utils/triageUtils';
import type { CheckInRequest } from '../../types/queue.types';
import { Permission } from '../../utils/permissions';
import { usePermissions } from '../../hooks/usePermissions';
import { logger } from '../../utils/logger';
import { QuickRegisterModal } from '../../components/registration/QuickRegisterModal';

/**
 * Check-In Page
 *
 * Allows front desk staff to check in patients and create queue entries
 *
 * Security:
 * - Requires CREATE_QUEUE_ENTRIES permission
 * - Input validation for all fields
 * - XSS prevention
 * - Audit logging via queueUtils
 */

export function CheckInPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [searchParams] = useSearchParams();

  // State - all hooks must be called before any early returns
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [complaintSensitivity, setComplaintSensitivity] = useState<'public' | 'private' | 'sensitive'>('public');
  const [triageLevel, setTriageLevel] = useState<number>(3);
  const [checkInMethod, setCheckInMethod] = useState<'scheduled' | 'walk-in' | 'referral' | 'emergency'>('walk-in');
  const [patientSearch, setPatientSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);

  // Load locations
  const [locations] = useSearchResources('Location', {
    _count: '100',
    _sort: 'name',
  });

  // Load today's appointments for selected patient
  const [appointments] = useSearchResources('Appointment', selectedPatient ? {
    patient: getReferenceString(selectedPatient),
    date: new Date().toISOString().split('T')[0],
    status: 'booked',
  } : undefined);

  // Search patients
  const [searchResults] = useSearchResources('Patient', patientSearch.length >= 2 ? {
    name: patientSearch,
    _count: '10',
  } : undefined);

  const canCheckIn = hasPermission(Permission.CREATE_QUEUE_ENTRIES);

  // Permission check - must be after all hooks
  if (!canCheckIn) {
    return (
      <Container size="sm" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title={t('common.accessDenied', 'Access Denied')} color="red">
          {t('queue.noCheckInPermission', 'You do not have permission to check in patients.')}
        </Alert>
      </Container>
    );
  }

  /**
   * Handle quick registration success
   * When a patient is created via quick registration, select them automatically
   */
  const handleQuickRegisterSuccess = (patient: Patient): void => {
    setSelectedPatient(patient);
    setPatientSearch(formatHumanName(patient.name?.[0]) || '');
    setQuickRegisterOpen(false);
  };

  /**
   * Handle check-in submission
   * Security Agent: Validates all inputs before creating queue entry
   */
  const handleCheckIn = async (): Promise<void> => {
    setError(null);

    // Validation
    if (!selectedPatient) {
      setError(t('queue.error.selectPatient', 'Please select a patient'));
      return;
    }

    if (!selectedLocation) {
      setError(t('queue.error.selectLocation', 'Please select a location'));
      return;
    }

    if (!chiefComplaint.trim()) {
      setError(t('queue.error.chiefComplaintRequired', 'Chief complaint is required'));
      return;
    }

    if (chiefComplaint.length > 500) {
      setError(t('queue.error.chiefComplaintTooLong', 'Chief complaint must be 500 characters or less'));
      return;
    }

    // Security: XSS prevention check
    if (/<script|javascript:|onerror=/i.test(chiefComplaint)) {
      setError(t('queue.error.invalidCharacters', 'Chief complaint contains invalid characters'));
      return;
    }

    setLoading(true);

    try {
      // Get current practitioner for requester field
      const profile = medplum.getProfile();

      // Build check-in request
      const request: CheckInRequest = {
        patient: { reference: `Patient/${selectedPatient.id}` },
        location: { reference: `Location/${selectedLocation}` },
        requester: profile ? { reference: `${profile.resourceType}/${profile.id}` } : undefined,
        appointment: selectedAppointment
          ? { reference: `Appointment/${selectedAppointment.id}` }
          : undefined,
        chiefComplaint: chiefComplaint.trim(),
        complainSensitivity: complaintSensitivity,
        triageLevel: triageLevel as 1 | 2 | 3 | 4 | 5,
        priority: suggestPriorityFromTriage(triageLevel as 1 | 2 | 3 | 4 | 5),
        checkInMethod,
      };

      // Create queue entry (includes audit logging)
      const task = await createQueueEntry(medplum, request);

      logger.info('Patient checked in successfully', {
        patientId: selectedPatient.id,
        taskId: task.id,
      });

      // Success notification
      notifications.show({
        title: t('queue.checkInSuccess', 'Patient Checked In'),
        message: t(
          'queue.checkInSuccessMessage',
          '{{patientName}} has been added to the queue',
          { patientName: formatHumanName(selectedPatient.name?.[0]) }
        ),
        color: 'green',
        icon: <IconCheck size={16} />,
      });

      // Navigate to queue dashboard
      navigate('/queue');
    } catch (err: any) {
      logger.error('Check-in failed', err);
      setError(err.message || t('queue.error.checkInFailed', 'Failed to check in patient'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="md" py="xl">
      <QuickRegisterModal
        opened={quickRegisterOpen}
        onClose={() => setQuickRegisterOpen(false)}
        onSuccess={handleQuickRegisterSuccess}
      />

      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{t('queue.checkIn', 'Check In Patient')}</Title>
          <Button
            variant="light"
            leftSection={<IconUserPlus size={16} />}
            onClick={() => setQuickRegisterOpen(true)}
          >
            {t('queue.quickRegister', 'Quick Register')}
          </Button>
        </Group>

        <Paper withBorder shadow="sm" p="xl" pos="relative">
          <LoadingOverlay visible={loading} />

          <Stack gap="md">
            {/* Error Alert */}
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" onClose={() => setError(null)} withCloseButton>
                {error}
              </Alert>
            )}

            {/* Patient Search */}
            <TextInput
              label={t('queue.searchPatient', 'Search Patient')}
              placeholder={t('queue.searchPlaceholder', 'Enter patient name or MRN')}
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              required
            />

            {/* Patient Selection */}
            {searchResults && searchResults.length > 0 && !selectedPatient && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  {t('queue.selectPatient', 'Select Patient')}
                </Text>
                {searchResults.map((patient) => (
                  <Button
                    key={patient.id}
                    variant="light"
                    fullWidth
                    onClick={() => {
                      setSelectedPatient(patient);
                      setPatientSearch(formatHumanName(patient.name?.[0]) || '');
                    }}
                  >
                    <Group justify="space-between" style={{ width: '100%' }}>
                      <div>
                        <Text size="sm" fw={500}>
                          {formatHumanName(patient.name?.[0])}
                        </Text>
                        {patient.identifier?.[0] && (
                          <Text size="xs" c="dimmed">
                            {t('common.mrn', 'MRN')}: {patient.identifier[0].value}
                          </Text>
                        )}
                      </div>
                      <Text size="xs" c="dimmed">
                        {patient.birthDate}
                      </Text>
                    </Group>
                  </Button>
                ))}
              </Stack>
            )}

            {/* Selected Patient Display */}
            {selectedPatient && (
              <Alert color="blue" title={t('queue.selectedPatient', 'Selected Patient')}>
                <Group justify="space-between">
                  <div>
                    <Text fw={500}>{formatHumanName(selectedPatient.name?.[0])}</Text>
                    {selectedPatient.identifier?.[0] && (
                      <Text size="sm">{t('common.mrn', 'MRN')}: {selectedPatient.identifier[0].value}</Text>
                    )}
                  </div>
                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={() => {
                      setSelectedPatient(null);
                      setSelectedAppointment(null);
                      setPatientSearch('');
                    }}
                  >
                    {t('common.change', 'Change')}
                  </Button>
                </Group>
              </Alert>
            )}

            {/* Appointment Selection (if patient has appointments today) */}
            {selectedPatient && appointments && appointments.length > 0 && (
              <Select
                label={t('queue.appointment', 'Appointment')}
                placeholder={t('queue.selectAppointment', 'Select appointment (optional)')}
                data={[
                  { value: '', label: t('queue.noAppointment', 'Walk-in (no appointment)') },
                  ...appointments.map((apt) => ({
                    value: apt.id!,
                    label: `${apt.start} - ${apt.appointmentType?.text || 'Appointment'}`,
                  })),
                ]}
                value={selectedAppointment?.id || ''}
                onChange={(value) => {
                  const apt = appointments.find((a) => a.id === value);
                  setSelectedAppointment(apt || null);
                  setCheckInMethod(apt ? 'scheduled' : 'walk-in');
                }}
              />
            )}

            {/* Location Selection */}
            <Select
              label={t('queue.location', 'Location/Department')}
              placeholder={t('queue.selectLocation', 'Select location')}
              data={
                locations?.map((loc) => ({
                  value: loc.id!,
                  label: loc.name || loc.id!,
                })) || []
              }
              value={selectedLocation}
              onChange={(value) => setSelectedLocation(value || '')}
              required
              searchable
            />

            {/* Check-in Method */}
            <Select
              label={t('queue.checkInMethodTypes.label', 'Check-In Method')}
              data={[
                { value: 'scheduled', label: t('queue.checkInMethodTypes.scheduled', 'Scheduled Appointment') },
                { value: 'walk-in', label: t('queue.checkInMethodTypes.walkIn', 'Walk-In') },
                { value: 'referral', label: t('queue.checkInMethodTypes.referral', 'Referral') },
                { value: 'emergency', label: t('queue.checkInMethodTypes.emergency', 'Emergency') },
              ]}
              value={checkInMethod}
              onChange={(value) => setCheckInMethod(value as any)}
              required
            />

            {/* Chief Complaint */}
            <Textarea
              label={t('queue.chiefComplaint', 'Chief Complaint')}
              placeholder={t('queue.chiefComplaintPlaceholder', 'Brief description of patient concern...')}
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              maxLength={500}
              rows={3}
              required
            />

            {/* Chief Complaint Sensitivity (Security Agent requirement) */}
            <Select
              label={t('queue.complaintSensitivity', 'Complaint Sensitivity')}
              description={t(
                'queue.complaintSensitivityHelp',
                'Sensitive complaints will be hidden from queue display'
              )}
              data={[
                { value: 'public', label: t('queue.sensitivity.public', 'Public (visible in queue)') },
                {
                  value: 'private',
                  label: t('queue.sensitivity.private', 'Private (shown as "Private consultation")'),
                },
                {
                  value: 'sensitive',
                  label: t('queue.sensitivity.sensitive', 'Sensitive (completely hidden)'),
                },
              ]}
              value={complaintSensitivity}
              onChange={(value) => setComplaintSensitivity(value as any)}
            />

            {/* Initial Triage Level */}
            <Select
              label={t('queue.initialTriage', 'Initial Triage Level (ESI)')}
              description={t('queue.triageHelp', 'Can be updated by nurse during triage')}
              data={[
                { value: '1', label: t('queue.triageLevels.esi1Full', 'ESI 1 - Resuscitation (Immediate)') },
                { value: '2', label: t('queue.triageLevels.esi2Full', 'ESI 2 - Emergent (< 10 min)') },
                { value: '3', label: t('queue.triageLevels.esi3Full', 'ESI 3 - Urgent (< 30 min)') },
                { value: '4', label: t('queue.triageLevels.esi4Full', 'ESI 4 - Less Urgent (< 60 min)') },
                { value: '5', label: t('queue.triageLevels.esi5Full', 'ESI 5 - Non-Urgent (< 120 min)') },
              ]}
              value={triageLevel.toString()}
              onChange={(value) => setTriageLevel(parseInt(value || '3'))}
            />

            {/* Actions */}
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => navigate(-1)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleCheckIn} disabled={!selectedPatient || !selectedLocation || !chiefComplaint}>
                {t('queue.checkInPatient', 'Check In Patient')}
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
