import { Badge, Tooltip } from '@mantine/core';
import type { TriageLevel } from '../../utils/triageUtils';
import { getTriageBadgeProps, TRIAGE_LEVELS } from '../../utils/triageUtils';

/**
 * Triage Level Badge Component
 *
 * Displays ESI (Emergency Severity Index) triage level with tooltip
 * - Level 1: Red (filled) - Resuscitation, immediate
 * - Level 2: Orange (filled) - Emergent, < 10 min
 * - Level 3: Yellow (light) - Urgent, < 30 min
 * - Level 4: Green (light) - Less urgent, < 60 min
 * - Level 5: Blue (light) - Non-urgent, < 120 min
 */

interface TriageLevelBadgeProps {
  level: TriageLevel;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showTooltip?: boolean;
}

export function TriageLevelBadge({
  level,
  size = 'sm',
  showTooltip = true,
}: TriageLevelBadgeProps): JSX.Element {
  const badgeProps = getTriageBadgeProps(level);
  const info = TRIAGE_LEVELS[level];

  const badge = (
    <Badge color={badgeProps.color} variant={badgeProps.variant} size={size}>
      {badgeProps.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip
      label={
        <div>
          <div>
            <strong>{info.label}</strong>
          </div>
          <div>{info.description}</div>
          <div>
            <em>Target: {info.timeTarget}</em>
          </div>
        </div>
      }
      multiline
      w={250}
    >
      {badge}
    </Tooltip>
  );
}
