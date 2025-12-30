import { Modal, TextInput, Button, Group, Stack, Textarea, Select } from '@mantine/core';
import { Questionnaire, QuestionnaireItem } from '@medplum/fhirtypes';
import { useMedplum, QuestionnaireForm } from '@medplum/react';
import { IconCheck } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { showSuccess, handleError } from '../../utils/errorHandling';
import styles from './EditNoteTemplateModal.module.css';
interface EditNoteTemplateModalProps {
  opened: boolean;
  onClose: () => void;
  template: Questionnaire | null;
}

export function EditNoteTemplateModal({ opened, onClose, template }: EditNoteTemplateModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'active' as 'active' | 'draft' | 'retired',
  });
  const [items, setItems] = useState<QuestionnaireItem[]>([]);

  useEffect(() => {
    if (template) {
      setFormData({
        title: template.title || '',
        description: template.description || '',
        status: template.status as 'active' | 'draft' | 'retired',
      });
      setItems(template.item || []);
    } else {
      setFormData({
        title: '',
        description: '',
        status: 'active',
      });
      setItems([]);
    }
  }, [template, opened]);

  const handleAddField = () => {
    setItems([
      ...items,
      {
        linkId: `field-${items.length + 1}`,
        text: '',
        type: 'string',
        required: false,
      },
    ]);
  };

  const handleUpdateField = (index: number, field: Partial<QuestionnaireItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...field };
    setItems(newItems);
  };

  const handleRemoveField = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const questionnaire: Questionnaire = {
        resourceType: 'Questionnaire',
        status: formData.status,
        title: formData.title,
        description: formData.description,
        identifier: template?.identifier || [
          {
            system: 'http://medplum.com/note-templates',
            value: `custom-${Date.now()}`,
          },
        ],
        item: items,
      };

      if (template?.id) {
        // Update existing
        await medplum.updateResource({
          ...questionnaire,
          id: template.id,
        });
      } else {
        // Create new
        await medplum.createResource(questionnaire);
      }

      showSuccess(t('admin.noteTemplates.saveSuccess'));
      onClose();
    } catch (error) {
      handleError(error, t('message.error.save'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={template ? t('admin.noteTemplates.edit') : t('admin.noteTemplates.create')}
      size="lg"
      centered
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label={t('admin.noteTemplates.name')}
            placeholder={t('admin.noteTemplates.namePlaceholder')}
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.currentTarget.value })}
          />

          <Textarea
            label={t('common.description')}
            placeholder={t('admin.noteTemplates.descriptionPlaceholder')}
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
          />

          <Select
            label={t('admin.noteTemplates.status')}
            required
            data={[
              { value: 'active', label: t('admin.noteTemplates.status.active') },
              { value: 'draft', label: t('admin.noteTemplates.status.draft') },
              { value: 'retired', label: t('admin.noteTemplates.status.retired') },
            ]}
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: value as 'active' | 'draft' | 'retired' })}
          />

          <div>
            <Group justify="space-between" mb="sm">
              <strong>{t('admin.noteTemplates.fields')}</strong>
              <Button size="xs" variant="light" onClick={handleAddField}>
                {t('admin.noteTemplates.addField')}
              </Button>
            </Group>

            <Stack gap="sm">
              {items.map((item, index) => (
                <Group key={index} align="flex-start" gap="xs">
                  <TextInput
                    placeholder={t('admin.noteTemplates.fieldLabel')}
                    value={item.text}
                    onChange={(e) => handleUpdateField(index, { text: e.currentTarget.value })}
                    className={styles.fieldInput}
                    size="sm"
                  />
                  <Select
                    placeholder={t('admin.noteTemplates.fieldType')}
                    data={[
                      { value: 'string', label: t('admin.noteTemplates.fieldType.string') },
                      { value: 'text', label: t('admin.noteTemplates.fieldType.text') },
                      { value: 'boolean', label: t('admin.noteTemplates.fieldType.boolean') },
                      { value: 'date', label: t('admin.noteTemplates.fieldType.date') },
                      { value: 'time', label: t('admin.noteTemplates.fieldType.time') },
                      { value: 'dateTime', label: t('admin.noteTemplates.fieldType.dateTime') },
                    ]}
                    value={item.type}
                    onChange={(value) => handleUpdateField(index, { type: value as any })}
                    className={styles.fieldType}
                    size="sm"
                  />
                  <Button
                    size="xs"
                    variant="light"
                    color="red"
                    onClick={() => handleRemoveField(index)}
                  >
                    {t('common.delete')}
                  </Button>
                </Group>
              ))}
            </Stack>
          </div>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading} leftSection={<IconCheck size={16} />}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

