import { Paper, Title, Button, Group, Stack, Table, TextInput, Badge, Modal, Select, NumberInput } from '@mantine/core';
import { Document, useMedplum } from '@medplum/react';
import { Location } from '@medplum/fhirtypes';
import { IconPlus, IconEdit, IconTrash, IconBed, IconSearch } from '@tabler/icons-react';
import { JSX, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getBeds,
  createBed,
  updateBed,
  deleteBed,
  getDepartments,
  BedFormData,
  BedType,
  BedStatus,
  getBedStatusFromCode,
  BedWithDepartment,
} from '../../utils/bedManagement';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { getPriceFromResource, setPriceOnResource } from '../../utils/billing';
import styles from './BedsPage.module.css';

export function BedsPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [beds, setBeds] = useState<BedWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Location | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<BedFormData>({
    bedNumber: '',
    roomNumber: '',
    departmentId: '',
    bedType: 'standard',
    status: 'available',
    dailyRate: 0,
  });

  const loadBeds = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [bedsData, deptsData] = await Promise.all([
        getBeds(medplum),
        getDepartments(medplum),
      ]);
      setBeds(bedsData);
      setDepartments(deptsData);
    } catch (error) {
      handleError(error, 'loading beds');
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    loadBeds().catch(() => {});
  }, [loadBeds]);

  const handleOpenModal = (bed?: BedWithDepartment): void => {
    if (bed) {
      setEditingBed(bed);
      const deptId = bed.partOf?.reference?.split('/')[1] || '';
      const roomNumber = bed.extension?.find(
        e => e.url === 'http://example.org/fhir/StructureDefinition/room-number'
      )?.valueString || '';
      
      setFormData({
        bedNumber: bed.identifier?.[0]?.value || '',
        roomNumber,
        departmentId: deptId,
        bedType: (bed.type?.[0]?.coding?.[0]?.code || 'standard') as BedType,
        status: getBedStatusFromCode(bed.operationalStatus?.code),
        dailyRate: getPriceFromResource(bed) || 0,
      });
    } else {
      setEditingBed(null);
      setFormData({
        bedNumber: '',
        roomNumber: '',
        departmentId: departments[0]?.id || '',
        bedType: 'standard',
        status: 'available',
        dailyRate: 0,
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!formData.bedNumber || !formData.roomNumber || !formData.departmentId) {
      return;
    }

    setLoading(true);
    try {
      if (editingBed) {
        const updatedBed: Location = {
          ...editingBed,
          name: `Bed ${formData.bedNumber}`,
          identifier: [{
            system: 'http://example.org/bed-numbers',
            value: formData.bedNumber,
          }],
          partOf: {
            reference: `Location/${formData.departmentId}`,
          },
          type: [{
            coding: [{
              system: 'http://example.org/bed-types',
              code: formData.bedType,
              display: formData.bedType,
            }],
          }],
          operationalStatus: {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0116',
            code: getOperationalStatusCode(formData.status),
            display: formData.status,
          },
          extension: [
            {
              url: 'http://example.org/fhir/StructureDefinition/room-number',
              valueString: formData.roomNumber,
            },
            {
              url: 'http://example.org/fhir/StructureDefinition/department-name',
              valueString: departments.find(d => d.id === formData.departmentId)?.name || ''
            }
          ],
        };
        // Remove departmentName before sending to FHIR server
        const { departmentName, ...locationResource } = updatedBed as any;
        const bedWithPrice = setPriceOnResource(locationResource, formData.dailyRate || 0);
        await updateBed(medplum, bedWithPrice);
        showSuccess(t('beds.bedUpdateSuccess'));
      } else {
        await createBed(medplum, formData);
        // Update the created bed with pricing
        const createdBeds = await getBeds(medplum);
        const latestBed = createdBeds.find(b => b.identifier?.[0]?.value === formData.bedNumber);
        if (latestBed && formData.dailyRate) {
          const { departmentName: _unused, ...locationResource } = latestBed;
          const bedWithPrice = setPriceOnResource(locationResource, formData.dailyRate);
          await updateBed(medplum, bedWithPrice);
        }
        showSuccess(t('beds.bedAddSuccess'));
      }

      setModalOpen(false);
      await loadBeds();
    } catch (error) {
      handleError(error, editingBed ? 'updating bed' : 'creating bed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (bedId?: string): void => {
    if (!bedId) return;
    setPendingDeleteId(bedId);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!pendingDeleteId) return;
    
    setConfirmOpen(false);
    try {
      await deleteBed(medplum, pendingDeleteId);
      showSuccess(t('beds.bedDeleteSuccess'));
      await loadBeds();
    } catch (error) {
      handleError(error, 'deleting bed');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = (): void => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const getOperationalStatusCode = (status: BedStatus): string => {
    switch (status) {
      case 'available': return 'U';
      case 'occupied': return 'O';
      case 'reserved': return 'K';
      case 'maintenance': return 'C';
      case 'contaminated': return 'I';
      case 'housekeeping': return 'K';
      default: return 'U';
    }
  };

  const getStatusColor = (status: BedStatus): string => {
    switch (status) {
      case 'available': return 'green';
      case 'occupied': return 'red';
      case 'reserved': return 'yellow';
      case 'maintenance': return 'gray';
      case 'contaminated': return 'orange';
      case 'housekeeping': return 'blue';
      default: return 'gray';
    }
  };

  const filteredBeds = beds.filter(bed =>
    bed.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bed.identifier?.[0]?.value?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bed.departmentName ? bed.departmentName.toLowerCase().includes(searchTerm.toLowerCase()) : false)
  );

  const bedTypeOptions = [
    { value: 'standard', label: t('beds.types.standard') },
    { value: 'icu', label: t('beds.types.icu') },
    { value: 'isolation', label: t('beds.types.isolation') },
    { value: 'bariatric', label: t('beds.types.bariatric') },
    { value: 'pediatric', label: t('beds.types.pediatric') },
    { value: 'maternity', label: t('beds.types.maternity') },
  ];

  const bedStatusOptions = [
    { value: 'available', label: t('beds.status.available') },
    { value: 'occupied', label: t('beds.status.occupied') },
    { value: 'reserved', label: t('beds.status.reserved') },
    { value: 'maintenance', label: t('beds.status.maintenance') },
    { value: 'contaminated', label: t('beds.status.contaminated') },
    { value: 'housekeeping', label: t('beds.status.housekeeping') },
  ];

  const departmentOptions = departments.map(dept => ({
    value: dept.id || '',
    label: dept.name || '',
  }));

  return (
    <Document>
      <BreadcrumbNav />
      
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBed ? t('beds.editBed') : t('beds.addBed')}
        size="md"
      >
        <Stack>
          <Group grow>
            <TextInput
              label={t('beds.bedNumber')}
              required
              value={formData.bedNumber}
              onChange={(e) => setFormData({ ...formData, bedNumber: e.currentTarget.value })}
              placeholder="e.g., 101A"
            />
            <TextInput
              label={t('beds.roomNumber')}
              required
              value={formData.roomNumber}
              onChange={(e) => setFormData({ ...formData, roomNumber: e.currentTarget.value })}
              placeholder="e.g., 101"
            />
          </Group>
          <Select
            label={t('beds.department')}
            required
            data={departmentOptions}
            value={formData.departmentId}
            onChange={(value) => setFormData({ ...formData, departmentId: value || '' })}
          />
          <Select
            label={t('beds.bedType')}
            required
            data={bedTypeOptions}
            value={formData.bedType}
            onChange={(value) => setFormData({ ...formData, bedType: (value || 'standard') as BedType })}
          />
          <Select
            label={t('beds.bedStatus')}
            required
            data={bedStatusOptions}
            value={formData.status}
            onChange={(value) => setFormData({ ...formData, status: (value || 'available') as BedStatus })}
          />
          <NumberInput
            label={t('billing.dailyRate')}
            value={formData.dailyRate}
            onChange={(value) => setFormData({ ...formData, dailyRate: Number(value) || 0 })}
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
        title={t('common.confirmDelete')}
        message={t('beds.bedDeleteSuccess')}
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
                <IconBed size={28} />
                {t('beds.beds')}
              </Group>
            </Title>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpenModal()}>
            {t('beds.addBed')}
          </Button>
        </Group>

        <TextInput
          placeholder={t('common.search')}
          leftSection={<IconSearch size={16} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.currentTarget.value)}
          mb="md"
        />

        {filteredBeds.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Title order={4} c="dimmed" ta="center">
              {t('beds.noBeds')}
            </Title>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('beds.bedNumber')}</Table.Th>
                <Table.Th>{t('beds.roomNumber')}</Table.Th>
                <Table.Th>{t('beds.department')}</Table.Th>
                <Table.Th>{t('beds.bedType')}</Table.Th>
                <Table.Th>{t('billing.dailyRate')}</Table.Th>
                <Table.Th>{t('beds.bedStatus')}</Table.Th>
                <Table.Th>{t('common.action')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredBeds.map((bed) => {
                const roomNumber = bed.extension?.find(
                  e => e.url === 'http://example.org/fhir/StructureDefinition/room-number'
                )?.valueString || '-';
                const status = getBedStatusFromCode(bed.operationalStatus?.code);
                
                return (
                  <Table.Tr key={bed.id}>
                    <Table.Td>
                      <strong>{bed.identifier?.[0]?.value}</strong>
                    </Table.Td>
                    <Table.Td>{roomNumber}</Table.Td>
                    <Table.Td>
                      <Badge variant="light">{bed.departmentName || '-'}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="blue">
                        {t(`beds.types.${bed.type?.[0]?.coding?.[0]?.code || 'standard'}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <strong>${(getPriceFromResource(bed) || 0).toFixed(2)}</strong>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={getStatusColor(status)}>
                        {t(`beds.status.${status}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEdit size={14} />}
                          color="blue"
                          onClick={() => handleOpenModal(bed)}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={() => handleDeleteRequest(bed.id)}
                        >
                          {t('common.delete')}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Document>
  );
}

