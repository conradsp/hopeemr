import { Modal, TextInput, Button, Group, Stack, Select, MultiSelect, Checkbox, NumberInput, Textarea } from '@mantine/core';
import { Practitioner } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconCheck, IconClock } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { createSchedule, generateSlots, ScheduleTemplate, TimeRange, getDayName } from '../../utils/scheduleUtils';
import { getAppointmentTypes, AppointmentTypeDefinition } from '../../utils/appointmentTypes';
import { notifications } from '@mantine/notifications';
import { logger } from '../../utils/logger';

interface CreateScheduleModalProps {
  opened: boolean;
  onClose: () => void;
  practitioner: Practitioner | null;
}

export function CreateScheduleModal({ 
  opened, 
  onClose, 
  practitioner 
}: CreateScheduleModalProps): JSX.Element {
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentTypeDefinition[]>([]);
  const [formData, setFormData] = useState({
    appointmentType: '',
    startDate: '',
    endDate: '',
    daysOfWeek: [] as string[],
    startTime: '09:00',
    endTime: '17:00',
    slotDuration: 30,
    enableBreak: false,
    breakStart: '12:00',
    breakEnd: '13:00',
  });

  useEffect(() => {
    const loadTypes = async () => {
      const types = await getAppointmentTypes(medplum);
      setAppointmentTypes(types);
    };
    if (opened) {
      loadTypes();
    }
  }, [medplum, opened]);

  useEffect(() => {
    // Set default dates (today and 3 months from now)
    const today = new Date();
    const threeMonthsLater = new Date(today);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
    
    setFormData(prev => ({
      ...prev,
      startDate: today.toISOString().split('T')[0],
      endDate: threeMonthsLater.toISOString().split('T')[0],
    }));
  }, [opened]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!practitioner?.id) {
      notifications.show({
        title: 'Error',
        message: 'No practitioner selected',
        color: 'red',
      });
      return;
    }

    if (formData.daysOfWeek.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select at least one day of the week',
        color: 'red',
      });
      return;
    }

    setLoading(true);

    try {
      // Create the schedule
      const providerName = practitioner.name?.[0]?.text || 
                          [practitioner.name?.[0]?.given?.[0], practitioner.name?.[0]?.family].filter(Boolean).join(' ') ||
                          'Provider';
      
      const schedule = await createSchedule(
        medplum,
        { reference: `Practitioner/${practitioner.id}`, display: providerName },
        `${providerName} Schedule`,
        formData.appointmentType || undefined
      );

      // Generate slots
      const template: ScheduleTemplate = {
        practitioner: { reference: `Practitioner/${practitioner.id}` },
        startDate: formData.startDate,
        endDate: formData.endDate,
        daysOfWeek: formData.daysOfWeek.map(Number),
        startTime: formData.startTime,
        endTime: formData.endTime,
        slotDuration: formData.slotDuration,
        appointmentType: formData.appointmentType || undefined,
        breaks: formData.enableBreak ? [{
          start: formData.breakStart,
          end: formData.breakEnd,
        }] : [],
      };

      logger.debug('Creating schedule', { scheduleId: schedule.id, template });
      
      const generatedSlots = await generateSlots(medplum, schedule, template);
      
      logger.debug('Slot generation complete', { 
        slotsGenerated: generatedSlots.length,
        firstSlot: generatedSlots.length > 0 ? generatedSlots[0] : null,
        lastSlot: generatedSlots.length > 0 ? generatedSlots[generatedSlots.length - 1] : null
      });
      if (generatedSlots.length === 0) {
        logger.warn('No slots were generated for schedule', { scheduleId: schedule.id, template });
      }

      notifications.show({
        title: 'Success',
        message: `Schedule created with ${generatedSlots.length} slots!`,
        color: generatedSlots.length === 0 ? 'orange' : 'green',
      });
      onClose();
    } catch (error) {
      logger.error('Schedule creation failed', error);
      notifications.show({
        title: 'Error',
        message: `Failed to create schedule: ${(error as Error).message}`,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const dayOptions = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
  ];

  const appointmentTypeOptions = [
    { value: '', label: 'All Types' },
    ...appointmentTypes.map(t => ({
      value: t.code,
      label: `${t.display} (${t.duration} min)`,
    })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Schedule"
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Provider"
            value={
              practitioner 
                ? (practitioner.name?.[0]?.text || 
                   [practitioner.name?.[0]?.given?.[0], practitioner.name?.[0]?.family].filter(Boolean).join(' ') || 
                   'Unknown Provider')
                : 'No provider selected'
            }
            disabled
          />

          <Select
            label="Appointment Type (Optional)"
            placeholder="Select appointment type or leave blank for all types"
            data={appointmentTypeOptions}
            value={formData.appointmentType}
            onChange={(value) => {
              const selectedType = appointmentTypes.find(t => t.code === value);
              setFormData({ 
                ...formData, 
                appointmentType: value || '',
                slotDuration: selectedType?.duration || formData.slotDuration
              });
            }}
            description="Leave blank to allow all appointment types"
          />

          <Group grow>
            <TextInput
              label="Start Date"
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.currentTarget.value })}
            />
            <TextInput
              label="End Date"
              type="date"
              required
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.currentTarget.value })}
            />
          </Group>

          <MultiSelect
            label="Days of Week"
            placeholder="Select days"
            required
            data={dayOptions}
            value={formData.daysOfWeek}
            onChange={(value) => setFormData({ ...formData, daysOfWeek: value })}
          />

          <Group grow>
            <TextInput
              label="Start Time"
              type="time"
              required
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.currentTarget.value })}
              leftSection={<IconClock size={16} />}
            />
            <TextInput
              label="End Time"
              type="time"
              required
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.currentTarget.value })}
              leftSection={<IconClock size={16} />}
            />
          </Group>

          <NumberInput
            label="Slot Duration (minutes)"
            required
            min={5}
            max={480}
            step={5}
            value={formData.slotDuration}
            onChange={(value) => setFormData({ ...formData, slotDuration: Number(value) || 30 })}
            description="Duration of each appointment slot"
          />

          <Checkbox
            label="Add Lunch Break"
            checked={formData.enableBreak}
            onChange={(e) => setFormData({ ...formData, enableBreak: e.currentTarget.checked })}
          />

          {formData.enableBreak && (
            <Group grow>
              <TextInput
                label="Break Start"
                type="time"
                value={formData.breakStart}
                onChange={(e) => setFormData({ ...formData, breakStart: e.currentTarget.value })}
                leftSection={<IconClock size={16} />}
              />
              <TextInput
                label="Break End"
                type="time"
                value={formData.breakEnd}
                onChange={(e) => setFormData({ ...formData, breakEnd: e.currentTarget.value })}
                leftSection={<IconClock size={16} />}
              />
            </Group>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconCheck size={16} />}>
              Create Schedule & Generate Slots
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

