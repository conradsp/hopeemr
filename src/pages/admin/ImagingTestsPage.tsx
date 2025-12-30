import { useState, useEffect, useCallback, JSX } from 'react';
import { Container, Title, Button, Table, Group, Stack, Text, Badge } from '@mantine/core';
import { IconPlus, IconRefresh, IconEdit, IconTrash } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { ActivityDefinition } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { getImagingTests, initializeDefaultImagingTests, deleteImagingTest } from '../../utils/imagingTests';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { EditImagingTestModal } from '../../components/admin/EditImagingTestModal';
import { getPriceFromResource } from '../../utils/billing';
import { showSuccess, handleError } from '../../utils/errorHandling';
import styles from './ImagingTestsPage.module.css';

export function ImagingTestsPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [imagingTests, setImagingTests] = useState<ActivityDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ActivityDefinition | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState<ActivityDefinition | null>(null);

  const loadImagingTests = useCallback(async (): Promise<void> => {
    setLoading(true);
    const tests = await getImagingTests(medplum);
    setImagingTests(tests);
    setLoading(false);
  }, [medplum]);

  useEffect(() => {
    loadImagingTests().catch(() => {});
  }, [loadImagingTests]);

  const handleInitializeDefaults = async (): Promise<void> => {
    try {
      await initializeDefaultImagingTests(medplum);
      showSuccess(t('admin.imagingTests.initializeSuccess'));
      await loadImagingTests();
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

  const handleDelete = (test: ActivityDefinition): void => {
    setTestToDelete(test);
    setConfirmDialogOpen(true);
  };

  const confirmDelete = async (): Promise<void> => {
    setConfirmDialogOpen(false);
    if (!testToDelete?.identifier?.[0]?.value) {
      return;
    }
    try {
      await deleteImagingTest(medplum, testToDelete.identifier[0].value);
      showSuccess(t('admin.imagingTests.deleteSuccess'));
      await loadImagingTests();
    } catch (error) {
      handleError(error, t('message.error.delete'));
    }
  };

  const handleModalClose = async (saved: boolean): Promise<void> => {
    setEditModalOpen(false);
    setSelectedTest(null);
    if (saved) {
      await loadImagingTests();
    }
  };

  const getCategory = (test: ActivityDefinition): string => {
    const categoryExt = test.extension?.find(e => e.url === 'category');
    return categoryExt?.valueString || t('admin.imagingTests.uncategorized');
  };

  const getBodyPart = (test: ActivityDefinition): string => {
    const bodyPartExt = test.extension?.find(e => e.url === 'bodyPart');
    return bodyPartExt?.valueString || t('common.na');
  };

  const getModality = (test: ActivityDefinition): string => {
    const modalityExt = test.extension?.find(e => e.url === 'modality');
    return modalityExt?.valueString || t('common.na');
  };

  // Group tests by category
  const testsByCategory = imagingTests.reduce<Record<string, ActivityDefinition[]>>((acc, test) => {
    const category = getCategory(test);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(test);
    return acc;
  }, {});

  let content: JSX.Element;
  if (loading) {
    content = <Text>{t('common.loading')}</Text>;
  } else if (imagingTests.length === 0) {
    content = (
      <Stack align="center" py="xl">
        <Text c="dimmed">{t('admin.imagingTests.noTests')}</Text>
        <Button onClick={handleInitializeDefaults}>{t('admin.imagingTests.initializeDefaults')}</Button>
      </Stack>
    );
  } else {
    content = (
      <Stack gap="xl">
        {Object.entries(testsByCategory).sort().map(([category, tests]) => (
          <div key={category}>
            <Title order={3} size="h4" mb="md">
              {category}
              <Badge ml="sm" size="lg" variant="light">{tests.length}</Badge>
            </Title>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('admin.imagingTests.testName')}</Table.Th>
                  <Table.Th>{t('admin.imagingTests.loincCode')}</Table.Th>
                  <Table.Th>{t('admin.imagingTests.bodyPart')}</Table.Th>
                  <Table.Th>{t('admin.imagingTests.modality')}</Table.Th>
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
                      <Text size="sm">{getBodyPart(test)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light">{getModality(test)}</Badge>
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
    );
  }

  return (
    <Container size="xl" className={styles.container}>
      <BreadcrumbNav />
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>{t('admin.imagingTests.title')}</Title>
          <Text c="dimmed" size="sm">{t('admin.imagingTests.subtitle')}</Text>
        </div>
        <Group>
          <Button leftSection={<IconRefresh size={16} />} variant="light" onClick={handleInitializeDefaults}>
            {t('admin.imagingTests.initializeDefaults')}
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
            {t('admin.imagingTests.add')}
          </Button>
        </Group>
      </Group>
      {content}

      <EditImagingTestModal
        opened={editModalOpen}
        onClose={handleModalClose}
        test={selectedTest}
      />
      <ConfirmDialog
        opened={confirmDialogOpen}
        onCancel={() => setConfirmDialogOpen(false)}
        onConfirm={confirmDelete}
        title={t('admin.imagingTests.confirmDeleteTitle')}
        message={t('admin.imagingTests.confirmDeleteMessage', { name: testToDelete?.title })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </Container>
  );
}

