import { Paper, Title, Table, Text, Badge, Stack, Group, Button } from '@mantine/core';
import { formatDate } from '@medplum/core';
import { Document, Loading, useSearchResources } from '@medplum/react';
import { IconUser, IconPlus } from '@tabler/icons-react';
import { JSX, useState } from 'react';
import { useNavigate } from 'react-router';
import { NewPatientModal } from '../components/patient/NewPatientModal';
import { useTranslation } from 'react-i18next';
import styles from './HomePage.module.css';

export function HomePage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [newPatientModalOpen, setNewPatientModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [patients, loading] = useSearchResources('Patient', {
    _count: '10',
    _: refreshKey
  });

  if (loading) {
    return (
      <Document>
        <Loading />
      </Document>
    );
  }

  if (!patients || patients.length === 0) {
    return (
      <Document>
        <Paper p="xl" withBorder className={styles.paperTop}>
          <Stack align="center" gap="md">
            <IconUser size={48} color="#999" />
            <Title order={3} c="dimmed">{t('home.noPatientsFound')}</Title>
            <Text c="dimmed">{t('home.useSearchBar')}</Text>
          </Stack>
        </Paper>
      </Document>
    );
  }

  return (
    <Document>
      <NewPatientModal 
        opened={newPatientModalOpen} 
        onClose={() => {
          setNewPatientModalOpen(false);
          setRefreshKey(prev => prev + 1);
        }} 
      />
      
      <Paper shadow="sm" p="lg" withBorder className={styles.paperTop}>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>{t('home.patients', 'Patients')}</Title>
            <Text size="sm" c="dimmed">
              {patients.length === 1
                ? t('home.patientsFoundSingular', '{{count}} patient found', { count: patients.length })
                : t('home.patientsFoundPlural', '{{count}} patients found', { count: patients.length })}
            </Text>
          </div>
          <Button 
            leftSection={<IconPlus size={16} />}
            onClick={() => setNewPatientModalOpen(true)}
          >
            {t('home.newPatient', 'New Patient')}
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('common.name', 'Name')}</Table.Th>
              <Table.Th>{t('common.gender', 'Gender')}</Table.Th>
              <Table.Th>{t('common.dateOfBirth', 'Date of Birth')}</Table.Th>
              <Table.Th>{t('common.age', 'Age')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {patients.map((patient) => {
              const name = patient.name?.[0]?.text || 
                          [patient.name?.[0]?.given?.[0], patient.name?.[0]?.family]
                            .filter(Boolean)
                            .join(' ') || 
                          t('common.unknown', 'Unknown');
              const gender = patient.gender || t('common.dash', '-');
              const birthDate = patient.birthDate;
              const age = birthDate 
                ? Math.floor((Date.now() - new Date(birthDate).getTime()) / 3.15576e10)
                : null;

              const genderColor = (() => {
                switch (gender) {
                  case 'male':
                    return 'blue';
                  case 'female':
                    return 'pink';
                  default:
                    return 'gray';
                }
              })();

              return (
                <Table.Tr
                  key={patient.id}
                  onClick={() => navigate(`/patient/${patient.id}`)}
                  className={styles.clickableRow}
                >
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      variant="light"
                      color={genderColor}
                      size="sm"
                    >
                      {t(`common.gender.${gender}`, gender)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {birthDate ? formatDate(birthDate) : t('common.dash', '-')}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {age !== null ? t('common.years', { age: age }) : t('common.dash', '-')}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Paper>
    </Document>
  );
}

