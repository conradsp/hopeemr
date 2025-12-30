import { Container } from '@mantine/core';
import { Patient } from '@medplum/fhirtypes';
import { Loading, useMedplum } from '@medplum/react';
import { JSX, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { PatientSidebar } from '../../components/patient/PatientSidebar';
import { PatientMainSection } from '../../components/patient/PatientMainSection';
import { BreadcrumbNav } from '../../components/shared/BreadcrumbNav';
import { NewEncounterModal } from '../../components/encounter/NewEncounterModal';
import styles from './PatientPage.module.css';

export function PatientPage(): JSX.Element {
  const medplum = useMedplum();
  const { id } = useParams();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [section, setSection] = useState('demographics');
  const [newEncounterModalOpen, setNewEncounterModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = (): void => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    if (!id) {return;}

    medplum
      .readResource('Patient', id)
      .then(setPatient)
      .catch(() => {
        // Handle error silently
      });
  }, [medplum, id, refreshKey]);

  if (!patient) {
    return <Loading />;
  }

  const patientBreadcrumb = {
    id: patient.id as string,
    name: patient.name?.[0]?.text || 
          [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ') ||
          'Unknown Patient'
  };

  return (
    <Container fluid size="100%" className={styles.pageContainer} m={0}>
      {patient && (
        <NewEncounterModal 
          opened={newEncounterModalOpen} 
          onClose={() => {
            setNewEncounterModalOpen(false);
            triggerRefresh();
          }} 
          patient={patient} 
        />
      )}
      
      <BreadcrumbNav patient={patientBreadcrumb} />
      
      <div className={styles.layout}>
        <div className={styles.sidebar}>
          <PatientSidebar 
            patient={patient} 
            selectedSection={section} 
            onSectionSelect={setSection}
            onPatientUpdate={triggerRefresh}
          />
        </div>
        <div className={styles.mainContent}>
          <PatientMainSection 
            section={section} 
            patient={patient} 
            onNewEncounter={() => setNewEncounterModalOpen(true)}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </Container>
  );
}

