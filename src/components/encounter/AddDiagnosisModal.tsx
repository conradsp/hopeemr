import { JSX, useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Group, Stack, Textarea, Radio, Loader, Text, Badge, Combobox, InputBase, useCombobox, ScrollArea } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { Patient, Encounter, Condition } from '@medplum/fhirtypes';
import { notifications } from '@mantine/notifications';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import {
  searchDiagnosisCodes,
  CodeSearchResult,
  getCodingSystemLabel,
  getCodingSystemColor,
  getTerminologyConfig,
} from '../../utils/terminologyService';

interface AddDiagnosisModalProps {
  opened: boolean;
  onClose: (saved: boolean) => void;
  patient: Patient;
  encounter?: Encounter;
}

export function AddDiagnosisModal({ opened, onClose, patient, encounter }: AddDiagnosisModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CodeSearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedCode, setSelectedCode] = useState<CodeSearchResult | null>(null);
  const [clinicalStatus, setClinicalStatus] = useState('active');
  const [verificationStatus, setVerificationStatus] = useState('confirmed');
  const [severity, setSeverity] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  // Reset form when modal opens
  useEffect(() => {
    if (opened) {
      setSelectedCode(null);
      setClinicalStatus('active');
      setVerificationStatus('confirmed');
      setSeverity(null);
      setNotes('');
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [opened]);

  // Debounced search
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const results = await searchDiagnosisCodes(medplum, query, { maxResults: 50 });
      setSearchResults(results);
    } catch (error) {
      logger.error('Diagnosis code search failed', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [medplum]);

  // Handle search input with debounce
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value || value.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle code selection
  const handleSelectCode = (result: CodeSearchResult) => {
    setSelectedCode(result);
    setSearchQuery(`${result.code} - ${result.display}`);
    combobox.closeDropdown();
  };

  const handleSubmit = async () => {
    if (!selectedCode) {
      notifications.show({
        title: t('validationError'),
        message: t('diagnosis.selectDiagnosis'),
        color: 'yellow',
      });
      return;
    }

    setLoading(true);
    try {
      const condition: Condition = {
        resourceType: 'Condition',
        clinicalStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
              code: clinicalStatus,
              display: clinicalStatus.charAt(0).toUpperCase() + clinicalStatus.slice(1),
            },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
              code: verificationStatus,
              display: verificationStatus.charAt(0).toUpperCase() + verificationStatus.slice(1),
            },
          ],
        },
        code: {
          coding: [
            {
              system: selectedCode.system,
              code: selectedCode.code,
              display: selectedCode.display,
            },
          ],
          text: selectedCode.display,
        },
        subject: {
          reference: `Patient/${patient.id}`,
          display: patient.name?.[0]?.text,
        },
        encounter: encounter ? {
          reference: `Encounter/${encounter.id}`,
        } : undefined,
        onsetDateTime: new Date().toISOString(),
        recordedDate: new Date().toISOString(),
        recorder: {
          reference: `Practitioner/${medplum.getProfile()?.id}`,
          display: medplum.getProfile()?.name?.[0]?.text,
        },
        severity: severity ? {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: severity === 'mild' ? '255604002' : severity === 'moderate' ? '6736007' : '24484000',
              display: severity.charAt(0).toUpperCase() + severity.slice(1),
            },
          ],
        } : undefined,
        note: notes ? [{ text: notes }] : undefined,
      };

      await medplum.createResource(condition);

      notifications.show({
        title: t('success'),
        message: t('diagnosis.addSuccess'),
        color: 'green',
      });
      onClose(true);
    } catch (error) {
      logger.error('Failed to add diagnosis', error);
      notifications.show({
        title: t('error'),
        message: t('diagnosis.addError'),
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Get config for displaying info
  const config = getTerminologyConfig();
  const enabledSystemsText = config.enabledSystems
    .map(s => getCodingSystemLabel(s))
    .join(', ');

  return (
    <Modal
      opened={opened}
      onClose={() => onClose(false)}
      title={t('diagnosis.addDiagnosis')}
      size="lg"
    >
      <Stack gap="md">
        {/* Async search combobox */}
        <Combobox
          store={combobox}
          onOptionSubmit={(val) => {
            const result = searchResults.find(r => `${r.system}|${r.code}` === val);
            if (result) {
              handleSelectCode(result);
            }
          }}
        >
          <Combobox.Target>
            <InputBase
              label={t('diagnosis.code')}
              placeholder={t('diagnosis.searchCode')}
              description={t('diagnosis.searchHint', { systems: enabledSystemsText })}
              value={searchQuery}
              onChange={(e) => {
                handleSearchChange(e.currentTarget.value);
                combobox.openDropdown();
                combobox.updateSelectedOptionIndex();
              }}
              onClick={() => combobox.openDropdown()}
              onFocus={() => combobox.openDropdown()}
              rightSection={searching ? <Loader size={16} /> : null}
              required
            />
          </Combobox.Target>

          <Combobox.Dropdown>
            <Combobox.Options>
              <ScrollArea.Autosize mah={300} type="scroll">
                {searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                  <Combobox.Empty>{t('diagnosis.noResults')}</Combobox.Empty>
                )}
                {searchResults.length === 0 && !searching && searchQuery.length < 2 && (
                  <Combobox.Empty>{t('diagnosis.typeToSearch')}</Combobox.Empty>
                )}
                {searching && (
                  <Combobox.Empty>
                    <Group gap="xs">
                      <Loader size={14} />
                      <Text size="sm">{t('diagnosis.searching')}</Text>
                    </Group>
                  </Combobox.Empty>
                )}
                {searchResults.map((result) => (
                  <Combobox.Option
                    key={`${result.system}|${result.code}`}
                    value={`${result.system}|${result.code}`}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Badge size="xs" color={getCodingSystemColor(result.system)} variant="light">
                        {getCodingSystemLabel(result.system)}
                      </Badge>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>
                          {result.code}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {result.display}
                        </Text>
                      </div>
                    </Group>
                  </Combobox.Option>
                ))}
              </ScrollArea.Autosize>
            </Combobox.Options>
          </Combobox.Dropdown>
        </Combobox>

        {/* Selected code display */}
        {selectedCode && (
          <Group gap="xs">
            <Badge color={getCodingSystemColor(selectedCode.system)}>
              {getCodingSystemLabel(selectedCode.system)}
            </Badge>
            <Text size="sm" fw={500}>{selectedCode.code}</Text>
            <Text size="sm" c="dimmed">- {selectedCode.display}</Text>
          </Group>
        )}

        <Radio.Group
          label={t('diagnosis.clinicalStatus')}
          value={clinicalStatus}
          onChange={setClinicalStatus}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="active" label={t('diagnosis.status.active')} />
            <Radio value="recurrence" label={t('diagnosis.status.recurrence')} />
            <Radio value="relapse" label={t('diagnosis.status.relapse')} />
            <Radio value="inactive" label={t('diagnosis.status.inactive')} />
            <Radio value="remission" label={t('diagnosis.status.remission')} />
            <Radio value="resolved" label={t('diagnosis.status.resolved')} />
          </Stack>
        </Radio.Group>

        <Radio.Group
          label={t('diagnosis.verificationStatus')}
          value={verificationStatus}
          onChange={setVerificationStatus}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="confirmed" label={t('diagnosis.verification.confirmed')} />
            <Radio value="provisional" label={t('diagnosis.verification.provisional')} />
            <Radio value="differential" label={t('diagnosis.verification.differential')} />
            <Radio value="unconfirmed" label={t('diagnosis.verification.unconfirmed')} />
            <Radio value="refuted" label={t('diagnosis.verification.refuted')} />
          </Stack>
        </Radio.Group>

        <Radio.Group
          label={t('diagnosis.severity')}
          value={severity || ''}
          onChange={(val) => setSeverity(val || null)}
        >
          <Stack gap="xs" mt="xs">
            <Radio value="" label={t('diagnosis.severityLevels.none')} />
            <Radio value="mild" label={t('diagnosis.severityLevels.mild')} />
            <Radio value="moderate" label={t('diagnosis.severityLevels.moderate')} />
            <Radio value="severe" label={t('diagnosis.severityLevels.severe')} />
          </Stack>
        </Radio.Group>

        <Textarea
          label={t('diagnosis.notes')}
          placeholder={t('diagnosis.additionalNotes')}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          rows={3}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => onClose(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!selectedCode}>
            {t('diagnosis.addDiagnosis')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
