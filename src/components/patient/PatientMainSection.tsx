import { Patient } from '@medplum/fhirtypes';
import { useSearchResources } from '@medplum/react';
import { Tabs, Paper, Group, Text, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PatientTimeline } from './PatientTimeline';
import { PatientEncounters } from './PatientEncounters';
import { PatientObservations } from './PatientObservations';
import { ClinicalImpressionDisplay } from '../shared/ClinicalImpressionDisplay';
import { PatientOverview } from './PatientOverview';
import styles from './PatientMainSection.module.css';

interface PatientMainSectionProps {
  section: string;
  patient: Patient | null;
  onNewEncounter?: () => void;
  refreshKey?: number;
}

export function PatientMainSection({ patient, onNewEncounter, refreshKey = 0 }: PatientMainSectionProps): JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Fetch encounters to show count in tab header
  const [encounters] = useSearchResources('Encounter', 
    patient ? { patient: `Patient/${patient.id}`, _count: '50', _: refreshKey } : undefined
  );

  // Fetch observations to show count in tab header
  const [observations] = useSearchResources('Observation',
    patient ? { patient: `Patient/${patient.id}`, _count: '100', _: refreshKey } : undefined
  );

  // Fetch clinical notes (DocumentReference) to show count in tab header
  const [documents] = useSearchResources('DocumentReference',
    patient ? { patient: `Patient/${patient.id}`, _count: '50', _: refreshKey, _sort: '-date' } : undefined
  );

  if (!patient) {
    return (
      <div className={styles.emptyState}>
        {t('patient.selectToViewDetails', 'Select a patient to view details.')}
      </div>
    );
  }

  return (
    <>
      {/* Quick Actions */}
      <Paper shadow="sm" p="md" mb="md" withBorder className={styles.quickActionsPaper}>
        <Group justify="space-between">
          <Text size="sm" fw={500}>{t('patient.quickActions', 'Quick Actions')}</Text>
          <Group>
            {onNewEncounter && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={onNewEncounter}
                variant="light"
              >
                {t('patient.newEncounter', 'New Encounter')}
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
        <Tabs.List>
          <Tabs.Tab value="overview">{t('patient.tab.overview', 'Overview')}</Tabs.Tab>
          <Tabs.Tab value="encounter">
            {t('patient.tab.encounter', 'Encounter')} {encounters && encounters.length > 0 && `(${encounters.length})`}
          </Tabs.Tab>
          <Tabs.Tab value="observations">
            {t('patient.tab.observations', 'Observations')} {observations && observations.length > 0 && `(${observations.length})`}
          </Tabs.Tab>
          <Tabs.Tab value="clinical">
            {t('patient.tab.clinicalNotes', 'Clinical Notes')} {documents && documents.length > 0 && `(${documents.length})`}
          </Tabs.Tab>
          <Tabs.Tab value="timeline">{t('patient.tab.timeline', 'Timeline')}</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <PatientOverview patient={patient} />
        </Tabs.Panel>

        <Tabs.Panel value="encounter" pt="md">
          <PatientEncounters patient={patient} encounters={encounters} />
        </Tabs.Panel>

        <Tabs.Panel value="observations" pt="md">
          <PatientObservations patient={patient} observations={observations} />
        </Tabs.Panel>

        <Tabs.Panel value="clinical" pt="md">
          <ClinicalImpressionDisplay patient={patient} documents={documents} />
        </Tabs.Panel>

        <Tabs.Panel value="timeline" pt="md">
          <PatientTimeline patient={patient} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
