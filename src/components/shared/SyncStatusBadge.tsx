import { Badge, Tooltip, Loader, Group } from '@mantine/core';
import { IconCloud, IconCloudOff, IconCloudUpload } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useOffline } from '../../offline';
import { JSX } from 'react';

/**
 * Badge component showing sync status
 * Shows pending changes count, sync progress, or online/offline status
 */
export function SyncStatusBadge(): JSX.Element | null {
  const { t } = useTranslation();
  const { isOnline, pendingChanges, isSyncing, lastSyncTime } = useOffline();

  // Format last sync time
  const formatLastSync = (): string => {
    if (!lastSyncTime) {
      return t('offline.neverSynced', 'Never synced');
    }

    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) {
      return t('offline.justNow', 'Just now');
    } else if (diffMins < 60) {
      return t('offline.minutesAgo', { count: diffMins, defaultValue: '{{count}} min ago' });
    } else {
      const diffHours = Math.floor(diffMins / 60);
      return t('offline.hoursAgo', { count: diffHours, defaultValue: '{{count}} hr ago' });
    }
  };

  // Offline state
  if (!isOnline) {
    return (
      <Tooltip label={t('offline.workingOffline', 'Working Offline')}>
        <Badge
          color="orange"
          variant="filled"
          size="lg"
          leftSection={<IconCloudOff size={14} />}
        >
          {t('offline.offline', 'Offline')}
          {pendingChanges > 0 && ` (${pendingChanges})`}
        </Badge>
      </Tooltip>
    );
  }

  // Syncing state
  if (isSyncing) {
    return (
      <Tooltip label={t('offline.syncing', { count: pendingChanges, defaultValue: 'Syncing {{count}} changes...' })}>
        <Badge
          color="blue"
          variant="filled"
          size="lg"
          leftSection={<Loader size={12} color="white" />}
        >
          {t('offline.syncingShort', 'Syncing')}
        </Badge>
      </Tooltip>
    );
  }

  // Pending changes
  if (pendingChanges > 0) {
    return (
      <Tooltip
        label={t('offline.pendingTooltip', {
          count: pendingChanges,
          defaultValue: '{{count}} changes waiting to sync',
        })}
      >
        <Badge
          color="yellow"
          variant="filled"
          size="lg"
          leftSection={<IconCloudUpload size={14} />}
        >
          {pendingChanges}
        </Badge>
      </Tooltip>
    );
  }

  // Online and synced
  return (
    <Tooltip label={t('offline.lastSync', { time: formatLastSync(), defaultValue: 'Last synced: {{time}}' })}>
      <Badge
        color="green"
        variant="light"
        size="lg"
        leftSection={<IconCloud size={14} />}
      >
        {t('offline.synced', 'Synced')}
      </Badge>
    </Tooltip>
  );
}

/**
 * Compact version of sync status badge for tight spaces
 */
export function SyncStatusBadgeCompact(): JSX.Element | null {
  const { t } = useTranslation();
  const { isOnline, pendingChanges, isSyncing } = useOffline();

  // Offline
  if (!isOnline) {
    return (
      <Tooltip label={t('offline.workingOffline', 'Working Offline')}>
        <Group gap={4}>
          <IconCloudOff size={18} color="orange" />
          {pendingChanges > 0 && (
            <Badge color="orange" size="xs" variant="filled">
              {pendingChanges}
            </Badge>
          )}
        </Group>
      </Tooltip>
    );
  }

  // Syncing
  if (isSyncing) {
    return (
      <Tooltip label={t('offline.syncing', { count: pendingChanges, defaultValue: 'Syncing...' })}>
        <Loader size={18} color="blue" />
      </Tooltip>
    );
  }

  // Pending
  if (pendingChanges > 0) {
    return (
      <Tooltip label={t('offline.pendingChanges', { count: pendingChanges, defaultValue: '{{count}} pending' })}>
        <Badge color="yellow" size="xs" variant="filled">
          {pendingChanges}
        </Badge>
      </Tooltip>
    );
  }

  // Synced - don't show anything when all is well
  return null;
}
