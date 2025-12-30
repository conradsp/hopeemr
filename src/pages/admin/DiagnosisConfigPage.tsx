import { JSX, useState, useEffect, useCallback } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Table,
  Badge,
  ActionIcon,
  Modal,
  TextInput,
  Select,
  Tabs,
  Card,
  Switch,
  Alert,
  Paper,
  Divider,
  Code,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSettings,
  IconStethoscope,
  IconWorld,
  IconDatabase,
  IconCheck,
  IconInfoCircle,
  IconSearch,
  IconRefresh,
} from '@tabler/icons-react';
import { useMedplum } from '@medplum/react';
import { ValueSetExpansionContains } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { logger } from '../../utils/logger';
import {
  getAllDiagnosisCodes,
  initializeDefaultDiagnosisCodes,
  addDiagnosisCode,
  updateDiagnosisCode,
  deleteDiagnosisCode,
} from '../../utils/diagnosisCodes';
import {
  getTerminologyConfig,
  saveTerminologyConfig,
  getAvailableCodingSystems,
  CODING_SYSTEMS,
  TerminologyConfig,
  clearSearchCache,
  searchDiagnosisCodes,
  CodeSearchResult,
  getCodingSystemLabel,
  getCodingSystemColor,
} from '../../utils/terminologyService';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import styles from './DiagnosisCodesPage.module.css';

export function DiagnosisConfigPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();

  // Coding Systems Tab State
  const [config, setConfig] = useState<TerminologyConfig>(getTerminologyConfig());
  const [hasConfigChanges, setHasConfigChanges] = useState(false);
  const availableSystems = getAvailableCodingSystems();

  // Custom Codes Tab State
  const [codes, setCodes] = useState<ValueSetExpansionContains[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<ValueSetExpansionContains | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    display: '',
    system: CODING_SYSTEMS.CUSTOM,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<ValueSetExpansionContains | null>(null);

  // Test Search State
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<CodeSearchResult[]>([]);
  const [testing, setTesting] = useState(false);

  // Load custom codes
  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    setLoadingCodes(true);
    try {
      const allCodes = await getAllDiagnosisCodes(medplum);
      setCodes(allCodes);
    } catch (error) {
      logger.error('Failed to load diagnosis codes', error);
      handleError(error, t('admin.diagnosisCodes.loadError'));
    } finally {
      setLoadingCodes(false);
    }
  };

  // Coding Systems Handlers
  const handleToggleSystem = (system: string, enabled: boolean) => {
    const newEnabledSystems = enabled
      ? [...config.enabledSystems, system]
      : config.enabledSystems.filter((s) => s !== system);

    if (newEnabledSystems.length === 0) {
      return;
    }

    let newPrimarySystem = config.primarySystem;
    if (!enabled && config.primarySystem === system) {
      newPrimarySystem = newEnabledSystems[0];
    }

    setConfig({
      ...config,
      enabledSystems: newEnabledSystems,
      primarySystem: newPrimarySystem,
    });
    setHasConfigChanges(true);
  };

  const handlePrimarySystemChange = (value: string | null) => {
    if (value && config.enabledSystems.includes(value)) {
      setConfig({ ...config, primarySystem: value });
      setHasConfigChanges(true);
    }
  };

  const handleToggleOnlineSearch = (enabled: boolean) => {
    setConfig({ ...config, useOnlineSearch: enabled });
    setHasConfigChanges(true);
  };

  const handleToggleCaching = (enabled: boolean) => {
    setConfig({ ...config, cacheResults: enabled });
    setHasConfigChanges(true);
  };

  const handleSaveConfig = () => {
    saveTerminologyConfig(config);
    clearSearchCache();
    setHasConfigChanges(false);
    showSuccess(t('admin.diagnosisConfig.saveSuccess'));
  };

  const handleResetConfig = () => {
    const defaultConfig: TerminologyConfig = {
      enabledSystems: [CODING_SYSTEMS.ICD10CM, CODING_SYSTEMS.SNOMED, CODING_SYSTEMS.CUSTOM],
      primarySystem: CODING_SYSTEMS.ICD10CM,
      useOnlineSearch: true,
      cacheResults: true,
    };
    setConfig(defaultConfig);
    setHasConfigChanges(true);
  };

  // Test Search Handler
  const handleTestSearch = useCallback(async () => {
    if (!testQuery || testQuery.length < 2) {
      setTestResults([]);
      return;
    }

    setTesting(true);
    try {
      // Use current config for test
      const results = await searchDiagnosisCodes(medplum, testQuery, { maxResults: 20 });
      setTestResults(results);
      logger.info('Test search completed', { query: testQuery, resultCount: results.length });
    } catch (error) {
      logger.error('Test search failed', error);
      setTestResults([]);
    } finally {
      setTesting(false);
    }
  }, [testQuery, medplum]);

  // Custom Codes Handlers
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
      system: CODING_SYSTEMS.CUSTOM,
    });
    setModalOpen(true);
  };

  const openEditModal = (code: ValueSetExpansionContains) => {
    setEditingCode(code);
    setFormData({
      code: code.code || '',
      display: code.display || '',
      system: code.system || CODING_SYSTEMS.CUSTOM,
    });
    setModalOpen(true);
  };

  const handleSaveCode = async () => {
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
    } catch (error: unknown) {
      handleError(error, t('admin.diagnosisCodes.saveError'));
    }
  };

  const handleDeleteCode = async (code: ValueSetExpansionContains) => {
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
    if (system === CODING_SYSTEMS.ICD10 || system === CODING_SYSTEMS.ICD10CM) return 'blue';
    if (system === CODING_SYSTEMS.SNOMED) return 'green';
    return 'orange';
  };

  const getSystemLabel = (system?: string) => {
    if (system === CODING_SYSTEMS.ICD10) return 'ICD-10';
    if (system === CODING_SYSTEMS.ICD10CM) return 'ICD-10-CM';
    if (system === CODING_SYSTEMS.SNOMED) return 'SNOMED CT';
    return t('admin.diagnosisCodes.systems.custom');
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        <div>
          <Title order={2}>{t('admin.diagnosisConfig.title')}</Title>
          <Text c="dimmed">{t('admin.diagnosisConfig.subtitle')}</Text>
        </div>

        <Tabs defaultValue="settings">
          <Tabs.List>
            <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
              {t('admin.diagnosisConfig.settingsTab')}
            </Tabs.Tab>
            <Tabs.Tab value="custom" leftSection={<IconStethoscope size={16} />}>
              {t('admin.diagnosisConfig.customCodesTab')}
            </Tabs.Tab>
            <Tabs.Tab value="test" leftSection={<IconSearch size={16} />}>
              {t('admin.diagnosisConfig.testTab')}
            </Tabs.Tab>
          </Tabs.List>

          {/* Settings Tab */}
          <Tabs.Panel value="settings" pt="xl">
            <Stack gap="lg">
              <Group justify="flex-end">
                <Button variant="subtle" onClick={handleResetConfig}>
                  {t('admin.diagnosisConfig.resetDefaults')}
                </Button>
                <Button
                  leftSection={<IconCheck size={16} />}
                  onClick={handleSaveConfig}
                  disabled={!hasConfigChanges}
                >
                  {t('admin.diagnosisConfig.saveChanges')}
                </Button>
              </Group>

              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                {t('admin.diagnosisConfig.description')}
              </Alert>

              {/* Available Coding Systems */}
              <Paper p="lg" withBorder>
                <Title order={4} mb="md">
                  {t('admin.diagnosisConfig.availableSystems')}
                </Title>
                <Stack gap="md">
                  {availableSystems.map((system) => {
                    const isEnabled = config.enabledSystems.includes(system.value);
                    const isPrimary = config.primarySystem === system.value;

                    return (
                      <Card key={system.value} withBorder>
                        <Group justify="space-between" align="flex-start">
                          <div style={{ flex: 1 }}>
                            <Group gap="xs">
                              <Text fw={600}>{system.label}</Text>
                              {system.online ? (
                                <Badge size="xs" color="teal" leftSection={<IconWorld size={10} />}>
                                  {t('admin.diagnosisConfig.online')}
                                </Badge>
                              ) : (
                                <Badge size="xs" color="gray" leftSection={<IconDatabase size={10} />}>
                                  {t('admin.diagnosisConfig.offline')}
                                </Badge>
                              )}
                              {isPrimary && (
                                <Badge size="xs" color="blue">
                                  {t('admin.diagnosisConfig.primary')}
                                </Badge>
                              )}
                            </Group>
                            <Text size="sm" c="dimmed" mt={4}>
                              {system.description}
                            </Text>
                            <Code mt={4}>{system.value}</Code>
                          </div>
                          <Switch
                            checked={isEnabled}
                            onChange={(e) => handleToggleSystem(system.value, e.currentTarget.checked)}
                            disabled={isEnabled && config.enabledSystems.length === 1}
                          />
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </Paper>

              {/* Primary System Selection */}
              <Paper p="lg" withBorder>
                <Title order={4} mb="md">
                  {t('admin.diagnosisConfig.primarySystem')}
                </Title>
                <Text size="sm" c="dimmed" mb="md">
                  {t('admin.diagnosisConfig.primarySystemDescription')}
                </Text>
                <Select
                  data={config.enabledSystems.map((system) => {
                    const systemInfo = availableSystems.find((s) => s.value === system);
                    return {
                      value: system,
                      label: systemInfo?.label || system,
                    };
                  })}
                  value={config.primarySystem}
                  onChange={handlePrimarySystemChange}
                  style={{ maxWidth: 300 }}
                />
              </Paper>

              {/* Search Settings */}
              <Paper p="lg" withBorder>
                <Title order={4} mb="md">
                  {t('admin.diagnosisConfig.searchSettings')}
                </Title>

                <Stack gap="lg">
                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{t('admin.diagnosisConfig.onlineSearch')}</Text>
                      <Text size="sm" c="dimmed">
                        {t('admin.diagnosisConfig.onlineSearchDescription')}
                      </Text>
                    </div>
                    <Switch
                      checked={config.useOnlineSearch}
                      onChange={(e) => handleToggleOnlineSearch(e.currentTarget.checked)}
                    />
                  </Group>

                  <Divider />

                  <Group justify="space-between">
                    <div>
                      <Text fw={500}>{t('admin.diagnosisConfig.cacheResults')}</Text>
                      <Text size="sm" c="dimmed">
                        {t('admin.diagnosisConfig.cacheResultsDescription')}
                      </Text>
                    </div>
                    <Switch
                      checked={config.cacheResults}
                      onChange={(e) => handleToggleCaching(e.currentTarget.checked)}
                    />
                  </Group>
                </Stack>
              </Paper>

              {/* Data Sources Info */}
              <Paper p="lg" withBorder>
                <Title order={4} mb="md">
                  {t('admin.diagnosisConfig.dataSources')}
                </Title>
                <Stack gap="sm">
                  <Group gap="xs">
                    <Badge color="blue">ICD-10-CM</Badge>
                    <Text size="sm">{t('admin.diagnosisConfig.icd10Source')}</Text>
                  </Group>
                  <Group gap="xs">
                    <Badge color="green">SNOMED CT</Badge>
                    <Text size="sm">{t('admin.diagnosisConfig.snomedSource')}</Text>
                  </Group>
                  <Group gap="xs">
                    <Badge color="orange">Custom</Badge>
                    <Text size="sm">{t('admin.diagnosisConfig.customSource')}</Text>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* Custom Codes Tab */}
          <Tabs.Panel value="custom" pt="xl">
            <Stack gap="lg">
              <Group justify="flex-end">
                {codes.length === 0 && (
                  <Button onClick={handleInitializeDefaults} loading={loadingCodes}>
                    {t('admin.diagnosisCodes.initializeDefaults')}
                  </Button>
                )}
                <Button leftSection={<IconPlus size={16} />} onClick={openCreateModal}>
                  {t('admin.diagnosisCodes.add')}
                </Button>
              </Group>

              <Alert icon={<IconInfoCircle size={16} />} color="orange" variant="light">
                {t('admin.diagnosisConfig.customCodesInfo')}
              </Alert>

              {loadingCodes ? (
                <Text>{t('common.loading')}</Text>
              ) : codes.length === 0 ? (
                <Text c="dimmed">{t('admin.diagnosisCodes.noCodesConfigured')}</Text>
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
                          <Badge color={getSystemBadgeColor(code.system)}>{getSystemLabel(code.system)}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon variant="subtle" color="blue" onClick={() => openEditModal(code)}>
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteCode(code)}>
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
          </Tabs.Panel>

          {/* Test Search Tab */}
          <Tabs.Panel value="test" pt="xl">
            <Stack gap="lg">
              <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
                {t('admin.diagnosisConfig.testDescription')}
              </Alert>

              <Paper p="lg" withBorder>
                <Title order={4} mb="md">
                  {t('admin.diagnosisConfig.testSearch')}
                </Title>
                <Group>
                  <TextInput
                    placeholder={t('admin.diagnosisConfig.testPlaceholder')}
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.currentTarget.value)}
                    style={{ flex: 1 }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTestSearch();
                    }}
                  />
                  <Button
                    leftSection={<IconSearch size={16} />}
                    onClick={handleTestSearch}
                    loading={testing}
                    disabled={testQuery.length < 2}
                  >
                    {t('admin.diagnosisConfig.search')}
                  </Button>
                </Group>

                {testResults.length > 0 && (
                  <Stack gap="xs" mt="md">
                    <Text fw={500}>
                      {t('admin.diagnosisConfig.resultsFound', { count: testResults.length })}
                    </Text>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('admin.diagnosisCodes.system')}</Table.Th>
                          <Table.Th>{t('admin.diagnosisCodes.code')}</Table.Th>
                          <Table.Th>{t('admin.diagnosisCodes.display')}</Table.Th>
                          <Table.Th>Source</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {testResults.map((result, idx) => (
                          <Table.Tr key={`${result.system}-${result.code}-${idx}`}>
                            <Table.Td>
                              <Badge color={getCodingSystemColor(result.system)} size="sm">
                                {getCodingSystemLabel(result.system)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Code>{result.code}</Code>
                            </Table.Td>
                            <Table.Td>{result.display}</Table.Td>
                            <Table.Td>
                              <Text size="sm" c="dimmed">
                                {result.source || 'Unknown'}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Stack>
                )}

                {testResults.length === 0 && testQuery.length >= 2 && !testing && (
                  <Text c="dimmed" mt="md">
                    {t('admin.diagnosisConfig.noResults')}
                  </Text>
                )}
              </Paper>

              {/* Current Config Display */}
              <Paper p="lg" withBorder>
                <Title order={4} mb="md">
                  {t('admin.diagnosisConfig.currentConfig')}
                </Title>
                <Stack gap="xs">
                  <Group gap="xs">
                    <Text fw={500}>Enabled Systems:</Text>
                    {config.enabledSystems.map((s) => (
                      <Badge key={s} color={getCodingSystemColor(s)} size="sm">
                        {getCodingSystemLabel(s)}
                      </Badge>
                    ))}
                  </Group>
                  <Group gap="xs">
                    <Text fw={500}>Primary System:</Text>
                    <Badge color={getCodingSystemColor(config.primarySystem)}>
                      {getCodingSystemLabel(config.primarySystem)}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <Text fw={500}>Online Search:</Text>
                    <Badge color={config.useOnlineSearch ? 'green' : 'red'}>
                      {config.useOnlineSearch ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Group>
                  <Group gap="xs">
                    <Text fw={500}>Caching:</Text>
                    <Badge color={config.cacheResults ? 'green' : 'red'}>
                      {config.cacheResults ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Add/Edit Code Modal */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCode ? t('admin.diagnosisCodes.edit') : t('admin.diagnosisCodes.add')}
      >
        <Stack gap="md">
          <Select
            label={t('admin.diagnosisCodes.codeSystem')}
            data={[
              { value: CODING_SYSTEMS.ICD10, label: 'ICD-10' },
              { value: CODING_SYSTEMS.ICD10CM, label: 'ICD-10-CM' },
              { value: CODING_SYSTEMS.SNOMED, label: 'SNOMED CT' },
              { value: CODING_SYSTEMS.CUSTOM, label: t('admin.diagnosisCodes.systems.custom') },
            ]}
            value={formData.system}
            onChange={(value) => setFormData({ ...formData, system: value || CODING_SYSTEMS.CUSTOM })}
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
            <Button onClick={handleSaveCode}>{editingCode ? t('common.update') : t('common.add')}</Button>
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
