import { Stack, Modal, FileInput, Textarea, Button } from '@mantine/core';
import { ServiceRequest, DocumentReference, ActivityDefinition } from '@medplum/fhirtypes';
import { JSX, useState } from 'react';
import { useMedplum, useSearchResources } from '@medplum/react';
import { useTranslation } from 'react-i18next';
import { EnterLabResultModal } from '../EnterLabResultModal';
import { notifications } from '@mantine/notifications';
import { getLabTests } from '../../../utils/labTests';
import Lightbox from 'yet-another-react-lightbox';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';
import styles from './OrdersTab.module.css';

import { OrderCard } from './orders/OrderCard';
import { getOrderDocuments, getOrderResults } from './orders/orderHelpers';

interface OrdersTabProps {
  serviceRequests: ServiceRequest[] | undefined;
}

export function OrdersTab({ serviceRequests }: OrdersTabProps): JSX.Element {
  const medplum = useMedplum();
  const { t } = useTranslation();
  const [labResultModalOpen, setLabResultModalOpen] = useState(false);
  const [resultFields, setResultFields] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<ServiceRequest | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Imaging upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState<ServiceRequest | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNote, setUploadNote] = useState('');

  // Image viewer modal state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerSlides, setViewerSlides] = useState<any[]>([]);
  const [viewerNotes, setViewerNotes] = useState<string[]>([]);
  const [viewerOrderName, setViewerOrderName] = useState('Image Gallery');

  // Expanded state for each order
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Get encounter reference from the first order, or undefined
  const encounterRef = serviceRequests?.[0]?.encounter?.reference;
  // Fetch all observations for the encounter, add refreshKey to force reload
  const [allObservations] = useSearchResources('Observation', encounterRef ? { encounter: encounterRef, _count: '100', _: refreshKey } : undefined);
  // Fetch DocumentReferences for the encounter, add refreshKey to force reload
  const [documentReferences] = useSearchResources('DocumentReference', encounterRef ? { encounter: encounterRef, _count: '100', _: refreshKey } : undefined);

  const handleSaveResults = async (values: Record<string, any>): Promise<void> => {
    if (!activeOrder) { return; }
    for (const field of resultFields) {
      const existingObs = allObservations?.find(obs =>
        obs.subject?.reference === activeOrder.subject?.reference &&
        obs.encounter?.reference === activeOrder.encounter?.reference &&
        (
          obs.code?.text === field.label ||
          obs.code?.coding?.[0]?.code === activeOrder.code?.coding?.[0]?.code
        )
      );
      const obs: any = {
        resourceType: 'Observation',
        status: 'final',
        code: { text: field.label },
        subject: activeOrder.subject,
        encounter: activeOrder.encounter,
        effectiveDateTime: new Date().toISOString(),
        valueQuantity: field.type === 'number' ? {
          value: Number(values[field.name]),
          unit: field.unit,
        } : undefined,
        valueString: field.type === 'string' ? values[field.name] : undefined,
        valueBoolean: field.type === 'boolean' ? Boolean(values[field.name]) : undefined,
        valueCodeableConcept: field.type === 'select' ? { text: values[field.name] } : undefined,
        basedOn: activeOrder.id ? [{ reference: `ServiceRequest/${activeOrder.id}` }] : undefined,
      };
      if (existingObs?.id) {
        await medplum.updateResource({ ...obs, id: existingObs.id });
      } else {
        await medplum.createResource(obs);
      }
    }
    setLabResultModalOpen(false);
    setActiveOrder(null);
    setRefreshKey(k => k + 1);
  };

  async function handleUploadImage(): Promise<void> {
    if (!uploadingOrder || !uploadFile) {
      notifications.show({ title: 'Validation Error', message: 'Please select a file', color: 'yellow' });
      return;
    }
    try {
      const fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(uploadFile);
      });
      const base64 = fileData.split(',')[1];
      const docRef: DocumentReference = {
        resourceType: 'DocumentReference',
        status: 'current',
        type: { text: 'Imaging' },
        subject: uploadingOrder.subject as any,
        context: {
          encounter: uploadingOrder.encounter ? [uploadingOrder.encounter] : undefined,
          related: [ { reference: `ServiceRequest/${uploadingOrder.id}` } ],
        },
        content: [
          {
            attachment: {
              contentType: uploadFile.type,
              data: base64,
              title: uploadFile.name,
            },
          },
        ],
        description: uploadNote,
      };
      await medplum.createResource(docRef);
      notifications.show({ title: 'Success', message: 'Image uploaded', color: 'green' });
      setUploadModalOpen(false);
      setUploadingOrder(null);
      setUploadFile(null);
      setUploadNote('');
      setRefreshKey(k => k + 1);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to upload image', color: 'red' });
    }
  }

  async function handleDeleteImage(doc: DocumentReference): Promise<void> {
    if (!doc.id) {
      return;
    }
    try {
      await medplum.deleteResource('DocumentReference', doc.id);
      notifications.show({ title: 'Deleted', message: 'Image deleted', color: 'green' });
      setRefreshKey(k => k + 1);
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to delete image', color: 'red' });
    }
  }

  async function handleEnterLabResults(sr: ServiceRequest): Promise<void> {
    const testCode = sr.code?.coding?.[0]?.code || sr.code?.text;
    if (!testCode) {
      notifications.show({ title: 'Error', message: 'Cannot determine test type', color: 'red' });
      return;
    }
    const labTests = await getLabTests(medplum);
    const matchingTest = labTests.find(
      (def) => {
        const defCode = def.identifier?.find(id => id.system === 'http://medplum.com/emr/lab-test')?.value;
        const defTitle = def.title || def.code?.text;
        return defCode === testCode || defTitle === sr.code?.coding?.[0]?.display || defTitle === sr.code?.text;
      }
    );
    
    if (matchingTest) {
      // Extract result fields from extension
      const resultFieldsExt = matchingTest.extension?.find(ext => ext.url === 'resultFields');
      if (resultFieldsExt?.valueString) {
        try {
          const fields = JSON.parse(resultFieldsExt.valueString);
          setResultFields(fields);
        } catch {
          setResultFields([{ name: 'result', label: sr.code?.coding?.[0]?.display || sr.code?.text || 'Result', type: 'string' }]);
        }
      } else {
        setResultFields([{ name: 'result', label: sr.code?.coding?.[0]?.display || sr.code?.text || 'Result', type: 'string' }]);
      }
    } else {
      setResultFields([{ name: 'result', label: sr.code?.coding?.[0]?.display || sr.code?.text || 'Result', type: 'string' }]);
    }
    setActiveOrder(sr);
    setLabResultModalOpen(true);
  }

  return (
    <>
      <Stack gap="sm">
        {serviceRequests?.map((sr) => {
          const isLab = sr.category?.[0]?.coding?.[0]?.code === '108252007';
          const isImaging = sr.category?.[0]?.coding?.[0]?.code === '363679005';
          const results = getOrderResults(sr, allObservations || []);
          const documents = getOrderDocuments(sr, documentReferences || []);
          const isExpanded = !!expandedOrders[sr.id ?? ''];
          return (
            <OrderCard
              sr={sr}
              key={sr.id || sr.code?.coding?.[0]?.code || sr.code?.text || Math.random()}
              isLab={isLab}
              isImaging={isImaging}
              results={results}
              documents={documents}
              t={t}
              onUploadImage={() => { setUploadModalOpen(true); setUploadingOrder(sr); }}
              onViewImages={() => {
                setViewerSlides(documents.map(doc => ({
                  src: `data:${doc.content[0].attachment.contentType};base64,${doc.content[0].attachment.data}`,
                  alt: doc.content[0].attachment.title,
                  type: 'image',
                  description: doc.description || '',
                })));
                setViewerNotes(documents.map(doc => doc.description || ''));
                setViewerOrderName(sr.code?.coding?.[0]?.display || sr.code?.text || 'Image Gallery');
                setViewerOpen(true);
              }}
              onEnterLabResults={() => handleEnterLabResults(sr)}
              expanded={isExpanded}
              setExpanded={(val) => setExpandedOrders(prev => ({ ...prev, [sr.id ?? '']: val }))}
              onDeleteImage={handleDeleteImage}
            />
          );
        })}
      </Stack>
      {/* Imaging upload modal */}
      <Modal opened={uploadModalOpen} onClose={() => setUploadModalOpen(false)} title="Upload Imaging">
        <Stack>
          <FileInput label="Select Image" value={uploadFile} onChange={setUploadFile} accept="image/*" required />
          <Textarea label="Notes" value={uploadNote} onChange={e => setUploadNote(e.currentTarget.value)} placeholder="Enter notes" />
          <Button onClick={handleUploadImage}>Upload</Button>
        </Stack>
      </Modal>
      {/* Lightbox gallery modal with zoom and thumbnails */}
      <Modal
        opened={viewerOpen}
        onClose={() => setViewerOpen(false)}
        title={viewerOrderName}
        size="md"
        styles={{ content: { background: '#fff' } }}
      >
        <div className={styles.viewerContainer}>
          <Lightbox
            open={viewerOpen}
            close={() => setViewerOpen(false)}
            slides={viewerSlides}
            plugins={[Thumbnails, Zoom]}
            render={{
              slide: ({ slide }: { slide: any }) => (
                <div className={styles.slideContainer}>
                  <img
                    src={slide.src}
                    alt={slide.alt}
                    className={styles.slideImage}
                  />
                  {slide.description && (
                    <div className={styles.slideDescription}>{slide.description}</div>
                  )}
                </div>
              ),
            }}
          />
        </div>
      </Modal>
      <EnterLabResultModal
        opened={labResultModalOpen}
        onClose={() => {
          setLabResultModalOpen(false);
          setActiveOrder(null);
        }}
        resultFields={resultFields}
        onSave={handleSaveResults}
      />
    </>
  );
}