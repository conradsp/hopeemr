import { Stack, Paper, Title, Text, Accordion, Group, Badge } from '@mantine/core';
import { getReferenceString, formatDateTime } from '@medplum/core';
import { Patient, DocumentReference } from '@medplum/fhirtypes';
import { Loading, useSearchResources } from '@medplum/react';
import { IconFileText } from '@tabler/icons-react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ClinicalImpressionDisplay.module.css';

interface ClinicalImpressionDisplayProps {
  readonly patient: Patient;
  readonly documents?: DocumentReference[];
}

export function ClinicalImpressionDisplay({ patient, documents: documentsProp }: ClinicalImpressionDisplayProps): JSX.Element {
  const { t } = useTranslation();
  
  // Fetch DocumentReference resources if not provided via props
  const [documentsFetched] = useSearchResources('DocumentReference', 
    !documentsProp && patient ? { 
      patient: getReferenceString(patient),
      _count: '50',
      _sort: '-date'
    } : undefined
  );

  // Use prop if provided, otherwise use fetched data
  const documents = documentsProp || documentsFetched;

  // Fetch practitioners who authored the documents
  const authorRefs = documents?.map(doc => doc.author?.[0]?.reference).filter((ref): ref is string => !!ref) ?? [];
  const [practitioners] = useSearchResources('Practitioner', 
    authorRefs.length > 0 ? { _id: authorRefs.map(ref => ref.split('/')[1]).join(',') } : undefined
  );

  // Helper to get practitioner name
  const getPractitionerName = (ref?: string): string => {
    if (!ref) return '';
    const match = practitioners?.find((p: any) => `Practitioner/${p.id}` === ref);
    if (match) {
      return match.name?.[0]?.text || [match.name?.[0]?.given, match.name?.[0]?.family].filter(Boolean).join(' ') || ref;
    }
    return ref;
  };

  if (!documents && !documentsProp) {
    return <Loading />;
  }

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder>
      <Title order={4} mb="md">
        <IconFileText size={20} className={styles.inlineIcon} />
        {t('clinicalNotes.title', 'Clinical Notes')}
      </Title>
      {!documents || documents.length === 0 ? (
        <Text ta="center" c="dimmed" py="xl">
          {t('clinicalNotes.none', 'No clinical notes recorded')}
        </Text>
      ) : (
        <Stack gap="sm">
          {documents.map((doc) => (
            <Paper key={doc.id} p="sm" withBorder>
              <Accordion>
                <Accordion.Item value={doc.id || String(doc.date) || 'unknown-note'}>
                  <Accordion.Control>
                    <Group justify="space-between" wrap="nowrap">
                      <div>
                        <Text fw={500} size="sm">
                          {doc.type?.text || doc.type?.coding?.[0]?.display || t('notesTab.document', 'Clinical Note')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {doc.date && formatDateTime(doc.date)}
                          {doc.author?.[0] && ` • ${getPractitionerName(doc.author[0].reference)}`}
                        </Text>
                      </div>
                      <Badge variant="light" size="sm">{doc.status}</Badge>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    {doc.description && (
                      <Text size="sm" mb="xs" c="dimmed">{doc.description}</Text>
                    )}
                    {doc.content && doc.content.length > 0 && doc.content[0].attachment?.data && (
                      <Paper p="sm" bg="gray.0" radius="sm">
                        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                          {(() => {
                            try {
                              return decodeURIComponent(escape(atob(doc.content[0].attachment.data)));
                            } catch {
                              return t('notesTab.unableToDecode', '[Unable to decode note content]');
                            }
                          })()}
                        </Text>
                      </Paper>
                    )}
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

