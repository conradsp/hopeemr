import { Paper, Title, Text, Stack, Group, Button, Table, Badge, ActionIcon, Select, Menu } from '@mantine/core';
import { Schedule, Practitioner } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconPlus, IconCalendar, IconToggleLeft, IconToggleRight, IconTrash, IconSettings, IconDotsVertical, IconTrashX } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getPractitionerSchedules, updateScheduleStatus, deleteFutureSlots, deleteSchedule } from '../../utils/scheduleUtils';
import { CreateScheduleModal } from '../../components/scheduling/CreateScheduleModal';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { notifications } from '@mantine/notifications';
import { logger } from '../../utils/logger';
import styles from './ScheduleManagementPage.module.css';

type PendingScheduleDelete = { schedule: Schedule; mode: 'futureSlots' | 'entireSchedule' };

export function ScheduleManagementPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [selectedPractitioner, setSelectedPractitioner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingScheduleDelete | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        title: t('common.error', 'Error'),
        message: t('scheduling.failedUpdateStatus', 'Failed to update schedule status'),
        color: 'red',
      });
    }
  };

  const handleDeleteFutureSlots = (schedule: Schedule): void => {
    setPendingDelete({ schedule, mode: 'futureSlots' });
    setConfirmOpen(true);
  };

  const handleDeleteSchedule = (schedule: Schedule): void => {
    setPendingDelete({ schedule, mode: 'entireSchedule' });
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!pendingDelete?.schedule.id || deleting) return;

    setDeleting(true);
    try {
      if (pendingDelete.mode === 'futureSlots') {
        await deleteFutureSlots(medplum, pendingDelete.schedule.id);
        notifications.show({
          title: t('common.success', 'Success'),
          message: t('scheduling.futureSlotsDeletedSuccess', 'Future slots deleted successfully'),
          color: 'green',
        });
      } else {
        await deleteSchedule(medplum, pendingDelete.schedule.id);
        notifications.show({
          title: t('common.success', 'Success'),
          message: t('scheduling.scheduleDeletedSuccess', 'Schedule deleted successfully'),
          color: 'green',
        });
      }
      if (selectedPractitioner) {
        await loadSchedules(selectedPractitioner);
      }
    } catch (error) {
      notifications.show({
        title: t('common.error', 'Error'),
        message: pendingDelete.mode === 'futureSlots'
          ? t('scheduling.failedDeleteSlots', 'Failed to delete slots')
          : t('scheduling.failedDeleteSchedule', 'Failed to delete schedule'),
        color: 'red',
      });
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  };

  const handleDeleteCancel = (): void => {
    if (deleting) return;
    setConfirmOpen(false);
    setPendingDelete(null);
  };

  const handleModalClose = () => {
    setCreateModalOpen(false);
    if (selectedPractitioner) {
      loadSchedules(selectedPractitioner);
    }
  };

  const practitionerOptions = practitioners.map(p => ({
    value: p.id || '',
    label: p.name?.[0]?.text || [p.name?.[0]?.given?.[0], p.name?.[0]?.family].filter(Boolean).join(' ') || t('common.unknown', 'Unknown'),
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
                {t('scheduling.scheduleManagement', 'Schedule Management')}
              </Group>
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              {t('scheduling.manageProviderSchedules', 'Manage provider schedules and availability')}
            </Text>
          </div>
        </Group>

        <Group mb="lg" align="flex-end">
          <Select
            label={t('scheduling.selectProvider', 'Select Provider')}
            placeholder={t('scheduling.chooseProvider', 'Choose a provider')}
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
            {t('scheduling.createSchedule', 'Create Schedule')}
          </Button>
        </Group>

        {loading ? (
          <Loading />
        ) : !selectedPractitioner ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Text ta="center" c="dimmed">
              {t('scheduling.selectProviderToViewSchedules', 'Select a provider to view their schedules')}
            </Text>
          </Paper>
        ) : schedules.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="md">
              <IconCalendar size={48} className={styles.emptyIcon} />
              <div className={styles.emptyContainer}>
                <Text size="lg" fw={500} mb="xs">
                  {t('scheduling.noSchedulesFound', 'No Schedules Found')}
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  {t('scheduling.createScheduleToAcceptAppointments', 'Create a schedule to start accepting appointments')}
                </Text>
                <Button
                  onClick={() => setCreateModalOpen(true)}
                  leftSection={<IconPlus size={16} />}
                >
                  {t('scheduling.createSchedule', 'Create Schedule')}
                </Button>
              </div>
            </Stack>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('scheduling.status', 'Status')}</Table.Th>
                <Table.Th>{t('scheduling.serviceType', 'Service Type')}</Table.Th>
                <Table.Th>{t('scheduling.planningHorizon', 'Planning Horizon')}</Table.Th>
                <Table.Th>{t('scheduling.notes', 'Notes')}</Table.Th>
                <Table.Th>{t('scheduling.actions', 'Actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {schedules.map((schedule) => (
                <Table.Tr key={schedule.id}>
                  <Table.Td>
                    <Badge color={schedule.active ? 'green' : 'gray'} variant="light">
                      {schedule.active ? t('scheduling.active', 'Active') : t('scheduling.inactive', 'Inactive')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {schedule.serviceType?.[0]?.coding?.[0]?.display || t('scheduling.general', 'General')}
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
                        title={schedule.active ? t('scheduling.deactivate', 'Deactivate') : t('scheduling.activate', 'Activate')}
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
                          <Menu.Label>{t('scheduling.scheduleActions', 'Schedule Actions')}</Menu.Label>
                          <Menu.Item
                            leftSection={<IconTrash size={16} />}
                            onClick={() => handleDeleteFutureSlots(schedule)}
                            color="orange"
                          >
                            {t('scheduling.deleteFutureSlots', 'Delete Future Slots')}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconTrashX size={16} />}
                            onClick={() => handleDeleteSchedule(schedule)}
                            color="red"
                          >
                            {t('scheduling.deleteEntireSchedule', 'Delete Entire Schedule')}
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
      <ConfirmDialog
        opened={confirmOpen}
        title={
          pendingDelete?.mode === 'entireSchedule'
            ? t('scheduling.confirmDeleteScheduleTitle')
            : t('scheduling.confirmDeleteFutureSlotsTitle')
        }
        message={
          pendingDelete?.mode === 'entireSchedule'
            ? t('scheduling.confirmDeleteScheduleMessage')
            : t('scheduling.confirmDeleteFutureSlotsMessage')
        }
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleting}
      />
    </Document>
  );
}

