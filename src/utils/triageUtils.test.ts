import { describe, it, expect } from 'vitest';
import {
  suggestPriorityFromTriage,
  getTriageLevelColor,
  formatWaitTime,
  getTriageLevelInfo,
  getTriageBadgeProps,
  getPriorityBadgeProps,
} from './triageUtils';
import type { TriageLevel } from './triageUtils';

describe('triageUtils', () => {
  describe('suggestPriorityFromTriage', () => {
    it('should map ESI 1 to stat priority', () => {
      expect(suggestPriorityFromTriage(1)).toBe('stat');
    });

    it('should map ESI 2 to stat priority', () => {
      expect(suggestPriorityFromTriage(2)).toBe('stat');
    });

    it('should map ESI 3 to urgent priority', () => {
      expect(suggestPriorityFromTriage(3)).toBe('urgent');
    });

    it('should map ESI 4 to routine priority', () => {
      expect(suggestPriorityFromTriage(4)).toBe('routine');
    });

    it('should map ESI 5 to routine priority', () => {
      expect(suggestPriorityFromTriage(5)).toBe('routine');
    });
  });

  describe('getTriageLevelColor', () => {
    it('should return red for ESI 1', () => {
      expect(getTriageLevelColor(1)).toBe('red');
    });

    it('should return orange for ESI 2', () => {
      expect(getTriageLevelColor(2)).toBe('orange');
    });

    it('should return yellow for ESI 3', () => {
      expect(getTriageLevelColor(3)).toBe('yellow');
    });

    it('should return green for ESI 4', () => {
      expect(getTriageLevelColor(4)).toBe('green');
    });

    it('should return blue for ESI 5', () => {
      expect(getTriageLevelColor(5)).toBe('blue');
    });

    it('should return a default color for unknown levels', () => {
      const color0 = getTriageLevelColor(0 as TriageLevel);
      const color6 = getTriageLevelColor(6 as TriageLevel);
      expect(color0).toBeTruthy();
      expect(color6).toBeTruthy();
    });
  });

  describe('formatWaitTime', () => {
    it('returns justArrived key for sub-minute waits', () => {
      const result = formatWaitTime(0);
      expect(result.key).toBe('queue.waitTime.justArrived');
      expect(result.params).toEqual({});
    });

    it('returns minute key with count for sub-hour waits', () => {
      expect(formatWaitTime(15)).toEqual({ key: 'queue.waitTime.minute', params: { count: 15 } });
      expect(formatWaitTime(45)).toEqual({ key: 'queue.waitTime.minute', params: { count: 45 } });
      expect(formatWaitTime(1)).toEqual({ key: 'queue.waitTime.minute', params: { count: 1 } });
    });

    it('returns hour key for whole-hour waits', () => {
      expect(formatWaitTime(60)).toEqual({ key: 'queue.waitTime.hour', params: { count: 1 } });
      expect(formatWaitTime(120)).toEqual({ key: 'queue.waitTime.hour', params: { count: 2 } });
    });

    it('returns hoursMinutes for mixed waits', () => {
      expect(formatWaitTime(90)).toEqual({
        key: 'queue.waitTime.hoursMinutes',
        params: { hours: 1, minutes: 30 },
      });
      expect(formatWaitTime(125)).toEqual({
        key: 'queue.waitTime.hoursMinutes',
        params: { hours: 2, minutes: 5 },
      });
    });

    it('handles large wait times', () => {
      const result = formatWaitTime(300);
      expect(result.key).toBe('queue.waitTime.hour');
      expect(result.params).toEqual({ count: 5 });
    });
  });

  describe('getTriageLevelInfo', () => {
    it.each([1, 2, 3, 4, 5] as TriageLevel[])('returns color and i18n keys for ESI %i', (level) => {
      const info = getTriageLevelInfo(level);
      expect(info.level).toBe(level);
      expect(info.color).toBeTruthy();
      expect(info.labelKey).toBe(`queue.triage.level${level}.name`);
      expect(info.descriptionKey).toBe(`queue.triage.level${level}.description`);
      expect(info.timeTargetKey).toBe(`queue.triage.level${level}.timeTarget`);
    });
  });

  describe('getTriageBadgeProps', () => {
    it('returns filled variant for ESI 1-2', () => {
      expect(getTriageBadgeProps(1).variant).toBe('filled');
      expect(getTriageBadgeProps(2).variant).toBe('filled');
    });

    it('returns light variant for ESI 3-5', () => {
      expect(getTriageBadgeProps(3).variant).toBe('light');
      expect(getTriageBadgeProps(4).variant).toBe('light');
      expect(getTriageBadgeProps(5).variant).toBe('light');
    });

    it('returns the badge label key with level + nameKey params', () => {
      const props = getTriageBadgeProps(3);
      expect(props.labelKey).toBe('queue.triage.badgeLabel');
      expect(props.labelParams).toEqual({ level: 3, nameKey: 'queue.triage.level3.name' });
    });
  });

  describe('getPriorityBadgeProps', () => {
    it('returns filled variant for stat/asap', () => {
      expect(getPriorityBadgeProps('stat').variant).toBe('filled');
      expect(getPriorityBadgeProps('asap').variant).toBe('filled');
    });

    it('returns light variant for urgent/routine', () => {
      expect(getPriorityBadgeProps('urgent').variant).toBe('light');
      expect(getPriorityBadgeProps('routine').variant).toBe('light');
    });

    it('returns the queue.priority.* key for each priority', () => {
      expect(getPriorityBadgeProps('stat').labelKey).toBe('queue.priority.stat');
      expect(getPriorityBadgeProps('asap').labelKey).toBe('queue.priority.asap');
      expect(getPriorityBadgeProps('urgent').labelKey).toBe('queue.priority.urgent');
      expect(getPriorityBadgeProps('routine').labelKey).toBe('queue.priority.routine');
    });
  });

  describe('ESI Triage System Integration', () => {
    it('maintains consistency between ESI levels and priorities', () => {
      const testCases: Array<{ level: TriageLevel; expectedPriority: string }> = [
        { level: 1, expectedPriority: 'stat' },
        { level: 2, expectedPriority: 'stat' },
        { level: 3, expectedPriority: 'urgent' },
        { level: 4, expectedPriority: 'routine' },
        { level: 5, expectedPriority: 'routine' },
      ];

      testCases.forEach(({ level, expectedPriority }) => {
        const priority = suggestPriorityFromTriage(level);
        const info = getTriageLevelInfo(level);

        expect(priority).toBe(expectedPriority);
        expect(info.color).toBeTruthy();
        expect(info.labelKey).toBeTruthy();
      });
    });

    it('has decreasing urgency from ESI 1 to ESI 5', () => {
      expect(suggestPriorityFromTriage(1)).toBe('stat');
      expect(suggestPriorityFromTriage(2)).toBe('stat');
      expect(suggestPriorityFromTriage(3)).toBe('urgent');
      expect(suggestPriorityFromTriage(4)).toBe('routine');
      expect(suggestPriorityFromTriage(5)).toBe('routine');
    });

    it('has appropriate info for each ESI level', () => {
      const levels: TriageLevel[] = [1, 2, 3, 4, 5];

      levels.forEach((level) => {
        const info = getTriageLevelInfo(level);
        expect(info.color).toBeTruthy();
        expect(info.labelKey).toBeTruthy();
        expect(info.descriptionKey).toBeTruthy();
      });
    });
  });
});
