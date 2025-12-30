import { Paper, Title, Text, Badge, Grid, Group, Modal, Button, Select, Divider } from '@mantine/core';
import { formatDateTime, MedplumClient } from '@medplum/core';
import { Encounter, Location } from '@medplum/fhirtypes';
import { IconCalendar, IconUser, IconClock, IconBed } from '@tabler/icons-react';
import { useState, useEffect, useCallback, JSX } from 'react';
import { getEncounterStatusColor } from '../../utils/encounterUtils';
import { useTranslation } from 'react-i18next';
import { handleError, showSuccess } from '../../utils/errorHandling';
import { getCurrentBedAssignment, releaseBedFromEncounter } from '../../utils/bedManagement';
import { createBedCharge, getPriceFromResource } from '../../utils/billing';
import { completeQueueEntryByEncounter } from '../../utils/queueUtils';
import styles from './EncounterHeader.module.css';

interface EncounterHeaderProps {
  encounter: Encounter;
  medplum: MedplumClient;
  onStatusChange?: () => void;
}

export function EncounterHeader({ encounter, medplum, onStatusChange }: EncounterHeaderProps): JSX.Element {
  const { t } = useTranslation();
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [currentBed, setCurrentBed] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);

  const loadBedAssignment = useCallback(async (): Promise<void> => {
    const bedId = getCurrentBedAssignment(encounter);
    if (bedId) {
      try {
        const bed = await medplum.readResource('Location', bedId);
        setCurrentBed(bed);
      } catch (_error) {
        setCurrentBed(null);
      }
    } else {
      setCurrentBed(null);
    }
  }, [encounter, medplum]);

  useEffect(() => {
    loadBedAssignment().catch(() => {});
  }, [encounter, loadBedAssignment]);

  const handleReleaseBed = async (): Promise<void> => {
    if (!currentBed?.id) { return; }
    setLoading(true);
    try {
      const bedLocation = encounter.location?.find(
        l => l.location.reference === `Location/${currentBed.id}`
      );
      if (bedLocation?.period?.start) {
        const startDate = new Date(bedLocation.period.start);
        const endDate = new Date();
        const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        if (days > 1) {
          try {
            const dailyRate = getPriceFromResource(currentBed);
            if (dailyRate && dailyRate > 0) {
              const bedName = currentBed.name || `Bed ${currentBed.identifier?.[0]?.value}`;
              const patientId = encounter.subject?.reference?.split('/')[1];
              if (patientId && encounter.id) {
                await createBedCharge(
                  medplum,
                  patientId,
                  encounter.id,
                  bedName,
                  days - 1,
                  dailyRate,
                  currentBed.id
                );
              }
            }
          } catch (_error) {
            // Optionally log or handle error
          }
        }
      }
      await releaseBedFromEncounter(medplum, encounter.id ?? '', currentBed.id);
      showSuccess(t('bed.released'));
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (_error) {
      handleError(_error);
    }
    setLoading(false);
  };

  const encounterType = encounter.type?.[0]?.coding?.[0]?.display || 
                       encounter.type?.[0]?.text || 
                       t('encounter.unknownType');
  const encounterClass = encounter.class?.display || encounter.class?.code || '-';
  const displayDate = encounter.period?.start ? formatDateTime(encounter.period.start) : t('encounter.unknownDate');
  const duration = encounter.period?.start && encounter.period?.end
    ? `${Math.round((new Date(encounter.period.end).getTime() - new Date(encounter.period.start).getTime()) / 60000)} ${t('encounter.minutes')}`
    : '-';
  const reason = encounter.reasonCode?.[0]?.coding?.[0]?.display || 
                encounter.reasonCode?.[0]?.text || 
                '-';

  const encounterStatusOptions = [
    { value: 'planned', label: t('encounter.status.planned') },
    { value: 'in-progress', label: t('encounter.status.inProgress') },
    { value: 'on-hold', label: t('encounter.status.onHold') },
    { value: 'finished', label: t('encounter.status.finished') },
    { value: 'cancelled', label: t('encounter.status.cancelled') },
    { value: 'entered-in-error', label: t('encounter.status.enteredInError') },
    { value: 'unknown', label: t('encounter.status.unknown') },
  ];

  const handleStatusChange = async (): Promise<void> => {
    if (!encounter || !newStatus) {
      setStatusModalOpen(false);
      return;
    }
    try {
      await medplum.patchResource('Encounter', encounter.id ?? '', [
        { op: 'replace', path: '/status', value: newStatus }
      ]);

      // If encounter is finished, also complete the associated queue Task
      if (newStatus === 'finished' && encounter.id) {
        try {
          await completeQueueEntryByEncounter(medplum, encounter.id);
        } catch (queueError) {
          // Log but don't fail - queue task might not exist
          console.warn('Could not complete queue entry:', queueError);
        }
      }

      showSuccess(t('encounter.statusUpdated'));
      setStatusModalOpen(false);
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      handleError(error, 'updating encounter status');
      setStatusModalOpen(false);
    }
  };

  return (
    <Paper shadow="sm" p="lg" mb="md" withBorder className={styles.headerPaper}>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={2}>{encounterType}</Title>
          <Text size="sm" c="dimmed">{t('encounter.id')}: {encounter.id}</Text>
          <Badge 
            size="lg"
            color={getEncounterStatusColor(encounter.status)}
            variant="light"
          >
            {t(`encounter.status.${encounter.status}`)}
          </Badge>
          <Button size="xs" variant="outline" onClick={() => setStatusModalOpen(true)}>
            {t('encounter.changeStatus')}
          </Button>
        </div>
      </Group>

      <Grid>
        <Grid.Col span={3}>
          <Group gap="xs">
            <IconCalendar size={16} />
            <div>
              <Text size="xs" c="dimmed">{t('encounter.date')}</Text>
              <Text size="sm">{displayDate}</Text>
            </div>
          </Group>
        </Grid.Col>
        <Grid.Col span={3}>
          <Group gap="xs">
            <IconUser size={16} />
            <div>
              <Text size="xs" c="dimmed">{t('encounter.class')}</Text>
              <Text size="sm">{encounterClass}</Text>
            </div>
          </Group>
        </Grid.Col>
        <Grid.Col span={3}>
          <Group gap="xs">
            <IconClock size={16} />
            <div>
              <Text size="xs" c="dimmed">{t('encounter.duration', 'Duration')}</Text>
              <Text size="sm">{duration}</Text>
            </div>
          </Group>
        </Grid.Col>
        <Grid.Col span={3}>
          <div>
            <Text size="xs" c="dimmed">{t('encounter.reasonForVisit')}</Text>
            <Text size="sm">{reason}</Text>
          </div>
        </Grid.Col>
      </Grid>

      {/* Bed Assignment Section - Only show for inpatient encounters */}
      {encounter.class?.code === 'inpatient' && (
        <>
          <Divider my="md" />
          <Group gap="xs" justify="space-between">
            <Group gap="xs">
              <IconBed size={20} />
              <div>
                <Text size="xs" c="dimmed">{t('beds.currentBed')}</Text>
                {currentBed ? (
                  <Text size="sm" fw={500}>
                    {currentBed.name} - Room {currentBed.extension?.find(e => e.url === 'http://example.org/fhir/StructureDefinition/room-number')?.valueString}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">{t('beds.noBedAssigned')}</Text>
                )}
              </div>
            </Group>
            {currentBed && (
              <Button
                size="xs"
                variant="outline"
                color="red"
                onClick={handleReleaseBed}
                loading={loading}
              >
                {t('beds.releaseBed')}
              </Button>
            )}
          </Group>
        </>
      )}

      <Modal opened={statusModalOpen} onClose={() => setStatusModalOpen(false)} title="Change Encounter Status" centered>
        <Select
          label="Encounter Status"
          data={encounterStatusOptions}
          value={newStatus || encounter?.status || ''}
          onChange={(value) => setNewStatus(value || '')}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setStatusModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleStatusChange} disabled={!newStatus}>
            Save
          </Button>
        </Group>
      </Modal>
    </Paper>
  );
}

