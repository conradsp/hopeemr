import { Stack, Card, Text, Group, Badge, Button, Divider, Table } from '@mantine/core';
import { MedicationRequest, MedicationAdministration } from '@medplum/fhirtypes';
import { IconPill, IconClipboardCheck } from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@medplum/core';
import { useMedplum } from '@medplum/react';

interface MedicationsTabProps {
  prescriptions?: MedicationRequest[];
  administrations?: MedicationAdministration[];
  onAdminister?: (prescription: MedicationRequest) => void;
  onEditPrescription?: (prescription: MedicationRequest) => void;
  onDeletePrescription?: (prescription: MedicationRequest) => void;
}

export function MedicationsTab({ 
  prescriptions, 
  administrations,
  onAdminister,
  onEditPrescription,
  onDeletePrescription
}: MedicationsTabProps): React.JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();

  // Helper to resolve practitioner name
  const [practitionerNames, setPractitionerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchNames(): Promise<void> {
      const refs = Array.from(new Set(
        (administrations || [])
          .map(admin => admin.performer?.[0]?.actor?.reference)
          .filter(Boolean)
      ));
      const names: Record<string, string> = {};
      for (const ref of refs) {
        if (ref && !practitionerNames[ref]) {
          const parts = ref.split('/');
          if (parts[0] === 'Practitioner' && parts[1]) {
            try {
              const resource = await medplum.readResource('Practitioner', parts[1]);
              if (resource && resource.name?.[0]) {
                names[ref] = resource.name[0].text || [resource.name[0].given?.[0], resource.name[0].family].filter(Boolean).join(' ');
              } else {
                names[ref] = ref;
              }
            } catch {
              names[ref] = ref;
            }
          } else {
            names[ref] = ref;
          }
        }
      }
      setPractitionerNames(prev => ({ ...prev, ...names }));
    }
    fetchNames().catch(() => {});
  }, [administrations, medplum]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'blue';
      case 'completed': return 'green';
      case 'cancelled': return 'red';
      case 'on-hold': return 'yellow';
      default: return 'gray';
    }
  };

  const getPrescriptionType = (request: MedicationRequest): string => {
    const type = request.extension?.find(
      ext => ext.url === 'http://example.org/fhir/StructureDefinition/prescription-type'
    )?.valueString;
    return type === 'internal' ? t('pharmacy.internal') : t('pharmacy.external');
  };

  const isInternal = (request: MedicationRequest): boolean => {
    const type = request.extension?.find(
      ext => ext.url === 'http://example.org/fhir/StructureDefinition/prescription-type'
    )?.valueString;
    return type === 'internal';
  };

  if (!prescriptions || prescriptions.length === 0) {
    return (
      <Card withBorder>
        <Text ta="center" c="dimmed">{t('pharmacy.noPrescriptions')}</Text>
      </Card>
    );
  }

  return (
    <Stack>
      {/* Prescriptions Section */}
      <Card withBorder>
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <IconPill size={20} />
            <Text fw={500} size="lg" component="span">
              {t('pharmacy.prescriptions')}
            </Text>
          </Group>
        </Group>

        <Stack>
          {prescriptions.map((prescription) => {
            // Filter administrations for this prescription
            const relatedAdministrations = (administrations || []).filter(
              admin => admin.request?.reference === `MedicationRequest/${prescription.id}`
            );
            return (
              <Card key={prescription.id} withBorder p="md">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={500} size="md">
                      {prescription.medicationReference?.display ||
                       prescription.medicationCodeableConcept?.text ||
                       t('common.unknown')}
                    </Text>
                    <Group gap="xs" mt={4}>
                      <Badge color={getStatusColor(prescription.status)} size="sm">
                        {t(`pharmacy.status.${prescription.status}`)}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {getPrescriptionType(prescription)}
                      </Badge>
                    </Group>
                  </div>
                  <Group gap="xs">
                    {isInternal(prescription) && prescription.status === 'active' && onAdminister && (
                      <Button
                        size="xs"
                        leftSection={<IconClipboardCheck size={14} />}
                        onClick={() => onAdminister(prescription)}
                        color="green"
                      >
                        {t('pharmacy.administer')}
                      </Button>
                    )}
                    {onEditPrescription && (
                      <Button
                        size="xs"
                        color="blue"
                        onClick={() => onEditPrescription(prescription)}
                      >
                        {t('common.edit')}
                      </Button>
                    )}
                    {onDeletePrescription && (
                      <Button
                        size="xs"
                        color="red"
                        onClick={() => onDeletePrescription(prescription)}
                      >
                        {t('common.delete')}
                      </Button>
                    )}
                  </Group>
                </Group>

                <Divider my="sm" />

                <Stack gap="xs">
                  <div>
                    <Text size="xs" c="dimmed">{t('pharmacy.dosageInstructions')}</Text>
                    <Text size="sm">{prescription.dosageInstruction?.[0]?.text || t('common.dash')}</Text>
                  </div>

                  <Group>
                    <div>
                      <Text size="xs" c="dimmed">{t('pharmacy.quantity')}</Text>
                      <Text size="sm">{prescription.dispenseRequest?.quantity?.value || t('common.dash')}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">{t('pharmacy.refills')}</Text>
                      <Text size="sm">{prescription.dispenseRequest?.numberOfRepeatsAllowed || 0}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">{t('orders.ordered')}</Text>
                      <Text size="sm">
                        {prescription.authoredOn ? formatDateTime(prescription.authoredOn) : t('common.dash')}
                      </Text>
                    </div>
                  </Group>

                  {prescription.note && prescription.note.length > 0 && (
                    <div>
                      <Text size="xs" c="dimmed">{t('common.notes')}</Text>
                      <Text size="sm">{prescription.note[0].text}</Text>
                    </div>
                  )}
                </Stack>

                {/* Administration Records for this prescription */}
                {relatedAdministrations.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text fw={500} size="sm" mb="xs" component="div">
                      <Group gap="xs">
                        <IconClipboardCheck size={16} />
                        {t('pharmacy.administrationRecord')}
                      </Group>
                    </Text>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('pharmacy.medications')}</Table.Th>
                          <Table.Th>{t('pharmacy.administeredDose')}</Table.Th>
                          <Table.Th>{t('pharmacy.administeredAt')}</Table.Th>
                          <Table.Th>{t('pharmacy.administeredBy')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {relatedAdministrations.map((admin) => (
                          <Table.Tr key={admin.id}>
                            <Table.Td>
                              {admin.medicationReference?.display ||
                               admin.medicationCodeableConcept?.text ||
                               t('common.unknown')}
                            </Table.Td>
                            <Table.Td>{admin.dosage?.text || t('common.dash')}</Table.Td>
                            <Table.Td>
                              {admin.effectiveDateTime ? formatDateTime(admin.effectiveDateTime) : t('common.dash')}
                            </Table.Td>
                            <Table.Td>
                              {admin.performer?.[0]?.actor?.display || 
                               (admin.performer?.[0]?.actor?.reference && practitionerNames[admin.performer[0].actor.reference]) ||
                               admin.performer?.[0]?.actor?.reference ||
                               t('common.unknown')}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </>
                )}
              </Card>
            );
          })}
        </Stack>
      </Card>
    </Stack>
  );
}

