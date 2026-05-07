import { JSX, useState, useEffect } from 'react';
import { Modal, TextInput, Button, Group, Stack, Select, Switch } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { Organization } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { saveDiagnosticProvider, DiagnosticProviderDefinition } from '../../utils/diagnosticProviders';

interface EditDiagnosticProviderModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  provider: Organization | null;
}

export function EditDiagnosticProviderModal({ opened, onClose, provider }: EditDiagnosticProviderModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>('lab');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (provider) {
      // Load existing provider data
      setCode(provider.identifier?.[0]?.value || '');
      setName(provider.name || '');
      setType(provider.extension?.find(e => e.url === 'diagnosticType')?.valueString || 'lab');
      setPhone(provider.telecom?.find(t => t.system === 'phone')?.value || '');
      setWebsite(provider.telecom?.find(t => t.system === 'url')?.value || '');
      setActive(provider.active !== false);
    } else {
      // Reset for new provider
      setCode('');
      setName('');
      setType('lab');
      setPhone('');
      setWebsite('');
      setActive(true);
    }
  }, [provider, opened]);

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({
        title: t('common.validationError', 'Validation Error'),
        message: t('admin.diagnosticProviders.nameRequired', 'Provider name is required'),
        color: 'red',
      });
      return;
    }

    if (!code.trim()) {
      notifications.show({
        title: t('common.validationError', 'Validation Error'),
        message: t('admin.diagnosticProviders.codeRequired', 'Provider code is required'),
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const providerDef: DiagnosticProviderDefinition = {
        code: code.trim(),
        name: name.trim(),
        type: (type as 'lab' | 'imaging' | 'both') || 'lab',
        phone: phone.trim() || undefined,
        website: website.trim() || undefined,
      };

      await saveDiagnosticProvider(medplum, providerDef);
      
      // If updating an existing provider and active status changed, update separately
      if (provider && provider.active !== active) {
        await medplum.updateResource({
          ...provider,
          active,
        });
      }
      
      notifications.show({
        title: t('common.success', 'Success'),
        message: provider
          ? t('admin.diagnosticProviders.updateSuccess', 'Provider updated successfully')
          : t('admin.diagnosticProviders.createSuccess', 'Provider created successfully'),
        color: 'green',
      });
      onClose(true);
    } catch (error) {
      notifications.show({
        title: t('common.error', 'Error'),
        message: t('admin.diagnosticProviders.saveError', 'Failed to save provider'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => onClose(false)}
      title={provider
        ? t('admin.diagnosticProviders.editTitle', 'Edit Diagnostic Provider')
        : t('admin.diagnosticProviders.addTitle', 'Add Diagnostic Provider')}
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label={t('admin.diagnosticProviders.providerCode', 'Provider Code')}
          placeholder={t('admin.diagnosticProviders.providerCodePlaceholder', 'e.g., quest, labcorp')}
          value={code}
          onChange={(e) => setCode(e.currentTarget.value)}
          required
          disabled={!!provider}
          description={provider
            ? t('admin.diagnosticProviders.codeImmutableHint', 'Cannot change code of existing provider')
            : t('admin.diagnosticProviders.codeUniqueHint', 'Unique identifier for this provider')}
        />

        <TextInput
          label={t('admin.diagnosticProviders.providerName', 'Provider Name')}
          placeholder={t('admin.diagnosticProviders.providerNamePlaceholder', 'e.g., Quest Diagnostics')}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          required
        />

        <Select
          label={t('admin.diagnosticProviders.providerType', 'Provider Type')}
          placeholder={t('admin.diagnosticProviders.selectType', 'Select type')}
          data={[
            { value: 'lab', label: t('admin.diagnosticProviders.types.lab', 'Laboratory') },
            { value: 'imaging', label: t('admin.diagnosticProviders.types.imaging', 'Imaging') },
            { value: 'both', label: t('admin.diagnosticProviders.types.both', 'Lab & Imaging') },
          ]}
          value={type}
          onChange={setType}
          required
        />

        <TextInput
          label={t('admin.diagnosticProviders.phone', 'Phone')}
          placeholder={t('admin.diagnosticProviders.phonePlaceholder', 'e.g., 1-866-697-8378')}
          value={phone}
          onChange={(e) => setPhone(e.currentTarget.value)}
        />

        <TextInput
          label={t('admin.diagnosticProviders.website', 'Website')}
          placeholder={t('admin.diagnosticProviders.websitePlaceholder', 'e.g., https://www.example.com')}
          value={website}
          onChange={(e) => setWebsite(e.currentTarget.value)}
        />

        <Switch
          label={t('admin.diagnosticProviders.active', 'Active')}
          checked={active}
          onChange={(e) => setActive(e.currentTarget.checked)}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => onClose(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} loading={loading}>
            {provider ? t('common.update', 'Update') : t('common.create', 'Create')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

