import React from 'react';
import { Paper, Group, Text, Badge, Button, Collapse, Stack } from '@mantine/core';
import { formatDateTime } from '@medplum/core';
import { ServiceRequest, Observation, DocumentReference } from '@medplum/fhirtypes';
import { getServiceRequestStatusColor } from '../../../../utils/encounterUtils';
import { useSearchResources } from '@medplum/react';
import styles from './OrderCard.module.css';

interface OrderCardProps {
  sr: ServiceRequest;
  isLab: boolean;
  isImaging: boolean;
  results: Observation[];
  documents: DocumentReference[];
  t: any;
  onUploadImage: () => void;
  onViewImages: () => void;
  onEnterLabResults?: () => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  onDeleteImage?: (doc: DocumentReference) => void;
}

export function OrderCard({ 
  sr, 
  isLab, 
  isImaging, 
  results, 
  documents, 
  t, 
  onUploadImage, 
  onViewImages, 
  onEnterLabResults, 
  expanded, 
  setExpanded, 
  onDeleteImage 
}: OrderCardProps): React.ReactElement {
  // Fetch practitioners for display
  const practitionerRefs = [
    sr.requester?.reference,
    sr.performer?.[0]?.reference
  ].filter((ref): ref is string => !!ref);

  const [practitioners] = useSearchResources(
    'Practitioner',
    practitionerRefs.length > 0 
      ? { _id: practitionerRefs.map(ref => ref.split('/')[1]).join(',') } 
      : undefined
  );

  const getPractitionerName = (ref?: string): string => {
    if (!ref) return '';
    
    const practitioner = practitioners?.find((p: any) => `Practitioner/${p.id}` === ref);
    if (practitioner) {
      return practitioner.name?.[0]?.text || 
             [practitioner.name?.[0]?.given, practitioner.name?.[0]?.family].filter(Boolean).join(' ') || 
             ref;
    }
    return ref;
  };

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" align="flex-start" mb={4}>
        <Group gap="xs">
          <Badge color={isLab ? 'blue' : 'grape'} size="sm">
            {isLab ? t('orders.lab') : t('orders.imaging')}
          </Badge>
          <Badge color={getServiceRequestStatusColor(sr.status)} variant="light">
            {t(`orders.status.${sr.status}`)}
          </Badge>
          {sr.priority && sr.priority !== 'routine' && (
            <Badge color="red" variant="filled" size="sm">
              {t(`orders.priority.${sr.priority}`)}
            </Badge>
          )}
        </Group>
        <Button size="xs" variant="subtle" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('orders.collapse') || 'Collapse' : t('orders.expand') || 'Expand'}
        </Button>
      </Group>

      <Text fw={500} size="lg">
        {sr.code?.coding?.[0]?.display || sr.code?.text || t('orders.noOrders')}
      </Text>

      <Group gap="xs" mt={4}>
        <Text size="xs" c="dimmed">
          {t('orders.ordered')}: {sr.authoredOn && formatDateTime(sr.authoredOn)}
        </Text>
        {sr.requester && (
          <Text size="xs" c="dimmed">
            • {t('orders.by')}: {getPractitionerName(sr.requester.reference)}
          </Text>
        )}
      </Group>

      <Collapse in={expanded} transitionDuration={200}>
        <Stack gap="sm" mt="md">
          {/* Provider Information */}
          {sr.performer?.[0] && (
            <Text size="sm" c="dimmed">
              {t('orders.provider')}: {getPractitionerName(sr.performer[0].reference)}
            </Text>
          )}

          {/* Reason */}
          {sr.reasonCode?.[0] && (
            <Paper bg="gray.0" p="sm" radius="sm">
              <Text size="xs" c="dimmed" mb={4}>
                {t('orders.reason')}
              </Text>
              <Text size="sm">
                {sr.reasonCode[0].text || sr.reasonCode[0].coding?.[0]?.display}
              </Text>
            </Paper>
          )}

          {/* Clinical Notes */}
          {sr.note?.[0] && (
            <Paper bg="blue.0" p="sm" radius="sm">
              <Text size="xs" c="dimmed" mb={4}>
                {t('orders.clinicalNotes')}
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {sr.note[0].text}
              </Text>
            </Paper>
          )}

          {/* Action Buttons */}
          <Group gap="xs">
            {isImaging && (
              <Button size="xs" onClick={onUploadImage}>
                Upload Image/Note
              </Button>
            )}
            {isLab && onEnterLabResults && (
              <Button size="xs" onClick={onEnterLabResults}>
                {results.length > 0 
                  ? t('orders.updateResults', 'Update Results') 
                  : t('orders.enterResults', 'Enter Results')}
              </Button>
            )}
          </Group>

          {/* Imaging Documents */}
          {isImaging && documents.length > 0 && (
            <Paper bg="gray.1" p="sm" radius="sm" style={{ cursor: 'pointer' }} onClick={onViewImages}>
              <Text size="xs" c="dimmed" mb={4}>
                Attached Images
              </Text>
              <Stack gap="xs">
                {documents.map((doc, idx) => (
                  <Group key={doc.id ?? idx} gap="md" align="center">
                    {doc.content?.[0]?.attachment?.data && (
                      <img
                        src={`data:${doc.content[0].attachment.contentType};base64,${doc.content[0].attachment.data}`}
                        alt={doc.content[0].attachment.title}
                        className={styles.thumbnail}
                      />
                    )}
                    <Text fw={500}>
                      {doc.content?.[0]?.attachment?.title}
                    </Text>
                    {doc.description && (
                      <Text size="sm">{doc.description}</Text>
                    )}
                    <Text c="dimmed" size="xs" style={{ marginLeft: 'auto' }}>
                      {doc.date && formatDateTime(doc.date)}
                    </Text>
                    <Button 
                      size="xs" 
                      color="red" 
                      variant="light" 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteImage?.(doc);
                      }}
                    >
                      Delete
                    </Button>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}

          {/* Lab Results */}
          {isLab && results.length === 0 && (
            <Text size="xs" c="dimmed">
              No lab results
            </Text>
          )}
          {isLab && results.length > 0 && (
            <Paper bg="gray.1" p="sm" radius="sm">
              <Text size="xs" c="dimmed" mb={4}>
                Lab Results
              </Text>
              <Stack gap="xs">
                {results.map((obs: any, idx: number) => (
                  <Group key={idx} gap="md" align="center">
                    <Text fw={500} className={styles.resultLabel}>
                      {obs.code?.text}
                    </Text>
                    {obs.valueQuantity && (
                      <Text>
                        {obs.valueQuantity.value} {obs.valueQuantity.unit}
                      </Text>
                    )}
                    {obs.valueString && <Text>{obs.valueString}</Text>}
                    {obs.valueBoolean !== undefined && (
                      <Text>{obs.valueBoolean ? 'Yes' : 'No'}</Text>
                    )}
                    {obs.valueCodeableConcept && (
                      <Text>{obs.valueCodeableConcept.text}</Text>
                    )}
                    <Text c="dimmed" size="xs" style={{ marginLeft: 'auto' }}>
                      {obs.effectiveDateTime && formatDateTime(obs.effectiveDateTime)}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Paper>
          )}
        </Stack>
      </Collapse>
    </Paper>
  );
}
