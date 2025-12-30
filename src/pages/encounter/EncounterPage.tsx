import { Tabs, Stack } from '@mantine/core';
import { Encounter, Patient, MedicationRequest } from '@medplum/fhirtypes';
import { MedplumClient } from '@medplum/core';
import { 
  Document, 
  Loading,
  useSearchResources 
} from '@medplum/react';
import { PatientSidebar } from '../../components/patient/PatientSidebar';
import { JSX, useEffect, useState } from 'react';
import { RecordVitalsModal } from '../../components/encounter/RecordVitalsModal';
import { CreateNoteModal } from '../../components/encounter/CreateNoteModal';
import { OrderDiagnosticModal } from '../../components/encounter/OrderDiagnosticModal';
import { AddDiagnosisModal } from '../../components/encounter/AddDiagnosisModal';
import { PrescribeMedicationModal } from '../../components/encounter/PrescribeMedicationModal';
import { AdministerMedicationModal } from '../../components/encounter/AdministerMedicationModal';
import { EncounterHeader } from '../../components/encounter/EncounterHeader';
import { EncounterQuickActions } from '../../components/encounter/EncounterQuickActions';
import { OverviewTab } from '../../components/encounter/tabs/OverviewTab';
import { VitalsTab } from '../../components/encounter/tabs/VitalsTab';
import { ObservationsTab } from '../../components/encounter/tabs/ObservationsTab';
import { OrdersTab } from '../../components/encounter/tabs/OrdersTab';
import { NotesTab } from '../../components/encounter/tabs/NotesTab';
import { ProceduresTab } from '../../components/encounter/tabs/ProceduresTab';
import { DiagnosesTab } from '../../components/encounter/tabs/DiagnosesTab';
import { MedicationsTab } from '../../components/encounter/tabs/MedicationsTab';
import { isVitalSign } from '../../utils/encounterUtils';
import { getEncounterPrescriptions, getEncounterAdministrations } from '../../utils/medications';
import { useTranslation } from 'react-i18next';
import styles from './EncounterPageLayout.module.css';

interface EncounterPageProps {
  medplum: MedplumClient;
  encounter: Encounter;
  patient?: Patient;
}

export function EncounterPage({ medplum, encounter, patient }: EncounterPageProps): JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [recordVitalsModalOpen, setRecordVitalsModalOpen] = useState(false);
  const [createNoteModalOpen, setCreateNoteModalOpen] = useState(false);
  const [orderDiagnosticModalOpen, setOrderDiagnosticModalOpen] = useState(false);
  const [addDiagnosisModalOpen, setAddDiagnosisModalOpen] = useState(false);
  const [prescribeMedicationModalOpen, setPrescribeMedicationModalOpen] = useState(false);
  const [administerMedicationModalOpen, setAdministerMedicationModalOpen] = useState(false);
  const [selectedMedicationRequest, setSelectedMedicationRequest] = useState<MedicationRequest | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prescriptions, setPrescriptions] = useState<MedicationRequest[]>([]);
  const [administrations, setAdministrations] = useState<any[]>([]);

  // Function to trigger refresh without full page reload
  const triggerRefresh = (): void => {
    setRefreshKey(prev => prev + 1);
  };

  // Load medications
  useEffect(() => {
    if (encounter?.id) {
      loadMedications();
    }
  }, [encounter, refreshKey]);

  const loadMedications = async (): Promise<void> => {
    const presc = await getEncounterPrescriptions(medplum, encounter.id!);
    const admin = await getEncounterAdministrations(medplum, encounter.id!);
    setPrescriptions(presc);
    setAdministrations(admin);
  };

  // Search for related resources - search by patient and filter by encounter client-side
  // Adding refreshKey to the search params forces the hook to refetch when refreshKey changes
  const [allObservations] = useSearchResources('Observation', 
    patient ? { patient: `Patient/${patient.id}`, _count: '100', _: refreshKey } : undefined
  );
  
  // Filter to only observations for THIS encounter
  const observations = allObservations?.filter(obs => 
    obs.encounter?.reference === `Encounter/${encounter?.id}`
  );
  
  // Filter vitals and non-vitals using utility function
  const vitals = observations?.filter(obs => isVitalSign(obs));
  const nonVitalObservations = observations?.filter(obs => !isVitalSign(obs));
  
  // Count unique vitals recordings (grouped by timestamp)
  const vitalsRecordingCount = vitals ? new Set(
    vitals.map(obs => {
      const timestamp = obs.effectiveDateTime || 'Unknown';
      return timestamp ? new Date(timestamp).toISOString().slice(0, 16) : 'Unknown';
    })
  ).size : 0;
  
  const [allProcedures] = useSearchResources('Procedure', 
    patient ? { patient: `Patient/${patient.id}`, _count: '100', _: refreshKey } : undefined
  );
  const procedures = allProcedures?.filter(proc => 
    proc.encounter?.reference === `Encounter/${encounter?.id}`
  );
  
  const [allConditions] = useSearchResources('Condition', 
    patient ? { patient: `Patient/${patient.id}`, _count: '100', _: refreshKey } : undefined
  );
  const conditions = allConditions?.filter(cond => 
    cond.encounter?.reference === `Encounter/${encounter?.id}`
  );
  
  // Search for clinical notes and documents
  const [allDocuments] = useSearchResources('DocumentReference',
    patient ? { patient: `Patient/${patient.id}`, _count: '50', _: refreshKey } : undefined
  );
  const documents = allDocuments?.filter(doc => 
    doc.context?.encounter?.some(enc => enc.reference === `Encounter/${encounter?.id}`)
  );
  
  const [allDiagnosticReports] = useSearchResources('DiagnosticReport',
    patient ? { patient: `Patient/${patient.id}`, _count: '50', _: refreshKey } : undefined
  );
  const diagnosticReports = allDiagnosticReports?.filter(report => 
    report.encounter?.reference === `Encounter/${encounter?.id}`
  );
  
  // Search for service requests (lab/imaging orders)
  const [allServiceRequests] = useSearchResources('ServiceRequest',
    patient ? { patient: `Patient/${patient.id}`, _count: '100', _: refreshKey } : undefined
  );
  const serviceRequests = allServiceRequests?.filter(sr => 
    sr.encounter?.reference === `Encounter/${encounter?.id}`
  );
  
  // If no direct encounter link, try searching by patient and date
  const [patientProcedures] = useSearchResources('Procedure',
    encounter && patient && !procedures?.length ? {
      patient: `Patient/${patient.id}`,
      date: encounter.period?.start,
      _count: '50'
    } : undefined
  );
  
  const [patientConditions] = useSearchResources('Condition',
    encounter && patient && !conditions?.length ? {
      patient: `Patient/${patient.id}`,
      _count: '50'
    } : undefined
  );
  
  // Use fallback data if direct encounter search returns nothing
  const displayProcedures = procedures?.length ? procedures : patientProcedures;
  const displayConditions = conditions?.length ? conditions : patientConditions;

  // Patient prop is passed from parent, no need to fetch

  if (!encounter) {
    return <Loading />;
  }

  return (
    <div className={styles.layout}>
      {/* Left Sidebar - Patient Info */}
      {patient && (
        <div className={styles.sidebar}>
          <PatientSidebar patient={patient} selectedSection="" onSectionSelect={() => {}} />
        </div>
      )}

      {/* Main Content */}
      <div className={styles.mainContent}>
        <Document>
          {/* Modals */}
          {patient && encounter && (
            <>
              <RecordVitalsModal 
                opened={recordVitalsModalOpen} 
                onClose={() => setRecordVitalsModalOpen(false)}
                encounter={encounter}
                patient={patient}
                onSuccess={() => {
                  setRecordVitalsModalOpen(false);
                  triggerRefresh();
                }}
              />
              <CreateNoteModal
                opened={createNoteModalOpen}
                onClose={() => setCreateNoteModalOpen(false)}
                encounter={encounter}
                patient={patient}
                onSuccess={() => {
                  setCreateNoteModalOpen(false);
                  triggerRefresh();
                }}
              />
              <OrderDiagnosticModal
                opened={orderDiagnosticModalOpen}
                onClose={(saved) => {
                  setOrderDiagnosticModalOpen(false);
                  if (saved) {
                    triggerRefresh();
                  }
                }}
                encounter={encounter}
                patient={patient}
              />
              <AddDiagnosisModal
                opened={addDiagnosisModalOpen}
                onClose={(saved) => {
                  setAddDiagnosisModalOpen(false);
                  if (saved) {
                    triggerRefresh();
                  }
                }}
                encounter={encounter}
                patient={patient}
              />
              <PrescribeMedicationModal
                opened={prescribeMedicationModalOpen}
                onClose={(saved) => {
                  setPrescribeMedicationModalOpen(false);
                  if (saved) {
                    triggerRefresh();
                  }
                }}
                encounter={encounter}
                patient={patient}
              />
              {selectedMedicationRequest && (
                <AdministerMedicationModal
                  opened={administerMedicationModalOpen}
                  onClose={(administered) => {
                    setAdministerMedicationModalOpen(false);
                    setSelectedMedicationRequest(null);
                    if (administered) {
                      triggerRefresh();
                    }
                  }}
                  encounter={encounter}
                  patient={patient}
                  medicationRequest={selectedMedicationRequest}
                />
              )}
            </>
          )}

          {/* Encounter Header */}
          <EncounterHeader encounter={encounter} medplum={medplum} onStatusChange={triggerRefresh} />

          {/* Actions Section */}
          <EncounterQuickActions
            onRecordVitals={() => setRecordVitalsModalOpen(true)}
            onCreateNote={() => setCreateNoteModalOpen(true)}
            onOrderDiagnostics={() => setOrderDiagnosticModalOpen(true)}
            onAddDiagnosis={() => setAddDiagnosisModalOpen(true)}
            onPrescribeMedication={() => setPrescribeMedicationModalOpen(true)}
          />

          {/* Tabbed Content */}
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
            <Tabs.List>
              <Tabs.Tab value="overview">{t('overview.tab', 'Overview')}</Tabs.Tab>
              <Tabs.Tab value="vitals">
                {t('vitals.tab', 'Vitals')} {vitalsRecordingCount > 0 && `(${vitalsRecordingCount})`}
              </Tabs.Tab>
              <Tabs.Tab value="observations">
                {t('otherObservations.tab', 'Other Observations')} {nonVitalObservations && nonVitalObservations.length > 0 && `(${nonVitalObservations.length})`}
              </Tabs.Tab>
              <Tabs.Tab value="orders">
                {t('orders.tab', 'Orders')} {serviceRequests && serviceRequests.length > 0 && `(${serviceRequests.length})`}
              </Tabs.Tab>
              <Tabs.Tab value="notes">
                {t('notes.tab', 'Notes')} {((documents?.length || 0) + (diagnosticReports?.length || 0)) > 0 && 
                  `(${(documents?.length || 0) + (diagnosticReports?.length || 0)})`}
              </Tabs.Tab>
              <Tabs.Tab value="procedures">
                {t('procedures.tab', 'Procedures')} {displayProcedures && displayProcedures.length > 0 && `(${displayProcedures.length})`}
              </Tabs.Tab>
              <Tabs.Tab value="conditions">
                {t('diagnoses.tab', 'Diagnoses')} {displayConditions && displayConditions.length > 0 && `(${displayConditions.length})`}
              </Tabs.Tab>
              <Tabs.Tab value="medications">
                {t('medications.tab', 'Medications')} {prescriptions && prescriptions.length > 0 && `(${prescriptions.length})`}
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="overview" pt="md">
              <OverviewTab
                vitals={vitals}
                nonVitalObservations={nonVitalObservations}
                procedures={displayProcedures}
                conditions={displayConditions}
              />
            </Tabs.Panel>

            <Tabs.Panel value="vitals" pt="md">
              <VitalsTab vitals={vitals} />
            </Tabs.Panel>

            <Tabs.Panel value="observations" pt="md">
              <ObservationsTab observations={nonVitalObservations} />
            </Tabs.Panel>

            <Tabs.Panel value="orders" pt="md">
              <OrdersTab serviceRequests={serviceRequests} />
            </Tabs.Panel>

            <Tabs.Panel value="notes" pt="md">
              <NotesTab documents={documents} diagnosticReports={diagnosticReports} />
            </Tabs.Panel>

            <Tabs.Panel value="procedures" pt="md">
              <ProceduresTab procedures={displayProcedures} />
            </Tabs.Panel>

            <Tabs.Panel value="conditions" pt="md">
              <DiagnosesTab conditions={displayConditions} />
            </Tabs.Panel>

            <Tabs.Panel value="medications" pt="md">
              <MedicationsTab 
                prescriptions={prescriptions}
                administrations={administrations}
                onAdminister={(prescription) => {
                  setSelectedMedicationRequest(prescription);
                  setAdministerMedicationModalOpen(true);
                }}
              />
            </Tabs.Panel>
          </Tabs>
        </Document>
      </div>
    </div>
  );
}
