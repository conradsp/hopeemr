import { Paper, Title, Text, Stack, Group, Button, Table, Badge, ActionIcon, Select, Menu } from '@mantine/core';
import { Schedule, Practitioner } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconPlus, IconCalendar, IconToggleLeft, IconToggleRight, IconTrash, IconSettings, IconDotsVertical, IconTrashX } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { getPractitionerSchedules, updateScheduleStatus, deleteFutureSlots, deleteSchedule } from '../../utils/scheduleUtils';
import { CreateScheduleModal } from '../../components/scheduling/CreateScheduleModal';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { notifications } from '@mantine/notifications';
import { logger } from '../../utils/logger';
import styles from './ScheduleManagementPage.module.css';

export function ScheduleManagementPage(): JSX.Element {
  const medplum = useMedplum();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    loadPractitioners();
  }, [medplum]);

  useEffect(() => {
    if (selectedPractitioner) {
      loadSchedules(selectedPractitioner);
    }
  }, [selectedPractitioner, medplum]);

  const loadPractitioners = async () => {
    try {
      const result = await medplum.search('Practitioner', {
        _count: '100',
        _sort: 'name',
      });
      const practitionerList = (result.entry?.map(e => e.resource as Practitioner) || []);
      setPractitioners(practitionerList);
      
      // Auto-select first practitioner
      if (practitionerList.length > 0 && !selectedPractitioner) {
        setSelectedPractitioner(practitionerList[0].id || null);
      }
    } catch (error) {
      logger.error('Failed to load practitioners', error);
    }
  };

  const loadSchedules = async (practitionerId: string) => {
    setLoading(true);
    try {
      const result = await getPractitionerSchedules(medplum, practitionerId);
      setSchedules(result);
    } catch (error) {
      logger.error('Failed to load schedules', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (schedule: Schedule) => {
    try {
      await updateScheduleStatus(medplum, schedule.id!, !schedule.active);
      if (selectedPractitioner) {
        await loadSchedules(selectedPractitioner);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update schedule status',
        color: 'red',
      });
    }
  };

  const handleDeleteFutureSlots = async (schedule: Schedule) => {
    if (confirm('Are you sure you want to delete all future available slots for this schedule? The schedule will remain but all unbooked slots will be removed.')) {
      try {
        await deleteFutureSlots(medplum, schedule.id!);
        notifications.show({
          title: 'Success',
          message: 'Future slots deleted successfully',
          color: 'green',
        });
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to delete slots',
          color: 'red',
        });
      }
    }
  };

  const handleDeleteSchedule = async (schedule: Schedule) => {
    if (confirm('Are you sure you want to permanently DELETE this entire schedule? This will remove the schedule and all its slots. This action cannot be undone.')) {
      try {
        await deleteSchedule(medplum, schedule.id!);
        notifications.show({
          title: 'Success',
          message: 'Schedule deleted successfully',
          color: 'green',
        });
        if (selectedPractitioner) {
          await loadSchedules(selectedPractitioner);
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: 'Failed to delete schedule',
          color: 'red',
        });
      }
    }
  };

  const handleModalClose = () => {
    setCreateModalOpen(false);
    if (selectedPractitioner) {
      loadSchedules(selectedPractitioner);
    }
  };

  const practitionerOptions = practitioners.map(p => ({
    value: p.id || '',
    label: p.name?.[0]?.text || [p.name?.[0]?.given?.[0], p.name?.[0]?.family].filter(Boolean).join(' ') || 'Unknown',
  }));

  const selectedPractitionerData = practitioners.find(p => p.id === selectedPractitioner);

  return (
    <Document>
      <BreadcrumbNav />
      
      <CreateScheduleModal
        opened={createModalOpen}
        onClose={handleModalClose}
        practitioner={selectedPractitionerData || null}
      />

      <Paper shadow="sm" p="lg" withBorder className={styles.paper}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconCalendar size={28} />
                Schedule Management
              </Group>
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              Manage provider schedules and availability
            </Text>
          </div>
        </Group>

        <Group mb="lg" align="flex-end">
          <Select
            label="Select Provider"
            placeholder="Choose a provider"
            data={practitionerOptions}
            value={selectedPractitioner}
            onChange={setSelectedPractitioner}
            className={styles.select}
          />
          <Button 
            leftSection={<IconPlus size={16} />} 
            onClick={() => setCreateModalOpen(true)}
            disabled={!selectedPractitioner}
          >
            Create Schedule
          </Button>
        </Group>

        {loading ? (
          <Loading />
        ) : !selectedPractitioner ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Text ta="center" c="dimmed">
              Select a provider to view their schedules
            </Text>
          </Paper>
        ) : schedules.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="md">
              <IconCalendar size={48} className={styles.emptyIcon} />
              <div className={styles.emptyContainer}>
                <Text size="lg" fw={500} mb="xs">
                  No Schedules Found
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  Create a schedule to start accepting appointments
                </Text>
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  leftSection={<IconPlus size={16} />}
                >
                  Create Schedule
                </Button>
              </div>
            </Stack>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Status</Table.Th>
                <Table.Th>Service Type</Table.Th>
                <Table.Th>Planning Horizon</Table.Th>
                <Table.Th>Notes</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {schedules.map((schedule) => (
                <Table.Tr key={schedule.id}>
                  <Table.Td>
                    <Badge color={schedule.active ? 'green' : 'gray'} variant="light">
                      {schedule.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {schedule.serviceType?.[0]?.coding?.[0]?.display || 'General'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {schedule.planningHorizon?.start ? 
                        new Date(schedule.planningHorizon.start).toLocaleDateString() : '-'}
                      {schedule.planningHorizon?.end && 
                        ` - ${new Date(schedule.planningHorizon.end).toLocaleDateString()}`}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {schedule.comment || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color={schedule.active ? 'green' : 'red'}
                        onClick={() => handleToggleStatus(schedule)}
                        title={schedule.active ? 'Deactivate' : 'Activate'}
                      >
                        {schedule.active ? <IconToggleRight size={16} /> : <IconToggleLeft size={16} />}
                      </ActionIcon>
                      <Menu position="bottom-end">
                        <Menu.Target>
                          <ActionIcon variant="light" color="gray">
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Label>Schedule Actions</Menu.Label>
                          <Menu.Item
                            leftSection={<IconTrash size={16} />}
                            onClick={() => handleDeleteFutureSlots(schedule)}
                            color="orange"
                          >
                            Delete Future Slots
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrashX size={16} />}
                            onClick={() => handleDeleteSchedule(schedule)}
                            color="red"
                          >
                            Delete Entire Schedule
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Document>
  );
}

