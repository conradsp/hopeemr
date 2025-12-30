import { Modal, Button, TextInput, Select, Textarea, Stack, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMedplum } from '@medplum/react';
import { Encounter, Patient, Reference, Location } from '@medplum/fhirtypes';
import { JSX, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { getDepartments, getAvailableBeds, assignBedToEncounter } from '../../utils/bedManagement';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { createVisitCharge, createBedCharge, getPriceFromResource } from '../../utils/billing';
import { useOfflineMutation } from '../../offline';

interface NewEncounterModalProps {
  opened: boolean;
  onClose: () => void;
  patient: Patient;
}

export function NewEncounterModal({ opened, onClose, patient }: NewEncounterModalProps): JSX.Element {
  const medplum = useMedplum();
  const { createResource, isOnline } = useOfflineMutation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Location[]>([]);
  const [availableBeds, setAvailableBeds] = useState<Location[]>([]);
  const [formData, setFormData] = useState({
    encounterClass: 'ambulatory',
    type: '',
    status: 'in-progress',
    startDate: new Date().toISOString().slice(0, 16),
    endDate: '',
    reasonCode: '',
    reasonDisplay: '',
    departmentId: '',
    bedId: '',
    bedNotes: '',
  });

  // Load departments when modal opens
  useEffect(() => {
    if (opened) {
      loadDepartments();
    }
  }, [opened]);

  // Load available beds when department changes
  useEffect(() => {
    if (formData.departmentId) {
      loadAvailableBeds(formData.departmentId);
    } else {
      setAvailableBeds([]);
    }
  }, [formData.departmentId]);

  const loadDepartments = async (): Promise<void> => {
    try {
      const depts = await getDepartments(medplum);
      setDepartments(depts);
    } catch (error) {
      handleError(error, 'loading departments');
    }
  };

  const loadAvailableBeds = async (departmentId: string): Promise<void> => {
    try {
      const beds = await getAvailableBeds(medplum, departmentId);
      setAvailableBeds(beds);
      // Reset bed selection if no beds available
      if (beds.length === 0) {
        setFormData(prev => ({ ...prev, bedId: '' }));
      }
    } catch (error) {
      handleError(error, 'loading available beds');
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);

    try {
      const patientRef: Reference = {
        reference: `Patient/${patient.id}`,
        display: patient.name?.[0]?.text || 
                [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' '),
      };

      // Convert datetime-local format to ISO 8601 with timezone
      const startDate = formData.startDate ? new Date(formData.startDate).toISOString() : new Date().toISOString();
      const endDate = formData.endDate ? new Date(formData.endDate).toISOString() : undefined;

      let classDisplay = 'Ambulatory';
      if (formData.encounterClass === 'emergency') {
        classDisplay = 'Emergency';
      } else if (formData.encounterClass === 'inpatient') {
        classDisplay = 'Inpatient';
      } else if (formData.encounterClass === 'home') {
        classDisplay = 'Home Health';
      } else if (formData.encounterClass === 'virtual') {
        classDisplay = 'Virtual/Telehealth';
      }

      const encounter: Encounter = {
        resourceType: 'Encounter',
        status: formData.status as 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: formData.encounterClass,
          display: classDisplay,
        },
        type: formData.type ? [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                display: formData.type,
              },
            ],
            text: formData.type,
          },
        ] : undefined,
        subject: patientRef as any,
        period: {
          start: startDate,
          end: endDate,
        },
        reasonCode: formData.reasonCode ? [
          {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: formData.reasonCode,
                display: formData.reasonDisplay,
              },
            ],
            text: formData.reasonDisplay,
          },
        ] : undefined,
      };

      // Create encounter with offline support
      const result = await createResource(encounter, 'Encounter');
      const created = result.resource;

      // If queued offline, skip billing and bed assignment
      if (result.isQueued) {
        notifications.show({
          title: t('encounter.savedOffline', 'Encounter Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
        });
        onClose();
        return;
      }

      // Create visit charge based on encounter type (only when online)
      if (isOnline) {
        try {
          let visitType = 'Visit';
          let visitFee = 0;

          if (formData.encounterClass === 'emergency') {
            visitType = 'Emergency Visit';
            visitFee = 150; // Default emergency visit fee
          } else if (formData.encounterClass === 'inpatient') {
            visitType = 'Inpatient Admission';
            visitFee = 200; // Default inpatient admission fee
          } else if (formData.encounterClass === 'ambulatory') {
            visitType = 'Outpatient Visit';
            visitFee = 75; // Default outpatient visit fee
          } else if (formData.encounterClass === 'home') {
            visitType = 'Home Health Visit';
            visitFee = 100; // Default home health visit fee
          } else if (formData.encounterClass === 'virtual') {
            visitType = 'Telehealth Visit';
            visitFee = 50; // Default telehealth visit fee
          }

          if (visitFee > 0) {
            await createVisitCharge(
              medplum,
              patient.id!,
              created.id!,
              visitType,
              visitFee
            );
          }
        } catch (billingError) {
          // Log error but don't fail encounter creation
          handleError(billingError, 'creating visit charge');
        }

        // Assign bed if this is an inpatient encounter and a bed was selected
        if (formData.encounterClass === 'inpatient' && formData.bedId) {
          try {
            await assignBedToEncounter(medplum, created.id!, formData.bedId, formData.bedNotes);

            // Create initial bed charge (first day)
            const bed = await medplum.readResource('Location', formData.bedId);
            const dailyRate = getPriceFromResource(bed);

            if (dailyRate && dailyRate > 0) {
              const bedName = bed.name || `Bed ${bed.identifier?.[0]?.value}`;

              await createBedCharge(
                medplum,
                patient.id!,
                created.id!,
                bedName,
                1, // First day
                dailyRate,
                formData.bedId
              );
            }
          } catch (error) {
            handleError(error, 'assigning bed or creating bed charge');
            // Continue anyway - encounter was created successfully
          }
        }
      }

      showSuccess(t('encounter.created'));
      onClose();
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      navigate(`/Encounter/${created.id}`);
    } catch (error) {
      handleError(error, 'creating encounter');
    } finally {
      setLoading(false);
    }
  };

  const departmentOptions = departments.map(dept => ({
    value: dept.id || '',
    label: dept.name || '',
  }));

  const bedOptions = availableBeds.map(bed => ({
    value: bed.id || '',
    label: `${bed.identifier?.[0]?.value} - Room ${bed.extension?.find(e => e.url === 'http://example.org/fhir/StructureDefinition/room-number')?.valueString}`,
  }));

  return (
    <Modal opened={opened} onClose={onClose} title={t('encounter.createNew')} size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <TextInput
            label={t('patient.patient')}
            value={patient.name?.[0]?.text || 
                   [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ')}
            disabled
          />

          <Group grow>
            <Select
              label={t('encounter.class')}
              required
              data={[
                { value: 'ambulatory', label: t('encounter.ambulatory') },
                { value: 'emergency', label: t('encounter.emergency') },
                { value: 'inpatient', label: t('encounter.inpatient') },
                { value: 'home', label: t('encounter.home') },
                { value: 'virtual', label: t('encounter.virtual') },
              ]}
              value={formData.encounterClass}
              onChange={(value) => setFormData({ ...formData, encounterClass: value || 'ambulatory', departmentId: '', bedId: '' })}
            />
            <Select
              label={t('common.status')}
              required
              data={[
                { value: 'planned', label: t('encounter.status.planned') },
                { value: 'arrived', label: t('encounter.status.arrived') },
                { value: 'triaged', label: t('encounter.status.triaged') },
                { value: 'in-progress', label: t('encounter.status.inProgress') },
                { value: 'finished', label: t('encounter.status.finished') },
                { value: 'cancelled', label: t('encounter.status.cancelled') },
              ]}
              value={formData.status}
              onChange={(value) => setFormData({ ...formData, status: value || 'in-progress' })}
            />
          </Group>

          <TextInput
            label={t('encounter.type')}
            placeholder={t('encounter.typePlaceholder')}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
          />

          <Group grow>
            <TextInput
              label={t('encounter.startDate')}
              type="datetime-local"
              required
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            />
            <TextInput
              label={`${t('encounter.endDate')} (${t('common.optional')})`}
              type="datetime-local"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            />
          </Group>

          {/* Bed Assignment Section - Only show for inpatient encounters */}
          {formData.encounterClass === 'inpatient' && (
            <>
              <Group grow>
                <Select
                  label={t('beds.selectDepartment')}
                  placeholder={t('beds.selectDepartment')}
                  data={departmentOptions}
                  value={formData.departmentId}
                  onChange={(value) => setFormData({ ...formData, departmentId: value || '', bedId: '' })}
                  searchable
                />
                <Select
                  label={t('beds.selectBed')}
                  placeholder={availableBeds.length === 0 ? t('beds.noAvailableBeds') : t('beds.selectBed')}
                  data={bedOptions}
                  value={formData.bedId}
                  onChange={(value) => setFormData({ ...formData, bedId: value || '' })}
                  disabled={!formData.departmentId || availableBeds.length === 0}
                  searchable
                />
              </Group>
              {formData.bedId && (
                <Textarea
                  label={t('beds.assignmentNotes')}
                  placeholder={t('common.enterNotes')}
                  value={formData.bedNotes}
                  onChange={(e) => setFormData({ ...formData, bedNotes: e.target.value })}
                  rows={2}
                />
              )}
            </>
          )}

          <Textarea
            label={t('encounter.reasonForVisit')}
            placeholder={t('encounter.reasonPlaceholder')}
            value={formData.reasonDisplay}
            onChange={(e) => setFormData({ ...formData, reasonDisplay: e.target.value })}
            minRows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {t('encounter.create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

