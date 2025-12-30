import { Paper, Stack, Text, Group, Avatar, Divider, Title, ActionIcon } from '@mantine/core';
import { formatDate } from '@medplum/core';
import { Patient, Coverage } from '@medplum/fhirtypes';
import { IconPlus } from '@tabler/icons-react';
import { JSX, useEffect, useState } from 'react';
import { AddInsuranceModal } from './AddInsuranceModal';
import { AddPractitionerModal } from './AddPractitionerModal';
import { AddEmergencyContactModal } from './AddEmergencyContactModal';
import { useMedplum } from '@medplum/react';
import { useTranslation } from 'react-i18next';

interface PatientSidebarProps {
  patient: Patient | null;
  onSectionSelect: (menu: string) => void;
  selectedSection: string;
  onPatientUpdate?: () => void;
}

export function PatientSidebar({ patient, onPatientUpdate }: PatientSidebarProps): JSX.Element | null {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [insuranceModalOpen, setInsuranceModalOpen] = useState(false);
  const [practitionerModalOpen, setPractitionerModalOpen] = useState(false);
  const [emergencyContactModalOpen, setEmergencyContactModalOpen] = useState(false);
  const [coverages, setCoverages] = useState<Coverage[]>([]);

  useEffect(() => {
    (async (): Promise<void> => {
      if (patient?.id) {
        const result = await medplum.search('Coverage', `beneficiary=Patient/${patient.id}`);
        setCoverages(result?.entry?.map((e: any) => e.resource) || []);
      }
    })().catch(() => {});
  }, [patient, insuranceModalOpen, medplum]);

  if (!patient) {
    return null;
  }

  const name = patient.name?.[0]?.text || 
               [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family].filter(Boolean).join(' ') || 
               t('patient.unknownPatient', 'Unknown Patient');
  
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Calculate age from birthdate
  const age = patient.birthDate 
    ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / 3.15576e10)
    : null;

  return (
    <>
      {/* Modals */}
      <AddInsuranceModal 
        opened={insuranceModalOpen} 
        onClose={() => setInsuranceModalOpen(false)} 
        patient={patient}
        onSuccess={onPatientUpdate}
      />
      <AddPractitionerModal 
        opened={practitionerModalOpen} 
        onClose={() => setPractitionerModalOpen(false)} 
        patient={patient}
        onSuccess={onPatientUpdate}
      />
      <AddEmergencyContactModal 
        opened={emergencyContactModalOpen} 
        onClose={() => setEmergencyContactModalOpen(false)} 
        patient={patient}
        onSuccess={onPatientUpdate}
      />

      <Stack gap="xs">
        {/* Patient Header */}
        <Paper shadow="sm" p="md" withBorder>
        <Stack gap="md">
          <Group>
            <Avatar color="blue" radius="xl" size="lg">
              {initials}
            </Avatar>
            <div>
              <Text fw={600} size="lg">{name}</Text>
              <Text size="sm" c="dimmed">
                {t('patient.mrn', 'MRN')}: {patient.id?.slice(0, 8)}
              </Text>
            </div>
          </Group>

          <Divider />

          {/* Basic Demographics */}
          <Stack gap="xs">
            <div>
              <Text size="xs" c="dimmed">{t('patient.dateOfBirth')}</Text>
              <Text size="sm" fw={500}>
                {patient.birthDate ? `${formatDate(patient.birthDate)} (${age} ${t('patient.years', 'years')})` : '-'}
              </Text>
            </div>

            <div>
              <Text size="xs" c="dimmed">{t('patient.gender')}</Text>
              <Text size="sm" fw={500} tt="capitalize">
                {patient.gender || '-'}
              </Text>
            </div>

            {patient.maritalStatus && (
              <div>
                <Text size="xs" c="dimmed">{t('patient.maritalStatus')}</Text>
                <Text size="sm" fw={500} tt="capitalize">
                  {patient.maritalStatus.coding?.[0]?.display || 
                   patient.maritalStatus.text || '-'}
                </Text>
              </div>
            )}

            {patient.communication && patient.communication.length > 0 && (
              <div>
                <Text size="xs" c="dimmed">{t('patient.language')}</Text>
                <Text size="sm" fw={500}>
                  {patient.communication[0].language?.coding?.[0]?.display || 
                   patient.communication[0].language?.text || '-'}
                </Text>
              </div>
            )}
          </Stack>
        </Stack>
      </Paper>

      {/* Contact Information */}
      <Paper shadow="sm" p="md" withBorder>
        <Title order={5} mb="sm">{t('patient.contactInformation')}</Title>
        <Stack gap="xs">
          {patient.telecom?.filter(tel => tel.system === 'phone').map((phone, idx) => (
            <div key={idx}>
              <Text size="xs" c="dimmed">
                {phone.use ? t(`patient.phone.${phone.use}`, `${phone.use} Phone`) : t('patient.phone', 'Phone')}
              </Text>
              <Text size="sm" fw={500}>{phone.value}</Text>
            </div>
          ))}

          {patient.telecom?.filter(tel => tel.system === 'email').map((email, idx) => (
            <div key={idx}>
              <Text size="xs" c="dimmed">
                {email.use ? t(`patient.email.${email.use}`, `${email.use} Email`) : t('patient.email', 'Email')}
              </Text>
              <Text size="sm" fw={500}>{email.value}</Text>
            </div>
          ))}

          {patient.address?.map((addr, idx) => (
            <div key={idx}>
              <Text size="xs" c="dimmed">
                {addr.use ? t(`patient.address.${addr.use}`, `${addr.use} Address`) : t('patient.address', 'Address')}
              </Text>
              <Text size="sm" fw={500}>
                {addr.line?.join(', ')}
                {addr.city && <><br />{addr.city}</>}
                {addr.state && `, ${addr.state}`}
                {addr.postalCode && ` ${addr.postalCode}`}
                {addr.country && <><br />{addr.country}</>}
              </Text>
            </div>
          ))}
        </Stack>
      </Paper>

      {/* Emergency Contacts */}
      <Paper shadow="sm" p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={5}>{t('patient.emergencyContacts')}</Title>
          <ActionIcon 
            variant="light" 
            size="sm"
            onClick={() => setEmergencyContactModalOpen(true)}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
        {patient.contact && patient.contact.length > 0 ? (
          <Stack gap="md">
            {patient.contact.map((contact, idx) => (
              <div key={idx}>
                {contact.name && (
                  <Text size="sm" fw={600}>
                    {contact.name.text || 
                     [contact.name.given?.[0], contact.name.family].filter(Boolean).join(' ')}
                  </Text>
                )}
                {contact?.relationship?.[0] && (
                  <Text size="xs" c="dimmed">
                    {contact.relationship[0].coding?.[0]?.display || 
                     contact.relationship[0].text}
                  </Text>
                )}
                {contact.telecom?.map((tel, telIdx) => (
                  <Text key={telIdx} size="xs">
                    {tel.system}: {tel.value}
                  </Text>
                ))}
              </div>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">{t('patient.noneReported', 'None reported')}</Text>
        )}
      </Paper>

      {/* General Practitioner */}
      <Paper shadow="sm" p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={5}>{t('patient.generalPractitioner')}</Title>
          <ActionIcon 
            variant="light" 
            size="sm"
            onClick={() => setPractitionerModalOpen(true)}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
        {patient.generalPractitioner && patient.generalPractitioner.length > 0 ? (
          <Stack gap="xs">
            {patient.generalPractitioner.map((gp, idx) => (
              <Text key={idx} size="sm" fw={500}>
                {gp.display || gp.reference}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">{t('patient.noneReported', 'None reported')}</Text>
        )}
      </Paper>

      {/* Insurance */}
      <Paper shadow="sm" p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Title order={5} mb="sm">{t('patient.insurance')}</Title>
          <ActionIcon 
            variant="light" 
            size="sm"
            onClick={() => setInsuranceModalOpen(true)}
          >
            <IconPlus size={14} />
          </ActionIcon>
        </Group>
        {coverages.length > 0 ? (
          <Stack gap="xs">
            {coverages.map((coverage, idx) => (
              <Text key={idx} size="sm" fw={500}>
                {coverage.payor?.[0]?.display || t('patient.unknownPayor', 'Unknown Payor')} - {coverage.subscriberId}
              </Text>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">{t('patient.noneReported', 'None reported')}</Text>
        )}
      </Paper>

      {/* Managing Organization */}
      <Paper shadow="sm" p="md" withBorder>
        <Title order={5} mb="sm">{t('patient.managingOrganization')}</Title>
        {patient.managingOrganization ? (
          <Text size="sm" fw={500}>
            {patient.managingOrganization.display || patient.managingOrganization.reference}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">{t('patient.noneReported', 'None reported')}</Text>
        )}
      </Paper>
      </Stack>
    </>
  );
}
