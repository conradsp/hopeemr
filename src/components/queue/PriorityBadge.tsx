import { Badge } from '@mantine/core';
import type { FhirPriority } from '../../utils/triageUtils';
import { getPriorityBadgeProps } from '../../utils/triageUtils';

/**
 * Priority Badge Component
 *
 * Displays FHIR Task priority level with appropriate color coding
 * - STAT: Red (filled) - Immediate attention
 * - ASAP: Orange (filled) - As soon as possible
 * - Urgent: Yellow (light) - Within 30 minutes
 * - Routine: Green (light) - Normal priority
 */

interface PriorityBadgeProps {
  priority: FhirPriority;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps): JSX.Element {
  const badgeProps = getPriorityBadgeProps(priority);

  return (
    <Badge color={badgeProps.color} variant={badgeProps.variant} size={size}>
      {badgeProps.label}
    </Badge>
  );
}
