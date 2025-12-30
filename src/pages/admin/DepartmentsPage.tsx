import { Paper, Title, Button, Group, Stack, Table, TextInput, Badge, Modal, Select, Textarea } from '@mantine/core';
import { Document, useMedplum } from '@medplum/react';
import { Location } from '@medplum/fhirtypes';
import { IconPlus, IconEdit, IconTrash, IconBuildingHospital } from '@tabler/icons-react';
import { JSX, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentBedStats,
  DepartmentFormData,
  DepartmentType,
} from '../../utils/bedManagement';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import styles from './DepartmentsPage.module.css';

export function DepartmentsPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [departments, setDepartments] = useState<Location[]>([]);
  const [bedStats, setBedStats] = useState<Record<string, { total: number; available: number; occupied: number }>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Location | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>({
    name: '',
    code: '',
    type: 'general',
    description: '',
  });

  const loadDepartments = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const depts = await getDepartments(medplum);
      setDepartments(depts);
      
      // Load bed stats for each department
      const stats: Record<string, { total: number; available: number; occupied: number }> = {};
      for (const dept of depts) {
        if (dept.id) {
          stats[dept.id] = await getDepartmentBedStats(medplum, dept.id);
        }
      }
      setBedStats(stats);
    } catch (error) {
      handleError(error, 'loading departments');
    } finally {
      setLoading(false);
    }
  }, [medplum]);

  useEffect(() => {
    loadDepartments().catch(() => {});
  }, [loadDepartments]);

  const handleOpenModal = (department?: Location): void => {
    if (department) {
      setEditingDepartment(department);
      setFormData({
        name: department.name || '',
        code: department.identifier?.[0]?.value || '',
        type: (department.type?.[0]?.coding?.[0]?.code?.toLowerCase() || 'general') as DepartmentType,
        description: department.description || '',
      });
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        code: '',
        type: 'general',
        description: '',
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (): Promise<void> => {
    if (!formData.name || !formData.code) {
      return;
    }

    setLoading(true);
    try {
      if (editingDepartment) {
        const updatedDept: Location = {
          ...editingDepartment,
          name: formData.name,
          identifier: [{
            system: 'http://example.org/department-codes',
            value: formData.code,
          }],
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: formData.type.toUpperCase(),
              display: formData.type,
            }],
          }],
          description: formData.description,
        };
        await updateDepartment(medplum, updatedDept);
        showSuccess(t('beds.updateSuccess'));
      } else {
        await createDepartment(medplum, formData);
        showSuccess(t('beds.addSuccess'));
      }

      setModalOpen(false);
      await loadDepartments();
    } catch (error) {
      handleError(error, editingDepartment ? 'updating department' : 'creating department');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = (departmentId?: string): void => {
    if (!departmentId) return;
    setPendingDeleteId(departmentId);
    setConfirmOpen(true);
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!pendingDeleteId) return;
    
    setConfirmOpen(false);
    try {
      await deleteDepartment(medplum, pendingDeleteId);
      showSuccess(t('beds.deleteSuccess'));
      await loadDepartments();
    } catch (error) {
      handleError(error, 'deleting department');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleDeleteCancel = (): void => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const departmentTypeOptions = [
    { value: 'general', label: t('beds.departmentTypes.general') },
    { value: 'emergency', label: t('beds.departmentTypes.emergency') },
    { value: 'icu', label: t('beds.departmentTypes.icu') },
    { value: 'surgery', label: t('beds.departmentTypes.surgery') },
    { value: 'pediatrics', label: t('beds.departmentTypes.pediatrics') },
    { value: 'maternity', label: t('beds.departmentTypes.maternity') },
    { value: 'cardiology', label: t('beds.departmentTypes.cardiology') },
    { value: 'oncology', label: t('beds.departmentTypes.oncology') },
    { value: 'orthopedics', label: t('beds.departmentTypes.orthopedics') },
    { value: 'psychiatry', label: t('beds.departmentTypes.psychiatry') },
  ];

  return (
    <Document>
      <BreadcrumbNav />
      
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingDepartment ? t('beds.editDepartment') : t('beds.addDepartment')}
        size="md"
      >
        <Stack>
          <TextInput
            label={t('beds.departmentName')}
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.currentTarget.value })}
          />
          <TextInput
            label={t('beds.departmentCode')}
            required
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.currentTarget.value })}
            placeholder="e.g., ICU, ER, PEDS"
          />
          <Select
            label={t('beds.departmentType')}
            required
            data={departmentTypeOptions}
            value={formData.type}
            onChange={(value) => setFormData({ ...formData, type: (value || 'general') as DepartmentType })}
          />
          <Textarea
            label={t('beds.departmentDescription')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.currentTarget.value })}
            rows={3}
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
        message={t('beds.deleteSuccess')}
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
                <IconBuildingHospital size={28} />
                {t('beds.departments')}
              </Group>
            </Title>
          </div>
          <Button leftSection={<IconPlus size={16} />} onClick={() => handleOpenModal()}>
            {t('beds.addDepartment')}
          </Button>
        </Group>

        {departments.length === 0 ? (
          <Paper p="xl" withBorder bg="gray.0">
            <Title order={4} c="dimmed" ta="center">
              {t('beds.noDepartments')}
            </Title>
          </Paper>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('beds.departmentName')}</Table.Th>
                <Table.Th>{t('beds.departmentCode')}</Table.Th>
                <Table.Th>{t('beds.departmentType')}</Table.Th>
                <Table.Th>{t('beds.totalBeds')}</Table.Th>
                <Table.Th>{t('beds.availableBeds')}</Table.Th>
                <Table.Th>{t('beds.occupiedBeds')}</Table.Th>
                <Table.Th>{t('common.action')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {departments.map((dept) => {
                const stats = bedStats[dept.id!] || { total: 0, available: 0, occupied: 0 };
                return (
                  <Table.Tr key={dept.id}>
                    <Table.Td>
                      <strong>{dept.name}</strong>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{dept.identifier?.[0]?.value}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="blue">
                        {t(`beds.departmentTypes.${dept.type?.[0]?.coding?.[0]?.code?.toLowerCase() || 'general'}`)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{stats.total}</Table.Td>
                    <Table.Td>
                      <Badge color="green">{stats.available}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="orange">{stats.occupied}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEdit size={14} />}
                          color="blue"
                          onClick={() => handleOpenModal(dept)}
                        >
                          {t('common.edit')}
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={() => handleDeleteRequest(dept.id)}
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

