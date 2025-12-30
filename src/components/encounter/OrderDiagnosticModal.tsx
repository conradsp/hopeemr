import { JSX, useState, useEffect, useCallback } from 'react';
import { Modal, Button, Group, Stack, Select, Textarea, Text, Tabs, MultiSelect, Radio, Divider } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { Patient, Encounter, ServiceRequest, ActivityDefinition, Organization } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import { getLabTests } from '../../utils/labTests';
import { getImagingTests } from '../../utils/imagingTests';
import { getDiagnosticProviders } from '../../utils/diagnosticProviders';
import { useTranslation } from 'react-i18next';
import { createLabCharge, createImagingCharge, getPriceFromResource } from '../../utils/billing';
import { handleError } from '../../utils/errorHandling';
import { useOfflineMutation } from '../../offline';

interface OrderDiagnosticModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  patient: Patient;
  encounter: Encounter;
}

type OrderType = 'lab' | 'imaging';

export function OrderDiagnosticModal({ opened, onClose, patient, encounter }: OrderDiagnosticModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const { createResource, isOnline } = useOfflineMutation();
  const [loading, setLoading] = useState(false);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [orderType, setOrderType] = useState<OrderType>('lab');
  
  // Catalog data
  const [labTests, setLabTests] = useState<ActivityDefinition[]>([]);
  const [imagingTests, setImagingTests] = useState<ActivityDefinition[]>([]);
  const [providers, setProviders] = useState<Organization[]>([]);
  
  // Order form data
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [priority, setPriority] = useState<string>('routine');
  const [specimenCollectedOnSite, setSpecimenCollectedOnSite] = useState<string>('yes');
  const [specimenDetails, setSpecimenDetails] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [reasonForOrder, setReasonForOrder] = useState('');

  const loadCatalogs = useCallback(async (): Promise<void> => {
    setCatalogsLoading(true);
    try {
      const [labs, imaging, provs] = await Promise.all([
        getLabTests(medplum),
        getImagingTests(medplum),
        getDiagnosticProviders(medplum),
      ]);
      setLabTests(labs);
      setImagingTests(imaging);
      setProviders(provs.filter(p => p.active !== false));
    } catch (_error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load diagnostic catalogs',
        color: 'red',
      });
    } finally {
      setCatalogsLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    if (opened) {
      // Reset form
      setSelectedTests([]);
      setSelectedProvider(null);
      setPriority('routine');
      setSpecimenCollectedOnSite('yes');
      setSpecimenDetails('');
      setClinicalNotes('');
      setReasonForOrder('');
      loadCatalogs().catch(() => {});
    }
  }, [opened, loadCatalogs]);

  const handleSubmit = async () => {
    if (selectedTests.length === 0) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select at least one test',
        color: 'yellow',
      });
      return;
    }

    if (!selectedProvider) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select a diagnostic provider',
        color: 'yellow',
      });
      return;
    }

    setLoading(true);
    try {
      const currentTests = orderType === 'lab' ? labTests : imagingTests;
      const providerOrg = providers.find(p => p.id === selectedProvider);
      let anyQueued = false;

      // Create a ServiceRequest for each selected test
      for (const testId of selectedTests) {
        const test = currentTests.find(t => t?.id === testId);
        if (!test) { continue; }

        const serviceRequest: ServiceRequest = {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          priority: priority as 'routine' | 'urgent' | 'asap' | 'stat',
          category: [
            {
              coding: [
                {
                  system: 'http://snomed.info/sct',
                  code: orderType === 'lab' ? '108252007' : '363679005',
                  display: orderType === 'lab' ? 'Laboratory procedure' : 'Imaging',
                },
              ],
            },
          ],
          code: test.code,
          subject: {
            reference: `Patient/${patient.id}`,
            display: `${patient.name?.[0]?.given?.[0]} ${patient.name?.[0]?.family}`,
          },
          encounter: {
            reference: `Encounter/${encounter.id}`,
          },
          authoredOn: new Date().toISOString(),
          requester: {
            reference: `Practitioner/${medplum.getProfile()?.id}`,
          },
          performer: providerOrg ? [
            {
              reference: `Organization/${providerOrg.id}`,
              display: providerOrg.name,
            },
          ] : undefined,
          reasonCode: reasonForOrder ? [
            {
              text: reasonForOrder,
            },
          ] : undefined,
          note: clinicalNotes ? [
            {
              text: clinicalNotes,
            },
          ] : undefined,
          // Store additional metadata in extensions
          extension: [
            orderType === 'lab' && specimenCollectedOnSite === 'yes' ? {
              url: 'specimenCollectionOnSite',
              valueBoolean: true,
            } : undefined,
            orderType === 'lab' && specimenDetails ? {
              url: 'specimenDetails',
              valueString: specimenDetails,
            } : undefined,
          ].filter(Boolean) as ServiceRequest['extension'],
        };

        // Create with offline support
        const result = await createResource(serviceRequest, 'ServiceRequest');
        if (result.isQueued) {
          anyQueued = true;
        }

        // Create billing charge if test has a price (only when online)
        if (!result.isQueued && isOnline) {
          try {
            const price = getPriceFromResource(test);
            if (price && price > 0) {
              const testName = test.title || test.code?.text || 'Test';
              if (orderType === 'lab') {
                if (patient.id && encounter.id) {
                  await createLabCharge(
                    medplum,
                    patient.id,
                    encounter.id,
                    testName,
                    price,
                    result.resource.id
                  );
                }
              } else if (patient.id && encounter.id) {
                await createImagingCharge(
                  medplum,
                  patient.id,
                  encounter.id,
                  testName,
                  price,
                  result.resource.id
                );
              }
            }
          } catch (billingError) {
            // Log error but don't fail the order
            handleError(billingError, 'creating diagnostic charge');
          }
        }
      }

      if (anyQueued) {
        notifications.show({
          title: t('orders.savedOfflineTitle', 'Orders Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: 'Success',
          message: `${selectedTests.length} ${orderType === 'lab' ? 'lab' : 'imaging'} order(s) created successfully`,
          color: 'green',
        });
      }
      onClose(true);
    } catch (error) {
      handleError(error, 'creating diagnostic orders');
      notifications.show({
        title: 'Error',
        message: 'Failed to create orders',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Only compute options when not loading to avoid undefined errors
  const getTestOptions = (): { value: string; label: string }[] => {
    if (catalogsLoading || !labTests || !imagingTests) { return []; }
    try {
      const currentTests = orderType === 'lab' ? labTests : imagingTests;
      if (!Array.isArray(currentTests)) { return []; }
      return currentTests
        .filter(t => t?.id && t?.title)
        .map(t => {
          const category = (t.extension || []).find(e => e.url === 'category')?.valueString;
          return {
            value: String(t.id),
            label: String(t.title) + (category ? ` (${category})` : ''),
          };
        });
    } catch (error) {
      handleError(error, 'Error getting test options');
      return [];
    }
  };

  const getProviderOptions = (): { value: string; label: string }[] => {
    if (catalogsLoading || !providers) { return []; }
    try {
      if (!Array.isArray(providers)) { return []; }
      return providers
        .filter(p => p?.id && p?.name)
        .map(p => ({ value: String(p.id), label: String(p.name) }));
    } catch (error) {
      handleError(error, 'Error getting provider options');
      return [];
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => onClose(false)}
      title={t('orders.orderDiagnostic')}
      size="xl"
    >
      {catalogsLoading ? (
        <Stack gap="md" align="center" py="xl">
          <Text>{t('orders.loadingCatalogs')}</Text>
        </Stack>
      ) : (
        <Stack gap="md" key={orderType}>
          <Tabs value={orderType} onChange={(value) => {
            setOrderType(value as OrderType);
            setSelectedTests([]); // Clear selections when switching tabs
          }}>
            <Tabs.List>
              <Tabs.Tab value="lab">{t('orders.laboratoryTests')}</Tabs.Tab>
              <Tabs.Tab value="imaging">{t('orders.imagingStudies')}</Tabs.Tab>
            </Tabs.List>
          </Tabs>

          <MultiSelect
            key={`${orderType}-${catalogsLoading}`}
            label={t('orders.selectTests')}
            placeholder={t('orders.selectTestsPlaceholder', { type: orderType === 'lab' ? t('orders.labTests') : t('orders.imagingStudies') })}
            data={getTestOptions()}
            value={selectedTests || []}
            onChange={(value) => setSelectedTests(value || [])}
            searchable
            required
          />

          <Select
            label={t('orders.provider')}
            placeholder={t('orders.selectProvider')}
            data={getProviderOptions()}
            value={selectedProvider}
            onChange={setSelectedProvider}
            required
          />

          <Select
            label={t('orders.priority')}
            placeholder={t('orders.selectPriority')}
            data={[
              { value: 'routine', label: t('orders.routine') },
              { value: 'urgent', label: t('orders.urgent') },
              { value: 'asap', label: t('orders.asap') },
              { value: 'stat', label: t('orders.stat') },
            ]}
            value={priority}
            onChange={(value) => setPriority(value || 'routine')}
          />

          <Textarea
            label={t('orders.reasonForOrder')}
            placeholder={t('orders.reasonForOrderPlaceholder')}
            value={reasonForOrder}
            onChange={(e) => setReasonForOrder(e.currentTarget.value)}
            rows={2}
          />

          {orderType === 'lab' && (
            <>
              <Divider label={t('orders.specimenCollection')} />
              
              <Radio.Group
                label={t('orders.specimenCollectionLocation')}
                value={specimenCollectedOnSite}
                onChange={setSpecimenCollectedOnSite}
              >
                <Stack gap="xs" mt="xs">
                  <Radio value="yes" label={t('orders.collectedOnSite')} />
                  <Radio value="no" label={t('orders.patientToVisitLab')} />
                </Stack>
              </Radio.Group>

              {specimenCollectedOnSite === 'yes' && (
                <Textarea
                  label={t('orders.specimenDetails')}
                  placeholder={t('orders.specimenDetailsPlaceholder')}
                  value={specimenDetails}
                  onChange={(e) => setSpecimenDetails(e.currentTarget.value)}
                  rows={2}
                />
              )}
            </>
          )}

          <Textarea
            label={t('orders.clinicalNotes')}
            placeholder={t('orders.clinicalNotesPlaceholder')}
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.currentTarget.value)}
            rows={3}
          />

          <Text size="sm" c="dimmed">
            {t('orders.patient')}: {patient.name?.[0]?.given?.[0]} {patient.name?.[0]?.family}
            {patient.birthDate && ` (${t('orders.dob')}: ${patient.birthDate})`}
          </Text>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => onClose(false)}>
              {t('orders.cancel')}
            </Button>
            <Button onClick={handleSubmit} loading={loading}>
              {t('orders.submitOrder')}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}

