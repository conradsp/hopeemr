import { Paper, Title, Text, Stack, Group, Button, Table, Badge, ActionIcon } from '@mantine/core';
import { Questionnaire } from '@medplum/fhirtypes';
import { Document, Loading, useMedplum } from '@medplum/react';
import { IconPlus, IconEdit, IconTrash, IconFileText } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getNoteTemplates, initializeDefaultTemplates } from '../../utils/noteTemplates';
import { EditNoteTemplateModal } from '../../components/admin/EditNoteTemplateModal';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { showSuccess, handleError } from '../../utils/errorHandling';
import styles from './NoteTemplatesPage.module.css';

export function NoteTemplatesPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [templates, setTemplates] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Questionnaire | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Questionnaire | null>(null);

  const loadTemplates = async () => {
    setLoading(true);
    const result = await getNoteTemplates(medplum);
    setTemplates(result);
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, [medplum]);

  const handleInitializeDefaults = async () => {
    setInitializing(true);
    try {
      await initializeDefaultTemplates(medplum);
      await loadTemplates();
      showSuccess(t('admin.noteTemplates.initializeSuccess'));
    } catch (error) {
      handleError(error, t('message.error.initialize'));
    } finally {
      setInitializing(false);
    }
  };

  const handleEdit = (template: Questionnaire) => {
    setSelectedTemplate(template);
    setEditModalOpen(true);
  };

  const handleNew = () => {
    setSelectedTemplate(null);
    setEditModalOpen(true);
  };

  const handleDelete = async (template: Questionnaire) => {
    if (!template.id) return;
    setTemplateToDelete(template);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!templateToDelete?.id) return;
    
    setConfirmOpen(false);
    try {
      await medplum.deleteResource('Questionnaire', templateToDelete.id);
      await loadTemplates();
      showSuccess(t('admin.noteTemplates.deleteSuccess'));
    } catch (error) {
      handleError(error, t('message.error.delete'));
    } finally {
      setTemplateToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmOpen(false);
    setTemplateToDelete(null);
  };

  const handleModalClose = () => {
    setEditModalOpen(false);
    setSelectedTemplate(null);
    loadTemplates();
  };

  return (
    <Document>
      <BreadcrumbNav />
      
      <EditNoteTemplateModal
        opened={editModalOpen}
        onClose={handleModalClose}
        template={selectedTemplate}
      />

      <ConfirmDialog
        opened={confirmOpen}
        title={t('common.confirmDelete')}
        message={t('admin.noteTemplates.confirmDelete', { name: templateToDelete?.title })}
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
                <IconFileText size={28} />
                {t('admin.noteTemplates.title')}
              </Group>
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              {t('admin.noteTemplates.subtitle')}
            </Text>
          </div>
          <Group>
            {templates.length === 0 && (
              <Button
                variant="light"
                onClick={handleInitializeDefaults}
                loading={initializing}
              >
                {t('admin.noteTemplates.initializeDefaults')}
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
              {t('admin.noteTemplates.new')}
            </Button>
          </Group>
        </Group>

        {loading ? (
          <Loading />
        ) : templates.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Stack align="center" gap="md">
              <IconFileText size={48} className={styles.emptyStateIcon} />
              <div className={styles.emptyStateContainer}>
                <Text size="lg" fw={500} mb="xs">
                  {t('admin.noteTemplates.noTemplates')}
                </Text>
                <Text size="sm" c="dimmed" mb="md">
                  {t('admin.noteTemplates.noTemplatesDescription')}
                </Text>
                <Button
                  onClick={handleInitializeDefaults}
                  loading={initializing}
                  leftSection={<IconPlus size={16} />}
                >
                  {t('admin.noteTemplates.initializeDefaults')}
                </Button>
              </div>
            </Stack>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('admin.noteTemplates.name')}</Table.Th>
                <Table.Th>{t('common.description')}</Table.Th>
                <Table.Th>{t('admin.noteTemplates.fields')}</Table.Th>
                <Table.Th>{t('common.status')}</Table.Th>
                <Table.Th>{t('common.action')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {templates.map((template) => (
                <Table.Tr key={template.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {template.title}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {template.description || t('common.dash')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{template.item?.length || 0} {t('admin.noteTemplates.fieldsCount')}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={template.status === 'active' ? 'green' : 'gray'}
                      variant="light"
                      size="sm"
                    >
                      {t(`admin.noteTemplates.status.${template.status}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="light"
                        color="blue"
                        onClick={() => handleEdit(template)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="light"
                        color="red"
                        onClick={() => handleDelete(template)}
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

