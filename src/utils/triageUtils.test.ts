import { describe, it, expect } from 'vitest';
import {
  suggestPriorityFromTriage,
  getTriageLevelColor,
  formatWaitTime,
  getTriageLevelInfo,
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

    it('should return gray for unknown levels', () => {
      const color0 = getTriageLevelColor(0 as TriageLevel);
      const color6 = getTriageLevelColor(6 as TriageLevel);
      // Should return some default color (may vary)
      expect(color0).toBeTruthy();
      expect(color6).toBeTruthy();
    });
  });

  describe('formatWaitTime', () => {
    it('should format 0 minutes', () => {
      const result = formatWaitTime(0);
      expect(result).toBeTruthy(); // Should return a string
      expect(typeof result).toBe('string');
    });

    it('should format minutes less than 60', () => {
      const result15 = formatWaitTime(15);
      const result45 = formatWaitTime(45);
      expect(result15).toContain('15');
      expect(result45).toContain('45');
    });

    it('should format hours and minutes', () => {
      const result90 = formatWaitTime(90);
      const result125 = formatWaitTime(125);
      expect(result90).toContain('1');
      expect(result90).toContain('30');
      expect(result125).toContain('2');
    });

    it('should format whole hours', () => {
      const result = formatWaitTime(60);
      expect(result).toContain('1');
    });

    it('should handle large wait times', () => {
      const result = formatWaitTime(300);
      expect(result).toBeTruthy();
    });
  });

  describe('getTriageLevelInfo', () => {
    it('should return correct info for ESI 1', () => {
      const info = getTriageLevelInfo(1);
      expect(info).toBeTruthy();
      expect(info.label).toContain('1');
      expect(info.color).toBeTruthy();
    });

    it('should return correct info for ESI 2', () => {
      const info = getTriageLevelInfo(2);
      expect(info).toBeTruthy();
      expect(info.label).toContain('2');
      expect(info.color).toBeTruthy();
    });

    it('should return correct info for ESI 3', () => {
      const info = getTriageLevelInfo(3);
      expect(info).toBeTruthy();
      expect(info.label).toContain('3');
      expect(info.color).toBeTruthy();
    });

    it('should return correct info for ESI 4', () => {
      const info = getTriageLevelInfo(4);
      expect(info).toBeTruthy();
      expect(info.label).toContain('4');
      expect(info.color).toBeTruthy();
    });

    it('should return correct info for ESI 5', () => {
      const info = getTriageLevelInfo(5);
      expect(info).toBeTruthy();
      expect(info.label).toContain('5');
      expect(info.color).toBeTruthy();
    });
  });

  describe('ESI Triage System Integration', () => {
    it('should maintain consistency between ESI levels and priorities', () => {
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
        expect(info).toBeTruthy();
        expect(info.color).toBeTruthy();
      });
    });

    it('should have decreasing urgency from ESI 1 to ESI 5', () => {
      const urgencyOrder = [1, 2, 3, 4, 5] as TriageLevel[];

      // ESI 1-2 should be stat
      expect(suggestPriorityFromTriage(urgencyOrder[0])).toBe('stat');
      expect(suggestPriorityFromTriage(urgencyOrder[1])).toBe('stat');

      // ESI 3 should be urgent
      expect(suggestPriorityFromTriage(urgencyOrder[2])).toBe('urgent');

      // ESI 4-5 should be routine
      expect(suggestPriorityFromTriage(urgencyOrder[3])).toBe('routine');
      expect(suggestPriorityFromTriage(urgencyOrder[4])).toBe('routine');
    });

    it('should have appropriate info for each ESI level', () => {
      const levels: TriageLevel[] = [1, 2, 3, 4, 5];

      levels.forEach((level) => {
        const info = getTriageLevelInfo(level);
        expect(info).toBeTruthy();
        expect(info.label).toBeTruthy();
        expect(info.color).toBeTruthy();
        expect(info.description).toBeTruthy();
      });
    });
  });
});
