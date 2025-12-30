import { Modal, Button, Stack, Group, Text, Checkbox, Paper, Title, Badge, Divider } from '@mantine/core';
import { useMedplum } from '@medplum/react';
import { Practitioner } from '@medplum/fhirtypes';
import { JSX, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserRole, ROLE_PERMISSIONS } from '../../utils/permissions';
import { getUserRoles, setUserRoles } from '../../utils/permissionUtils';
import { handleError, showSuccess } from '../../utils/errorHandling';
import styles from './EditUserRolesModal.module.css';

interface EditUserRolesModalProps {
  opened: boolean;
  onClose: () => void;
  practitioner: Practitioner | null;
}

export function EditUserRolesModal({ opened, onClose, practitioner }: EditUserRolesModalProps): JSX.Element {
  const { t } = useTranslation();
  const medplum = useMedplum();
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (practitioner && opened) {
      const currentRoles = getUserRoles(practitioner);
      setSelectedRoles(currentRoles);
    }
  }, [practitioner, opened]);

  const handleRoleToggle = (role: UserRole): void => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async (): Promise<void> => {
    if (!practitioner) { return; }

    setLoading(true);
    try {
      const updatedPractitioner = setUserRoles(practitioner, selectedRoles);
      await medplum.updateResource(updatedPractitioner);
      showSuccess(t('users.rolesUpdated'));
      onClose();
    } catch (error) {
      handleError(error, 'updating user roles');
    } finally {
      setLoading(false);
    }
  };

  const userName = practitioner?.name?.[0]?.text ||
    [practitioner?.name?.[0]?.given?.[0], practitioner?.name?.[0]?.family]
      .filter(Boolean)
      .join(' ') ||
    t('users.unknownUser');

  // Get permissions for selected roles
  const selectedPermissions = new Set<string>();
  selectedRoles.forEach(role => {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    rolePerms.forEach(perm => selectedPermissions.add(perm));
  });

  return (
    <Modal opened={opened} onClose={onClose} title={t('users.manageRoles')} size="xl">
      <Stack gap="md">
        <div>
          <Text size="sm" c="dimmed">
            {t('users.manageRolesFor')}
          </Text>
          <Text size="lg" fw={600}>
            {userName}
          </Text>
        </div>

        <Divider />

        <Title order={4}>{t('users.assignRoles')}</Title>
        <Text size="sm" c="dimmed">
          {t('users.selectRolesDescription')}
        </Text>

        <Stack gap="sm">
          {Object.values(UserRole).map(role => (
            <Paper key={role} p="md" withBorder className={styles.rolePaper} onClick={() => handleRoleToggle(role)}>
              <Group justify="space-between">
                <div className={styles.roleContent}>
                  <Group gap="sm" mb="xs">
                    <Checkbox
                      checked={selectedRoles.includes(role)}
                      onChange={() => handleRoleToggle(role)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div>
                      <Text fw={500}>{t(`roles.${role}`)}</Text>
                      <Text size="xs" c="dimmed">
                        {t(`roles.${role}.description`)}
                      </Text>
                    </div>
                  </Group>
                </div>
              </Group>
            </Paper>
          ))}
        </Stack>

        <Divider />

        <div>
          <Title order={4} mb="sm">{t('users.permissionSummary')}</Title>
          <Text size="sm" c="dimmed" mb="md">
            {selectedRoles.length === 0
              ? t('users.noRolesSelected')
              : t('users.userWillHavePermissions', { count: selectedPermissions.size })}
          </Text>

          {selectedRoles.length > 0 && (
            <Group gap="xs">
              <Text size="sm" fw={500}>{t('users.selectedRoles')}:</Text>
              {selectedRoles.map(role => (
                <Badge key={role} size="lg" variant="filled">
                  {t(`roles.${role}`)}
                </Badge>
              ))}
            </Group>
          )}
        </div>

        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={onClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} loading={loading}>
            {t('common.save')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

