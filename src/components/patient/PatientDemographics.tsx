import { Grid, Paper, Text, Title } from '@mantine/core';
import { Patient } from '@medplum/fhirtypes';
import { ResourceTable } from '@medplum/react';
import { JSX } from 'react';

interface PatientDemographicsProps {
  patient: Patient;
}

export function PatientDemographics({ patient }: PatientDemographicsProps): JSX.Element {
  const age = patient.birthDate ? Math.floor((Date.now() - new Date(patient.birthDate).getTime()) / 3.15576e10) : '';

  return (
    <Paper shadow="sm" p="md" radius="md" withBorder>
      <Grid>
        <Grid.Col span={6}>
          <Text size="sm" c="dimmed">
            Name
          </Text>
          <Title order={4}>{patient.name?.[0]?.text || 'Unknown'}</Title>
        </Grid.Col>
        <Grid.Col span={6}>
          <Text size="sm" c="dimmed">
            Age
          </Text>
          <Title order={4}>{age}</Title>
        </Grid.Col>
        <Grid.Col span={6}>
          <Text size="sm" c="dimmed">
            Gender
          </Text>
          <Title order={4}>{patient.gender}</Title>
        </Grid.Col>
        <Grid.Col span={6}>
          <Text size="sm" c="dimmed">
            Date of Birth
          </Text>
          <Title order={4}>{patient.birthDate}</Title>
        </Grid.Col>
      </Grid>
      <ResourceTable value={patient} ignoreMissingValues={true} />
    </Paper>
  );
}

