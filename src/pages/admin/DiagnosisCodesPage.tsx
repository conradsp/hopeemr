import { JSX, useState, useEffect } from 'react';
import { Container, Title, Text, Button, Group, Stack, Table, Badge, ActionIcon, Modal, TextInput, Select } from '@mantine/core';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { ValueSetExpansionContains } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { logger } from '../../utils/logger';
import { getAllDiagnosisCodes, initializeDefaultDiagnosisCodes, addDiagnosisCode, updateDiagnosisCode, deleteDiagnosisCode } from '../../utils/diagnosisCodes';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import styles from './DiagnosisCodesPage.module.css';

export function DiagnosisCodesPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [codes, setCodes] = useState<ValueSetExpansionContains[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ValueSetExpansionContains | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    system: 'http://hl7.org/fhir/sid/icd-10',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<ValueSetExpansionContains | null>(null);

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    setLoading(true);
    try {
      const allCodes = await getAllDiagnosisCodes(medplum);
      setCodes(allCodes);
    } catch (error) {
      logger.error('Failed to load diagnosis codes', error);
      handleError(error, t('admin.diagnosisCodes.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      await initializeDefaultDiagnosisCodes(medplum);
      showSuccess(t('admin.diagnosisCodes.initializeSuccess'));
      loadCodes();
    } catch (error) {
      logger.error('Failed to initialize defaults', error);
      handleError(error, t('admin.diagnosisCodes.initializeError'));
    }
  };

  const openCreateModal = () => {
    setEditingCode(null);
    setFormData({
      code: '',
      display: '',
      system: 'http://hl7.org/fhir/sid/icd-10',
    });
    setModalOpen(true);
  };

  const openEditModal = (code: ValueSetExpansionContains) => {
    setEditingCode(code);
    setFormData({
      code: code.code || '',
      display: code.display || '',
      system: code.system || 'http://hl7.org/fhir/sid/icd-10',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.display) {
      handleError(new Error(t('admin.diagnosisCodes.validationError')), t('modal.validationError'));
      return;
    }

    try {
      if (editingCode) {
        await updateDiagnosisCode(
          medplum,
          editingCode.code!,
          editingCode.system!,
          formData.code,
          formData.display,
          formData.system
        );
        showSuccess(t('admin.diagnosisCodes.updateSuccess'));
      } else {
        await addDiagnosisCode(medplum, formData.code, formData.display, formData.system);
        showSuccess(t('admin.diagnosisCodes.addSuccess'));
      }
      setModalOpen(false);
      loadCodes();
    } catch (error: any) {
      handleError(error, t('admin.diagnosisCodes.saveError'));
    }
  };

  const handleDelete = async (code: ValueSetExpansionContains) => {
    setCodeToDelete(code);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!codeToDelete) return;

    try {
      await deleteDiagnosisCode(medplum, codeToDelete.code!, codeToDelete.system!);
      showSuccess(t('admin.diagnosisCodes.deleteSuccess'));
      loadCodes();
    } catch (error) {
      handleError(error, t('admin.diagnosisCodes.deleteError'));
    } finally {
      setConfirmOpen(false);
      setCodeToDelete(null);
    }
  };

  const getSystemBadgeColor = (system?: string) => {
    if (system === 'http://hl7.org/fhir/sid/icd-10') return 'blue';
    if (system === 'http://snomed.info/sct') return 'green';
    return 'gray';
  };

  const getSystemLabel = (system?: string) => {
    if (system === 'http://hl7.org/fhir/sid/icd-10') return t('admin.diagnosisCodes.systems.icd10');
    if (system === 'http://snomed.info/sct') return t('admin.diagnosisCodes.systems.snomed');
    return t('admin.diagnosisCodes.systems.custom');
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <Group justify="space-between">
          <div>
            <Title order={2}>{t('admin.diagnosisCodes.title')}</Title>
            <Text c="dimmed">{t('admin.diagnosisCodes.subtitle')}</Text>
          </div>
          <Group>
            {codes.length === 0 && (
              <Button onClick={handleInitializeDefaults} loading={loading}>
                {t('admin.diagnosisCodes.initializeDefaults')}
              </Button>
            )}
            <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
              {t('admin.diagnosisCodes.add')}
            </Button>
          </Group>
        </Group>

        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : codes.length === 0 ? (
          <Text c="dimmed">
            {t('admin.diagnosisCodes.noCodesConfigured')}
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('admin.diagnosisCodes.code')}</Table.Th>
                <Table.Th>{t('admin.diagnosisCodes.display')}</Table.Th>
                <Table.Th>{t('admin.diagnosisCodes.system')}</Table.Th>
                <Table.Th className={styles.actionsColumn}>{t('admin.diagnosisCodes.actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {codes.map((code, index) => (
                <Table.Tr key={`${code.system}-${code.code}-${index}`}>
                  <Table.Td>
                    <Text fw={600}>{code.code}</Text>
                  </Table.Td>
                  <Table.Td>{code.display}</Table.Td>
                  <Table.Td>
                    <Badge color={getSystemBadgeColor(code.system)}>
                      {getSystemLabel(code.system)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => openEditModal(code)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(code)}
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
      </Stack>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCode ? t('admin.diagnosisCodes.edit') : t('admin.diagnosisCodes.add')}
      >
        <Stack gap="md">
          <Select
            label={t('admin.diagnosisCodes.codeSystem')}
            data={[
              { value: 'http://hl7.org/fhir/sid/icd-10', label: t('admin.diagnosisCodes.systems.icd10') },
              { value: 'http://snomed.info/sct', label: t('admin.diagnosisCodes.systems.snomed') },
              { value: 'custom', label: t('admin.diagnosisCodes.systems.custom') },
            ]}
            value={formData.system}
            onChange={(value) => setFormData({ ...formData, system: value || 'http://hl7.org/fhir/sid/icd-10' })}
            required
          />

          <TextInput
            label={t('admin.diagnosisCodes.code')}
            placeholder={t('admin.diagnosisCodes.codePlaceholder')}
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.currentTarget.value })}
            required
          />

          <TextInput
            label={t('admin.diagnosisCodes.display')}
            placeholder={t('admin.diagnosisCodes.displayPlaceholder')}
            value={formData.display}
            onChange={(e) => setFormData({ ...formData, display: e.currentTarget.value })}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {editingCode ? t('common.update') : t('common.add')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        opened={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        title={t('admin.diagnosisCodes.deleteConfirmTitle')}
        message={t('admin.diagnosisCodes.deleteConfirmMessage', { code: codeToDelete?.code })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
      />
    </Container>
  );
}

