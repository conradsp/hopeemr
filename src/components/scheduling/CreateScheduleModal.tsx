import { Modal, TextInput, Button, Group, Stack, Select, MultiSelect, Checkbox, NumberInput, Textarea } from '@mantine/core';
import { Practitioner } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { IconCheck, IconClock } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { createSchedule, generateSlots, ScheduleTemplate, TimeRange, getDayName } from '../../utils/scheduleUtils';
import { getAppointmentTypes, AppointmentTypeDefinition } from '../../utils/appointmentTypes';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        title: t('common.error', 'Error'),
        message: t('scheduling.noPractitionerSelected', 'No practitioner selected'),
        color: 'red',
      });
      return;
    }

    if (formData.daysOfWeek.length === 0) {
      notifications.show({
        title: t('common.error', 'Error'),
        message: t('scheduling.selectAtLeastOneDay', 'Please select at least one day of the week'),
        color: 'red',
      });
      return;
    }

    setLoading(true);

    try {
      // Create the schedule
      const providerName = practitioner.name?.[0]?.text ||
                          [practitioner.name?.[0]?.given?.[0], practitioner.name?.[0]?.family].filter(Boolean).join(' ') ||
                          t('common.provider', 'Provider');

      const schedule = await createSchedule(
        medplum,
        { reference: `Practitioner/${practitioner.id}`, display: providerName },
        t('scheduling.providerScheduleName', '{{provider}} Schedule', { provider: providerName }),
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
        title: t('common.success', 'Success'),
        message: t('scheduling.scheduleCreatedWithSlots', 'Schedule created with {{count}} slots!', { count: generatedSlots.length }),
        color: generatedSlots.length === 0 ? 'orange' : 'green',
      });
      onClose();
    } catch (error) {
      logger.error('Schedule creation failed', error);
      notifications.show({
        title: t('common.error', 'Error'),
        message: t('scheduling.failedCreateSchedule', 'Failed to create schedule: {{error}}', { error: (error as Error).message }),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const dayOptions = [
    { value: '0', label: t('scheduling.days.sunday', 'Sunday') },
    { value: '1', label: t('scheduling.days.monday', 'Monday') },
    { value: '2', label: t('scheduling.days.tuesday', 'Tuesday') },
    { value: '3', label: t('scheduling.days.wednesday', 'Wednesday') },
    { value: '4', label: t('scheduling.days.thursday', 'Thursday') },
    { value: '5', label: t('scheduling.days.friday', 'Friday') },
    { value: '6', label: t('scheduling.days.saturday', 'Saturday') },
  ];

  const appointmentTypeOptions = [
    { value: '', label: t('scheduling.allTypes', 'All Types') },
    ...appointmentTypes.map(at => ({
      value: at.code,
      label: t('scheduling.appointmentTypeWithDuration', '{{display}} ({{duration}} min)', { display: at.display, duration: at.duration }),
    })),
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('scheduling.createSchedule', 'Create Schedule')}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label={t('common.provider', 'Provider')}
            value={
              practitioner
                ? (practitioner.name?.[0]?.text ||
                   [practitioner.name?.[0]?.given?.[0], practitioner.name?.[0]?.family].filter(Boolean).join(' ') ||
                   t('scheduling.unknownProvider', 'Unknown Provider'))
                : t('scheduling.noProviderSelected', 'No provider selected')
            }
            disabled
          />

          <Select
            label={t('scheduling.appointmentTypeOptional', 'Appointment Type (Optional)')}
            placeholder={t('scheduling.appointmentTypePlaceholder', 'Select appointment type or leave blank for all types')}
            data={appointmentTypeOptions}
            value={formData.appointmentType}
            onChange={(value) => {
              const selectedType = appointmentTypes.find(at => at.code === value);
              setFormData({
                ...formData,
                appointmentType: value || '',
                slotDuration: selectedType?.duration || formData.slotDuration
              });
            }}
            description={t('scheduling.appointmentTypeDescription', 'Leave blank to allow all appointment types')}
          />

          <Group grow>
            <TextInput
              label={t('scheduling.startDate', 'Start Date')}
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.currentTarget.value })}
            />
            <TextInput
              label={t('scheduling.endDate', 'End Date')}
              type="date"
              required
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.currentTarget.value })}
            />
          </Group>

          <MultiSelect
            label={t('scheduling.daysOfWeek', 'Days of Week')}
            placeholder={t('scheduling.selectDays', 'Select days')}
            required
            data={dayOptions}
            value={formData.daysOfWeek}
            onChange={(value) => setFormData({ ...formData, daysOfWeek: value })}
          />

          <Group grow>
            <TextInput
              label={t('scheduling.startTime', 'Start Time')}
              type="time"
              required
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.currentTarget.value })}
              leftSection={<IconClock size={16} />}
            />
            <TextInput
              label={t('scheduling.endTime', 'End Time')}
              type="time"
              required
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.currentTarget.value })}
              leftSection={<IconClock size={16} />}
            />
          </Group>

          <NumberInput
            label={t('scheduling.slotDurationMinutes', 'Slot Duration (minutes)')}
            required
            min={5}
            max={480}
            step={5}
            value={formData.slotDuration}
            onChange={(value) => setFormData({ ...formData, slotDuration: Number(value) || 30 })}
            description={t('scheduling.slotDurationDescription', 'Duration of each appointment slot')}
          />

          <Checkbox
            label={t('scheduling.addLunchBreak', 'Add Lunch Break')}
            checked={formData.enableBreak}
            onChange={(e) => setFormData({ ...formData, enableBreak: e.currentTarget.checked })}
          />

          {formData.enableBreak && (
            <Group grow>
              <TextInput
                label={t('scheduling.breakStart', 'Break Start')}
                type="time"
                value={formData.breakStart}
                onChange={(e) => setFormData({ ...formData, breakStart: e.currentTarget.value })}
                leftSection={<IconClock size={16} />}
              />
              <TextInput
                label={t('scheduling.breakEnd', 'Break End')}
                type="time"
                value={formData.breakEnd}
                onChange={(e) => setFormData({ ...formData, breakEnd: e.currentTarget.value })}
                leftSection={<IconClock size={16} />}
              />
            </Group>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconCheck size={16} />}>
              {t('scheduling.createScheduleAndSlots', 'Create Schedule & Generate Slots')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

