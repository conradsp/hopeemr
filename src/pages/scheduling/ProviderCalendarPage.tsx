import { Paper, Title, Text, Stack, Group, Button, Select, Table, Badge, ActionIcon, Modal, Textarea } from '@mantine/core';
import { Appointment, Practitioner, Slot, Schedule } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX, IconUser, IconClock } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { getPractitionerAppointments, cancelAppointment, checkInPatient, fulfillAppointment, markNoShow } from '../../utils/appointmentUtils';
import { getPractitionerSchedules, getScheduleSlots } from '../../utils/scheduleUtils';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { useNavigate } from 'react-router';
import { notifications } from '@mantine/notifications';
import { logger } from '../../utils/logger';
import styles from './ProviderCalendarPage.module.css';

interface SlotWithAppointment {
  slot: Slot;
  appointment?: Appointment;
  schedule: Schedule;
}

export function ProviderCalendarPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [slotsWithAppointments, setSlotsWithAppointments] = useState<SlotWithAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    loadPractitioners();
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, [medplum]);

  useEffect(() => {
    if (selectedPractitioner && selectedDate) {
      loadDayView();
    }
  }, [selectedPractitioner, selectedDate, medplum]);

  const loadPractitioners = async () => {
    try {
      const result = await medplum.search('Practitioner', {
        _count: '100',
        _sort: 'name',
      });
      const practitionerList = (result.entry?.map(e => e.resource as Practitioner) || []);
      setPractitioners(practitionerList);
      
      if (practitionerList.length > 0 && !selectedPractitioner) {
        setSelectedPractitioner(practitionerList[0].id || null);
      }
    } catch (error) {
      logger.error('Failed to load practitioners', error);
    }
  };

  const loadDayView = async () => {
    if (!selectedPractitioner || !selectedDate) return;
    
    setLoading(true);
    try {
        // Get all schedules for this practitioner
      const schedules = await getPractitionerSchedules(medplum, selectedPractitioner);
      
      if (schedules.length === 0) {
        setSlotsWithAppointments([]);
        setLoading(false);
        return;
      }

      // Get all slots for this date across all schedules
      const startOfDay = `${selectedDate}T00:00:00Z`;
      const endOfDay = `${selectedDate}T23:59:59Z`;
      
      const allSlotsPromises = schedules.map(schedule => 
        getScheduleSlots(medplum, schedule.id!, startOfDay, endOfDay)
      );
      
      const slotsArrays = await Promise.all(allSlotsPromises);
      const allSlots = slotsArrays.flat();

      // Get all appointments for this date
      const appointments = await getPractitionerAppointments(medplum, selectedPractitioner, selectedDate);

      // Match slots with appointments
      const slotsWithAppts: SlotWithAppointment[] = allSlots.map(slot => {
        const appointment = appointments.find(appt => 
          appt.slot?.some(s => s.reference === `Slot/${slot.id}`)
        );
        const schedule = schedules.find(s => s.id === slot.schedule?.reference?.split('/')[1]);
        
        return {
          slot,
          appointment,
          schedule: schedule!,
        };
      });

      // Sort by start time
      slotsWithAppts.sort((a, b) => {
        if (!a.slot.start || !b.slot.start) {return 0;}
        return new Date(a.slot.start).getTime() - new Date(b.slot.start).getTime();
      });

      setSlotsWithAppointments(slotsWithAppts);
    } catch (error) {
      logger.error('Failed to load day view', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (direction: 'prev' | 'next') => {
    const currentDate = new Date(selectedDate);
    if (direction === 'prev') {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  const handleCheckIn = async (appointment: Appointment) => {
    try {
      await checkInPatient(medplum, appointment.id!);
      await loadDayView();
      notifications.show({
        title: 'Success',
        message: 'Patient checked in successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to check in patient',
        color: 'red',
      });
    }
  };

  const handleComplete = async (appointment: Appointment) => {
    try {
      await fulfillAppointment(medplum, appointment.id!);
      await loadDayView();
      notifications.show({
        title: 'Success',
        message: 'Appointment completed successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to complete appointment',
        color: 'red',
      });
    }
  };

  const handleNoShow = async (appointment: Appointment) => {
    if (confirm('Mark this appointment as no-show?')) {
      try {
        await markNoShow(medplum, appointment.id!);
        await loadDayView();
        notifications.show({
          title: 'Success',
          message: 'Appointment marked as no-show',
          color: 'orange',
        });
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to mark as no-show',
          color: 'red',
        });
      }
    }
  };

  const handleCancelClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
  };

  const handleConfirmCancel = async () => {
    if (!selectedAppointment?.id) {return;}
    
    setCancelLoading(true);
    try {
      await cancelAppointment(medplum, selectedAppointment.id, cancelReason);
      notifications.show({
        title: 'Success',
        message: 'Appointment cancelled successfully',
        color: 'green',
      });
      setSelectedAppointment(null);
      setCancelReason('');
      await loadDayView();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to cancel appointment',
        color: 'red',
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const practitionerOptions = practitioners.map(p => ({
    value: p.id || '',
    label: p.name?.[0]?.text || [p.name?.[0]?.given?.[0], p.name?.[0]?.family].filter(Boolean).join(' ') || 'Unknown',
  }));

  const getPatientName = (appointment?: Appointment): string => {
    if (!appointment) return '-';
    const patientParticipant = appointment.participant?.find(
      p => p.actor?.reference?.startsWith('Patient/')
    );
    return patientParticipant?.actor?.display || 'Unknown Patient';
  };

  const getStatusColor = (status?: string): string => {
    if (!status) return 'gray';
    switch (status) {
      case 'booked': return 'blue';
      case 'arrived': return 'cyan';
      case 'fulfilled': return 'green';
      case 'cancelled': return 'red';
      case 'noshow': return 'orange';
      default: return 'gray';
    }
  };

  const getSlotStatusColor = (slot: Slot): string => {
    switch (slot.status) {
      case 'free': return 'green';
      case 'busy': return 'blue';
      case 'busy-unavailable': return 'gray';
      case 'busy-tentative': return 'yellow';
      default: return 'gray';
    }
  };

  return (
    <Document>
      <BreadcrumbNav />
      
      <Modal
        opened={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        title="Cancel Appointment"
        centered
      >
        <Stack>
          <Text size="sm">
            Are you sure you want to cancel this appointment?
          </Text>
          
          <Textarea
            label="Cancellation Reason (Optional)"
            placeholder="Reason for cancellation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            rows={3}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setSelectedAppointment(null)}>
              Keep Appointment
            </Button>
            <Button 
              color="red"
              onClick={handleConfirmCancel} 
              loading={cancelLoading}
              leftSection={<IconX size={16} />}
            >
              Cancel Appointment
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
                Provider Calendar
              </Group>
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              View daily schedule with all slots and appointments
            </Text>
          </div>
        </Group>

        <Group mb="lg" align="flex-end">
          <Select
            label="Provider"
            placeholder="Select a provider"
            data={practitionerOptions}
            value={selectedPractitioner}
            onChange={setSelectedPractitioner}
            className={styles.select}
          />

          <Group>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => handleDateChange('prev')}
            >
              <IconChevronLeft size={20} />
            </ActionIcon>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className={styles.dateInput}
            />
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => handleDateChange('next')}
            >
              <IconChevronRight size={20} />
            </ActionIcon>
          </Group>

          <Button
            variant="light"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          >
            Today
          </Button>
        </Group>

        {loading ? (
          <Loading />
        ) : slotsWithAppointments.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="sm">
              <IconCalendar size={48} className={styles.emptyIcon} />
              <Text ta="center" c="dimmed" fw={500} size="lg">
                No slots available for {selectedDate}
              </Text>
              <Text ta="center" c="dimmed" size="sm">
                This provider may not have scheduled hours on this date.
                <br />
                Try navigating to a different date using the arrows above, or create a schedule at{' '}
                <Text component="span" c="blue" className={styles.linkText} onClick={() => navigate('/scheduling/manage')}>
                  Scheduling → Manage Schedules
                </Text>
              </Text>
              <Group mt="md">
                <Button
                  variant="light"
                  onClick={() => handleDateChange('prev')}
                  leftSection={<IconChevronLeft size={16} />}
                >
                  Previous Day
                </Button>
                <Button
                  variant="light"
                  onClick={() => handleDateChange('next')}
                  rightSection={<IconChevronRight size={16} />}
                >
                  Next Day
                </Button>
              </Group>
            </Stack>
          </Paper>
        ) : (
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Time</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Patient</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {slotsWithAppointments.map((item) => {
                const { slot, appointment } = item;
                const isBooked = slot.status === 'busy' && appointment;
                
                return (
                  <Table.Tr 
                    key={slot.id} 
                    className={!isBooked && slot.status === 'free' ? styles.freeSlot : undefined}
                  >
                    <Table.Td>
                      <Group gap="xs">
                        <IconClock size={16} />
                        <Text size="sm" fw={500}>
                          {slot.start ? new Date(slot.start).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '-'}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {slot.start && slot.end ? 
                          Math.round((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000) : 0} min
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge color={getSlotStatusColor(slot)} variant="dot" size="sm">
                          {slot.status === 'free' ? 'Available' : slot.status}
                        </Badge>
                        {appointment && (
                          <Badge color={getStatusColor(appointment.status)} variant="light" size="sm">
                            {appointment.status}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {isBooked ? (
                        <Group gap="xs">
                          <IconUser size={16} />
                          <Text size="sm">{getPatientName(appointment)}</Text>
                        </Group>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {isBooked && appointment ? (
                          appointment.appointmentType?.coding?.[0]?.display || 
                          appointment.serviceType?.[0]?.coding?.[0]?.display || 
                          'General'
                        ) : (
                          <Text c="dimmed">
                            {slot.serviceType?.[0]?.coding?.[0]?.display || 'Any'}
                          </Text>
                        )}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {isBooked && appointment?.reasonCode?.[0]?.text ? appointment.reasonCode[0].text : '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {isBooked && appointment ? (
                        <Group gap="xs">
                          {appointment.status === 'booked' && (
                            <>
                              <Button
                                size="xs"
                                variant="light"
                                color="green"
                                onClick={() => handleCheckIn(appointment)}
                              >
                                Check In
                              </Button>
                              <Button
                                size="xs"
                                variant="light"
                                color="red"
                                onClick={() => handleCancelClick(appointment)}
                              >
                                Cancel
                              </Button>
                            </>
                          )}
                          {appointment.status === 'arrived' && (
                            <>
                              <Button
                                size="xs"
                                variant="light"
                                color="green"
                                onClick={() => handleComplete(appointment)}
                              >
                                Complete
                              </Button>
                              <Button
                                size="xs"
                                variant="light"
                                color="orange"
                                onClick={() => handleNoShow(appointment)}
                              >
                                No Show
                              </Button>
                            </>
                          )}
                        </Group>
                      ) : slot.status === 'free' ? (
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => navigate('/scheduling/book')}
                        >
                          Book
                        </Button>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Document>
  );
}
