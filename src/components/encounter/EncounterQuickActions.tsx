import { Paper, Text, Group, Button } from '@mantine/core';
import { IconHeartbeat, IconFileText, IconFlask, IconStethoscope, IconPill } from '@tabler/icons-react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface EncounterQuickActionsProps {
  onRecordVitals: () => void;
  onCreateNote: () => void;
  onOrderDiagnostics: () => void;
  onAddDiagnosis: () => void;
  onPrescribeMedication?: () => void;
}

export function EncounterQuickActions({
  onRecordVitals,
  onCreateNote,
  onOrderDiagnostics,
  onAddDiagnosis,
  onPrescribeMedication,
}: EncounterQuickActionsProps): JSX.Element {
  const { t } = useTranslation();
  
  return (
    <Paper shadow="sm" p="md" mb="md" withBorder>
      <Group justify="space-between">
        <Text size="sm" fw={500}>{t('common.quickActions')}</Text>
        <Group>
          <Button
            leftSection={<IconHeartbeat size={16} />}
            onClick={onRecordVitals}
            variant="light"
          >
            {t('recordVitals.title')}
          </Button>
          <Button
            leftSection={<IconFileText size={16} />}
            onClick={onCreateNote}
            variant="light"
            color="blue"
          >
            {t('notes.createNote')}
          </Button>
          <Button
            leftSection={<IconFlask size={16} />}
            onClick={onOrderDiagnostics}
            variant="light"
            color="teal"
          >
            {t('orders.orderDiagnostic')}
          </Button>
          <Button
            leftSection={<IconStethoscope size={16} />}
            onClick={onAddDiagnosis}
            variant="light"
            color="grape"
          >
            {t('diagnosis.addDiagnosis')}
          </Button>
          {onPrescribeMedication && (
            <Button
              leftSection={<IconPill size={16} />}
              onClick={onPrescribeMedication}
              variant="light"
              color="indigo"
            >
              {t('pharmacy.prescribe')}
            </Button>
          )}
        </Group>
      </Group>
    </Paper>
  );
}

