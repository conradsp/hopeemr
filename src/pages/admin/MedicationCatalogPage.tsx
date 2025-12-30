import { Paper, Title, Button, Group, Stack, Table, TextInput, Badge, Modal, Select, Textarea, NumberInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Document, useMedplum } from '@medplum/react';
import { Medication } from '@medplum/fhirtypes';
import { IconPlus, IconEdit, IconTrash, IconPill, IconSearch, IconRefresh } from '@tabler/icons-react';
import { JSX, useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMedications, createMedication, updateMedication, deleteMedication, initializeDefaultMedications } from '../../utils/medications';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { getPriceFromResource, setPriceOnResource } from '../../utils/billing';
import styles from './MedicationCatalogPage.module.css';

interface MedicationFormData {
  genericName: string;
  brandName: string;
  dosageForm: string;
  strength: string;
  unit: string;
  rxcui: string;
  ndc: string;
  category: string;
  description: string;
  price: number;
}

export function MedicationCatalogPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<MedicationFormData>({
    genericName: '',
    brandName: '',
    dosageForm: 'tablet',
    strength: '',
    unit: 'mg',
    rxcui: '',
    ndc: '',
    category: 'other',
    price: 0,
    description: '',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const loadMedications = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const meds = await getMedications(medplum);
      setMedications(meds);
    } catch (error) {
      handleError(error, 'loading medications');
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    loadMedications().catch(() => {});
  }, [loadMedications]);

  const handleOpenModal = (medication?: Medication): void => {
    if (medication) {
      setEditingMedication(medication);
      setFormData({
        genericName: medication.code?.coding?.[0]?.display || '',
        brandName: medication.code?.text || '',
        dosageForm: medication.form?.coding?.[0]?.code || 'tablet',
        strength: medication.amount?.numerator?.value?.toString() || '',
        unit: medication.amount?.numerator?.unit || 'mg',
        rxcui: medication.code?.coding?.find(c => c.system === 'http://www.nlm.nih.gov/research/umls/rxnorm')?.code || '',
        ndc: medication.code?.coding?.find(c => c.system === 'http://hl7.org/fhir/sid/ndc')?.code || '',
        category: medication.extension?.find(e => e.url === 'http://example.org/fhir/StructureDefinition/medication-category')?.valueString || 'other',
        description: medication.extension?.find(e => e.url === 'http://example.org/fhir/StructureDefinition/medication-description')?.valueString || '',
        price: getPriceFromResource(medication) || 0,
      });
    } else {
      setEditingMedication(null);
      setFormData({
        genericName: '',
        brandName: '',
        dosageForm: 'tablet',
        strength: '',
        unit: 'mg',
        rxcui: '',
        ndc: '',
        category: 'other',
        description: '',
        price: 0,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!formData.genericName) {
      notifications.show({
        title: t('validationError'),
        message: t('pharmacy.medicationName') + ' ' + t('common.required'),
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const medicationData: Partial<Medication> = {
        resourceType: 'Medication',
        status: 'active',
        code: {
          coding: [
            {
              system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
              code: formData.rxcui,
              display: formData.genericName,
            },
          ],
          text: formData.brandName || formData.genericName,
        },
        form: {
          coding: [
            {
              code: formData.dosageForm,
              display: t(`pharmacy.forms.${formData.dosageForm}`),
            },
          ],
        },
        amount: {
          numerator: {
            value: parseFloat(formData.strength) || 0,
            unit: formData.unit,
          },
          denominator: {
            value: 1,
          },
        },
        extension: [
          {
            url: 'http://example.org/fhir/StructureDefinition/medication-category',
            valueString: formData.category,
          },
          {
            url: 'http://example.org/fhir/StructureDefinition/medication-description',
            valueString: formData.description,
          },
        ],
      };

      // Add NDC if provided
      if (formData.ndc) {
        medicationData.code?.coding?.push({
          system: 'http://hl7.org/fhir/sid/ndc',
          code: formData.ndc,
        });
      }

      if (editingMedication) {
        // Only allow valueString for category and description extensions
        const allowedUrls = [
          'http://example.org/fhir/StructureDefinition/medication-category',
          'http://example.org/fhir/StructureDefinition/medication-description',
        ];
        function filterAllowedExtensions(extArr: any[] = []): any[] {
          const allowedUrls = [
            'http://example.org/fhir/StructureDefinition/medication-category',
            'http://example.org/fhir/StructureDefinition/medication-description',
          ];
          return extArr.filter(
            (ext) =>
              (allowedUrls.includes(ext.url) && typeof ext.valueString === 'string') ||
              (!('valueString' in ext))
          );
        }
        const cleanedExtensions = filterAllowedExtensions(editingMedication.extension);
        const newExtensions = filterAllowedExtensions(medicationData.extension);
         const updatedMedication = {
           ...medicationData,
           id: editingMedication.id,
           extension: [...cleanedExtensions, ...newExtensions],
         } as Medication;
         const medicationWithPrice = setPriceOnResource(updatedMedication, formData.price);
         await updateMedication(medplum, medicationWithPrice);
         showSuccess(t('pharmacy.updateSuccess'));
      } else {
        const allowedUrls = [
          'http://example.org/fhir/StructureDefinition/medication-category',
          'http://example.org/fhir/StructureDefinition/medication-description',
        ];
        function filterAllowedExtensions(extArr: any[] = []): any[] {
          const allowedUrls = [
            'http://example.org/fhir/StructureDefinition/medication-category',
            'http://example.org/fhir/StructureDefinition/medication-description',
          ];
          return extArr.filter(
            (ext) =>
              (allowedUrls.includes(ext.url) && typeof ext.valueString === 'string') ||
              (!('valueString' in ext))
          );
        }
        medicationData.extension = filterAllowedExtensions(medicationData.extension);
        const medicationWithPrice = setPriceOnResource(medicationData, formData.price);
        await createMedication(medplum, medicationWithPrice);
        showSuccess(t('pharmacy.addSuccess'));
      }

      setModalOpen(false);
      await loadMedications();
    } catch (error) {
      handleError(error, editingMedication ? 'updating medication' : 'adding medication');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (medicationId?: string): void => {
    if (!medicationId) return;
    setPendingDeleteId(medicationId);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!pendingDeleteId) { return; }
    setConfirmOpen(false);
    try {
      await deleteMedication(medplum, pendingDeleteId);
      showSuccess(t('pharmacy.deleteSuccess'));
      await loadMedications();
    } catch (error) {
      handleError(error, 'deleting medication');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = (): void => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  // Sort medications alphabetically by name before filtering
  const sortedMedications = [...medications].sort((a, b) => {
    const nameA = (a.code?.text || a.code?.coding?.[0]?.display || '').toLowerCase();
    const nameB = (b.code?.text || b.code?.coding?.[0]?.display || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const filteredMedications = sortedMedications.filter(med =>
    med.code?.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    med.code?.coding?.[0]?.display?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const dosageFormOptions = [
    { value: 'tablet', label: t('pharmacy.forms.tablet') },
    { value: 'capsule', label: t('pharmacy.forms.capsule') },
    { value: 'liquid', label: t('pharmacy.forms.liquid') },
    { value: 'injection', label: t('pharmacy.forms.injection') },
    { value: 'cream', label: t('pharmacy.forms.cream') },
    { value: 'ointment', label: t('pharmacy.forms.ointment') },
    { value: 'inhaler', label: t('pharmacy.forms.inhaler') },
    { value: 'patch', label: t('pharmacy.forms.patch') },
  ];

  const categoryOptions = [
    { value: 'antibiotic', label: t('pharmacy.categories.antibiotic') },
    { value: 'analgesic', label: t('pharmacy.categories.analgesic') },
    { value: 'cardiovascular', label: t('pharmacy.categories.cardiovascular') },
    { value: 'gastrointestinal', label: t('pharmacy.categories.gastrointestinal') },
    { value: 'respiratory', label: t('pharmacy.categories.respiratory') },
    { value: 'endocrine', label: t('pharmacy.categories.endocrine') },
    { value: 'neurological', label: t('pharmacy.categories.neurological') },
    { value: 'other', label: t('pharmacy.categories.other') },
  ];

  const handleInitializeDefaults = async (): Promise<void> => {
    setLoading(true);
    try {
      await initializeDefaultMedications(medplum);
      showSuccess(t('pharmacy.initializeSuccess'));
      await loadMedications();
    } catch (error) {
      handleError(error, 'initializing default medications');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Document>
      <BreadcrumbNav />
      
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingMedication ? t('pharmacy.editMedication') : t('pharmacy.addMedication')}
        size="lg"
      >
        <Stack>
          <TextInput
            label={t('pharmacy.genericName')}
            required
            value={formData.genericName}
            onChange={(e) => setFormData({ ...formData, genericName: e.currentTarget.value })}
          />
          <TextInput
            label={t('pharmacy.brandName')}
            value={formData.brandName}
            onChange={(e) => setFormData({ ...formData, brandName: e.currentTarget.value })}
          />
          <Group grow>
            <Select
              label={t('pharmacy.dosageForm')}
              required
              data={dosageFormOptions}
              value={formData.dosageForm}
              onChange={(value) => setFormData({ ...formData, dosageForm: value || 'tablet' })}
            />
            <TextInput
              label={t('pharmacy.strength')}
              required
              value={formData.strength}
              onChange={(e) => setFormData({ ...formData, strength: e.currentTarget.value })}
            />
            <TextInput
              label={t('pharmacy.unit')}
              required
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.currentTarget.value })}
            />
          </Group>
          <Group grow>
            <TextInput
              label={t('pharmacy.rxcui')}
              value={formData.rxcui}
              onChange={(e) => setFormData({ ...formData, rxcui: e.currentTarget.value })}
            />
            <TextInput
              label={t('pharmacy.ndc')}
              value={formData.ndc}
              onChange={(e) => setFormData({ ...formData, ndc: e.currentTarget.value })}
            />
          </Group>
          <Select
            label={t('pharmacy.category')}
            required
            data={categoryOptions}
            value={formData.category}
            onChange={(value) => setFormData({ ...formData, category: value || 'other' })}
          />
          <Textarea
            label={t('pharmacy.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
            rows={3}
          />
          <NumberInput
            label={t('billing.pricePerUnit')}
            value={formData.price}
            onChange={(value) => setFormData({ ...formData, price: Number(value) || 0 })}
            min={0}
            decimalScale={2}
            prefix="$"
            placeholder="0.00"
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={loading}>
              {t('common.save')}
            </Button>
          </Group>
        </Stack>
      </Modal>

      <ConfirmDialog
        opened={confirmOpen}
        title={t('pharmacy.confirmDeleteTitle')}
        message={t('pharmacy.confirmDeleteMessage')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <Paper shadow="sm" p="lg" withBorder className={styles.paper}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconPill size={28} />
                {t('pharmacy.medicationCatalog')}
              </Group>
            </Title>
          </div>
          <Button leftSection={<IconRefresh size={16} />} onClick={handleInitializeDefaults} loading={loading}>
            {t('pharmacy.initializeDefaults')}
          </Button>
        </Group>

        <TextInput
          placeholder={t('pharmacy.searchPlaceholder')}
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          mb="md"
        />

        {filteredMedications.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Title order={4} c="dimmed" ta="center">
              {t('pharmacy.noMedications')}
            </Title>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('pharmacy.medicationName')}</Table.Th>
                <Table.Th>{t('pharmacy.dosageForm')}</Table.Th>
                <Table.Th>{t('pharmacy.strength')}</Table.Th>
                <Table.Th>{t('pharmacy.category')}</Table.Th>
                <Table.Th>{t('billing.price')}</Table.Th>
                <Table.Th>{t('common.action')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredMedications.map((medication) => (
                <Table.Tr key={medication.id}>
                  <Table.Td>
                    <div>
                      <strong>{medication.code?.text || medication.code?.coding?.[0]?.display}</strong>
                      {medication.code?.coding?.[0]?.display && medication.code?.text !== medication.code?.coding?.[0]?.display && (
                        <div className={styles.genericName}>
                          {medication.code?.coding?.[0]?.display}
                        </div>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">
                      {t(`pharmacy.forms.${medication.form?.coding?.[0]?.code}`) || medication.form?.coding?.[0]?.display}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {medication.amount?.numerator?.value} {medication.amount?.numerator?.unit}
                  </Table.Td>
                  <Table.Td>
                    <Badge color="blue">
                      {t(`pharmacy.categories.${medication.extension?.find(e => e.url === 'http://example.org/fhir/StructureDefinition/medication-category')?.valueString}`) || 
                       medication.extension?.find(e => e.url === 'http://example.org/fhir/StructureDefinition/medication-category')?.valueString}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    ${(getPriceFromResource(medication) || 0).toFixed(2)}
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEdit size={14} />}
                        color="blue"
                        onClick={() => handleOpenModal(medication)}
                      >
                        {t('common.edit')}
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconTrash size={14} />}
                        color="red"
                        onClick={() => handleDeleteRequest(medication.id)}
                      >
                        {t('common.delete')}
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Document>
  );
}

