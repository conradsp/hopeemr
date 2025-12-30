import { Paper, Title, Group, Text } from '@mantine/core';
import { Document, useMedplum } from '@medplum/react';
import { Patient, Encounter } from '@medplum/fhirtypes';
import { IconCash } from '@tabler/icons-react';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@medplum/core';
import { getPatientBillingSummary, getEncounterBillingSummary, ChargeItemSummary, PaymentRecord } from '../../utils/billing';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { handleError } from '../../utils/errorHandling';
import { PaymentModal } from '../../components/billing/PaymentModal';
import { BillingSearchSection } from '../../components/billing/BillingSearchSection';
import { BillingSummaryCard } from '../../components/billing/BillingSummaryCard';
import { ChargesTable } from '../../components/billing/ChargesTable';
import { PaymentsTable } from '../../components/billing/PaymentsTable';
import styles from './BillingPage.module.css';

export function BillingPage(): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientOptions, setPatientOptions] = useState<{ value: string; label: string; patient: Patient }[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [charges, setCharges] = useState<ChargeItemSummary[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalCharges, setTotalCharges] = useState(0);
  const [totalPayments, setTotalPayments] = useState(0);
  const [balance, setBalance] = useState(0);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Search for patients
  const handlePatientSearch = async (query: string): Promise<void> => {
    setPatientSearch(query);
    if (query.length < 2) {
      setPatientOptions([]);
      return;
    }

    try {
      const result = await medplum.search('Patient', {
        name: query,
        _count: '10',
      });

      const options = result.entry?.map(e => {
        const patient = e.resource as Patient;
        const name = patient.name?.[0]?.text ||
          [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ') ||
          'Unknown';
        return {
          value: patient.id || '',
          label: `${name} (${patient.id})`,
          patient,
        };
      }) || [];

      setPatientOptions(options);
    } catch (error) {
      handleError(error, 'searching patients');
    }
  };

  // Load encounters when patient is selected
  useEffect(() => {
    if (selectedPatient?.id) {
      loadEncounters(selectedPatient.id);
      loadPatientBilling(selectedPatient.id);
    } else {
      setEncounters([]);
      setSelectedEncounter(null);
      clearBillingData();
    }
  }, [selectedPatient]);

  // Load billing when encounter is selected
  useEffect(() => {
    if (selectedEncounter?.id && selectedPatient?.id) {
      loadEncounterBilling(selectedEncounter.id, selectedPatient.id);
    } else if (selectedPatient?.id && !selectedEncounter) {
      loadPatientBilling(selectedPatient.id);
    }
  }, [selectedEncounter]);

  const loadEncounters = async (patientId: string): Promise<void> => {
    try {
      const result = await medplum.search('Encounter', {
        subject: `Patient/${patientId}`,
        _count: '50',
        _sort: '-date',
      });
      setEncounters(result.entry?.map(e => e.resource as Encounter) || []);
    } catch (error) {
      handleError(error, 'loading encounters');
    }
  };

  const loadPatientBilling = async (patientId: string): Promise<void> => {
    setLoading(true);
    try {
      const summary = await getPatientBillingSummary(medplum, patientId);
      setCharges(summary.charges);
      setPayments(summary.payments);
      setTotalCharges(summary.totalCharges);
      setTotalPayments(summary.totalPayments);
      setBalance(summary.balance);
    } catch (error) {
      handleError(error, 'loading patient billing');
    } finally {
      setLoading(false);
    }
  };

  const loadEncounterBilling = async (encounterId: string, patientId: string): Promise<void> => {
    setLoading(true);
    try {
      const summary = await getEncounterBillingSummary(medplum, encounterId, patientId);
      setCharges(summary.charges);
      setPayments(summary.payments);
      setTotalCharges(summary.totalCharges);
      setTotalPayments(summary.totalPayments);
      setBalance(summary.balance);
    } catch (error) {
      handleError(error, 'loading encounter billing');
    } finally {
      setLoading(false);
    }
  };

  const clearBillingData = (): void => {
    setCharges([]);
    setPayments([]);
    setTotalCharges(0);
    setTotalPayments(0);
    setBalance(0);
  };

  const handlePatientSelect = (value: string): void => {
    const option = patientOptions.find(o => o.value === value);
    if (option) {
      setSelectedPatient(option.patient);
      setSelectedEncounter(null);
    }
  };

  const handleEncounterSelect = (value: string | null): void => {
    if (value === 'all') {
      setSelectedEncounter(null);
      if (selectedPatient?.id) {
        loadPatientBilling(selectedPatient.id);
      }
    } else if (value) {
      const encounter = encounters.find(e => e.id === value);
      if (encounter) {
        setSelectedEncounter(encounter);
      }
    }
  };

  const encounterOptions = [
    { value: 'all', label: t('common.all') },
    ...encounters.map(enc => ({
      value: enc.id || '',
      label: `${enc.type?.[0]?.text || enc.class?.display || 'Encounter'} - ${enc.period?.start ? formatDateTime(enc.period.start) : ''}`,
    })),
  ];

  return (
    <Document>
      <BreadcrumbNav />
      
      <PaymentModal
        opened={paymentModalOpen}
        onClose={(saved) => {
          setPaymentModalOpen(false);
          if (saved && selectedPatient?.id) {
            if (selectedEncounter?.id) {
              loadEncounterBilling(selectedEncounter.id, selectedPatient.id);
            } else {
              loadPatientBilling(selectedPatient.id);
            }
          }
        }}
        patientId={selectedPatient?.id}
        encounterId={selectedEncounter?.id}
      />

      <Paper shadow="sm" p="lg" withBorder className={styles.billingPaper}>
        <Group justify="space-between" mb="lg">
          <Title order={2}>
            <Group gap="xs">
              <IconCash size={28} />
              {t('billing.billing')}
            </Group>
          </Title>
        </Group>

        {/* Search Section */}
        <BillingSearchSection
          patientSearch={patientSearch}
          patientOptions={patientOptions}
          encounterOptions={encounterOptions}
          selectedEncounterId={selectedEncounter?.id || null}
          hasEncounters={selectedPatient !== null && encounters.length > 0}
          onPatientSearch={handlePatientSearch}
          onPatientSelect={handlePatientSelect}
          onEncounterSelect={handleEncounterSelect}
        />

        {selectedPatient && (
          <>
            {/* Summary Section */}
            <BillingSummaryCard
              totalCharges={totalCharges}
              totalPayments={totalPayments}
              balance={balance}
              onAddPayment={() => setPaymentModalOpen(true)}
              disabled={!selectedPatient}
            />

            {/* Charges Table */}
            <ChargesTable charges={charges} />

            {/* Payments Table */}
            <PaymentsTable payments={payments} />
          </>
        )}

        {!selectedPatient && (
          <Paper p="xl" withBorder bg="gray.0">
            <Text ta="center" c="dimmed" size="lg">
              {t('billing.searchPatient')}
            </Text>
          </Paper>
        )}
      </Paper>
    </Document>
  );
}

