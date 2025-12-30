import { Container } from '@mantine/core';
import { JSX, useEffect, useState } from 'react';
import { EncounterPage } from '../../pages/encounter/EncounterPage';
import { BreadcrumbNav } from '../shared/BreadcrumbNav';
import { logger } from '../../utils/logger';
import { useParams } from 'react-router';
import { useMedplum } from '@medplum/react';
import { Encounter, Patient } from '@medplum/fhirtypes';
import styles from './EncounterPageWrapper.module.css';

export function EncounterPageWrapper(): JSX.Element {
  const medplum = useMedplum();
  const { id } = useParams();
  const [encounter, setEncounter] = useState<Encounter>();
  const [patient, setPatient] = useState<Patient>();

  useEffect(() => {
    if (!id) {
      return;
    }
    medplum
      .readResource('Encounter', id)
      .then((enc) => {
        setEncounter(enc);
        if (enc.subject) {
          return medplum.readReference(enc.subject);
        }
        return undefined;
      })
      .then((resource) => {
        if (resource && resource.resourceType === 'Patient') {
          setPatient(resource as Patient);
        }
      })
      .catch((error) => logger.error('Failed to load encounter', error));
  }, [medplum, id]);

  const patientBreadcrumb = patient ? {
    id: patient.id as string,
    name: patient.name?.[0]?.text || 
          [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ') ||
          'Unknown Patient'
  } : null;

  const encounterBreadcrumb = encounter ? {
    id: encounter.id as string,
    type: encounter.type?.[0]?.coding?.[0]?.display || 
          encounter.type?.[0]?.text || 
          'Encounter'
  } : null;

  return (
    <Container fluid size="100%" className={styles.wrapperContainer} m={0}>
      <BreadcrumbNav patient={patientBreadcrumb} encounter={encounterBreadcrumb} />
      {encounter && (
        <EncounterPage medplum={medplum} encounter={encounter} patient={patient} />
      )}
    </Container>
  );
}

