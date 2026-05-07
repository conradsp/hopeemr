import { JSX } from 'react';
import { Badge, Tooltip } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { TriageLevel } from '../../utils/triageUtils';
import { getTriageBadgeProps, TRIAGE_LEVELS } from '../../utils/triageUtils';

function nestedT(t: (k: string, p?: Record<string, unknown>) => string, key: string, params?: Record<string, unknown>): string {
  return t(key, params);
}

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
  const { t } = useTranslation();
  const badgeProps = getTriageBadgeProps(level);
  const info = TRIAGE_LEVELS[level];

  // Compose "ESI {level} - {name}" by resolving the nested name key first.
  const name = nestedT(t, badgeProps.labelParams.nameKey);
  const label = t(badgeProps.labelKey, { level: badgeProps.labelParams.level, name });

  const badge = (
    <Badge color={badgeProps.color} variant={badgeProps.variant} size={size}>
      {label}
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
            <strong>{name}</strong>
          </div>
          <div>{t(info.descriptionKey)}</div>
          <div>
            <em>{t('queue.triageTargetLabel', 'Target')}: {t(info.timeTargetKey)}</em>
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
