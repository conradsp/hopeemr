import { Paper, Title, Text, Stack, Group, Button, Select, Table, Badge, Modal, Textarea } from '@mantine/core';
import { Document, useMedplum } from '@medplum/react';
import { Patient, Practitioner, Slot } from '@medplum/fhirtypes';
import { IconCalendar, IconClock, IconCheck, IconSearch } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { searchAvailableSlots, bookAppointment } from '../../utils/appointmentUtils';
import { getAppointmentTypes, AppointmentTypeDefinition } from '../../utils/appointmentTypes';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { logger } from '../../utils/logger';
import { notifications } from '@mantine/notifications';
import { formatDateTime } from '@medplum/core';
import { useTranslation } from 'react-i18next';
import styles from './BookAppointmentPage.module.css';

export function BookAppointmentPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeDefinition[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<Slot | null>(null);
  const [bookingReason, setBookingReason] = useState('');
  const [bookingNote, setBookingNote] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async (): Promise<void> => {
      try {
        // Load patients
        const patientsResult = await medplum.search('Patient', {
          _count: '100'
        });
        setPatients(patientsResult.entry?.map(e => e.resource as Patient) || []);

        // Load practitioners
        const practitionersResult = await medplum.search('Practitioner', {
          _count: '100'
        });
        setPractitioners(practitionersResult.entry?.map(e => e.resource as Practitioner) || []);

        // Load appointment types
        const types = await getAppointmentTypes(medplum);
        setAppointmentTypes(types);
      } catch (err) {
        logger.error('Failed to load initial data', err);
      }
    };
    void loadInitialData().catch(() => {});
  }, [medplum]);

  const handleSearch = async (): Promise<void> => {
    if (!selectedDate) {
      notifications.show({
        title: t('error'),
        message: t('appointment.selectDate'),
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      // Search for slots
      const startDate = `${selectedDate}T00:00:00Z`;
      const endDate = `${selectedDate}T23:59:59Z`;

      const slots = await searchAvailableSlots(
        medplum,
        undefined,
        startDate,
        endDate,
        selectedType || undefined
      );

      // Filter by practitioner if selected
      let filteredSlots = slots;
      if (selectedPractitioner) {
        // Need to get schedule for each slot and filter by practitioner
        const slotsWithPractitioner = await Promise.all(
          slots.map(async (slot) => {
            if (slot.schedule?.reference) {
              const scheduleId = slot.schedule.reference.split('/')[1];
              try {
                const schedule = await medplum.readResource('Schedule', scheduleId);
                const hasPractitioner = schedule.actor?.some(
                  actor => actor.reference === `Practitioner/${selectedPractitioner}`
                );
                return hasPractitioner ? slot : null;
              } catch {
                return null;
              }
            }
            return null;
          })
        );
        filteredSlots = slotsWithPractitioner.filter((slot): slot is Slot => slot !== null);
      }

      // Filter slots based on appointment type duration
      if (selectedType) {
        const appointmentType = appointmentTypes.find(t => t.code === selectedType);
        if (appointmentType && appointmentType.duration) {
          const requiredDuration = appointmentType.duration;
          
          // Sort slots by start time
          const sortedSlots = [...filteredSlots].sort((a, b) => 
            new Date(a.start || '').getTime() - new Date(b.start || '').getTime()
          );
          
          // Find slots where there are enough consecutive slots for the required duration
          const validSlots: Slot[] = [];
          
          for (let i = 0; i < sortedSlots.length; i++) {
            const currentSlot = sortedSlots[i];
            const slotDuration = currentSlot.start && currentSlot.end
              ? Math.round((new Date(currentSlot.end).getTime() - new Date(currentSlot.start).getTime()) / 60000)
              : 0;
            
            if (slotDuration >= requiredDuration) {
              // Single slot is long enough
              validSlots.push(currentSlot);
            } else {
              // Check if we can combine consecutive slots
              let totalDuration = slotDuration;
              let consecutiveSlots = [currentSlot];
              
              for (let j = i + 1; j < sortedSlots.length; j++) {
                const nextSlot = sortedSlots[j];
                const prevSlot = consecutiveSlots[consecutiveSlots.length - 1];
                
                // Check if slots are consecutive (end of previous = start of next)
                if (prevSlot.end === nextSlot.start) {
                  const nextDuration = nextSlot.start && nextSlot.end
                    ? Math.round((new Date(nextSlot.end).getTime() - new Date(nextSlot.start).getTime()) / 60000)
                    : 0;
                  totalDuration += nextDuration;
                  consecutiveSlots.push(nextSlot);
                  
                  if (totalDuration >= requiredDuration) {
                    // We have enough consecutive slots
                    // Store the combined slot info in the first slot
                    const combinedSlot = {
                      ...currentSlot,
                      end: nextSlot.end,
                      meta: {
                        ...currentSlot.meta,
                        extension: [
                          {
                            url: 'http://medplum.com/combined-slots',
                            valueString: JSON.stringify(consecutiveSlots.map(s => s.id))
                          }
                        ]
                      }
                    };
                    validSlots.push(combinedSlot);
                    break;
                  }
                } else {
                  // Slots are not consecutive
                  break;
                }
              }
            }
          }
          
          filteredSlots = validSlots;
        }
      }

      setAvailableSlots(filteredSlots);
    } catch (error) {
      logger.error('Failed to search slots', error);
      notifications.show({
        title: t('error'),
        message: t('appointment.searchError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookSlot = (slot: Slot): void => {
    if (!selectedPatient) {
      notifications.show({
        title: t('error'),
        message: t('appointment.selectPatient'),
        color: 'red',
      });
      return;
    }
    setBookingSlot(slot);
  };

  const handleConfirmBooking = async (): Promise<void> => {
    if (!bookingSlot || !selectedPatient || !selectedType) {
      return;
    }

    setBookingLoading(true);
    try {
      const patient = patients.find(p => p.id === selectedPatient);
      if (!patient) {
        throw new Error('Patient not found');
      }

      await bookAppointment(medplum, {
        patient: {
          reference: `Patient/${selectedPatient}`,
          display: patient.name?.[0]?.text || patient.name?.[0]?.family,
        },
        slot: bookingSlot,
        appointmentType: selectedType,
        reason: bookingReason,
        note: bookingNote,
      });

      notifications.show({
        title: t('success'),
        message: t('appointment.bookSuccess'),
        color: 'green',
      });
      setBookingSlot(null);
      setBookingReason('');
      setBookingNote('');
      handleSearch().catch(() => undefined); // Refresh slots
    } catch (error) {
      logger.error('Failed to book appointment', error);
      notifications.show({
        title: t('error'),
        message: t('appointment.bookError'),
        color: 'red',
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const patientOptions = patients.map(p => ({
    value: p.id || '',
    label: p.name?.[0]?.text || [p.name?.[0]?.given?.[0], p.name?.[0]?.family].filter(Boolean).join(' ') || t('common.unknown'),
  }));

  const practitionerOptions = [
    { value: '', label: t('appointment.anyProvider') },
    ...practitioners.map(p => ({
      value: p.id || '',
      label: p.name?.[0]?.text || [p.name?.[0]?.given?.[0], p.name?.[0]?.family].filter(Boolean).join(' ') || t('common.unknown'),
    })),
  ];

  const typeOptions = [
    { value: '', label: t('appointment.anyType') },
    ...appointmentTypes.map(t => ({
      value: t.code,
      label: `${t.display} (${t.duration} min)`,
    })),
  ];

  return (
    <Document>
      <BreadcrumbNav />
      
      <Modal
        opened={!!bookingSlot}
        onClose={() => setBookingSlot(null)}
        title={t('appointment.confirmTitle')}
        centered
      >
        <Stack>
          <Text size="sm">
            <strong>{t('common.date')} & {t('common.time')}:</strong> {bookingSlot && formatDateTime(bookingSlot.start || '')}
          </Text>
          <Text size="sm">
            <strong>{t('common.duration')}:</strong> {appointmentTypes.find(t => t.code === selectedType)?.duration || 
              (bookingSlot?.start && bookingSlot?.end ? 
                Math.round((new Date(bookingSlot.end).getTime() - new Date(bookingSlot.start).getTime()) / 60000) : 0)} {t('encounter.minutes')}
          </Text>
          
          <Textarea
            value={bookingReason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBookingReason(e.currentTarget.value)}
            label={t('appointment.reasonForVisit')}
            placeholder={t('appointment.reasonPlaceholder')}
            rows={2}
          />

          <Textarea
            value={bookingNote}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBookingNote(e.currentTarget.value)}
            label={`${t('common.notes')} (${t('common.optional')})`}
            placeholder={t('appointment.notesPlaceholder')}
            rows={2}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setBookingSlot(null)}>
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleConfirmBooking} 
              loading={bookingLoading}
              leftSection={<IconCheck size={16} />}
            >
              {t('common.confirm')} {t('appointment.booking')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Paper shadow="sm" p="lg" withBorder className={styles.paper}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconCalendar size={28} />
                {t('header.bookAppointment')}
              </Group>
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              {t('appointment.scheduleDescription')}
            </Text>
          </div>
        </Group>

        <Stack gap="md">
          {/* Search Filters */}
          <Paper p="md" withBorder>
            <Stack>
              <Select
                label={t('appointment.patient')}
                placeholder={t('appointment.selectPatient')}
                data={patientOptions}
                value={selectedPatient}
                onChange={setSelectedPatient}
                searchable
                required
              />

              <Group grow align="flex-end">
                <Select
                  label={`${t('common.provider')} (${t('common.optional')})`}
                  placeholder={t('appointment.anyProvider')}
                  data={practitionerOptions}
                  value={selectedPractitioner || ''}
                  onChange={setSelectedPractitioner}
                  searchable
                />

                <Select
                  label={t('appointment.type')}
                  placeholder={t('appointment.selectType')}
                  data={typeOptions}
                  value={selectedType || ''}
                  onChange={setSelectedType}
                  required
                />

                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={styles.dateInput}
                />

                <Button
                  leftSection={<IconSearch size={16} />}
                  onClick={() => handleSearch().catch(() => undefined)}
                  disabled={!selectedPatient || !selectedType || !selectedDate}
                  loading={loading}
                >
                  {t('appointment.searchSlots')}
                </Button>
              </Group>
            </Stack>
          </Paper>

          {/* Available Slots */}
          {availableSlots.length > 0 ? (
            <Paper p="md" withBorder>
              <Title order={4} mb="md">{t('appointment.availableSlots')}</Title>
              <Table striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('common.time')}</Table.Th>
                    <Table.Th>{t('common.duration')}</Table.Th>
                    <Table.Th>{t('common.type')}</Table.Th>
                    <Table.Th>{t('common.action')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {availableSlots.map((slot) => (
                    <Table.Tr key={slot.id}>
                      <Table.Td>
                        <Group gap="xs">
                          <IconClock size={16} />
                          <Text size="sm" fw={500}>
                            {formatDateTime(slot.start || '')}
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {appointmentTypes.find(t => t.code === selectedType)?.duration || 
                            (slot.start && slot.end ? 
                              Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000) : 0)} {t('common.min')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">
                          {appointmentTypes.find(t => t.code === selectedType)?.display || t('appointment.general')}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => handleBookSlot(slot)}
                        >
                          {t('appointment.book')}
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          ) : (
            <Text c="dimmed">{t('appointment.noSlots')}</Text>
          )}
        </Stack>
      </Paper>
    </Document>
  );
}

