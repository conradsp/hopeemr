import { PatientTimeline as MedplumPatientTimeline } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import { JSX } from 'react';
import styles from './PatientTimeline.module.css';

// No user-facing strings to translate in PatientTimeline

interface PatientTimelineProps {
  patient: Patient;
}

export function PatientTimeline({ patient }: PatientTimelineProps): JSX.Element {
  return (
    <div className={styles.timelineContainer}>
      <MedplumPatientTimeline patient={patient} />
    </div>
  );
}

