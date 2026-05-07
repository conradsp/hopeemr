import { describe, it, expect } from 'vitest';
import { Location } from '@medplum/fhirtypes';
import {
  BedStatus,
  BED_STATUS_EXTENSION_URL,
  getOperationalStatusCode,
  getBedStatusFromLocation,
  setBedStatusExtension,
} from './bedManagement';

function makeBed(overrides: Partial<Location> = {}): Location {
  return {
    resourceType: 'Location',
    status: 'active',
    ...overrides,
  };
}

describe('bedManagement', () => {
  describe('getOperationalStatusCode (FHIR v2-0116)', () => {
    const cases: Array<[BedStatus, string]> = [
      ['available', 'U'],
      ['occupied', 'O'],
      ['reserved', 'O'],
      ['maintenance', 'C'],
      ['contaminated', 'K'],
      ['housekeeping', 'H'],
    ];
    it.each(cases)('maps %s -> %s', (status, code) => {
      expect(getOperationalStatusCode(status)).toBe(code);
    });
  });

  describe('getBedStatusFromLocation', () => {
    it('prefers the bed-status extension when present', () => {
      const bed = makeBed({
        operationalStatus: { code: 'O' },
        extension: [{ url: BED_STATUS_EXTENSION_URL, valueCode: 'reserved' }],
      });
      expect(getBedStatusFromLocation(bed)).toBe('reserved');
    });

    it('falls back to legacy code mapping for unmigrated beds (K -> housekeeping)', () => {
      const bed = makeBed({ operationalStatus: { code: 'K' } });
      expect(getBedStatusFromLocation(bed)).toBe('housekeeping');
    });

    it('falls back to legacy code mapping for unmigrated beds (I -> contaminated)', () => {
      const bed = makeBed({ operationalStatus: { code: 'I' } });
      expect(getBedStatusFromLocation(bed)).toBe('contaminated');
    });

    it('returns available when neither extension nor recognized code is present', () => {
      expect(getBedStatusFromLocation(makeBed())).toBe('available');
    });

    it('ignores an unrelated extension and uses legacy fallback', () => {
      const bed = makeBed({
        operationalStatus: { code: 'O' },
        extension: [{ url: 'http://example.org/other', valueString: 'foo' }],
      });
      expect(getBedStatusFromLocation(bed)).toBe('occupied');
    });

    it('rejects an extension with an unknown valueCode and falls back', () => {
      const bed = makeBed({
        operationalStatus: { code: 'U' },
        extension: [{ url: BED_STATUS_EXTENSION_URL, valueCode: 'not-a-status' }],
      });
      expect(getBedStatusFromLocation(bed)).toBe('available');
    });
  });

  describe('setBedStatusExtension', () => {
    it('appends the extension when none exists', () => {
      const result = setBedStatusExtension(undefined, 'reserved');
      expect(result).toEqual([{ url: BED_STATUS_EXTENSION_URL, valueCode: 'reserved' }]);
    });

    it('replaces an existing bed-status extension without duplicating', () => {
      const result = setBedStatusExtension(
        [{ url: BED_STATUS_EXTENSION_URL, valueCode: 'occupied' }],
        'reserved'
      );
      expect(result).toEqual([{ url: BED_STATUS_EXTENSION_URL, valueCode: 'reserved' }]);
    });

    it('preserves unrelated extensions', () => {
      const room = { url: 'http://example.org/fhir/StructureDefinition/room-number', valueString: '101' };
      const result = setBedStatusExtension([room], 'available');
      expect(result).toContainEqual(room);
      expect(result).toContainEqual({ url: BED_STATUS_EXTENSION_URL, valueCode: 'available' });
      expect(result).toHaveLength(2);
    });
  });

  describe('round-trip via extension', () => {
    const allStatuses: BedStatus[] = [
      'available',
      'occupied',
      'reserved',
      'maintenance',
      'contaminated',
      'housekeeping',
    ];
    it.each(allStatuses)('preserves %s through extension write/read', (status) => {
      const extension = setBedStatusExtension(undefined, status);
      const bed = makeBed({
        operationalStatus: {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0116',
          code: getOperationalStatusCode(status),
        },
        extension,
      });
      expect(getBedStatusFromLocation(bed)).toBe(status);
    });
  });
});
