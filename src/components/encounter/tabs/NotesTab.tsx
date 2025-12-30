import { Paper, Text, Badge, Group, Stack, Title, Accordion } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { DocumentReference, DiagnosticReport } from '@medplum/fhirtypes';
import { JSX } from 'react';
import { getDiagnosticReportStatusColor } from '../../../utils/encounterUtils';
import { useTranslation } from 'react-i18next';
import { useSearchResources } from '@medplum/react';

interface NotesTabProps {
  documents: DocumentReference[] | undefined;
  diagnosticReports: DiagnosticReport[] | undefined;
}

export function NotesTab({ documents, diagnosticReports }: NotesTabProps): JSX.Element {
  const { t } = useTranslation();

  // Collect practitioner references from documents and diagnostic reports
  const docAuthorRefs = documents?.map(doc => doc.author?.[0]?.reference).filter((ref): ref is string => !!ref) ?? [];
  const reportPerformerRefs = diagnosticReports?.map(report => report.performer?.[0]?.reference).filter((ref): ref is string => !!ref) ?? [];
  const practitionerRefs = [...docAuthorRefs, ...reportPerformerRefs];

  // Fetch practitioners
  const [practitioners] = useSearchResources('Practitioner', practitionerRefs.length > 0 ? { _id: practitionerRefs.map(ref => ref.split('/')[1]).join(',') } : undefined);

  // Helper to get display name
  function getPractitionerName(ref?: string): string {
    if (!ref) { return ''; }
    const match = practitioners?.find((p: any) => `Practitioner/${p.id}` === ref);
    if (match) {
      return match.name?.[0]?.text || [match.name?.[0]?.given, match.name?.[0]?.family].filter(Boolean).join(' ') || ref;
    }
    return ref;
  }

  const hasNotes = (documents && documents.length > 0) || (diagnosticReports && diagnosticReports.length > 0);

  if (!hasNotes) {
    return (
      <Paper p="xl" withBorder>
        <Text ta="center" c="dimmed">{t('notesTab.noNotes', 'No clinical notes or documents recorded')}</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Documents */}
      {documents && documents.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">{t('notesTab.clinicalDocuments', 'Clinical Documents')}</Title>
          <Stack gap="sm">
            {documents.map((doc) => (
              <Paper key={doc.id} p="sm" withBorder>
                <Accordion>
                  <Accordion.Item value={doc.id || String(doc.date) || 'unknown-note'}>
                    <Accordion.Control>
                      <Group justify="space-between">
                        <Text fw={500}>
                          {doc.type?.text || doc.type?.coding?.[0]?.display || t('notesTab.document', 'Document')}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {doc.date && formatDateTime(doc.date)}
                          {doc.author?.[0] && ` - ${getPractitionerName(doc.author[0].reference)}`}
                        </Text>
                        <Badge variant="light">{doc.status}</Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      {doc.description && (
                        <Text size="sm" mt="xs" c="dimmed">{doc.description}</Text>
                      )}
                      {doc.content && doc.content.length > 0 && doc.content[0].attachment?.data && (
                        <Text size="sm" mt="xs" className="whitespace-pre-wrap">
                          {(() => {
                            try {
                              return decodeURIComponent(escape(atob(doc.content[0].attachment.data)));
                            } catch {
                              return t('notesTab.unableToDecode', '[Unable to decode note content]');
                            }
                          })()}
                        </Text>
                      )}
                    </Accordion.Panel>
                  </Accordion.Item>
                </Accordion>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}

      {/* Diagnostic Reports */}
      {diagnosticReports && diagnosticReports.length > 0 && (
        <Paper p="md" withBorder>
          <Title order={4} mb="sm">{t('notesTab.diagnosticReports', 'Diagnostic Reports')}</Title>
          <Stack gap="sm">
            {diagnosticReports.map((report) => (
              <Paper key={report.id} p="sm" withBorder>
                <Group justify="space-between">
                  <Text fw={500}>{report.code?.text || report.code?.coding?.[0]?.display || t('notesTab.report', 'Report')}</Text>
                  <Text size="xs" c="dimmed">
                    {report.effectiveDateTime && formatDateTime(report.effectiveDateTime)}
                    {report.performer?.[0] && ` - ${getPractitionerName(report.performer[0].reference)}`}
                  </Text>
                  <Badge color={getDiagnosticReportStatusColor(report.status)} variant="light">{report.status}</Badge>
                </Group>
                {report.conclusion && (
                  <Text size="sm" mt="xs">{report.conclusion}</Text>
                )}
                {report.presentedForm && report.presentedForm.length > 0 && report.presentedForm[0].data && (
                  <Text size="sm" mt="xs" className="whitespace-pre-wrap">
                    {(() => {
                      try {
                        return decodeURIComponent(escape(atob(report.presentedForm[0].data)));
                      } catch {
                        return t('notesTab.unableToDecode', '[Unable to decode note content]');
                      }
                    })()}
                  </Text>
                )}
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

