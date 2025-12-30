import { Encounter } from '@medplum/fhirtypes';
import { ResourceTable } from '@medplum/react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface DetailsTabProps {
  encounter: Encounter;
}

export function DetailsTab({ encounter }: DetailsTabProps): JSX.Element {
  const { t } = useTranslation();
  return <ResourceTable value={encounter} />;
}

