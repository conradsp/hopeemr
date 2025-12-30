import { ActionIcon, Badge, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconUserCheck, IconEdit, IconX } from '@tabler/icons-react';
import { formatHumanName, getReferenceString } from '@medplum/core';
import type { Patient, Task } from '@medplum/fhirtypes';
import { useTranslation } from 'react-i18next';
import { PriorityBadge } from './PriorityBadge';
import { TriageLevelBadge } from './TriageLevelBadge';
import { WaitTimeDisplay } from './WaitTimeDisplay';
import type { FhirPriority, TriageLevel } from '../../utils/triageUtils';
import {
  getTriageLevel,
  getChiefComplaint,
  getComplaintSensitivity,
  getCheckInMethod,
} from '../../utils/queueUtils';
import { Permission } from '../../utils/permissions';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * Queue Table Component
 *
 * Displays queue entries in a sortable, filterable table
 *
 * Security:
 * - Respects VIEW_QUEUE_PHI permission for patient names
 * - Respects VIEW_QUEUE_CHIEF_COMPLAINTS permission for complaints
 * - Filters sensitive chief complaints
 */

interface QueueTableProps {
  /** Queue tasks */
  tasks: Task[];

  /** Patient resources (from _include) */
  patients: Map<string, Patient>;

  /** Claim patient callback */
  onClaimPatient?: (task: Task) => void;

  /** Update triage callback */
  onUpdateTriage?: (task: Task) => void;

  /** Cancel entry callback */
  onCancelEntry?: (task: Task) => void;

  /** Show action column */
  showActions?: boolean;

  /** Loading state */
  loading?: boolean;
}

export function QueueTable({
  tasks,
  patients,
  onClaimPatient,
  onUpdateTriage,
  onCancelEntry,
  showActions = true,
  loading = false,
}: QueueTableProps): JSX.Element {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  // Permission checks (Security Agent requirement)
  const canViewPHI = hasPermission(Permission.VIEW_QUEUE_PHI);
  const canViewChiefComplaints = hasPermission(Permission.VIEW_QUEUE_CHIEF_COMPLAINTS);
  const canClaimPatients = hasPermission(Permission.CLAIM_QUEUE_PATIENTS);
  const canUpdateTriage = hasPermission(Permission.UPDATE_TRIAGE);
  const canCancelEntry = hasPermission(Permission.DELETE_QUEUE_ENTRY);

  if (tasks.length === 0) {
    return (
      <Text c="dimmed" ta="center" p="xl">
        {t('queue.noPatients', 'No patients in queue')}
      </Text>
    );
  }

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: '50px' }}>#</Table.Th>
          <Table.Th style={{ width: '100px' }}>{t('queue.priority', 'Priority')}</Table.Th>
          <Table.Th style={{ width: '120px' }}>{t('queue.triageHeader', 'Triage')}</Table.Th>
          <Table.Th>{t('queue.patient', 'Patient')}</Table.Th>
          {canViewChiefComplaints && (
            <Table.Th>{t('queue.chiefComplaint', 'Chief Complaint')}</Table.Th>
          )}
          <Table.Th style={{ width: '120px' }}>{t('queue.waitTime', 'Wait Time')}</Table.Th>
          <Table.Th style={{ width: '100px' }}>{t('queue.checkInMethodHeader', 'Type')}</Table.Th>
          {showActions && <Table.Th style={{ width: '120px' }}>{t('common.actions', 'Actions')}</Table.Th>}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tasks.map((task, index) => {
          const patientRef = task.for ? getReferenceString(task.for) : undefined;
          const patient = patientRef ? patients.get(patientRef) : undefined;
          const priority = task.priority as FhirPriority;
          const triageLevel = getTriageLevel(task) as TriageLevel | undefined;
          const chiefComplaint = getChiefComplaint(task);
          const sensitivity = getComplaintSensitivity(task);
          const checkInMethod = getCheckInMethod(task);

          return (
            <Table.Tr key={task.id}>
              {/* Queue Position */}
              <Table.Td>
                <Text size="sm" fw={500}>
                  {index + 1}
                </Text>
              </Table.Td>

              {/* Priority Badge */}
              <Table.Td>
                <PriorityBadge priority={priority} />
              </Table.Td>

              {/* Triage Level */}
              <Table.Td>
                {triageLevel ? (
                  <TriageLevelBadge level={triageLevel} />
                ) : (
                  <Badge color="gray" variant="light" size="sm">
                    {t('queue.notTriaged', 'Not Triaged')}
                  </Badge>
                )}
              </Table.Td>

              {/* Patient Name */}
              <Table.Td>
                {canViewPHI && patient ? (
                  <div>
                    <Text size="sm" fw={500}>
                      {formatHumanName(patient.name?.[0])}
                    </Text>
                    {patient.identifier?.[0] && (
                      <Text size="xs" c="dimmed">
                        {t('common.mrn', 'MRN')}: {patient.identifier[0].value}
                      </Text>
                    )}
                  </div>
                ) : (
                  <Text size="sm" c="dimmed">
                    {t('queue.patientConfidential', 'Patient ***')}
                  </Text>
                )}
              </Table.Td>

              {/* Chief Complaint (Security Agent: sensitivity filtering) */}
              {canViewChiefComplaints && (
                <Table.Td>
                  {sensitivity === 'sensitive' ? (
                    <Text size="sm" c="dimmed" fs="italic">
                      {t('queue.confidential', 'Confidential')}
                    </Text>
                  ) : sensitivity === 'private' ? (
                    <Text size="sm">{t('queue.privateConsultation', 'Private consultation')}</Text>
                  ) : chiefComplaint ? (
                    <Text size="sm">{chiefComplaint}</Text>
                  ) : (
                    <Text size="sm" c="dimmed">
                      {t('queue.noComplaint', 'Not specified')}
                    </Text>
                  )}
                </Table.Td>
              )}

              {/* Wait Time (auto-updating) */}
              <Table.Td>
                {task.authoredOn && <WaitTimeDisplay authoredOn={task.authoredOn} priority={priority} />}
              </Table.Td>

              {/* Check-in Method */}
              <Table.Td>
                <Badge
                  color={checkInMethod === 'emergency' ? 'red' : checkInMethod === 'scheduled' ? 'blue' : 'gray'}
                  variant="light"
                  size="sm"
                >
                  {t(`queue.checkInMethodTypes.${checkInMethod}`, checkInMethod)}
                </Badge>
              </Table.Td>

              {/* Actions */}
              {showActions && (
                <Table.Td>
                  <Group gap="xs">
                    {/* Claim Patient */}
                    {canClaimPatients && onClaimPatient && task.status === 'ready' && (
                      <Tooltip label={t('queue.claimPatient', 'Claim Patient')}>
                        <ActionIcon
                          color="blue"
                          variant="light"
                          onClick={() => onClaimPatient(task)}
                          size="sm"
                        >
                          <IconUserCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {/* Update Triage */}
                    {canUpdateTriage && onUpdateTriage && (
                      <Tooltip label={t('queue.updateTriage', 'Update Triage')}>
                        <ActionIcon
                          color="yellow"
                          variant="light"
                          onClick={() => onUpdateTriage(task)}
                          size="sm"
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {/* Remove from Queue */}
                    {canCancelEntry && onCancelEntry && task.status === 'ready' && (
                      <Tooltip label={t('queue.removeFromQueue', 'Remove from Queue')}>
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => onCancelEntry(task)}
                          size="sm"
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}

                    {/* In Progress indicator */}
                    {task.status === 'in-progress' && (
                      <Badge color="green" variant="filled" size="sm">
                        {t('queue.inProgress', 'In Progress')}
                      </Badge>
                    )}
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}
