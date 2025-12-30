import {
  Paper,
  Title,
  Text,
  Stack,
  TextInput,
  Button,
  Group,
  FileInput,
  Image,
  Divider,
  Select,
  Switch,
  NumberInput,
  Tabs,
  Card,
  Badge,
} from '@mantine/core';
import { Document, useMedplum } from '@medplum/react';
import { IconSettings, IconUpload, IconCheck, IconCalendar, IconUsers, IconArrowsShuffle } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { getEMRSettings, saveEMRSettings, saveWorkflowConfiguration, getWorkflowConfiguration } from '../../utils/settings';
import type { WorkflowConfiguration, WorkflowEmphasis } from '../../types/queue.types';
import { DEFAULT_WORKFLOW_CONFIG } from '../../types/queue.types';
import styles from './SettingsPage.module.css';

export function SettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [emrName, setEmrName] = useState('Medplum EMR');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('general');

  // Workflow configuration state
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfiguration>(DEFAULT_WORKFLOW_CONFIG);
  const [workflowLoading, setWorkflowLoading] = useState(false);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getEMRSettings(medplum);
      if (settings) {
        setEmrName(settings.name);
        setCurrentLogo(settings.logo);
      }

      // Load workflow configuration
      const wfConfig = await getWorkflowConfiguration(medplum);
      setWorkflowConfig(wfConfig);
    };
    loadSettings();
  }, [medplum]);

  // Handle logo file selection
  const handleLogoChange = (file: File | null) => {
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setLogoPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let logoDataUrl = currentLogo;

      // If a new logo was uploaded, convert to data URL
      if (logoFile) {
        logoDataUrl = logoPreview;
      }

      await saveEMRSettings(medplum, {
        name: emrName,
        logo: logoDataUrl,
      });

      showSuccess(t('admin.settings.saveSuccess'));
      
      // Notify app that settings have changed
      // The Header component will pick this up and reload settings
      window.dispatchEvent(new Event('emr-settings-changed'));
    } catch (error) {
      handleError(error, t('admin.settings.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setCurrentLogo(null);
  };

  // Handle workflow configuration save
  const handleWorkflowSave = async () => {
    setWorkflowLoading(true);
    try {
      await saveWorkflowConfiguration(medplum, workflowConfig);
      showSuccess(t('admin.settings.workflowSaveSuccess', 'Workflow settings saved successfully'));

      // Notify other components
      window.dispatchEvent(new Event('emr-workflow-settings-changed'));
    } catch (error) {
      handleError(error, t('admin.settings.workflowSaveError', 'Failed to save workflow settings'));
    } finally {
      setWorkflowLoading(false);
    }
  };

  // Update workflow config helper
  const updateWorkflow = <K extends keyof WorkflowConfiguration>(
    key: K,
    value: WorkflowConfiguration[K]
  ) => {
    setWorkflowConfig((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Document>
      <Paper shadow="sm" p="lg" withBorder className={styles.paperCentered}>
        <Group mb="lg">
          <IconSettings size={24} className={styles.icon} />
          <div>
            <Title order={2}>{t('admin.settings.title')}</Title>
            <Text size="sm" c="dimmed">
              {t('admin.settings.subtitle')}
            </Text>
          </div>
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="lg">
            <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
              {t('admin.settings.generalTab', 'General')}
            </Tabs.Tab>
            <Tabs.Tab value="workflow" leftSection={<IconArrowsShuffle size={16} />}>
              {t('admin.settings.workflowTab', 'Workflow')}
            </Tabs.Tab>
          </Tabs.List>

          {/* General Settings Tab */}
          <Tabs.Panel value="general">
            <form onSubmit={handleSubmit}>
              <Stack gap="lg">
                {/* EMR Name */}
                <TextInput
                  label={t('admin.settings.emrName')}
                  description={t('admin.settings.emrNameDescription')}
                  placeholder={t('admin.settings.emrNamePlaceholder')}
                  required
                  value={emrName}
                  onChange={(event) => setEmrName(event.currentTarget.value)}
                  size="md"
                />

                {/* Logo Upload */}
                <div>
                  <Text size="sm" fw={500} mb="xs">
                    {t('admin.settings.emrLogo')}
                  </Text>
                  <Text size="xs" c="dimmed" mb="md">
                    {t('admin.settings.emrLogoDescription')}
                  </Text>

                  {/* Current/Preview Logo */}
                  {((currentLogo && currentLogo.length > 0) || (logoPreview && logoPreview.length > 0)) && (
                    <Paper p="md" mb="md" withBorder bg="gray.0">
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500} mb="xs">
                            {logoPreview ? t('admin.settings.logoPreview') : t('admin.settings.currentLogo')}
                          </Text>
                          <Image
                            src={logoPreview || currentLogo || ''}
                            alt="Logo"
                            h={40}
                            w="auto"
                            fit="contain"
                          />
                        </div>
                        <Button
                          variant="light"
                          color="red"
                          size="sm"
                          onClick={handleRemoveLogo}
                        >
                          {t('admin.settings.removeLogo')}
                        </Button>
                      </Group>
                    </Paper>
                  )}

                  <FileInput
                    leftSection={<IconUpload size={16} />}
                    placeholder={t('admin.settings.chooseLogoFile')}
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                    value={logoFile}
                    onChange={handleLogoChange}
                  />
                </div>

                {/* Save Button */}
                <Group justify="flex-end" mt="md">
                  <Button
                    type="submit"
                    loading={loading}
                    leftSection={<IconCheck size={16} />}
                    size="md"
                  >
                    {t('admin.settings.saveSettings')}
                  </Button>
                </Group>
              </Stack>
            </form>
          </Tabs.Panel>

          {/* Workflow Settings Tab */}
          <Tabs.Panel value="workflow">
            <Stack gap="lg">
              {/* Workflow Emphasis */}
              <Card withBorder p="md">
                <Stack gap="md">
                  <div>
                    <Text size="lg" fw={600} mb="xs">
                      {t('admin.settings.workflowEmphasis', 'Workflow Mode')}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t('admin.settings.workflowEmphasisDescription', 'Choose how your facility balances scheduling and queue management')}
                    </Text>
                  </div>

                  <Group gap="md">
                    {(['scheduled-primary', 'hybrid', 'queue-primary'] as WorkflowEmphasis[]).map((mode) => (
                      <Card
                        key={mode}
                        withBorder
                        p="md"
                        style={{
                          cursor: 'pointer',
                          flex: 1,
                          borderColor: workflowConfig.workflowEmphasis === mode ? 'var(--mantine-color-blue-6)' : undefined,
                          borderWidth: workflowConfig.workflowEmphasis === mode ? 2 : 1,
                        }}
                        onClick={() => updateWorkflow('workflowEmphasis', mode)}
                      >
                        <Group gap="sm" mb="xs">
                          {mode === 'scheduled-primary' && <IconCalendar size={20} />}
                          {mode === 'hybrid' && <IconArrowsShuffle size={20} />}
                          {mode === 'queue-primary' && <IconUsers size={20} />}
                          <Text fw={600}>
                            {mode === 'scheduled-primary' && t('admin.settings.scheduledPrimary', 'Scheduled-First')}
                            {mode === 'hybrid' && t('admin.settings.hybrid', 'Hybrid')}
                            {mode === 'queue-primary' && t('admin.settings.queuePrimary', 'Queue-First')}
                          </Text>
                          {workflowConfig.workflowEmphasis === mode && (
                            <Badge color="blue" size="xs">{t('common.active', 'Active')}</Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {mode === 'scheduled-primary' && t('admin.settings.scheduledPrimaryDesc', 'Traditional clinic with appointments as the primary workflow')}
                          {mode === 'hybrid' && t('admin.settings.hybridDesc', 'Equal emphasis on scheduling and queue (recommended)')}
                          {mode === 'queue-primary' && t('admin.settings.queuePrimaryDesc', 'Urgent care/ED style with queue-first workflow')}
                        </Text>
                      </Card>
                    ))}
                  </Group>
                </Stack>
              </Card>

              <Divider label={t('admin.settings.appointmentSync', 'Appointment Synchronization')} labelPosition="left" />

              {/* Auto-sync appointments */}
              <Switch
                label={t('admin.settings.autoSyncAppointments', 'Auto-sync appointments to queue')}
                description={t('admin.settings.autoSyncAppointmentsDesc', 'Automatically add scheduled appointments to the queue before their start time')}
                checked={workflowConfig.autoSyncAppointmentsToQueue}
                onChange={(e) => updateWorkflow('autoSyncAppointmentsToQueue', e.currentTarget.checked)}
              />

              {workflowConfig.autoSyncAppointmentsToQueue && (
                <NumberInput
                  label={t('admin.settings.appointmentLeadTime', 'Lead time (minutes)')}
                  description={t('admin.settings.appointmentLeadTimeDesc', 'Minutes before appointment to add patient to queue')}
                  value={workflowConfig.appointmentQueueLeadTimeMinutes}
                  onChange={(value) => updateWorkflow('appointmentQueueLeadTimeMinutes', typeof value === 'number' ? value : 15)}
                  min={0}
                  max={60}
                  step={5}
                />
              )}

              {/* Require check-in */}
              <Switch
                label={t('admin.settings.requireCheckIn', 'Require check-in for scheduled appointments')}
                description={t('admin.settings.requireCheckInDesc', 'Patients with appointments must check in before being added to the queue')}
                checked={workflowConfig.requireCheckInForScheduled}
                onChange={(e) => updateWorkflow('requireCheckInForScheduled', e.currentTarget.checked)}
              />

              <Divider label={t('admin.settings.displayOptions', 'Display Options')} labelPosition="left" />

              {/* Show scheduled in work queue */}
              <Switch
                label={t('admin.settings.showScheduledInWorkQueue', 'Show scheduled appointments in work queue')}
                description={t('admin.settings.showScheduledInWorkQueueDesc', "Show provider's scheduled appointments alongside queue patients")}
                checked={workflowConfig.showScheduledInWorkQueue}
                onChange={(e) => updateWorkflow('showScheduledInWorkQueue', e.currentTarget.checked)}
              />

              {/* Show queue on calendar */}
              <Switch
                label={t('admin.settings.showQueueOnCalendar', 'Show queue patients on calendar')}
                description={t('admin.settings.showQueueOnCalendarDesc', 'Display walk-in queue patients on the provider calendar')}
                checked={workflowConfig.showQueueOnCalendar}
                onChange={(e) => updateWorkflow('showQueueOnCalendar', e.currentTarget.checked)}
              />

              <Divider label={t('admin.settings.providerWorkflow', 'Provider Workflow')} labelPosition="left" />

              {/* Auto-advance */}
              <Switch
                label={t('admin.settings.autoAdvance', 'Auto-advance to next patient')}
                description={t('admin.settings.autoAdvanceDesc', 'Suggest the next patient after completing an encounter')}
                checked={workflowConfig.autoAdvanceToNextPatient}
                onChange={(e) => updateWorkflow('autoAdvanceToNextPatient', e.currentTarget.checked)}
              />

              {/* Walk-in slots */}
              <Switch
                label={t('admin.settings.enableWalkInSlots', 'Enable walk-in time slots')}
                description={t('admin.settings.enableWalkInSlotsDesc', 'Assign time slots to walk-in patients for better flow management')}
                checked={workflowConfig.enableWalkInSlots}
                onChange={(e) => updateWorkflow('enableWalkInSlots', e.currentTarget.checked)}
              />

              {workflowConfig.enableWalkInSlots && (
                <NumberInput
                  label={t('admin.settings.walkInSlotDuration', 'Default walk-in slot duration (minutes)')}
                  value={workflowConfig.defaultWalkInSlotDuration}
                  onChange={(value) => updateWorkflow('defaultWalkInSlotDuration', typeof value === 'number' ? value : 30)}
                  min={5}
                  max={120}
                  step={5}
                />
              )}

              {/* Save Button */}
              <Group justify="flex-end" mt="md">
                <Button
                  onClick={handleWorkflowSave}
                  loading={workflowLoading}
                  leftSection={<IconCheck size={16} />}
                  size="md"
                >
                  {t('admin.settings.saveWorkflow', 'Save Workflow Settings')}
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {/* Info Box */}
        <Paper p="md" mt="xl" bg="blue.0" radius="md">
          <Text size="sm" fw={500} mb="xs">
            {t('admin.settings.note')}
          </Text>
          <Text size="sm">
            {t('admin.settings.noteDescription')}
          </Text>
        </Paper>
      </Paper>
    </Document>
  );
}

