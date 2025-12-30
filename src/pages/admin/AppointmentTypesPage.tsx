import { Paper, Title, Text, Stack, Group, Button, Table, Badge, ActionIcon, ColorSwatch } from '@mantine/core';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconPlus, IconEdit, IconTrash, IconClock, IconCalendar } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  getAppointmentTypes, 
  initializeAppointmentTypes,
  deleteAppointmentType,
  AppointmentTypeDefinition 
} from '../../utils/appointmentTypes';
import { EditAppointmentTypeModal } from '../../components/admin/EditAppointmentTypeModal';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { showSuccess, handleError } from '../../utils/errorHandling';
import styles from './AppointmentTypesPage.module.css';

export function AppointmentTypesPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [types, setTypes] = useState<AppointmentTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AppointmentTypeDefinition | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<AppointmentTypeDefinition | null>(null);

  const loadTypes = async () => {
    setLoading(true);
    const result = await getAppointmentTypes(medplum);
    setTypes(result);
    setLoading(false);
  };

  useEffect(() => {
    loadTypes();
  }, [medplum]);

  const handleInitializeDefaults = async () => {
    setInitializing(true);
    try {
      await initializeAppointmentTypes(medplum);
      await loadTypes();
      showSuccess(t('admin.appointmentTypes.initializeSuccess'));
    } catch (error) {
      handleError(error, t('message.error.initialize'));
    } finally {
      setInitializing(false);
    }
  };

  const handleEdit = (type: AppointmentTypeDefinition) => {
    setSelectedType(type);
    setEditModalOpen(true);
  };

  const handleNew = () => {
    setSelectedType(null);
    setEditModalOpen(true);
  };

  const handleDelete = async (type: AppointmentTypeDefinition) => {
    setTypeToDelete(type);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!typeToDelete) return;
    
    setConfirmOpen(false);
    try {
      await deleteAppointmentType(medplum, typeToDelete.code);
      await loadTypes();
      showSuccess(t('admin.appointmentTypes.deleteSuccess'));
    } catch (error) {
      handleError(error, t('message.error.delete'));
    } finally {
      setTypeToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmOpen(false);
    setTypeToDelete(null);
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedType(null);
    loadTypes();
  };

  return (
    <Document>
      <BreadcrumbNav />
      
      <EditAppointmentTypeModal
        opened={editModalOpen}
        onClose={handleModalClose}
        appointmentType={selectedType}
      />

      <ConfirmDialog
        opened={confirmOpen}
        title={t('common.confirmDelete')}
        message={t('admin.appointmentTypes.confirmDelete', { name: typeToDelete?.display })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <Paper shadow="sm" p="lg" withBorder className={styles.paper}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconCalendar size={28} />
                {t('admin.appointmentTypes.title')}
              </Group>
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              {t('admin.appointmentTypes.subtitle')}
            </Text>
          </div>
          <Group>
            {types.length === 0 && (
              <Button
                variant="light"
                onClick={handleInitializeDefaults}
                loading={initializing}
              >
                {t('admin.appointmentTypes.initializeDefaults')}
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
              {t('admin.appointmentTypes.new')}
            </Button>
          </Group>
        </Group>

        {loading ? (
          <Loading />
        ) : types.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="md">
              <IconCalendar size={48} className={styles.emptyStateIcon} />
              <div className={styles.emptyStateContainer}>
                <Text size="lg" fw={500} mb="xs">
                  {t('admin.appointmentTypes.noTypes')}
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  {t('admin.appointmentTypes.noTypesDescription')}
                </Text>
                <Button
                  onClick={handleInitializeDefaults}
                  loading={initializing}
                  leftSection={<IconPlus size={16} />}
                >
                  {t('admin.appointmentTypes.initializeDefaults')}
                </Button>
              </div>
            </Stack>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('admin.appointmentTypes.color')}</Table.Th>
                <Table.Th>{t('common.name')}</Table.Th>
                <Table.Th>{t('admin.appointmentTypes.code')}</Table.Th>
                <Table.Th>{t('admin.appointmentTypes.duration')}</Table.Th>
                <Table.Th>{t('admin.appointmentTypes.visitFee')}</Table.Th>
                <Table.Th>{t('common.description')}</Table.Th>
                <Table.Th>{t('common.action')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {types.map((type) => (
                <Table.Tr key={type.code}>
                  <Table.Td>
                    <ColorSwatch color={type.color || '#2196F3'} size={24} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {type.display}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {type.code}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <IconClock size={16} className={styles.iconColor} />
                      <Text size="sm">{type.duration} {t('common.minutes')}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      ${(type.visitFee || 0).toFixed(2)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed" lineClamp={1}>
                      {type.description || t('common.dash')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => handleEdit(type)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDelete(type)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
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

