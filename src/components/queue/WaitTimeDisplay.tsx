import { Text } from '@mantine/core';
import { useEffect, useState } from 'react';
import type { FhirPriority } from '../../utils/triageUtils';
import { formatWaitTime, getWaitTimeColor } from '../../utils/triageUtils';

/**
 * Wait Time Display Component
 *
 * Displays and auto-updates wait time with color coding
 * - Green: Acceptable wait
 * - Yellow: Moderate wait
 * - Orange: Long wait
 * - Red: Critical wait (exceeds target)
 */

interface WaitTimeDisplayProps {
  /** Check-in timestamp */
  authoredOn: string;

  /** Priority level (affects color thresholds) */
  priority: FhirPriority;

  /** Text size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /** Auto-update interval in seconds */
  updateInterval?: number;
}

export function WaitTimeDisplay({
  authoredOn,
  priority,
  size = 'sm',
  updateInterval = 60,
}: WaitTimeDisplayProps): JSX.Element {
  const [waitTimeMinutes, setWaitTimeMinutes] = useState(() =>
    calculateWaitTime(authoredOn)
  );

  // Auto-update wait time
  useEffect(() => {
    const interval = setInterval(() => {
      setWaitTimeMinutes(calculateWaitTime(authoredOn));
    }, updateInterval * 1000);

    return () => clearInterval(interval);
  }, [authoredOn, updateInterval]);

  const color = getWaitTimeColor(waitTimeMinutes, priority);
  const formatted = formatWaitTime(waitTimeMinutes);

  return (
    <Text size={size} c={color} fw={500}>
      {formatted}
    </Text>
  );
}

/**
 * Calculate wait time in minutes from authored timestamp
 */
function calculateWaitTime(authoredOn: string): number {
  const now = new Date().getTime();
  const checkIn = new Date(authoredOn).getTime();
  return Math.floor((now - checkIn) / 60000);
}
