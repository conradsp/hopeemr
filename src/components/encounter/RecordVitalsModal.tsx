import { Modal, Button, NumberInput, Stack, Group, Text, Divider } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMedplum } from '@medplum/react';
import { Observation, Encounter, Patient, Reference, Practitioner, PractitionerRole } from '@medplum/fhirtypes';
import { JSX, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CriticalAlertModal } from '../clinical-alerts';
import { evaluateVitalsForCriticalAlerts } from '../../utils/criticalThresholds';
import { createDetectedIssues, buildDetectedIssueResource } from '../../utils/detectedIssueUtils';
import { CriticalAlert, VitalsData } from '../../types/clinicalAlerts.types';
import { useOfflineMutation, SyncQueue } from '../../offline';

interface RecordVitalsModalProps {
  opened: boolean;
  onClose: () => void;
  encounter: Encounter;
  patient: Patient;
  onSuccess?: () => void;
}

// VitalsData interface is imported from types/clinicalAlerts.types.ts

export function RecordVitalsModal({ opened, onClose, encounter, patient, onSuccess }: RecordVitalsModalProps): JSX.Element {
  const medplum = useMedplum();
  const { t } = useTranslation();
  const { createResource, isOnline } = useOfflineMutation();
  const [loading, setLoading] = useState(false);
  const [vitals, setVitals] = useState<VitalsData>({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    respiratoryRate: '',
    temperature: '',
    oxygenSaturation: '',
    bloodGlucose: '',
    weight: '',
    height: '',
  });
  const [criticalAlerts, setCriticalAlerts] = useState<CriticalAlert[]>([]);
  const [showCriticalAlertModal, setShowCriticalAlertModal] = useState(false);

  /**
   * Build observation resources from vitals data
   */
  const buildObservations = (): Observation[] => {
    const patientRef = {
      reference: `Patient/${patient.id}`,
      display: patient.name?.[0]?.text || [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' '),
    } as Reference<Patient>;
    const encounterRef = {
      reference: `Encounter/${encounter.id}`,
    } as Reference<Encounter>;

    const effectiveDateTime = new Date().toISOString();
    const observations: Observation[] = [];

    // Blood Pressure (multi-component observation)
    if (vitals.bloodPressureSystolic && vitals.bloodPressureDiastolic) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: t('recordVitals.vitals'),
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '85354-9',
            display: t('recordVitals.bloodPressure'),
          }],
          text: t('recordVitals.bloodPressure'),
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        component: [
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8480-6',
                display: t('recordVitals.systolic'),
              }],
            },
            valueQuantity: {
              value: parseFloat(vitals.bloodPressureSystolic),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          },
          {
            code: {
              coding: [{
                system: 'http://loinc.org',
                code: '8462-4',
                display: t('recordVitals.diastolic'),
              }],
            },
            valueQuantity: {
              value: parseFloat(vitals.bloodPressureDiastolic),
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]',
            },
          },
        ],
      });
    }

    // Heart Rate
    if (vitals.heartRate) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate',
          }],
          text: 'Heart Rate',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.heartRate),
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
      });
    }

    // Respiratory Rate
    if (vitals.respiratoryRate) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '9279-1',
            display: 'Respiratory rate',
          }],
          text: 'Respiratory Rate',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.respiratoryRate),
          unit: 'breaths/min',
          system: 'http://unitsofmeasure.org',
          code: '/min',
        },
      });
    }

    // Body Temperature
    if (vitals.temperature) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature',
          }],
          text: 'Temperature',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.temperature),
          unit: '°F',
          system: 'http://unitsofmeasure.org',
          code: '[degF]',
        },
      });
    }

    // Oxygen Saturation
    if (vitals.oxygenSaturation) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '2708-6',
            display: 'Oxygen saturation in Arterial blood',
          }],
          text: 'Oxygen Saturation',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.oxygenSaturation),
          unit: '%',
          system: 'http://unitsofmeasure.org',
          code: '%',
        },
      });
    }

    // Blood Glucose
    if (vitals.bloodGlucose) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '2345-7',
            display: 'Glucose [Mass/volume] in Serum or Plasma',
          }],
          text: 'Blood Glucose',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.bloodGlucose),
          unit: 'mg/dL',
          system: 'http://unitsofmeasure.org',
          code: 'mg/dL',
        },
      });
    }

    // Body Weight
    if (vitals.weight) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '29463-7',
            display: 'Body weight',
          }],
          text: 'Weight',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.weight),
          unit: 'lbs',
          system: 'http://unitsofmeasure.org',
          code: '[lb_av]',
        },
      });
    }

    // Body Height
    if (vitals.height) {
      observations.push({
        resourceType: 'Observation',
        status: 'final',
        category: [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs',
          }],
        }],
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: '8302-2',
            display: 'Body height',
          }],
          text: 'Height',
        },
        subject: patientRef,
        encounter: encounterRef,
        effectiveDateTime,
        valueQuantity: {
          value: parseFloat(vitals.height),
          unit: 'in',
          system: 'http://unitsofmeasure.org',
          code: '[in_i]',
        },
      });
    }

    return observations;
  };

  /**
   * Save vitals observations to the server (with offline support)
   * Returns the created observations and whether any were queued for offline sync
   */
  const saveVitalsToServer = async (): Promise<{ observations: Observation[]; anyQueued: boolean }> => {
    const observations = buildObservations();
    let anyQueued = false;

    const createdObservations = await Promise.all(
      observations.map(async (obs) => {
        const result = await createResource(obs, 'Observation');
        if (result.isQueued) {
          anyQueued = true;
        }
        return result.resource;
      })
    );

    return { observations: createdObservations, anyQueued };
  };

  /**
   * Reset the form to initial state
   */
  const resetForm = (): void => {
    setVitals({
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      heartRate: '',
      respiratoryRate: '',
      temperature: '',
      oxygenSaturation: '',
      bloodGlucose: '',
      weight: '',
      height: '',
    });
    setCriticalAlerts([]);
    setShowCriticalAlertModal(false);
  };

  /**
   * Handle form submission
   * Checks for critical values before saving
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Check for critical values before saving
    const validationResult = evaluateVitalsForCriticalAlerts(vitals);

    if (!validationResult.isValid) {
      // Critical values detected - show alert modal
      setCriticalAlerts(validationResult.criticalAlerts);
      setShowCriticalAlertModal(true);
      return; // Don't proceed until acknowledged
    }

    // No critical values - proceed with normal save
    setLoading(true);
    try {
      const { anyQueued } = await saveVitalsToServer();
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess();
      }

      // Show appropriate notification based on online/offline status
      if (anyQueued) {
        notifications.show({
          title: t('recordVitals.savedOfflineTitle', 'Vitals Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
        });
      }
    } catch {
      notifications.show({
        title: t('recordVitals.errorTitle'),
        message: t('recordVitals.errorMessage'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle acknowledgment of critical alerts
   * Saves vitals and creates DetectedIssue resources for audit trail
   */
  const handleCriticalAlertAcknowledge = async (acknowledgedAlerts: CriticalAlert[]): Promise<void> => {
    setShowCriticalAlertModal(false);
    setLoading(true);

    try {
      // Save vitals first
      const { observations: createdObservations, anyQueued } = await saveVitalsToServer();

      // Create DetectedIssue resources for audit trail
      if (isOnline && !anyQueued) {
        // Online: create DetectedIssues immediately
        await createDetectedIssues(medplum, acknowledgedAlerts, patient, encounter, createdObservations);
      } else {
        // Offline: queue DetectedIssue creation for later sync
        // This ensures critical value acknowledgments are always recorded
        const profile = medplum.getProfile();
        if (profile) {
          for (const alert of acknowledgedAlerts) {
            if (alert.acknowledged) {
              const detectedIssue = buildDetectedIssueResource(
                alert,
                patient,
                encounter,
                profile as Practitioner | PractitionerRole,
                createdObservations
              );
              await SyncQueue.queueCreate('DetectedIssue', detectedIssue);
            }
          }
        }
      }

      // Clean up and close
      resetForm();
      onClose();
      if (onSuccess) {
        onSuccess();
      }

      // Show appropriate notification
      if (anyQueued) {
        notifications.show({
          title: t('recordVitals.savedOfflineTitle', 'Vitals Saved Offline'),
          message: t('offline.savedForSync'),
          color: 'yellow',
        });
      } else {
        notifications.show({
          title: t('recordVitals.successWithAlertsTitle', 'Vitals Recorded'),
          message: t('recordVitals.successWithAlertsMessage', 'Critical values have been logged and acknowledged.'),
          color: 'yellow',
        });
      }
    } catch {
      notifications.show({
        title: t('recordVitals.errorTitle'),
        message: t('recordVitals.errorMessage'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle cancellation of critical alert modal
   * Returns user to the form to edit values
   */
  const handleCriticalAlertCancel = (): void => {
    setShowCriticalAlertModal(false);
    setCriticalAlerts([]);
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('recordVitals.title')} size="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {t('recordVitals.instructions', { patient: patient.name?.[0]?.text || t('patientOverview.noneReported') })}
          </Text>

          <Divider label={t('recordVitals.bloodPressure')} />
          <Group grow>
            <NumberInput
              label={t('recordVitals.systolic')}
              placeholder={t('recordVitals.placeholder.systolic')}
              min={0}
              max={300}
              value={vitals.bloodPressureSystolic}
              onChange={(value) => setVitals({ ...vitals, bloodPressureSystolic: value?.toString() || '' })}
            />
            <NumberInput
              label={t('recordVitals.diastolic')}
              placeholder={t('recordVitals.placeholder.diastolic')}
              min={0}
              max={200}
              value={vitals.bloodPressureDiastolic}
              onChange={(value) => setVitals({ ...vitals, bloodPressureDiastolic: value?.toString() || '' })}
            />
          </Group>

          <Divider label={t('recordVitals.vitals')} />
          <Group grow>
            <NumberInput
              label={t('recordVitals.heartRate')}
              placeholder={t('recordVitals.placeholder.heartRate')}
              min={0}
              max={300}
              value={vitals.heartRate}
              onChange={(value) => setVitals({ ...vitals, heartRate: value?.toString() || '' })}
            />
            <NumberInput
              label={t('recordVitals.respiratoryRate')}
              placeholder={t('recordVitals.placeholder.respiratoryRate')}
              min={0}
              max={100}
              value={vitals.respiratoryRate}
              onChange={(value) => setVitals({ ...vitals, respiratoryRate: value?.toString() || '' })}
            />
          </Group>

          <Group grow>
            <NumberInput
              label={t('recordVitals.temperature')}
              placeholder={t('recordVitals.placeholder.temperature')}
              min={90}
              max={110}
              decimalScale={1}
              value={vitals.temperature}
              onChange={(value) => setVitals({ ...vitals, temperature: value?.toString() || '' })}
            />
            <NumberInput
              label={t('recordVitals.oxygenSaturation')}
              placeholder={t('recordVitals.placeholder.oxygenSaturation')}
              min={0}
              max={100}
              value={vitals.oxygenSaturation}
              onChange={(value) => setVitals({ ...vitals, oxygenSaturation: value?.toString() || '' })}
            />
          </Group>

          <Group grow>
            <NumberInput
              label={t('recordVitals.bloodGlucose')}
              placeholder={t('recordVitals.placeholder.bloodGlucose')}
              min={0}
              max={1000}
              value={vitals.bloodGlucose}
              onChange={(value) => setVitals({ ...vitals, bloodGlucose: value?.toString() || '' })}
            />
          </Group>

          <Divider label={t('recordVitals.measurements')} />
          <Group grow>
            <NumberInput
              label={t('recordVitals.weight')}
              placeholder={t('recordVitals.placeholder.weight')}
              min={0}
              max={1000}
              decimalScale={1}
              value={vitals.weight}
              onChange={(value) => setVitals({ ...vitals, weight: value?.toString() || '' })}
            />
            <NumberInput
              label={t('recordVitals.height')}
              placeholder={t('recordVitals.placeholder.height')}
              min={0}
              max={100}
              decimalScale={1}
              value={vitals.height}
              onChange={(value) => setVitals({ ...vitals, height: value?.toString() || '' })}
            />
          </Group>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose} disabled={loading}>
              {t('recordVitals.cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {t('recordVitals.submit')}
            </Button>
          </Group>
        </Stack>
      </form>

      {/* Critical Alert Modal - shown when critical values are detected */}
      <CriticalAlertModal
        opened={showCriticalAlertModal}
        alerts={criticalAlerts}
        patient={patient}
        encounter={encounter}
        onAcknowledge={handleCriticalAlertAcknowledge}
        onCancel={handleCriticalAlertCancel}
      />
    </Modal>
  );
}

