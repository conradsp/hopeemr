import { useState, useEffect, JSX } from 'react';
import { Container, Title, Button, Table, Group, Stack, Text, Badge, ActionIcon, Menu } from '@mantine/core';
import { IconPlus, IconRefresh, IconDots, IconEdit, IconTrash } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { Organization } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { getDiagnosticProviders, initializeDefaultDiagnosticProviders, deleteDiagnosticProvider } from '../../utils/diagnosticProviders';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { EditDiagnosticProviderModal } from '../../components/admin/EditDiagnosticProviderModal';
import styles from './DiagnosticProvidersPage.module.css';

export function DiagnosticProvidersPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [providers, setProviders] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Organization | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Organization | null>(null);

  const loadProviders = async () => {
    setLoading(true);
    const provs = await getDiagnosticProviders(medplum);
    setProviders(provs);
    setLoading(false);
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleInitializeDefaults = async () => {
    try {
      await initializeDefaultDiagnosticProviders(medplum);
      showSuccess(t('admin.diagnosticProviders.initializeSuccess'));
      await loadProviders();
    } catch (error) {
      handleError(error, t('admin.diagnosticProviders.initializeError'));
    }
  };

  const handleEdit = (provider: Organization) => {
    setSelectedProvider(provider);
    setEditModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedProvider(null);
    setEditModalOpen(true);
  };

  const handleDelete = (provider: Organization) => {
    setProviderToDelete(provider);
    setConfirmDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!providerToDelete?.identifier || !providerToDelete.identifier[0]?.value) {
      return;
    }

    try {
      await deleteDiagnosticProvider(medplum, providerToDelete.identifier[0].value);
      showSuccess(t('admin.diagnosticProviders.deleteSuccess'));
      await loadProviders();
    } catch (error) {
      handleError(error, t('admin.diagnosticProviders.deleteError'));
    } finally {
      setConfirmDialogOpen(false);
      setProviderToDelete(null);
    }
  };

  const handleModalClose = async (saved: boolean) => {
    setEditModalOpen(false);
    setSelectedProvider(null);
    if (saved) {
      await loadProviders();
    }
  };

  const getProviderType = (provider: Organization): string => {
    const typeExt = provider.extension?.find(e => e.url === 'diagnosticType');
    return typeExt?.valueString || 'unknown';
  };

  const getProviderTypeColor = (type: string): string => {
    switch (type) {
      case 'lab':
        return 'blue';
      case 'imaging':
        return 'grape';
      case 'both':
        return 'teal';
      default:
        return 'gray';
    }
  };

  const getProviderTypeLabel = (type: string): string => {
    switch (type) {
      case 'lab':
        return t('admin.diagnosticProviders.types.lab');
      case 'imaging':
        return t('admin.diagnosticProviders.types.imaging');
      case 'both':
        return t('admin.diagnosticProviders.types.both');
      default:
        return t('admin.diagnosticProviders.types.unknown');
    }
  };

  return (
    <Container size="xl" className={styles.container}>
      <BreadcrumbNav />
      
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>{t('admin.diagnosticProviders.title')}</Title>
          <Text c="dimmed" size="sm">{t('admin.diagnosticProviders.subtitle')}</Text>
        </div>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={handleInitializeDefaults}
          >
            {t('admin.diagnosticProviders.initializeDefaults')}
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreate}
          >
            {t('admin.diagnosticProviders.add')}
          </Button>
        </Group>
      </Group>

      {loading ? (
        <Text>{t('common.loading')}</Text>
      ) : providers.length === 0 ? (
        <Stack align="center" py="xl">
          <Text c="dimmed">{t('admin.diagnosticProviders.noProviders')}</Text>
          <Button onClick={handleInitializeDefaults}>{t('admin.diagnosticProviders.initializeDefaultProviders')}</Button>
        </Stack>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('admin.diagnosticProviders.providerName')}</Table.Th>
              <Table.Th>{t('admin.diagnosticProviders.type')}</Table.Th>
              <Table.Th>{t('admin.diagnosticProviders.phone')}</Table.Th>
              <Table.Th>{t('admin.diagnosticProviders.website')}</Table.Th>
              <Table.Th>{t('admin.diagnosticProviders.status')}</Table.Th>
              <Table.Th className={styles.actionsColumn}>{t('admin.diagnosticProviders.actions')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {providers.map((provider) => {
              const type = getProviderType(provider);
              const phone = provider.telecom?.find(t => t.system === 'phone')?.value;
              const website = provider.telecom?.find(t => t.system === 'url')?.value;

              return (
                <Table.Tr key={provider.id}>
                  <Table.Td>
                    <Text fw={500}>{provider.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={getProviderTypeColor(type)}>
                      {getProviderTypeLabel(type)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{phone || t('common.dash')}</Text>
                  </Table.Td>
                  <Table.Td>
                    {website ? (
                      <Text size="sm" className={styles.websiteLink} onClick={() => window.open(website, '_blank')}>
                        {website.replace(/^https?:\/\//, '')}
                      </Text>
                    ) : (
                      <Text size="sm">{t('common.dash')}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={provider.active ? 'green' : 'red'}>
                      {provider.active ? t('admin.diagnosticProviders.active') : t('admin.diagnosticProviders.inactive')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Menu position="bottom-end">
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDots size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleEdit(provider)}
                        >
                          {t('admin.diagnosticProviders.edit')}
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={() => handleDelete(provider)}
                        >
                          {t('admin.diagnosticProviders.delete')}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <EditDiagnosticProviderModal
        opened={editModalOpen}
        onClose={handleModalClose}
        provider={selectedProvider}
      />
      <ConfirmDialog
        opened={confirmDialogOpen}
        onCancel={() => setConfirmDialogOpen(false)}
        onConfirm={confirmDelete}
        title={t('admin.diagnosticProviders.deleteConfirmTitle')}
        message={t('admin.diagnosticProviders.deleteConfirmMessage', { name: providerToDelete?.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </Container>
  );
}

