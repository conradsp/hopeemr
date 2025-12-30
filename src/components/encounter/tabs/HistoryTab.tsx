import { Encounter } from '@medplum/fhirtypes';
import { ResourceHistoryTable } from '@medplum/react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface HistoryTabProps {
  encounter: Encounter;
}

export function HistoryTab({ encounter }: HistoryTabProps): JSX.Element {
  const { t } = useTranslation();
  return <ResourceHistoryTable resourceType="Encounter" id={encounter.id as string} />;
}

