import { Paper, Title, Table, Text, Badge, Group, Button, Tabs, ActionIcon, Tooltip } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { Practitioner, ProjectMembership } from '@medplum/fhirtypes';
import { Document, Loading, useSearchResources, useMedplum } from '@medplum/react';
import { IconUser, IconStethoscope, IconPlus, IconShield, IconTrash } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { NewProviderModal } from '../../components/admin/NewProviderModal';
import { EditUserRolesModal } from '../../components/admin/EditUserRolesModal';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { getUserRoles } from '../../utils/permissionUtils';
import { ROLE_LABELS } from '../../utils/permissions';
import { useTranslation } from 'react-i18next';
import { notifications } from '@mantine/notifications';
import styles from './ManageUsersPage.module.css';

export function ManageUsersPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [activeTab, setActiveTab] = useState<string>('practitioners');
  const [newProviderModalOpen, setNewProviderModalOpen] = useState(false);
  const [editRolesModalOpen, setEditRolesModalOpen] = useState(false);
  const [selectedPractitioner, setSelectedPractitioner] = useState<Practitioner | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [practitionerToDelete, setPractitionerToDelete] = useState<Practitioner | null>(null);
  
  const [practitioners, practitionersLoading] = useSearchResources('Practitioner', {
    _count: '50',
    _sort: '-_lastUpdated',
    _: refreshKey
  });

  const [patients, patientsLoading] = useSearchResources('Patient', {
    _count: '50',
    _sort: '-_lastUpdated',
    _: refreshKey
  });

  const handleEditRoles = (practitioner: Practitioner): void => {
    setSelectedPractitioner(practitioner);
    setEditRolesModalOpen(true);
  };

  const handleRolesModalClose = (): void => {
    setEditRolesModalOpen(false);
    setSelectedPractitioner(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleDeletePractitioner = (practitioner: Practitioner): void => {
    setPractitionerToDelete(practitioner);
    setConfirmDialogOpen(true);
  };

  const confirmDelete = async (): Promise<void> => {
    setConfirmDialogOpen(false);
    const practitioner = practitionerToDelete;
    if (!practitioner || !practitioner.id) {
      notifications.show({
        title: t('users.deleteErrorTitle'),
        message: t('users.deleteErrorMessage'),
        color: 'red',
      });
      return;
    }
    try {
      // Find and delete ProjectMembership(s) associated with this Practitioner
      const memberships = await medplum.searchResources('ProjectMembership', {
        profile: `Practitioner/${practitioner.id}`,
      }) as ProjectMembership[];

      for (const membership of memberships) {
        if (membership.id) {
          // Get the user reference before deleting membership
          const userRef = membership.user?.reference;
          
          // Delete the ProjectMembership
          await medplum.deleteResource('ProjectMembership', membership.id);
          
          // Delete the User if it exists
          if (userRef) {
            const userId = userRef.split('/')[1];
            if (userId) {
              try {
                await medplum.deleteResource('User', userId);
              } catch {
                // User might not exist or already deleted, continue
                console.warn(`Could not delete User ${userId}, may not exist`);
              }
            }
          }
        }
      }

      // Delete the Practitioner
      await medplum.deleteResource('Practitioner', practitioner.id);
      
      notifications.show({
        title: t('users.deleteSuccessTitle'),
        message: t('users.deleteSuccessMessage'),
        color: 'green',
      });
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting practitioner:', error);
      notifications.show({
        title: t('users.deleteErrorTitle'),
        message: t('users.deleteErrorMessage'),
        color: 'red',
      });
    }
  };

  return (
    <Document>
      <NewProviderModal 
        opened={newProviderModalOpen} 
        onClose={() => {
          setNewProviderModalOpen(false);
          setRefreshKey(prev => prev + 1);
        }} 
      />
      <EditUserRolesModal 
        opened={editRolesModalOpen} 
        onClose={handleRolesModalClose}
        practitioner={selectedPractitioner}
      />
      <ConfirmDialog
        opened={confirmDialogOpen}
        onCancel={() => setConfirmDialogOpen(false)}
        onConfirm={confirmDelete}
        title={t('users.deleteConfirmTitle')}
        message={t('users.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
      
      <Paper shadow="sm" p="lg" withBorder className={styles.paper}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>{t('users.manageUsers')}</Title>
            <Text size="sm" c="dimmed">
              {t('users.viewAndManageAllUsers')}
            </Text>
          </div>
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={() => setNewProviderModalOpen(true)}
          >
            {t('users.addProvider')}
          </Button>
        </Group>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'practitioners')}>
          <Tabs.List>
            <Tabs.Tab value="practitioners" leftSection={<IconStethoscope size={16} />}>
              {t('users.practitioners')} {practitioners && `(${practitioners.length})`}
            </Tabs.Tab>
            <Tabs.Tab value="patients" leftSection={<IconUser size={16} />}>
              {t('users.patients')} {patients && `(${patients.length})`}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="practitioners" pt="md">
            {practitionersLoading && <Loading />}
            {!practitionersLoading && (!practitioners || practitioners.length === 0) && (
              <Text size="md" c="dimmed" ta="center" py="xl">
                {t('users.noPractitionersFound')}
              </Text>
            )}
            {!practitionersLoading && practitioners && practitioners.length > 0 && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('users.name')}</Table.Th>
                    <Table.Th>{t('users.roles')}</Table.Th>
                    <Table.Th>{t('users.email')}</Table.Th>
                    <Table.Th>{t('users.phone')}</Table.Th>
                    <Table.Th>{t('users.npi')}</Table.Th>
                    <Table.Th>{t('users.status')}</Table.Th>
                    <Table.Th>{t('users.lastUpdated')}</Table.Th>
                    <Table.Th>{t('users.actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {practitioners.map((practitioner) => {
                    const name =
                      practitioner.name?.[0]?.text ||
                      [practitioner.name?.[0]?.given?.[0], practitioner.name?.[0]?.family]
                        .filter(Boolean)
                        .join(' ') ||
                      'Unknown';
                    const email = practitioner.telecom?.find(t => t.system === 'email')?.value;
                    const phone = practitioner.telecom?.find(t => t.system === 'phone')?.value;
                    const npi = practitioner.identifier?.find(
                      id => id.system === 'http://hl7.org/fhir/sid/us-npi'
                    )?.value;
                    const roles = getUserRoles(practitioner);

                    return (
                      <Table.Tr key={practitioner.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <IconStethoscope size={16} className={styles.practitionerIcon} />
                            <Text size="sm" fw={500}>
                              {name}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            {roles.length > 0 ? (
                              roles.map(role => (
                                <Badge key={role} size="sm" variant="light">
                                  {ROLE_LABELS[role]}
                                </Badge>
                              ))
                            ) : (
                              <Text size="sm" c="dimmed">{t('users.noRoles')}</Text>
                            )}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{email || t('users.unknown')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{phone || t('users.unknown')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{npi || t('users.unknown')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={practitioner.active ? 'green' : 'gray'}
                            variant="light"
                            size="sm"
                          >
                            {practitioner.active ? t('users.active') : t('users.inactive')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {practitioner.meta?.lastUpdated
                              ? formatDateTime(practitioner.meta.lastUpdated)
                              : t('users.unknown')}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Tooltip label={t('users.manageRoles')}>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => handleEditRoles(practitioner)}
                            >
                              <IconShield size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('users.deleteProvider')}>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleDeletePractitioner(practitioner)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="patients" pt="md">
            {patientsLoading && <Loading />}
            {!patientsLoading && (!patients || patients.length === 0) && (
              <Text size="md" c="dimmed" ta="center" py="xl">
                {t('users.noPatientsFound')}
              </Text>
            )}
            {!patientsLoading && patients && patients.length > 0 && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('users.name')}</Table.Th>
                    <Table.Th>{t('users.gender')}</Table.Th>
                    <Table.Th>{t('users.dateOfBirth')}</Table.Th>
                    <Table.Th>{t('users.email')}</Table.Th>
                    <Table.Th>{t('users.phone')}</Table.Th>
                    <Table.Th>{t('users.status')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {patients.map((patient) => {
                    const name =
                      patient.name?.[0]?.text ||
                      [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family]
                        .filter(Boolean)
                        .join(' ') ||
                      'Unknown';
                    const email = patient.telecom?.find(t => t.system === 'email')?.value;
                    const phone = patient.telecom?.find(t => t.system === 'phone')?.value;

                    return (
                      <Table.Tr key={patient.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <IconUser size={16} className={styles.userIcon} />
                            <Text size="sm" fw={500}>
                              {name}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" tt="capitalize">
                            {patient.gender || t('users.unknown')}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{patient.birthDate || t('users.unknown')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{email || t('users.unknown')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{phone || t('users.unknown')}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={patient.active ? 'green' : 'gray'}
                            variant="light"
                            size="sm"
                          >
                            {patient.active !== false ? t('users.active') : t('users.inactive')}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </Document>
  );
}

