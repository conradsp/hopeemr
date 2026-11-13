import { describe, it, expect } from 'vitest';
import { OperationOutcomeError, badRequest, forbidden, serverError, unauthorized } from '@medplum/core';
import { isPermanentSyncError } from './SyncManager';

describe('isPermanentSyncError', () => {
  it('treats authorization and validation failures as permanent', () => {
    expect(isPermanentSyncError(new OperationOutcomeError(forbidden))).toBe(true);
    expect(isPermanentSyncError(new OperationOutcomeError(unauthorized))).toBe(true);
    expect(isPermanentSyncError(new OperationOutcomeError(badRequest('invalid')))).toBe(true);
  });

  it('keeps server and network errors retryable', () => {
    expect(isPermanentSyncError(new OperationOutcomeError(serverError(new Error('boom'))))).toBe(false);
    expect(isPermanentSyncError(new TypeError('Failed to fetch'))).toBe(false);
  });
});
