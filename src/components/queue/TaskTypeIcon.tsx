import {
  IconFlask,
  IconPhoto,
  IconPhone,
  IconArrowRight,
  IconPill,
  IconFileCheck,
  IconFile,
  IconRefresh,
  IconStethoscope,
  IconClipboard,
} from '@tabler/icons-react';
import type { ProviderTaskType } from '../../types/queue.types';

interface TaskTypeIconProps {
  type: ProviderTaskType;
  size?: number;
  color?: string;
}

const TASK_ICONS: Record<ProviderTaskType, React.FC<{ size?: number; color?: string }>> = {
  'lab-review': IconFlask,
  'imaging-review': IconPhoto,
  'call-patient': IconPhone,
  'referral': IconArrowRight,
  'prescription': IconPill,
  'prior-auth': IconFileCheck,
  'document-review': IconFile,
  'follow-up': IconRefresh,
  'consult': IconStethoscope,
  'other': IconClipboard,
};

const TASK_COLORS: Record<ProviderTaskType, string> = {
  'lab-review': 'var(--mantine-color-blue-6)',
  'imaging-review': 'var(--mantine-color-cyan-6)',
  'call-patient': 'var(--mantine-color-green-6)',
  'referral': 'var(--mantine-color-orange-6)',
  'prescription': 'var(--mantine-color-grape-6)',
  'prior-auth': 'var(--mantine-color-red-6)',
  'document-review': 'var(--mantine-color-gray-6)',
  'follow-up': 'var(--mantine-color-teal-6)',
  'consult': 'var(--mantine-color-indigo-6)',
  'other': 'var(--mantine-color-gray-6)',
};

/**
 * TaskTypeIcon - Displays an icon for a provider task type
 *
 * Each task type has a distinct icon and color for easy visual recognition.
 */
export function TaskTypeIcon({ type, size = 20, color }: TaskTypeIconProps): JSX.Element {
  const Icon = TASK_ICONS[type] || IconClipboard;
  const iconColor = color || TASK_COLORS[type] || 'var(--mantine-color-gray-6)';

  return <Icon size={size} color={iconColor} />;
}
