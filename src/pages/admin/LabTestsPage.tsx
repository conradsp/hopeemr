import { useState, useEffect, useCallback, JSX } from 'react';
import { Container, Title, Button, Table, Group, Stack, Text, Badge } from '@mantine/core';
import { IconPlus, IconRefresh, IconEdit, IconTrash } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { ActivityDefinition } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { getLabTests, initializeDefaultLabTests, deleteLabTest } from '../../utils/labTests';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { EditLabTestModal } from '../../components/admin/EditLabTestModal';
import { getPriceFromResource } from '../../utils/billing';
import { showSuccess, handleError } from '../../utils/errorHandling';
import styles from './LabTestsPage.module.css';

export function LabTestsPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [labTests, setLabTests] = useState<ActivityDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ActivityDefinition | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<ActivityDefinition | null>(null);

  const loadLabTests = useCallback(async (): Promise<void> => {
    setLoading(true);
    const tests = await getLabTests(medplum);
    setLabTests(tests);
    setLoading(false);
  }, [medplum]);

  useEffect(() => {
    loadLabTests().catch(() => {});
  }, [loadLabTests]);

  const handleInitializeDefaults = async (): Promise<void> => {
    try {
      await initializeDefaultLabTests(medplum);
      showSuccess(t('admin.labTests.initializeSuccess'));
      await loadLabTests();
    } catch (error) {
      handleError(error, t('message.error.initialize'));
    }
  };

  const handleEdit = (test: ActivityDefinition): void => {
    setSelectedTest(test);
    setEditModalOpen(true);
  };

  const handleCreate = (): void => {
    setSelectedTest(null);
    setEditModalOpen(true);
  };

  const handleDelete = async (test: ActivityDefinition): Promise<void> => {
    if (!test.identifier?.[0]?.value) {
      return;
    }
    setTestToDelete(test);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!testToDelete?.identifier?.[0]?.value) return;
    
    setConfirmOpen(false);
    try {
      await deleteLabTest(medplum, testToDelete.identifier[0].value);
      showSuccess(t('admin.labTests.deleteSuccess'));
      await loadLabTests();
    } catch (error) {
      handleError(error, t('message.error.delete'));
    } finally {
      setTestToDelete(null);
    }
  };

  const handleDeleteCancel = (): void => {
    setConfirmOpen(false);
    setTestToDelete(null);
  };

  const handleModalClose = async (saved: boolean): Promise<void> => {
    setEditModalOpen(false);
    setSelectedTest(null);
    if (saved) {
      await loadLabTests();
    }
  };

  const getCategory = (test: ActivityDefinition): string => {
    const categoryExt = test.extension?.find(e => e.url === 'category');
    return categoryExt?.valueString || t('admin.labTests.uncategorized');
  };

  const getSpecimenType = (test: ActivityDefinition): string => {
    const specimenExt = test.extension?.find(e => e.url === 'specimenType');
    return specimenExt?.valueString || t('common.na');
  };

  // Group tests by category
  const groupedTests = labTests.reduce<Record<string, ActivityDefinition[]>>((acc, test) => {
    const category = getCategory(test);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(test);
    return acc;
  }, {});

  return (
    <Container size="xl" className={styles.container}>
      <BreadcrumbNav />
      
      <ConfirmDialog
        opened={confirmOpen}
        title={t('common.confirmDelete')}
        message={t('admin.labTests.confirmDelete', { name: testToDelete?.title })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>{t('admin.labTests.title')}</Title>
          <Text c="dimmed" size="sm">{t('admin.labTests.subtitle')}</Text>
        </div>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={handleInitializeDefaults}
          >
            {t('admin.labTests.initializeDefaults')}
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleCreate}
          >
            {t('admin.labTests.add')}
          </Button>
        </Group>
      </Group>

      {loading && <Text>{t('common.loading')}</Text>}
      {!loading && labTests.length === 0 && (
        <Stack align="center" py="xl">
          <Text c="dimmed">{t('admin.labTests.noTests')}</Text>
          <Button onClick={handleInitializeDefaults}>{t('admin.labTests.initializeDefaults')}</Button>
        </Stack>
      )}
      {!loading && labTests.length > 0 && (
        <Stack gap="xl">
          {Object.entries(groupedTests).sort().map(([category, tests]) => (
            <div key={category}>
              <Title order={3} size="h4" mb="md">
                {category}
                <Badge ml="sm" size="lg" variant="light">{tests.length}</Badge>
              </Title>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('admin.labTests.testName')}</Table.Th>
                    <Table.Th>{t('admin.labTests.loincCode')}</Table.Th>
                    <Table.Th>{t('admin.labTests.specimenType')}</Table.Th>
                    <Table.Th>{t('common.price')}</Table.Th>
                    <Table.Th>{t('common.description')}</Table.Th>
                    <Table.Th className={styles.actionsColumn}>{t('common.action')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tests.map((test) => (
                    <Table.Tr key={test.id}>
                      <Table.Td>
                        <Text fw={500}>{test.title}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {test.code?.coding?.[0]?.code || t('common.na')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{getSpecimenType(test)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          ${(getPriceFromResource(test) || 0).toFixed(2)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" lineClamp={1}>
                          {test.description || t('common.dash')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <div className={styles.inlineActions}>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconEdit size={14} />}
                            color="blue"
                            onClick={() => handleEdit(test)}
                          >
                            {t('common.edit')}
                          </Button>
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={() => handleDelete(test)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          ))}
        </Stack>
      )}

      <EditLabTestModal
        opened={editModalOpen}
        onClose={handleModalClose}
        test={selectedTest}
      />
    </Container>
  );
}

