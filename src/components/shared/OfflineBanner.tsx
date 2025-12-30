import { Alert, Group, Text, Loader, Button } from '@mantine/core';
import { IconWifiOff, IconCloudUpload, IconCheck } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useOffline } from '../../offline';
import { JSX } from 'react';

/**
 * Banner component that shows offline status and sync progress
 * Displays at the top of the app when offline or when there are pending changes
 */
export function OfflineBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const { isOnline, pendingChanges, isSyncing, syncNow } = useOffline();

  // Don't show banner if online and no pending changes
  if (isOnline && pendingChanges === 0 && !isSyncing) {
    return null;
  }

  // Offline state
  if (!isOnline) {
    return (
      <Alert
        variant="filled"
        color="orange"
        icon={<IconWifiOff size={20} />}
        radius={0}
        styles={{
          root: {
            position: 'sticky',
            top: 0,
            zIndex: 1000,
          },
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs">
            <Text size="sm" fw={500}>
              {t('offline.workingOffline', 'Working Offline')}
            </Text>
            {pendingChanges > 0 && (
              <Text size="sm" c="orange.1">
                ({t('offline.pendingChanges', { count: pendingChanges, defaultValue: '{{count}} pending' })})
              </Text>
            )}
          </Group>
        </Group>
      </Alert>
    );
  }

  // Syncing state
  if (isSyncing) {
    return (
      <Alert
        variant="filled"
        color="blue"
        icon={<Loader size={16} color="white" />}
        radius={0}
        styles={{
          root: {
            position: 'sticky',
            top: 0,
            zIndex: 1000,
          },
        }}
      >
        <Text size="sm" fw={500}>
          {t('offline.syncing', { count: pendingChanges, defaultValue: 'Syncing {{count}} changes...' })}
        </Text>
      </Alert>
    );
  }

  // Online with pending changes (waiting to sync)
  if (pendingChanges > 0) {
    return (
      <Alert
        variant="filled"
        color="yellow"
        icon={<IconCloudUpload size={20} />}
        radius={0}
        styles={{
          root: {
            position: 'sticky',
            top: 0,
            zIndex: 1000,
          },
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>
            {t('offline.pendingChanges', { count: pendingChanges, defaultValue: '{{count}} pending' })}
          </Text>
          <Button
            size="xs"
            variant="white"
            color="yellow"
            onClick={syncNow}
            leftSection={<IconCloudUpload size={14} />}
          >
            {t('offline.retrySync', 'Sync Now')}
          </Button>
        </Group>
      </Alert>
    );
  }

  return null;
}

/**
 * Temporary success banner shown after sync completes
 */
export function SyncSuccessBanner(): JSX.Element | null {
  const { t } = useTranslation();

  return (
    <Alert
      variant="filled"
      color="green"
      icon={<IconCheck size={20} />}
      radius={0}
      styles={{
        root: {
          position: 'sticky',
          top: 0,
          zIndex: 1000,
        },
      }}
    >
      <Text size="sm" fw={500}>
        {t('offline.syncComplete', 'All changes synced')}
      </Text>
    </Alert>
  );
}
