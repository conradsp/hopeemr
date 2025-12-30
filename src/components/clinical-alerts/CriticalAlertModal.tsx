/**
 * CriticalAlertModal Component
 * Displays critical vital value alerts requiring provider acknowledgment
 */

import { Modal, Button, Stack, Group, Text, Checkbox, Alert, Divider, Badge, Paper } from '@mantine/core';
import { IconAlertTriangle, IconHeartbeat, IconTemperature, IconDroplet, IconLungs } from '@tabler/icons-react';
import { JSX, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CriticalAlert, CriticalAlertModalProps, VitalType } from '../../types/clinicalAlerts.types';
import classes from './CriticalAlertModal.module.css';

/**
 * Icons for each vital type
 */
const VITAL_ICONS: Record<VitalType, JSX.Element> = {
  bloodPressureSystolic: <IconHeartbeat size={20} />,
  bloodPressureDiastolic: <IconHeartbeat size={20} />,
  heartRate: <IconHeartbeat size={20} />,
  respiratoryRate: <IconLungs size={20} />,
  temperature: <IconTemperature size={20} />,
  oxygenSaturation: <IconDroplet size={20} />,
  bloodGlucose: <IconDroplet size={20} />,
};

/**
 * Get the patient's display name
 */
function getPatientName(patient: CriticalAlertModalProps['patient']): string {
  if (patient.name?.[0]?.text) {
    return patient.name[0].text;
  }
  const parts = [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean);
  return parts.join(' ') || 'Unknown';
}

export function CriticalAlertModal({
  opened,
  alerts,
  patient,
  onAcknowledge,
  onCancel,
}: CriticalAlertModalProps): JSX.Element {
  const { t } = useTranslation();
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());

  const handleCheckboxChange = useCallback((alertId: string, checked: boolean) => {
    setAcknowledgedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(alertId);
      } else {
        next.delete(alertId);
      }
      return next;
    });
  }, []);

  const allAcknowledged = alerts.length > 0 && acknowledgedIds.size === alerts.length;

  const handleAcknowledge = useCallback(() => {
    const acknowledgedAlerts = alerts.map((alert) => ({
      ...alert,
      acknowledged: acknowledgedIds.has(alert.id),
      acknowledgedAt: new Date().toISOString(),
    }));
    onAcknowledge(acknowledgedAlerts);
    setAcknowledgedIds(new Set());
  }, [alerts, acknowledgedIds, onAcknowledge]);

  const handleCancel = useCallback(() => {
    setAcknowledgedIds(new Set());
    onCancel();
  }, [onCancel]);

  const getAlertMessage = (alert: CriticalAlert): string => {
    const direction = alert.direction === 'high' ? 'criticalHigh' : 'criticalLow';
    const thresholdValue = alert.direction === 'high' ? alert.threshold.criticalHigh : alert.threshold.criticalLow;
    return t(`clinicalAlerts.messages.${alert.vitalType}.${direction}`, {
      value: alert.value,
      unit: alert.threshold.unit,
      threshold: thresholdValue,
    });
  };

  const patientName = getPatientName(patient);

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={
        <Group gap="xs">
          <IconAlertTriangle color="var(--mantine-color-red-6)" size={24} />
          <Text fw={700} c="red.7">
            {t('clinicalAlerts.title')}
          </Text>
        </Group>
      }
      size="lg"
      centered
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={false}
      classNames={{ content: classes.modalContent }}
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={20} />}
          title={t('clinicalAlerts.patientAlert', { patient: patientName })}
          color="red"
          variant="filled"
        >
          {t('clinicalAlerts.alertDescription')}
        </Alert>

        <Text fw={600}>{t('clinicalAlerts.criticalValues')}:</Text>

        <Stack gap="sm">
          {alerts.map((alert) => (
            <Paper key={alert.id} p="md" withBorder className={classes.alertCard}>
              <Group justify="space-between" align="flex-start">
                <Group gap="sm">
                  {VITAL_ICONS[alert.vitalType]}
                  <Stack gap={4}>
                    <Group gap="xs">
                      <Text fw={600}>{t(`clinicalAlerts.vitalNames.${alert.vitalType}`)}</Text>
                      <Badge color="red" variant="filled" size="sm">
                        {t(`clinicalAlerts.severity.${alert.severity}`)}
                      </Badge>
                    </Group>
                    <Text size="lg" fw={700} c="red.7">
                      {alert.value} {alert.threshold.unit}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {getAlertMessage(alert)}
                    </Text>
                  </Stack>
                </Group>
                <Checkbox
                  label={t('clinicalAlerts.acknowledge')}
                  checked={acknowledgedIds.has(alert.id)}
                  onChange={(e) => handleCheckboxChange(alert.id, e.currentTarget.checked)}
                  color="red"
                />
              </Group>
            </Paper>
          ))}
        </Stack>

        <Divider />

        <Alert color="yellow" variant="light">
          <Text size="sm">{t('clinicalAlerts.acknowledgeWarning')}</Text>
        </Alert>

        <Group justify="flex-end">
          <Button variant="default" onClick={handleCancel}>
            {t('clinicalAlerts.cancelAndEdit')}
          </Button>
          <Button
            color="red"
            onClick={handleAcknowledge}
            disabled={!allAcknowledged}
            leftSection={<IconAlertTriangle size={16} />}
          >
            {t('clinicalAlerts.acknowledgeAndSave')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
