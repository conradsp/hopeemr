import { Paper, Title, Button, Group, Stack, Table, TextInput, Badge, Modal, NumberInput, Select, Text } from '@mantine/core';
import { Document, useMedplum } from '@medplum/react';
import { Medication, MedicationKnowledge } from '@medplum/fhirtypes';
import { IconPackage, IconSearch, IconEdit, IconPlus } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMedications, getMedicationInventory, updateMedicationInventory } from '../../utils/medications';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { handleError, showSuccess } from '../../utils/errorHandling';
import styles from './InventoryPage.module.css';

interface InventoryData {
  medication: Medication;
  inventory: MedicationKnowledge | null;
  currentStock: number;
  reorderLevel: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
}

interface InventoryFormData {
  quantity: number;
  reorderLevel: number;
  reorderQuantity: number;
  expirationDate: string;
  lotNumber: string;
  location: string;
}

export function InventoryPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMedication, setSelectedMedication] = useState<Medication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<InventoryFormData>({
    quantity: 0,
    reorderLevel: 10,
    reorderQuantity: 50,
    expirationDate: '',
    lotNumber: '',
    location: '',
  });

  useEffect(() => {
    loadInventory();
  }, [medplum]);

  const loadInventory = async (): Promise<void> => {
    setLoading(true);
    try {
      const medications = await getMedications(medplum);
      const inventoryPromises = medications.map(async (med) => {
        const inventory = await getMedicationInventory(medplum, med.id!);
        const currentStock = inventory?.packaging?.quantity?.value || 0;
        const reorderLevel = inventory?.extension?.find(
          e => e.url === 'http://example.org/fhir/StructureDefinition/reorder-level'
        )?.valueInteger || 10;
        
        let status: 'in-stock' | 'low-stock' | 'out-of-stock' = 'in-stock';
        if (currentStock === 0) {
          status = 'out-of-stock';
        } else if (currentStock <= reorderLevel) {
          status = 'low-stock';
        }

        return {
          medication: med,
          inventory,
          currentStock,
          reorderLevel,
          status,
        };
      });

      const data = await Promise.all(inventoryPromises);
      setInventoryData(data);
    } catch (error) {
      handleError(error, 'loading inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item: InventoryData): void => {
    setSelectedMedication(item.medication);
    const inv = item.inventory;
    setFormData({
      quantity: item.currentStock,
      reorderLevel: item.reorderLevel,
      reorderQuantity: inv?.extension?.find(
        e => e.url === 'http://example.org/fhir/StructureDefinition/reorder-quantity'
      )?.valueInteger || 50,
      expirationDate: inv?.extension?.find(
        e => e.url === 'http://example.org/fhir/StructureDefinition/expiration-date'
      )?.valueDate || '',
      lotNumber: inv?.extension?.find(
        e => e.url === 'http://example.org/fhir/StructureDefinition/lot-number'
      )?.valueString || '',
      location: inv?.extension?.find(
        e => e.url === 'http://example.org/fhir/StructureDefinition/storage-location'
      )?.valueString || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!selectedMedication?.id) return;

    setLoading(true);
    try {
      await updateMedicationInventory(
        medplum,
        selectedMedication.id,
        formData.quantity,
        formData.reorderLevel,
        formData.reorderQuantity,
        formData.expirationDate,
        formData.lotNumber,
        formData.location
      );

      showSuccess(t('pharmacy.inventoryUpdated'));
      setModalOpen(false);
      loadInventory();
    } catch (error) {
      handleError(error, 'updating inventory');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'in-stock': return 'green';
      case 'low-stock': return 'yellow';
      case 'out-of-stock': return 'red';
      default: return 'gray';
    }
  };

  const filteredData = inventoryData.filter(item =>
    item.medication.code?.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.medication.code?.coding?.[0]?.display?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Document>
      <BreadcrumbNav />
      
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('pharmacy.adjustInventory')}
        size="lg"
      >
        <Stack>
          {selectedMedication && (
            <div>
              <Text size="sm" c="dimmed">{t('pharmacy.medicationName')}</Text>
              <Text size="lg" fw={500}>
                {selectedMedication.code?.text || selectedMedication.code?.coding?.[0]?.display}
              </Text>
            </div>
          )}

          <NumberInput
            label={t('pharmacy.currentStock')}
            required
            value={formData.quantity}
            onChange={(value) => setFormData({ ...formData, quantity: Number(value) || 0 })}
            min={0}
          />

          <Group grow>
            <NumberInput
              label={t('pharmacy.reorderLevel')}
              required
              value={formData.reorderLevel}
              onChange={(value) => setFormData({ ...formData, reorderLevel: Number(value) || 0 })}
              min={0}
            />
            <NumberInput
              label={t('pharmacy.reorderQuantity')}
              required
              value={formData.reorderQuantity}
              onChange={(value) => setFormData({ ...formData, reorderQuantity: Number(value) || 0 })}
              min={0}
            />
          </Group>

          <Group grow>
            <TextInput
              label={t('pharmacy.lotNumber')}
              value={formData.lotNumber}
              onChange={(e) => setFormData({ ...formData, lotNumber: e.currentTarget.value })}
            />
            <TextInput
              label={t('pharmacy.expirationDate')}
              type="date"
              value={formData.expirationDate}
              onChange={(e) => setFormData({ ...formData, expirationDate: e.currentTarget.value })}
            />
          </Group>

          <TextInput
            label={t('pharmacy.location')}
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.currentTarget.value })}
            placeholder="e.g., Refrigerator A, Shelf 3"
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

      <Paper shadow="sm" p="lg" withBorder className={styles.paper}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconPackage size={28} />
                {t('pharmacy.inventory')}
              </Group>
            </Title>
          </div>
        </Group>

        <TextInput
          placeholder={t('pharmacy.searchPlaceholder')}
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          mb="md"
        />

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('pharmacy.medicationName')}</Table.Th>
              <Table.Th>{t('pharmacy.dosageForm')}</Table.Th>
              <Table.Th>{t('pharmacy.currentStock')}</Table.Th>
              <Table.Th>{t('pharmacy.reorderLevel')}</Table.Th>
              <Table.Th>{t('pharmacy.stockLevel')}</Table.Th>
              <Table.Th>{t('common.action')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredData.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed">{t('pharmacy.noMedications')}</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredData.map((item) => (
                <Table.Tr key={item.medication.id}>
                  <Table.Td>
                    <div>
                      <strong>{item.medication.code?.text || item.medication.code?.coding?.[0]?.display}</strong>
                      {item.medication.code?.coding?.[0]?.display && item.medication.code?.text !== item.medication.code?.coding?.[0]?.display && (
                        <div className={styles.genericName}>
                          {item.medication.code?.coding?.[0]?.display}
                        </div>
                      )}
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light">
                      {t(`pharmacy.forms.${item.medication.form?.coding?.[0]?.code}`) || item.medication.form?.coding?.[0]?.display}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={500}>{item.currentStock}</Text>
                  </Table.Td>
                  <Table.Td>{item.reorderLevel}</Table.Td>
                  <Table.Td>
                    <Badge color={getStatusColor(item.status)}>
                      {t(`pharmacy.${item.status === 'in-stock' ? 'inStock' : item.status === 'low-stock' ? 'lowStock' : 'outOfStock'}`)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={item.inventory ? <IconEdit size={14} /> : <IconPlus size={14} />}
                      onClick={() => handleOpenModal(item)}
                    >
                      {item.inventory ? t('common.edit') : t('common.add')}
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Document>
  );
}

