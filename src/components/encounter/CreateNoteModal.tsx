import { Modal, Button, Group, Stack, Select, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Encounter, Patient, Questionnaire, QuestionnaireResponse, DocumentReference } from '@medplum/fhirtypes';
import { useMedplum, QuestionnaireForm } from '@medplum/react';
import { IconFileText } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { getNoteTemplates } from '../../utils/noteTemplates';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';

interface CreateNoteModalProps {
  opened: boolean;
  onClose: () => void;
  encounter: Encounter;
  patient: Patient;
  onSuccess?: () => void;
}

export function CreateNoteModal({ opened, onClose, encounter, patient, onSuccess }: CreateNoteModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [templates, setTemplates] = useState<Questionnaire[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Questionnaire | null>(null);

  useEffect(() => {
    const loadTemplates = async (): Promise<void> => {
      const result = await getNoteTemplates(medplum);
      // Only show active templates
      const activeTemplates = result.filter(t => t.status === 'active');
      setTemplates(activeTemplates);
      if (activeTemplates.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(activeTemplates[0].id || null);
        setSelectedTemplate(activeTemplates[0]);
      }
    };
    if (opened) {
      (async (): Promise<void> => { await loadTemplates(); })().catch(() => {});
    }
  }, [medplum, opened, selectedTemplateId]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    }
  }, [selectedTemplateId, templates]);

  const handleSubmit = async (response: QuestionnaireResponse): Promise<void> => {
    try {
      // Save the QuestionnaireResponse
      await medplum.createResource(response);
      let docReferenceError = null;
      try {
        // Also create a DocumentReference for easier note retrieval
        const noteContent = response.item?.map(item => {
          const question = selectedTemplate?.item?.find(q => q.linkId === item.linkId);
          const answer = item.answer?.[0];
          let answerText = '';
          if (answer?.valueString) { answerText = answer.valueString; }
          else if (answer?.valueBoolean !== undefined) { answerText = answer.valueBoolean ? 'Yes' : 'No'; }
          else if (answer?.valueDate) { answerText = answer.valueDate; }
          else if (answer?.valueDateTime) { answerText = answer.valueDateTime; }
          else if (answer?.valueTime) { answerText = answer.valueTime; }
          return `${question?.text || item.linkId}: ${answerText}`;
        }).join('\n\n');
        const docReference: DocumentReference = {
          resourceType: 'DocumentReference',
          status: 'current',
          type: {
            coding: [
              {
                system: 'http://loinc.org',
                code: '11506-3',
                display: t('notes.progressNote'),
              },
            ],
            text: selectedTemplate?.title ? t(`notes.${selectedTemplate.title.replace(/\s+/g, '')}`, selectedTemplate?.title) : t('notes.clinicalNote'),
          },
          subject: {
            reference: `Patient/${patient.id}`,
            display: patient.name?.[0]?.text || patient.name?.[0]?.family,
          },
          context: {
            encounter: [
              {
                reference: `Encounter/${encounter.id}`,
              },
            ],
          },
          author: [
            {
              reference: `${medplum.getProfile()?.resourceType}/${medplum.getProfile()?.id}`,
            },
          ],
          date: new Date().toISOString(),
          content: [
            {
              attachment: {
                contentType: 'text/plain',
                data: btoa(unescape(encodeURIComponent(noteContent || ''))),
              },
            },
          ],
        };
        await medplum.createResource(docReference);
      } catch (err) {
        docReferenceError = err;
        logger.error('DocumentReference creation failed', err);
      }
      notifications.show({
        title: docReferenceError ? t('partialSuccess') : t('success'),
        message: docReferenceError ? t('notes.savePartialSuccess') : t('notes.saveSuccess'),
        color: docReferenceError ? 'yellow' : 'green',
      });
      if (onSuccess) {
        onSuccess();
      }
    } catch (_error) {
      notifications.show({
        title: t('error'),
        message: t('notes.saveError'),
        color: 'red',
      });
    }
  };

  const templateOptions = templates.map(tmpl => ({
    value: tmpl.id || '',
    label: tmpl.title ? t(`notes.${tmpl.title.replace(/\s+/g, '')}`, tmpl.title) : t('notes.untitledTemplate'),
  }));

  return (
    <Modal opened={opened} onClose={onClose} title={t('notes.createNote')} size="lg" centered>
      <Stack>
        {templates.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            {t('notes.noTemplates')}
          </Text>
        ) : (
          <>
            <Select
              label={t('notes.selectTemplate')}
              placeholder={t('notes.chooseTemplate')}
              data={templateOptions}
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              leftSection={<IconFileText size={16} />}
            />

            {selectedTemplate && (
              <div key={selectedTemplate.id}>
                <Text size="sm" c="dimmed" mb="md">
                  {selectedTemplate.description}
                </Text>
                <QuestionnaireForm
                  key={selectedTemplate.id}
                  questionnaire={selectedTemplate}
                  onSubmit={handleSubmit}
                  submitButtonText={t('notes.saveClinicalNote')}
                />
              </div>
            )}
          </>
        )}

        {templates.length > 0 && (
          <Group justify="flex-end">
            <Button onClick={onClose} variant="subtle">
              {t('common.cancel')}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}

