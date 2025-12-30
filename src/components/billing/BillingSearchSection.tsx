import { Stack, Group, Autocomplete, Select } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { JSX } from 'react';
import { useTranslation } from 'react-i18next';

interface BillingSearchSectionProps {
  patientSearch: string;
  patientOptions: { value: string; label: string }[];
  encounterOptions: { value: string; label: string }[];
  selectedEncounterId: string | null;
  hasEncounters: boolean;
  onPatientSearch: (query: string) => void;
  onPatientSelect: (value: string) => void;
  onEncounterSelect: (value: string | null) => void;
}

/**
 * Search section for selecting patient and encounter in billing
 */
export function BillingSearchSection({
  patientSearch,
  patientOptions,
  encounterOptions,
  selectedEncounterId,
  hasEncounters,
  onPatientSearch,
  onPatientSelect,
  onEncounterSelect,
}: BillingSearchSectionProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <Stack gap="md" mb="xl">
      <Group grow>
        <Autocomplete
          label={t('billing.searchPatient')}
          placeholder={t('billing.searchPatient')}
          data={patientOptions}
          value={patientSearch}
          onChange={onPatientSearch}
          onOptionSubmit={onPatientSelect}
          leftSection={<IconSearch size={16} />}
        />
        {hasEncounters && (
          <Select
            label={t('billing.selectEncounter')}
            placeholder={t('billing.selectEncounter')}
            data={encounterOptions}
            value={selectedEncounterId || 'all'}
            onChange={onEncounterSelect}
          />
        )}
      </Group>
    </Stack>
  );
}

